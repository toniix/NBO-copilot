# Informe de implementación — Modelos finales (FASE 7 propensión / FASE 8 churn)

**Fecha:** 2026-08-11
**Origen:** paquete `ModelosML/FASE 7 - VALIDACION FINAL/` y `ModelosML/FASE 8/`
**Destino:** `Backend/app/ml/models/`

---

## 1. Resumen

Se integró al backend el **modelo de propensión validado de FASE 7**
(`modelo_final_validado.pkl`) y las **constantes de producción actualizadas**
(`constantes_produccion.json`, nuevo umbral de decisión). El modelo de churn de
FASE 8 es **idéntico** al ya integrado, por lo que no requirió cambios.

La integración es **descubrible por contrato**: `scripts/verify_models.py` valida
el esquema del pipeline, el catálogo de categorías y las constantes antes de
considerar el despliegue válido. Resultado: **0 errores, 2 warnings** (detallados
en §5).

---

## 2. Artefactos y verificaciones de integridad (md5)

| Artefacto | Fuente | Backend | ¿Igual? |
|---|---|---|---|
| `modelo_propension.pkl` | `FASE 7 - VALIDACION FINAL/modelo_final_validado.pkl` — `540d1d92e7369d943273cec5508a50db` | `540d1d92e7369d943273cec5508a50db` | ✅ copiado |
| `constantes_produccion.json` | `FASE 8/constantes_produccion.json` — `35135651fa26e3820a018681293d2ab3` | `35135651fa26e3820a018681293d2ab3` | ✅ copiado |
| `churn_segmentacion.pkl` | `FASE 8/churn_model.pkl` — `327b0b1c…` | `327b0b1c…` | ✅ sin cambios |
| `categorias_produccion.json` | `FASE 8/categorias_produccion.json` — `1cfaa9eb…` | `1cfaa9eb…` | ✅ sin cambios (ver §5-1) |
| `catalogo_rebate.json` | sin nuevos md5 | `f861adea…` | ✅ sin cambios |

### 2.1 Cambio relevante en constantes

`umbral_decision_modelo` pasó de `0.3507315` → **`0.3508312`**. El resto de
constantes permanece igual (cortes de mora 33.3333/42.5, outlier de monto
245.5901, consumo `null`).

El umbral se expone en la API como **metadata** (`decision_threshold`) y se
calcula `acepta_predicho = p_acceptance >= umbral` sobre la oferta seleccionada,
sin modificar la lógica de selección del NBO (decisión acordada con el equipo).

---

## 3. Diff de esquema del pipeline de propensión

El modelo de FASE 7 **cambia el contrato de features** frente al modelo viejo que
estaba en el backend (FASE 4). El pipeline es ahora un `ColumnTransformer` con
**28 columnas de entrada repartidas en 4 grupos**:

| Grupo | FASE 4 (integrado antes) | FASE 7 (nuevo) | Cambio |
|---|---|---|---|
| numérico | 14 (`antiguedad_meses`, `n_reclamos` incluidas) | **12** (sin `antiguedad_meses`, sin `n_reclamos`) | ⬇️ −2 |
| categórico | 7 | **8** (+ `antiguedad_intervalo`) | ⬆️ +1 |
| booleano | 6 | **7** (+ `n_reclamos_bin`) | ⬆️ +1 |
| remainder (passthrough) | 1 | 1 | = |

**Transformaciones clave del nuevo modelo:**
- `antiguedad_meses` (numérica cruda) → **`antiguedad_intervalo`** categórica:
  `pd.cut(antiguedad_meses, bins=0..180, paso 6)` → 30 intervalos
  (`'(0, 6]', …, '(174, 180]'`). Valores `0` o `>180` → `NaN` → `handle_unknown='ignore'`.
- `n_reclamos` (numérica cruda) → **`n_reclamos_bin`** booleana: `n_reclamos > 0`.
- OneHotEncoder ahora usa **`drop="first"`**.
- `scale_pos_weight = 1.6685619211067588` (desbalanceo de clases).

