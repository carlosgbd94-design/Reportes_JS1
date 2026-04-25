# 💎 Liquid Glass Design Rules (Apple iOS 2026 Standard)

Guía técnica para replicar el material "Liquid Glass" de forma optimizada y sin pixelación.

## 1. El Material (The Surface)
El cristal líquido es incoloro. No debe usarse `background-color` sólido ni gradientes internos opacos.
- **Transparencia**: `rgba(255, 255, 255, 0.05)` para modo claro o `rgba(0, 0, 0, 0.1)` para modo oscuro.
- **Backdrop Filter**: La clave es la saturación.
  - `blur(20px to 30px)`
  - `saturate(180% to 220%)` -> Esto hace que los colores del fondo "vivan".
  - `brightness(1.05)` -> Un ligero boost para que el cristal brille.

## 2. El Bisel Físico (Physical Bevel)
Para que el cristal se sienta "grueso" y no plano:
- **Borde Externo**: `1px solid rgba(255, 255, 255, 0.4)` (simula el borde pulido).
- **Brillo Interno (Inner Glow)**: `inset 0 1px 1px rgba(255, 255, 255, 0.3)`.
- **Sombra de Contacto**: `inset 0 -1px 1px rgba(0, 0, 0, 0.05)`.

## 3. El Entorno (The Environment)
El Liquid Glass es un material reactivo. Si el fondo es blanco liso, el cristal se ve gris.
- **Mesh Gradients**: Siempre debe haber colores vibrantes detrás del cristal.
- **Movimiento**: Si los colores del fondo se mueven suavemente, la refracción del cristal se siente auténtica.

## 4. Tipografía y Contraste
Apple utiliza "Inks" (tintas) sobre el cristal:
- El texto debe tener un peso alto (`font-weight: 700+`).
- Se usan colores vibrantes con alta legibilidad (Azules, Teals, Rosas) que contrasten con el fondo difuminado.

## 5. Optimización (Performance)
Para evitar que el `backdrop-filter` ralentice la interfaz:
- Usar `will-change: backdrop-filter, transform`.
- Evitar filtros SVG de desplazamiento (`feDisplacementMap`) si el rendimiento en móviles es prioridad, ya que pueden verse pixeleados en pantallas Retina. El combo `blur + saturate` es el más limpio y optimizado.
