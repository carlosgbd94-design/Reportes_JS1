/**
 * JS1 Reportes - Utils
 * Funciones de utilidad portadas de main.js.
 */

export const $ = (id) => document.getElementById(id);

export function normalizeTextKey(v) {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function fixUtf8Text(v) {
  let s = String(v ?? "");
  if (!s) return s;
  s = s.trim();
  const fixes = {
    "QUERÃ‰TARO": "QUERÉTARO", "QUERETARO": "QUERÉTARO",
    "EL MARQUÃ‰S": "EL MARQUÉS", "EL MARQUES": "EL MARQUÉS",
    "BIOLÃ“GICO": "BIOLÓGICO", "BIOLÃ“GICOS": "BIOLÓGICOS"
  };
  if (fixes[s]) return fixes[s];
  return s
    .replace(/Ã /g, "Á").replace(/Ã‰/g, "É").replace(/Ã /g, "Í")
    .replace(/Ã“/g, "Ó").replace(/Ãš/g, "Ú").replace(/Ã‘/g, "Ñ")
    .replace(/Ã¡/g, "á").replace(/Ã©/g, "é").replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó").replace(/Ãº/g, "ú").replace(/Ã±/g, "ñ")
    .replace(/Â/g, "");
}

export function canSeeMunicipio(user, municipio) {
  if (!user) return false;
  if (user.rol === "ADMIN" || user.rol === "JURISDICCIONAL") return true;
  const allowed = Array.isArray(user.municipiosAllowed)
    ? user.municipiosAllowed.map(x => normalizeTextKey(x)).filter(Boolean)
    : [];
  if (allowed.includes("*")) return true;
  const m = normalizeTextKey(fixUtf8Text(municipio));
  if (!m) return false;
  return allowed.includes(m);
}

export function debounce(fn, wait = 220) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}