**Vectores de entrada esperados (12 numérico + 8 cat + 7 bool + 1 remainder = 28):**

```python
NUM_COLS  = [monto_facturado_prom, riesgo_mora_score, n_actividad_canal,
             uso_app_movistar_prom, diferencia_gasto, brecha_datos,
             ahorro_potencial_mt, precio_mensual, ahorro_pct, gb_incluidos,
             brecha_datos_aplica, ahorro_potencial_mt_aplica]            # 12
CAT_COLS  = [canal, tipo_cliente, edad_rango, ubicacion_departamento,
             canal_mas_usado, oferta_tipo, segmento_objetivo,
             antiguedad_intervalo]                                       # 8
BOOL_COLS = [monto_facturado_prom_outlier, consumo_datos_gb_prom_outlier,
             tiene_movil, tiene_hogar, tiene_internet_hogar, elegible_mt,
             n_reclamos_bin]                                             # 7
# remainder '20' (passthrough)                                           # 1
TOTAL = 28
```

---

## 4. Cambios aplicados en el backend

| Archivo | Cambio |
|---|---|
| `app/ml/models/modelo_propension.pkl` | **Reemplazado** por `modelo_final_validado.pkl` (FASE 7). |
| `app/ml/models/constantes_produccion.json` | **Reemplazado** por versión FASE 8 (umbral 0.3508312). |
| `app/ml/model_loader.py` | `_build_propension_row_values` genera el esquema nuevo: deriva `antiguedad_intervalo` vía `pd.cut` (bins 0..180 paso 6) y `n_reclamos_bin`; `ANTIGUEDAD_BINS` centralizado. |
| `scripts/verify_models.py` | Contrato actualizado a 28 columnas; valida `antiguedad_intervalo` contra los bins derivados y contra el JSON. |
| `app/api/v1/recommendation.py` | (ya integrado previamente) `decision_threshold` + `acepta_predicho` en la respuesta. |
| `app/ml/catalog_retriever.py` | **Nuevo decisor por reglas + ML**: query semántica sin contaminación MT para no-elegibles; filtros de asequibilidad, morosidad y anti-downgrade; wrapper público `prefer_mt()`. |
| `app/agents/nodes.py` | **Ranking ML-primary**: `_select_best_offer` ordena por `p_acceptance` (RAG solo desempata); refuerzo de paso natural ("upgrade") para clientes en plan base; la oferta ganadora lidera `offers_retrieved`. |

Sin cambios: `churn_segmentacion.pkl`, `categorias_produccion.json`,
`catalogo_rebate.json`, `channel_recommender.py`, `feature_engineering.py`,
`production_contract.py` (todos ya leen de las constantes por contrato).

---

## 4.1 Decisor del NBO: RAG = memoria, reglas + ML = decisor

**Antes:** el `score` semántico de Chroma (similitud coseno) era el criterio
principal de ranking y elegía el NBO; el ML solo aportaba scores informativos.
Problema detectado: el RAG podía seleccionar ofertas premium inasequibles
(2.5× la factura de un cliente moroso) y hasta **downgrades**.

**Ahora** (arquitectura desacoplada):

1. **RAG = memoria.** Acota el catálogo a candidatas relevantes (`retrieve_offers`,
   `catalog_retriever.py`), con una query saneada: la señal "propenso a Movistar
   Total" solo se inyecta si `elegible_mt`; se agrega contexto de morosidad y de
   bajo consumo ("plan económico, no necesita datos ilimitados").
2. **Reglas de negocio = filtros duros** (`_filter_by_business_rules`):
   - **Asequibilidad:** se descarta toda oferta con
     `precio_mensual > factor × factura` (factor `1.5`; `1.25` si `meses_moroso > 0`).
   - **Anti-downgrade** (`_es_downgrade`): nunca un plan más barato o con menos
     GB que el actual del cliente (móvil/móvil, hogar/hogar); los "upgrade" de GB
     se descartan si el cliente ya está en plan tope (GB ≥ 9999).
   - Segmento compatible y MT no-ofrecible a no-elegibles (ya existían).
