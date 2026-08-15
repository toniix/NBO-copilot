# Documentación de integración — Modelos ML del equipo de Estadística (FASES 1–8)

**Proyecto:** Movistar NBO Advisor Copilot · Desafío 2 (Next Best Offer)
**Alcance:** Spec de integración completa de los artefactos ML de `ModelosML/` al backend FastAPI.
**Última actualización:** 2026-08-14 — churn FASE 8 corregida: score individual + cuartiles (§4); verificación completa en `verify_models.py`.

> Fuentes revisadas: `FASE 1 - EDA`, `FASE 2 - FEATURE ENGINEERING`, `FASE 3 - TABLA DE ENTRENAMIENTO`,
> `FASE 4 - MODELO DE PROPENSION` (actualizada), `FASE 5 - CANAL OPTIMO`, `FASE 6 - MODULO DE REBATE`,
> `FASE 7 - VALIDACION FINAL`, `FASE 8` (versión corregida/actualizada).

---

## 1. Resumen ejecutivo

El paquete incluye **dos módulos ML** ("modelos") y tres módulos de soporte por reglas:

| Módulo | Artefacto | Tipo | ¿Supervisado? | Rol en el backend |
|---|---|---|---|---|
| **Propensión de aceptación** | `modelo_final_validado.pkl` (en backend: `modelo_propension.pkl`) | `Pipeline` sklearn: `ColumnTransformer` (StandardScaler + OneHotEncoder + passthrough) → `XGBClassifier` | ✅ Sí | Predice `p_acceptance` **por oferta** (cliente + oferta + canal) |
| **Churn / riesgo de fuga** | `churn_model.pkl` (en backend: `churn_segmentacion.pkl`) | Bundle `{scaler, kmeans, features, tipo_modelo}` + score/cuartiles en `constantes_produccion.json` | Sí — etiqueta por **score individual + cuartiles** (KMeans queda de referencia) | Etiqueta de riesgo + `churn_risk` (0-1) |
| Señal MT | — | Derivada | — | `mt_propensity` = promedio de `p_acceptance` sobre ofertas MT |
| Canal óptimo | `reglas_canal.json` | Reglas por segmento (chi-cuadrado) | — | `recomendar_canal()` |
| Rebate | `catalogo_rebate.json` | Reglas por motivo de rechazo | — | `rebate_prepared` para el asesor |

Detalles de fechas de la entrega: los `.pkl` del backend provienen de la versión **FASE 7 actualizada / FASE 8 actualizada**
(línea `11_fase7_actualizada.py` y `12_fase8_actualizada.py`), que incorpora los cambios pedidos por Sistemas:
`n_reclamos → n_reclamos_bin` y `antiguedad_meses → antiguedad_intervalo`.
El script `09_fase8_churn_corregido.py` usa el esquema **viejo** (numéricas) y **NO** corresponde al `.pkl` integrado.

---

## 2. Catálogo de artefactos del paquete

| Archivo | Backend destino | Config |
|---|---|---|
| `modelo_final_validado.pkl` | `app/ml/models/modelo_propension.pkl` | `PROPENSION_MODEL_PATH` |
| `churn_model.pkl` | `app/ml/models/churn_segmentacion.pkl` | `CHURN_MODEL_PATH` |
| `constantes_produccion.json` | `app/ml/models/constantes_produccion.json` | `CONSTANTES_PATH` |
| `categorias_produccion.json` | `app/ml/models/categorias_produccion.json` | `CATEGORIAS_PATH` |
| `catalogo_rebate.json` | `app/ml/models/catalogo_rebate.json` | `REBATE_CATALOG_PATH` |
| `reglas_canal.json` | (lógica replicada en `app/ml/channel_recommender.py`) | — |
| `tabla_entrenamiento.csv` / `tabla_pendientes.csv` / `clientes_features_modelo.csv` / `clean_catalogo.csv` | Base para verificación, funnel y catálogo | — |
| `churn_segmentacion.csv` | Categorías interpretables (`n_reclamos_categoria`, `antiguedad_categoria`…) replicadas en `feature_engineering.py` | — |
| `supervisor_kpis.json` / `dashboard_asesor_muestra.json` | KPIs de referencia para maquetar (repo de datos del supervisor) | — |
| `requirements_produccion.txt` | Pinning de librerías de inferencia | — |

