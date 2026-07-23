# Customization Rules for SIREVAQ

## Native Pill-Style Dropdowns & Input Fields Rules

To ensure 100% stability, instant performance, zero scroll/overflow glitches, and strict visual symmetry:

1. **Native CSS Styling over JS Wrappers**:
   - Do **NOT** hide original `<select>` elements to create custom `div` wrappers or floating popover panels via JavaScript DOM manipulation.
   - Apply styling directly to native `<select>` and `<input type="date">` elements using global CSS rules.
   - Use `appearance: none` (`-webkit-appearance: none`) and an embedded SVG Chevron arrow as `background-image` for native `<select>`.

2. **Strict Field Height & Rounded Corners Symmetry**:
   - Standardize all `<select>` and `<input type="date">` controls with:
     - Exact height: `44px` (`min-height: 44px`, `max-height: 44px`, `box-sizing: border-box`).
     - Border radius: `rounded-xl` / `14px` (`border-radius: 14px !important`).
     - Padding: `0 36px 0 16px` for `<select>` to accommodate the right Chevron cleanly without text cut-off.
     - Dual-shadow bevel & discrete 3D border: `border: 1px solid rgba(203, 213, 225, 0.8)` and `box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), inset 0 -1.5px 0 rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.02)`.
