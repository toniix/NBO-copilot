# Visión General del Proyecto y Especificación del Sistema

**Documento:** Architectural Vision & Project Blueprint  

**Proyecto:** Movistar NBO Advisor Copilot  

**Hackathon:** Hackathon AI Telecom Challenge 2026 (Integratel Perú S.A.A. / Universidad de Lima)  

**Desafío Seleccionado:** Desafío 2 – Personalización comercial inteligente (Next Best Offer)  

---

# 1. Declaración del Problema y Oportunidad de Negocio

## El Problema Actual

Movistar ofrece paquetes, upgrades y servicios a través de diversos canales (Call Center, Tiendas, WhatsApp). Sin embargo, el ofrecimiento comercial sufre de baja relevancia por varias razones:

- **Ofertas Masivas y Genéricas:**  
  Se ofrecen productos estandarizados sin adaptar la propuesta al perfil real, patrón de consumo o momento del cliente.

- **Asesor sin Contexto ni Tiempo:**  
  En los entornos de atención bajo presión, el asesor comercial carece de una vista unificada y en tiempo real sobre la propensión del cliente o su riesgo de cancelación (*churn*).

- **Desaprovechamiento de Movistar Total (MT):**  
  Aunque MT es el producto estrella (genera un ahorro de hasta el 50% para el cliente y blinda su permanencia), su ofrecimiento suele ser reactivo.

---

## La Oportunidad

Desarrollar un sistema de recomendación inteligente en tiempo real para el asesor comercial que:

- Priorice la oferta con mayor probabilidad de aceptación.
- Justifique el motivo comercial.
- Entregue un guion de venta (*sales pitch*) hiperpersonalizado generado en lenguaje natural.

---

# 2. Objetivo Estratégico e Impacto Esperado

El objetivo del proyecto **Movistar NBO Advisor Copilot** es maximizar el valor de cada interacción comercial incrementando las ventas de Movistar Total y reduciendo la fuga de clientes.

---

## Métricas Metas (KPIs del Proyecto)

| KPI | Meta |
|---|---|
| Participación de Movistar Total | Superar el **50% en venta hogar** y **10% en venta móvil** con MT |
| Conversión Comercial | Incremento del **+20%** en aceptación de ofertas |
| ARPU | Incremento del **+10%** mediante campañas efectivas de *upselling* y *cross-selling* |
| Churn | Reducción del **-15%** en clientes en riesgo mediante ofertas de fidelización |

---

# 3. Descripción de la Solución

**Movistar NBO Advisor Copilot** es una aplicación web tipo **Single Page Application (SPA)** impulsada por un motor híbrido de Inteligencia Artificial:

- ML Predictivo.
- IA Generativa.
- Orquestación mediante un Grafo de Estado con **LangGraph**.

---

## Principales Funcionalidades

### 1. Búsqueda por ID/DNI Sintético

El asesor ingresa el identificador del cliente dentro del dashboard.

---

### 2. Perfilamiento y Alerta de Churn

Visualización inmediata de:

- Consumo actual.
- Mora.
- Histórico del cliente.
- Nivel de riesgo de cancelación.

---

### 3. Tarjeta NBO (Next Best Offer)

Presentación del producto óptimo acompañado de:

- Oferta recomendada.
- Probabilidad de aceptación.
- Motivo comercial.

---

### 4. Sales Pitch Generado con LLM

Generación automática de un guion comercial listo para:

- Lectura durante la llamada.
- Copia hacia WhatsApp.

Ejemplo:

> "Ahorra 50% y obtén GB ilimitados con Movistar Total."

---

### 5. Registro de Cierre Comercial

Botones de acción rápida:

- `Aceptó`
- `Rechazó - Precio`
- `Rechazó - Sin interés`

---

# 4. Arquitectura y Stack Tecnológico

El sistema adopta una arquitectura desacoplada donde Frontend y Backend se comunican mediante API REST usando JSON.

