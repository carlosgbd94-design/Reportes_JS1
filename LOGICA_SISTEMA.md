# Lógica del Sistema: Reportes JS1 (Referencia Técnica)

Este archivo sirve como fuente de verdad para el comportamiento del sistema, garantizando que las migraciones y cambios de lógica respeten las reglas de negocio establecidas.

## 1. Reglas de Captura y Calendario Inteligente

El sistema determina si un usuario puede capturar información basándose en tres niveles de prioridad:

### Nivel 1: Apertura Manual (Admin)
- Si el administrador activa una **Apertura Extraordinaria** en el panel de control, la captura se habilita para todas las unidades, independientemente del día.
- **Tabla**: `aperturas_consumibles` y `calendario_pedidos`.
- **Leyenda UI**: "Apertura extraordinaria habilitada por Administrador".

### Nivel 2: Inteligencia de Feriados (Automático)
- El sistema conoce los días festivos oficiales de México y fines de semana.
- **Regla Consumibles (Jueves)**: Si el Jueves es festivo, la captura se recorre automáticamente al Miércoles.
- **Regla Existencia Biológica (Jueves y Viernes)**: Si alguno es festivo, se habilita el día hábil más cercano.
- **Leyenda UI**: "Apertura anticipada por día inhábil".

### Nivel 3: Reglas Operativas (Estándar)
- **Consumibles**: Jueves (Día 4).
- **Existencia de Biológico**: Diaria (Lunes a Viernes).
- **Pedido de Biológico (Logística del Día 22)**:
  - **Fecha Objetivo**: Día 22 de cada mes.
  - **Ajuste Inteligente**: Si el día 22 es inhábil (sábado, domingo o festivo), el objetivo se mueve al día hábil **anterior**.
  - **Ventana Oficial (Pedido Mensual)**: 3 días hábiles (1 día antes del objetivo, el día objetivo, y 1 día después).
  - **Pedido Extraordinario**: Cualquier captura realizada fuera de la ventana oficial se marca automáticamente como "EXTRAORDINARIO".
  - **Opción "Sin Pedido"**: Permite capturar existencias sin generar solicitud de biológico. Requiere confirmación si la existencia es menor al promedio.
  - **Bloqueos de Guardado**: El sistema bloquea el guardado **únicamente** si no se respetan los múltiplos de 5 en biológicos críticos (HEXAVALENTE, ROTAVIRUS, NEUMOCÓCICA 13, NEUMOCÓCICA 20 y SRP).

## 2. Estructura de Administración

El panel de Administración está dividido en sub-paneles modulares para evitar saturación visual:

1. **Configuración de Aperturas**: Gestión de fechas especiales y overrides para Consumibles y Biológicos.
2. **Catálogo de Biológicos**: Control de parámetros (min/max) y visibilidad de vacunas por unidad.
   - **Ordenamiento Geográfico**: Las listas de unidades se ordenan jerárquicamente por Municipio y luego por CLUES para una localización rápida.
   - **Integridad de Datos**: Al guardar una captura de biológicos, el sistema envía el catálogo completo. Si una vacuna está deshabilitada para la unidad, se guarda automáticamente con valor **0** para mantener la integridad de la matriz de exportación.
3. **Seguridad y Usuarios**: Control de acceso, actualización de roles y estado de cuentas (Sincronizado con Supabase Auth).

> [!IMPORTANT]
> La pestaña de **Administración** en el panel superior es exclusiva para el rol `ADMIN`. Los roles `MUNICIPAL` y `JURISDICCIONAL` tienen acceso a los resúmenes y métricas, pero no al panel de control administrativo.

## 3. Integración con Supabase

- **Auth**: El login utiliza `supabase.auth`. No se crean usuarios directamente desde tablas manuales.
- **Validación**: La función `unitStatus` es el motor central. Consulta las tablas de configuración antes de permitir cualquier operación de guardado.
- **Sincronización**: Los cambios en roles o permisos se reflejan instantáneamente sin necesidad de refrescar la sesión del usuario final en la mayoría de los casos.

## 4. Interfaz y Experiencia de Usuario (UX)

### Barra de Acciones Principal
Para optimizar el flujo de trabajo, los botones de acción en el encabezado siguen el orden específico solicitado:
1.  **Salir**: Cierre seguro de la sesión.
2.  **Exportar reportes**: Extracción de datos en formatos externos.
3.  **Subir archivos**: Carga de nuevas evidencias al servidor.
4.  **Explorador**: Visualización de archivos y evidencias existentes.
5.  **Notificaciones**: Centro de comunicación y alertas.

### Mejoras de Interacción
- **Selectores de Fecha**: Todos los campos de tipo `date` y `month` activan automáticamente el calendario nativo al hacer clic en cualquier parte del componente (incluyendo iconos y bordes), mejorando la accesibilidad y velocidad de captura.
- **Resumen de Captura**: Los filtros se presentan en una sola fila compacta para optimizar el espacio vertical en pantallas grandes.