3. **Modelo ML = decisor.** `_select_best_offer` (`agents/nodes.py`) ordena por
   `p_acceptance` (FASE 7) redondeado a 2 decimales (banda de ~1 p.p.); el
   `score` semántico del RAG solo **desempata** entre probabilidades casi
   idénticas. A clientes en plan de entrada (`OF001`) se les prioriza el paso
   natural (`tipo_oferta == "upgrade"`, +0.05).
4. **LLM = comunicador.** Escribe el guion sobre la oferta ya decidida.

**Validación (12 clientes, selección sin LLM):** ningún NBO supera el tope de
asequibilidad, no hay downgrades y la propensión del modelo FASE 7 es quien
ordena. Casos de referencia:
- `CLI000500` (plan base, mora 2m, factura S/35.9): antes recomendaba
  **OF004 Ilimitado S/99.9** (2.5× su factura); ahora **OF012 Upgrade a Plan Max
  S/40** (paso natural, ML 47%).
- `CLI000001` (plan Plus, mora 3m): ahora **OF012 Upgrade a Plan Max S/40**
  (mejor p_acceptance 38%).
- `CLI000012` (plan ilimitado): ya no recibe downgrade; recibe cross-sell
  (paquete roaming S/29.9).

Tunables (constantes en código): `AFFORDABILITY_FACTOR`, `AFFORDABILITY_FACTOR_MOROSO`
(`catalog_retriever.py`); `PLAN_BASE_TIER`, `STEP_UP_BOOST` (`nodes.py`).

---

## 5. Inconsistencias detectadas

1. **`categorias_produccion.json` no documenta `antiguedad_intervalo`.**
   El JSON (idéntico al del paquete) conserva el esquema de FASE 4 y no incluye
   las 30 categorías del nuevo modelo. El OneHotEncoder usa
   `handle_unknown='ignore'`, así que el backend **no falla**, pero es una
   **deuda de contrato**: el JSON como fuente de verdad no cubre el feature.
   **Acción recomendada:** pedir a Estadística que regenere el JSON con
   `antiguedad_intervalo` o documentar los 30 bins. El backend ya la valida
   contra el modelo (warning §6) en vez de contra el JSON.

2. **Documentación desactualizada en el paquete.**
   `README.txt` y el docstring de `FASE 8/12_fase8_actualizada.py` afirman que la
   propensión usa "las versiones numéricas originales" (FASE 4), lo que
   **contradice el modelo enviado** (usa `antiguedad_intervalo` y
   `n_reclamos_bin`). Ajustar para reflejar el esquema real.

3. **Drift de versiones `requirements_produccion.txt` vs venv backend.**
   - `xgboost`: exigen `3.3.0`, venv tiene `3.4.0`. El pickle carga bien, pero al
     exponerlo con `Booster.save_model` se silenciaría el warning.
   - `pandas`: exigen `2.2.2`, venv tiene `3.0.5`. **Verificado**: `pd.cut`
     produce el mismo formato de intervalo en ambas.
   - `numpy`: exigen `2.0.2`, venv `2.5.1`. Sin impacto observado.
   - `scikit-learn` **`1.6.1` en ambos** ✅ (el componente crítico del pickle) y
     `joblib` también coincide.

4. **Outlier de consumo nulo.**
   `constantes_produccion.json` trae `consumo_datos_gb_prom: null`; el backend
   resuelve al default `74.6` (warning). Pedir completar el valor a Estadística.

5. **Warnings de carga (no bloqueantes):** XGBoost (modelo serializado de versión
   anterior) y StandardScaler (features sin nombres en el remainder) al puntuar.

---

## 6. Resultados de verificación

`python Backend/scripts/verify_models.py` → **0 errores, 2 warnings** ✅