```
+---------------------------------------+
|          FRONTEND (React)             |
|  (Vite + TailwindCSS + Axios/Fetch)   |
+---------------------------------------+
                    |
                    | HTTP POST /api/v1/recommendation
                    v
+---------------------------------------+
|          BACKEND (FastAPI)            |
|       (Python + CORS Middleware)      |
+---------------------------------------+
                    |
                    v
+-----------------------------------------------------------------+
|                    ORQUESTADOR LANGGRAPH                        |
|                                                                 |
|   +---------------------+      +----------------------------+   |
|   | 1. Feature Eng. Node| ---> | 2. ML Scoring Node (.pkl)  |   |
|   |  (Pandas / DuckDB)  |      |   (XGBoost / scikit-learn) |   |
|   +---------------------+      +----------------------------+   |
|                                              |                  |
|                                              v                  |
|                                +----------------------------+   |
|                                | 3. LLM Pitch Node          |   |
|                                |   (LangChain + GPT-4o-mini)|  |
|                                +----------------------------+   |
+-----------------------------------------------------------------+
```

---

# Capas del Stack

## Frontend

- React (JavaScript)
- Vite
- TailwindCSS
- Lucide React

## Backend

- FastAPI
- Uvicorn
- Pydantic
- CORS Middleware

## Agentes y Orquestación

- LangGraph
- LangChain

## Machine Learning

- XGBoost
- Scikit-learn
- Joblib / Pickle

## IA Generativa

- OpenAI API
- Modelo: `gpt-4o-mini`

## Persistencia y Data Ingestion

- Pandas
- DuckDB
- Dataset sintético en CSV

---

# 5. Flujo de Datos del Sistema (Data Pipeline)

## Paso 1: Petición del Asesor

El usuario ingresa el DNI sintético en el Frontend:

```json
{
  "dni": "12345678"
}
```

---

## Paso 2: Recepción en Backend

FastAPI recibe:

```
POST /api/v1/recommendation
```

---

## Paso 3: Ejecución del Grafo LangGraph

### Nodo 1: `feature_eng_node`

Responsabilidades:

- Cargar dataset sintético.
- Calcular variables:

```
ratio_uso_datos
meses_antiguedad
historial_mora
```

---

### Nodo 2: `ml_scoring_node`

Ejecuta el modelo:

```
modelo.pkl
```

Generando:

```json
{
  "p_acceptance_mt": 0.87,
  "p_churn": 0.72
}
```

---

### Arista Condicional

Evalúa:

```
Si p_churn > 0.60
```

Activa reglas de fidelización con Movistar Total.

---

### Nodo 3: `llm_pitch_node`

Envía al LLM:

- Perfil del cliente.
- Scores ML.
- Oferta recomendada.

Genera:

- Argumento comercial.
- Guion personalizado.

---

## Paso 4: Respuesta JSON

FastAPI retorna la información procesada al Frontend.

---

## Paso 5: Renderizado

El dashboard actualiza:

- Perfil del cliente.
- Alertas.
- Oferta recomendada.
- Sales pitch.

Tiempo objetivo:

```
< 2 segundos
```

---

# 6. Backlog de Trabajo y Tickets de Desarrollo

# Frente 1: Frontend (React + Vite + TailwindCSS)

## FE-1 - Setup

Inicialización del proyecto:

- Vite.
- React.
- TailwindCSS.

---

## FE-2 - Layout & Search

Implementación:

- Header.
- Navbar.
- Buscador por DNI.

---

## FE-3 - Cards & Alerts

Componentes:

- Tarjeta de perfil.
- Alertas de churn.
- Tarjeta NBO.

---

## FE-4 - Sales Pitch & Copy

Implementación:

- Texto comercial generado.
- Botón copiar al portapapeles.
- Botones de acción comercial.

---

## FE-5 - API Integration

Integración con FastAPI mediante:

- Fetch.
- Axios.

---

# Frente 2: Backend, ML & Agentes (FastAPI + LangGraph)

## BE-1 - Setup & CORS

Configuración inicial:

- FastAPI.
- CORS.
- Comunicación con React.

---

## BE-2 - Feature Engineering

Implementación:

- Carga CSV.
- Transformación de datos.
- Extracción de variables.

---

## BE-3 - ML Integration

Integración:

- Modelo `.pkl`.
- XGBoost.
- Scikit-learn.

---

## AG-1 - LangGraph Workflow

Construcción del grafo:

- `AgentState`
- Nodos.
- Aristas condicionales.
- Compilación.

---

## AG-2 - LLM Pitch Generator

Configuración:

- Prompts LangChain.
- OpenAI API.
- `gpt-4o-mini`.

Salida estructurada:

- Oferta.
- Beneficio.
- Argumento comercial.

---

## BE-4 - Endpoint Orchestration

Integración final:

```
POST /api/v1/recommendation
```

Ejecutando:

```
FastAPI → LangGraph → ML → LLM → Response JSON
```
