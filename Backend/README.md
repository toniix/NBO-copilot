# Backend — Movistar NBO Advisor Copilot

Backend de IA del sistema **Next Best Offer (NBO)** para el asesor comercial de Movistar.
Recibe un cliente (código `CLI...`, celular o DNI), ejecuta el pipeline de IA y devuelve:
perfil del cliente, scores ML, la **NBO** con justificación, canal/momento recomendado,
rebates y un **guion de venta (pitch) generado por LLM**.

**Stack:** FastAPI · LangGraph · scikit-learn / XGBoost · ChromaDB (RAG de catálogo) · OpenAI-compatible LLM.

---

## 1. Requisitos

- **Python 3.10+** (probado con 3.12)
- `pip` y `venv`
- Conexión a internet la primera vez (descarga el modelo de embeddings de HuggingFace)

> **IMPORTANTE:** el dataset de clientes, los modelos `.pkl` y el índice del catálogo **NO están en git**
> (están en `.gitignore` para no subir pesos/binarios). Para arrancar, copia los artefactos desde el
> workspace original del equipo o regenéralos (§7):
>   - Dataset de clientes (trackeado en el repo):
>     `cp "dataset_clientes - dataset_clientes.csv" app/data/clientes.csv`
>   - Modelos `.pkl` (`churn_segmentacion.pkl`, `modelo_propension.pkl`, `constantes_produccion.json`, ...):
>     copiarlos desde el workspace del equipo a `app/ml/models/`
>   - Índice del catálogo: reconstruirlo con `scripts/build_catalog_index.py` (ver §7)

## 2. Instalación

```bash
cd Backend

# 1) Entorno virtual
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# 2) Dependencias
pip install -r requirements.txt

# 3) Configuración
cp .env.example .env
#   Edita .env y pon tu OPENAI_API_KEY (ver §6). Sin key el backend funciona,
#   pero el pitch llega vacío (sales_pitch="") por diseño.
```

## 3. Verificación rápida del entorno

```bash
python scripts/verify_models.py                     # sanity completo de modelos y contrato FASE 8
python scripts/verify_models.py --clientes 5        # con menos predicciones de humo
```

El script valida el contrato de churn (score + cuartiles), el bundle de segmentación,
las propensiones y las predicciones de humo. Debe terminar sin errores.

## 4. Ejecutar el servidor

```bash
uvicorn app.main:app --reload --port 8000
```

- **Swagger UI:** http://localhost:8000/docs
- **Health:** http://localhost:8000/health

Al arrancar carga en memoria: contrato de producción, modelos ML, catálogo (RAG) y dataset de clientes
(≈ 15 MB). Si falta un artefacto, el log indica exactamente qué script ejecutar.

> **Frontend (opcional):** desde `Frontend/` corre `npm install && npm run dev`
> (Vite en `http://localhost:5173`, ya habilitado por CORS). Los códigos demo son `CLI000001`–`CLI100000`.

## 5. Probar la API

```bash
# Recomendación NBO completa (pipeline: FE → ML → NBO → pitch LLM)
curl -s -X POST http://localhost:8000/api/v1/recommendation \
  -H "Content-Type: application/json" \
  -d '{"dni": "CLI091849"}' | python3 -m json.tool

# Cliente no existente → 404
curl -s -X POST http://localhost:8000/api/v1/recommendation \
  -H "Content-Type: application/json" \
  -d '{"dni": "CLI999999"}'
```

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/` | Info raíz (docs, health) |
| `POST` | `/api/v1/recommendation` | Pipeline NBO completo para un `dni` (cliente) |
| `POST` | `/api/v1/outcome` | Registrar resultado de gestión (aceptada/rechazada) |
| `GET` | `/api/v1/outcomes?limit=N` | Historial de gestiones |
| `GET` | `/api/v1/outcomes/summary` | Resumen para supervisión |
| `GET` | `/api/v1/supervisor/metrics` | Métricas agregadas de supervisión |

### Pipeline NBO (`LangGraph`)

```
START → feature_eng_node → ml_scoring_node → catalog_retrieval_node → llm_pitch_node → END
            └── cliente no encontrado → END (HTTP 404)
