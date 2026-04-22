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
- **Pedido de Biológico (Mensual)**: Ventana inteligente calculada alrededor del día 20 de cada mes (Lunes-Viernes).
- **Existencia de Biológico**: Jueves y Viernes (Días 4 y 5).

## 2. Estructura de Administración

El panel de Administración está dividido en sub-paneles modulares para evitar saturación visual:

1. **Configuración de Aperturas**: Gestión de fechas especiales y overrides para Consumibles y Biológicos.
2. **Catálogo de Biológicos**: Control de parámetros (min/max) y visibilidad de vacunas por unidad.
3. **Seguridad y Usuarios**: Control de acceso, actualización de roles y estado de cuentas (Sincronizado con Supabase Auth).

## 3. Integración con Supabase

- **Auth**: El login utiliza `supabase.auth`. No se crean usuarios directamente desde tablas manuales.
- **Validación**: La función `unitStatus` es el motor central. Consulta las tablas de configuración antes de permitir cualquier operación de guardado.
- **Sincronización**: Los cambios en roles o permisos se reflejan instantáneamente sin necesidad de refrescar la sesión del usuario final en la mayoría de los casos.
