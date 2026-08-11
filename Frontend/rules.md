# Reglas de Trabajo del Proyecto (Multiagente + SOLID)

**SOLID:** Separa siempre la lógica de negocio, las llamadas a la IA y las bases de datos en archivos independientes.
**Control de Tokens:** 
- No reescribas archivos completos si solo cambia una función. Genera solo los cambios necesarios.
- Antes de procesar textos o archivos largos, resume con Gemini Flash.
**Manejo de Errores (Fallback):** 
Si una API de IA lanza error de límite o cuota, notifica al usuario para cambiar de perfil de API.