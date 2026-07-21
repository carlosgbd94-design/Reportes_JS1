# Customization Rules for SIREVAQ

## Premium Dropdowns Modernization Rules

When replacing or modernizing standard `<select>` elements in this codebase to match the premium pill-style design, ensure the following constraints are always respected:

1. **Layout Preservation over Styling**:
   - Do **NOT** copy decorative classes (e.g., `border-`, `bg-`, `rounded-`, `px-`, `py-`, `text-`, `font-`, `shadow-`, `hidden`) from the original `<select>` element to its wrapper container.
   - Only copy layout-related classes (`w-full`, `max-w-`, margins, flex/grid properties) and layout inline styles (`width`, `minWidth`, margins) to the wrapper container. This keeps the design inline and prevents double-box or clashing contours.

2. **Clean Pill Design & Liquid Glass Floating Panel**:
   - The trigger button must be styled with `rounded-full` (pill shape), a discrete 3D effect border/shadow (`border: 1px solid rgba(203, 213, 225, 0.8)` and a dual-shadow simulating a bottom lip/elevated bevel like `box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), inset 0 -1.5px 0 rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.02)`), extra right padding for the chevron, and no focus borders or glow effect.
   - Trigger label text MUST use clean ellipsis truncation (`text-overflow: ellipsis`, `white-space: nowrap`, `overflow: hidden`) to prevent text cut-off or clipping.
   - The floating option panel MUST use the exact **Liquid Glass** container design without variations or simulations across all dropdowns:
     - Translucent background: `bg-white/45` (`background: rgba(255, 255, 255, 0.45) !important;`)
     - Backdrop blur: `backdrop-blur-xl` (`backdrop-filter: blur(16px) !important; -webkit-backdrop-filter: blur(16px) !important;`)
     - Responsive width: `min-width: 100% !important; width: max-content !important; max-width: min(90vw, 380px) !important;` (adapts dynamically to option length).
     - Discrete border: `border border-slate-200/80` (`border: 1px solid rgba(226, 232, 240, 0.8) !important;`)
     - Radius & Padding: `rounded-2xl` (`border-radius: 16px !important;`) and `p-1` (`padding: 4px !important;`) with compact option padding `padding: 3px 10px !important; min-height: 24px !important; border-radius: 8px !important; gap: 2px !important;`.
     - High-Contrast Hover State: Option hover must be distinct (`background: #e2e8f0; border-color: #cbd5e1; color: #0f172a; font-weight: 800;`).
     - Deep elevated shadow: `shadow-xl` (`box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.1) !important;`)
     - High-priority Overlay: High-priority z-index (`z-index: 99999 !important;`) to overlay correctly above all components.

3. **Duplication Protection**:
   - Hide the original `<select>` element using a CSS class with `!important` declarations (`.premium-custom-hidden-select { display: none !important; ... }`) so that dynamic page renders do not override its hidden state.
   - Ignore already-hidden or already-converted selects in conversion functions.

4. **Dynamic Visibility Synchronization**:
   - Record the original visibility of each `<select>` **before** setting `display: none` on it (check `select.style.display`, `.classList.contains("hidden")`, and `getComputedStyle`). If originally hidden, hide the wrapper too. If originally visible, show the wrapper.
   - After converting, set `select._premiumHiddenBySelf = true` as a JS property flag on the element. This marks that the `display: none` was placed by **us**.
   - Use a `MutationObserver` on `["style", "class", "disabled"]`. Inside the observer:
     - If external code sets `display: block / "" / flex / inline / inline-block` → clear the flag (`select._premiumHiddenBySelf = false`) and show the wrapper.
     - If `select.classList.contains("hidden")` or `select.disabled` → hide the wrapper.
     - If `select.style.display === "none"` **AND** `select._premiumHiddenBySelf` is `false` → external code hid it, so hide the wrapper.
     - Never hide the wrapper solely because `select.style.display === "none"` when `_premiumHiddenBySelf` is `true` (that would be our own hide).

5. **Garbage Collection of Custom Wrappers**:
   - In DOM mutation observers, always scan for orphaned custom wrappers (wrappers whose original select elements have been removed from the DOM) and call `.remove()` on them to prevent layout clashing or elements duplication.