- Contrato de producción cargado; umbral 0.3508312, OF005, cortes mora, outliers. ✅
- Churn: 10 features en orden, 4 clusters, scaler (10,) ✅
- Propensión: 12 num / 8 cat / 7 bool ✅; categorías OHE == JSON para las 7
  documentadas ✅; `antiguedad_intervalo` == **30 bins 0..180** ✅
  (⚠ no documentada en el JSON — §5-1).
- Constantes: contrato == JSON ✅ (⚠ outlier consumo `null` → 74.6).
- Sanidad terciles mora re-calculados ≈ JSON ✅
- 25 predicciones de humo sin errores ✅

### 6.1 Regresión end-to-end (`CLI000001`)

| Métrica | FASE 4 (antes) | FASE 7 (ahora) |
|---|---|---|
| `churn_risk` | 0.4 | 0.4 (sin cambio) |
| `mt_propensity` | 0.6565 | **0.6617** |
| oferta / `p_acceptance` | — / 0.6793 | OF002 / **0.3697** |
| `pitch_type` | — | upselling |

Con umbral 0.3508312 → `p_acceptance` 0.3697 ≥ umbral ⇒ `acepta_predicho=True`,
`churn_alert=False` (0.4 ≤ 0.60).

### 6.2 Regresión del decisor (NBO, sin LLM)

Validado sobre 12 clientes (`CLI000001`..`CLI000012`) con el nuevo decisor:
**0 errores, 0 downgrades, 0 ofertas sobre el tope de asequibilidad** ✅

| Cliente | Plan | Factura | Mora | NBO nuevo |
|---|---|---|---|---|
| CLI000001 | OF002 Plus | 58.39 | 3m | OF012 Upgrade a Plan Max (S/40, ML 38%) |
| CLI000002 | OF009 Hogar | 111.41 | 2m | OF008 Internet + TV Hogar (S/129.9) |
| CLI000003 | OF004 Ilimitado | 100.71 | 0 | OF018 Paquete Seguridad (S/12.9) |
| CLI000004 | OF003 Max | 70.44 | 2m | OF012 Upgrade a Plan Max (S/40) |
| CLI000005 | OF003 Max | 76.87 | 2m | OF012 Upgrade a Plan Max (S/40) |
| CLI000006 | OF001 Base | 36.57 | 1m | OF011 Upgrade a Plan Plus (S/20, ML 54%) |
| CLI000007 | OF001 Base | 36.15 | 3m | OF012 Upgrade a Plan Max (S/40) |
| CLI000008 | OF003 Max | 87.75 | 2m | OF005 Internet Hogar 100Mb (S/89.9) |
| CLI000009 | OF004 Ilimitado | 102.87 | 1m | OF006 Internet Hogar 200Mb (S/109.9) |
| CLI000010 | OF004 Ilimitado | 92.99 | 2m | OF014 Equipo Smartphone (S/45) |
| CLI000011 | OF005 Hogar | 83.53 | 0 | OF018 Paquete Seguridad (S/12.9) |
| CLI000012 | OF004 Ilimitado | 100.54 | 0 | OF019 Paquete Roaming (S/29.9) |

---

## 7. Acciones pendientes (recomendadas)

1. Estadística: regenerar `categorias_produccion.json` incluyendo
   `antiguedad_intervalo` (30 bins).
2. Estadística: actualizar `README.txt` y docstrings con el esquema FASE 7 real;
   completar outlier `consumo_datos_gb_prom`.
3. Backend (opcional): alinear `xgboost` a la versión exigida o exportar el
   modelo con `Booster.save_model` para silenciar el warning de carga.
4. **Re-baselinear los valores esperados de regresión** — con el decisor nuevo,
   el NBO de referencia cambió: `CLI000001` pasa de OF002 a **OF012** y
   `p_acceptance` a 0.3773; la línea base es ahora `mt_propensity=0.6617`,
   `churn=0.4`.
5. Confirmar con Estadística la semántica de precio de las ofertas "upgrade"
   (OF011/OF012: ¿precio incremental o total?) — afecta al filtro de
   asequibilidad y al prompt del LLM.