---

## 3. Modelo de PROPENSIÓN (aceptación)

### 3.1 Definición del entrenamiento

- **Target (FASE 3):** `resultado_binario = 1` si `resultado == "aceptada"`. Solo se entrena sobre **ofrecimientos contactados**; los `pendiente`/`no_contactado` salen a `tabla_pendientes.csv` (funnel para supervisor).
- **Datos:** 254.618 ofrecimientos con resultado real · 100.000 clientes · 22 ofertas de catálogo.
- **Modelo:** `XGBClassifier(n_estimators=200, max_depth=6, learning_rate=0.1, scale_pos_weight ≈ 1.67, eval_metric="logloss")`.
- **Métricas (FASE 7/8):** AUC test **0.585 → 0.586** (esquema actualizado); AUC 5-fold CV **0.5855 ± 0.003**. Con umbral ajustado `≈ 0.351`: Accuracy 0.389, Precision 0.378, **Recall 0.981**, F1 0.546.
- **Hallazgo central (3 métodos):** conversión de Movistar Total ≈ 59% vs ≈ 29% del resto del catálogo.

### 3.2 Esquema de entrada — 28 columnas en 4 grupos (CONTRATO)

El pipeline es un `ColumnTransformer` con 4 grupos. **El orden por grupo es el contrato**
(`scripts/verify_models.py` lo valida). La columna `oferta_es_mt` queda como *remainder* y **se descarta**
(`drop`) → el modelo usa efectivamente **27 features**.

**Grupo `num` — 12 columnas (StandardScaler)**

| # | Feature | Tipo | Origen / fórmula |
|---|---|---|---|
| 1 | `monto_facturado_prom` | float | Factura promedio mensual |
| 2 | `riesgo_mora_score` | float | `dias_mora_prom + meses_moroso × 30` |
| 3 | `n_actividad_canal` | int | Contactos/interacciones en canales |
| 4 | `uso_app_movistar_prom` | float | Uso promedio de la app (min/sesiones) |
| 5 | `diferencia_gasto` | float | `monto_facturado_prom − monto_facturado_prom_6m` |
| 6 | `brecha_datos` | float | `consumo_datos_gb_prom − gb_plan_actual`; `0` si plan ilimitado (GB ≥ 9999); `0` (flag=0) si sin línea móvil |
| 7 | `ahorro_potencial_mt` | float | `costo_separado_estimado − precio_mt_sugerido`; `0` (flag=0) si ya MT o no elegible |
| 8 | `precio_mensual` | float | Precio de la **oferta candidata** (del catálogo) |
| 9 | `ahorro_pct` | float | % de ahorro de la **oferta candidata** (≈ indica MT) |
| 10 | `gb_incluidos` | float | GB de la **oferta candidata** (9999 = ilimitado) |
| 11 | `brecha_datos_aplica` | 0/1 | `1` si `brecha_datos` no es NaN |
| 12 | `ahorro_potencial_mt_aplica` | 0/1 | `1` si `ahorro_potencial_mt` no es NaN |

> **Importancia (FASE 4 actualizada):** `ahorro_pct` domina con importancia ≈ **0.739**; el resto de features del cliente pesa % 0.003–0.007 c/u.

**Grupo `cat` — 8 columnas (OneHotEncoder, `handle_unknown='ignore'`, `drop="first"`)**

