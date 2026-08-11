# Software Design Document (SDD) - Web Consulta Churn

## 1. Visión General
Sistema web para consulta y gestión de clientes con riesgo de churn (baja) en el sector telecomunicaciones.

## 2. Arquitectura Técnica

### Stack Tecnológico
- **Frontend**: React 18 + JavaScript
- **Framework**: Vite (build tool)
- **Estilos**: Tailwind CSS + CSS Modules
- **Routing**: React Router DOM v6
- **Estado Global**: Zustand (lightweight state management)
- **Backend (Prototype)**: Mock Mode local (sin backend requerido para la hackathon). Integración con servicios productivos se evaluará en fases posteriores.
- **Iconos**: Lucide React
- **Linting**: ESLint + Prettier

### Justificación del Stack
- **Vite**: Mejor experiencia de desarrollo, build más rápido que CRA
- **Tailwind CSS**: Estilos consistentes, desarrollo rápido, fácil mantenimiento
- **Zustand**: Solución de estado simple y escalable vs Redux complejo
-- **Mock Mode / Integración futura**: En este prototipo las operaciones se simulan en cliente; la integración con un backend como Supabase o un API propio se diseñó para ser opcional.
- **React Router DOM**: Routing estándar de la industria

## 3. Diseño y UX

### Paleta de Colores Corporativa (Movistar)
- **Primary**: `#019DF4` (Azul Movistar) - Botones principales, encabezados
- **Action**: `#5BC500` (Verde) - Acciones positivas, confirmaciones
- **Background**: `#F5F6F8` (Gris claro) - Fondo de la aplicación
- **Text**: `#313235` (Gris oscuro) - Texto principal
- **Secondary**: `#FF6B35` (Naranja) - Alertas, advertencias
- **Success**: `#00A859` (Verde éxito)
- **Error**: `#E74C3C` (Rojo error)

### Tipografía
- **Principal**: Inter (Google Fonts) - 400, 500, 600, 700
- **Monospace**: 'JetBrains Mono' para código

## 4. Estructura de Módulos

### Módulo 1: Autenticación
- Login con email/password
- Registro de nuevos usuarios
- Recuperación de contraseña

### Módulo 2: Dashboard Principal
- Vista general de métricas de churn
- Gráficos de tendencias
- KPIs principales

### Módulo 3: Gestión de Clientes
- Listado de clientes con riesgo
- Filtros avanzados (segmentación)
- Detalle por cliente

### Módulo 4: Análisis Predictivo
- Modelos de predicción de churn
- Factores de riesgo
- Recomendaciones personalizadas

### Módulo 5: Reportes
- Exportación de datos
- Reportes programados
- Dashboards ejecutivos

## 5. Arquitectura de Componentes

### Atomic Design Pattern
- **Atoms**: Botones, inputs, iconos
- **Molecules**: Formularios, cards, alerts
- **Organisms**: Headers, sidebars, modals
- **Templates**: Layouts de página
- **Pages**: Vistas completas

## 6. Estado Global (Zustand Stores)

### Stores Planificados
- `authStore`: Estado de autenticación
- `uiStore`: Estado de UI (theme, modales)
- `customersStore`: Datos de clientes
- `analyticsStore`: Métricas y análisis

## 7. Integración con Supabase

### Tablas Principales
- `profiles`: Información de usuarios
- `customers`: Datos de clientes
- `churn_predictions`: Predicciones de churn
- `interactions`: Historial de interacciones
- `reports`: Reportes generados

### Funciones RPC
- `calculate_churn_score()`: Calcula score de churn
- `get_customer_trends()`: Obtiene tendencias por cliente

## 8. Seguridad

### Niveles de Acceso
- **Admin**: Acceso completo
- **Manager**: Gestión de equipos
- **Analyst**: Solo lectura y análisis
- **Viewer**: Dashboards limitados

### Protección de Datos
- Encriptación en tránsito (HTTPS)
- Encriptación en reposo (Supabase)
- Autenticación JWT
- Rate limiting

## 9. Performance

### Objetivos
- Tiempo de carga inicial < 3s
- Time to Interactive < 5s
- Lighthouse Score > 90

### Optimizaciones
- Code splitting por ruta
- Lazy loading de componentes
- Image optimization
- Caching estratégico

## 10. Roadmap

### Fase 1 (MVP - 4 semanas)
- Autenticación básica
- Dashboard con métricas
- Listado de clientes

### Fase 2 (6 semanas)
- Análisis predictivo
- Reportes básicos
- Exportación CSV

### Fase 3 (8 semanas)
- Alertas en tiempo real
- Integración con APIs externas
- Mobile app (React Native)

---

**Fecha de Creación**: $(date)
**Versión**: 1.0.0
**Responsable**: Senior Software Architect