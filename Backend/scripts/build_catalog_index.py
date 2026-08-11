"""
build_catalog_index.py
----------------------
Indexa el catálogo de ofertas (catalogo_ofertas_entrega.csv) en un
vector store Chroma persistido en disco. Este índice es la "memoria"
del agente: el nodo catalog_retrieval_node consulta aquí las ofertas
más relevantes para cada perfil de cliente.

Uso:
    python scripts/build_catalog_index.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
from chromadb import PersistentClient
from chromadb.utils import embedding_functions
from sentence_transformers import SentenceTransformer

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.core.config import settings

COLLECTION_NAME = "catalogo_ofertas"

# Columnas del catálogo usadas para construir el documento indexado
TEXT_COLUMNS = [
    "nombre_oferta",
    "tipo_oferta",
    "segmento_objetivo",
    "descripcion_bundle",
    "descripcion_corta",
]
META_COLUMNS = [
    "oferta_id",
    "nombre_oferta",
    "tipo_oferta",
    "segmento_objetivo",
    "es_movistar_total",
    "precio_mensual",
    "ahorro_pct",
    "gb_incluidos",
    "cluster_hogar",
]


def _to_document(row: pd.Series) -> str:
    """Convierte una fila del catálogo en un texto indexable en español."""
    parts = [
        f"Oferta: {row['nombre_oferta']}",
        f"Tipo: {row['tipo_oferta']}",
        f"Segmento objetivo: {row['segmento_objetivo']}",
    ]
    if row.get("descripcion_bundle") and not pd.isna(row["descripcion_bundle"]):
        parts.append(f"Bundle: {row['descripcion_bundle']}")
    if row.get("descripcion_corta") and not pd.isna(row["descripcion_corta"]):
        parts.append(f"Detalle: {row['descripcion_corta']}")
    parts.append(f"Precio mensual: S/ {row['precio_mensual']}")
    parts.append(f"Ahorro: {row['ahorro_pct']}%")
    parts.append(f"Datos incluidos: {row['gb_incluidos']} GB")
    if row.get("es_movistar_total"):
        parts.append("Es Movistar Total (producto convergente premium)")
    if row.get("cluster_hogar") and not pd.isna(row["cluster_hogar"]):
        parts.append(f"Cluster hogar: {row['cluster_hogar']}")
    return ". ".join(parts) + "."


def main() -> None:
    catalog_path = settings.catalog_path_full
    if not catalog_path.exists():
        print(f"❌ Catálogo no encontrado: {catalog_path}")
        sys.exit(1)

    print(f"📄 Leyendo catálogo: {catalog_path}")
    df = pd.read_csv(catalog_path, sep=",", encoding="utf-8-sig")
    df = df.fillna("")

    documents = [_to_document(row) for _, row in df.iterrows()]
    ids = df["oferta_id"].astype(str).tolist()
    metadatas = [
        {
            col: (
                str(row[col])
                if isinstance(row[col], (str, bool))
                else (float(row[col]) if not pd.isna(row[col]) else None)
            )
            for col in META_COLUMNS
        }
        for _, row in df.iterrows()
    ]

    print(f"🧠 Cargando modelo de embeddings: {settings.CATALOG_EMBEDDING_MODEL}")
    model = SentenceTransformer(settings.CATALOG_EMBEDDING_MODEL)
    embed_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=settings.CATALOG_EMBEDDING_MODEL
    )

    index_dir = settings.catalog_index_full
    index_dir.mkdir(parents=True, exist_ok=True)

    print(f"💾 Persistiendo índice en: {index_dir}")
    client = PersistentClient(path=str(index_dir))
    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=embed_fn,
        metadata={"hnsw:space": "cosine"},
    )

    # Rebuild limpio si ya existía
    existing = collection.count()
    if existing > 0:
        print(f"⚠️  El índice ya tiene {existing} documentos. Regenerando...")
        client.delete_collection(COLLECTION_NAME)
        collection = client.get_or_create_collection(
            name=COLLECTION_NAME,
            embedding_function=embed_fn,
            metadata={"hnsw:space": "cosine"},
        )

    collection.add(ids=ids, documents=documents, metadatas=metadatas)
    print(f"✅ Índice creado con {collection.count()} ofertas.")

    # Guardar también el dataframe crudo para joins rápidos (plan_actual_id → oferta)
    df.to_csv(index_dir / "catalog.csv", index=False)
    print("📦 Catálogo crudo guardado en catalog.csv para joins de negocio.")


if __name__ == "__main__":
    main()