| # | Feature | Categorías (`categorias_produccion.json`) |
|---|---|---|
| 1 | `canal` | `Call In`, `Call Out`, `Digital`, `Tienda` |
| 2 | `tipo_cliente` | `postpago`, `prepago`, `sin_linea_movil` |
| 3 | `edad_rango` | `18-25`, `26-35`, `36-45`, `46-55`, `56-65`, `65+` |
| 4 | `ubicacion_departamento` | `Arequipa`, `Cusco`, `Ica`, `Junin`, `La Libertad`, `Lambayeque`, `Lima`, `Otro`, `Piura` |
| 5 | `canal_mas_usado` | `Call In`, `Call Out`, `Digital`, `Tienda`, `sin_interaccion` |
| 6 | `oferta_tipo` | `equipo`, `movistar_total`, `paquete_adicional`, `plan_hogar`, `plan_movil`, `upgrade` |
| 7 | `segmento_objetivo` | `ambos`, `hogar`, `movil` |
| 8 | `antiguedad_intervalo` | **30 bins** `(0, 6], (6, 12], …, (174, 180]` = `pd.cut(antiguedad_meses, bins=range(0,186,6), right=True).astype(str)` |

**Grupo `bool` — 7 columnas (passthrough)**

`monto_facturado_prom_outlier`, `consumo_datos_gb_prom_outlier`, `tiene_movil`, `tiene_hogar`,
`tiene_internet_hogar`, `elegible_mt`, `n_reclamos_bin` (`n_reclamos > 0`).

**Remainder (descartado):** `oferta_es_mt` — booleana que indica si la oferta es MT. No se usa como feature.

### 3.3 Salida

`pipeline.predict_proba(X)[:, 1]` → **`p_acceptance ∈ [0,1]`** probabilidad de que el cliente acepte esa oferta.

Decisión binaria (metadata en API): `acepta_predicho = p_acceptance ≥ umbral_decision_modelo`.
`umbral_decision_modelo = 0.3508312` (ver §11 sobre inconsistencia con el paquete).

### 3.4 Punto de integración en el backend

- Carga: `app/ml/model_loader.py::load_models()` → `joblib.load(modelo_propension.pkl)`.
- Construcción de fila: `_build_propension_row_values(profile, offer, canal)` — genera el dict en el orden exacto de las 27 columnas.
- Scoring batch: `_score_propension_rows()` / `score_offers_acceptance()` — una sola pasada de `predict_proba` para N ofertas.
- Señal derivada: `derive_mt_propensity()` = media de `p_acceptance` sobre ofertas MT (responde por `mt_propensity` en la API).

---

## 4. Modelo de CHURN — riesgo de fuga (FASE 8 corregida: score + cuartiles)

### 4.1 Qué es y qué NO es

⚠ **No es un modelo supervisado** (no hay variable real de cancelación en los datos). Es una **segmentación de riesgo
por comportamiento**. La FASE 8 corregida (2026-08-14, `tipo_modelo: no_supervisado_segmentacion_corregido`) eliminó el
artefacto del KMeans: ya **no** se asigna la etiqueta por media de cluster (que colapsaba a los 6.734 clientes sin línea
en `riesgo_bajo` y dejaba la mora plana). Ahora cada cliente obtiene un **score individual** ponderado y la etiqueta
sale de los **cuartiles** de ese score. El KMeans se conserva en el bundle únicamente como artefacto de referencia.

### 4.2 Entrada — 7 features del cluster (CONTRATO del artefacto)

```
['antiguedad_meses', 'uso_app_movistar_prom', 'monto_facturado_prom', 'n_reclamos',
 'n_actividad_canal', 'riesgo_mora_score', 'elegible_mt']
```

- Se eliminaron `tiene_movil`, `tiene_hogar`, `tiene_internet_hogar` (explicaban el colapso del sin-línea).
- Se conserva para verificación del artefacto (`_churn_features_vector`) y del bundle (`verify_models.py`).

### 4.3 Scoring y etiqueta (CONTRATO de producción)

```
score = 1.0·riesgo_mora_score + 5.0·n_reclamos − 1.0·n_actividad_canal − 1.0·uso_app_movistar_prom
cuartiles = [-3.0, 30.33333333333334, 65.16666666666667]     # de la entrega
etiqueta  = pd.cut(score, bins=[-inf, *cuartiles, inf], right=True)
```

