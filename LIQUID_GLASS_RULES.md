# 🧪 LIQUID GLASS DESIGN RULES (SENIOR ARCHITECT EDITION)

Estas reglas son mandatorias para lograr la fidelidad visual de Apple 2026. Cualquier desviación hacia el "blur blanco barato" será rechazada.

## 1. Arquitectura de Biseles (The Bevel System)
El cristal líquido DEBE tener profundidad física. No es una superficie plana.
- **Regla del Borde Especular**: Todo elemento debe tener un borde de `0.5px` a `1px`. El color debe ser `rgba(255,255,255,0.7)` en el cuadrante superior-izquierdo y desvanecerse a `transparent` en el resto.
- **Regla de Profundidad Interna**: Utilizar `box-shadow: inset 0 1px 2px rgba(255,255,255,0.4)`. Esto simula el rebote de luz dentro del grosor del cristal.

## 2. Refracción Dinámica (Refraction Engine)
El cristal no solo empaña, **deforma**.
- **Regla del Mapa de Desplazamiento**: Se DEBE usar el filtro SVG `#liquid-refraction` (con `feDisplacementMap`).
- **Ajuste de Escala**: La escala del desplazamiento debe estar entre `20` y `40`. Valores más bajos son "vidrio", valores más altos son "líquido".

## 3. Pureza Espectral (Zero Milky Layers)
- **Prohibición del Blanco**: El `background` del contenedor de cristal debe ser `transparent !important`. 
- **Control de Saturación**: Para compensar la falta de fondo blanco, se debe usar `saturate(200%)` o superior para que los colores del fondo brillen a través del material.
- **Contraste Dinámico**: Usar `contrast(1.1)` para asegurar que los bordes del contenido interno no se pierdan en la refracción.

## 4. Estructura de Capas (Layering)
```html
<div class="GlassContainer">
  <!-- Capa 1: El Contenido UI -->
  <div class="GlassContent">...</div>
  
  <!-- Capa 2: El Material Físico -->
  <div class="GlassMaterial">
    <div class="GlassBevel"></div>       <!-- Bisel y Brillo de Borde -->
    <div class="GlassRefraction"></div>  <!-- Motor de Deformación SVG -->
    <div class="GlassGloss"></div>       <!-- Reflejo Especular Superior -->
  </div>
</div>
```

## 5. Legibilidad Crítica
- El texto sobre cristal líquido debe ser **Negro Puro** o **Azul Profundo** (para temas claros) con `font-weight: 800+`. El cristal tiende a "adelgazar" las fuentes debido a la refracción; compensar con peso extra.

---
*Documento de Referencia Técnica - Actualizado Abril 2026*
