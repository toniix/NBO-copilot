from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"  # Override para proxy compatible
    LLM_TIMEOUT_SECONDS: float = 30.0  # Timeout por llamada al LLM (evita cuelgues de 60s+)
    LLM_MAX_RETRIES: int = 1
    DEBUG: bool = True

    DATA_PATH: str = "app/data/clientes.csv"
    CHURN_MODEL_PATH: str = "app/ml/models/churn_segmentacion.pkl"
    PROPENSION_MODEL_PATH: str = "app/ml/models/modelo_propension.pkl"
    REBATE_CATALOG_PATH: str = "app/ml/models/catalogo_rebate.json"

    # Contrato de producción exportado por el equipo de Estadística (FASE 8)
    CONSTANTES_PATH: str = "app/ml/models/constantes_produccion.json"
    CATEGORIAS_PATH: str = "app/ml/models/categorias_produccion.json"

    # Catálogo de ofertas (RAG)
    CATALOG_PATH: str = "../catalogo_ofertas_entrega.csv"
    CATALOG_INDEX_PATH: str = "app/ml/catalog_index"
    CATALOG_EMBEDDING_MODEL: str = "paraphrase-multilingual-MiniLM-L12-v2"
    CATALOG_TOP_K: int = 5

    # Trazabilidad de outcomes comerciales
    OUTCOME_STORE_PATH: str = "app/data/outcomes.db"

    @property
    def data_path_full(self) -> Path:
        return BASE_DIR / self.DATA_PATH

    @property
    def churn_model_path_full(self) -> Path:
        return BASE_DIR / self.CHURN_MODEL_PATH

    @property
    def propension_model_path_full(self) -> Path:
        return BASE_DIR / self.PROPENSION_MODEL_PATH

    @property
    def rebate_catalog_path_full(self) -> Path:
        return BASE_DIR / self.REBATE_CATALOG_PATH

    @property
    def constantes_path_full(self) -> Path:
        return BASE_DIR / self.CONSTANTES_PATH

    @property
    def categorias_path_full(self) -> Path:
        return BASE_DIR / self.CATEGORIAS_PATH

    @property
    def catalog_path_full(self) -> Path:
        return BASE_DIR / self.CATALOG_PATH

    @property
    def catalog_index_full(self) -> Path:
        return BASE_DIR / self.CATALOG_INDEX_PATH

    @property
    def outcome_store_full(self) -> Path:
        return BASE_DIR / self.OUTCOME_STORE_PATH


settings = Settings()