- Configuración en `constantes_produccion.json → churn_score` (leída por `get_churn_score_config()`). Además de
  `pesos`/`cuartiles`/`etiquetas` incluye las constantes del equipo: `kmeans_reponderacion_input`
  (`riesgo_mora_score: 2.5`, `n_reclamos: 1.5` — reponderación previa al KMeans) y `mora_media_esperada_por_etiqueta`.
- **Criterio de borde** = `right=True`: un score **igual** a un cuartil cae en la etiqueta inferior
  (`np.searchsorted(cuartiles, score, side="left")`). Implementado en `_churn_label_from_score()`.
- ⚠ El score **no debe redondearse**: `65.16666666666667` redondeado a `65.166667` cambia de lado del corte
  (el backend compara el float crudo; el fixture es el ground-truth oficial).

| etiqueta | `churn_risk` (mapeo backend) | Significado |
|---|---|---|
| `riesgo_bajo` | 0.2 | Riesgo bajo |
| `riesgo_medio_bajo` | 0.4 | Riesgo medio-bajo |
| `riesgo_medio_alto` | 0.7 | Riesgo medio-alto |
| `riesgo_alto` | 0.9 | Riesgo alto |

- **Salida del backend:** `churn_label` (etiqueta) y `churn_risk` (0.2 / 0.4 / 0.7 / 0.9).
- **Uso:** `pitch_type = "fidelizacion"` si `necesita_estrategia_retencion(churn_risk, profile)` (churn alto **o**
  `riesgo_mora_nivel == "alto"`), si no `"upselling"` (ver §4.6).
- **Validado contra el ground-truth de Estadística** (`churn_segmentacion.csv`): el score+cuartiles reproduce la
  etiqueta oficial en el **100%** de las 100k filas (incluye 1.875 casos cuyo score cae exactamente en un cuartil;
  ver `verify_models.py → check_churn_contract`).

### 4.4 Punto de integración en el backend

- Carga: `load_models()` → `churn_segmentacion.pkl` (bundle KMeans corregido, artefacto de referencia).
- Score + etiqueta: `_score_churn_risk(profile)` / `_churn_label_from_score(score)` (`app/ml/model_loader.py`).
- Score completo (una sola pasada, churn + MT en un llamado): `score_customer_full()`.

### 4.5 Categorías interpretables para dashboard (FASE 8, pedido de Sistemas)

Replicadas en `app/ml/feature_engineering.py::get_customer_profile()`:
`n_reclamos_categoria` (`0/1/2/3+`), `antiguedad_categoria` (~30 intervalos de 6 meses),
`antiguedad_categoria_simple` (`Nuevo (0-6m)` / `Reciente (6-24m)` / `Establecido (24-60m)` / `Fiel (60m+)`).

### 4.6 Corrección del artefacto sin-línea (2026-08-14)

**Antes (KMeans por media de cluster):** los 6.734 clientes sin línea quedaban 100% `riesgo_bajo` y la mora media
por etiqueta era plana (43.59 → 44.32). **Ahora (score + cuartiles):** la mora es **monótona** por etiqueta
(0.40 / 28.37 / 48.66 / 98.74), el sin-línea se **distribuye** en las cuatro etiquetas (~24–27%) y la decisión de
retención ya no depende de un artefacto conjetural.

**Mitigación que sigue vigente:** `necesita_estrategia_retencion(churn_risk, profile)` (`feature_engineering.py`)
activa la estrategia de retención (= fidelización) cuando el churn es alto **o** el cliente tiene
`riesgo_mora_nivel == "alto"` (tercil superior del contrato). Aplica a: `pitch_type`, `churn_alert` (API),
`es_urgente` (canal), justificación del NBO y query del RAG.

**Pendiente de Estadística:** etiquetar el score con los cuartiles en el propio `churn_model.pkl` (hoy viajan solo
en `constantes_produccion.json`, derivados de los CSV); y entregar la variable real de baja para un modelo supervisado.
**Nota (2026-08-14):** el equipo compartió los cuartiles redondeados (`30.333333`, `65.166667`); el backend mantiene la
precisión completa (`30.33333333333334`, `65.16666666666667`) porque los redondeados **rompen 500 etiquetas** en los
bordes. La validación cierra contra los valores exactos (`clientes_features_modelo.csv`).