```

- **feature_eng_node:** construye el perfil del cliente (perfil + señales de negocio FASE 8).
- **ml_scoring_node:** churn (contrato FASE 8) y propensión a Movistar Total.
- **catalog_retrieval_node:** rankea todo el catálogo con `p_acceptance` (ML-primary) y selecciona la NBO;
  además define canal/momento y rebates.
- **llm_pitch_node:** genera el guion de venta con un **LLM actuando como asesor comercial senior**
  (persona + reglas + fórmula de venta en `app/agents/nodes.py`). Si el LLM falla, el pitch se
  degrada a `""` pero el resto de la respuesta se mantiene intacta (resiliencia).

## 6. Variables de entorno (`.env`)

| Variable | Default | Descripción |
|---|---|---|
| `OPENAI_API_KEY` | *(vacía)* | Key del LLM. Vacía ⇒ `sales_pitch=""` (degradado) |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Override para proxies compatibles (p. ej. Azure OpenAI) |
| `LLM_TIMEOUT_SECONDS` | `30.0` | Timeout por llamada al LLM |
| `LLM_MAX_RETRIES` | `1` | Reintentos del LLM |
| `DEBUG` | `true` | Logging en nivel DEBUG |
| `DATA_PATH` | `app/data/clientes.csv` | Dataset de clientes |
| `CHURN_MODEL_PATH` | `app/ml/models/churn_segmentacion.pkl` | Modelo de churn (FASE 8) |
| `PROPENSION_MODEL_PATH` | `app/ml/models/modelo_propension.pkl` | Modelo de propensión MT |
| `REBATE_CATALOG_PATH` | `app/ml/models/catalogo_rebate.json` | Catálogo de rebates |
| `CONSTANTES_PATH` | `app/ml/models/constantes_produccion.json` | Contrato FASE 8 (pesos, cuartiles, umbrales) |
| `CATEGORIAS_PATH` | `app/ml/models/categorias_produccion.json` | Categorías FASE 8 |
| `CATALOG_PATH` | `../ModelosML/catalogo_ofertas_entrega.csv` | CSV del catálogo (solo para reconstruir el índice) |
| `CATALOG_INDEX_PATH` | `app/ml/catalog_index` | Índice ChromaDB (ya construido) |
| `CATALOG_EMBEDDING_MODEL` | `paraphrase-multilingual-MiniLM-L12-v2` | Modelo de embeddings del RAG |
| `CATALOG_TOP_K` | `5` | Ofertas recuperadas por el RAG |
| `OUTCOME_STORE_PATH` | `app/data/outcomes.db` | SQLite de trazabilidad |

## 7. Regenerar artefactos (solo si es necesario)

Normalmente **no se necesita**: el repo ya trae `app/ml/models/*.pkl`, `app/ml/catalog_index/` y `app/data/clientes.csv`.

```bash
# 1) Modelos de churn/propensión (deben venir del workspace del equipo de Estadística;
#    no se regeneran desde cero porque usan el contrato FASE 8).
#    Copia a app/ml/models/: churn_segmentacion.pkl, modelo_propension.pkl,
#    constantes_produccion.json, categorias_produccion.json, catalogo_rebate.json.

# 2) Índice del catálogo (RAG). El CSV vive en ModelosML/ (no trackeado):
cp ../ModelosML/catalogo_ofertas_entrega.csv ../catalogo_ofertas_entrega.csv
python scripts/build_catalog_index.py

# 3) Entrenar el modelo de aceptación de ofertas (FASE 7)
python scripts/train_acceptance_model.py
```

## 8. Solución de problemas frecuentes

| Error / síntoma | Causa | Solución |
|---|---|---|
| `❌ ... Ejecuta: python scripts/generate_models.py` | Falta algún `.pkl` (no están en git) | Copia los `.pkl` desde el workspace del equipo a `app/ml/models/` (ver §7) |
| `❌ ... Ejecuta: python scripts/build_catalog_index.py` | Falta `app/ml/catalog_index/` | Copia el CSV y corre §7.2 |
| `sales_pitch=""` en la respuesta | `OPENAI_API_KEY` vacía o LLM caído | Pon la key en `.env` y revisa el log |
| `warnings ... unknown categories` en logs | One-hot con categorías no vistas | Normal, no bloquea |
| `404 Cliente no registrado` | El `dni` no está en `clientes.csv` | Usa un código `CLI000001`–`CLI100000` |

## 9. Estructura relevante

```
Backend/
├── app/
│   ├── main.py                  # FastAPI + lifespan (carga modelos)
│   ├── core/config.py           # Settings (.env)
│   ├── agents/                  # Grafo LangGraph (graph.py) y nodos (nodes.py)
│   ├── api/v1/                  # Endpoints REST
│   └── ml/                      # model_loader, feature_engineering, catalog_retriever,
│                                # production_contract, channel_recommender, outcome_store
│       ├── models/              # .pkl + constantes/categorías (contrato FASE 8)
│       ├── catalog_index/       # Índice ChromaDB del catálogo (preconstruido)
│       └── data/clientes.csv    # Dataset sintético (CLI000001–CLI100000)
├── scripts/                     # generate_models, build_catalog_index, train_acceptance_model,
│                                # verify_models (+ fixtures/churn_contract.csv)
├── docs/                        # Documentación técnica (integración de modelos, FASE 7)
├── requirements.txt
└── .env.example                 # Plantilla de configuración
```
