# Web Consulta Churn

Dashboard comercial para telecomunicaciones que ayuda a identificar riesgo de churn y recomendar la siguiente mejor oferta (Next Best Offer, NBO).

## Arquitectura

- **React 18 + TypeScript** con Vite.
- **Tailwind CSS** para una interfaz responsive con identidad visual Movistar.
- **Zustand** para autenticación, búsqueda, simulación manual y estado del dashboard.
- **Recharts** para las métricas del supervisor.
- **Capa API preparada para FastAPI/Python** en `src/lib/apiService.js`, configurable mediante `VITE_AI_MODEL_URL`.

## Funcionalidades

- Dashboard del asesor en `/dashboard`.
- Búsqueda de clientes por teléfono de 9 dígitos.
- Perfil, riesgo de churn y Next Best Offer.
- Modal de simulación manual cuando un cliente no se encuentra.
- Dashboard gerencial en `/supervisor` con KPIs y retención.
- Reporte visual HTML para presentaciones.
- Exportación CSV para análisis técnico.
- Acceso diferenciado para asesor y supervisor.

## Resiliencia Operativa

El proyecto incluye un **Modo Supervivencia** para que la interfaz siga siendo demostrable aunque el backend o el modelo predictivo aún no estén disponibles:

- El caso de demostración `999999999` devuelve datos mock de un cliente.
- Un cliente no encontrado activa la simulación manual de oferta.
- La simulación genera una recomendación a partir de variables estratégicas y mantiene operativo el flujo comercial.
- La integración real con un modelo de terceros se habilita mediante `VITE_AI_MODEL_URL` sin modificar la interfaz.
	- El proyecto corre en modo Mock/demo por defecto para la hackathon: los clientes y las interacciones se simulan y persisten en `localStorage`. No se requiere backend.

Los datos mock son exclusivamente para demostración y deben sustituirse por servicios autenticados antes de producción.

## Requisitos

- Node.js 18 o superior.
- npm 9 o superior.

## Instalación Local

```bash
npm install
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`.

## Verificación

```bash
npm run build
npm run lint
```

`npm run build` ejecuta TypeScript y genera la versión optimizada de Vite.

## Usuarios Demo Locales

Estas cuentas solo sirven para validar la interfaz localmente:

- Vero: `vero.demo@movistar.test`
- Anthony: `anthony.demo@movistar.test`
- Gabriela: `gabriela.demo@movistar.test`
- Supervisor: `supervisor.demo@movistar.test`

Las contraseñas de demo se gestionan en el flujo local mediante hashes PBKDF2. No se deben reutilizar en producción.

Las ventas demo se sincronizan entre pestañas mediante eventos locales del navegador para validar la experiencia asesor-supervisor. En producción deben sustituirse por persistencia y autorización en backend.

## Configuración del Modelo Real

Crear un archivo `.env.local` a partir de `.env.example` y definir la URL del servicio FastAPI (opcional para integración real):

```env
VITE_AI_MODEL_URL=https://tu-servicio-predictivo.example.com/predict
VITE_ENABLE_DEMO_AUTH=false
# Contraseña universal para demo (opcional - sobreescribe el valor por defecto)
VITE_DEMO_PASSWORD=Hackathon2026*
```

No incluir claves privadas en variables `VITE_*`, porque Vite las expone al navegador. La autenticación y los secretos del servicio deben resolverse en un backend seguro. Las cuentas demo se habilitan automáticamente solo con `npm run dev`; el flag `VITE_ENABLE_DEMO_AUTH=true` debe reservarse para builds de demostración y nunca para producción.

## Consideraciones de Seguridad

- La sesión demo se guarda en `sessionStorage` y se elimina al cerrar la pestaña o cerrar sesión.
- El rol del frontend sirve para controlar la navegación de la demo; la autorización real debe validarse en el backend para cada operación.
- El servicio FastAPI debe publicarse mediante HTTPS y la capa API aplica un timeout de 10 segundos.
- Las exportaciones CSV escapan valores que podrían interpretarse como fórmulas en Excel.
- Antes de producción deben añadirse autenticación real, expiración de sesión, rate limiting, auditoría y gestión de secretos en servidor.
- En este prototipo de hackathon la persistencia real está deshabilitada; el equipo debe evaluar integración backend y políticas RLS cuando se pase a producción.

Model serving (opcional)
-------------------------

Para integrar un modelo pre-entrenado que calcule la probabilidad de churn, el equipo de estadística puede entregar un artefacto scikit-learn serializado con `joblib` y un archivo JSON con el orden de las features. Pasos recomendados:

1. Entregar los siguientes archivos:
	- `churn_model.joblib` — objeto scikit-learn (o pipeline) con `predict_proba`.
	- `feature_names.json` — lista JSON con los nombres de las variables de entrada en el orden esperado por el modelo.

2. Colocar ambos archivos en la carpeta `models/` del servidor (o usar el endpoint de carga).

3. Ejecutar el servidor de modelo (recomendado en un entorno aislado / Docker):

```bash
python -m pip install -r requirements.txt
uvicorn src.model_server:app --host 0.0.0.0 --port 8000 --reload
```

4. Opcionalmente se puede subir el modelo mediante HTTP POST a `/upload-model`. Configure la variable de entorno `MODEL_UPLOAD_TOKEN` para proteger la carga y envíe el encabezado `x-upload-token` con el valor correcto.

Ejemplo con `curl`:

```bash
curl -X POST -H "x-upload-token: $MODEL_UPLOAD_TOKEN" -F "file=@churn_model.joblib" http://localhost:8000/upload-model
```

5. En el frontend configure `VITE_AI_MODEL_URL` apuntando al endpoint `http://localhost:8000/predict`.

Formato esperado por el endpoint `/predict` (JSON):

```json
{ "phone": "999999999", "clientData": { "feature_a": 1.2, "feature_b": 0, "feature_c": 42 } }
```

Respuesta esperada:

```json
{ "phone": "999999999", "churn_probability": 0.32, "prediction": 0 }
```

Recomendaciones de implementación y rendimiento
- Preferir un pipeline scikit-learn que incluya preprocesamiento (imputación, escalado, codificación) para asegurar que el servidor reciba siempre features numéricas listas para predecir.
- Para alta disponibilidad y latencias bajas, desplegar el servidor de modelos en un contenedor y usar un proceso de tipo Gunicorn/Uvicorn con múltiples workers o una solución de serving dedicada (Seldon, KFServing, TorchServe) para modelos más pesados.
- Monitorizar latencias y devolver errores HTTP adecuados si el modelo no está cargado.

Si quieres, implemento el `Dockerfile` y el script de despliegue para producción mínima.

## Release Candidate v1.0

El candidato incluye los flujos principales de asesor y supervisor, simulación resiliente, exportación de reportes, validación responsive y capa de integración preparada para el modelo predictivo real.