---

## 5. Constantes de producción (contrato)

Leídas por `app/ml/production_contract.py` desde `constantes_produccion.json`:

| Clave | Valor | Uso |
|---|---|---|
| `riesgo_mora_score.corte_33` | 33.3333 | Tercil bajo de mora → canal & niveles (`riesgo_mora_nivel`) |
| `riesgo_mora_score.corte_66` | 42.5 | Tercil medio de mora |
| `outliers_percentil_995.monto_facturado_prom` | 245.5901 | Flag outlier factura |
| `outliers_percentil_995.consumo_datos_gb_prom` | `null` → default **74.6** | Flag outlier consumo (⚠ sin completar) |
| `oferta_hogar_base_id` | `OF005` | Plan hogar base para `ahorro_potencial_mt` |
| `umbral_decision_modelo` | **0.3508312** | `acepta_predicho` (metadata de la API) |

`categorias_produccion.json` documenta las categorías de las 7 variables categóricas del OHE
(**falta `antiguedad_intervalo`**, deuda §11).

---

## 6. Canal óptimo (FASE 5) — reglas

`reglas_canal.json` define segmentos `"{tipo_cliente} | mora_{nivel} | elegible_mt_{bool}"` con tasa de aceptación
histórica y p-valor chi-cuadrado. **Solo 1 segmento con evidencia significativa:**
`postpago | mora_bajo | elegible_mt_False → Digital` (36.8% vs 36.0%, p=0.0396). El resto cae a
`canal_habitual_del_cliente` → se resuelve al `canal_mas_usado` del cliente.

Implementación: `app/ml/channel_recommender.py::recomendar_canal()` (replica exacta; niveles de mora desde el contrato).
El canal resultante se usa como **feature `canal`** del modelo de aceptación y en la recomendación de canal del pitch.

---

## 7. Rebate (FASE 6) — estrategias por motivo de rechazo

`catalogo_rebate.json` — 6 motivos (`precio`, `no_necesita`, `ya_tiene_similar`, `mal_momento`, `no_confia`, `otro`)
con `estrategia` + `argumento_base`. En el backend `build_rebate_prepared()` prioriza los motivos según las señales del
cliente (`ahorro_potencial_mt` → "precio"; `brecha_datos` → "no_necesita").

**Nota FASE 6:** se intentó un modelo predictivo de `motivo_rechazo` pero no superó al baseline ingenuo
(0.35 vs 0.35 de accuracy) → se descartó el ML y quedó como reglas + reacción en tiempo real.

---

## 8. Puntos de integración en el backend (arquitectura)

```
POST /api/v1/recommendation  (app/api/v1/recommendation.py)
  └─ LangGraph grafo NBO (app/agents/graph.py)
       1. feature_eng_node   → profile (feature_engineering.py, DuckDB sobre clientes.csv)
       2. ml_scoring_node    → score_customer_full(): churn_risk + churn_label + mt_propensity
       3. catalog_retrieval_node
            - retrieve_offers()  (RAG Chroma top-5 → catálogo)
            - score_offers_acceptance()  (p_acceptance por oferta, batch)
            - _select_best_offer()  (ranking ML-primary + reglas)
            - recomendar_canal()  (FASE 5) · build_rebate_prepared() (FASE 6)
       4. llm_pitch_node     → guion de venta (LLM)
```

Carga en `lifespan` de FastAPI (`app/main.py`): `load_contract()` → `load_models()` → `load_catalog()` → `load_customers()`.

**Contrato back ↔ Estadística validado por** `scripts/verify_models.py`:
esquema del pipeline (12 num / 8 cat / 7 bool / 1 remainder), categorías OHE == JSON, bundle y features del churn,
**score individual + cuartiles vs ground-truth** (`check_churn_contract`: fixture 100%, reponderación KMeans vs scaler,
mora media por etiqueta), consistencia de constantes, sanidad de terciles de mora sobre clientes.csv, predicciones de
humo, y md5 vs la entrega.

---

## 9. Checklist de verificación local

```bash
cd Backend
python scripts/verify_models.py --source "../ModelosML/8. CHURN" --clientes 25
```

Resultado esperado: 0 errores de contrato · 1 warning (`outlier consumo_datos_gb_prom` en `null`).
**Nota (md5 §8):** `constantes_produccion.json` y `categorias_produccion.json` **difieren** del paquete de forma
**intencional** (backend agrega el bloque `churn_score` y documenta `antiguedad_intervalo`); `modelo_final_validado.pkl`
difiere porque el delivery es `CalibratedClassifierCV` (isotonic, cv=5) mientras el backend usa su Pipeline calibrado —
**pendiente de re-sincronizar/decidir con Estadística**, NO es parte del fix de churn.

---

## 10. Cambio reciente clave (esquema actualizado) — impacto en el backend

`n_reclamos` y `antiguedad_meses` numéricas fueron **reemplazadas** en el modelo por:

- `n_reclamos_bin` = `(n_reclamos > 0)` → bool (grupo `bool`).
- `antiguedad_intervalo` = `pd.cut(antiguedad_meses, bins=0..180 paso 6)` → 30 categorías (grupo `cat`).

Está **ya integrado** y cubierto por `verify_models.py`: `_build_propension_row_values()` genera el esquema nuevo
(bins centralizados en `ANTIGUEDAD_BINS`) y el contrato incluye `n_reclamos_bin` y `antiguedad_intervalo`.
La evaluación FASE 4 actualizada confirma **sin cambio real de desempeño** (AUC 0.585 → 0.586, F1 0.547 → 0.546);
el cambio es de *distribución de importancia / interpretabilidad*, no de poder predictivo.

---

## 11. Problemas y deudas detectadas en la entrega

1. **Umbral de decisión inconsistente en el paquete.** Conviven 3 valores: `FASE 4 - MODELADO/umbral_final.txt` = 0.30,
   `FASE 4 - MODELO DE PROPENSION/umbral_final.txt` = **0.3508312** (el correcto, coincide con el resumen FASE 4 actualizada "umbral 0.351")
   y `FASE 8/constantes_produccion.json` / `supervisor_kpis.json` = **0.2824119** (obsoleto). **El backend usa 0.3508312.**
   Si se re-sincroniza `constantes_produccion.json` desde FASE 8, `acepta_predicho` cambiará de signo para un rango de probabilidades.
2. **`antiguedad_intervalo` falta en el `categorias_produccion.json` entregado en FASE 8** (30 bins). El backend ya lo
   documentó en su copia del JSON (validado por `verify_models.py` — 1 categoría ✓), pero la entrega de Estadística sigue
   sin él → pedir regenerar el JSON oficial.
3. **`consumo_datos_gb_prom` outlier = `null`** → backend usa default 74.6. Pedir completar.
4. **`README.txt` y docstrings de FASE 8 (12_fase8_actualizada.py) están desactualizados** (mencionan "versiones numéricas originales" que ya no se usan), y el README **anuncia como corregido el caso sin-línea que persiste** (§4.6).
5. **Drift de librerías vs `requirements_produccion.txt`** (xgboost 3.3 vs 3.4 en venv; pandas 2.2 vs 3.0.5). Verificado que `pd.cut` da el mismo formato; sklearn 1.6.1 coincide (el crítico).
6. Backend: **un LLM con error tumba toda la recomendación** (HTTP 500) aunque el NBO ya esté decidido — vulnerabilidad del flujo, no del modelo.
7. **Artefacto "sin línea móvil = riesgo_bajo" (§4.6):** el fix de mora se aplicó pero el resultado práctico no cambió
   (los 6.734 sin-línea quedan 100% bajo, mora plana entre etiquetas). Mitigado en backend; **decisión de Estadística**
   pendiente si quieren mora real en la segmentación.

**Resultos directamente en el backend (2026-08-13):** `categorias_produccion.json` con `antiguedad_intervalo` (30 bins,
orden OHE del pickle), `riesgo_mora_nivel` en el perfil, port del `explicar_recomendacion` (FASE 8) a la justificación,
y mitigación §4.6.

---

## 12. Mejoras recomendadas aprovechando el modelo nuevo (visto el flujo real)

Priorizadas por impacto / riesgo:

1. **Puntuar TODO el catálogo, no top-5 del RAG (optimizador global).** La función de Estadística
   (`recomendar_oferta_completa`) puntúa las 22 ofertas y toma `argmax`. El backend limita a top-5 semánticas.
   Con 22 filas y una sola pasada de `predict_proba` es trivial: aplicar primero los filtros de negocio
   (asequibilidad, anti-downgrade, segmento, elegible MT) y **después** rankear por `p_acceptance`. El RAG queda como
   memoria/alternativas, no como compuerta. Es el mayor cambio con la mayor ganancia de fidelidad al diseño MSI.
2. **Ranking "ML-primary" honesto.** Quitar el `round(p, 2)` (crea empates artificiales → decide el RAG) y rankear a
   precisión completa. El boost MT actual es binario y duro (`1.0/0.0`) → convertirlo en prior suave
   (`p + λ·I_mt`, λ≈0.05) o confiar en el modelo (que ya premia MT vía `ahorro_pct`).
3. **Reusar umbral de aceptación para `prefer_mt`.** `mt_propensity` es una media de probabilidades; el umbral 0.65
   es arbitrario y convive con 0.50 en otros nodos. Alinearlo con `umbral_decision_modelo` (0.35) y centralizarlo en el contrato.
4. **Portar `explicar_recomendacion()` (FASE 8) a la justificación del NBO.** Razones de negocio reales
   ("consume X GB más de su plan", "riesgo de mora bajo", "ahorraría S/ Y") en vez del texto genérico.
   El perfil ya tiene `brecha_datos`, `ahorro_potencial_mt`, `riesgo_mora_score`. **✅ Implementado (2026-08-13):**
   `_select_best_offer` ya añade `brecha_datos`, `ahorro_potencial_mt`, `riesgo_mora_nivel` (bajo/alto) y
   antigüedad ≥ 60 meses; se añadió `riesgo_mora_nivel` al perfil.
5. **Calibración/ranking del modelo.** El umbral 0.351 prioriza recall (98%). Para el ranking por oferta conviene
   evaluar con métrica de ranking (NDCG@k, lift por decil — FASE 4 ya exporta `lift_por_decil.csv`) y opcionalmente
   calibración isotónica antes de ordenar.
6. **Traza de churn → modelo supervisado.** Cuando Movistar entregue la variable real de baja, reentrenar churn como
   clasificador supervisado calibrado (el bundle ya lo anota como siguiente paso). Mientras tanto, alimentar la
   calibración con `outcomes.db` (aceptaciones/rechazos reales por gestión).
7. **Resiliencia del LLM.** Si falla el pitch, devolver 200 con `sales_pitch=""` y el NBO completo (ya calculado),
   en vez de 500.
8. **Resolver el conflicto de umbral (§11.1)** y regenerar `categorias_produccion.json` con `antiguedad_intervalo`
   para cerrar la deuda de contrato y evitar regresiones en `acepta_predicho`.
9. **Mitigar el artefacto sin-línea (§4.6)** sin esperar la re-segmentación: enmarcar retención desde la mora real
   (`riesgo_mora_nivel == "alto"`) además del churn del bundle. **✅ Implementado (2026-08-13):**
   `necesita_estrategia_retencion()` aplicado a `pitch_type`, `churn_alert`, `es_urgente`, justificación y query RAG.

---

*Fin de la documentación de integración.* Para la implementación actual del flujo NBO ver
`docs/informe_implementacion_modelos_fase7.md`.