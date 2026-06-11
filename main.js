// ============================================
// SIREVAQ — ARQUITECTURA EXPERTA (V2026)
// ============================================
// Firebase & GAS completamente eliminados.
// Arquitectura basada en Servicios (Service Layer) y Estado Reactivo (AppState).

// SUPABASE CONFIG (CORE SERVICE)
if (window.location.hash && window.location.hash.includes('type=recovery')) {
  window.location.href = "reset.html" + window.location.hash;
}
const SUPABASE_URL = "https://utclfqjietlxzlorxhrs.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Y2xmcWppZXRseHpsb3J4aHJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTYyNTQsImV4cCI6MjA5MTkzMjI1NH0.EgDK7xkSZHZyUlGF5m2C7bZjrfkx1M8cBXzxIFedDa4";
window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    experimental: {
      passkey: true
    }
  }
});


/**
 * 🔐 handleLoginFlow: Unified Authentication Bridge
 * Used by desktop views.
 */
async function handleLoginFlow(email, password) {
  if (!email || !password) {
    showToast("Ingresa credenciales", false, "warn");
    return;
  }

  showOverlay("Iniciando sesión...", "Conectando");

  try {
    const { data, error } = await window.supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) throw new Error("Supabase dice: " + error.message);

    const { data: perfil, error: perfilError } = await window.supabase
      .from('perfiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (perfilError) console.warn("[Auth] Error en perfil:", perfilError);

    const mustChange = !!data.user.user_metadata?.force_password_change;
    if (!data.session) throw new Error("No se pudo establecer la sesión.");

    TOKEN = data.session.access_token;
    USER = buildUserFromPerfil(data.user.id, data.user.email, perfil);

    if (mustChange) {
      USER.mustChange = true;
      window.MUST_CHANGE_PASSWORD = true;
    }

    saveSession(TOKEN, USER);
    await hydrateSessionUi(USER, null, {
      showSuccessToast: !mustChange,
      mustChangePassword: mustChange
    });

    if (USER?.rol && ["ADMIN", "MUNICIPAL", "JURISDICCIONAL", "CARAVANAS"].includes(USER.rol)) {
      apiCall("silentAdminReminders").catch(() => { });
    }


  } catch (error) {
    console.error("Error en login:", error);
    showToast(error.message || "Error al iniciar sesión", false, "bad");
  } finally {
    hideOverlay();
  }
}


// GLOBALS
let CURRENT_WEATHER = { temp: null, emoji: "", code: null };
let BATCH_FILTER = "all";
let BATCH_SEARCH_QUERY = "";
let BATCH_CATALOG = [];
let UNIT_BATCHES = [];

// 🏆 GLOBAL ERROR BOUNDARY (Senior Safety Net)
window.addEventListener('error', (event) => {
  console.error(' [Fatal Error] ', event.error);
  if (typeof showToast === 'function') showToast("Error inesperado en la interfaz", false, "bad");
});
window.addEventListener('unhandledrejection', (event) => {
  console.error(' [Async Error] ', event.reason);
});

/**
 * 💎 APP_STATE: Reactive Core (Senior UX Architecture)
 */
// --- FACTS ENGINE (Dato Curioso) ---
const FACTS = [
  { icon: "ac_unit", tag: "Cadena fría", title: "Termómetro visible", body: "El termómetro del refrigerador debe colocarse en la zona central para reflejar mejor la temperatura real de almacenamiento." },
  { icon: "ac_unit", tag: "Cadena fría", title: "Puerta cerrada", body: "Abrir el refrigerador el menor tiempo posible ayuda a mantener estable la temperatura de los biológicos." },
  { icon: "ac_unit", tag: "Cadena fría", title: "Separación adecuada", body: "Los biológicos deben almacenarse separados de bebidas, alimentos u otros materiales no relacionados." },
  { icon: "ac_unit", tag: "Cadena fría", title: "Espacio entre frascos", body: "Dejar espacio entre las cajas permite que el aire frío circule correctamente dentro del refrigerador." },
  { icon: "ac_unit", tag: "Cadena fría", title: "Control de energía", body: "Ante cortes eléctricos prolongados se debe activar el plan de contingencia para proteger los biológicos." },
  { icon: "science", tag: "Frascos", title: "Revisión de caducidad", body: "Antes de preparar una vacuna verifica siempre la fecha de caducidad del frasco." },
  { icon: "science", tag: "Frascos", title: "Lote visible", body: "Registrar el número de lote facilita la trazabilidad ante eventos o alertas sanitarias." },
  { icon: "science", tag: "Frascos", title: "Diluyente correcto", body: "Cada vacuna debe reconstituirse únicamente con el diluyente específico del fabricante." },
  { icon: "vaccines", tag: "Aplicación", title: "Dosis correcta", body: "La correcta técnica de carga en jeringa ayuda a evitar desperdicio de biológico." },
  { icon: "vaccines", tag: "Aplicación", title: "Sitio de aplicación", body: "El sitio anatómico recomendado varía según la vacuna y la edad del paciente." },
  { icon: "vaccines", tag: "Aplicación", title: "Intervalos adecuados", body: "Respetar los intervalos entre dosis garantiza una respuesta inmunológica adecuada." },
  { icon: "vaccines", tag: "Aplicación", title: "Observación posterior", body: "Después de aplicar una vacuna se recomienda observar al paciente algunos minutos." },
  { icon: "security", tag: "Seguridad", title: "Caja de punzocortantes", body: "Las agujas usadas deben desecharse inmediatamente en contenedores para punzocortantes." },
  { icon: "security", tag: "Seguridad", title: "Higiene de manos", body: "La higiene de manos antes y después de cada aplicación reduce el riesgo de infecciones." },
  { icon: "inventory_2", tag: "Inventario", title: "Control periódico", body: "Revisar inventarios frecuentemente ayuda a detectar pérdidas o faltantes a tiempo." },
  { icon: "inventory_2", tag: "Inventario", title: "Evitar sobrestock", body: "Solicitar biológicos según consumo real ayuda a prevenir caducidades." },
  { icon: "bar_chart", tag: "Planeación", title: "Población objetivo", body: "Los pedidos deben considerar el tamaño de la población objetivo de la unidad." },
  { icon: "bar_chart", tag: "Planeación", title: "Factor de seguridad", body: "Agregar un pequeño margen de seguridad al pedido ayuda a prevenir desabasto." },
  { icon: "edit_note", tag: "Registro", title: "Datos completos", body: "Un registro completo permite generar indicadores confiables para la toma de decisiones." },
  { icon: "edit_note", tag: "Registro", title: "Consistencia", body: "Mantener el mismo criterio de captura facilita el análisis histórico de la información." },
  { icon: "query_stats", tag: "Cobertura", title: "Seguimiento de esquemas", body: "El seguimiento oportuno ayuda a completar esquemas de vacunación en la población." },
  { icon: "query_stats", tag: "Cobertura", title: "Identificación de rezagos", body: "Los reportes periódicos permiten detectar zonas con menor cobertura de vacunación." },
  { icon: "settings", tag: "Operación", title: "Preparación diaria", body: "Revisar insumos y biológicos antes de iniciar actividades evita interrupciones durante la jornada." },
  { icon: "settings", tag: "Operación", title: "Orden en refrigerador", body: "Mantener un orden claro facilita localizar rápidamente cada biológico." },
  { icon: "settings", tag: "Operación", title: "Comunicación", body: "La coordinación entre unidad y jurisdicción mejora la distribución de biológicos." },
  { icon: "lightbulb", tag: "Innovación", title: "Temperatura óptima", body: "La mayoría de las vacunas mantienen su potencia al almacenarse estrictamente entre +2°C y +8°C." },
  { icon: "coronavirus", tag: "Inmunidad", title: "Efecto rebaño", body: "Al vacunar a gran parte de la comunidad, protegemos indirectamente a quienes no pueden recibir la vacuna." },
  { icon: "public", tag: "Salud Global", title: "Erradicación", body: "La viruela fue declarada mundialmente erradicada en 1980 gracias a campañas de vacunación sistemática." },
  { icon: "verified", tag: "Calidad", title: "Verificación cruzada", body: "Verificar el lote y la caducidad entre dos personas (doble chequeo) reduce errores operativos en un 80%." },
  { icon: "thermostat", tag: "Cadena fría", title: "Inercia térmica", body: "Usar botellas de agua en los estantes inferiores del refri ayuda a mantener el frío ante un apagón." }
];
let factIdx = Math.floor(Math.random() * FACTS.length);
let FACTS_TIMER = null;

const tagThemes = {
  "Cadena fría": { bg: "#f0f9ff", border: "#e0f2fe", icon: "#0284c7", text: "#0c4a6e", title: "#0ea5e9" }, // Light blue
  "Frascos": { bg: "#f5f3ff", border: "#ede9fe", icon: "#7c3aed", text: "#4c1d95", title: "#8b5cf6" }, // Violet
  "Aplicación": { bg: "#ecfdf5", border: "#d1fae5", icon: "#059669", text: "#064e3b", title: "#10b981" }, // Emerald
  "Seguridad": { bg: "#fef2f2", border: "#fee2e2", icon: "#dc2626", text: "#7f1d1d", title: "#ef4444" }, // Red
  "Inventario": { bg: "#fff7ed", border: "#ffedd5", icon: "#ea580c", text: "#7c2d12", title: "#f97316" }, // Orange
  "Planeación": { bg: "#f0fdf4", border: "#dcfce7", icon: "#16a34a", text: "#14532d", title: "#22c55e" }, // Green
  "Registro": { bg: "#f8fafc", border: "#f1f5f9", icon: "#475569", text: "#0f172a", title: "#64748b" }, // Slate
  "Cobertura": { bg: "#eff6ff", border: "#dbeafe", icon: "#2563eb", text: "#1e3a8a", title: "#3b82f6" }, // Blue
  "Operación": { bg: "#faf5ff", border: "#f3e8ff", icon: "#9333ea", text: "#3b0764", title: "#a855f7" }, // Purple
  "Innovación": { bg: "#fefce8", border: "#fef08a", icon: "#ca8a04", text: "#713f12", title: "#eab308" }, // Yellow
  "Inmunidad": { bg: "#f0fdfa", border: "#ccfbf1", icon: "#0d9488", text: "#134e4a", title: "#14b8a6" }, // Teal
  "Salud Global": { bg: "#fdf4ff", border: "#fae8ff", icon: "#c026d3", text: "#701a75", title: "#d946ef" }, // Fuchsia
  "Calidad": { bg: "#f0f9ff", border: "#e0f2fe", icon: "#0284c7", text: "#0c4a6e", title: "#0ea5e9" }
};
const defaultTheme = { bg: "#f8fafc", border: "#f1f5f9", icon: "#475569", text: "#0f172a", title: "#64748b" };

function renderFact() {
  if (!FACTS || !FACTS.length) return;
  const card = document.getElementById("factCard"), iconCont = document.getElementById("factIconContainer"), iconEl = document.getElementById("factIcon"), dot = document.getElementById("factDot"), titleEl = document.getElementById("factTitle"), bodyEl = document.getElementById("factBody"), tagEl = document.getElementById("factTag");
  if (!card || !iconCont || !iconEl || !dot || !titleEl || !bodyEl || !tagEl) return;

  const f = FACTS[factIdx % FACTS.length];
  const tagIconMap = { "Cadena fría": "ac_unit", "Frascos": "science", "Inventario": "inventory_2", "Planeación": "analytics", "Registro": "edit_note", "Cobertura": "query_stats", "Operación": "settings" };
  const curIcon = tagIconMap[f.tag] || f.icon || "syringe";
  const theme = tagThemes[f.tag] || defaultTheme;

  // 1. Fade out body & shrink rotate icon
  bodyEl.style.opacity = 0;
  iconEl.style.transform = "scale(0.3) rotate(-45deg)";
  iconEl.style.opacity = 0;

  setTimeout(() => {
    // 2. Update Content & Colors
    card.style.backgroundColor = theme.bg;
    card.style.borderColor = theme.border;
    iconCont.style.borderColor = theme.border;
    iconEl.style.color = theme.icon;
    dot.style.backgroundColor = theme.title;
    titleEl.style.color = theme.title;
    bodyEl.style.color = theme.text;

    tagEl.innerHTML = '<span class="material-symbols-rounded" style="font-size:18px; margin-right:8px;">' + curIcon + '</span>' + (f.tag || "");
    titleEl.textContent = f.tag || "";
    bodyEl.textContent = f.body || "";
    iconEl.textContent = curIcon;

    // 3. Pop icon in & fade text
    bodyEl.style.opacity = 1;
    iconEl.style.transform = "scale(1.2) rotate(10deg)";
    iconEl.style.opacity = 1;

    // Settle icon
    setTimeout(() => { iconEl.style.transform = "scale(1) rotate(0deg)"; }, 250);
  }, 300);

  // Selección 100% aleatoria para mayor dinamismo
  factIdx = Math.floor(Math.random() * FACTS.length);
}

function startFactsRotation() {
  stopFactsRotation();
  renderFact();
  FACTS_TIMER = setInterval(() => { if (!document.hidden) renderFact(); }, 9000);
}

function stopFactsRotation() {
  if (FACTS_TIMER) { clearInterval(FACTS_TIMER); FACTS_TIMER = null; }
}

const _InternalState = {
  user: null, token: null, isLoggedIn: false, notifCount: 0,
  unitBatches: [], biologicosCatalog: [], weather: { temp: null, emoji: null, code: null },
  ui: { isBusy: false, activeTab: 'SR', mainPanel: 'CAP', opsTab: 'SUMMARY' },
  // Legacy LIVE_STATE & APP_STATE keys
  pinolPendientes: null, summaryCapturadas: null, summaryFaltantes: null,
  todayExistenciaCaptured: null, todayConsCaptured: null, lastHistoryRows: null,
  todayCache: null, lastLoginUser: "", initialized: false,
  get rol() { return this.user?.rol; }
};

const AppState = new Proxy(_InternalState, {
  set(target, prop, value) {
    if (target[prop] === value) return true; // 🛡️ Evitar bucles infinitos (Senior Guard)
    target[prop] = value;
    if (prop === 'notifCount') syncMainNotifBadge(value);
    if (prop === 'isLoggedIn' && !value) clearSession();
    return true;
  }
});

// 🏆 LEGACY ALIASES
Object.defineProperty(window, 'USER', { get: () => AppState.user, set: (v) => AppState.user = v, configurable: true });
Object.defineProperty(window, 'TOKEN', { get: () => AppState.token, set: (v) => AppState.token = v, configurable: true });
Object.defineProperty(window, 'STATUS', { get: () => AppState.status, set: (v) => AppState.status = v, configurable: true });
const LIVE_STATE = AppState;
const APP_STATE = AppState;

/**
 * Catálogo de Biológicos Prioritarios para Alertas de Desabasto
 * priority: 1 (Crítica), 2 (Advertencia)
 */
const PRIORITY_VACCINES = {
  "BCG": { priority: 1 },
  "HEPATITIS B": { priority: 1 },
  "HEPATITIS A": { priority: 1 },
  "HEXAVALENTE": { priority: 1 },
  "SRP": { priority: 1 },
  "SR": { priority: 1 },
  "DPT": { priority: 1 },
  "NEUMOCÓCICA 13V": { priority: 1 },
  "NEUMOCÓCICA 13": { priority: 1 }, // alias
  "NEUMOCÓCICA 20V": { priority: 1 }, // placeholder future
  "TDPa": { priority: 1 },
  "ROTAVIRUS": { priority: 1 },
  "VSR": { priority: 1 },
  "INFLUENZA": { priority: 2, seasonal: true },
  "COVID-19": { priority: 2, seasonal: true }
};

window.apiCall = (action, payload) => AppService.call(action, payload);
const $ = (id) => DOM.get(id);
window.$ = $; // Alias global experto

/**
 * 🚀 APP_SERVICE: Centralized API & Logic Layer
 */
const AppService = {
  async call(actionOrPayload, payload = {}, options = {}) {
    const action = (typeof actionOrPayload === "string" ? actionOrPayload : actionOrPayload?.action) || "unknown";
    const finalPayload = typeof actionOrPayload === "object" ? actionOrPayload : payload;
    const body = { ...finalPayload, action: action.toLowerCase(), token: AppState.token };
    try {
      return await supabaseRequest(body.action, body, options);
    } catch (error) {
      console.error(`[AppService Error] ${action}:`, error);
      showToast(error.message || "Error de comunicación", false, "bad");
      throw error;
    }
  },

  /**
   * 🛡️ runCapture: Ejecutor de captura premium.
   * Centraliza: busy state, overlays, toasts, eventos y mutación de caché.
   */
  async runCapture(config) {
    const { btnId, title, msg, successMsg, eventTitle, eventMsg, mutation, action } = config;
    if (isBtnBusy(btnId)) return;

    setBtnBusy(btnId, true, title + "…");
    showOverlay(msg, title);

    try {
      const res = await action();
      if (!res || !res.ok) throw new Error(res?.error || "Error al procesar la solicitud");

      muteRealtimeFor(12000);
      showToast(successMsg, true, "good");
      pushLiveEvent(eventTitle, eventMsg, "good");
      setSavedStamp();

      if (mutation) await refreshAfterMutation(mutation);
      return res;
    } catch (error) {
      showToast(error.message, false, "bad");
      console.error(`[Capture Error] ${btnId}:`, error);
    } finally {
      setBtnBusy(btnId, false);
      hideOverlay();
    }
  }
};

/**
 * 📦 DOM_CACHE: Performance optimization
 */
const DOM = {
  get(id) {
    if (!this._cache) this._cache = {};
    if (!this._cache[id]) this._cache[id] = document.getElementById(id);
    return this._cache[id];
  },
  clearCache() { this._cache = {}; }
};


const CACHE_TTL = {
  LOTES: 3600000,
  UNIDADES: 3600000,
  NOTIFS: 60000,
  TODAY_REPORTS: 60000,
  CAPTURE_OVERVIEW: 120000,
  HISTORY_METRICS: 180000,
  UNIT_CATALOG: 1800000,
  PINOL_LIST: 30000
};

// --- LOGÍSTICA DE CAPTURA (VENTANAS INTELIGENTES) ---
const MEXICAN_HOLIDAYS_2026 = [
  "2026-01-01", "2026-02-02", "2026-03-16", "2026-05-01",
  "2026-09-16", "2026-11-16", "2026-12-25"
];


// --- PERSISTENCIA DE SESIÓN (localStorage) ---
function saveSession(token, user) {
  try {
    localStorage.setItem("JS1_TOKEN", token);
    localStorage.setItem("JS1_USER", JSON.stringify(user));
  } catch (e) { console.warn("No se pudo guardar sesión:", e); }
}

function loadSession() {
  try {
    const t = localStorage.getItem("JS1_TOKEN");
    const u = localStorage.getItem("JS1_USER");
    if (t && u) return { token: t, user: JSON.parse(u) };
  } catch (e) { }
  return null;
}


function clearSession() {
  try {
    localStorage.removeItem("JS1_TOKEN");
    localStorage.removeItem("JS1_USER");

    // 🛡️ Limpieza agresiva de llaves de Supabase (Senior UX Security)
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes("supabase.auth.token") || key.startsWith("sb-"))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    // También limpiar sessionStorage para evitar persistencia temporal
    sessionStorage.clear();
  } catch (e) {
    console.error("Error en limpieza de sesión:", e);
  }
}


document.addEventListener("DOMContentLoaded", () => {
  // 🛡️ ARRANQUE ÚNICO (Expert Implementation)
  (async () => {
    showOverlay("Cargando SIREVAQ…", "Inicializando");
    try {

      initProfileDropdown();
      const u = await whoami();
      if (u) {
        await hydrateSessionUi(u, null, {
          showSuccessToast: false,
          mustChangePassword: !!u.mustChange
        });
      } else {
        setLoggedOutUI();
      }
    } catch (e) {
      console.error("Fallo en arranque unificado:", e);
      setLoggedOutUI();
    } finally {
      hideOverlay();
      startFactsRotation();
      initWeather();
      initHeaderGlass();
      checkPasskeySupport();
    }
  })();

  // ✅ LOGIN: Manejo de autenticación
  const formLogin = document.getElementById("loginForm");

  // Toggle Password Visibility
  const togglePass = document.getElementById("togglePassword");
  const passInput = document.getElementById("password");
  if (togglePass && passInput) {
    togglePass.addEventListener("click", () => {
      const isPass = passInput.type === "password";
      passInput.type = isPass ? "text" : "password";

      // Activar animación 3D Flip
      togglePass.classList.remove("animate-spin-flip");
      void togglePass.offsetWidth; // Forzar reflow para reiniciar la animación
      togglePass.classList.add("animate-spin-flip");

      // Cambiar el ícono a la mitad de la animación (150ms)
      setTimeout(() => {
        togglePass.textContent = isPass ? "visibility" : "visibility_off";
      }, 150);
    });
  }

  if (formLogin) {
    formLogin.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const email = document.getElementById("usuario").value.trim();
      const password = document.getElementById("password").value.trim();
      await handleLoginFlow(email, password);
    });
  }

  const btnBiometricLogin = document.getElementById("btnBiometricLogin");
  if (btnBiometricLogin) {
    btnBiometricLogin.addEventListener("click", async () => {
      await loginWithPasskey();
    });
  }

  const btnRegisterPasskey = document.getElementById("btnRegisterPasskey");
  if (btnRegisterPasskey) {
    btnRegisterPasskey.addEventListener("click", async () => {
      await registerPasskey();
    });
  }

  // 🗓️ ACTUALIZAR AÑO EN FOOTER
  const footerYear = document.getElementById("footerYear");
  if (footerYear) footerYear.textContent = new Date().getFullYear();



  $("navLogout")?.addEventListener("click", () => {
    $("btnLogout")?.click();
  });

  // ✅ TECLA ESCAPE: Cerrar modales activos (Senior Logic)
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      // Orden de prioridad para cerrar
      if ($("uploadFilesOverlay")?.classList.contains("show")) {
        closeUploadFilesModal();
      } else if ($("exportOverlay")?.classList.contains("show")) {
        if (typeof closeExportModal === "function") closeExportModal();
        else $("exportOverlay").classList.remove("show");
      } else if ($("pinolObsModal") && !$("pinolObsModal").classList.contains("pointer-events-none")) {
        closePinolObsModal();
      } else if ($("pinolEntregaModal")?.classList.contains("show")) {
        $("pinolEntregaModal").classList.remove("show");
      } else if ($("liveViewOverlay")?.classList.contains("show")) {
        $("liveViewOverlay").classList.remove("show");
      } else if ($("passwordOverlay")?.classList.contains("show")) {
        // passwordOverlay usually shouldn't be closed if mandatory, 
        // but we follow user request for "modals"
        $("passwordOverlay").classList.remove("show");
      } else if ($("forgotOverlay")?.classList.contains("show")) {
        $("forgotOverlay").classList.remove("show");
      }
    }
  });
});


const overlay = $("overlay");
const overlayMsg = $("overlayMsg");
const toastContainer = $("toast-container");
const overlayTitle = $("overlayTitle");
let TOAST_TIMER = null;

function showOverlay(msg = "Cargando…", title = "Procesando") {
  if (overlayTitle) overlayTitle.textContent = title;
  if (overlayMsg) overlayMsg.textContent = msg;
  overlay.classList.add("show");
}

function hideOverlay() {
  overlay.classList.remove("show");
}

/* MD3 Ripple Effect - Modernized with high-precision positioning */
function createRipple(event, targetElement = null) {
  const button = targetElement || event.currentTarget;
  if (!button || typeof button.getBoundingClientRect !== "function") return;

  // Ensure button is ready for absolute positioning children
  if (getComputedStyle(button).position === "static") {
    button.style.position = "relative";
  }
  if (getComputedStyle(button).overflow !== "hidden") {
    button.style.overflow = "hidden";
  }

  const circle = document.createElement("span");
  const diameter = Math.max(button.clientWidth, button.clientHeight);
  const radius = diameter / 2;
  const rect = button.getBoundingClientRect();

  circle.style.width = circle.style.height = `${diameter}px`;
  circle.style.left = `${event.clientX - rect.left - radius}px`;
  circle.style.top = `${event.clientY - rect.top - radius}px`;
  circle.classList.add("md-ripple");

  // Clear previous ripples properly
  const oldRipples = button.querySelectorAll(".md-ripple");
  oldRipples.forEach(r => r.remove());

  button.appendChild(circle);

  // Auto-remove after animation
  setTimeout(() => circle.remove(), 600);
}


function smartLoader(taskFn, options = {}) {
  const {
    delay = 180,
    message = "Cargando…",
    title = "Procesando"
  } = options;

  let shown = false;

  const timer = setTimeout(() => {
    shown = true;
    showOverlay(message, title);
  }, delay);

  return Promise.resolve()
    .then(() => taskFn())
    .then((result) => {
      clearTimeout(timer);
      if (shown) hideOverlay();
      return result;
    })
    .catch((error) => {
      clearTimeout(timer);
      if (shown) hideOverlay();
      throw error;
    });
}

function showToast(msg, ok = true, type = null, options = {}) {
  const container = $("toast-container");
  if (!container) return;

  const {
    force = false,
    cooldownMs = 1500,
    duration = 4000
  } = options || {};

  const finalType = type ? type : (ok ? "good" : "bad");
  const cleanMsg = String(msg || "").trim();
  const toastKey = `${cleanMsg}|${finalType}`;
  const now = Date.now();

  // Anti-spam check
  if (!LIVE_STATE.toastMeta) LIVE_STATE.toastMeta = { key: "", ts: 0 };
  const sameToast = LIVE_STATE.toastMeta.key === toastKey && (now - Number(LIVE_STATE.toastMeta.ts || 0)) < cooldownMs;
  if (!force && sameToast) return;

  LIVE_STATE.toastMeta.key = toastKey;
  LIVE_STATE.toastMeta.ts = now;

  // Create modern toast element
  const toastEl = document.createElement("div");
  toastEl.className = `toast-new ${finalType}`;

  let icon = "info";
  if (finalType === "good") icon = "check_circle";
  else if (finalType === "bad") icon = "error";
  else if (finalType === "warn") icon = "warning";
  else if (finalType === "info") icon = "info";

  toastEl.innerHTML = `
      <div class="toast-icon">
        <span class="material-symbols-rounded">${icon}</span>
      </div>
      <div class="toast-content">
        <div class="toast-message">${cleanMsg}</div>
      </div>
      <div class="toast-timer"></div>
    `;

  toastEl.style.setProperty('--toast-duration', `${duration}ms`);

  container.appendChild(toastEl);

  // Entrance animation
  requestAnimationFrame(() => {
    toastEl.classList.add("show");
  });

  // Auto-remove
  setTimeout(() => {
    toastEl.classList.add("removing");
    toastEl.addEventListener("transitionend", () => {
      toastEl.remove();
      if (LIVE_STATE.toastMeta.key === toastKey) {
        LIVE_STATE.toastMeta.key = "";
        LIVE_STATE.toastMeta.ts = 0;
      }
    }, { once: true });
  }, duration);
}
/** ===== UTILS PORTED FROM BACKEND ===== **/
function normalizeTextKey_(v) {
  let s = String(v ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
  if (s === "MARQUES" || s === "EL MARQUES") {
    return "EL MARQUES";
  }
  return s;
}

function fixUtf8Text_(v) {
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

function canSeeMunicipio_(user, municipio) {
  if (!user) return false;
  if (user.rol === "ADMIN" || user.rol === "JURISDICCIONAL") return true;
  const allowed = Array.isArray(user.municipiosAllowed)
    ? user.municipiosAllowed.map(x => normalizeTextKey_(x)).filter(Boolean)
    : [];
  if (allowed.includes("*")) return true;
  const m = normalizeTextKey_(fixUtf8Text_(municipio));
  if (!m) return false;
  return allowed.includes(m);
}

function isCaravanaUnit_(u) {
  if (!u) return false;
  const name = String(u.unidad || u.UNIDAD || u.nombre || "").trim().toUpperCase();
  return name.startsWith("FAM") || name.startsWith("UMME");
}


function hideToastNow() {
  const toastEl = $("toast-container");
  if (!toastEl) return;

  if (TOAST_TIMER) {
    clearTimeout(TOAST_TIMER);
    TOAST_TIMER = null;
  }

  // Modern toast system handles multiple toasts; clearing the container or last active one
  toastEl.innerHTML = "";
  LIVE_STATE.lastToastKey = "";

  if (!LIVE_STATE.toastMeta) {
    LIVE_STATE.toastMeta = {
      key: "",
      ts: 0
    };
  } else {
    LIVE_STATE.toastMeta.key = "";
    LIVE_STATE.toastMeta.ts = 0;
  }
}

function showWarnToast(msg, options = {}) {
  showToast(msg, true, "warn", options);
}

function setBtnBusy(id, busy, busyText = "Procesando…") {
  const btn = $(id);
  if (!btn) return;

  if (busy) {
    if (!btn.dataset.originalText) {
      btn.dataset.originalText = btn.textContent || "";
    }
    btn.disabled = true;
    btn.textContent = busyText;
    btn.dataset.busy = "1";
  } else {
    btn.disabled = false;
    if (btn.dataset.originalText) {
      btn.textContent = btn.dataset.originalText;
    }
    btn.dataset.busy = "0";
  }
}

function isBtnBusy(id) {
  const btn = $(id);
  return !!(btn && btn.dataset.busy === "1");
}

function debounce(fn, wait = 220) {
  let timer = null;

  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, wait);
  };
}

function toggleEl(id, show, displayWhenShown = "") {
  const el = $(id);
  if (!el) return;

  if (show) {
    if (displayWhenShown) {
      el.style.display = displayWhenShown;
    } else {
      el.style.removeProperty("display");
    }
    el.hidden = false;
  } else {
    el.style.display = "none";
    el.hidden = true;
  }
}

function exposeAppFns() {
  window.getTodayReports = getTodayReports;
  window.getCaptureOverview = getCaptureOverview;
  window.getHistoryMetrics = getHistoryMetrics;
  window.loadNotifications = loadNotifications;
  window.reloadCaptureSummary = reloadCaptureSummary;
  window.reloadCaptureSummarySilent = reloadCaptureSummarySilent;
}

function assertCriticalFns() {
  const required = [
    "getTodayReports",
    "getCaptureOverview",
    "getHistoryMetrics",
    "loadNotifications",
    "reloadCaptureSummary",
    "reloadCaptureSummarySilent"
  ];

  const missing = required.filter(name => typeof window[name] !== "function");

  if (missing.length) {
    console.error("Funciones críticas faltantes:", missing);
  }
}

function updateNotifBadge() {
  const items = Array.isArray(LIVE_STATE.notifications) ? LIVE_STATE.notifications : [];
  const n = getLocalUnreadNotifCount(items);
  syncMainNotifBadge(n);
}

function incrementNotifCounter(type = "good") {
  LIVE_STATE.notifCount = Number(LIVE_STATE.notifCount || 0) + 1;

  if (type === "warn" || type === "bad") {
    LIVE_STATE.notifWarnCount = Number(LIVE_STATE.notifWarnCount || 0) + 1;
  } else {
    LIVE_STATE.notifGoodCount = Number(LIVE_STATE.notifGoodCount || 0) + 1;
  }

  updateNotifBadge();
}

function resetNotifCounter() {
  LIVE_STATE.notifCount = 0;
  LIVE_STATE.notifWarnCount = 0;
  LIVE_STATE.notifGoodCount = 0;
  updateNotifBadge();
}

let ONLY_UNREAD_NOTIFS = false;
let LAST_NOTIF_UNREAD = 0;
let NOTIF_AUTO_REFRESH_TIMER = null;
let NOTIF_SEARCH_QUERY = "";
let NOTIF_LOAD_PROMISE = null;
let NOTIF_GROUPS_COLLAPSED = {
  pendientes: false,
  confirmadas: false,
  historial: true
};

const NOTIF_PREF_KEYS = {
  onlyUnread: "js1_notif_only_unread",
  search: "js1_notif_search",
  groups: "js1_notif_groups"
};

let NOTIFICATIONS_CHANNEL = null;
let PINOL_SOLICITUDES_CHANNEL = null;
let PRESENCE_CHANNEL = null;
let ACTIVE_USERS = {};

// ===== SISTEMA DE NOTIFICACIONES PER-PROFILE: Fan-Out =====

/**
 * Resuelve la lista de usuarios destinatarios para una notificación,
 * basándose en target_scope y campos de targeting.
 * Retorna un array de strings (nombres de usuario).
 */
async function resolveNotificationRecipients(record) {
  const scope = String(record.target_scope || "GLOBAL").toUpperCase();
  const targetMuni = String(record.target_municipio || "").trim();
  const targetClues = String(record.target_clues || "").trim();
  const targetUser = String(record.target_usuario || "").trim();
  const fromUser = String(record.from_usuario || "").trim();

  try {
    // Helper: obtener todos los usuarios activos
    const fetchActiveUsers = async (filter = {}) => {
      let q = supabase.from('usuarios_legacy').select('usuario, rol, clues, municipio, municipios_allowed').eq('activo', 'SI');
      if (filter.rol) q = q.eq('rol', filter.rol);
      if (filter.clues) q = q.eq('clues', filter.clues);
      const { data } = await q;
      return data || [];
    };

    let recipients = new Set();

    switch (scope) {
      case "GLOBAL": {
        const users = await fetchActiveUsers();
        users.forEach(u => recipients.add(u.usuario));
        break;
      }

      case "ROLE": {
        // targetUser contiene el nombre del rol (ej: "MUNICIPAL")
        const users = await fetchActiveUsers({ rol: targetUser });
        users.forEach(u => recipients.add(u.usuario));
        // Admins siempre ven todo
        const admins = await fetchActiveUsers({ rol: 'ADMIN' });
        admins.forEach(u => recipients.add(u.usuario));
        break;
      }

      case "USUARIO": {
        if (targetUser) recipients.add(targetUser);
        break;
      }

      case "CLUES": {
        // La unidad específica
        const unitUsers = await fetchActiveUsers({ clues: targetClues });
        unitUsers.forEach(u => recipients.add(u.usuario));

        // Supervisores municipales que administran ese municipio
        const allSupervisors = await fetchActiveUsers();
        const muni = targetMuni || (() => {
          const u = unitUsers.find(x => x.municipio);
          return u ? u.municipio : "";
        })();

        allSupervisors.forEach(u => {
          const uRole = String(u.rol || "").toUpperCase();
          if (uRole === "ADMIN" || uRole === "JURISDICCIONAL") {
            recipients.add(u.usuario);
          } else if (uRole === "MUNICIPAL" || uRole === "CARAVANAS") {
            // Verificar si este supervisor tiene acceso al municipio de la unidad
            const allowed = (() => {
              let raw = u.municipios_allowed;
              if (typeof raw === "string") try { raw = JSON.parse(raw); } catch (e) { raw = [raw]; }
              return Array.isArray(raw) ? raw.map(m => normalizeTextKey_(m)) : [];
            })();
            if (allowed.includes("*") || (muni && allowed.includes(normalizeTextKey_(muni)))) {
              recipients.add(u.usuario);
            }
          }
        });
        break;
      }

      case "MUNICIPIO": {
        // Staff municipal de ese municipio + admins
        const allUsers = await fetchActiveUsers();
        allUsers.forEach(u => {
          const uRole = String(u.rol || "").toUpperCase();
          if (uRole === "ADMIN" || uRole === "JURISDICCIONAL") {
            recipients.add(u.usuario);
          } else if (uRole === "MUNICIPAL" || uRole === "CARAVANAS") {
            const allowed = (() => {
              let raw = u.municipios_allowed;
              if (typeof raw === "string") try { raw = JSON.parse(raw); } catch (e) { raw = [raw]; }
              return Array.isArray(raw) ? raw.map(m => normalizeTextKey_(m)) : [];
            })();
            if (allowed.includes("*") || (targetMuni && allowed.includes(normalizeTextKey_(targetMuni)))) {
              recipients.add(u.usuario);
            }
          }
        });
        break;
      }

      case "MUNICIPIO_UNITS": {
        // Todas las unidades de un municipio
        const { data: units } = await supabase.from('unidades').select('clues').eq('municipio', targetMuni).eq('activo', 'SI');
        if (units && units.length) {
          const cluesList = units.map(u => u.clues);
          const { data: unitUsers } = await supabase.from('usuarios_legacy').select('usuario, clues').eq('activo', 'SI').in('clues', cluesList);
          (unitUsers || []).forEach(u => recipients.add(u.usuario));
        }
        // También supervisores municipales
        const supervisors = await fetchActiveUsers();
        supervisors.forEach(u => {
          const uRole = String(u.rol || "").toUpperCase();
          if (uRole === "ADMIN" || uRole === "JURISDICCIONAL") {
            recipients.add(u.usuario);
          } else if (uRole === "MUNICIPAL") {
            const allowed = (() => {
              let raw = u.municipios_allowed;
              if (typeof raw === "string") try { raw = JSON.parse(raw); } catch (e) { raw = [raw]; }
              return Array.isArray(raw) ? raw.map(m => normalizeTextKey_(m)) : [];
            })();
            if (allowed.includes("*") || (targetMuni && allowed.includes(normalizeTextKey_(targetMuni)))) {
              recipients.add(u.usuario);
            }
          }
        });
        break;
      }

      case "CARAVANAS_UNITS": {
        // Todas las unidades tipo caravana
        const { data: allUnits } = await supabase.from('unidades').select('clues, unidad').eq('activo', 'SI');
        const caravanaClues = (allUnits || []).filter(u => isCaravanaUnit_(u)).map(u => u.clues);
        if (caravanaClues.length) {
          const { data: caravanaUsers } = await supabase.from('usuarios_legacy').select('usuario, clues').eq('activo', 'SI').in('clues', caravanaClues);
          (caravanaUsers || []).forEach(u => recipients.add(u.usuario));
        }
        // Supervisores caravanas + admins
        const adminsEtc = await fetchActiveUsers();
        adminsEtc.forEach(u => {
          const uRole = String(u.rol || "").toUpperCase();
          if (uRole === "ADMIN" || uRole === "JURISDICCIONAL" || uRole === "CARAVANAS") {
            recipients.add(u.usuario);
          }
        });
        break;
      }

      case "MUNICIPAL_USERS_ALL": {
        const municipals = await fetchActiveUsers({ rol: 'MUNICIPAL' });
        municipals.forEach(u => recipients.add(u.usuario));
        const admins = await fetchActiveUsers({ rol: 'ADMIN' });
        admins.forEach(u => recipients.add(u.usuario));
        break;
      }

      default: {
        console.warn(`[FanOut] Scope desconocido: ${scope}`);
        break;
      }
    }

    // El remitente también recibe la notificación si es admin (para visibilidad)
    // No es obligatorio, pero mantiene consistencia
    if (fromUser) recipients.add(fromUser);

    return Array.from(recipients).filter(Boolean);
  } catch (e) {
    console.error("[FanOut] Error resolviendo destinatarios:", e);
    return [];
  }
}

/**
 * Crea filas en notificaciones_perfil para cada destinatario.
 * Usa upsert para evitar duplicados.
 */
async function fanOutNotification(notificacionId, recipients = []) {
  if (!notificacionId || !recipients.length) return;

  const records = recipients.map(usuario => ({
    notificacion_id: notificacionId,
    usuario: usuario,
    status: 'UNREAD',
    deleted: false
  }));

  // Insertar en lotes de 50 para evitar límites de Supabase
  const BATCH_SIZE = 50;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('notificaciones_perfil')
      .upsert(batch, { onConflict: 'notificacion_id,usuario', ignoreDuplicates: true });

    if (error) {
      console.error(`[FanOut] Error inserting batch ${i / BATCH_SIZE}:`, error);
    }
  }

  console.log(`[FanOut] ${recipients.length} destinatarios procesados para notificación ${notificacionId}`);
}

// ===== FIN FAN-OUT =====

function initNotificationsRealtime() {
  if (!window.supabase || !TOKEN || !USER) return;

  if (NOTIFICATIONS_CHANNEL) {
    try {
      window.supabase.removeChannel(NOTIFICATIONS_CHANNEL);
    } catch (e) {
      console.warn("[Realtime] Error removing channel:", e);
    }
    NOTIFICATIONS_CHANNEL = null;
  }

  const usuario = String(USER?.usuario || "").trim();
  console.log(`[Realtime] Iniciando suscripción a notificaciones_perfil para ${usuario}...`);

  NOTIFICATIONS_CHANNEL = window.supabase
    .channel('my-notificaciones-perfil')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notificaciones_perfil',
        filter: `usuario=eq.${usuario}`
      },
      (payload) => {
        console.log("[Realtime] Cambio en mi buzón:", payload.eventType, payload.new?.notificacion_id || payload.old?.notificacion_id);
        loadNotifications({ silent: true }).catch(() => { });
      }
    )
    .subscribe((status) => {
      console.log("[Realtime] Canal notificaciones_perfil estado:", status);
    });
}

function initPinolRealtime() {
  if (!window.supabase || !TOKEN || !USER) return;

  if (PINOL_SOLICITUDES_CHANNEL) {
    try {
      window.supabase.removeChannel(PINOL_SOLICITUDES_CHANNEL);
    } catch (e) {
      console.warn("[Realtime] Error removing pinol channel:", e);
    }
    PINOL_SOLICITUDES_CHANNEL = null;
  }

  console.log("[Realtime] Iniciando suscripción a la tabla pinol_solicitudes...");

  PINOL_SOLICITUDES_CHANNEL = window.supabase
    .channel('public-pinol-solicitudes-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pinol_solicitudes' },
      (payload) => {
        console.log("[Realtime] Cambio detectado en pinol_solicitudes:", payload.eventType);
        invalidatePinolCache();
        listPinol(true).then(() => {
          applyPinolFormLock();
          syncCommandHub();
        }).catch(err => {
          console.warn("[Realtime] Error al actualizar pinol en realtime:", err);
        });
      }
    )
    .subscribe((status) => {
      console.log("[Realtime] Canal pinol_solicitudes estado:", status);
    });
}

function startNotificationsAutoRefresh() {
  stopNotificationsAutoRefresh();
  initNotificationsRealtime();
  initPinolRealtime();
  initPresenceRealtime();
}

function stopNotificationsAutoRefresh() {
  if (NOTIFICATIONS_CHANNEL) {
    console.log("[Realtime] Removiendo suscripción a notificaciones...");
    try {
      window.supabase.removeChannel(NOTIFICATIONS_CHANNEL);
    } catch (e) {
      console.warn("[Realtime] Error removing channel:", e);
    }
    NOTIFICATIONS_CHANNEL = null;
  }
  if (PINOL_SOLICITUDES_CHANNEL) {
    console.log("[Realtime] Removiendo suscripción a pinol_solicitudes...");
    try {
      window.supabase.removeChannel(PINOL_SOLICITUDES_CHANNEL);
    } catch (e) {
      console.warn("[Realtime] Error removing pinol channel:", e);
    }
    PINOL_SOLICITUDES_CHANNEL = null;
  }
  if (PRESENCE_CHANNEL) {
    try { window.supabase.removeChannel(PRESENCE_CHANNEL); } catch (e) {}
    PRESENCE_CHANNEL = null;
  }
}

function initPresenceRealtime() {
  if (!window.supabase || !TOKEN || !USER) return;
  
  if (PRESENCE_CHANNEL) {
    try { window.supabase.removeChannel(PRESENCE_CHANNEL); } catch (e) {}
    PRESENCE_CHANNEL = null;
  }
  
  PRESENCE_CHANNEL = window.supabase.channel('global_presence', {
    config: {
      presence: { key: USER.usuario }
    }
  });
  
  PRESENCE_CHANNEL.on('presence', { event: 'sync' }, () => {
    ACTIVE_USERS = PRESENCE_CHANNEL.presenceState();
    renderActiveUsers();
  }).subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await PRESENCE_CHANNEL.track({
        user: USER.usuario,
        nombre: USER.nombre || USER.usuario,
        rol: USER.rol,
        clues: USER.clues || 'N/A'
      });
    }
  });
}

function renderActiveUsers() {
  const activeUsersCount = document.getElementById('activeUsersCount');
  const activeUsersTbody = document.getElementById('activeUsersTbody');
  if (!activeUsersCount || !activeUsersTbody) return;
  
  let totalUsers = 0;
  let html = '';
  
  for (const [key, presences] of Object.entries(ACTIVE_USERS)) {
    if (presences.length > 0) {
      totalUsers++;
      const data = presences[0];
      let roleColor = 'text-primary/70';
      if (data.rol === 'ADMIN') roleColor = 'text-red-500';
      else if (data.rol === 'MUNICIPAL') roleColor = 'text-blue-500';
      else if (data.rol === 'CARAVANAS') roleColor = 'text-teal-500';
      
      html += `
        <tr class="hover:bg-primary/5 transition-colors">
          <td class="px-6 py-3 border-b border-outline-variant/10 text-xs font-bold text-primary">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-green-500"></span>
              ${data.nombre || data.user}
            </div>
          </td>
          <td class="px-6 py-3 border-b border-outline-variant/10 text-[10px] font-black tracking-widest uppercase ${roleColor}">${data.rol}</td>
          <td class="px-6 py-3 border-b border-outline-variant/10 text-xs text-primary/70">${data.clues}</td>
        </tr>
      `;
    }
  }
  
  if (totalUsers === 0) {
    html = `<tr><td colspan="3" class="text-center py-4 text-xs font-medium text-primary/50">Solo tú estás conectado</td></tr>`;
  }
  
  activeUsersCount.textContent = `${totalUsers} En línea`;
  activeUsersTbody.innerHTML = html;
}

function readNotifPrefs() {
  try {
    const onlyUnread = localStorage.getItem(NOTIF_PREF_KEYS.onlyUnread);
    const search = localStorage.getItem(NOTIF_PREF_KEYS.search);
    const groupsRaw = localStorage.getItem(NOTIF_PREF_KEYS.groups);

    ONLY_UNREAD_NOTIFS = onlyUnread === "1";
    NOTIF_SEARCH_QUERY = String(search || "").trim();

    if (groupsRaw) {
      const parsed = JSON.parse(groupsRaw);
      if (parsed && typeof parsed === "object") {
        NOTIF_GROUPS_COLLAPSED = Object.assign(
          {
            pendientes: false,
            confirmadas: false,
            historial: true
          },
          parsed
        );
      }
    }
  } catch (e) {
    console.warn("readNotifPrefs error:", e);
  }
}

function writeNotifPrefs() {
  try {
    localStorage.setItem(
      NOTIF_PREF_KEYS.onlyUnread,
      ONLY_UNREAD_NOTIFS ? "1" : "0"
    );

    localStorage.setItem(
      NOTIF_PREF_KEYS.search,
      String(NOTIF_SEARCH_QUERY || "").trim()
    );

    localStorage.setItem(
      NOTIF_PREF_KEYS.groups,
      JSON.stringify(NOTIF_GROUPS_COLLAPSED || {})
    );
  } catch (e) {
    console.warn("writeNotifPrefs error:", e);
  }
}

function notifTypeLabel(type) {
  const t = String(type || "INFO").toUpperCase();
  const map = {
    INFO: "Información",
    SUCCESS: "Éxito",
    WARN: "Alerta",
    ERROR: "Crítica"
  };
  return map[t] || t;
}

function parseNotifMeta(metaJson) {
  if (!metaJson) return null;
  try {
    const obj = JSON.parse(String(metaJson || "{}"));
    return obj && typeof obj === "object" ? obj : null;
  } catch (e) {
    return null;
  }
}

function normalizeNotifSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function flattenNotifMeta(meta) {
  if (!meta || typeof meta !== "object") return "";

  const parts = [];

  Object.keys(meta).forEach(key => {
    const val = meta[key];

    if (val === null || val === undefined) return;

    if (Array.isArray(val)) {
      parts.push(val.join(" "));
      return;
    }

    if (typeof val === "object") {
      parts.push(flattenNotifMeta(val));
      return;
    }

    parts.push(String(val));
  });

  return parts.join(" ");
}

function notifMatchesSearch(item, query) {
  const q = normalizeNotifSearchText(query);
  if (!q) return true;

  const meta = parseNotifMeta(item?.meta_json);

  const haystack = normalizeNotifSearchText([
    item?.title || "",
    item?.message || "",
    item?.from_usuario || "",
    item?.created_ts || "",
    item?.type || "",
    item?.status || "",
    flattenNotifMeta(meta)
  ].join(" | "));

  return haystack.includes(q);
}

function getFilteredNotifications(items = []) {
  const arr = Array.isArray(items) ? items : [];
  const q = String(NOTIF_SEARCH_QUERY || "").trim();

  if (!q) return arr;
  return arr.filter(item => notifMatchesSearch(item, q));
}

function syncNotifSearchInputs() {
  ["notifSearchInput", "topNotifSearchInput"].forEach(id => {
    const el = $(id);
    if (!el) return;
    if (el.value !== NOTIF_SEARCH_QUERY) {
      el.value = NOTIF_SEARCH_QUERY;
    }
  });
}

function refreshNotifSearchUi() {
  const hasQuery = !!String(NOTIF_SEARCH_QUERY || "").trim();

  ["btnNotifClearSearch", "btnTopNotifClearSearch"].forEach(id => {
    const btn = $(id);
    if (!btn) return;
    btn.style.display = hasQuery ? "inline-flex" : "none";
    btn.disabled = !hasQuery;
  });
}

function handleNotifSearchInput(value) {
  NOTIF_SEARCH_QUERY = String(value || "").trim();
  writeNotifPrefs();
  syncNotifSearchInputs();
  refreshNotifSearchUi();
  rerenderNotificationsFromState();
}

function canConfirmPinolReceipt(item) {
  if (!USER || String(USER.rol || "").toUpperCase() !== "UNIDAD") return false;
  if (!item) return false;

  const meta = parseNotifMeta(item.meta_json);
  if (!meta) return false;

  const source = String(meta.source || "").toUpperCase();
  const event = String(meta.event || "").toUpperCase();
  const alreadyConfirmed = String(meta.confirmed_by_unit || "").toUpperCase() === "SI";
  const status = String(item.status || "").toUpperCase();

  return source === "PINOL" &&
    event === "PINOL_ENTREGADO" &&
    !alreadyConfirmed &&
    status !== "READ";
}

function buildPinolReceiptIndex(notifications = []) {
  const map = new Map();

  notifications.forEach(n => {
    const meta = parseNotifMeta(n?.meta_json);
    if (!meta) return;

    if (
      String(meta.source || "").toUpperCase() === "PINOL" &&
      String(meta.event || "").toUpperCase() === "PINOL_ENTREGADO" &&
      String(meta.confirmed_by_unit || "").toUpperCase() === "SI"
    ) {
      const id = String(meta.pinol_id || "").trim();
      if (id) map.set(id, true);
    }
  });

  return map;
}

function isPinolDeliveredNotif(item) {
  const meta = parseNotifMeta(item?.meta_json);
  return !!(
    meta &&
    String(meta.source || "").toUpperCase() === "PINOL" &&
    String(meta.event || "").toUpperCase() === "PINOL_ENTREGADO"
  );
}

function isPinolReceiptConfirmed(item) {
  const meta = parseNotifMeta(item?.meta_json);
  return !!(
    meta &&
    String(meta.source || "").toUpperCase() === "PINOL" &&
    String(meta.event || "").toUpperCase() === "PINOL_ENTREGADO" &&
    String(meta.confirmed_by_unit || "").toUpperCase() === "SI"
  );
}

function isPinolAckNotif(item) {
  const meta = parseNotifMeta(item?.meta_json);
  return !!(
    meta &&
    String(meta.source || "").toUpperCase() === "PINOL" &&
    String(meta.event || "").toUpperCase() === "PINOL_RECIBIDO_CONFIRMADO"
  );
}

function getNotifTemplatePayload(templateKey) {
  const role = String((USER && USER.rol) || "").trim().toUpperCase();
  const municipio = String((USER && USER.municipio) || "").trim();

  const MAP = {
    CAPTURA_PENDIENTE: {
      type: "WARN",
      title: "Recordatorio de captura pendiente",
      message: `Se solicita realizar la captura correspondiente en SIREVAQ a la brevedad.\n\nEste aviso forma parte del seguimiento operativo de la Jurisdicción Sanitaria 1.`,
      suggestScope: (role === "MUNICIPAL" || role === "CARAVANAS") ? "ALL_MY_UNITS" : "MUNICIPIO"
    },
    OBS_ADMIN: {
      type: "WARN",
      title: "Observación administrativa",
      message: `Se emite la presente observación para seguimiento operativo.\n\nFavor de revisar el detalle y atender la indicación correspondiente.`,
      suggestScope: "USUARIO"
    },
    AVISO_GENERAL: {
      type: "INFO",
      title: "Aviso general",
      message: `Se comparte el siguiente aviso operativo mediante SIREVAQ.\n\nFavor de tomar conocimiento y dar seguimiento en caso necesario.`,
      suggestScope: (role === "MUNICIPAL" || role === "CARAVANAS") ? "ALL_MY_UNITS" : "MUNICIPIO"
    }
  };

  return MAP[String(templateKey || "").trim()] || null;
}

function applyNotifTemplate(templateKey) {
  const tpl = getNotifTemplatePayload(templateKey);
  if (!tpl) return;

  if ($("notifType")) $("notifType").value = tpl.type || "INFO";
  if ($("notifTitle") && !$("notifTitle").value.trim()) $("notifTitle").value = tpl.title || "";
  if ($("notifMessage") && !$("notifMessage").value.trim()) $("notifMessage").value = tpl.message || "";
  if ($("notifTargetScope") && tpl.suggestScope) $("notifTargetScope").value = tpl.suggestScope;

  showToast("Plantilla aplicada");
}

function bindNotifTemplateEvents() {
  $("notifTemplate")?.addEventListener("change", (e) => {
    const key = e.target?.value || "";
    if (!key) return;
    applyNotifTemplate(key);
  });
}

function createDeleteButtonHtml(onclick, title = "Eliminar") {
  return `
      <button 
        type="button" 
        class="md-delete-btn" 
        title="${escapeAttr(title)}" 
        onclick="${onclick}"
      >
        <svg viewBox="0 0 24 24">
          <path class="trash-lid" d="M15 4V3H9v1H4v2h16V4h-5z" />
          <path d="M5 21a2 2 0 002 2h10a2 2 0 002-2V7H5v14zM8 9h2v10H8V9zm4 0h2v10h-2V9zm4 0h2v10h-2V9z" />
        </svg>
      </button>
    `;
}

function formatNotifDate(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    const day = String(d.getDate()).padStart(2, '0');
    const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
    const month = months[d.getMonth()];
    const year = String(d.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  } catch (e) { return ts; }
}

function formatNotifBody(title, message) {
  if (!message) return "";
  let clean = message;
  const isDelivery = (title && title.toLowerCase().includes("entrega")) || message.toLowerCase().includes("entregada") || message.toLowerCase().includes("recibido");

  if (isDelivery) {
    clean = "Pinol entregado:";
  } else {
    clean = title ? `${title}:` : "Notificación:";
  }

  const unidadMatch = message.match(/Unidad:\s*([^.\n]+)/i) || message.match(/Unidad de salud:\s*([^.\n]+)/i);
  const unidad = unidadMatch ? unidadMatch[1].trim().split(" CLUES:")[0].split(" Solicitó:")[0] : "";

  const fechaMatch = message.match(/Fecha de solicitud:\s*([\d-]+)/i);
  let fechaReq = fechaMatch ? fechaMatch[1] : "";
  if (fechaReq) {
    const d = new Date(fechaReq);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yy = String(d.getFullYear()).slice(-2);
      fechaReq = `${dd}-${mm}-${yy}`;
    }
  }

  let html = `<strong style="color:var(--md-sys-color-primary);">${clean}</strong>`;
  if (fechaReq) html += `<div style="margin-top:2px;">Fecha de solicitud: ${fechaReq}</div>`;
  if (unidad) html += `<div>Unidad de salud: ${unidad}</div>`;

  // Mostrar comentario personalizado de entrega si existe y no es el genérico/virtual
  if (isDelivery) {
    const isGeneric = message.includes("Tu solicitud de pinol ha sido marcada como entregada.");
    const isVirtual = message.includes("Pinol entregado:\n");
    if (!isGeneric && !isVirtual && message.trim()) {
      html += `<div style="margin-top:6px; padding:6px 10px; background:rgba(0,0,0,0.03); border-left:3px solid var(--md-sys-color-primary); border-radius:4px; font-size:12px; color:var(--md-sys-color-on-surface-variant); font-style:italic;">
        <strong>Comentario:</strong> "${escapeHtml(message)}"
      </div>`;
    }
  }

  return html;
}

function buildNotificationsHtml(items = []) {
  const arr = Array.isArray(items) ? items : [];

  if (!arr.length) {
    return `<div class="notifEmpty">No hay notificaciones para mostrar.</div>`;
  }

  return arr.map(item => {
    const type = String(item.type || "INFO").toUpperCase();
    const status = String(item.status || "UNREAD").toUpperCase();
    const isRead = status === "READ";
    const meta = parseNotifMeta(item.meta_json);
    const showConfirmPinol = canConfirmPinolReceipt(item);

    const pinolConfirmed = isPinolReceiptConfirmed(item);
    const isPinolAck = isPinolAckNotif(item);

    const pinolTag = (meta && String(meta.source || "").toUpperCase() === "PINOL")
      ? `<span class="notifPillPinol"><span class="material-symbols-rounded">inventory_2</span>PINOL</span>`
      : "";

    const frascosTag = (meta && String(meta.source || "").toUpperCase() === "FRASCOS")
      ? `<span class="notifPillFrascos"><span class="material-symbols-rounded">science</span>FRASCOS</span>`
      : "";

    const unreadDot = !isRead && !pinolConfirmed && !isPinolAck
      ? `<span class="notifUnreadDot"></span>`
      : ``;

    const typeIcon = (
      type === "SUCCESS" ? "verified" :
        type === "WARN" || type === "WARNING" ? "warning" :
          type === "ERROR" ? "error" :
            type === "ALERTA_DESABASTO" ? "error_outline" :
              "notifications"
    );

    const isDesabasto = type === "ALERTA_DESABASTO";
    const isDesabastoActive = isDesabasto && meta?.status === "activa";
    const desabastoTag = isDesabasto
      ? `<span style="background:var(--md-sys-color-error-container); color:var(--md-sys-color-on-error-container); padding:2px 8px; border-radius:8px; font-size:10px; font-weight:800; display:inline-flex; align-items:center; gap:4px; margin-left:6px;"><span class="material-symbols-rounded" style="font-size:12px; animation: pulse 2s infinite;">error_outline</span> DESABASTO</span>`
      : "";

    const cardClass = [
      "notifCard",
      isRead ? "read" : "unread",
      pinolConfirmed ? "flowClosed" : "",
      (isDesabasto && !isDesabastoActive) ? "flowClosed" : ""
    ].join(" ").trim();

    const extraStyle = isDesabastoActive ? "border-left: 4px solid var(--md-sys-color-error);" : (isDesabasto ? "border-left: 4px solid var(--md-sys-color-outline-variant);" : "");

    return `
      <div class="${cardClass}" data-id="${escapeAttr(item.id || "")}" style="${extraStyle}">
        <div class="notifCardContent">
          <div class="notifHeaderRow">
            <div class="notifMainInfo">
              <div class="notifCardTitle">
                ${unreadDot}
                ${escapeHtml(item.title || "Notificación")}
                ${pinolTag}
                ${frascosTag}
                ${desabastoTag}
              </div>
              <div class="notifMeta">
                ${formatNotifDate(item.created_ts)}
              </div>
            </div>
            
            <div class="notifCompactActions">
              ${isDesabastoActive
        ? `<button type="button" class="notifMiniBtn" title="Marcar como Verificado" style="background:var(--md-sys-color-surface-variant); color:var(--md-sys-color-on-surface-variant);" onclick="resolveDesabastoFlow('${escapeAttr(item.id || "")}')"><span class="material-symbols-rounded">check_circle</span></button>`
        : ``
      }
              ${showConfirmPinol
        ? `<button type="button" class="notifMiniBtn good" title="Confirmar" onclick="confirmPinolReceiptFlow('${escapeAttr(item.id || "")}')"><span class="material-symbols-rounded">task_alt</span></button>`
        : ``
      }
              ${!showConfirmPinol && !pinolConfirmed && !isPinolAck && !isRead && !isDesabasto
        ? `<button type="button" class="notifMiniBtn primary" title="Leída" onclick="markNotificationReadFlow('${escapeAttr(item.id || "")}')"><span class="material-symbols-rounded">done</span></button>`
        : ``
      }
              <button type="button" class="notifMiniBtn delete" title="Borrar" onclick="deleteNotificationFlow('${escapeAttr(item.id || "")}')"><span class="material-symbols-rounded">delete</span></button>
            </div>
          </div>
          
          <div class="notifBody snippet">${formatNotifBody(item.title, item.message)}
            ${(isDesabastoActive && meta?.missing?.length) ? `<div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:4px;">${meta.missing.map(v => `<span style="background:var(--md-sys-color-error-container); color:var(--md-sys-color-on-error-container); padding:2px 6px; border-radius:6px; font-size:9px; font-weight:700;">${v}</span>`).join("")}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function isNotifGroupCollapsed(groupKey) {
  return !!(NOTIF_GROUPS_COLLAPSED && NOTIF_GROUPS_COLLAPSED[groupKey]);
}

function toggleNotifGroup(groupKey) {
  if (!groupKey) return;
  NOTIF_GROUPS_COLLAPSED[groupKey] = !isNotifGroupCollapsed(groupKey);
  writeNotifPrefs();
  rerenderNotificationsFromState();
}

function buildGroupedNotificationsHtml(items = []) {
  const arr = Array.isArray(items) ? items : [];

  if (!arr.length) {
    return `
      <div class="notifEmpty">
        <span class="material-symbols-rounded">notifications_none</span>
        <div>${String(NOTIF_SEARCH_QUERY || "").trim()
        ? "No hay coincidencias para tu búsqueda."
        : "No hay notificaciones para mostrar."
      }</div>
      </div>
    `;
  }

  const pendientes = [];
  const confirmadas = [];
  const historial = [];

  arr.forEach(item => {
    if (!item) return;

    const isRead = String(item.status || "UNREAD").toUpperCase() === "READ";
    const pinolConfirmed = isPinolReceiptConfirmed(item);
    const isPinolAck = isPinolAckNotif(item);

    if (!isRead && !pinolConfirmed && !isPinolAck) {
      pendientes.push(item);
      return;
    }

    if (pinolConfirmed || isPinolAck) {
      confirmadas.push(item);
      return;
    }

    historial.push(item);
  });

  const groups = [
    {
      key: "pendientes",
      title: "Pendientes",
      icon: "mark_email_unread",
      items: pendientes,
      tone: "warn"
    },
    {
      key: "confirmadas",
      title: "Confirmadas / cerradas",
      icon: "task_alt",
      items: confirmadas,
      tone: "good"
    },
    {
      key: "historial",
      title: "Historial reciente",
      icon: "history",
      items: historial,
      tone: "neutral"
    }
  ].filter(group => group.items.length > 0);

  return groups.map(group => {
    const collapsed = isNotifGroupCollapsed(group.key);

    return `
      <section class="notifGroup ${group.tone} ${collapsed ? "collapsed" : ""}" data-group="${group.key}">
        <button
          type="button"
          class="notifGroupHead"
          data-notif-group-toggle="${group.key}"
          aria-expanded="${collapsed ? "false" : "true"}"
        >
          <div class="notifGroupTitle">
            <span class="material-symbols-rounded">${group.icon}</span>
            ${group.title}
          </div>

          <div class="notifGroupHeadRight">
  <div class="notifGroupCount">${group.items.length}</div>
  <span class="material-symbols-rounded notifGroupChevron">
  ${collapsed ? "expand_more" : "expand_less"}
</span>
</div>
        </button>

        <div class="notifGroupBody" style="display:${collapsed ? "none" : "flex"}; flex-direction: column;">
          ${buildNotificationsHtml(group.items)}
        </div>
      </section>
    `;
  }).join("");
}

function renderNotifications(items = [], options = {}) {
  const {
    wrapId = "notifListWrap",
    totalKpiId = "notifTotalKpi"
  } = options || {};

  const wrap = $(wrapId);
  if (!wrap) return;

  const sourceItems = Array.isArray(items) ? items : [];
  const filteredItems = getFilteredNotifications(sourceItems);

  wrap.innerHTML = buildGroupedNotificationsHtml(filteredItems);

  const totalKpi = $(totalKpiId);
  if (totalKpi) {
    totalKpi.textContent = String(filteredItems.length);
  }
}

let NOTIF_BADGE_REFS = null;

function getNotifBadgeRefs() {
  if (NOTIF_BADGE_REFS) return NOTIF_BADGE_REFS;

  NOTIF_BADGE_REFS = {
    badge: $("notifBadgeMain"),
    topBadge: $("topNotifBadge"),
    tabNotifs: $("tabNOTIFS"),
    btnTopNotifications: $("btnTopNotifications")
  };

  return NOTIF_BADGE_REFS;
}

function syncMainNotifBadge(unread = 0) {
  const n = Number(unread || 0);
  const badge = $("notifBadgeMain");
  const topBadge = $("topNotifBadge");
  const navBadge = $("notifBadgeNav");
  const tabNOTIFS = $("tabNOTIFS");
  const btnTopNotifications = $("btnTopNotifications");
  const nextText = String(n);

  if (badge) {
    if (n > 0) {
      if (badge.style.display !== "inline-flex") badge.style.display = "inline-flex";
      if (badge.textContent !== nextText) badge.textContent = nextText;
      tabNOTIFS?.classList.add("liveAccent");
    } else {
      if (badge.style.display !== "none") badge.style.display = "none";
      if (badge.textContent !== "0") badge.textContent = "0";
      tabNOTIFS?.classList.remove("liveAccent", "notifHot");
    }
  }

  if (topBadge) {
    if (n > 0) {
      topBadge.style.setProperty("display", "flex", "important");
      topBadge.textContent = n > 99 ? "99+" : String(n);
      btnTopNotifications?.classList.add("liveAccent", "notifHot");

      // Add animation class
      topBadge.classList.remove("badge-pulse");
      void topBadge.offsetWidth;
      topBadge.classList.add("badge-pulse");
    } else {
      topBadge.style.setProperty("display", "none", "important");
      btnTopNotifications?.classList.remove("liveAccent", "notifHot");
    }
  }

  if (navBadge) {
    if (n > 0) {
      navBadge.textContent = n > 99 ? "99+" : n;
      navBadge.style.display = "flex";
    } else {
      navBadge.textContent = "0";
      navBadge.style.display = "none";
    }
  }

  // 🛡️ El estado ya se maneja vía AppState Proxy, eliminamos asignación cíclica.


  const deskBadge = $("notifBadgeDesktop");
  if (deskBadge) {
    if (n > 0) {
      deskBadge.textContent = n > 99 ? "99+" : n;
      deskBadge.style.display = "flex";
    } else {
      deskBadge.textContent = "0";
      deskBadge.style.display = "none";
    }
  }

}

async function loadNotifications(options = {}) {
  const { silent = true } = options || {};

  if (!TOKEN || !USER) return null;

  if (NOTIF_LOAD_PROMISE) {
    return NOTIF_LOAD_PROMISE;
  }

  if (!silent) {
    showOverlay("Cargando bandeja de notificaciones…", "Notificaciones");
  }

  NOTIF_LOAD_PROMISE = (async () => {
    try {
      const res = await apiCall("listMyNotifications", {
        only_unread: ONLY_UNREAD_NOTIFS ? "SI" : "NO"
      });

      const data = res.data || {};
      const rawItems = Array.isArray(data.items) ? data.items : [];
      const items = rawItems.map(item => Object.assign({}, item, {
        status: item.status || (String(item.is_read).toUpperCase() === "SI" ? "READ" : "UNREAD")
      }));
      const unread = Number(data.unread || 0);
      const prevUnread = Number(LAST_NOTIF_UNREAD || 0);
      const delta = unread - prevUnread;
      const tabNOTIFS = $("tabNOTIFS");
      const btnTopNotifications = $("btnTopNotifications");

      LIVE_STATE.notifications = items;
      applyNotificationsViewState(items, unread);
      LAST_NOTIF_UNREAD = unread;

      if (delta > 0) {
        showWarnToast(`Tienes ${delta} notificación(es) nueva(s)`, {
          force: true,
          cooldownMs: 900
        });

        pulseBadge("bNotif");
        pulseBadge("tabNOTIFS");
        tabNOTIFS?.classList.add("notifHot");
        btnTopNotifications?.classList.add("notifHot");
      }

      return data;
    } finally {
      NOTIF_LOAD_PROMISE = null;
      if (!silent) hideOverlay();
    }
  })();

  return NOTIF_LOAD_PROMISE;
}

function getLocalUnreadNotifCount(items = []) {
  return (Array.isArray(items) ? items : []).filter(item =>
    String(item?.status || "UNREAD").toUpperCase() !== "READ"
  ).length;
}

function applyNotificationsViewState(items = [], unreadServerCount = null) {
  const sourceItems = Array.isArray(items) ? items : [];
  const visibleItems = getFilteredNotifications(sourceItems);
  const unreadLocal = getLocalUnreadNotifCount(sourceItems);
  const unreadVisible = getLocalUnreadNotifCount(visibleItems);
  const unreadForBadge = unreadLocal;
  const notifUnreadKpi = $("notifUnreadKpi");
  const notifTxt = $("notifTxt");

  renderNotifications(visibleItems, {
    wrapId: "notifListWrap",
    totalKpiId: "notifTotalKpi"
  });

  renderNotifications(visibleItems, {
    wrapId: "topNotifListWrap",
    totalKpiId: "topNotifTotalKpi"
  });

  syncTopNotifMirror(unreadVisible, visibleItems.length);
  refreshNotifUnreadButtons();
  refreshNotifBulkButtons();
  syncNotifSearchInputs();
  refreshNotifSearchUi();

  if (notifUnreadKpi) {
    notifUnreadKpi.textContent = String(unreadVisible);
  }

  console.log(`[Badge DEBUG] unreadForBadge:`, unreadForBadge);
  LIVE_STATE.notifCount = unreadForBadge;
  syncMainNotifBadge(unreadForBadge);

  if (notifTxt) {
    notifTxt.textContent = `Actividad: ${unreadVisible}`;
  }

  if (unreadForBadge <= 0) {
    clearTabAttention("tabNOTIFS", "bNotif");
  }

  return {
    visibleItems,
    unreadLocal,
    unreadVisible,
    unreadForBadge
  };
}

function rerenderNotificationsFromState() {
  const items = Array.isArray(LIVE_STATE.notifications) ? LIVE_STATE.notifications : [];
  applyNotificationsViewState(items);
}

function patchNotificationMeta(item, patch = {}) {
  if (!item) return item;

  let meta = {};
  try {
    meta = item.meta_json ? JSON.parse(String(item.meta_json)) : {};
  } catch (e) {
    meta = {};
  }

  meta = Object.assign({}, meta, patch);

  return Object.assign({}, item, {
    meta_json: JSON.stringify(meta)
  });
}

function applyLocalNotificationRead(id) {
  const current = Array.isArray(LIVE_STATE.notifications) ? LIVE_STATE.notifications : [];

  LIVE_STATE.notifications = current
    .map(item => {
      if (String(item?.id || "") !== String(id || "")) return item;
      return Object.assign({}, item, { status: "READ", is_read: "SI" });
    })
    .filter(item => {
      if (!ONLY_UNREAD_NOTIFS) return true;
      return String(item?.status || "UNREAD").toUpperCase() !== "READ";
    });

  rerenderNotificationsFromState();
}

function applyLocalNotificationDelete(id) {
  const current = Array.isArray(LIVE_STATE.notifications) ? LIVE_STATE.notifications : [];

  LIVE_STATE.notifications = current.filter(item =>
    String(item?.id || "") !== String(id || "")
  );

  rerenderNotificationsFromState();
}

function applyLocalPinolReceiptConfirm(notificationId) {
  const current = Array.isArray(LIVE_STATE.notifications) ? LIVE_STATE.notifications : [];

  LIVE_STATE.notifications = current
    .map(item => {
      if (String(item?.id || "") !== String(notificationId || "")) return item;

      const patched = patchNotificationMeta(item, {
        confirmed_by_unit: "SI"
      });

      return Object.assign({}, patched, {
        status: "READ",
        is_read: "SI"
      });
    })
    .filter(item => {
      if (!ONLY_UNREAD_NOTIFS) return true;
      return String(item?.status || "UNREAD").toUpperCase() !== "READ";
    });

  rerenderNotificationsFromState();
}

function getBulkReadableNotificationIds() {
  const items = Array.isArray(LIVE_STATE.notifications) ? LIVE_STATE.notifications : [];

  return items
    .filter(item => {
      if (!item) return false;

      const id = String(item.id || "").trim();
      if (!id) return false;

      const status = String(item.status || "UNREAD").toUpperCase();
      if (status === "READ") return false;

      if (canConfirmPinolReceipt(item)) return false;
      if (isPinolReceiptConfirmed(item)) return false;
      if (isPinolAckNotif(item)) return false;

      return true;
    })
    .map(item => String(item.id || "").trim());
}

function refreshNotifBulkButtons() {
  const ids = getBulkReadableNotificationIds();
  const count = ids.length;

  const label = count > 0
    ? `<span class="material-symbols-rounded">done_all</span> Marcar visibles (${count})`
    : `<span class="material-symbols-rounded">done_all</span> Marcar visibles`;

  ["btnNotifMarkVisibleRead", "btnTopNotifMarkVisibleRead"].forEach(id => {
    const btn = $(id);
    if (!btn) return;

    if (id.includes("TopNotif")) {
      const badgeHtml = count > 0 ? `<span class="notifBadgeCounter pulse">${count}</span>` : "";
      btn.innerHTML = `<span class="material-symbols-rounded">done_all</span>${badgeHtml}`;
      btn.title = count > 0 ? `Marcar ${count} visibles como leídas` : "Marcar visibles";
    } else {
      btn.innerHTML = label;
    }

    btn.disabled = count <= 0;
    btn.classList.toggle("isActive", count > 0);
    btn.setAttribute("aria-disabled", count <= 0 ? "true" : "false");
    btn.style.display = "inline-flex";
  });
}

async function markVisibleNotificationsReadFlow() {
  const ids = getBulkReadableNotificationIds();

  if (!ids.length) {
    showToast("No hay notificaciones visibles pendientes por marcar");
    return;
  }

  try {
    showOverlay(`Marcando ${ids.length} notificación(es)…`, "Notificaciones");

    for (const id of ids) {
      await apiCall("markNotificationRead", { id });
      applyLocalNotificationRead(id);
    }

    showToast(`${ids.length} notificación(es) marcada(s) como leídas`);
    refreshNotifBulkButtons();

    const unreadNow = Number($("notifUnreadKpi")?.textContent || 0);
    if (unreadNow <= 0) {
      clearTabAttention("tabNOTIFS", "bNotif");
    }
  } catch (e) {
    console.error("markVisibleNotificationsReadFlow error:", e);
    showToast(e.message || "No se pudieron marcar las notificaciones visibles", false);
  } finally {
    hideOverlay();
  }
}

async function markNotificationReadFlow(id) {
  try {
    showOverlay("Marcando notificación como leída…", "Notificaciones");

    await apiCall("markNotificationRead", { id });

    applyLocalNotificationRead(id);
    showToast("Notificación marcada como leída");

    const unreadNow = Number($("notifUnreadKpi")?.textContent || 0);
    if (unreadNow <= 0) {
      clearTabAttention("tabNOTIFS", "bNotif");
    }
  } catch (e) {
    console.error("markNotificationReadFlow error:", e);
    showToast(e.message || "No se pudo marcar como leída", false);
  } finally {
    hideOverlay();
  }
}

async function confirmPinolReceiptFlow(notificationId) {
  try {
    showOverlay("Confirmando recepción del pinol…", "Pinol");

    const r = await apiCall("confirmPinolReceipt", {
      notification_id: notificationId
    });

    if (!r || !r.ok) {
      showToast((r && r.error) ? r.error : "No se pudo confirmar la recepción", false);
      return;
    }

    applyLocalPinolReceiptConfirm(notificationId);

    try {
      await refreshAfterMutation({ touchPinol: true });
    } catch (e) { /* silent */ }

    showToast("Recepción confirmada correctamente");
  } catch (e) {
    console.error("confirmPinolReceiptFlow error:", e);
    showToast(e.message || "No se pudo confirmar la recepción", false);
  } finally {
    hideOverlay();
  }
}

async function deleteNotificationFlow(id) {
  try {
    if (!id) {
      showToast("No se recibió el identificador de la notificación", false);
      return;
    }

    const ok = window.confirm("¿Deseas eliminar esta notificación?");
    if (!ok) return;

    showOverlay("Eliminando notificación…", "Notificaciones");

    const r = await apiCall("deleteNotification", { id });

    if (!r || !r.ok) {
      showToast((r && r.error) ? r.error : "No se pudo eliminar la notificación", false);
      return;
    }

    applyLocalNotificationDelete(id);
    showToast("Notificación eliminada correctamente");
  } catch (e) {
    console.error("deleteNotificationFlow error:", e);
    showToast(e.message || "No se pudo eliminar la notificación", false);
  } finally {
    hideOverlay();
  }
}

// === CENTRO DE NOTIFICACIONES: LÓGICA DE ENVÍO HIERÁRQUICO ===
window.initNotificationCenter = async function () {
  const roleBadge = $("notifBadgeRole");
  if (roleBadge && USER) {
    roleBadge.textContent = USER.rol || "PERFIL";
  }
  renderNotifComposer();
};

function renderNotifComposer() {
  const scopeSelect = $("notifTargetScope");
  if (!scopeSelect) return;

  const role = USER.rol?.toUpperCase();
  let options = `<option value="">Seleccionar alcance...</option>`;

  if (role === "ADMIN") {
    options += `
        <option value="GLOBAL">🌎 Global (Todos)</option>
        <option value="MUNICIPAL_USERS_ALL">👥 Todos los Municipales (Staff)</option>
        <option value="MUNICIPIO">🏙️ Personal de un Municipio (Staff)</option>
        <option value="CLUES">🏥 Unidad Específica (CLUES)</option>
        <option value="USUARIO">👤 Usuario Específico</option>
      `;
  } else if (role === "JURISDICCIONAL") {
    options += `
        <option value="MUNICIPAL_USERS_ALL">👥 Todos los Municipales (Staff)</option>
        <option value="MUNICIPIO">🏙️ Personal de un Municipio (Staff)</option>
        <option value="USUARIO">👤 Usuario Municipal Específico</option>
      `;
  } else if (role === "MUNICIPAL" || role === "CARAVANAS") {
    options += `
        <option value="ALL_MY_UNITS">📋 Todas mis Unidades</option>
        <option value="CLUES">🏥 Unidad Específica (CLUES)</option>
      `;
  } else {
    options = `<option value="">Sin permisos de envío</option>`;
    if ($("btnSendNotification")) {
      $("btnSendNotification").disabled = true;
      $("btnSendNotification").style.opacity = "0.5";
    }
  }

  scopeSelect.innerHTML = options;

  // 2. Manejar cambios de alcance para mostrar/ocultar selectores extra
  scopeSelect.onchange = async () => {
    const scope = scopeSelect.value;
    const role = USER.rol?.toUpperCase();

    // Mostrar selector de MUNICIPIO si:
    // - Es ADMIN/JURISDICCIONAL y elige MUNICIPIO o CLUES
    // - Es MUNICIPAL y tiene varios municipios (para filtrar sus CLUES)
    const isMuniStaffTarget = (scope === "MUNICIPIO");
    const isCluesTarget = (scope === "CLUES");

    $("notifMunicipioBox").style.display = ((isMuniStaffTarget || isCluesTarget) && role !== "CARAVANAS") ? "block" : "none";
    $("notifUnidadBox").style.display = (isCluesTarget) ? "block" : "none";
    $("notifUserBox").style.display = (scope === "USUARIO") ? "block" : "none";

    // Resetear dropdowns
    if ($("notifTargetMunicipio")) $("notifTargetMunicipio").innerHTML = "<option value=''>Cargando...</option>";
    if ($("notifTargetClues")) $("notifTargetClues").innerHTML = "<option value=''>Cargando...</option>";
    if ($("notifTargetUser")) $("notifTargetUser").innerHTML = "<option value=''>Cargando...</option>";

    if ((isMuniStaffTarget || isCluesTarget) && role !== "CARAVANAS") {
      await populateMunicipiosNotif();
    } else if (scope === "CLUES" && role === "MUNICIPAL") {
      await populateCluesNotif(USER.municipio);
    } else if (scope === "CLUES" && role === "CARAVANAS") {
      await populateCaravanasNotif();
    } else if (scope === "USUARIO" || scope === "MUNICIPAL_USERS_ALL") {
      await populateUsersNotif(scope);
    }
  };

  // Al cambiar municipio, si estamos en scope CLUES (Admin), cargar unidades
  if ($("notifTargetMunicipio")) {
    $("notifTargetMunicipio").onchange = () => {
      if (scopeSelect.value === "CLUES") {
        populateCluesNotif($("notifTargetMunicipio").value);
      }
    };
  }
};

async function populateMunicipiosNotif() {
  const select = $("notifTargetMunicipio");
  if (!select) return;
  try {
    const { data } = await supabase.from('unidades').select('municipio').order('municipio');
    let unique = [...new Set(data.map(i => i.municipio))];

    // 🛡️ Filtrar para MUNICIPAL: solo ve sus municipios a cargo
    if (USER.rol === "MUNICIPAL") {
      unique = unique.filter(m => canSeeMunicipio_(USER, m));
    }

    select.innerHTML = `<option value="">Seleccionar municipio...</option>` +
      unique.map(m => `<option value="${escapeAttr(m)}">${escapeHtml(m)}</option>`).join("");
  } catch (e) { select.innerHTML = "<option>Error</option>"; }
}

async function populateCluesNotif(mun) {
  const select = $("notifTargetClues");
  if (!select || !mun) return;
  try {
    const { data } = await supabase.from('unidades').select('clues, unidad').eq('municipio', mun).order('clues');
    select.innerHTML = `<option value="">Seleccionar unidad...</option>` +
      data.map(u => `<option value="${escapeAttr(u.clues)}">${escapeHtml(u.unidad)}</option>`).join("");
  } catch (e) { select.innerHTML = "<option>Error</option>"; }
}

async function populateCaravanasNotif() {
  const select = $("notifTargetClues");
  if (!select) return;
  try {
    const { data } = await supabase.from('unidades').select('clues, unidad').eq('activo', 'SI').order('unidad');
    const filtered = data.filter(u => isCaravanaUnit_(u));
    select.innerHTML = `<option value="">Seleccionar caravana...</option>` +
      filtered.map(u => `<option value="${escapeAttr(u.clues)}">${escapeHtml(u.unidad)}</option>`).join("");
  } catch (e) { select.innerHTML = "<option>Error</option>"; }
}

async function populateUsersNotif(scope) {
  const select = $("notifTargetUser");
  if (!select) return;
  try {
    let query = supabase.from('usuarios_legacy').select('usuario, rol').eq('activo', 'SI').order('usuario');

    // Si es Jurisdiccional, solo ve Municipales
    if (USER.rol === "JURISDICCIONAL") {
      query = query.eq('rol', 'MUNICIPAL');
    }

    const { data } = await query;
    select.innerHTML = `<option value="">Seleccionar usuario...</option>` +
      data.map(u => `<option value="${escapeAttr(u.usuario)}">${escapeHtml(u.usuario)} (${u.rol})</option>`).join("");
  } catch (e) { select.innerHTML = "<option>Error</option>"; }
}

async function sendNotificationFlow() {
  try {
    const scope = $("notifTargetScope")?.value;
    const payload = {
      target_scope: scope,
      target_municipio: $("notifTargetMunicipio")?.value || "",
      target_clues: $("notifTargetClues")?.value || "",
      target_usuario: $("notifTargetUser")?.value || "",
      type: $("notifType")?.value || "INFO",
      title: $("notifTitle")?.value || "",
      message: $("notifMessage")?.value || ""
    };

    // Validaciones de Seguridad y Jerarquía
    if (!scope) throw new Error("Selecciona un alcance para la notificación");
    if (!payload.title.trim()) throw new Error("Escribe un título");
    if (!payload.message.trim()) throw new Error("Escribe un mensaje");

    if (scope === "CLUES" && !payload.target_clues) throw new Error("Selecciona una unidad destino");
    if (scope === "MUNICIPIO" && !payload.target_municipio) throw new Error("Selecciona un municipio destino");
    if (scope === "USUARIO" && !payload.target_usuario) throw new Error("Selecciona un usuario destino");

    // Auto-completar para MUNICIPAL: Se dirige a sus unidades
    if (USER.rol === "MUNICIPAL") {
      if (scope === "ALL_MY_UNITS") {
        payload.target_scope = "MUNICIPIO_UNITS";
        // Si tiene varios, enviamos a todos sus municipios (el backend debería manejarlo, 
        // pero por ahora usamos el principal o el seleccionado en notifTargetMunicipio si existiera)
        payload.target_municipio = $("notifTargetMunicipio")?.value || USER.municipio;
      } else if (scope === "CLUES") {
        // MUNICIPAL enviando a CLUES específica: ya tiene target_clues del selector
      }
    } else if (USER.rol === "CARAVANAS") {
      if (scope === "ALL_MY_UNITS") {
        payload.target_scope = "CARAVANAS_UNITS";
      }
    }

    // JURISDICCIONAL: Solo a MUNICIPALES
    if (USER.rol === "JURISDICCIONAL") {
      if (scope === "MUNICIPAL_USERS_ALL") {
        payload.target_scope = "ROLE";
        payload.target_usuario = "MUNICIPAL";
      } else if (scope === "MUNICIPIO") {
        // Ya tiene target_scope="MUNICIPIO" y target_municipio del selector.
        // Los filtros de recepción garantizan que solo lo vea el staff municipal.
      }
    }

    setBtnBusy("btnSendNotification", true, "Emitiendo...");
    showOverlay("Emitiendo comunicado oficial...", "Notificaciones");

    const res = await apiCall("sendNotification", payload);

    if (res && res.ok) {
      showToast("Comunicado enviado con éxito", true);
      // Reset form
      $("notifTitle").value = "";
      $("notifMessage").value = "";
    } else {
      throw new Error(res?.error || "Error al enviar");
    }

  } catch (e) {
    showToast(e.message, false, "bad");
  } finally {
    setBtnBusy("btnSendNotification", false);
    hideOverlay();
  }
}

function bindPinolEntregaModalEvents() {
  $("btnCancelarEntregaPinol")?.addEventListener("click", () => {
    closePinolEntregaModal();
  });

  $("btnConfirmarEntregaPinol")?.addEventListener("click", () => {
    confirmPinolDeliveredFromModal();
  });

  $("pinolEntregaModal")?.addEventListener("click", (e) => {
    if (e.target?.id === "pinolEntregaModal") {
      closePinolEntregaModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    const modalOpen = $("pinolEntregaModal")?.classList.contains("show");
    if (!modalOpen) return;

    if (e.key === "Escape") {
      closePinolEntregaModal();
    }
  });
}

function ensureNotifActionButton(anchorEl, buttonId, labelText) {
  if ($(buttonId) || !anchorEl || !anchorEl.parentNode) return $(buttonId) || null;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ghostBtn";
  btn.id = buttonId;

  const icon = document.createElement("span");
  icon.className = "material-symbols-rounded";
  icon.textContent = "done_all";

  btn.appendChild(icon);

  // Si el ID incluye "TopNotif", NO agregamos texto, solo usamos el "title" como tooltip
  if (buttonId.includes("TopNotif")) {
    btn.title = labelText;
  } else {
    btn.appendChild(document.createTextNode(` ${labelText}`));
  }

  anchorEl.insertAdjacentElement("afterend", btn);
  return btn;
}

function ensureNotifSearchBox(anchorEl, boxId, inputId, clearBtnId) {
  if ($(inputId) || !anchorEl || !anchorEl.parentNode) return $(boxId) || null;

  const wrap = document.createElement("div");
  wrap.className = "notifSearchBox";
  wrap.id = boxId;

  const icon = document.createElement("span");
  icon.className = "material-symbols-rounded notifSearchIcon";
  icon.textContent = "search";

  const input = document.createElement("input");
  input.type = "text";
  input.id = inputId;
  input.className = "input notifSearchInput";
  input.placeholder = "Buscar notificación…";
  input.autocomplete = "off";

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "ghostBtn notifSearchClearBtn";
  clearBtn.id = clearBtnId;
  clearBtn.style.display = "none";

  const clearIcon = document.createElement("span");
  clearIcon.className = "material-symbols-rounded";
  clearIcon.textContent = "close";

  clearBtn.appendChild(clearIcon);

  wrap.appendChild(icon);
  wrap.appendChild(input);
  wrap.appendChild(clearBtn);

  anchorEl.insertAdjacentElement("beforebegin", wrap);
  return wrap;
}

function ensureNotifToolbarRows(searchId, searchRowClass, actionsRowId, actionsRowClass, actionIds) {
  const searchBox = $(searchId);

  if (searchBox && !searchBox.parentElement?.classList.contains(searchRowClass)) {
    const searchRow = document.createElement("div");
    searchRow.className = searchRowClass;
    searchBox.parentNode.insertBefore(searchRow, searchBox);
    searchRow.appendChild(searchBox);
  }

  const actionNodes = actionIds.map(id => $(id)).filter(Boolean);
  if (!actionNodes.length) return;

  let actionsRow = $(actionsRowId);
  if (!actionsRow) {
    actionsRow = document.createElement("div");
    actionsRow.className = actionsRowClass;
    actionsRow.id = actionsRowId;

    const anchor = actionNodes[0];
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(actionsRow, anchor);
    }
  }

  actionNodes.forEach(el => {
    if (el.parentNode !== actionsRow) {
      actionsRow.appendChild(el);
    }
  });
}

function normalizeNotifToolbarLayout() {
  ensureNotifToolbarRows(
    "notifSearchBox",
    "notifToolbarSearchRow",
    "notifToolbarActionsRow",
    "notifToolbarActionsRow",
    ["btnNotifRefresh", "btnNotifOnlyUnread", "btnNotifMarkVisibleRead"]
  );

  ensureNotifToolbarRows(
    "topNotifSearchBox",
    "topNotifToolbarSearchRow",
    "topNotifToolbarActionsRow",
    "topNotifToolbarActionsRow",
    ["btnTopNotifRefresh", "btnTopNotifOnlyUnread", "btnTopNotifMarkVisibleRead", "btnTopNotifClose"]
  );
}

function bindNotificationsUiEvents() {
  if (LIVE_STATE.notificationsUiBound) return;
  LIVE_STATE.notificationsUiBound = true;

  readNotifPrefs();

  const btnNotifOnlyUnread = $("btnNotifOnlyUnread");
  const btnNotifRefresh = $("btnNotifRefresh");
  const btnTopNotifRefresh = $("btnTopNotifRefresh");

  // Side panel toolbar creation (stays dynamic)
  ensureNotifActionButton(btnNotifOnlyUnread, "btnNotifMarkVisibleRead", "Marcar visibles");
  ensureNotifSearchBox(btnNotifRefresh, "notifSearchBox", "notifSearchInput", "btnNotifClearSearch");

  // Top panel - Solo vinculamos búsqueda, no botones (ya están en Index.html)
  ensureNotifSearchBox(btnTopNotifRefresh, "topNotifSearchBox", "topNotifSearchInput", "btnTopNotifClearSearch");

  const notifSearchInput = $("notifSearchInput");
  const topNotifSearchInput = $("topNotifSearchInput");
  const btnNotifMarkVisibleRead = $("btnNotifMarkVisibleRead");
  const btnTopNotifMarkVisibleRead = $("btnTopNotifMarkVisibleRead");
  const btnTopNotifClose = $("btnTopNotifClose");
  const btnTopNotifOnlyUnread = $("btnTopNotifOnlyUnread");

  const notifSearchHandler = debounce((ev) => {
    handleNotifSearchInput(ev?.target?.value || "");
  }, 180);

  notifSearchInput?.addEventListener("input", notifSearchHandler);
  topNotifSearchInput?.addEventListener("input", notifSearchHandler);

  $("btnNotifClearSearch")?.addEventListener("click", () => {
    handleNotifSearchInput("");
    notifSearchInput?.focus();
  });

  $("btnTopNotifClearSearch")?.addEventListener("click", () => {
    handleNotifSearchInput("");
    topNotifSearchInput?.focus();
  });

  const reloadNotifs = () => {
    loadNotifications({ silent: false }).catch(err => {
      console.error("Notif refresh error:", err);
      showToast("Error al actualizar notificaciones", false);
    });
  };

  btnNotifRefresh?.addEventListener("click", reloadNotifs);
  btnTopNotifRefresh?.addEventListener("click", reloadNotifs);

  const toggleUnread = () => {
    ONLY_UNREAD_NOTIFS = !ONLY_UNREAD_NOTIFS;
    writeNotifPrefs();
    rerenderNotificationsFromState();
  };

  btnNotifOnlyUnread?.addEventListener("click", toggleUnread);
  btnTopNotifOnlyUnread?.addEventListener("click", toggleUnread);

  const markAllVisible = () => markVisibleNotificationsAsRead();

  btnNotifMarkVisibleRead?.addEventListener("click", markAllVisible);
  btnTopNotifMarkVisibleRead?.addEventListener("click", markAllVisible);

  btnTopNotifClose?.addEventListener("click", closeTopNotifDropdown);

  // Legacy/Main interactions
  $("btnSendNotification")?.addEventListener("click", sendNotificationFlow);

  const toggleTopDropdown = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    toggleTopNotifDropdown();
  };

  $("bNotif")?.addEventListener("click", toggleTopDropdown);
  $("btnTopNotifications")?.addEventListener("click", toggleTopDropdown);

  $("notifTargetScope")?.addEventListener("change", refreshNotifScopeUi);
  $("notifTargetMunicipio")?.addEventListener("change", refillNotifCluesByMunicipio);
  $("notifTargetClues")?.addEventListener("change", refillNotifUsers);

  normalizeNotifToolbarLayout();
  refreshNotifUnreadButtons();
  refreshNotifBulkButtons();
  syncNotifSearchInputs();
  refreshNotifSearchUi();

  // Global listeners
  document.addEventListener("click", (ev) => {
    // Ripple
    const btn = ev.target.closest(".md-btn, .btn, .ghostBtn, .miniBtn, .tab, .md-delete-btn");
    if (btn) createRipple(ev, btn);

    // Group Toggle
    const groupBtn = ev.target.closest("[data-notif-group-toggle]");
    if (groupBtn) {
      const key = groupBtn.getAttribute("data-notif-group-toggle");
      if (key) toggleNotifGroup(key);
      return; // IMPORTANTE: No seguir al cierre por "clic fuera" ya que el DOM cambió
    }

    // Close dropdown on outside click
    const refs = getTopNotifDropdownRefs();
    if (refs.box && refs.box.style.display === "block") {
      if (!refs.box.contains(ev.target) && !refs.btn.contains(ev.target) && !$("bNotif")?.contains(ev.target)) {
        closeTopNotifDropdown();
      }
    }
  }, { passive: true });

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") closeTopNotifDropdown();
  });

  bindNotifTemplateEvents();
  bindPinolEntregaModalEvents();
}

let NOTIF_UNIT_CATALOG = [];
let NOTIF_USER_CATALOG = [];
let PINOL_ENTREGA_CTX = null;

let TOP_NOTIF_DROPDOWN_REFS = null;

function getTopNotifDropdownRefs() {
  if (TOP_NOTIF_DROPDOWN_REFS) return TOP_NOTIF_DROPDOWN_REFS;

  TOP_NOTIF_DROPDOWN_REFS = {
    box: $("topNotifDropdown"),
    btn: $("btnTopNotifications"),
    host: $("cardSide")
  };

  return TOP_NOTIF_DROPDOWN_REFS;
}

function positionTopNotifDropdown() {
  const refs = getTopNotifDropdownRefs();
  const box = refs.box;
  const btn = refs.btn;

  if (!box || !btn) return;

  const btnRect = btn.getBoundingClientRect();
  const boxWidth = box.offsetWidth;
  const padding = 12;

  // Calculate absolute position relative to viewport (as it's fixed now in CSS or calculated)
  let top = btnRect.bottom + 12;
  let left = btnRect.right - boxWidth;

  // Boundary checks
  if (left < padding) left = padding;
  if (left + boxWidth > window.innerWidth - padding) {
    left = window.innerWidth - boxWidth - padding;
  }

  const availableHeight = window.innerHeight - top - padding;

  box.style.position = "fixed";
  box.style.top = top + "px";
  box.style.left = left + "px";
  box.style.maxHeight = availableHeight + "px";
  box.style.zIndex = "10000";

  const card = box.querySelector(".topNotifCard");
  if (card) {
    card.style.maxHeight = availableHeight + "px";
  }
}

function openTopNotifDropdown() {
  const refs = getTopNotifDropdownRefs();
  const box = refs.box;

  if (!box) return;

  // 1. Preparar bloque de diseño pero ocultar visualmente para evitar el flash
  box.style.visibility = "hidden";
  box.style.display = "block";

  // Cerrar Explorador si está abierto
  const archBox = document.getElementById("archivosDropdown");
  if (archBox && archBox.style.display === "block") {
    archBox.classList.remove("open");
    archBox.style.display = "none";
  }

  const currentItems = Array.isArray(LIVE_STATE.notifications) ? LIVE_STATE.notifications : [];
  const currentVisible = getFilteredNotifications(currentItems);

  syncTopNotifMirror(
    Number($("notifUnreadKpi")?.textContent || 0),
    currentVisible.length
  );

  // 2. Posicionar de inmediato
  positionTopNotifDropdown();

  // 3. Hacer visible e iniciar la animación en la posición correcta
  box.style.visibility = "visible";
  box.classList.add("open");
}

function closeTopNotifDropdown() {
  const box = $("topNotifDropdown");
  if (!box) return;

  box.classList.remove("open");
  box.style.display = "none";
}

function toggleTopNotifDropdown() {
  const box = $("topNotifDropdown");
  if (!box) return;

  const isOpen = box.style.display === "block";
  if (isOpen) {
    closeTopNotifDropdown();
    return;
  }

  openTopNotifDropdown();

  rerenderNotificationsFromState();
  loadNotifications({ silent: true }).catch(err => {
    console.error("toggleTopNotifDropdown loadNotifications error:", err);
  });
}

let NOTIF_UNREAD_BUTTON_REFS = null;

function getNotifUnreadButtonRefs() {
  if (NOTIF_UNREAD_BUTTON_REFS) return NOTIF_UNREAD_BUTTON_REFS;

  NOTIF_UNREAD_BUTTON_REFS = {
    btnNotifOnlyUnread: $("btnNotifOnlyUnread"),
    btnTopNotifOnlyUnread: $("btnTopNotifOnlyUnread")
  };

  return NOTIF_UNREAD_BUTTON_REFS;
}

function refreshNotifUnreadButtons() {
  const active = !!ONLY_UNREAD_NOTIFS;
  const refs = getNotifUnreadButtonRefs();

  const label = active
    ? `<span class="material-symbols-rounded">filter_alt_off</span> Ver todas`
    : `<span class="material-symbols-rounded">filter_alt</span> Solo no leídas`;

  if (refs.btnNotifOnlyUnread) {
    refs.btnNotifOnlyUnread.innerHTML = label;
    refs.btnNotifOnlyUnread.classList.toggle("isActive", active);
    refs.btnNotifOnlyUnread.setAttribute("aria-pressed", active ? "true" : "false");
  }

  if (refs.btnTopNotifOnlyUnread) {
    refs.btnTopNotifOnlyUnread.innerHTML = active
      ? `<span class="material-symbols-rounded">filter_alt_off</span>`
      : `<span class="material-symbols-rounded">filter_alt</span>`;
    refs.btnTopNotifOnlyUnread.classList.toggle("isActive", active);
    refs.btnTopNotifOnlyUnread.setAttribute("aria-pressed", active ? "true" : "false");
    refs.btnTopNotifOnlyUnread.title = active ? "Ver todas" : "Solo no leídas";
  }
}

function syncTopNotifMirror(unread = null, total = null) {
  const topNotifUnreadKpi = $("topNotifUnreadKpi");
  const notifUnreadKpi = $("notifUnreadKpi");
  const topNotifTotalKpi = $("topNotifTotalKpi");
  const notifTotalKpi = $("notifTotalKpi");
  const topNotifRoleKpi = $("topNotifRoleKpi");
  const notifRoleKpi = $("notifRoleKpi");

  if (topNotifUnreadKpi && notifUnreadKpi) {
    topNotifUnreadKpi.textContent =
      unread !== null ? String(unread) : (notifUnreadKpi.textContent || "0");
  }

  if (topNotifTotalKpi && notifTotalKpi) {
    topNotifTotalKpi.textContent =
      total !== null ? String(total) : (notifTotalKpi.textContent || "0");
  }

  if (topNotifRoleKpi) {
    topNotifRoleKpi.textContent =
      (notifRoleKpi?.textContent || USER?.rol || "—");
  }
}

async function _dispatchBatch(requests) {
  const res = await apiCall("batch", { requests });
  if (res.error && res.error.includes("Acción inválida: batch")) {
    return Promise.all(requests.map(r => apiCall(r.action, r)));
  }
  return res.data;
}

async function loadNotifUnitCatalog(forceRefresh = false) {
  const cacheKey = buildCacheKey("UNIT_CATALOG", "NOTIFS");
  const cached = readCache(cacheKey, CACHE_TTL.UNIT_CATALOG);

  if (!forceRefresh && cached && Array.isArray(cached) && cached.length > 0) {
    NOTIF_UNIT_CATALOG = cached;
    return NOTIF_UNIT_CATALOG;
  }

  console.log("[Catalog] Solicitando catálogo de unidades...");
  const res = await apiCall("unitCatalog", {});

  if (res && res.ok && Array.isArray(res.data)) {
    NOTIF_UNIT_CATALOG = res.data;
    console.log(`[Catalog] ${NOTIF_UNIT_CATALOG.length} unidades cargadas.`);
    writeCache(cacheKey, NOTIF_UNIT_CATALOG);
  } else {
    console.error("[Catalog] Error al cargar unidades:", res?.error || "Respuesta inválida");
    NOTIF_UNIT_CATALOG = [];
  }

  return NOTIF_UNIT_CATALOG;
}

async function loadNotifUserCatalog(forceRefresh = false) {
  const cacheKey = buildCacheKey("USER_CATALOG", "NOTIFS");
  const cached = readCache(cacheKey, CACHE_TTL.UNIT_CATALOG);

  if (!forceRefresh && cached && Array.isArray(cached)) {
    NOTIF_USER_CATALOG = cached;
    return NOTIF_USER_CATALOG;
  }

  const res = await apiCall("notificationUserCatalog", {});
  NOTIF_USER_CATALOG = Array.isArray(res.data) ? res.data : [];

  writeCache(cacheKey, NOTIF_USER_CATALOG);
  return NOTIF_USER_CATALOG;
}

function getVisibleNotifMunicipios() {
  const seen = new Set();
  const out = [];
  const allowed = USER?.municipiosAllowed || [];
  const isFull = allowed.includes("*") || USER?.rol === "ADMIN" || USER?.rol === "JURISDICCIONAL";

  (NOTIF_UNIT_CATALOG || []).forEach(x => {
    const m = String(x.municipio || "").trim();
    if (!m) return;
    if (!isFull && !allowed.includes(m)) return;

    if (seen.has(m)) return;
    seen.add(m);
    out.push(m);
  });

  out.sort((a, b) => a.localeCompare(b, "es"));
  return out;
}


function getNotifUnitsByMunicipio(municipio) {
  const key = String(municipio || "").trim().toUpperCase();
  return (NOTIF_UNIT_CATALOG || []).filter(x =>
    String(x.municipio || "").trim().toUpperCase() === key
  );
}

function getNotifUsersByFilters({ municipio = "", clues = "" } = {}) {
  const muniKey = String(municipio || "").trim().toUpperCase();
  const cluesKey = String(clues || "").trim().toUpperCase();

  return (NOTIF_USER_CATALOG || []).filter(x => {
    const userMuni = String(x.municipio || "").trim().toUpperCase();
    const userClues = String(x.clues || "").trim().toUpperCase();

    if (muniKey && userMuni !== muniKey) return false;
    if (cluesKey && userClues !== cluesKey) return false;
    return true;
  });
}

function refillNotifUsers() {
  const scope = $("notifTargetScope")?.value || "";
  const municipio = $("notifTargetMunicipio")?.value || "";
  const clues = $("notifTargetClues")?.value || "";
  const userSel = $("notifTargetUsuario");

  if (!userSel) return;

  let users = [];

  if (scope === "USUARIO") {
    users = getNotifUsersByFilters({ municipio, clues });

    // Priorizar usuarios MUNICIPAL si el remitente es JURISDICCIONAL
    if (USER?.rol === "JURISDICCIONAL") {
      users.sort((a, b) => {
        const isMunicipalA = (a.rol === "MUNICIPAL") ? 0 : 1;
        const isMunicipalB = (b.rol === "MUNICIPAL") ? 0 : 1;
        return isMunicipalA - isMunicipalB || a.usuario.localeCompare(b.usuario);
      });
    }
  } else if (scope === "CLUES") {
    users = getNotifUsersByFilters({ municipio, clues });
  } else if (scope === "MUNICIPIO") {
    users = getNotifUsersByFilters({ municipio });

    // Si es Jurisdiccional y alcance Municipio, solo mostrar usuarios MUNICIPAL
    if (USER?.rol === "JURISDICCIONAL") {
      users = users.filter(x => x.rol === "MUNICIPAL");
    }
  } else if (scope === "ALL_MY_UNITS") {
    users = getNotifUsersByFilters({});
  }

  fillSelect(
    userSel,
    users,
    "Selecciona usuario",
    x => ({
      value: x.usuario,
      label: `${x.usuario} — ${x.rol}${x.unidad ? ` — ${x.unidad}` : ""}`
    })
  );
}

function fillSelect(el, items, placeholder = "Seleccionar…", mapFn = null) {
  if (!el) return;

  const arr = Array.isArray(items) ? items : [];
  const opts = [`<option value="">${escapeHtml(placeholder)}</option>`];

  arr.forEach(item => {
    const mapped = mapFn ? mapFn(item) : { value: item, label: item };
    opts.push(
      `<option value="${escapeAttr(mapped.value)}">${escapeHtml(mapped.label)}</option>`
    );
  });

  el.innerHTML = opts.join("");
}

function refreshNotifScopeUi() {
  const scope = $("notifTargetScope")?.value || "ALL_MY_UNITS";
  const muniBox = $("notifMunicipioBox");
  const unidadBox = $("notifUnidadBox");
  const usuarioBox = $("notifUsuarioBox");
  const muniSel = $("notifTargetMunicipio");
  const cluesSel = $("notifTargetClues");
  const scopeSel = $("notifTargetScope");

  // Restricciones perfil JURISDICCIONAL
  if (USER?.rol === "JURISDICCIONAL" && scopeSel) {
    // 1. Ocultar CLUES (unidades individuales)
    const optClues = scopeSel.querySelector('option[value="CLUES"]');
    if (optClues) optClues.style.display = "none";

    // 2. Ocultar ALL_MY_UNITS (envío masivo a todas las unidades)
    const optAll = scopeSel.querySelector('option[value="ALL_MY_UNITS"]');
    if (optAll) optAll.style.display = "none";

    // Redirigir si está en una opción no permitida
    if (scope === "CLUES" || scope === "ALL_MY_UNITS") {
      scopeSel.value = "MUNICIPIO";
      return refreshNotifScopeUi();
    }
  }


  if (scope === "ALL_MY_UNITS") {
    if (muniBox) muniBox.style.display = "block";
    if (unidadBox) unidadBox.style.display = "none";
    if (usuarioBox) usuarioBox.style.display = "none";

    const municipios = getVisibleNotifMunicipios();

    fillSelect(
      muniSel,
      municipios,
      "Todos los municipios visibles",
      x => ({ value: x, label: x })
    );

    if (muniSel) {
      muniSel.disabled = true;
      muniSel.value = municipios.length ? municipios[0] : "";
    }

    if (cluesSel) cluesSel.innerHTML = "";
    return;
  }

  if (scope === "MUNICIPIO") {
    if (muniBox) muniBox.style.display = "block";
    if (unidadBox) unidadBox.style.display = "none";
    if (usuarioBox) usuarioBox.style.display = "none";

    const municipios = getVisibleNotifMunicipios();

    fillSelect(
      muniSel,
      municipios,
      "Selecciona municipio",
      x => ({ value: x, label: x })
    );

    if (muniSel) muniSel.disabled = false;
    if (cluesSel) cluesSel.innerHTML = "";
    return;
  }

  if (scope === "CLUES") {
    if (muniBox) muniBox.style.display = "block";
    if (unidadBox) unidadBox.style.display = "block";
    if (usuarioBox) usuarioBox.style.display = "none";

    const municipios = getVisibleNotifMunicipios();

    fillSelect(
      muniSel,
      municipios,
      "Selecciona municipio",
      x => ({ value: x, label: x })
    );

    if (muniSel) muniSel.disabled = false;
    refillNotifCluesByMunicipio();
    return;
  }

  if (scope === "USUARIO") {
    if (muniBox) muniBox.style.display = "block";
    if (unidadBox) unidadBox.style.display = "block";
    if (usuarioBox) usuarioBox.style.display = "block";

    const municipios = getVisibleNotifMunicipios();

    fillSelect(
      muniSel,
      municipios,
      "Selecciona municipio",
      x => ({ value: x, label: x })
    );

    if (muniSel) muniSel.disabled = false;
    refillNotifCluesByMunicipio();
    refillNotifUsers();
  }
}

function refillNotifCluesByMunicipio() {
  const municipio = $("notifTargetMunicipio")?.value || "";
  const cluesSel = $("notifTargetClues");
  const units = getNotifUnitsByMunicipio(municipio);

  fillSelect(
    cluesSel,
    units,
    "Selecciona unidad / CLUES",
    x => ({
      value: x.clues,
      label: `${x.clues} — ${x.unidad}`
    })
  );

  refillNotifUsers();
}

function clearLiveFeed() {
  const feed = $("liveFeed");
  if (!feed) return;

  Array.from(feed.children).forEach(item => {
    item.classList.add("removing");
    setTimeout(() => item.remove(), 180);
  });

  LIVE_STATE.lastEventKey = "";
  LIVE_STATE.lastEventTs = 0;
  LIVE_STATE.eventHistory = {};

  resetNotifCounter();
}

function muteRealtimeFor(ms = 12000) {
  LIVE_STATE.mutedUntil = Date.now() + Number(ms || 0);
}

function realtimeMuted() {
  return Date.now() < Number(LIVE_STATE.mutedUntil || 0);
}

function makeEventKey(title, body, type) {
  return `${String(title || "").trim()}|${String(body || "").trim()}|${String(type || "")}`;
}

function canPushLiveEvent(eventKey, cooldownMs = null) {
  const now = Date.now();
  const waitMs = Number(cooldownMs || LIVE_STATE.eventCooldownMs || 2200);

  if (!LIVE_STATE.eventHistory || typeof LIVE_STATE.eventHistory !== "object") {
    LIVE_STATE.eventHistory = {};
  }

  const lastTs = Number(LIVE_STATE.eventHistory[eventKey] || 0);
  if ((now - lastTs) < waitMs) return false;

  LIVE_STATE.eventHistory[eventKey] = now;

  Object.keys(LIVE_STATE.eventHistory).forEach(k => {
    if ((now - Number(LIVE_STATE.eventHistory[k] || 0)) > 30000) {
      delete LIVE_STATE.eventHistory[k];
    }
  });

  return true;
}

function liveFeedTargetLabel(targetId = "") {
  const map = {
    panelCaptureSummary: "Resumen de captura",
    panelPINOLADMIN: "Pinol",
    panelHISTORY: "Histórico",
    formSR: "Existencia de biológicos",
    formCONS: "Consumibles"
  };

  return map[targetId] || "Panel relacionado";
}

function pushLiveEvent(title, body, type = "good", targetId = "", options = {}) {
  const feed = $("liveFeed");
  if (!feed) return;
  if (realtimeMuted()) return;

  const {
    force = false,
    cooldownMs = null,
    maxItems = 6,
    autoRemoveMs = 7000
  } = options || {};

  const safeTitle = String(title || "Evento").trim();
  const safeBody = String(body || "").trim();
  const safeType = String(type || "good").trim();

  const eventKey = makeEventKey(safeTitle, safeBody, safeType);
  const now = Date.now();

  const sameImmediate =
    LIVE_STATE.lastEventKey === eventKey &&
    (now - Number(LIVE_STATE.lastEventTs || 0)) < Number(cooldownMs || LIVE_STATE.eventCooldownMs || 2200);

  if (!force && sameImmediate) return;
  if (!force && !canPushLiveEvent(eventKey, cooldownMs)) return;

  LIVE_STATE.lastEventKey = eventKey;
  LIVE_STATE.lastEventTs = now;

  const item = document.createElement("div");
  item.className = `liveFeedItem ${safeType}`;
  item.dataset.eventKey = eventKey;
  item.innerHTML = `
    <div class="liveFeedHead">
      <div class="liveFeedTitle">${escapeHtml(safeTitle)}</div>
      <div class="liveFeedTime">${nowTimeStr()}</div>
    </div>
    <div class="liveFeedBody">${escapeHtml(safeBody)}</div>
  `;

  if (targetId) {
    item.style.cursor = "pointer";
    item.title = `Ir a ${liveFeedTargetLabel(targetId)}`;
    item.onclick = () => {
      const el = $(targetId);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      flashElement(targetId);
    };
  }

  feed.prepend(item);
  incrementNotifCounter(safeType);

  while (feed.children.length > Number(maxItems || 6)) {
    feed.removeChild(feed.lastElementChild);
  }

  setTimeout(() => {
    if (!item.isConnected) return;
    item.classList.add("removing");
    setTimeout(() => item.remove(), 180);
  }, Number(autoRemoveMs || 7000));

  setTimeout(() => {
    if (LIVE_STATE.lastEventKey === eventKey) {
      LIVE_STATE.lastEventKey = "";
      LIVE_STATE.lastEventTs = 0;
    }
  }, Number(cooldownMs || LIVE_STATE.eventCooldownMs || 2200));
}

function flashElement(id) {
  const el = $(id);
  if (!el) return;
  el.classList.remove("alertFlash");
  void el.offsetWidth;
  el.classList.add("alertFlash");
}

function pulseValueChange(id, mode = "pop") {
  const el = $(id);
  if (!el) return;

  el.classList.remove("valuePop", "valueRise", "valueDrop");
  void el.offsetWidth;

  if (mode === "rise") {
    el.classList.add("valueRise");
  } else if (mode === "drop") {
    el.classList.add("valueDrop");
  } else {
    el.classList.add("valuePop");
  }

  setTimeout(() => {
    el.classList.remove("valuePop", "valueRise", "valueDrop");
  }, 1000);
}

function pulseTabBadge(tabId, options = {}) {
  const {
    hot = false,
    keepAccent = true,
    pulseMs = 1800
  } = options || {};

  const el = $(tabId);
  if (!el) return;

  el.classList.add("pulse");

  if (keepAccent) {
    el.classList.add("liveAccent");
  }

  if (hot) {
    el.classList.add("notifHot");
  }

  setTimeout(() => {
    el.classList.remove("pulse");
  }, pulseMs);
}

function pulseBadge(id) {
  const el = $(id);
  if (!el) return;
  el.classList.remove("pulse");
  void el.offsetWidth;
  el.classList.add("pulse");
}

function clearTabAttention(...ids) {
  ids.flat().forEach(id => {
    const el = $(id);
    if (!el) return;
    el.classList.remove("pulse", "liveAccent", "notifHot");
  });
}

let FORCE_PASSWORD_CHANGE = false;

const UX_KEYS = {
  lastUser: "JS1_LAST_USER",
  existenciaName: "JS1_LAST_EXISTENCIA_NAME",
  consName: "JS1_LAST_CONS_NAME",
  bioName: "JS1_LAST_BIO_NAME",
  pinolName: "JS1_LAST_PINOL_NAME"
};

function saveUxValue(key, value) {
  try {
    const v = String(value || "").trim();
    if (!v) return;
    localStorage.setItem(key, v);
  } catch (e) { }
}

function getUxValue(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch (e) {
    return "";
  }
}

function fillIfEmpty(id, value) {
  const el = $(id);
  if (!el) return;
  if (String(el.value || "").trim()) return;
  el.value = String(value || "").trim();
}

function applyLoginAutocomplete() {
  const lastUser = getUxValue(UX_KEYS.lastUser);
  if ($("usuario") && lastUser && !$("usuario").value.trim()) {
    $("usuario").value = lastUser;
  }

  setTimeout(() => {
    if (!$("usuario") || !$("password")) return;

    if ($("usuario").value.trim() && !$("password").value.trim()) {
      $("password").focus();
    } else if (!$("usuario").value.trim()) {
      $("usuario").focus();
    }
  }, 80);
}

function applyCaptureNameAutocomplete() {
  const nameSR = getUxValue(UX_KEYS.existenciaName);
  const nameCONS = getUxValue(UX_KEYS.consName);
  const nameBIO = getUxValue(UX_KEYS.bioName);
  const namePINOL = getUxValue(UX_KEYS.pinolName);

  // If we have a stored name, use it. If not, fallback to USER.nombre if it's not a generic ID
  const defaultName = (USER && USER.nombre && !USER.nombre.includes("_")) ? USER.nombre : "";

  fillIfEmpty("nombreSR", nameSR || defaultName);
  fillIfEmpty("nombreCONS", nameCONS || defaultName);
  fillIfEmpty("nombreBIO", nameBIO || defaultName);
  fillIfEmpty("nombrePINOL", namePINOL || defaultName);
}

function bindFastNumericFocus() {
  document.querySelectorAll('input[type="number"]').forEach(inp => {
    if (inp.dataset.fastBound === "1") return;
    inp.dataset.fastBound = "1";

    inp.addEventListener("focus", () => {
      setTimeout(() => {
        try { inp.select(); } catch (e) { }
      }, 20);
    });

    inp.addEventListener("click", () => {
      setTimeout(() => {
        try { inp.select(); } catch (e) { }
      }, 20);
    });
  });
}

async function loadUnitCatalog(force = false) {
  if (!TOKEN) return [];

  const cacheKey = buildCacheKey("UNIT_CATALOG", "BASE");

  const data = force
    ? await (async () => {
      const r = await apiCall({
        action: "unitCatalog",
        token: TOKEN
      });

      if (!r || !r.ok) return [];
      return Array.isArray(r.data) ? r.data : [];
    })()
    : await getCachedOrFetch({
      key: cacheKey,
      ttl: CACHE_TTL.UNIT_CATALOG,
      fetcher: async () => {
        const r = await apiCall({
          action: "unitCatalog",
          token: TOKEN
        });

        if (!r || !r.ok) return [];
        return Array.isArray(r.data) ? r.data : [];
      },
      shouldCache: (data) => Array.isArray(data)
    });

  UNIT_CATALOG = (Array.isArray(data) ? data : []).map(u => {
    if (u && u.unidad) {
      const upper = u.unidad.toUpperCase().trim();
      if (upper.includes("FELIPE NUÑEZ LARA") || upper.includes("ESPECIALIDADES DEL NIÑO Y LA MUJER")) {
        u.unidad = "HENM";
      }
    }
    return u;
  });
  paintUnitCatalogLists();
  return UNIT_CATALOG;
}

function uniqueValues(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

function paintDataList(id, values) {
  const el = $(id);
  if (!el) return;
  el.innerHTML = "";

  uniqueValues(values).forEach(v => {
    const op = document.createElement("option");
    op.value = v;
    el.appendChild(op);
  });
}

function paintUnitCatalogLists() {
  const municipios = UNIT_CATALOG.map(x => x.municipio || "");
  const clues = UNIT_CATALOG.map(x => x.clues || "");
  const unidades = UNIT_CATALOG.map(x => x.unidad || "");

  paintDataList("municipiosList", municipios);
  paintDataList("cluesList", clues);
  paintDataList("unidadesList", unidades);
}

function normalizeKey(v) {
  return String(v || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function findCatalogByClues(clues) {
  const key = String(clues || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!key) return null;

  return UNIT_CATALOG.find(x =>
    String(x.clues || "").trim().toUpperCase().replace(/\s+/g, "") === key
  ) || null;
}

function isCurrentUnitCaravana() {
  const clues = String((USER && USER.clues) || "").trim().toUpperCase().replace(/\s+/g, "");
  return clues.startsWith("FAM") || clues.startsWith("UMME");
}

function findCatalogByUnidad(unidad) {
  const key = normalizeKey(unidad);
  if (!key) return null;

  return UNIT_CATALOG.find(x =>
    normalizeKey(x.unidad) === key
  ) || null;
}

function applyAdminAutocompleteFromClues() {
  const clues = $("new_clues") ? $("new_clues").value.trim() : "";
  const hit = findCatalogByClues(clues);
  if (!hit) return;

  if ($("new_unidad") && !$("new_unidad").value.trim()) {
    $("new_unidad").value = hit.unidad || "";
  }

  if ($("new_municipio") && !$("new_municipio").value.trim()) {
    $("new_municipio").value = hit.municipio || "";
  }
}

function applyAdminAutocompleteFromUnidad() {
  const unidad = $("new_unidad") ? $("new_unidad").value.trim() : "";
  const hit = findCatalogByUnidad(unidad);
  if (!hit) return;

  if ($("new_clues") && !$("new_clues").value.trim()) {
    $("new_clues").value = hit.clues || "";
  }

  if ($("new_municipio") && !$("new_municipio").value.trim()) {
    $("new_municipio").value = hit.municipio || "";
  }
}

function bindAdminAutocomplete() {
  const cluesEl = $("new_clues");
  const unidadEl = $("new_unidad");

  if (cluesEl && cluesEl.dataset.autoBound !== "1") {
    cluesEl.dataset.autoBound = "1";
    cluesEl.addEventListener("change", applyAdminAutocompleteFromClues);
    cluesEl.addEventListener("blur", applyAdminAutocompleteFromClues);
    cluesEl.addEventListener("input", () => {
      if (String(cluesEl.value || "").trim().length >= 4) {
        applyAdminAutocompleteFromClues();
      }
    });
  }

  if (unidadEl && unidadEl.dataset.autoBound !== "1") {
    unidadEl.dataset.autoBound = "1";
    unidadEl.addEventListener("change", applyAdminAutocompleteFromUnidad);
    unidadEl.addEventListener("blur", applyAdminAutocompleteFromUnidad);
    unidadEl.addEventListener("input", () => {
      if (String(unidadEl.value || "").trim().length >= 5) {
        applyAdminAutocompleteFromUnidad();
      }
    });
  }
}

function openPasswordModal(force = false) {
  FORCE_PASSWORD_CHANGE = !!force;
  const ov = $("passwordOverlay");
  if (ov) ov.classList.add("show");

  if ($("btnPwdClose")) {
    $("btnPwdClose").style.display = FORCE_PASSWORD_CHANGE ? "none" : "inline-flex";
  }

  if ($("pwdCurrent")) $("pwdCurrent").value = "";
  if ($("pwdNew")) $("pwdNew").value = "";
  if ($("pwdConfirm")) $("pwdConfirm").value = "";

  if ($("myEmail")) {
    $("myEmail").value = (USER && USER.email) ? USER.email : "";
  }

  setTimeout(() => {
    if ($("pwdCurrent")) $("pwdCurrent").focus();
  }, 60);
}

function closePasswordModal() {
  if (FORCE_PASSWORD_CHANGE) return;
  const ov = $("passwordOverlay");
  if (ov) ov.classList.remove("show");
}

async function saveMyPasswordFlow() {
  const newPassword = $("pwdNew") ? $("pwdNew").value.trim() : "";
  const confirmPassword = $("pwdConfirm") ? $("pwdConfirm").value.trim() : "";

  if (!newPassword || !confirmPassword) {
    showToast("Completa los campos de nueva contraseña", false, "warn");
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast("La nueva contraseña y la confirmación no coinciden", false, "bad");
    return;
  }

  if (newPassword.length < 6) {
    showToast("La contraseña debe tener al menos 6 caracteres", false, "warn");
    return;
  }

  showOverlay("Actualizando seguridad...", "Cifrando");

  try {
    // 🔐 ACTUALIZACIÓN NATIVA SUPABASE
    const { error } = await window.supabase.auth.updateUser({
      password: newPassword,
      data: { force_password_change: false }
    });

    if (error) throw error;

    // 🔐 Sincronizar cambio con las tablas perfiles y usuarios_legacy
    try {
      const legacyHash = await hashPassword(newPassword);
      const userUid = USER.uid || USER.id || (await window.supabase.auth.getUser()).data.user?.id;

      // Actualizar tabla perfiles
      if (userUid) {
        await window.supabase
          .from('perfiles')
          .update({ must_change: false })
          .eq('id', userUid);
      }

      // Actualizar tabla usuarios_legacy
      if (USER.usuario) {
        await window.supabase
          .from('usuarios_legacy')
          .update({ password: legacyHash, must_change: false })
          .eq('usuario', USER.usuario);
      }
    } catch (dbErr) {
      console.warn("[Auth Sync] No se pudieron sincronizar las tablas de la base de datos:", dbErr);
    }

    showToast("Contraseña actualizada con éxito", true, "good");

    const wasForced = FORCE_PASSWORD_CHANGE;
    FORCE_PASSWORD_CHANGE = false;
    window.MUST_CHANGE_PASSWORD = false;

    if (USER) {
      USER.mustChange = false;
      saveSession(TOKEN, USER);
    }

    closePasswordModal();

    if (wasForced) {
      showToast("Sesión validada. Reiniciando...", true, "good");
      setTimeout(() => window.location.reload(), 1500);
    }

  } catch (error) {
    console.error("Error al actualizar contraseña:", error);
    showToast(error.message || "No se pudo actualizar la contraseña", false, "bad");
  } finally {
    hideOverlay();
  }
}

function openForgotModal() {
  const ov = $("forgotOverlay");
  if (ov) ov.classList.add("show");

  if ($("forgotUsuario")) $("forgotUsuario").value = "";

  setTimeout(() => {
    if ($("forgotUsuario")) $("forgotUsuario").focus();
  }, 60);
}

function closeForgotModal() {
  const ov = $("forgotOverlay");
  if (ov) ov.classList.remove("show");
}

function maskEmailAddress(email) {
  if (!email || !email.includes("@")) return email;
  const parts = email.split("@");
  const local = parts[0];
  const domain = parts[1];
  if (local.length <= 3) {
    return local.charAt(0) + "***" + "@" + domain;
  }
  return local.substring(0, 3) + "***" + local.substring(local.length - 2) + "@" + domain;
}

async function requestPasswordResetFlow() {
  let emailOrUser = $("forgotUsuario") ? $("forgotUsuario").value.trim() : "";

  if (!emailOrUser) {
    showToast("Ingresa tu usuario o correo institucional", false, "warn");
    return;
  }

  // Si no contiene '@', asumimos que es un usuario y buscamos su correo en usuarios_legacy
  let finalEmail = emailOrUser;
  if (!emailOrUser.includes("@")) {
    // Cerramos el modal antes de mostrar overlay de carga
    closeForgotModal();
    showOverlay("Buscando correo de usuario...", "Verificando");
    try {
      const { data, error } = await window.supabase
        .from('usuarios_legacy')
        .select('email')
        .ilike('usuario', emailOrUser)
        .maybeSingle();

      if (error) throw error;

      if (!data || !data.email) {
        hideOverlay();
        showToast("El usuario no tiene un correo registrado o no existe", false, "bad");
        // Volvemos a abrir el modal
        openForgotModal();
        if ($("forgotUsuario")) $("forgotUsuario").value = emailOrUser;
        return;
      }
      finalEmail = data.email;
    } catch (e) {
      console.error("Error al buscar usuario:", e);
      hideOverlay();
      showToast("Error al verificar el usuario. Reintenta.", false, "bad");
      openForgotModal();
      if ($("forgotUsuario")) $("forgotUsuario").value = emailOrUser;
      return;
    } finally {
      hideOverlay();
    }
  } else {
    // Si ya era un correo, cerramos el modal
    closeForgotModal();
  }

  // Mostramos la pantalla de carga global del sistema
  showOverlay("Estamos enviando el enlace de recuperación…", "Recuperando acceso");

  try {
    // Usamos el cliente global window.supabase inicializado en main.js
    const { data, error } = await window.supabase.auth.resetPasswordForEmail(finalEmail, {
      redirectTo: window.location.origin + window.location.pathname.replace('index.html', '') + 'reset.html',
    });

    if (error) {
      showToast(error.message || "No se pudo enviar el enlace", false, "bad");
      openForgotModal();
      if ($("forgotUsuario")) $("forgotUsuario").value = emailOrUser;
      return;
    }

    const masked = maskEmailAddress(finalEmail);
    showToast(`Se envió un correo de recuperación al correo ${masked}`, true, "good");
  } catch (e) {
    console.error(e);
    showToast("Error al solicitar recuperación", false, "bad");
    openForgotModal();
    if ($("forgotUsuario")) $("forgotUsuario").value = emailOrUser;
  } finally {
    hideOverlay();
  }
}

function setupPasswordToggles() {
  document.querySelectorAll(".pwdToggle").forEach(btn => {
    btn.onclick = () => {
      const targetId = btn.getAttribute("data-target");
      const input = $(targetId);
      const icon = btn.querySelector(".material-symbols-rounded");

      if (!input) return;

      if (input.type === "password") {
        input.type = "text";
        if (icon) icon.textContent = "visibility_off";
      } else {
        input.type = "password";
        if (icon) icon.textContent = "visibility";
      }
    };
  });
}

// NUEVO GESTOR DE ESTADO
const StateManager = {
  _state: { notifications: [], pinol: [], history: [] },
  setNotifications: function (arr) {
    this._state.notifications = Array.isArray(arr) ? [...arr] : [];
    // Opción para Despachar Eventos de DOM si otras partes escuchan.
  },
  getNotifications: function () { return [...this._state.notifications]; }
};

// NUEVO WRAPPER UI (Ejecutor Asíncrono Centralizado)
async function executeAction(actionName, payload, loadingMsg, successMsg = null) {
  try {
    if (loadingMsg) showOverlay(loadingMsg);

    // Invocamos el puente asíncrono hacia GAS
    const res = await apiCall(actionName, payload);

    if (!res || !res.ok) {
      throw new Error((res && res.error) || "Error desconocido en el servidor.");
    }

    if (successMsg) showToast(successMsg, "good");
    return res.data;
  } catch (error) {
    showToast(error.message, "bad");
    throw error;
  } finally {
    if (loadingMsg) hideOverlay();
  }
}
// ==========================================
// API CALL — PROXY A GOOGLE APPS SCRIPT
// ==========================================
// Toda la lógica de datos pasa por doPost() de GAS.
// El frontend NUNCA accede a la base de datos directamente.

/**
 * INTERCEPTOR DE API UNIFICADO
 * Sustituye el antiguo apiCall que usaba GAS por una llamada directa a AppService.
 */
async function apiCall(actionOrPayload, payload = {}, options = {}) {
  const action = typeof actionOrPayload === "string" ? actionOrPayload : actionOrPayload.action;
  const finalPayload = typeof actionOrPayload === "object" ? actionOrPayload : payload;

  // ⚡ Redirección directa al servicio Supabase (Eliminando GAS)
  return AppService.call(action, finalPayload, options);
}

// --- SEGURIDAD ---
const JS1_SALT = "JS1_SALT_2026_MX";

async function hashPassword(text) {
  if (!text) return "";
  const msgUint8 = new TextEncoder().encode(text + JS1_SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * INTERCEPTOR SUPABASE
 * Reemplaza la lógica de GAS por llamadas directas a Supabase.
 */
async function supabaseRequest(action = "", payload, options = {}) {
  const actionLower = String(action || "").toLowerCase();
  console.log(`[Supabase] Action: ${actionLower}`, payload);

  try {
    switch (actionLower) {
      case "login": {
        const { data, error } = await supabase
          .from('usuarios_legacy')
          .select('*')
          .ilike('usuario', payload.usuario)
          .limit(1);

        if (error) throw error;
        console.log(`[Supabase DEBUG] Login user raw:`, data);
        const userRaw = data && data.length > 0 ? data[0] : null;

        if (!userRaw) {
          throw new Error("Usuario no encontrado.");
        }

        // Mapeo flexible
        const userObj = {
          usuario: userRaw.usuario || userRaw.USUARIO || "",
          password: userRaw.password || userRaw.PASSWORD || "",
          municipio: userRaw.municipio || userRaw.MUNICIPIO || "",
          municipios_allowed: userRaw.municipios_allowed || userRaw.MUNICIPIOS_ALLOWED || null,
          clues: userRaw.clues || userRaw.CLUES || "",
          unidad: userRaw.unidad || userRaw.UNIDAD || "",
          rol: userRaw.rol || userRaw.ROL || "",
          activo: userRaw.activo || userRaw.ACTIVO || userRaw.ESTATUS || "SI",
          must_change: userRaw.must_change || userRaw.MUST_CHANGE || false
        };

        if (String(userObj.activo).toUpperCase() !== 'SI') {
          throw new Error("El usuario no está activo.");
        }

        const dataFromDb = userObj;
        const inputHash = await hashPassword(payload.password);

        if (dataFromDb.password !== inputHash) {
          throw new Error("Contraseña incorrecta.");
        }

        return {
          ok: true,
          data: {
            token: btoa(dataFromDb.usuario + ":" + Date.now()), // Token temporal compatible
            mustChange: !!dataFromDb.must_change,
            user: {
              usuario: dataFromDb.usuario,
              municipio: dataFromDb.municipio,
              municipiosAllowed: (function () {
                // Priorizar municipios_allowed, fallback a municipio
                const raw = dataFromDb.municipios_allowed || dataFromDb.municipio;
                if (!raw) return [];
                if (Array.isArray(raw)) return raw;
                return String(raw).split(/[;,]/).map(x => x.trim().toUpperCase()).filter(Boolean);
              })(),
              clues: (function () {
                const c = dataFromDb.clues;
                const r = String(dataFromDb.rol).toUpperCase();
                return (r !== "UNIDAD" && !c) ? "QTSSA012154" : c;
              })(),
              unidad: (function () {
                const u = dataFromDb.unidad;
                const r = String(dataFromDb.rol).toUpperCase();
                const rawUni = (r !== "UNIDAD" && !u) ? "OFICINAS DE LA JURISDICCIÓN SANITARIA" : u;
                const upper = String(rawUni || "").toUpperCase().trim();
                if (upper.includes("FELIPE NUÑEZ LARA") || upper.includes("ESPECIALIDADES DEL NIÑO Y LA MUJER")) {
                  return "HENM";
                }
                return rawUni;
              })(),
              rol: dataFromDb.rol,
              email: dataFromDb.email || ""
            }
          }
        };
      }

      case "whoami": {
        // 🛡️ NEUTRALIZADO: whoami() ahora valida directamente contra Supabase Auth.
        // Este case ya no se invoca, pero se mantiene como fallback seguro.
        console.warn("[supabaseRequest] whoami case invocado — debe usar whoami() directo");
        return { ok: false, error: "Use whoami() directo" };
      }

      case "savesr": {
        const items = payload.items || [];
        const fecha = payload.fecha || todayYmdLocal();
        const clues = payload.clues || USER.clues;
        const municipio = payload.municipio || USER.municipio;
        const unidad = payload.unidad || USER.unidad;
        const nombreResp = String(payload.nombre || USER.nombre || USER.usuario || "").toUpperCase();

        // 1. Obtener catálogo de lotes para autocompletado de caducidad
        const { data: catLotes } = await supabase.from('lotes').select('biologico, lote, caducidad');
        const loteMap = {};
        if (catLotes) {
          catLotes.forEach(l => {
            const key = `${l.biologico.toUpperCase()}:${l.lote.toUpperCase()}`;
            loteMap[key] = l.caducidad;
          });
        }

        // 🛡️ Regla de Oro: Asegurar municipio correcto para jerarquía
        let finalMuni = municipio || USER.municipio;
        if (!finalMuni && clues) {
          const { data: u } = await supabase.from('unidades').select('municipio').eq('clues', clues).maybeSingle();
          if (u) finalMuni = u.municipio;
        }

        const summaryRecord = {
          id: btoa(clues + ":" + fecha + ":" + Date.now()),
          timestamp: new Date().toISOString(),
          fecha,
          municipio: finalMuni,
          clues,
          unidad,
          capturado_por: nombreResp
        };

        // Inicializar biológicos según auditoría exacta
        const BIOS = ["bcg", "hepatitis_b", "hexavalente", "dpt", "rotavirus", "neumococica_13", "neumococica_20", "srp", "sr", "vph", "varicela", "hepatitis_a", "td", "tdpa", "covid_19", "influenza", "vsr"];
        BIOS.forEach(b => summaryRecord[b] = 0);

        // 3. Preparar Detalle (Long Table - EXISTENCIA_DETALLE)
        const detailRecords = items.map(it => {
          const bioKey = it.biologico.toLowerCase().replace(/ /g, "_");
          // Normalización especial para Neumocócica
          const finalKey = bioKey.includes("neumo") && bioKey.includes("20") ? "neumococica_20" : bioKey;

          if (BIOS.includes(finalKey)) {
            summaryRecord[finalKey] += Number(it.cantidad || 0);
          }

          // Lookup automático de caducidad si viene vacío
          let finalCad = it.caducidad;
          if (!finalCad || finalCad.trim() === "") {
            const lookupKey = `${it.biologico.toUpperCase()}:${it.lote.toUpperCase()}`;
            finalCad = loteMap[lookupKey] || "";
          }

          return {
            fecha,
            clues,
            unidad,
            municipio,
            biologico: it.biologico,
            lote: it.lote,
            caducidad: mmmaaToIsoDate(finalCad), // CONVERSIÓN A ISO PARA DB
            fecha_recepcion: it.fecha_recepcion,
            cantidad: Number(it.cantidad || 0),
            capturado_por: nombreResp
          };
        });

        // ============================================================
        // DETECCIÓN INTELIGENTE DE BIOLÓGICOS EN CERO (Server-Side)
        // Comparación con el reporte anterior: si antes había stock (>0)
        // y ahora está en 0 (porque se omitió la fila o se capturó en 0),
        // se registra como alerta de desabasto automática.
        // ============================================================
        const { data: prevReport } = await supabase
          .from('biologicos_existencia')
          .select('*')
          .eq('clues', clues)
          .lt('fecha', fecha)
          .order('fecha', { ascending: false })
          .limit(1)
          .maybeSingle();

        const BIOS_MAP = {
          "bcg": "BCG",
          "hepatitis_b": "HEPATITIS B",
          "hexavalente": "HEXAVALENTE",
          "dpt": "DPT",
          "rotavirus": "ROTAVIRUS",
          "neumococica_13": "NEUMOCÓCICA 13",
          "neumococica_20": "NEUMOCÓCICA 20",
          "srp": "SRP",
          "sr": "SR",
          "vph": "VPH",
          "varicela": "VARICELA",
          "hepatitis_a": "HEPATITIS A",
          "td": "TD",
          "tdpa": "TDPA",
          "covid_19": "COVID-19",
          "influenza": "INFLUENZA",
          "vsr": "VSR"
        };

        const desabastoTransicion = [];
        Object.keys(BIOS_MAP).forEach(bioKey => {
          const currentQty = Number(summaryRecord[bioKey] || 0);
          const hadStock = prevReport ? Number(prevReport[bioKey] || 0) > 0 : false;
          if (currentQty === 0 && hadStock) {
            desabastoTransicion.push(BIOS_MAP[bioKey]);
          }
        });

        const bioTotalsCapture = {};
        detailRecords.forEach(r => {
          const bioName = (r.biologico || '').trim().toUpperCase();
          if (bioName) {
            bioTotalsCapture[bioName] = (bioTotalsCapture[bioName] || 0) + Number(r.cantidad || 0);
          }
        });

        const explicitZeros = Object.keys(bioTotalsCapture).filter(b => bioTotalsCapture[b] === 0);
        const explicitZerosOrig = explicitZeros.map(bUpper => {
          const orig = detailRecords.find(r => (r.biologico || '').trim().toUpperCase() === bUpper);
          return orig ? (orig.biologico || '').trim() : bUpper;
        });

        // Unión de transiciones (de >0 a 0) y ceros explícitos capturados
        const finalMissing = Array.from(new Set([...desabastoTransicion, ...explicitZerosOrig]));
        summaryRecord.tiene_ceros = finalMissing.length > 0;

        console.log(`[Capture Logic] Desabasto por transición: ${desabastoTransicion.join(', ')} | Ceros explícitos: ${explicitZerosOrig.join(', ')}`);

        // 4. Ejecutar Inserción Dual en Paralelo (summaryRecord ya tiene tiene_ceros)
        console.log("[Capture Logic] Preparando guardado de SR para:", { clues, fecha, tiene_ceros: summaryRecord.tiene_ceros });

        // PURGAR PREVIAMENTE PARA EVITAR DUPLICADOS AL EDITAR
        await Promise.all([
          supabase.from('biologicos_existencia').delete().eq('clues', clues).eq('fecha', fecha),
          supabase.from('existencia_detalle').delete().eq('clues', clues).eq('fecha', fecha)
        ]);

        const [resSummary, resDetail] = await Promise.all([
          supabase.from('biologicos_existencia').insert(summaryRecord),
          supabase.from('existencia_detalle').insert(detailRecords)
        ]);

        if (resSummary.error) throw resSummary.error;
        if (resDetail.error) throw resDetail.error;

        console.log("[Capture Logic] SR Guardado correctamente.");

        // --- Generar Alerta de Desabasto (si hay biológicos en cero) ---
        if (finalMissing.length > 0) {
          const notifId = 'NOTIF:DESABASTO:' + btoa(clues + ":" + fecha + ":" + Date.now());

          const desabastoRecord = {
            id: notifId,
            type: 'ALERTA_DESABASTO',
            created_ts: new Date().toISOString(),
            created_date: todayYmdLocal(),
            from_usuario: 'SISTEMA',
            from_rol: 'SYS',
            target_scope: 'MUNICIPIO',
            target_municipio: municipio,
            title: '🚨 Desabasto detectado',
            message: `La unidad ${unidad} capturó sin existencias de: ${finalMissing.join(', ')}.`,
            status: 'UNREAD',
            meta_json: JSON.stringify({
              clues: clues,
              unidad: unidad,
              municipio: municipio,
              missing: finalMissing,
              status: 'activa'
            })
          };

          await supabase.from('notificaciones').insert(desabastoRecord);

          // Fan-out: crear copias individuales para cada destinatario
          const desabastoRecipients = await resolveNotificationRecipients(desabastoRecord);
          await fanOutNotification(desabastoRecord.id, desabastoRecipients);
          console.log(`[Capture Logic] Alerta de desabasto generada para: ${finalMissing.join(', ')} → ${desabastoRecipients.length} destinatarios`);
        }

        return { ok: true };
      }

      case "saveconsumibles": {
        // 🛡️ Regla de Oro: Asegurar municipio correcto para jerarquía
        let finalMuni = payload.municipio || USER.municipio;
        const finalClues = payload.clues || USER.clues;
        if (!finalMuni && finalClues) {
          const { data: u } = await supabase.from('unidades').select('municipio').eq('clues', finalClues).maybeSingle();
          if (u) finalMuni = u.municipio;
        }

        const record = {
          id: btoa(finalClues + ":" + (payload.fecha || todayYmdLocal())),
          timestamp: new Date().toISOString(),
          fecha: payload.fecha || todayYmdLocal(),
          municipio: finalMuni,
          clues: finalClues,
          unidad: payload.unidad || USER.unidad,
          srp_dosis: Number(payload.srp_dosis || 0),
          sr_dosis: Number(payload.sr_dosis || 0),
          jeringa_reconst_5ml_0605500438: Number(payload.jeringa_reconst_5ml_0605500438 || 0),
          jeringa_aplic_05ml_0605502657: Number(payload.jeringa_aplic_05ml_0605502657 || 0),
          aguja_0600403711: Number(payload.aguja_0600403711 || payload.aguja_06004037 || 0),
          capturado_por: String(payload.nombre || USER.nombre || USER.usuario || "").toUpperCase(),
          editado: payload.editado || 'NO'
        };

        const { error } = await supabase.from('consumibles').upsert(record, { onConflict: 'id' });
        if (error) {
          console.error("[Capture Logic] Error al guardar consumibles:", error);
          throw error;
        }
        console.log("[Capture Logic] Consumibles guardados/actualizados correctamente.");
        return { ok: true };
      }

      case "savebio": {
        // 🛡️ Regla de Oro: Asegurar municipio correcto para jerarquía
        let finalMuni = payload.municipio || USER.municipio;
        const finalClues = payload.clues || USER.clues;
        if (!finalMuni && finalClues) {
          const { data: u } = await supabase.from('unidades').select('municipio').eq('clues', finalClues).maybeSingle();
          if (u) finalMuni = u.municipio;
        }

        const items = payload.items || [];
        const records = items.map(it => ({
          id: btoa(finalClues + ":" + it.biologico + ":" + Date.now()),
          timestamp: new Date().toISOString(),
          fecha_captura: payload.fecha || todayYmdLocal(),
          fecha_pedido_programada: payload.fechaPedidoProgramada || todayYmdLocal(),
          municipio: finalMuni,
          clues: finalClues,
          unidad: payload.unidad || USER.unidad,
          biologico: it.biologico,
          max_dosis: Number(it.max_dosis || 0),
          min_dosis: Number(it.min_dosis || 0),
          promedio_frascos: Number(it.promedio_frascos || 0),
          existencia_actual_frascos: Number(it.existencia_actual_frascos || 0),
          pedido_frascos: Number(it.pedido_frascos || 0),
          tipo_pedido: payload.tipo_pedido || "MENSUAL",
          sin_pedido: payload.sin_pedido || false,
          capturado_por: String(payload.nombre || USER.nombre || USER.usuario || "").toUpperCase()
        }));

        console.log("[Capture Logic] Preparando guardado de BIO para:", { clues: finalClues, fecha: payload.fecha || todayYmdLocal() });

        // PURGAR PREVIAMENTE PARA EVITAR DUPLICADOS AL EDITAR (Incluyendo Legacy)
        let deleteQuery = supabase.from('biologicos_pedido').delete().eq('clues', finalClues);
        if (payload.windowStartYmd && payload.windowEndYmd) {
          deleteQuery = deleteQuery.or(`fecha_pedido_programada.eq.${payload.fechaPedidoProgramada || todayYmdLocal()},and(fecha_captura.gte.${payload.windowStartYmd},fecha_captura.lte.${payload.windowEndYmd},tipo_pedido.in.(MENSUAL,null))`);
        } else {
          deleteQuery = deleteQuery.eq('fecha_pedido_programada', payload.fechaPedidoProgramada || todayYmdLocal());
        }
        await deleteQuery;

        const { error } = await supabase.from('biologicos_pedido').insert(records);
        if (error) {
          console.error("[Capture Logic] Error al guardar pedido de biológico:", error);
          throw error;
        }
        console.log("[Capture Logic] Pedido de Biológico guardado correctamente.");
        return { ok: true };
      }

      case "gettodayreports": {
        const fechaStr = payload.fecha || todayYmdLocal();
        const clues = USER.clues;

        // Paralelizar consultas (Usamos existencia_detalle para traer los lotes capturados)
        const [resSR, resCons] = await Promise.all([
          supabase.from('existencia_detalle').select('*').eq('clues', clues).eq('fecha', fechaStr),
          supabase.from('consumibles').select('*').eq('clues', clues).eq('fecha', fechaStr).maybeSingle()
        ]);

        const srItems = resSR.data || [];
        const consData = resCons.data || null;
        console.log(`[Supabase DEBUG] getTodayReports raw:`, { srItems, consData });

        return {
          ok: true,
          data: {
            sr: srItems.length ? {
              capturado_por: srItems[0].capturado_por || srItems[0].capturado || "",
              items: srItems.map(it => ({
                biologico: it.biologico,
                lote: it.lote,
                caducidad: it.caducidad,
                cantidad: it.cantidad,
                fecha_recepcion: it.fecha_recepcion
              }))
            } : null,
            cons: consData ? {
              capturado_por: consData.capturado_por,
              srp_dosis: consData.srp_dosis,
              sr_dosis: consData.sr_dosis,
              jeringa_reconst_5ml_0605500438: consData.jeringa_reconst_5ml_0605500438,
              jeringa_aplic_05ml_0605502657: consData.jeringa_aplic_05ml_0605502657,
              aguja_0600403711: consData.aguja_0600403711
            } : null
          }
        };
      }
      case "listmynotifications": {
        const usuario = String(USER?.usuario || "").trim();

        console.log(`[Notif] Cargando buzón personal de ${usuario}...`);

        // 1. Consultar mi buzón personal (notificaciones_perfil + JOIN notificaciones)
        const { data: misBuzon, error: buzonErr } = await supabase
          .from('notificaciones_perfil')
          .select('id, notificacion_id, status, read_ts, notificacion:notificaciones(*)')
          .eq('usuario', usuario)
          .eq('deleted', false)
          .order('created_at', { ascending: false })
          .limit(300);

        if (buzonErr) {
          console.error(`[Notif] Error al cargar buzón:`, buzonErr);
          throw buzonErr;
        }

        console.log(`[Notif] Items en buzón:`, misBuzon?.length || 0);

        // 2. Mapear al formato esperado por el frontend
        const items = (misBuzon || [])
          .filter(np => np.notificacion) // Filtrar refs huérfanas
          .map(np => {
            const n = np.notificacion;
            const finalStatus = np.status || 'UNREAD';
            const finalIsRead = finalStatus === 'READ' ? 'SI' : 'NO';
            return Object.assign({}, n, {
              status: finalStatus,
              is_read: finalIsRead,
              read_ts: np.read_ts,
              type: n.type || n.tipo || 'INFO'
            });
          });

        // 3. Ordenar por fecha descendente
        items.sort((a, b) => {
          const da = new Date(a.created_ts || 0);
          const db = new Date(b.created_ts || 0);
          return db - da;
        });

        const unreadCount = items.filter(n => String(n.status).toUpperCase() !== 'READ').length;
        console.log(`[Notif] Lista final: ${items.length} items, ${unreadCount} no leídas`);

        return {
          ok: true,
          data: {
            items: items,
            unread: unreadCount
          }
        };
      }

      case "biogetform": {
        const role = String(USER?.rol || "").toUpperCase();
        const clues = String(USER?.clues || "").trim();
        const today = todayYmdLocal();

        let query = supabase.from('biologicos_params').select('*').eq('activo', 'SI');
        if (clues && clues !== "QTSSA012154") {
          query = query.eq('clues', clues);
        } else {
          query = query.eq('clues', '*');
        }

        try {
          const [resParams, resCalendar] = await Promise.all([
            query,
            supabase.from('calendario_pedidos').select('*').eq('anio_mes', today.substring(0, 7)).eq('activo', 'SI')
          ]);

          if (resParams.error) console.warn("[biogetform] params warning:", resParams.error);
          if (resCalendar.error) console.warn("[biogetform] calendar warning:", resCalendar.error);

          // Lógica de ventana: Primero calendario, luego inteligente
          const now = new Date();
          let intelligentWindow = calculateBioIntelligentWindow(now.getFullYear(), now.getMonth());
          let windowSource = "DYNAMIC";

          if (resCalendar.data && resCalendar.data.length > 0) {
            const cal = resCalendar.data[0];
            intelligentWindow = {
              start: new Date(cal.habilitar_desde),
              target: new Date(cal.fecha_programada),
              end: new Date(cal.habilitar_hasta)
            };
            windowSource = "CALENDAR";
          }

          const windowStartYmd = dateToLocalYmd(intelligentWindow.start);
          const windowTargetYmd = dateToLocalYmd(intelligentWindow.target);
          const windowEndYmd = dateToLocalYmd(intelligentWindow.end);
          const hoyYmd = todayYmdLocal();

          const canCaptureLocal = hoyYmd >= windowStartYmd && hoyYmd <= windowEndYmd;
          const isCaptureDayLocal = hoyYmd === windowTargetYmd;

          // Consulta de pedidos existentes (Robusta para legacy dentro de la misma ventana)
          const resSaved = await supabase.from('biologicos_pedido')
            .select('*')
            .eq('clues', clues || 'NOT_FOUND')
            .or(`fecha_pedido_programada.eq.${windowTargetYmd},and(fecha_captura.gte.${windowStartYmd},fecha_captura.lte.${windowEndYmd},tipo_pedido.in.(MENSUAL,null))`)
            .order('timestamp', { ascending: false });

          if (resSaved.error) console.warn("[biogetform] saved warning:", resSaved.error);

          const savedMap = {};
          if (resSaved.data) {
            resSaved.data.forEach(item => {
              savedMap[item.biologico] = item;
            });
          }

          const mappedRows = (resParams.data || []).map(p => {
            const savedItem = savedMap[p.biologico];
            return {
              biologico: p.biologico,
              multiplo: p.multiplo,
              min_dosis: p.min_dosis,
              max_dosis: p.max_dosis,
              promedio_frascos: p.promedio_frascos,
              existencia_actual_frascos: savedItem ? savedItem.existencia_actual_frascos : null,
              pedido_frascos: savedItem ? savedItem.pedido_frascos : null
            };
          });

          return {
            ok: true,
            data: {
              rows: mappedRows,
              hasSavedBio: resSaved.data && resSaved.data.length > 0,
              isCaptureDay: isCaptureDayLocal,
              fechaPedidoProgramada: windowTargetYmd,
              captureWindowStart: windowStartYmd,
              captureWindowEnd: windowEndYmd,
              windowSource: windowSource
            }
          };
        } catch (err) {
          console.error("[Supabase CRITICAL] biogetform crash:", err);
          return { ok: false, error: "Error de conexión con parámetros de biológicos" };
        }
      }

      case "admincaptureoverview": {
        const { fecha, tipo } = payload;

        // Calcular rango de fechas
        const dateObj = new Date(`${fecha}T12:00:00`);
        let fIniStr = fecha;
        let fFinStr = fecha;

        if (tipo === "SR" || tipo === "CONS") {
          const day = dateObj.getDay();
          const diffToMonday = day === 0 ? -6 : 1 - day;
          const monday = new Date(dateObj);
          monday.setDate(dateObj.getDate() + diffToMonday);
          const sunday = new Date(monday);
          sunday.setDate(monday.getDate() + 6);
          fIniStr = dateToLocalYmd(monday);
          fFinStr = dateToLocalYmd(sunday);
        } else if (tipo === "BIO") {
          const firstDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
          const lastDay = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0);
          fIniStr = dateToLocalYmd(firstDay);
          fFinStr = dateToLocalYmd(lastDay);
        }

        // 🛡️ Aplicar Jerarquía en el catálogo de unidades para el resumen
        const role = String(USER?.rol || "").toUpperCase();
        let unitsQuery = supabase.from('unidades').select('*').eq('activo', 'SI');

        // 🛡️ Logística de Ventanas: Traemos también el calendario por si hay apertura manual
        const currentMonth = fIniStr.substring(0, 7); // YYYY-MM

        const [resSR, resBio, resUnits, resCalendar, resCons] = await Promise.all([
          supabase.rpc('get_captures_sr_range_bypass', { p_fecha_inicio: fIniStr, p_fecha_fin: fFinStr }),
          supabase.rpc('get_captures_bio_range_bypass', { p_fecha_inicio: fIniStr, p_fecha_fin: fFinStr }),
          unitsQuery,
          supabase.from('calendario_pedidos').select('*').eq('anio_mes', currentMonth).eq('activo', 'SI').maybeSingle(),
          supabase.rpc('get_captures_cons_range_bypass', { p_fecha_inicio: fIniStr, p_fecha_fin: fFinStr })
        ]);

        let captureRecords = [];
        if (tipo === "SR") captureRecords = resSR.data || [];
        else if (tipo === "CONS") captureRecords = resCons.data || [];
        else if (tipo === "BIO") captureRecords = resBio.data || [];

        console.log(`[admincaptureoverview DEBUG] Registros de captura encontrados en DB para ${tipo}:`, captureRecords);

        // Agrupar fechas/tipos de pedidos si es BIO
        let availableWindows = [];
        let activeWindow = null;

        if (tipo === "BIO") {
          const windowsMap = new Map();
          captureRecords.forEach(r => {
            const wKey = `${r.tipo_pedido || 'MENSUAL'}_${r.fecha}`;
            if (!windowsMap.has(wKey)) {
              windowsMap.set(wKey, { tipo_pedido: r.tipo_pedido || 'MENSUAL', fecha: r.fecha });
            }
          });
          availableWindows = Array.from(windowsMap.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));

          if (availableWindows.length > 0) {
            // Si el frontend envia una ventana seleccionada (TODO en UI), usar esa
            // Por ahora, mostrar MENSUAL si hay, o la primera
            const targetWindow = payload.targetWindow;
            if (targetWindow) {
              activeWindow = availableWindows.find(w => w.fecha === targetWindow.fecha && w.tipo_pedido === targetWindow.tipo_pedido);
            }
            if (!activeWindow) {
              activeWindow = availableWindows.find(w => w.tipo_pedido === 'MENSUAL') || availableWindows[0];
            }

            // Filtrar captures solo para la ventana activa
            captureRecords = captureRecords.filter(r => r.fecha === activeWindow.fecha && (r.tipo_pedido || 'MENSUAL') === activeWindow.tipo_pedido);
          }
        }

        // Asegurarnos de mapear tanto .clues como .CLUES por seguridad, normalizados a mayúsculas
        let capturedClues = [...new Set(captureRecords.map(x => String(x.clues || x.CLUES || "").trim().toUpperCase()))];

        let allUnits = (resUnits.data || []).map(u => {
          if (u.unidad) {
            const upper = u.unidad.toUpperCase().trim();
            if (upper.includes("FELIPE NUÑEZ LARA") || upper.includes("ESPECIALIDADES DEL NIÑO Y LA MUJER")) {
              u.unidad = "HENM";
            }
          }
          if (u.UNIDAD) {
            const upper = u.UNIDAD.toUpperCase().trim();
            if (upper.includes("FELIPE NUÑEZ LARA") || upper.includes("ESPECIALIDADES DEL NIÑO Y LA MUJER")) {
              u.UNIDAD = "HENM";
            }
          }
          return u;
        });
        console.log(`[admincaptureoverview DEBUG] Unidades activas traídas desde BD: ${allUnits.length}`);
        // Filtramos localmente usando canSeeMunicipio_ para evitar fallos de acentos y mayúsculas en Supabase
        if (role === "MUNICIPAL") {
          allUnits = allUnits.filter(u => canSeeMunicipio_(USER, u.municipio));
          console.log(`[admincaptureoverview DEBUG] Unidades MUNICIPAL después de filtro: ${allUnits.length}`);
        } else if (role === "CARAVANAS") {
          allUnits = allUnits.filter(u => isCaravanaUnit_(u));
        }

        // Ordenar alfabéticamente por CLUES
        allUnits.sort((a, b) => {
          const cluesA = String(a.clues || a.CLUES || "").trim().toUpperCase();
          const cluesB = String(b.clues || b.CLUES || "").trim().toUpperCase();
          return cluesA.localeCompare(cluesB);
        });

        const capturadas = allUnits.filter(u => capturedClues.includes(String(u.clues || u.CLUES || "").trim().toUpperCase()));
        const faltantes = allUnits.filter(u => !capturedClues.includes(String(u.clues || u.CLUES || "").trim().toUpperCase()));

        return {
          ok: true,
          data: {
            fecha: fecha, // Mantenemos la fecha original que el usuario selecciono
            fIniStr,
            fFinStr,
            tipo,
            total_unidades: allUnits.length,
            total_capturadas: capturadas.length,
            total_faltantes: faltantes.length,
            calendar_override: resCalendar.data || null,
            available_windows: availableWindows,
            active_window: activeWindow,
            capturadas: capturadas.map(u => {
              const cClues = u.clues || u.CLUES;
              const record = captureRecords.find(r => (r.clues || r.CLUES) === cClues);

              let metadata = {
                municipio: u.municipio || u.MUNICIPIO,
                clues: cClues,
                unidad: u.unidad || u.UNIDAD,
                capturado_por: record?.capturado_por || record?.usuario || "SISTEMA",
                capturo: "SI",
                estatus: "OK"
              };

              if (tipo === "BIO") {
                metadata.tipo_pedido = record?.tipo_pedido || "MENSUAL";
                metadata.sin_pedido = record?.sin_pedido || false;
              }
              if (tipo === "SR") {
                metadata.tiene_ceros = record?.tiene_ceros || false;
              }
              return metadata;
            }),
            faltantes: faltantes.map(u => ({
              municipio: u.municipio || u.MUNICIPIO,
              clues: u.clues || u.CLUES,
              unidad: u.unidad || u.UNIDAD,
              estatus: "PENDIENTE"
            }))
          }
        };
      }
      case "historymetrics": {
        const mes = payload.mes;
        if (!mes || mes === "undefined") {
          return { ok: true, data: { rows: [] } };
        }

        const role = String(USER?.rol || "").toUpperCase();
        let unitsQuery = supabase.from('unidades').select('*').eq('activo', 'SI');

        if (role === "UNIDAD") {
          unitsQuery = unitsQuery.eq('clues', USER.clues);
        }

        const { data: unitsData, error: unitsError } = await unitsQuery;
        if (unitsError) throw unitsError;

        let units = (unitsData || []).map(u => {
          if (u.unidad) {
            const upper = u.unidad.toUpperCase().trim();
            if (upper.includes("FELIPE NUÑEZ LARA") || upper.includes("ESPECIALIDADES DEL NIÑO Y LA MUJER")) {
              u.unidad = "HENM";
            }
          }
          if (u.UNIDAD) {
            const upper = u.UNIDAD.toUpperCase().trim();
            if (upper.includes("FELIPE NUÑEZ LARA") || upper.includes("ESPECIALIDADES DEL NIÑO Y LA MUJER")) {
              u.UNIDAD = "HENM";
            }
          }
          return u;
        });
        if (role === "MUNICIPAL") {
          units = units.filter(u => canSeeMunicipio_(USER, u.municipio));
        } else if (role === "CARAVANAS") {
          units = units.filter(u => isCaravanaUnit_(u));
        }
        const unitCluesSet = new Set(units.map(u => u.clues));

        const today = todayYmdLocal();
        const [yyyy, mm] = mes.split("-");
        const isCurrentMonth = today.startsWith(mes);

        const fechaInicio = `${mes}-01`;
        let fechaFin;
        if (isCurrentMonth) {
          fechaFin = today;
        } else {
          const date = new Date(yyyy, mm, 0);
          fechaFin = dateToLocalYmd(date);
        }

        const [resBio, resCons, resPedidos] = await Promise.all([
          supabase.from('biologicos_existencia').select('clues, fecha').gte('fecha', fechaInicio).lte('fecha', fechaFin),
          supabase.from('consumibles').select('clues, fecha').gte('fecha', fechaInicio).lte('fecha', fechaFin),
          supabase.from('biologicos_pedido').select('clues').gte('fecha_captura', fechaInicio).lte('fecha_captura', fechaFin).eq('tipo_pedido', 'MENSUAL')
        ]);

        const rawBioAll = resBio.data || [];
        const rawConsAll = resCons.data || [];
        const rawPedidosAll = resPedidos.data || [];

        const rawBio = rawBioAll.filter(r => unitCluesSet.has(r.clues));
        const rawCons = rawConsAll.filter(r => unitCluesSet.has(r.clues));
        const rawPedidos = rawPedidosAll.filter(r => unitCluesSet.has(r.clues));

        const getExpectedDates = (start, end, tipo) => {
          const dates = [];
          let curr = new Date(start + "T12:00:00");
          const stop = new Date(end + "T12:00:00");
          if (tipo === "BIO" && stop.getDay() === 4) {
            stop.setDate(stop.getDate() + 1);
          }
          while (curr <= stop) {
            const dow = curr.getDay();
            const ymd = dateToLocalYmd(curr);
            if (tipo === "CONS" && dow === 4) dates.push(ymd); // Jueves
            if (tipo === "BIO" && dow === 5) dates.push(ymd); // Viernes
            curr.setDate(curr.getDate() + 1);
          }
          return dates;
        };

        const expectedDatesCons = getExpectedDates(fechaInicio, fechaFin, "CONS");
        const expectedDatesBio = getExpectedDates(fechaInicio, fechaFin, "BIO");

        const metricsMap = {};
        units.forEach(u => {
          metricsMap[u.clues] = {
            municipio: u.municipio || u.MUNICIPIO,
            clues: u.clues || u.CLUES,
            unidad: u.unidad || u.UNIDAD,
            bio_semanas_ok: 0,
            cons_semanas_ok: 0,
            pedido_mensual: false,
            ultima_captura: "—"
          };
        });

        expectedDatesCons.forEach(targetJueves => {
          const dJue = new Date(`${targetJueves}T12:00:00`);
          const targetWindow = [targetJueves];
          if (isMexicanHoliday(dJue)) {
            const dMie = new Date(dJue);
            dMie.setDate(dJue.getDate() - 1);
            targetWindow.push(dateToLocalYmd(dMie));
          }
          units.forEach(u => {
            if (rawCons.some(r => r.clues === u.clues && targetWindow.includes(r.fecha))) {
              metricsMap[u.clues].cons_semanas_ok++;
            }
          });
        });

        expectedDatesBio.forEach(targetViernes => {
          const dVie = new Date(`${targetViernes}T12:00:00`);
          const dJue = new Date(dVie); dJue.setDate(dVie.getDate() - 1);
          const targetWindow = [targetViernes, dateToLocalYmd(dJue)];

          units.forEach(u => {
            if (rawBio.some(r => r.clues === u.clues && targetWindow.includes(r.fecha))) {
              metricsMap[u.clues].bio_semanas_ok++;
            }
          });
        });

        rawPedidos.forEach(r => {
          if (metricsMap[r.clues]) metricsMap[r.clues].pedido_mensual = true;
        });

        rawCons.concat(rawBio).forEach(r => {
          if (metricsMap[r.clues]) {
            if (metricsMap[r.clues].ultima_captura === "—" || r.fecha > metricsMap[r.clues].ultima_captura) {
              metricsMap[r.clues].ultima_captura = r.fecha;
            }
          }
        });

        // Helper to count total Thursdays/Fridays in month for historymetrics
        function getMonthTotalWeeksForDate(targetYm) {
          const year = parseInt(targetYm.substring(0, 4));
          const month = parseInt(targetYm.substring(5, 7)) - 1;
          const lastDay = new Date(year, month + 1, 0).getDate();
          let totalCons = 0;
          let totalBio = 0;
          for (let d = 1; d <= lastDay; d++) {
            const day = new Date(year, month, d).getDay();
            if (day === 4) totalCons++;
            if (day === 5) totalBio++;
          }
          return { totalCons, totalBio };
        }

        const totalMonthWeeks = getMonthTotalWeeksForDate(mes);
        const totalMonthCons = totalMonthWeeks.totalCons || 4;
        const totalMonthBio = totalMonthWeeks.totalBio || 4;

        let rows = units.map(u => {
          const m = metricsMap[u.clues];

          // Target Base: total month requirements
          const denominatorBio = totalMonthBio;
          const denominatorCons = totalMonthCons;

          const bPct = denominatorBio > 0 ? (m.bio_semanas_ok / denominatorBio) * 100 : 100;
          const cPct = denominatorCons > 0 ? (m.cons_semanas_ok / denominatorCons) * 100 : 100;

          let pPct = m.pedido_mensual ? 100 : 0;
          let isPedidoRequired = false;
          const dToday = new Date(today + "T12:00:00");
          const midMonth = new Date(`${mes}-15T12:00:00`);

          if (!isCurrentMonth || dToday >= midMonth) {
            isPedidoRequired = true;
          }

          let score = 0;
          if (isPedidoRequired) {
            score = (bPct * 0.4) + (cPct * 0.4) + (pPct * 0.2);
          } else {
            score = (bPct * 0.5) + (cPct * 0.5);
          }

          score = Math.round(score);

          let tier = "riesgo";
          if (score === 100) tier = "diamante";
          else if (score >= 90) tier = "oro";
          else if (score >= 80) tier = "plata";
          else if (score >= 70) tier = "bronce";
          else if (score >= 60) tier = "acero";
          else if (score >= 50) tier = "jade";

          return {
            ...m,
            score,
            tier,
            eBio: totalMonthBio,
            eCons: totalMonthCons,
            isPedidoRequired
          };
        });

        rows.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          if (a.ultima_captura !== b.ultima_captura) {
            return a.ultima_captura < b.ultima_captura ? 1 : -1;
          }
          return a.unidad.localeCompare(b.unidad);
        });

        return { ok: true, data: { rows, role } };
      }
      case "unitstatus": {
        const today = todayYmdLocal();
        const clues = USER.clues;
        const role = (USER.rol || "UNIDAD").trim().toUpperCase();
        const userMuniStr = USER.municipio || "";

        // 1. Verificar Apertura Manual (Consumibles)
        const { data: consOverride, error: consErr } = await supabase
          .from('aperturas_consumibles')
          .select('*')
          .eq('fecha', today)
          .eq('activo', 'SI')
          .maybeSingle();

        if (consErr) console.warn("[Supabase] Fallo al consultar aperturas_consumibles:", consErr);

        // 1.5 Verificar Apertura Manual (Existencia Semanal)
        const { data: extOverride, error: extErr } = await supabase
          .from('aperturas_existencia')
          .select('*')
          .eq('fecha', today)
          .eq('activo', 'SI')
          .maybeSingle();

        if (extErr) console.warn("[Supabase] Fallo al consultar aperturas_existencia:", extErr);

        // 2. Verificar Apertura Manual (Biológicos - Calendario Pedidos)
        const currentMonth = today.substring(0, 7);
        const { data: bioOverride } = await supabase
          .from('calendario_pedidos')
          .select('*')
          .eq('anio_mes', currentMonth)
          .eq('activo', 'SI')
          .maybeSingle();

        // 3. Lógica Inteligente (Días festivos / Fines de semana)
        const consIntelligent = await getConsumiblesStatus(today, clues);
        const dow = new Date().getDay();
        
        let canCaptureExistenciaBioStandard = false;
        const hoyDate = new Date();
        const d_dow = hoyDate.getDay();
        if (d_dow === 4 || d_dow === 5) {
             canCaptureExistenciaBioStandard = true;
        } else if (d_dow === 3) {
             const jueDate = new Date(hoyDate); jueDate.setDate(hoyDate.getDate() + 1);
             const vieDate = new Date(hoyDate); vieDate.setDate(hoyDate.getDate() + 2);
             if (isMexicanHoliday(jueDate) && isMexicanHoliday(vieDate)) {
                 canCaptureExistenciaBioStandard = true; // Open on Wednesday
             }
        }

        const bioWindow = calculateBioIntelligentWindow(new Date().getFullYear(), new Date().getMonth());
        const isBioWindowOpen = today >= dateToLocalYmd(bioWindow.start) && today <= dateToLocalYmd(bioWindow.end);

        // 4. Consolidar Respuestas de Apertura
        let canCons = consIntelligent.canCaptureConsumibles;
        let consReason = consIntelligent.consumiblesReason || "Disponible solo jueves";

        if (consOverride) {
          canCons = true;
          consReason = consOverride.motivo || "Apertura extraordinaria habilitada por Administrador";
        }

        let canBio = canCaptureExistenciaBioStandard || isBioWindowOpen;
        let bioReason = isBioWindowOpen ? "Ventana de pedido mensual abierta" : (canCaptureExistenciaBioStandard ? "Día operativo (Jueves/Viernes)" : "Disponible jueves y viernes");

        if (extOverride) {
          canBio = true;
          bioReason = extOverride.motivo || "Apertura semanal extraordinaria habilitada por Administrador";
        } else if (bioOverride) {
          const isTodayInBioWindow = today >= bioOverride.habilitar_desde && today <= bioOverride.habilitar_hasta;
          if (isTodayInBioWindow) {
            canBio = true;
            bioReason = bioOverride.motivo || "Apertura mensual extraordinaria habilitada por Administrador";
          }
        }

        // 5. CÁLCULO DE CUMPLIMIENTO MENSUAL
        let compliance_pct = 0;
        let municipal_avg = 0;
        let global_avg = 0;
        let userRank = undefined;
        let userTier = undefined;
        let unitDetails = null;

        try {
          const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
          const dateIter = new Date(startOfMonth);
          const endIter = new Date();
          const monthStartStr = dateToLocalYmd(startOfMonth);

          let expectedSR = 0;
          let expectedCons = 0;

          while (dateIter <= endIter) {
            if (isBusinessDay(dateIter)) expectedSR++;
            if (dateIter.getDay() === 4) expectedCons++;
            dateIter.setDate(dateIter.getDate() + 1);
          }

          const totalExpectedPerUnit = expectedSR + expectedCons;

          // Fetch all active units and their captures for the month
          const [resUnits, resBio, resCons, resPedidos] = await Promise.all([
            supabase.from('unidades').select('clues, unidad, municipio').eq('activo', 'SI'),
            supabase.from('biologicos_existencia').select('clues, fecha').gte('fecha', monthStartStr).lte('fecha', today),
            supabase.from('consumibles').select('clues, fecha').gte('fecha', monthStartStr).lte('fecha', today),
            supabase.from('biologicos_pedido').select('clues').gte('fecha_captura', monthStartStr).lte('fecha_captura', today).eq('tipo_pedido', 'MENSUAL')
          ]);

          const units = resUnits.data || [];
          const rawBio = resBio.data || [];
          const rawCons = resCons.data || [];
          const rawPedidos = resPedidos.data || [];

          // Helper to count the total Thursdays (CONS) and Fridays (BIO) in the current month
          function getMonthTotalExpectedWeeks(dateStr) {
            const year = parseInt(dateStr.substring(0, 4));
            const month = parseInt(dateStr.substring(5, 7)) - 1;
            const lastDay = new Date(year, month + 1, 0).getDate();
            let totalCons = 0;
            let totalBio = 0;
            for (let d = 1; d <= lastDay; d++) {
              const day = new Date(year, month, d).getDay();
              if (day === 4) totalCons++;
              if (day === 5) totalBio++;
            }
            return { totalCons, totalBio };
          }

          const totalMonthWeeks = getMonthTotalExpectedWeeks(today);
          const totalMonthCons = totalMonthWeeks.totalCons || 4;
          const totalMonthBio = totalMonthWeeks.totalBio || 4;

          const expectedDatesCons = getExpectedDatesList(monthStartStr, today, "CONS");
          const expectedDatesBio = getExpectedDatesList(monthStartStr, today, "BIO");

          function getExpectedDatesList(start, end, tipo) {
            const dates = [];
            let curr = new Date(start + "T12:00:00");
            const stop = new Date(end + "T12:00:00");
            if (tipo === "BIO" && stop.getDay() === 4) {
              stop.setDate(stop.getDate() + 1);
            }
            while (curr <= stop) {
              const dow = curr.getDay();
              const ymd = dateToLocalYmd(curr);
              if (tipo === "CONS" && dow === 4) dates.push(ymd);
              if (tipo === "BIO" && dow === 5) dates.push(ymd);
              curr.setDate(curr.getDate() + 1);
            }
            return dates;
          }

          const metricsMap = {};
          units.forEach(u => {
            metricsMap[u.clues] = {
              clues: u.clues,
              municipio: u.municipio,
              unidad: u.unidad,
              bio_semanas_ok: 0,
              cons_semanas_ok: 0,
              pedido_mensual: false
            };
          });

          expectedDatesCons.forEach(targetJueves => {
            const dJue = new Date(`${targetJueves}T12:00:00`);
            const targetWindow = [targetJueves];
            if (isMexicanHoliday(dJue)) {
              const dMie = new Date(dJue);
              dMie.setDate(dJue.getDate() - 1);
              targetWindow.push(dateToLocalYmd(dMie));
            }
            units.forEach(u => {
              if (rawCons.some(r => r.clues === u.clues && targetWindow.includes(r.fecha))) {
                metricsMap[u.clues].cons_semanas_ok++;
              }
            });
          });

          expectedDatesBio.forEach(targetViernes => {
            const dVie = new Date(`${targetViernes}T12:00:00`);
            const dJue = new Date(dVie); dJue.setDate(dVie.getDate() - 1);
            const targetWindow = [targetViernes, dateToLocalYmd(dJue)];

            // Lógica Inteligente para Feriados (Existencia Biológico)
            if (isMexicanHoliday(dVie) && isMexicanHoliday(dJue)) {
               const dMie = new Date(dJue);
               dMie.setDate(dJue.getDate() - 1);
               targetWindow.push(dateToLocalYmd(dMie));
            }

            units.forEach(u => {
              if (rawBio.some(r => r.clues === u.clues && targetWindow.includes(r.fecha))) {
                metricsMap[u.clues].bio_semanas_ok++;
              }
            });
          });

          rawPedidos.forEach(r => {
            if (metricsMap[r.clues]) metricsMap[r.clues].pedido_mensual = true;
          });

          const isCurrentMonth = today.startsWith(currentMonth);
          const dToday = new Date(today + "T12:00:00");
          const midMonth = new Date(`${currentMonth}-15T12:00:00`);
          const isPedidoRequired = !isCurrentMonth || dToday >= midMonth;

          let unitScores = units.map(u => {
            const m = metricsMap[u.clues];

            // PROGRESSIVE COMPLIANCE DENOMINATOR: Use the entire month's total requirements as the target base
            const denominatorBio = totalMonthBio;
            const denominatorCons = totalMonthCons;

            const bPct = denominatorBio > 0 ? (m.bio_semanas_ok / denominatorBio) * 100 : 100;
            const cPct = denominatorCons > 0 ? (m.cons_semanas_ok / denominatorCons) * 100 : 100;
            const pPct = m.pedido_mensual ? 100 : 0;

            let score = 0;
            // The score is calculated as a cumulative percentage towards the total month target (no default 100% on day 1)
            if (isPedidoRequired) {
              score = Math.round((bPct * 0.4) + (cPct * 0.4) + (pPct * 0.2));
            } else {
              // Before mid-month, Pedido is not required, so we scale the 2 weekly captures to 50% each
              score = Math.round((bPct * 0.5) + (cPct * 0.5));
            }
            if (score > 100) score = 100;

            let tier = "riesgo";
            if (score === 100) tier = "diamante";
            else if (score >= 90) tier = "oro";
            else if (score >= 80) tier = "plata";
            else if (score >= 70) tier = "bronce";
            else if (score >= 60) tier = "acero";
            else if (score >= 50) tier = "jade";

            return {
              clues: u.clues,
              municipio: u.municipio,
              score,
              tier
            };
          });

          // Calculate Global Average
          const globalSum = unitScores.reduce((sum, item) => sum + item.score, 0);
          global_avg = unitScores.length > 0 ? Math.round(globalSum / unitScores.length) : 0;

          // Group by municipality to calculate averages
          const muniGroups = {};
          unitScores.forEach(item => {
            const muni = String(item.municipio || "OTROS").trim().toUpperCase();
            if (!muniGroups[muni]) muniGroups[muni] = { sum: 0, count: 0 };
            muniGroups[muni].sum += item.score;
            muniGroups[muni].count++;
          });

          const muniList = Object.keys(muniGroups).map(m => {
            const score = Math.round(muniGroups[m].sum / muniGroups[m].count);
            let tier = "riesgo";
            if (score === 100) tier = "diamante";
            else if (score >= 90) tier = "oro";
            else if (score >= 80) tier = "plata";
            else if (score >= 70) tier = "bronce";
            else if (score >= 60) tier = "acero";
            else if (score >= 50) tier = "jade";
            return {
              municipio: m,
              score,
              tier
            };
          }).sort((a, b) => b.score - a.score);

          const selectedMuni = (payload.selectedMunicipio || "").trim().toUpperCase();

          if (role === "UNIDAD") {
            const userUnit = unitScores.find(u => u.clues === clues);
            compliance_pct = userUnit ? userUnit.score : 0;
            userTier = userUnit ? userUnit.tier : "riesgo";

            // Find rank among all units
            unitScores.sort((a, b) => b.score - a.score);
            userRank = unitScores.findIndex(u => u.clues === clues) + 1;
            if (userRank === 0) userRank = undefined;

            const myMuni = String(USER.municipio || "").trim().toUpperCase();
            const muniInfo = muniList.find(m => m.municipio === myMuni);
            municipal_avg = muniInfo ? muniInfo.score : 0;

            const m = metricsMap[clues];
            if (m) {
              unitDetails = {
                bio_ok: m.bio_semanas_ok,
                cons_ok: m.cons_semanas_ok,
                bio_expected: expectedDatesBio.length,
                cons_expected: expectedDatesCons.length,
                pedido_mensual: m.pedido_mensual,
                is_pedido_required: isPedidoRequired
              };
            }

          } else if (role === "CARAVANAS") {
            const caravanScores = unitScores.filter(item => {
              const u = units.find(x => x.clues === item.clues);
              return isCaravanaUnit_(u);
            });
            const caravanSum = caravanScores.reduce((sum, item) => sum + item.score, 0);
            compliance_pct = caravanScores.length > 0 ? Math.round(caravanSum / caravanScores.length) : 0;
            
            let tier = "riesgo";
            if (compliance_pct === 100) tier = "diamante";
            else if (compliance_pct >= 90) tier = "oro";
            else if (compliance_pct >= 80) tier = "plata";
            else if (compliance_pct >= 70) tier = "bronce";
            else if (compliance_pct >= 60) tier = "acero";
            else if (compliance_pct >= 50) tier = "jade";
            userTier = tier;
            userRank = undefined;
            municipal_avg = compliance_pct;

          } else {
            // MUNICIPAL, ADMIN, JURISDICCIONAL
            let targetMuni = "";
            if (selectedMuni && selectedMuni !== "TODOS") {
              targetMuni = selectedMuni;
            } else if (role === "MUNICIPAL") {
              const allowed = Array.isArray(USER.municipiosAllowed) ? USER.municipiosAllowed : [];
              targetMuni = allowed.length > 0 ? allowed[0].toUpperCase() : userMuniStr.toUpperCase();
            }

            if (targetMuni) {
              const muniInfo = muniList.find(m => m.municipio === targetMuni);
              compliance_pct = muniInfo ? muniInfo.score : 0;
              userTier = muniInfo ? muniInfo.tier : "riesgo";
              municipal_avg = compliance_pct;
              userRank = muniList.findIndex(m => m.municipio === targetMuni) + 1;
              if (userRank === 0) userRank = undefined;
            } else {
              // Global average (ADMIN/JURISDICCIONAL with TODOS)
              compliance_pct = global_avg;
              userTier = undefined;
              userRank = undefined;
            }
          }

        } catch (e) {
          console.error("[unitstatus] Error calculando cumplimiento mensual:", e);
        }

        return {
          ok: true,
          data: {
            today: today,
            canCaptureConsumibles: canCons,
            consumiblesReason: consReason,
            consumiblesHolidayOverride: !!consIntelligent.consumiblesHolidayOverride,
            consumiblesManualOverride: !!consOverride,
            canCaptureBio: canBio,
            bioReason: bioReason,
            isExtraordinary: !!(consOverride || (bioOverride && today >= bioOverride.habilitar_desde && today <= bioOverride.habilitar_hasta)),
            compliance_pct,
            userRank,
            userTier,
            municipal_avg,
            global_avg,
            unitDetails
          }
        };
      }

      case "adminsetconsumiblesoverride": {
        if (USER.rol !== "ADMIN") throw new Error("No autorizado");
        const { fecha, motivo, enabled } = payload;

        if (enabled === "NO") {
          const { error } = await supabase.from('aperturas_consumibles').delete().eq('fecha', fecha || todayYmdLocal());
          if (error) throw error;
        } else {
          const { error } = await supabase.from('aperturas_consumibles').upsert({
            fecha: fecha || todayYmdLocal(),
            motivo: motivo || "APERTURA EXTRAORDINARIA",
            activo: 'SI',
            creado_por: USER.usuario,
            timestamp: new Date().toISOString()
          }, { onConflict: 'fecha' });
          if (error) throw error;
        }
        return { ok: true };
      }

      case "admingetconsumiblesoverride": {
        const { data, error } = await supabase
          .from('aperturas_consumibles')
          .select('*')
          .eq('activo', 'SI')
          .maybeSingle();
        if (error) throw error;
        return { ok: true, data };
      }

      case "adminsetexistenciaoverride": {
        if (USER.rol !== "ADMIN") throw new Error("No autorizado");
        const { fecha, motivo, enabled } = payload;

        if (enabled === "NO") {
          const { error } = await supabase.from('aperturas_existencia').delete().eq('fecha', fecha || todayYmdLocal());
          if (error) throw error;
        } else {
          const { error } = await supabase.from('aperturas_existencia').upsert({
            fecha: fecha || todayYmdLocal(),
            motivo: motivo || "APERTURA EXTRAORDINARIA",
            activo: 'SI',
            creado_por: USER.usuario,
            timestamp: new Date().toISOString()
          }, { onConflict: 'fecha' });
          if (error) throw error;
        }
        return { ok: true };
      }

      case "admingetexistenciaoverride": {
        const { data, error } = await supabase
          .from('aperturas_existencia')
          .select('*')
          .eq('activo', 'SI')
          .maybeSingle();
        if (error) throw error;
        return { ok: true, data };
      }

      case "unitcatalog": {
        const role = String(USER?.rol || "").toUpperCase();
        let query = supabase.from('unidades').select('*').order('municipio').order('clues');

        if (role === "UNIDAD") {
          query = query.eq('clues', USER.clues);
        }

        const { data, error } = await query;
        if (error) {
          console.error("[DB] Error en unitcatalog:", error);
          throw error;
        }

        let filteredData = data || [];
        if (role === "MUNICIPAL") {
          filteredData = filteredData.filter(u => canSeeMunicipio_(USER, u.municipio));
        } else if (role === "CARAVANAS") {
          filteredData = filteredData.filter(u => isCaravanaUnit_(u));
        }

        return { ok: true, data: filteredData };
      }

      case "biogetexportoptions": {
        const role = String(USER?.rol || "").toUpperCase();
        const { data, error } = await supabase.from('unidades').select('municipio, unidad');
        if (error) throw error;
        let filtered = data || [];
        if (role === "CARAVANAS") {
          filtered = filtered.filter(u => isCaravanaUnit_(u));
        } else {
          filtered = filtered.filter(m => canSeeMunicipio_(USER, m.municipio));
        }
        let uniqueMunis = [...new Set(filtered.map(u => u.municipio))].filter(Boolean).sort();

        return { ok: true, data: { municipios: uniqueMunis } };
      }

      case "export": {
        const role = String(USER?.rol || "").toUpperCase();
        const tipo = (payload.tipo || "SR").toUpperCase();
        const rpcName = tipo === "SR" ? "get_export_sr_range_bypass" : "get_export_cons_range_bypass";

        const { data, error } = await supabase.rpc(rpcName, {
          p_fecha_inicio: payload.fechaInicio,
          p_fecha_fin: payload.fechaFin
        });

        if (error) throw error;

        let filteredData = data || [];
        if (role === "UNIDAD") {
          filteredData = filteredData.filter(row => row.clues === USER.clues);
        }
        if (role === "MUNICIPAL") {
          filteredData = filteredData.filter(row => canSeeMunicipio_(USER, row.municipio));
        } else if (role === "CARAVANAS") {
          filteredData = filteredData.filter(row => isCaravanaUnit_(row));
        }

        return { ok: true, data: filteredData };
      }

      case "bioexportmatrix": {
        const role = String(USER?.rol || "").toUpperCase();

        const { data, error } = await supabase.rpc("get_export_bio_range_bypass", {
          p_fecha_inicio: payload.fechaInicio,
          p_fecha_fin: payload.fechaFin
        });

        if (error) throw error;

        let filteredData = data || [];

        if (role === "UNIDAD") {
          filteredData = filteredData.filter(row => row.clues === USER.clues);
        }
        if (role === "MUNICIPAL") {
          filteredData = filteredData.filter(row => canSeeMunicipio_(USER, row.municipio));
        } else if (role === "CARAVANAS") {
          filteredData = filteredData.filter(row => isCaravanaUnit_(row));
        }

        const requestedMunis = (payload.municipios || []).map(m => String(m).toUpperCase());
        const filtered = requestedMunis.length > 0
          ? filteredData.filter(d => requestedMunis.includes(String(d.municipio || "").toUpperCase()))
          : filteredData;

        return { ok: true, data: filtered };
      }

      case "listpinol": {
        let query = supabase
          .from('pinol_solicitudes')
          .select('*')
          .order('timestamp_solicitud', { ascending: false });

        if (USER.rol === 'UNIDAD') {
          query = query.eq('clues', USER.clues);
        } else if (USER.rol === 'CARAVANAS') {
          return { ok: true, data: [] };
        } else if (USER.rol === 'MUNICIPAL' || USER.rol === 'JURISDICCIONAL') {
          const mList = Array.isArray(USER?.municipiosAllowed) ? USER.municipiosAllowed : [];
          if (mList.length > 0) {
            query = query.in('municipio', mList);
          } else if (USER.municipio) {
            query = query.eq('municipio', USER.municipio);
          }
        }

        const { data, error } = await query;
        if (error) throw error;
        console.log(`[Supabase DEBUG] listPinol raw:`, data);

        // Mapeo alineado con el esquema SQL (database_schema.sql)
        const legacyData = (data || []).map(d => ({
          id: d.id,
          fecha_solicitud: d.timestamp_solicitud,
          municipio: d.municipio,
          clues: d.clues,
          unidad: d.unidad,
          existencia_actual_botellas: d.existencia_actual_botellas || 0,
          solicitud_botellas: d.solicitud_botellas || 0,
          observaciones: d.observaciones || "",
          capturado_por: d.capturado_por,
          estatus: d.estatus,
          fecha_entrega: d.fecha_entrega || d.timestamp_entrega,
          entregado_por: d.entregado_por,
          recibido_ts: d.recibido_ts
        }));

        return { ok: true, data: legacyData };
      }

      case "savepinol":
      case "pinolsolicitud": {
        const record = {
          id: btoa(USER.clues + ":" + Date.now()),
          timestamp_solicitud: new Date().toISOString(),
          fecha_solicitud: todayYmdLocal(),
          clues: USER.clues,
          unidad: USER.unidad,
          municipio: USER.municipio,
          existencia_actual_botellas: Number(payload.existencia_actual_botellas || payload.existencia || 0),
          solicitud_botellas: Number(payload.solicitud_botellas || payload.cantidad || payload.solicitud || 0),
          observaciones: payload.observaciones || payload.motivo || "",
          estatus: 'PENDIENTE',
          capturado_por: payload.nombre || USER.nombre || USER.usuario
        };
        const { error } = await supabase.from('pinol_solicitudes').insert(record);
        if (error) throw error;

        // La notificación se genera automáticamente en Supabase mediante Trigger (notify_admin_on_pinol)
        return { ok: true };
      }

      case "confirmpinolreceipt": {
        // El payload usa notification_id por compatibilidad heredada
        const { data: notif } = await supabase.from('notificaciones').select('*').eq('id', payload.notification_id).single();
        if (!notif) throw new Error("Notificación no encontrada");

        const meta = JSON.parse(notif.meta_json || "{}");
        const pinolId = meta.pinol_id;

        // 1. Marcar notificación maestro como confirmada (meta_json global)
        meta.confirmed_by_unit = "SI";
        meta.confirmation_ts = new Date().toISOString();

        await supabase
          .from('notificaciones')
          .update({ meta_json: JSON.stringify(meta) })
          .eq('id', payload.notification_id);

        // 2. Marcar MI copia como leída en notificaciones_perfil
        const { error: perfilError } = await supabase
          .from('notificaciones_perfil')
          .update({ status: 'READ', read_ts: new Date().toISOString() })
          .eq('notificacion_id', payload.notification_id)
          .eq('usuario', USER.usuario);

        if (perfilError) console.warn("[Notif] Error actualizando perfil:", perfilError);

        // 3. Marcar solicitud de Pinol como RECIBIDA
        if (pinolId) {
          const { error: pinolError } = await supabase
            .from('pinol_solicitudes')
            .update({
              estatus: 'RECIBIDO',
              recibido_ts: new Date().toISOString()
            })
            .eq('id', pinolId);
          if (pinolError) throw pinolError;
        }

        return { ok: true };
      }

      case "sendnotification": {
        // 🛡️ Corregir mapeo de campos: el frontend envía target_scope, target_municipio, etc.
        const record = {
          id: 'NOTIF:' + btoa((payload.target_clues || payload.clues || payload.target_usuario || payload.usuario_destino || 'SYS') + ":" + Date.now()),
          created_ts: new Date().toISOString(),
          created_date: todayYmdLocal(),
          from_usuario: USER.usuario,
          from_rol: USER.rol,
          target_scope: payload.target_scope || payload.scope || "GLOBAL",
          target_municipio: payload.target_municipio || payload.municipio || null,
          target_clues: payload.target_clues || payload.clues || null,
          target_usuario: payload.target_usuario || payload.usuario_destino || null,
          type: payload.type || 'INFO',
          title: payload.title || "Notificación",
          message: payload.message || "",
          status: 'UNREAD'
        };

        // 🛡️ Regla de Oro: Si se dirige a CLUES, auto-poblar municipio para que el MUNICIPAL lo vea
        if (record.target_scope === 'CLUES' && record.target_clues && !record.target_municipio) {
          const { data: u } = await supabase.from('unidades').select('municipio').eq('clues', record.target_clues).maybeSingle();
          if (u) record.target_municipio = u.municipio;
        }

        // 1. Insertar notificación maestra
        const { error } = await supabase.from('notificaciones').insert(record);
        if (error) throw error;

        // 2. Fan-out: crear copias individuales para cada destinatario
        const recipients = await resolveNotificationRecipients(record);
        await fanOutNotification(record.id, recipients);

        console.log(`[Notif] Notificación ${record.id} enviada a ${recipients.length} destinatarios`);
        return { ok: true };
      }

      case "marknotificationread": {
        // Per-profile: marcar SOLO mi copia como leída
        const { error } = await supabase
          .from('notificaciones_perfil')
          .update({ status: 'READ', read_ts: new Date().toISOString() })
          .eq('notificacion_id', payload.id)
          .eq('usuario', USER.usuario);
        if (error) throw error;
        return { ok: true };
      }

      case "resolvedesabasto": {
        // Obtenemos la notificación primero para actualizar meta_json
        const { data: notifDesab } = await supabase.from('notificaciones').select('meta_json').eq('id', payload.id).single();
        if (!notifDesab) throw new Error("Notificación no encontrada");

        let metaDesab = {};
        try { metaDesab = JSON.parse(notifDesab.meta_json || "{}"); } catch (e) { }
        metaDesab.status = "resuelta";

        // 1. Actualizar meta_json global (afecta visualización para todos)
        await supabase
          .from('notificaciones')
          .update({ meta_json: JSON.stringify(metaDesab) })
          .eq('id', payload.id);

        // 2. Marcar MI copia como leída en notificaciones_perfil
        const { error: errorDesab } = await supabase
          .from('notificaciones_perfil')
          .update({ status: 'READ', read_ts: new Date().toISOString() })
          .eq('notificacion_id', payload.id)
          .eq('usuario', USER.usuario);
        if (errorDesab) console.warn("[Notif] Error actualizando perfil desabasto:", errorDesab);
        return { ok: true };
      }

      case "deletenotification": {
        // Per-profile: soft-delete SOLO mi copia
        const { error: delError } = await supabase
          .from('notificaciones_perfil')
          .update({ deleted: true, deleted_ts: new Date().toISOString() })
          .eq('notificacion_id', payload.id)
          .eq('usuario', USER.usuario);
        if (delError) throw delError;
        return { ok: true };
      }

      case "admingetunitdetail": {
        const targetFecha = payload.fecha || todayYmdLocal();
        const tipo = (payload.tipo || "SR").toUpperCase();

        const dateObj = new Date(`${targetFecha}T12:00:00`);
        let fIniStr = targetFecha;
        let fFinStr = targetFecha;

        if (tipo === "SR" || tipo === "CONS") {
          const day = dateObj.getDay();
          const diffToMonday = day === 0 ? -6 : 1 - day;
          const monday = new Date(dateObj);
          monday.setDate(dateObj.getDate() + diffToMonday);
          const sunday = new Date(monday);
          sunday.setDate(monday.getDate() + 6);
          fIniStr = dateToLocalYmd(monday);
          fFinStr = dateToLocalYmd(sunday);
        } else if (tipo === "BIO") {
          const firstDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
          const lastDay = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0);
          fIniStr = dateToLocalYmd(firstDay);
          fFinStr = dateToLocalYmd(lastDay);
        }

        if (tipo === "SR") {
          const { data, error } = await window.supabase
            .from('existencia_detalle')
            .select('*')
            .eq('clues', payload.clues)
            .gte('fecha', fIniStr)
            .lte('fecha', fFinStr)
            .order('fecha', { ascending: false });
          if (error) throw error;

          let filteredData = [];
          if (data && data.length > 0) {
            const latestDate = data[0].fecha;
            filteredData = data.filter(r => r.fecha === latestDate);
            filteredData.sort((a, b) => (a.biologico || "").localeCompare(b.biologico || ""));
          }
          return { ok: true, data: filteredData, meta: { fecha: filteredData.length ? filteredData[0].fecha : targetFecha, tipo } };
        } else if (tipo === "BIO") {
          const { data, error } = await window.supabase
            .from('biologicos_pedido')
            .select('*')
            .eq('clues', payload.clues)
            .gte('fecha_pedido_programada', fIniStr)
            .lte('fecha_pedido_programada', fFinStr)
            .order('fecha_pedido_programada', { ascending: false });
          if (error) throw error;

          let filteredData = [];
          if (data && data.length > 0) {
            const latestDate = data[0].fecha_pedido_programada;
            filteredData = data.filter(r => r.fecha_pedido_programada === latestDate);
            filteredData.sort((a, b) => (a.biologico || "").localeCompare(b.biologico || ""));
          }
          return { ok: true, data: filteredData, meta: { fecha: filteredData.length ? filteredData[0].fecha_pedido_programada : targetFecha, tipo } };
        } else {
          const { data, error } = await window.supabase
            .from('consumibles')
            .select('*')
            .eq('clues', payload.clues)
            .gte('fecha', fIniStr)
            .lte('fecha', fFinStr)
            .order('fecha', { ascending: false })
            .limit(1);
          if (error) throw error;
          return { ok: true, data: data || [], meta: { fecha: data && data.length ? data[0].fecha : targetFecha, tipo } };
        }
      }

      case "adminlistusers": {
        const { data, error } = await supabase
          .from('perfiles')
          .select('*')
          .order('usuario', { ascending: true });
        if (error) throw error;
        return { ok: true, data: data || [] };
      }

      case "admincreateuser": {
        // 🛡️ Asegurar que enviamos el token de sesión actual para validación en la Edge Function
        const { data: { session } } = await supabase.auth.getSession();
        const sessionToken = session?.access_token || TOKEN || AppState.token;

        const { data, error } = await supabase.functions.invoke('admin-create-user', {
          body: {
            email: payload.email,
            usuario: payload.usuario,
            municipio: payload.municipio,
            clues: payload.clues,
            unidad: payload.unidad,
            rol: payload.rol
          },
          headers: {
            Authorization: `Bearer ${sessionToken}`
          }
        });

        if (error) {
          console.error("Edge Function Error Details:", error);
          let detailedMsg = error.message;

          // Intentar extraer el mensaje real del cuerpo de la respuesta (400)
          if (error.context && typeof error.context.json === 'function') {
            try {
              const body = await error.context.json();
              if (body && body.error) detailedMsg = body.error;
            } catch (e) {
              console.warn("No se pudo parsear el error de la función:", e);
            }
          }

          throw new Error(detailedMsg || "Error al comunicarse con la función de creación");
        }

        if (!data.ok) {
          throw new Error(data.error || "No se pudo crear el usuario");
        }

        return { ok: true, message: data.message };
      }

      case "uploadfile": {
        const file = payload.file;
        const { category, targetClues, targetUnidad, targetMunicipio } = payload;
        const role = String((USER && USER.rol) || "").trim().toUpperCase();

        let folderName = "";
        let fileName = "";
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const extension = file.name.split('.').pop().toLowerCase();

        // 🧼 Normalización de Nombres para Rutas Seguras
        const cleanUnit = normalizePath(targetUnidad || "SIN_UNIDAD").replace(/[\s\/]/g, '_');
        const cleanCategory = normalizePath(category || "OTROS").replace(/[\s\/]/g, '_');
        const clues = targetClues || USER.clues || "SIN_CLUES";

        if (category.toUpperCase().includes("SUPERVISI")) {
          // 🛡️ REGLA: SÓLO MUNICIPAL SUBE SUPERVISIONES
          if (role !== "MUNICIPAL" && role !== "ADMIN") throw new Error("Acceso denegado: Solo usuarios Municipales pueden subir supervisiones.");

          folderName = `Supervision/${clues}_${cleanUnit}`;
          fileName = `${dateStr}-EVIDENCIA-SUPERVISION-${clues}_${cleanUnit}.${extension}`;
        } else {
          // 🛡️ REGLA: SÓLO UNIDAD SUBE EVIDENCIAS/CAPACITACIONES
          if (role !== "UNIDAD" && role !== "ADMIN") throw new Error("Acceso denegado: Solo Unidades pueden subir evidencias.");

          folderName = `${cleanCategory}/${clues}_${cleanUnit}`;
          fileName = `${dateStr}-${cleanCategory}_${clues}_${cleanUnit}.${extension}`;
        }

        const folderPath = `${folderName}/${fileName}`.replace(/\/\//g, '/');

        const { error } = await supabase.storage.from('evidencias').upload(folderPath, file, {
          cacheControl: '3600',
          upsert: true,
          onUploadProgress: options.onUploadProgress
        });
        if (error) throw error;
        return { ok: true, data: { path: folderPath } };
      }

      case "listfiles": {
        const role = String((USER && USER.rol) || "").trim().toUpperCase();
        const userClues = String(USER?.clues || "");
        const userMunicipios = (USER?.municipio || "").split(",").map(m => m.trim().toUpperCase());
        const category = payload.category || "Evidencia_de_capacitaciones";

        let { data: filesData, error: filesErr } = await supabase.rpc('get_evidences_list_by_category', { category_name: category });
        if (filesErr) throw filesErr;

        // --- FILTRADO DE JERARQUÍA (Senior Logic) ---
        if (role === "ADMIN" || role === "JURISDICCIONAL") {
          // Acceso total
        } else if (role === "UNIDAD") {
          // Sólo ven lo de su CLUES
          filesData = filesData.filter(f => String(f.name || "").includes(userClues));
        } else if (role === "MUNICIPAL") {
          // 🛡️ Lógica de Visibilidad MUNICIPAL: Folder matching O CLUES matching
          // 1. Obtener CLUES permitidas para este supervisor
          const { data: allUnits } = await supabase.from('unidades').select('clues, municipio').eq('activo', 'SI');
          const allowedClues = (allUnits || [])
            .filter(u => canSeeMunicipio_(USER, u.municipio))
            .map(u => u.clues);

          filesData = filesData.filter(f => {
            const folderName = normalizeText(f.folder || "");
            const fileName = String(f.name || "");

            // Caso A: Carpeta coincide con municipio asignado (ej: Supervisiones)
            if (canSeeMunicipio_(USER, folderName)) return true;

            // Caso B: El nombre del archivo contiene una CLUES de mi municipio (ej: Evidencias de Unidades)
            return allowedClues.some(c => fileName.includes(c));
          });
        }

        return { ok: true, data: filesData || [] };
      }

      case "notificationusercatalog": {
        const { data, error } = await supabase
          .from('usuarios_legacy')
          .select('usuario, municipio, clues, unidad, rol')
          .eq('activo', 'SI')
          .order('usuario', { ascending: true });
        if (error) throw error;
        return { ok: true, data: data || [] };
      }

      case "silentadminreminders": {
        // No-op for now, or implement a simple check for pending tasks
        return { ok: true, data: [] };
      }

      case "batch": {
        const requests = payload.requests || [];
        const results = await Promise.all(requests.map(r => supabaseRequest(String(r.action || "").toLowerCase(), r)));
        return { ok: true, data: results };
      }

      case "adminresetpassword": {
        const { data: { session } } = await supabase.auth.getSession();
        const sessionToken = session?.access_token || TOKEN || AppState.token;

        const { data, error } = await supabase.functions.invoke('admin-reset-password', {
          body: {
            usuario: payload.usuario
          },
          headers: {
            Authorization: `Bearer ${sessionToken}`
          }
        });

        if (error) {
          console.error("Edge Function Error Details:", error);
          let detailedMsg = error.message;
          if (error.context && typeof error.context.json === 'function') {
            try {
              const body = await error.context.json();
              if (body && body.error) detailedMsg = body.error;
            } catch (e) { }
          }
          throw new Error(detailedMsg || "Error al comunicarse con la función de reset");
        }

        if (!data.ok) {
          throw new Error(data.error || "No se pudo resetear la contraseña");
        }

        return { ok: true, message: data.message };
      }
      case "admindeleteuser": {
        const { data: { session } } = await supabase.auth.getSession();
        const sessionToken = session?.access_token || TOKEN || AppState.token;

        const { data, error } = await supabase.functions.invoke('admin-delete-user', {
          body: {
            usuario: payload.usuario
          },
          headers: {
            Authorization: `Bearer ${sessionToken}`
          }
        });

        if (error) {
          console.error("Edge Function Error Details:", error);
          let detailedMsg = error.message;
          if (error.context && typeof error.context.json === 'function') {
            try {
              const body = await error.context.json();
              if (body && body.error) detailedMsg = body.error;
            } catch (e) { }
          }
          throw new Error(detailedMsg || "Error al comunicarse con la función de eliminación");
        }

        if (!data.ok) {
          throw new Error(data.error || "No se pudo eliminar el usuario");
        }

        return { ok: true, message: data.message };
      }

      case "adminsetactive": {
        const { error } = await supabase
          .from('usuarios_legacy')
          .update({ activo: payload.activo ? 'SI' : 'NO' })
          .eq('usuario', payload.usuario);
        if (error) throw error;
        return { ok: true };
      }

      case "markpinoldelivered": {
        const { error: updateError } = await supabase
          .from('pinol_solicitudes')
          .update({
            estatus: 'ENTREGADO',
            entregado_por: USER.usuario,
            timestamp_entrega: new Date().toISOString(),
            fecha_entrega: todayYmdLocal()
          })
          .eq('id', payload.id);

        if (updateError) throw updateError;

        // Auto-marcar como leída la solicitud inicial para MI perfil
        const reqNotifId = 'NOTIF:PINOL_REQ:' + payload.id;
        await supabase.from('notificaciones_perfil')
          .update({ status: 'READ', read_ts: new Date().toISOString() })
          .eq('notificacion_id', reqNotifId)
          .eq('usuario', USER.usuario)
          .catch(() => { });

        // Crear notificación para la unidad + fan-out
        const { data: sol } = await supabase.from('pinol_solicitudes').select('*').eq('id', payload.id).single();
        if (sol) {
          const pinolNotifRecord = {
            id: 'NOTIF:' + btoa(sol.clues + ":" + Date.now()),
            created_ts: new Date().toISOString(),
            created_date: todayYmdLocal(),
            from_usuario: USER.usuario,
            from_rol: USER.rol,
            target_scope: 'CLUES',
            target_clues: sol.clues,
            target_municipio: sol.municipio || null,
            type: 'SUCCESS',
            title: 'Pinol entregado',
            message: payload.comentario_notificacion || 'Tu solicitud de pinol ha sido marcada como entregada.',
            status: 'UNREAD',
            meta_json: JSON.stringify({ source: 'PINOL', event: 'PINOL_ENTREGADO', pinol_id: sol.id })
          };

          await supabase.from('notificaciones').insert(pinolNotifRecord);

          // Fan-out: crear copias individuales para cada destinatario
          const pinolRecipients = await resolveNotificationRecipients(pinolNotifRecord);
          await fanOutNotification(pinolNotifRecord.id, pinolRecipients);
          console.log(`[Notif] Pinol entregado → ${pinolRecipients.length} destinatarios`);
        }
        return { ok: true };
      }

      case "getlotesbymunicipio": {
        const { data, error } = await supabase.from('lotes').select('*');
        if (error) throw error;
        return { ok: true, data: data || [] };
      }

      case "savelotes": {
        const items = payload.lotes || [];
        // 1. Limpiar catálogo actual
        const { error: delError } = await supabase.from('lotes').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Borrar todo
        if (delError) throw delError;

        // 2. Insertar nuevos
        if (items.length) {
          const { error: insError } = await supabase.from('lotes').insert(items.map(it => ({
            biologico: it.biologico,
            lote: it.lote,
            caducidad: mmmaaToIsoDate(it.caducidad), // CONVERSIÓN PARA DB
            fecha_recepcion: it.fecha_recepcion || null,
            municipio: it.municipio || "*"
          })));
          if (insError) throw insError;
        }
        return { ok: true };
      }

      case "biogetdatesformonth": {
        const { month, year } = payload;
        if (!month || !year) throw new Error("Parámetros insuficientes");

        // 🛡️ Cálculo seguro del último día del mes (Evita April 31st error)
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const start = `${year}-${month.padStart(2, '0')}-01`;
        const end = `${year}-${month.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const { data, error } = await supabase
          .from('biologicos_pedido')
          .select('fecha_pedido_programada, tipo_pedido')
          .gte('fecha_pedido_programada', start)
          .lte('fecha_pedido_programada', end);

        if (error) throw error;

        // Agrupar por fecha_pedido_programada y obtener el tipo real
        const map = new Map();
        (data || []).forEach(d => {
          if (d.fecha_pedido_programada) {
            map.set(d.fecha_pedido_programada, d.tipo_pedido || "MENSUAL");
          }
        });

        const result = Array.from(map.entries()).map(([date, type]) => ({
          date,
          type
        })).sort((a, b) => a.date.localeCompare(b.date));

        return { ok: true, data: result };
      }

      case "adminsetbiooverride": {
        if (USER.rol !== "ADMIN") throw new Error("No autorizado");
        const { anio_mes, fecha_target, habilitar_desde, habilitar_hasta, motivo, activo } = payload;

        const { error } = await supabase
          .from('calendario_pedidos')
          .upsert({
            anio_mes,
            fecha_programada: fecha_target,
            habilitar_desde,
            habilitar_hasta,
            motivo,
            activo: activo || 'SI'
          });

        if (error) throw error;
        return { ok: true };
      }

      case "admintogglebioparam": {
        if (USER.rol !== "ADMIN") throw new Error("No autorizado");
        const { cluesList, vaccinesList, activo } = payload;

        // 1. Obtener información oficial de las unidades (para evitar nombres inconsistentes)
        const { data: unitsInfo } = await supabase
          .from('unidades')
          .select('clues, unidad, municipio')
          .in('clues', cluesList)
          .order('municipio')
          .order('clues');

        const unitMap = {};
        if (unitsInfo) {
          unitsInfo.forEach(u => unitMap[u.clues] = u);
        }

        // 2. Obtener parámetros existentes para estas CLUES y biológicos
        const { data: existingParams } = await supabase
          .from('biologicos_params')
          .select('id, clues, biologico')
          .in('clues', cluesList)
          .in('biologico', vaccinesList);

        const existingMap = {};
        if (existingParams) {
          existingParams.forEach(p => {
            existingMap[`${p.clues}|${p.biologico}`] = p.id;
          });
        }

        // 3. Procesar Cambios (Update si existe, Insert si no)
        const toUpdate = [];
        const toInsert = [];

        for (const c of cluesList) {
          const u = unitMap[c] || { unidad: 'UNIDAD DESCONOCIDA', municipio: '*' };
          for (const v of vaccinesList) {
            const key = `${c}|${v}`;
            if (existingMap[key]) {
              toUpdate.push(supabase.from('biologicos_params').update({
                activo: activo,
                unidad: u.unidad, // Aprovechamos para corregir el nombre si es inconsistente
                municipio: u.municipio
              }).eq('id', existingMap[key]));
            } else {
              toInsert.push({
                clues: c,
                biologico: v,
                activo: activo,
                unidad: u.unidad,
                municipio: u.municipio,
                max_dosis: 0,
                min_dosis: 0,
                promedio_frascos: 0,
                multiplo: 1
              });
            }
          }
        }

        // 4. Ejecutar Operaciones
        if (toUpdate.length) await Promise.all(toUpdate);
        if (toInsert.length) {
          const { error: insErr } = await supabase.from('biologicos_params').insert(toInsert);
          if (insErr) throw insErr;
        }

        console.log(`[Admin] Bio params toggled: ${toUpdate.length} updated, ${toInsert.length} inserted.`);
        return { ok: true };
      }

      case "requestpasswordreset": {
        const targetEmail = payload.email || payload.usuario || "";
        const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
          redirectTo: 'https://carlosgbd94-design.github.io/SIREVAQ/reset.html'
        });
        if (error) throw error;
        return { ok: true };
      }
      default:
        return _rawApiCall(payload);
    }
  } catch (err) {
    console.error(`[Supabase Error] ${action}:`, err);
    return { ok: false, error: err.message || String(err) };
  }
}

async function _dispatchBatch() {
  const queue = [...API_BATCH_QUEUE];
  API_BATCH_QUEUE = [];
  API_BATCH_TIMER = null;

  if (!queue.length) return;

  // Si solo hay una petición, la enviamos normal
  if (queue.length === 1) {
    const { body, resolve, reject } = queue[0];
    _rawApiCall(body).then(resolve).catch(reject);
    return;
  }

  // Petición agrupada
  const batchBody = {
    action: "batch",
    token: TOKEN,
    requests: queue.map(q => q.body)
  };

  try {
    const res = await _rawApiCall(batchBody);

    // 🛡️ DEGRADACIÓN GRÁCIL: Si el servidor no soporta batching, reintentamos uno por uno
    const err = String(res?.error || "");
    if (res && !res.ok && (err.includes("Acción inválida: batch") || err.includes("batch] @v2"))) {
      // En lugar de advertencia ruidosa, si estamos en migración podemos ser más discretos
      // console.warn("⚠️ Servidor en transición (Modo Batch no activo). Reintentando individualmente…");
      queue.forEach(q => {
        _rawApiCall(q.body).then(q.resolve).catch(q.reject);
      });
      return;
    }

    if (res.ok && Array.isArray(res.data)) {
      queue.forEach((q, i) => q.resolve(res.data[i] || { ok: false, error: "Sin respuesta interna" }));
    } else {
      queue.forEach(q => q.resolve(res)); // Error de dispatcher
    }
  } catch (e) {
    queue.forEach(q => q.reject(e));
  }
}

// 🛑 _rawApiCall y lógica de GAS eliminados por obsolescencia.
// Toda la comunicación ahora es 1:1 con Supabase vía AppService.


// ==========================================
// REGLAS DE NEGOCIO Y CALENDARIO (FASE 4)
// ==========================================


function parseDateYmd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getEasterSundayYmd(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDaysYmd(ymd, delta) {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return parseDateYmd(d);
}

function nthWeekdayOfMonthYmd(year, month, weekday, nth) {
  const first = new Date(`${year}-${String(month).padStart(2, "0")}-01T12:00:00`);
  const offset = (weekday - first.getDay() + 7) % 7;
  const day = 1 + offset + (nth - 1) * 7;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getMexicoHolidayMap(year) {
  const easter = getEasterSundayYmd(year);
  return {
    [`${year}-01-01`]: "Año Nuevo",
    [nthWeekdayOfMonthYmd(year, 2, 1, 1)]: "Constitución",
    [nthWeekdayOfMonthYmd(year, 3, 1, 3)]: "Natalicio de Benito Juárez",
    [addDaysYmd(easter, -3)]: "Jueves Santo",
    [addDaysYmd(easter, -2)]: "Viernes Santo",
    [`${year}-05-01`]: "Día del Trabajo",
    [`${year}-05-05`]: "Batalla de Puebla",
    [`${year}-09-16`]: "Independencia de México",
    [nthWeekdayOfMonthYmd(year, 11, 1, 3)]: "Revolución Mexicana",
    [`${year}-12-25`]: "Navidad"
  };
}

function isHolidayMx(ymd) {
  const year = parseInt(ymd.split("-")[0]);
  return !!getMexicoHolidayMap(year)[ymd];
}

function isWeekendMx(ymd) {
  const d = new Date(`${ymd}T12:00:00`);
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

function moveToBusinessDayMx(baseYmd, direction = -1) {
  let d = baseYmd;
  while (isWeekendMx(d) || isMexicanHoliday(new Date(`${d}T12:00:00`))) {
    d = addDaysYmd(d, direction);
  }
  return d;
}

function addBusinessDaysMx(baseYmd, count) {
  let d = baseYmd;
  let added = 0;
  const dir = count > 0 ? 1 : -1;
  while (added < Math.abs(count)) {
    d = addDaysYmd(d, dir);
    if (!isWeekendMx(d) && !isMexicanHoliday(new Date(`${d}T12:00:00`))) added++;
  }
  return d;
}

async function getConsumiblesStatus(todayYmd, clues) {
  const d = new Date(`${todayYmd}T12:00:00`);
  const dow = d.getDay(); // 0=Dom, 3=Mié, 4=Jue

  const isTodayHoliday = isMexicanHoliday(d);

  // Si hoy es Jueves
  if (dow === 4) {
    if (isTodayHoliday) {
      return { canCaptureConsumibles: true, consumiblesCaptureDate: todayYmd, consumiblesReason: "Jueves (Festivo habilitado)", consumiblesHolidayOverride: true };
    } else {
      return { isThursday: true, canCaptureConsumibles: true, consumiblesCaptureDate: todayYmd, consumiblesReason: "Jueves operativo" };
    }
  }

  // Si hoy es Miércoles
  if (dow === 3) {
    const tomorrow = new Date(d);
    tomorrow.setDate(d.getDate() + 1);
    if (isMexicanHoliday(tomorrow)) {
      return { canCaptureConsumibles: true, consumiblesCaptureDate: todayYmd, consumiblesReason: "Apertura anticipada por festivo jueves", consumiblesHolidayOverride: true };
    }
  }

  return { canCaptureConsumibles: false, consumiblesCaptureDate: "", consumiblesReason: "Disponible solo jueves" };
}


const CLIENT_CACHE_PREFIX = "JS1_CACHE::";

// 🛑 CACHE_TTL consolidado en la cabecera del archivo.

function buildCacheKey(scope, extra = "") {
  const userKey = USER && USER.usuario ? USER.usuario : "anon";
  return `${CLIENT_CACHE_PREFIX}${scope}::${userKey}::${extra}`;
}

function readCache(key, ttlMs) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const ts = Number(parsed.ts || 0);
    if (!ts) return null;

    const age = Date.now() - ts;
    if (age > ttlMs) {
      sessionStorage.removeItem(key);
      return null;
    }

    return parsed.data;
  } catch (e) {
    console.warn("readCache error:", key, e);
    return null;
  }
}

function writeCache(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify({
      ts: Date.now(),
      data
    }));
  } catch (e) {
    console.warn("writeCache error:", key, e);
  }
}

function dropCache(key) {
  try {
    sessionStorage.removeItem(key);
  } catch (e) {
    console.warn("dropCache error:", key, e);
  }
}

function dropCacheByPrefix(prefix) {
  try {
    const keysToDelete = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(prefix)) keysToDelete.push(k);
    }
    keysToDelete.forEach(k => sessionStorage.removeItem(k));
  } catch (e) {
    console.warn("dropCacheByPrefix error:", prefix, e);
  }
}

function clearSessionCaches() {
  dropCacheByPrefix(`${CLIENT_CACHE_PREFIX}`);
  INFLIGHT_FETCHES.clear();
  resetAllPanelFilterState();
}

function invalidateTodayCache() {
  dropCacheByPrefix(buildCacheKey("TODAY_REPORTS", ""));
  APP_STATE.todayCache = null;
  if (typeof TODAY_CACHE !== "undefined") TODAY_CACHE = null;
}

function invalidateCaptureOverviewCache() {
  dropCacheByPrefix(buildCacheKey("CAPTURE_OVERVIEW", ""));
}

function invalidateHistoryMetricsCache() {
  dropCacheByPrefix(buildCacheKey("HISTORY_METRICS", ""));
}

function invalidateUnitCatalogCache() {
  dropCacheByPrefix(buildCacheKey("UNIT_CATALOG", ""));
  UNIT_CATALOG = [];
}

function invalidatePinolCache() {
  dropCacheByPrefix(buildCacheKey("PINOL_LIST", ""));
}

function getPinolFlowStatus() {
  if (!USER || USER.rol !== "UNIDAD") return "NONE";
  const items = window._pinolCache || [];
  const myActive = items.filter(x =>
    String(x?.clues || "") === String(USER.clues) &&
    ["PENDIENTE", "ENTREGADO"].includes(String(x?.estatus || "").toUpperCase())
  );
  if (myActive.length === 0) return "NONE";
  const hasDelivered = myActive.some(x => String(x?.estatus || "").toUpperCase() === "ENTREGADO");
  if (hasDelivered) return "DELIVERED";
  return "PENDING";
}

function updatePinolFormBanner(status) {
  const banner = document.getElementById("pinolFlowBanner");
  if (!banner) return;
  if (status === "NONE") {
    banner.style.display = "none";
    banner.className = "";
    banner.innerHTML = "";
  } else if (status === "PENDING") {
    banner.style.display = "flex";
    banner.className = "pinol-flow-banner pending";
    banner.innerHTML = `
      <span class="material-symbols-rounded" style="font-size: 20px;">hourglass_empty</span>
      <div>
        Tu solicitud está en curso. El área municipal aún no ha surtido el insumo.
      </div>
    `;
  } else if (status === "DELIVERED") {
    banner.style.display = "flex";
    banner.className = "pinol-flow-banner delivered";
    banner.innerHTML = `
      <span class="material-symbols-rounded" style="font-size: 20px;">local_shipping</span>
      <div>
        El insumo fue enviado. Revisa tus notificaciones y marca como recibido para habilitar una nueva solicitud.
      </div>
    `;
  }
}

function applyPinolFormLock() {
  const status = getPinolFlowStatus();
  const form = document.getElementById("formPINOL");
  const btn = document.getElementById("btnSavePINOL");
  if (!form) return;

  const locked = (status !== "NONE");

  form.querySelectorAll("input, textarea, select").forEach(el => {
    el.disabled = locked;
    el.style.opacity = locked ? "0.5" : "1";
  });

  if (btn) {
    btn.disabled = locked;
    btn.style.display = "none"; // Always keep hidden as a proxy, using the Command Hub button instead
  }

  updatePinolFormBanner(status);
}


const INFLIGHT_FETCHES = new Map();

async function getCachedOrFetch({
  key,
  ttl,
  fetcher,
  shouldCache = (data) => data != null,
  forceRefresh = false
}) {
  if (!forceRefresh) {
    const cached = readCache(key, ttl);
    if (cached != null) {
      return cached;
    }
  }

  if (!forceRefresh && INFLIGHT_FETCHES.has(key)) {
    return INFLIGHT_FETCHES.get(key);
  }

  const pending = (async () => {
    try {
      const fresh = await fetcher();

      if (shouldCache(fresh)) {
        writeCache(key, fresh);
      }

      return fresh;
    } finally {
      INFLIGHT_FETCHES.delete(key);
    }
  })();

  INFLIGHT_FETCHES.set(key, pending);
  return pending;
}

function invalidateOpsCacheByPrefix(prefixes = []) {
  try {
    if (!Array.isArray(prefixes) || !prefixes.length) return;

    const keys = Object.keys(sessionStorage);

    keys.forEach(k => {
      if (prefixes.some(p => k.includes(p))) {
        sessionStorage.removeItem(k);
      }
    });

    for (const key of Array.from(INFLIGHT_FETCHES.keys())) {
      if (prefixes.some(p => key.includes(p))) {
        INFLIGHT_FETCHES.delete(key);
      }
    }

    console.log("🧹 Cache invalidado por prefijo:", prefixes);
  } catch (e) {
    console.warn("invalidateOpsCacheByPrefix error:", e);
  }
}

async function refreshAfterMutation(options = {}) {
  const {
    touchToday = false,
    touchCaptureSummary = false,
    touchHistory = false,
    touchPinol = false,
    touchBio = false
  } = options;

  resetOpsPrewarmFlags();

  if (touchToday) {
    invalidateTodayCache();
  }

  if (touchCaptureSummary) {
    invalidateCaptureOverviewCache();
  }

  if (touchHistory) {
    invalidateHistoryMetricsCache();
  }

  if (touchPinol) {
    invalidatePinolCache();
  }

  if (touchBio) {
    invalidateTodayCache();
  }

  try {
    if (touchToday) {
      const today = await getTodayReports(todayYmdLocal(), true);
      if (today) hydrateTodayForms(today);
    }

    if (touchCaptureSummary) {
      resetPanelFilterState("captureSummary");
      await reloadCaptureSummarySilent(true);
    }

    if (touchHistory) {
      resetPanelFilterState("historyMetrics");
      await reloadHistorySilent(true);
    }

    if (touchPinol) {
      try {
        await listPinol(true);
      } catch (e) { /* silent */ }
      applyPinolFormLock();
      syncCommandHub();

      if (typeof refreshPinolBadgeOnly === "function") {
        await refreshPinolBadgeOnly().catch(() => { });
      }

      const pinolPanelVisible =
        $("panelPINOLADMIN") &&
        $("panelPINOLADMIN").style.display !== "none";

      if (pinolPanelVisible && typeof refreshPinol === "function") {
        await refreshPinol().catch(() => { });
      }
    }

    if (touchBio) {
      if (typeof loadBioForm === "function") {
        await loadBioForm();
      }
    }

    if (touchCaptureSummary) {
      invalidateOpsCacheByPrefix(["CAPTURE_OVERVIEW"]);
      resetPanelFilterState("captureSummary");
    }

    if (touchHistory) {
      invalidateOpsCacheByPrefix(["HISTORY_METRICS"]);
      resetPanelFilterState("historyMetrics");
    }

    if (touchPinol) {
      invalidateOpsCacheByPrefix(["PINOL_LIST"]);
    }

    if (touchToday || touchBio) {
      invalidateOpsCacheByPrefix(["TODAY_REPORTS"]);
    }

    const role = String((USER && USER.rol) || "").trim().toUpperCase();
    const isOps = role === "ADMIN" || role === "MUNICIPAL" || role === "JURISDICCIONAL";

    if (isOps) {
      scheduleOpsPrewarm(260);
    }
  } catch (e) {
    console.error("refreshAfterMutation error:", e);
  }
}

let OPS_PREWARM_TIMER = null;
const OPS_PREWARM_DONE = {
  summary: false,
  history: false,
  pinol: false
};

function resetOpsPrewarmFlags() {
  OPS_PREWARM_DONE.summary = false;
  OPS_PREWARM_DONE.history = false;
  OPS_PREWARM_DONE.pinol = false;
}

function scheduleOpsPrewarm(delay = 220) {
  clearTimeout(OPS_PREWARM_TIMER);

  OPS_PREWARM_TIMER = setTimeout(() => {
    prewarmOpsData().catch((e) => {
      console.warn("prewarmOpsData warning:", e);
    });
  }, delay);
}

async function prewarmOpsData() {
  const role = String((USER && USER.rol) || "").trim().toUpperCase();
  const isOps = role === "ADMIN" || role === "MUNICIPAL" || role === "JURISDICCIONAL";
  if (!isOps || !TOKEN) return;

  const summaryFecha = $("summaryFecha")?.value || todayYmdLocal();
  const summaryTipo = $("summaryTipo")?.value || "SR";
  const histMes = $("histMesEvaluacion")?.value || todayYmdLocal().substring(0, 7);

  const jobs = [];

  if (!OPS_PREWARM_DONE.summary) {
    OPS_PREWARM_DONE.summary = true;
    jobs.push(
      getCaptureOverview(summaryFecha, summaryTipo, false).catch((e) => {
        OPS_PREWARM_DONE.summary = false;
        console.warn("Prewarm resumen falló:", e);
      })
    );
  }

  if (!OPS_PREWARM_DONE.history) {
    OPS_PREWARM_DONE.history = true;
    jobs.push(
      getHistoryMetrics(histMes, null, false).catch((e) => {
        OPS_PREWARM_DONE.history = false;
        console.warn("Prewarm history falló:", e);
      })
    );
  }

  if (!OPS_PREWARM_DONE.pinol) {
    OPS_PREWARM_DONE.pinol = true;
    jobs.push(
      listPinol(false).catch((e) => {
        OPS_PREWARM_DONE.pinol = false;
        console.warn("Prewarm pinol falló:", e);
      })
    );
  }

  await Promise.allSettled(jobs);
}

TOKEN = localStorage.getItem("JS1_TOKEN") || "";
USER = null;
let STATUS = null;
let UNIT_CATALOG = [];
let LIVE_TIMERS_STARTED = false;
let LIVE_TIMERS = [];

// LIVE_STATE está declarado globalmente para que esté disponible antes del login.

function initStaticAssets() {
  const a = $("logoA");
  const b = $("logoB");

  const assetA = String(`<?= LOGO_A ?>` || "").trim();
  const assetB = String(`<?= LOGO_B ?>` || "").trim();

  const fallbackA = "https://raw.githubusercontent.com/carlosgbd94-design/Logos/refs/heads/main/Seseq_vertical_2025.png";
  const fallbackB = "https://raw.githubusercontent.com/carlosgbd94-design/Logos/refs/heads/main/logo_nuevo.png";

  const safeA = assetA.startsWith("data:image/") ? assetA : fallbackA;
  const safeB = assetB.startsWith("data:image/") ? assetB : fallbackB;

  if (a) a.src = safeA;
  if (b) b.src = safeB;
}

function bindAuthUiEvents() {
  if ($("btnForgotPassword")) {
    $("btnForgotPassword").onclick = () => openForgotModal();
  }

  if ($("btnForgotClose")) {
    $("btnForgotClose").onclick = () => closeForgotModal();
  }

  if ($("btnForgotSend")) {
    $("btnForgotSend").onclick = () => requestPasswordResetFlow();
  }

  if ($("forgotUsuario")) {
    $("forgotUsuario").onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        requestPasswordResetFlow();
      }
    };
  }

  if ($("btnSaveMyPassword")) {
    $("btnSaveMyPassword").onclick = () => saveMyPasswordFlow();
  }

  if ($("btnPwdClose")) {
    $("btnPwdClose").onclick = () => closePasswordModal();
  }
}



function bindLiveFeedUiEvents() {
  if ($("btnClearLiveFeed")) {
    $("btnClearLiveFeed").onclick = () => {
      clearLiveFeed();
      showToast("Actividad reciente limpiada");
    };
  }
}

function bindToastUiEvents() {
  const btn = $("toastClose");
  if (!btn) return;

  btn.onclick = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    hideToastNow();
    return false;
  };
}

function bindNavigationUiEvents() {
  $("tabCAP")?.addEventListener("click", () => activateMain("CAP"));
  $("tabNOTIFS")?.addEventListener("click", () => activateMain("NOTIFS"));
  $("tabADMIN")?.addEventListener("click", () => activateMain("ADMIN"));

  $("tabOPS_CAPTURE")?.addEventListener("click", () => activateOpsTab("CAPTURE"));
  $("tabOPS_PINOL")?.addEventListener("click", () => activateOpsTab("PINOL"));
  $("tabOPS_HISTORY")?.addEventListener("click", () => activateOpsTab("HISTORY"));
  $("tabLOTES")?.addEventListener("click", () => activateOpsTab("LOTES"));

  $("tabSR")?.addEventListener("click", () => activateCapture("SR"));
  $("tabCONS")?.addEventListener("click", () => activateCapture("CONS"));
  $("tabBIO")?.addEventListener("click", () => activateCapture("BIO"));
  $("tabPINOL")?.addEventListener("click", () => activateCapture("PINOL"));

  $("btnLogout")?.addEventListener("click", async () => {
    showOverlay("Cerrando sesión...", "Desconectando");
    try {
      await window.supabase.auth.signOut();
    } catch (err) {
      console.warn("Error al cerrar sesión en Supabase:", err);
    }
    stopNotificationsAutoRefresh();
    clearSessionCaches();
    resetOpsPrewarmFlags();
    USER = null;
    TOKEN = null;
    clearSession();
    setLoggedOutUI();
    hideOverlay();
    showToast("Sesión cerrada");
  });
}
function bindSummaryUiEvents() {
  $("btnRefreshCaptureSummary")?.addEventListener("click", async () => {
    try {
      resetPanelFilterState("captureSummary");

      const data = await reloadCaptureSummarySilent(true);

      if (!data) {
        showToast("No se pudo cargar el resumen", false);
        return;
      }

      showToast("Resumen actualizado");
    } catch (e) {
      showToast("Error al actualizar resumen", false);
    }
  });

  $("summaryFecha")?.addEventListener("change", () => {
    OPS_PREWARM_DONE.summary = false;
    resetPanelFilterState("captureSummary");
    debouncedReloadCaptureSummary();
  });

  $("summaryTipo")?.addEventListener("change", () => {
    OPS_PREWARM_DONE.summary = false;
    resetPanelFilterState("captureSummary");
    debouncedReloadCaptureSummary();
  });
}

function bindMetricsUiEvents() {
  $("btnRefreshHistory")?.addEventListener("click", async () => {
    try {
      resetPanelFilterState("historyMetrics");

      const data = await reloadHistorySilent(true);

      if (data) showToast("Métricas actualizadas");
      else showToast("No se pudo actualizar histórico", false);
    } catch (e) {
      showToast("Error al actualizar histórico", false);
    }
  });

  $("histMesEvaluacion")?.addEventListener("change", () => {
    OPS_PREWARM_DONE.history = false;
    resetPanelFilterState("historyMetrics");
    debouncedReloadHistory();
  });

  $("histSepararMunicipio")?.addEventListener("change", () => {
    OPS_PREWARM_DONE.history = false;
    resetPanelFilterState("historyMetrics");
    debouncedReloadHistory();
  });

  $("histMunicipioFilter")?.addEventListener("change", () => {
    OPS_PREWARM_DONE.history = false;
    resetPanelFilterState("historyMetrics");
    debouncedReloadHistory();
    refreshConsumiblesStatusUi();
  });
}

function bindCaptureUtilityEvents() {
  const ids = ["jeringa_reconst_5ml_0605500438", "jeringa_aplic_05ml_0605502657"];
  ids.forEach(id => {
    const el = $(id);
    if (!el) return;
    if (el.dataset.syncAgujaBound === "1") return;
    el.dataset.syncAgujaBound = "1";
    el.addEventListener("input", syncAguja);
    el.addEventListener("change", syncAguja);
    el.addEventListener("blur", syncAguja);
  });
}

function runBootUiSetup() {
  setupPasswordToggles();
  applyLoginAutocomplete();
  applyCaptureNameAutocomplete();
  bindFastNumericFocus();
}

const debouncedReloadCaptureSummary = debounce(() => {
  reloadCaptureSummarySilent();
}, 220);

const debouncedReloadHistory = debounce(() => {
  reloadHistorySilent();
}, 220);



const PANEL_TASKS = new Map();

function runSinglePanelTask(panelKey, taskFn) {
  if (!panelKey || typeof taskFn !== "function") {
    return Promise.resolve(null);
  }

  if (PANEL_TASKS.has(panelKey)) {
    return PANEL_TASKS.get(panelKey);
  }

  const pending = Promise.resolve()
    .then(() => taskFn())
    .finally(() => {
      PANEL_TASKS.delete(panelKey);
    });

  PANEL_TASKS.set(panelKey, pending);
  return pending;
}

const PANEL_FILTER_STATE = {
  captureSummary: "",
  historyMetrics: ""
};

function buildCaptureSummaryFilterKey() {
  const fecha = $("summaryFecha")?.value || todayYmdLocal();
  const tipo = $("summaryTipo")?.value || "SR";
  return `${fecha}__${tipo}`;
}

function buildHistoryFilterKey() {
  const mes = $("histMesEvaluacion")?.value || todayYmdLocal().substring(0, 7);
  const selectedMuni = $("histMunicipioFilter")?.value || "TODOS";
  const separarMuni = $("histSepararMunicipio")?.checked ? "1" : "0";
  return `${mes}__${selectedMuni}__${separarMuni}`;
}

function shouldReloadPanelByFilters(panelName, nextKey, force = false) {
  if (force) return true;
  if (!nextKey) return true;
  return PANEL_FILTER_STATE[panelName] !== nextKey;
}

function commitPanelFilterState(panelName, appliedKey) {
  if (!panelName || !appliedKey) return;
  PANEL_FILTER_STATE[panelName] = appliedKey;
}

function resetPanelFilterState(panelName) {
  if (!panelName) return;
  if (Object.prototype.hasOwnProperty.call(PANEL_FILTER_STATE, panelName)) {
    PANEL_FILTER_STATE[panelName] = "";
  }
}

function resetAllPanelFilterState() {
  Object.keys(PANEL_FILTER_STATE).forEach(k => {
    PANEL_FILTER_STATE[k] = "";
  });
}

function initAppShell() {
  initStaticAssets();
  bindAuthUiEvents();

  bindLiveFeedUiEvents();
  bindToastUiEvents();
  bindNavigationUiEvents();
  bindNotificationsUiEvents();
  bindSummaryUiEvents();
  bindMetricsUiEvents();
  bindCaptureUtilityEvents();
  runBootUiSetup();

  initialized: true
}

let OPS_BOOTSTRAP_PROMISE = null;

function bootstrapOpsUi() {
  if (OPS_BOOTSTRAP_PROMISE) return OPS_BOOTSTRAP_PROMISE;

  OPS_BOOTSTRAP_PROMISE = loadUnitCatalog()
    .then(() => {
      bindAdminAutocomplete();
    })
    .catch(err => console.error("loadUnitCatalog error:", err))
    .finally(() => {
      OPS_BOOTSTRAP_PROMISE = null;
    });

  return OPS_BOOTSTRAP_PROMISE;
}

function scheduleOpsPrewarmSafe(delay = 650) {
  clearTimeout(OPS_PREWARM_TIMER);

  OPS_PREWARM_TIMER = setTimeout(() => {
    prewarmOpsData().catch((e) => {
      console.warn("prewarmOpsData warning:", e);
    });
  }, delay);
}

async function runPostLoginInit(user) {

  const fechaHoy = todayYmdLocal();

  await Promise.all([
    getTodayReports(fechaHoy),
    loadNotifications({ silent: true }),
    getCaptureOverview(fechaHoy, "SR"),
    refreshPinolBadgeOnly?.()
  ]);

}

function stopRealtimeUX() {
  LIVE_TIMERS.forEach(id => clearInterval(id));
  LIVE_TIMERS = [];
  LIVE_TIMERS_STARTED = false;
  stopPublicClockTimer();
}

function canRunRealtime() {
  return !!TOKEN && !!USER && !document.hidden;
}

function deferPostLoginTask(task, delay = 0) {
  requestAnimationFrame(() => {
    setTimeout(() => {
      Promise.resolve()
        .then(task)
        .catch(err => console.error("deferPostLoginTask error:", err));
    }, delay);
  });
}




async function hydrateSessionUi(user, status, opts = {}) {
  exposeAppFns();
  assertCriticalFns();

  const {
    showSuccessToast = false,
    mustChangePassword = false
  } = opts;

  setLoggedInUI(user, status);
  showRightColumn(true);
  hideOverlay();
  window.MUST_CHANGE_PASSWORD = !!mustChangePassword;

  if (window.MUST_CHANGE_PASSWORD && typeof openPasswordModal === "function") {
    showToast("Debes cambiar tu contraseña para continuar", true, "warn");
    openPasswordModal(true);
  }

  // ✅ OPTIMIZACIÓN: Carga concurrente y agrupada
  // Al usar apiCall para múltiples cosas aquí, el API_BATCH_TIMER las agrupará en UN solo POST
  try {
    // ? Visibilidad de pestañas por Rol
    const isOps = user?.rol && ["ADMIN", "MUNICIPAL", "JURISDICCIONAL", "CARAVANAS"].includes(user.rol);
    const isLotesAdmin = user?.rol && ["ADMIN", "JURISDICCIONAL"].includes(user.rol);

    toggleEl("tabLOTES", isLotesAdmin, "flex");
    if (!isLotesAdmin) toggleEl("panelLOTES", false);

    // Lanzamos peticiones. El batcher las atrapará.
    const pLotes = loadBatchesForSession(user);
    const pReports = getTodayReports(todayYmdLocal(), true);
    const pStatus = status ? Promise.resolve(status) : apiCall("unitStatus");

    const [_, today, finalStatus] = await Promise.all([pLotes, pReports, pStatus]);

    if (finalStatus) setLoggedInUI(user, finalStatus); // Refrescar si no venía
    if (today) hydrateTodayForms(today);


    if (isOps) {
      const fechaHoy = todayYmdLocal();
      if ($("summaryFecha")) $("summaryFecha").value = fechaHoy;
      if ($("summaryTipo")) $("summaryTipo").value = "SR";

      // Estas también se agrupan
      const [summary] = await Promise.all([
        getCaptureOverview(fechaHoy, "SR"),
        refreshPinolBadgeOnly()
      ]);
      if (summary) renderCaptureSummary(summary);
    }
  } catch (e) {
    console.warn("Error en hidratación de sesión:", e);
  }

  if (showSuccessToast) showToast("Sesión iniciada correctamente");

  deferPostLoginTask(async () => {
    await loadNotifications({ silent: true });
    startNotificationsAutoRefresh();

    if (user && (user.rol === "ADMIN" || user.rol === "MUNICIPAL" || user.rol === "JURISDICCIONAL")) {
      await loadNotifUnitCatalog();
      refreshNotifScopeUi();
    }
  });
}


// --- EVENTOS BUSCADOR ---
document.addEventListener("input", (e) => {
  if (e.target.id === "loteSearchInput") {
    BATCH_SEARCH_QUERY = e.target.value;
    renderLotesAdmin();
  }
});

async function loadBatchesForSession(user) {
  if (!user) return;
  try {
    console.log("🟢 1. Cargando catálogos y lotes desde Supabase...");

    // Carga paralela de catálogos críticos
    const [lotesResult, catResult, configResult] = await Promise.all([
      apiCall("getLotesByMunicipio"),
      supabase.from('biologicos_catalogo').select('*').order('orden_biologico'),
      supabase.from('biologicos_params').select('*').eq('clues', user.clues || '*')
    ]);

    // 1. Lotes
    const allLotes = (lotesResult && lotesResult.ok && lotesResult.data) ? lotesResult.data : [];
    // FILTRO DE LOTES SEGURO Y ANTIMALCRIADEZ DE JS
    const userMuni = normalizeTextKey_(user.municipio || AppState.municipio);
    const seenLotes = new Set();
    UNIT_BATCHES = allLotes.filter(l => {
      let isMatch = false;
      if (AppState.rol === "ADMIN" || AppState.rol === "JURISDICCIONAL" || !AppState.municipio) {
        isMatch = true;
      } else if (l.municipio) {
        const loteMuni = normalizeTextKey_(l.municipio);
        isMatch = loteMuni === "*" || loteMuni === "TODOS" || loteMuni.includes(userMuni);
      }

      if (isMatch) {
        const uniqueKey = `${l.biologico}_${l.lote}`;
        if (!seenLotes.has(uniqueKey)) {
          seenLotes.add(uniqueKey);
          return true;
        }
      }
      return false;
    });

    // 2. Catálogo Maestro (Para integridad de exportación)
    FULL_BIO_CATALOG = (catResult && catResult.data) ? catResult.data : [];

    // 3. Configuración de Parámetros (Para validaciones y semaforización)
    CONFIG_BIOLOGICOS_CATALOG = (configResult && configResult.data) ? configResult.data : [];

    console.log(`🟢 Lotes filtrados: ${UNIT_BATCHES.length} | Catálogo: ${FULL_BIO_CATALOG.length} | Config: ${CONFIG_BIOLOGICOS_CATALOG.length}`);
  } catch (e) {
    console.error("🔴 ERROR CRÍTICO en carga de sesión:", e);
  }
}

// ==========================================
// ADMINISTRACIÓN DE LOTES
// ==========================================

function parseInputToIso(str) {
  if (!str) return null;
  const s = str.trim().toUpperCase();

  let d = null;
  const monthsMap = {
    'ENE': 0, 'FEB': 1, 'MAR': 2, 'ABR': 3, 'MAY': 4, 'JUN': 5,
    'JUL': 6, 'AGO': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DIC': 11
  };

  // Si tiene el formato ENE-25 o JUL-29
  if (/^[A-Z]{3}-\d{2}$/.test(s)) {
    const parts = s.split('-');
    const m = monthsMap[parts[0]];
    let y = parseInt(parts[1]);
    if (y < 100) y += 2000;
    d = new Date(y, m + 1, 0); // Último día del mes
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  } else {
    // Intentar detectar formatos comunes: 28/06/26, 28-06-26, 2026-06-28
    const parts = s.split(/[\/\-]/);
    if (parts.length === 3) {
      // Asumimos DD, MM, AA o AAAA
      let day, month, year;
      if (parts[0].length === 4) { // YYYY/MM/DD
        year = parseInt(parts[0]);
        month = parseInt(parts[1]) - 1;
        day = parseInt(parts[2]);
      } else { // DD/MM/YY o DD/MM/YYYY
        day = parseInt(parts[0]);
        month = parseInt(parts[1]) - 1;
        year = parseInt(parts[2]);
        if (year < 100) year += 2000;
      }
      d = new Date(year, month, day);
    }
  }

  if (d && !isNaN(d.getTime())) {
    const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
    const m = months[d.getMonth()];
    const y = String(d.getFullYear()).slice(-2);
    return `${m}-${y}`;
  }

  // Soporte para entradas cortas como 03/27 o 3-27
  const partsShort = s.split(/[\/\-]/);
  if (partsShort.length === 2) {
    const mIdx = parseInt(partsShort[0]) - 1;
    let yStr = partsShort[1];
    if (yStr.length === 4) yStr = yStr.slice(-2);
    const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
    if (mIdx >= 0 && mIdx < 12) {
      return `${months[mIdx]}-${yStr}`;
    }
  }

  return s; // Devolver original si no se pudo parsear
}

// Auto-uppercase para Lote y Caducidad
document.addEventListener("input", (e) => {
  if (e.target.id === "loteTxt" || e.target.id === "loteCad") {
    e.target.value = e.target.value.toUpperCase();
  }
});

// Auto-format para Caducidad
document.addEventListener("blur", (e) => {
  if (e.target.id === "loteCad") {
    const val = e.target.value;
    if (val) {
      const isoDate = parseInputToIso(val);
      if (isoDate) {
        e.target.dataset.iso = isoDate;
        e.target.value = formatToMmmAa(isoDate);
      } else {
        showToast("Formato de fecha inválido", false, "warn");
      }
    }
  }
}, true);


window.BIOS_LIST = [
  "BCG", "HEPATITIS B", "HEXAVALENTE", "DPT", "ROTAVIRUS",
  "NEUMOCÓCICA 13", "NEUMOCÓCICA 20", "SRP", "SR", "VPH",
  "VARICELA", "HEPATITIS A", "TD", "TDPA", "COVID-19", "INFLUENZA", "VSR"
];
window.LoteEditingIdx = null;

async function activateLotesAdmin() {
  showOverlay("Cargando catálogo de lotes…", "Lotes");
  try {
    const sel = $("loteBio");
    if (sel) {
      sel.innerHTML = window.BIOS_LIST.map(b => `<option value="${b}">${b}</option>`).join("");
    }

    await refreshLotesAdmin();
  } finally {
    hideOverlay();
  }
}

async function refreshLotesAdmin() {
  const res = await apiCall({ action: "getLotesByMunicipio", token: TOKEN, all: true });
  if (res && res.ok) {
    BATCH_CATALOG = res.data || [];
    renderLotesAdmin();
  }
}

function renderLotesAdmin() {
  const tbody = $("lotesAdminTbody");
  if (!tbody) return;

  // MEJORA LOGÍSTICA SENIOR: Dashboard de Resumen
  updateLogisticsSummary();

  if (!BATCH_CATALOG.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Sin lotes cargados.</td></tr>`;
    return;
  }

  // Aplicar Filtro Pro
  let filtered = BATCH_CATALOG;
  if (BATCH_FILTER === 'critical') filtered = BATCH_CATALOG.filter(x => getExpiryLogistics(x.caducidad).level >= 3 && getExpiryLogistics(x.caducidad).level < 5);
  if (BATCH_FILTER === 'alert') filtered = BATCH_CATALOG.filter(x => getExpiryLogistics(x.caducidad).level === 2);
  if (BATCH_FILTER === 'safe') filtered = BATCH_CATALOG.filter(x => getExpiryLogistics(x.caducidad).level === 1);
  if (BATCH_FILTER === 'expired') filtered = BATCH_CATALOG.filter(x => getExpiryLogistics(x.caducidad).level === 5);

  // 2. Aplicar Búsqueda Inteligente (Lote/Bio)
  let finalFiltered = filtered;
  if (BATCH_SEARCH_QUERY) {
    const query = BATCH_SEARCH_QUERY.toLowerCase().trim();
    finalFiltered = filtered.filter(x =>
      String(x.lote || "").toLowerCase().includes(query) ||
      String(x.biologico || "").toLowerCase().includes(query)
    );
  }

  if (!finalFiltered.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted" style="padding:24px;">No se encontraron resultados para "${BATCH_SEARCH_QUERY || BATCH_FILTER}".</td></tr>`;
    return;
  }

  tbody.innerHTML = finalFiltered.map((item) => {
    const idx = BATCH_CATALOG.indexOf(item);
    const expiryInfo = getExpiryLogistics(item.caducidad);

    if (window.LoteEditingIdx === idx) {
      return `
        <tr class="lote-row-edit" style="background: rgba(79, 140, 255, 0.05);">
          <td>
            <select id="editBio_${idx}" class="inline-edit-input">
              ${window.BIOS_LIST.map(b => `<option value="${b}" ${item.biologico === b ? 'selected' : ''}>${b}</option>`).join("")}
            </select>
            <div style="font-size:10px; opacity:0.6; font-weight:600; margin-top:4px;">${escapeHtml(item.fecha_recepcion || "—")}</div>
          </td>
          <td>
            <input type="text" id="editLote_${idx}" class="inline-edit-input" value="${escapeHtml(item.lote)}" oninput="this.value = this.value.toUpperCase()" />
          </td>
          <td>
            <input type="text" id="editCad_${idx}" class="inline-edit-input" value="${escapeHtml(formatToMmmAa(item.caducidad))}" onblur="this.dataset.iso = parseInputToIso(this.value) || ''; this.value = formatToMmmAa(this.dataset.iso || this.value);" data-iso="${escapeHtml(item.caducidad)}" oninput="this.value = this.value.toUpperCase()" />
          </td>
          <td>
            <div class="status-pill warn" title="En edición"><span class="material-symbols-rounded" style="font-size:16px">edit</span>EDICIÓN</div>
          </td>
          <td style="font-weight:800; text-transform:uppercase; font-size:11px; letter-spacing:0.02em; color: var(--md-sys-color-on-surface-variant); opacity: 0.7;">
             ${escapeHtml(item.municipio)}
          </td>
          <td>
            <div style="display:flex; gap: 4px; justify-content:center;">
              <button type="button" class="md-edit-btn group save-btn" title="Guardar" onclick="saveLoteEdit(${idx})">
                <span class="material-symbols-rounded">check</span>
              </button>
              <button type="button" class="md-edit-btn group cancel-btn" title="Cancelar" onclick="cancelLoteEdit()">
                <span class="material-symbols-rounded">close</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }

    return `
        <tr class="lote-row-${expiryInfo.class}">
          <td>
            <div style="font-weight:900; color:var(--md-sys-color-primary);">${escapeHtml(item.biologico)}</div>
            <div style="font-size:10px; opacity:0.6; font-weight:600;">${escapeHtml(item.fecha_recepcion || "—")}</div>
          </td>
          <td style="font-family:monospace; font-weight:700; font-size:14px;">${escapeHtml(item.lote)}</td>
          <td>
             <div style="font-weight:900;">${escapeHtml(formatToMmmAa(item.caducidad))}</div>
             <div class="lote-life-container">
               <div class="lote-life-bar ${expiryInfo.class}" style="width: ${expiryInfo.progress}%"></div>
             </div>
          </td>
          <td>
            <div class="status-pill ${expiryInfo.class}" title="${expiryInfo.friendly}">
              <span class="material-symbols-rounded" style="font-size:16px">${expiryInfo.icon}</span>
              ${expiryInfo.label}
            </div>
          </td>
          <td style="font-weight:800; text-transform:uppercase; font-size:11px; letter-spacing:0.02em;">
             ${escapeHtml(item.municipio)}
          </td>
          <td>
            <div style="display:flex; gap: 4px; justify-content:center;">
              <button type="button" class="md-edit-btn group" title="Editar lote" onclick="startLoteEdit(${idx})">
                <span class="material-symbols-rounded" style="font-size: 20px;">edit</span>
              </button>
              <button type="button" class="md-delete-btn group" title="Eliminar este lote" onclick="openDeleteLoteModal(${idx})">
                <svg viewBox="0 0 24 24" class="w-6 h-6">
                  <path class="trash-lid transition-transform duration-200 group-hover:-translate-y-1" fill="currentColor" d="M15 4V3H9v1H4v2h16V4h-5z" />
                  <path fill="currentColor" d="M5 21a2 2 0 002 2h10a2 2 0 002-2V7H5v14zM8 9h2v10H8V9zm4 0h2v10h-2V9zm4 0h2v10h-2V9z" />
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
  }).join("");
}

function formatFriendlyTime(days) {
  if (days < 0) return "Expirado";
  if (days === 0) return "Vence hoy";
  if (days < 7) return `En ${days}d (Esta semana)`;

  const months = Math.floor(days / 30.44);
  const remainingDays = Math.floor(days % 30.44);

  if (months === 0) return `En ${days} días`;
  if (months === 1) return `En 1 mes${remainingDays > 0 ? ` y ${remainingDays}d` : ""}`;
  if (months < 12) return `En ${months} meses${remainingDays > 5 ? ` y ${remainingDays}d` : ""}`;

  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return `En ${years} año${years > 1 ? "s" : ""}${remMonths > 0 ? ` y ${remMonths}m` : ""}`;
}

function getExpiryLogistics(cadStr) {
  if (!cadStr || cadStr === "—") return { label: "N/A", class: "ok", icon: "check_circle", days: 999, level: 0 };

  const months = { "ENE": 0, "FEB": 1, "MAR": 2, "ABR": 3, "MAY": 4, "JUN": 5, "JUL": 6, "AGO": 7, "SEP": 8, "OCT": 9, "NOV": 10, "DIC": 11 };
  let expiryDate = null;

  // Soporte para formato ISO (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(cadStr)) {
    expiryDate = new Date(cadStr + "T00:00:00");
  } else {
    const parts = cadStr.split("-");
    if (parts.length !== 2) return { label: "ERROR", class: "bad", icon: "error", days: 0, level: 0 };
    const m = months[parts[0].toUpperCase()];
    const y = 2000 + parseInt(parts[1]);
    expiryDate = new Date(y, m + 1, 0); // Último día del mes
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalLifeDays = 730; // Aproximación de 2 años de vida útil para la barra de progreso
  const diffTime = expiryDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const friendly = formatFriendlyTime(diffDays);

  // Procentajes para la barra de progreso
  let progress = Math.max(0, Math.min(100, (diffDays / totalLifeDays) * 100));

  if (diffDays < 0) return { label: "CADUCADO", class: "bad", icon: "dangerous", days: diffDays, level: 5, friendly, progress: 0 };
  if (diffDays <= 30) return { label: `INMINENTE (${friendly})`, class: "bad imminent", icon: "emergency", days: diffDays, level: 4, friendly, progress };
  if (diffDays <= 90) return { label: `CRÍTICO (${friendly})`, class: "bad", icon: "warning", days: diffDays, level: 3, friendly, progress };
  if (diffDays <= 180) return { label: `ALERTA (${friendly})`, class: "warn", icon: "info", days: diffDays, level: 2, friendly, progress };

  return { label: `VIGENTE (${friendly})`, class: "ok", icon: "verified", days: diffDays, level: 1, friendly, progress };
}

function updateLogisticsSummary() {
  let summaryDiv = $("logisticsSummaryContainer");
  if (!summaryDiv) {
    const parent = $("formLOTES");
    if (!parent) return;
    summaryDiv = document.createElement("div");
    summaryDiv.id = "logisticsSummaryContainer";
    summaryDiv.className = "logistics-summary";
    // Insertar antes de la tabla (después de btnAddLoteRow container)
    const hr = parent.querySelector(".hr");
    if (hr) parent.insertBefore(summaryDiv, hr);
  }

  const summary = BATCH_CATALOG.reduce((acc, x) => {
    const exp = getExpiryLogistics(x.caducidad);
    if (exp.level === 5) acc.expired++;
    else if (exp.level >= 3) acc.critical++;
    else if (exp.level === 2) acc.alert++;
    else acc.safe++;
    return acc;
  }, { expired: 0, critical: 0, alert: 0, safe: 0 });

  summaryDiv.innerHTML = `
      <div class="premium-logistics-card filter-btn ${BATCH_FILTER === 'all' ? 'active' : ''}" onclick="setLoteFilter('all')">
        <div class="card-glow"></div>
        <div class="card-icon"><span class="material-symbols-rounded">inventory</span></div>
        <div class="card-content">
          <span class="val">${BATCH_CATALOG.length}</span>
          <span class="lbl">TOTAL LOTES</span>
        </div>
      </div>
      <div class="premium-logistics-card critical filter-btn ${BATCH_FILTER === 'critical' ? 'active' : ''}" onclick="setLoteFilter('critical')">
        <div class="card-glow" style="background: rgba(220, 38, 38, 0.4)"></div>
        <div class="card-icon"><span class="material-symbols-rounded">warning</span></div>
        <div class="card-content">
          <span class="val">${summary.critical}</span>
          <span class="lbl">CRÍTICO</span>
        </div>
      </div>
      <div class="premium-logistics-card alert filter-btn ${BATCH_FILTER === 'alert' ? 'active' : ''}" onclick="setLoteFilter('alert')">
        <div class="card-glow" style="background: rgba(217, 119, 6, 0.4)"></div>
        <div class="card-icon"><span class="material-symbols-rounded">notifications_active</span></div>
        <div class="card-content">
          <span class="val">${summary.alert}</span>
          <span class="lbl">EN ALERTA</span>
        </div>
      </div>
      <div class="premium-logistics-card expired filter-btn ${BATCH_FILTER === 'expired' ? 'active' : ''}" onclick="setLoteFilter('expired')">
        <div class="card-glow" style="background: rgba(127, 29, 29, 0.4)"></div>
        <div class="card-icon"><span class="material-symbols-rounded">dangerous</span></div>
        <div class="card-content">
          <span class="val">${summary.expired}</span>
          <span class="lbl">VENCIDOS</span>
        </div>
      </div>
    `;
}

window.setLoteFilter = function (filter) {
  BATCH_FILTER = filter;
  renderLotesAdmin();
};

// --- REDISEÑO LOTES 2.0: Acción Masiva de Municipios ---
document.addEventListener("click", (e) => {
  if (e.target.closest("#btnLoteSelectAll")) {
    document.querySelectorAll(".loteMuniChk").forEach(chk => chk.checked = true);
  }
  if (e.target.closest("#btnLoteClearAll")) {
    document.querySelectorAll(".loteMuniChk").forEach(chk => chk.checked = false);
  }
});

$("btnAddLoteRow")?.addEventListener("click", async () => {
  const biologico = $("loteBio").value;
  const rawLote = $("loteTxt").value.trim().toUpperCase();
  const rawCad = $("loteCad").value.trim().toUpperCase();

  // Obtener iso desde dataset o forzar parseo
  const caducidad = $("loteCad").dataset.iso || parseInputToIso(rawCad);
  const lote = rawLote;
  const fecha_recepcion = $("loteRec").value;

  // RECOLECCIÓN MULTIMUNICIPIO
  const selectedMunis = Array.from(document.querySelectorAll(".loteMuniChk:checked")).map(cb => cb.value);

  if (!lote || !caducidad) {
    showToast("Lote y caducidad son obligatorios", false, "warn");
    return;
  }

  if (selectedMunis.length === 0) {
    showToast("Selecciona al menos un municipio", false, "warn");
    return;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(caducidad)) {
    showToast("Formato de caducidad inválido.", false, "warn");
    return;
  }

  let addedCount = 0;
  let newLotes = [];
  selectedMunis.forEach(muni => {
    // VALIDACIÓN DE DUPLICADOS (Por Municipio)
    const exists = BATCH_CATALOG.find(x => x.biologico === biologico && x.lote === lote && x.municipio === muni);
    if (!exists) {
      const newLoteObj = { biologico, lote, caducidad, fecha_recepcion, municipio: muni };
      BATCH_CATALOG.push(newLoteObj);
      newLotes.push(newLoteObj);
      addedCount++;
    }
  });

  if (addedCount > 0) {
    // Autoguardar los lotes nuevos a Supabase
    await AppService.runCapture({
      btnId: "btnAddLoteRow",
      title: "Registrando Lotes",
      msg: "Sincronizando lote en el catálogo...",
      successMsg: selectedMunis.length > 1 ? `${addedCount} municipios asignados y guardados al lote` : "Lote registrado y guardado correctamente",
      eventTitle: "Alta de Lote(s)",
      eventMsg: "Lotes registrados y guardados en Supabase.",
      action: async () => {
        // AppService.call expects { lotes: [...] } for saving
        await AppService.call("savelotes", { lotes: newLotes });
      }
    });

    renderLotesAdmin();
  } else {
    showToast("El lote ya existe en los municipios seleccionados", false, "warn");
  }

  // Limpiar campos
  $("loteTxt").value = "";
  $("loteCad").value = "";
  $("loteCad").removeAttribute("data-iso");
  $("loteRec").value = "";

  document.querySelectorAll(".loteMuniChk").forEach(chk => chk.checked = false);
  $("loteTxt").focus();
});

window.startLoteEdit = function(idx) {
  window.LoteEditingIdx = idx;
  renderLotesAdmin();
}

window.cancelLoteEdit = function() {
  window.LoteEditingIdx = null;
  renderLotesAdmin();
}

window.saveLoteEdit = async function(idx) {
  const item = BATCH_CATALOG[idx];
  if (!item) return;

  const bioInput = document.getElementById(`editBio_${idx}`);
  const loteInput = document.getElementById(`editLote_${idx}`);
  const cadInput = document.getElementById(`editCad_${idx}`);

  const rawLote = loteInput.value.trim().toUpperCase();
  const rawCad = cadInput.dataset.iso || parseInputToIso(cadInput.value.trim().toUpperCase());

  if (!rawLote || !rawCad) {
    showToast("Lote y caducidad son obligatorios", false, "warn");
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawCad)) {
    showToast("Formato de caducidad inválido.", false, "warn");
    return;
  }

  // Update object
  item.biologico = bioInput.value;
  item.lote = rawLote;
  item.caducidad = rawCad;
  
  window.LoteEditingIdx = null;
  
  await AppService.runCapture({
    btnId: `editBio_${idx}`,
    title: "Actualizando",
    msg: "Sincronizando cambios del lote...",
    successMsg: "Lote actualizado correctamente",
    eventTitle: "Edición de Lote",
    eventMsg: "Lote editado y guardado en Supabase.",
    action: async () => {
      // Assuming saveLotes replaces or upserts the catalog
      await AppService.call("savelotes", { lotes: BATCH_CATALOG });
    }
  });

  renderLotesAdmin();
}

let pendingDeleteIdx = null;

window.openDeleteLoteModal = function(idx) {
  const item = BATCH_CATALOG[idx];
  if(!item) return;
  pendingDeleteIdx = idx;
  
  const msgEl = document.getElementById("deleteModalMsg");
  if(msgEl) {
    msgEl.innerHTML = `Estás a punto de eliminar el lote <strong>${item.lote}</strong> del biológico <strong>${item.biologico}</strong> en <strong>${item.municipio}</strong>. Esta acción no se puede deshacer.`;
  }
  
  const modal = document.getElementById("premiumDeleteModal");
  if(modal) {
    modal.style.display = 'flex'; // Overlay div display
  }
}

window.closeDeleteModal = function() {
  pendingDeleteIdx = null;
  const modal = document.getElementById("premiumDeleteModal");
  if(modal) modal.style.display = 'none';
}

window.confirmDeleteLote = async function () {
  if (pendingDeleteIdx === null) return;
  const idx = pendingDeleteIdx;
  const item = BATCH_CATALOG[idx];
  
  closeDeleteModal();

  BATCH_CATALOG.splice(idx, 1);
  
  await AppService.runCapture({
    title: "Eliminando",
    msg: "Actualizando catálogo...",
    successMsg: "Lote eliminado correctamente",
    action: () => AppService.call("savelotes", { lotes: BATCH_CATALOG })
  });
  
  renderLotesAdmin();
}

// ==========================================
// CAPTURA DINÁMICA DE BIOLÓGICOS (SR)
// ==========================================

function getShelfLifeClass(cad) {
  if (!cad) return "";
  let cadDate = null;

  // 1. Detectar formato ISO (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(cad)) {
    cadDate = new Date(cad + "T00:00:00"); // Forzar local
  }
  // 2. Detectar formato Legacy (MMM-YY)
  else {
    const parts = String(cad).split('-');
    if (parts.length === 2) {
      const monthsMap = {
        'ENE': 0, 'FEB': 1, 'MAR': 2, 'ABR': 3, 'MAY': 4, 'JUN': 5,
        'JUL': 6, 'AGO': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DIC': 11
      };
      const mStr = parts[0].toUpperCase();
      const yShort = parseInt(parts[1]);
      const mIdx = monthsMap[mStr];
      if (!isNaN(yShort) && mIdx !== undefined) {
        cadDate = new Date(2000 + yShort, mIdx, 1);
      }
    }
  }

  // Fallback si no se pudo parsear
  if (!cadDate || isNaN(cadDate.getTime())) return "";

  const today = new Date();
  const firstOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const diffMonths = (cadDate.getFullYear() - firstOfCurrentMonth.getFullYear()) * 12 + (cadDate.getMonth() - firstOfCurrentMonth.getMonth());

  if (diffMonths < 0) return "shelf-life-danger"; // Expirado
  if (diffMonths <= 3) return "shelf-life-danger"; // Crítico (<3 meses)
  if (diffMonths <= 6) return "shelf-life-warn";   // Alerta (<6 meses)
  return "shelf-life-ok";
}

function formatToMmmAa(cad) {
  if (!cad || cad === "—") return "—";
  let d = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(cad)) {
    d = new Date(cad + "T00:00:00");
  } else {
    const parts = String(cad).split('-');
    if (parts.length === 2 && parts[0].length === 3) return cad.toUpperCase();
    d = new Date(cad);
  }
  if (!d || isNaN(d.getTime())) return cad;
  const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  return `${months[d.getMonth()]}-${String(d.getFullYear()).substring(2)}`;
}

window.addSRRow = function (data = null) {
  const tbody = document.getElementById("srCaptureTbody");
  if (!tbody) return;
  const tr = document.createElement("tr");

  const biotics = [
    "BCG", "HEPATITIS B", "HEXAVALENTE", "DPT", "ROTAVIRUS",
    "NEUMOCÓCICA 13", "NEUMOCÓCICA 20", "SRP", "SR", "VPH",
    "VARICELA", "HEPATITIS A", "TD", "TDPA", "COVID-19", "INFLUENZA", "VSR"
  ];

  const bioOptions = biotics.map(b => `<option value="${b}" ${data?.biologico === b ? 'selected' : ''}>${b}</option>`).join("");

  tr.innerHTML = `
      <td class="p-4 py-3" data-label="Biológico">
        <select class="sr-bio-select w-full bg-slate-50 border-2 border-slate-400 rounded-xl px-3 py-2.5 text-[14px] font-black text-slate-900 focus:border-primary focus:bg-white focus:shadow-[0_4px_10px_rgba(0,51,102,0.08)] outline-none transition-all" onchange="handleSRBioChange(this)">
          <option value="">Selecciona…</option>
          ${bioOptions}
        </select>
      </td>
      <td class="p-4 py-3" data-label="Lote">
        <select class="sr-lote-select w-full bg-slate-50 border-2 border-slate-400 rounded-xl px-3 py-2.5 text-[14px] font-black text-slate-900 focus:border-primary focus:bg-white focus:shadow-[0_4px_10px_rgba(0,51,102,0.08)] outline-none transition-all" onchange="handleSRLoteChange(this)">
          <option value="">—</option>
        </select>
      </td>
      <td class="sr-cad-cell p-4 py-3 font-black text-[13px] text-slate-900/60" data-label="Caducidad">—</td>
      <td class="p-4 py-3" data-label="Recepción">
        <div class="relative group w-full">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-rounded text-slate-400 text-[18px] pointer-events-none transition-colors group-focus-within:text-primary">calendar_month</span>
          <input type="date" style="padding-left: 38px !important;" class="sr-recepcion-input w-full bg-slate-50 border-2 border-slate-400 rounded-xl pr-3 py-2 text-[14px] font-black text-slate-900 focus:border-primary focus:bg-white focus:shadow-[0_4px_10px_rgba(0,51,102,0.08)] outline-none transition-all" value="${data?.fecha_recepcion || ""}">
          <div class="sr-permanencia-hint" style="display: none;"></div>
        </div>
      </td>
      <td class="p-4 py-3" data-label="Frascos">
        <div class="relative group w-full flex items-center gap-1.5 touch-stepper-wrap">
          <button type="button" class="stepper-btn stepper-btn-minus" onclick="const inp=this.nextElementSibling.querySelector('input'); inp.value=Math.max(0, (parseInt(inp.value)||0)-1); inp.dispatchEvent(new Event('input', {bubbles:true})); inp.dispatchEvent(new Event('change', {bubbles:true}));">-</button>
          <div class="relative w-full">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-rounded text-slate-400 text-[18px] pointer-events-none transition-colors group-focus-within:text-primary">inventory_2</span>
            <input type="number" class="sr-cantidad-input w-full bg-slate-50 border-2 border-slate-400 rounded-xl pr-3 py-2.5 text-[14px] font-black text-slate-900 focus:border-primary focus:bg-white focus:shadow-[0_4px_10px_rgba(0,51,102,0.08)] outline-none transition-all" min="0" step="1" value="${data?.cantidad || ""}" placeholder="0">
          </div>
          <button type="button" class="stepper-btn stepper-btn-plus" onclick="const inp=this.previousElementSibling.querySelector('input'); inp.value=(parseInt(inp.value)||0)+1; inp.dispatchEvent(new Event('input', {bubbles:true})); inp.dispatchEvent(new Event('change', {bubbles:true}));">+</button>
        </div>
      </td>
      <td class="p-4 py-3 text-center" data-label="Acción">
        <div class="flex justify-center items-center w-full gap-2">
          <button type="button" class="md-clone-btn group text-slate-400 hover:text-primary transition-colors" title="Añadir fecha de recepción" onclick="cloneSRRow(this);">
            <span class="material-symbols-rounded text-[22px]">post_add</span>
          </button>
          <button type="button" class="md-delete-btn group" title="Eliminar este lote" onclick="this.closest('tr').remove();">
            <svg viewBox="0 0 24 24" class="w-6 h-6">
              <path class="trash-lid transition-transform duration-200 group-hover:-translate-y-1" fill="currentColor" d="M15 4V3H9v1H4v2h16V4h-5z" />
              <path fill="currentColor" d="M5 21a2 2 0 002 2h10a2 2 0 002-2V7H5v14zM8 9h2v10H8V9zm4 0h2v10h-2V9zm4 0h2v10h-2V9z" />
            </svg>
          </button>
        </div>
      </td>
    `;

  // Inyectar caché de DOM
  tr._cache = {
    bioSelect: tr.querySelector(".sr-bio-select"),
    loteSelect: tr.querySelector(".sr-lote-select"),
    cadCell: tr.querySelector(".sr-cad-cell"),
    recepcionInput: tr.querySelector(".sr-recepcion-input"),
    cantidadInput: tr.querySelector(".sr-cantidad-input"),
    permanenciaHint: tr.querySelector(".sr-permanencia-hint")
  };

  tbody.appendChild(tr);

  // Listener para actualización en tiempo real de permanencia
  tr._cache.recepcionInput.addEventListener("input", () => window.updatePermanenciaHint(tr));

  if (data) {
    window.handleSRBioChange(tr._cache.bioSelect, data.lote);
    window.updatePermanenciaHint(tr);
  }
}

window.cloneSRRow = function (btn) {
  const originalRow = btn.closest("tr");
  if (!originalRow) return;

  const bioSelect = originalRow.querySelector(".sr-bio-select");
  const loteSelect = originalRow.querySelector(".sr-lote-select");

  const data = {
    biologico: bioSelect ? bioSelect.value : "",
    lote: loteSelect ? loteSelect.value : "",
    fecha_recepcion: "",
    cantidad: ""
  };

  addSRRow(data);
  const tbody = document.getElementById("srCaptureTbody");
  const newRow = tbody.lastElementChild;

  originalRow.insertAdjacentElement('afterend', newRow);

  setTimeout(() => {
    const inputReq = newRow.querySelector(".sr-recepcion-input");
    if (inputReq) inputReq.focus();
  }, 100);
};

window.updatePermanenciaHint = function (tr) {
  const cache = tr._cache || {};
  const recInput = cache.recepcionInput || tr.querySelector(".sr-recepcion-input");
  const hint = cache.permanenciaHint || tr.querySelector(".sr-permanencia-hint");

  if (!recInput || !recInput.value || !hint) {
    if (hint) hint.style.display = "none";
    return;
  }

  const dRec = new Date(recInput.value);
  const now = new Date();
  dRec.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((now - dRec) / (1000 * 60 * 60 * 24));
  const limit = 90;
  const daysLeft = limit - diffDays;

  hint.classList.remove("hint-warn", "hint-bad");

  const formatTime = (totalDays) => {
    const d = Math.abs(totalDays);
    const m = Math.floor(d / 30);
    const rd = d % 30;
    let p = [];
    if (m > 0) p.push(`${m} ${m === 1 ? 'mes' : 'meses'}`);
    if (rd > 0) p.push(`${rd} ${rd === 1 ? 'día' : 'días'}`);
    return p.join(' ') || '0 días';
  };

  if (diffDays > limit) {
    hint.style.display = "inline-flex";
    hint.classList.add("hint-bad");
    hint.innerHTML = `<span class="material-symbols-rounded" style="font-size:12px">history_toggle_off</span> Excedido por ${formatTime(diffDays - limit)}`;
  } else if (diffDays >= 60) {
    hint.style.display = "inline-flex";
    hint.classList.add("hint-warn");
    hint.innerHTML = `<span class="material-symbols-rounded" style="font-size:12px">warning</span> Límite en ${formatTime(daysLeft)}`;
  } else {
    hint.style.display = "none";
  }
}

window.handleSRBioChange = function (selectEl, preselectLote = null) {
  const tr = selectEl.closest("tr");
  const cache = tr._cache || {};
  const bio = String(selectEl.value || "").trim().toUpperCase();

  const loteSelect = cache.loteSelect || tr.querySelector(".sr-lote-select");
  const cadCell = cache.cadCell || tr.querySelector(".sr-cad-cell");

  loteSelect.innerHTML = '<option value="">Selecciona lote…</option>';
  cadCell.textContent = "—";
  cadCell.className = "sr-cad-cell";

  if (!bio) return;

  const filtered = UNIT_BATCHES.filter(l =>
    String(l.biologico || "").trim().toUpperCase() === bio
  );

  if (!filtered.length) {
    loteSelect.innerHTML = '<option value="">SIN LOTES</option>';
    return;
  }

  filtered.forEach(l => {
    const opt = document.createElement("option");
    opt.value = l.lote;
    opt.textContent = l.lote;
    opt.dataset.cad = l.caducidad;
    opt.dataset.rec = l.fecha_recepcion || "";
    if (preselectLote === l.lote) opt.selected = true;
    loteSelect.appendChild(opt);
  });

  if (preselectLote || filtered.length === 1) {
    if (filtered.length === 1 && !preselectLote) loteSelect.selectedIndex = 1;
    window.handleSRLoteChange(loteSelect);
  }

  // Inyectar validación dinámica
  refreshSRValidation(tr);
}

function refreshSRValidation(tr) {
  const cache = tr._cache || {};
  const bioSelect = cache.bioSelect || tr.querySelector(".sr-bio-select");
  const cantidadInput = cache.cantidadInput || tr.querySelector(".sr-cantidad-input");
  const bio = String(bioSelect.value || "").trim().toUpperCase();
  const cantidad = Number(cantidadInput.value || 0);

  if (bio && cantidadInput.getAttribute("listener-bound") !== "1") {
    cantidadInput.addEventListener("input", () => refreshSRValidation(tr));
    cantidadInput.setAttribute("listener-bound", "1");
  }

  const config = CONFIG_BIOLOGICOS_CATALOG.find(c =>
    String(c.biologico).trim().toUpperCase() === bio
  );

  cantidadInput.classList.remove("input-warn", "input-bad", "input-good");
  tr.classList.remove("row-warn", "row-bad");

  if (!bio || isNaN(cantidad)) return;

  if (config) {
    const { promedio_frascos } = config;
    if (promedio_frascos > 0 && cantidad < (promedio_frascos * 0.5)) {
      cantidadInput.classList.add("input-warn");
      tr.title = `Stock bajo. Promedio: ${promedio_frascos}.`;
    } else if (promedio_frascos > 0 && cantidad > (promedio_frascos * 2)) {
      cantidadInput.classList.add("input-bad");
      tr.title = `Sobrestock. Promedio: ${promedio_frascos}.`;
    } else {
      cantidadInput.classList.add("input-good");
      tr.title = `Stock óptimo. Promedio: ${promedio_frascos}.`;
    }
  }
}


window.handleSRLoteChange = function (selectEl) {
  const tr = selectEl.closest("tr");
  const cache = tr._cache || {};
  const opt = selectEl.selectedOptions[0];
  const cadCell = cache.cadCell || tr.querySelector(".sr-cad-cell");
  const recInput = cache.recepcionInput || tr.querySelector(".sr-recepcion-input");
  const hint = cache.permanenciaHint || tr.querySelector(".sr-permanencia-hint");

  if (!opt || !opt.dataset.cad) {
    cadCell.textContent = "—";
    cadCell.className = "sr-cad-cell";
    if (hint) hint.style.display = "none";
    return;
  }

  const cad = opt.dataset.cad || "—";
  const rec = opt.dataset.rec || "";

  // ✅ Envolver en span para que se vea como pill centrado y formatear a MMM-YY
  const formattedCad = formatToMmmAa(cad);
  cadCell.innerHTML = `<span class="${getShelfLifeClass(cad)}">${formattedCad}</span>`;
  cadCell.className = "sr-cad-cell"; // Limpiar clases en el td

  if (recInput && !recInput.value && rec) {
    // recInput.value = rec; // Eliminado por solicitud de usuario: no arrojar fecha por default
  }

  // ✅ Actualizar semaforización de permanencia
  window.updatePermanenciaHint(tr);
}

$("btnAddSRRow")?.addEventListener("click", () => addSRRow());

function restoreUiFromState() {
  if (!APP_STATE || !APP_STATE.initialized) return;

  if (APP_STATE.mainPanel) {
    activateMain(APP_STATE.mainPanel);
  }

  const role = String((USER && USER.rol) || "").trim().toUpperCase();
  if (role === "UNIDAD" && APP_STATE.captureTab) {
    activateCapture(APP_STATE.captureTab);
  }

  const isOps = role === "ADMIN" || role === "MUNICIPAL" || role === "JURISDICCIONAL";
  if (isOps && APP_STATE.opsTab) {
    activateOpsTab(APP_STATE.opsTab);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initAppShell();
  paintPublicClock();
  startPublicClockTimer();

  // Scroll-aware sticky headers for tables and card lists
  document.addEventListener("scroll", (e) => {
    const wrap = e.target;
    if (wrap && wrap.classList && (wrap.classList.contains("tableWrap") || wrap.classList.contains("overflow-y-auto"))) {
      const isScrolled = wrap.scrollTop > 2;
      if (wrap.classList.contains("is-scrolled") !== isScrolled) {
        wrap.classList.toggle("is-scrolled", isScrolled);
      }
    }
  }, true); // Capture phase required for scroll events
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopRealtimeUX();
    stopNotificationsAutoRefresh();
    return;
  }

  if (TOKEN && USER) {
    startRealtimeUX();
    startNotificationsAutoRefresh();
  }
});

// 🛑 syncAppState y APP_STATE heredado eliminados. AppState (Proxy) ahora es el único gestor.



function activateDefaultMainForRole() {
  const role = String((USER && USER.rol) || "").trim().toUpperCase();
  if (!role) return;

  activateMain("CAP");

  if (role === "UNIDAD") {
    activateCapture(APP_STATE.captureTab || "SR");
  }
}

function syncAguja() {
  const j05 = $("jeringa_aplic_05ml_0605502657");
  const j50 = $("jeringa_reconst_5ml_0605500438");
  const dst = $("aguja_0600403711");

  if (!j05 || !j50 || !dst) return;

  const v = Number(j50.value || 0);
  dst.value = String(v);
}

function pad2(n) { return String(n).padStart(2, "0"); }

function nowTimeStr() {
  const d = new Date();
  let hours = d.getHours();
  const minutes = pad2(d.getMinutes());
  const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${pad2(hours)}:${minutes} ${ampm}`;
}


let PUBLIC_CLOCK_TIMER = null;
let PUBLIC_CLOCK_TIMEOUT = null;
let PUBLIC_CLOCK_REFS = null;

function getPublicClockRefs() {
  if (PUBLIC_CLOCK_REFS) return PUBLIC_CLOCK_REFS;

  PUBLIC_CLOCK_REFS = {
    hdrFecha: $("hdrFecha"),
    hdrHora: $("hdrHora"),
    hdrJueves: $("hdrJueves"),
    bJueves: $("bJueves")
  };

  return PUBLIC_CLOCK_REFS;
}

function getMsUntilNextMinute() {
  const now = new Date();
  return ((60 - now.getSeconds()) * 1000) - now.getMilliseconds();
}

function paintPublicClock() {
  const d = new Date();
  const fechaHumana = formatDateMx(d);
  const horaHumana = nowTimeStr();
  const refs = getPublicClockRefs();

  if (refs.hdrFecha) refs.hdrFecha.textContent = fechaHumana;
  if (refs.hdrHora) refs.hdrHora.textContent = horaHumana;
}


function startPublicClockTimer() {
  stopPublicClockTimer();
  paintPublicClock();

  PUBLIC_CLOCK_TIMEOUT = setTimeout(() => {
    paintPublicClock();

    PUBLIC_CLOCK_TIMER = setInterval(() => {
      paintPublicClock();
    }, 60000);
  }, getMsUntilNextMinute());
}

function stopPublicClockTimer() {
  if (PUBLIC_CLOCK_TIMEOUT) {
    clearTimeout(PUBLIC_CLOCK_TIMEOUT);
    PUBLIC_CLOCK_TIMEOUT = null;
  }

  if (PUBLIC_CLOCK_TIMER) {
    clearInterval(PUBLIC_CLOCK_TIMER);
    PUBLIC_CLOCK_TIMER = null;
  }
}

function escapeHtml(s) {
  s = (s == null) ? "" : String(s);
  const upper = s.toUpperCase().trim();
  if (upper.includes("FELIPE NUÑEZ LARA") || upper.includes("ESPECIALIDADES DEL NIÑO Y LA MUJER")) {
    s = "HENM";
  }
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

function formatDateMx(d = new Date()) {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(d);
}

function formatBadgeDayText(ymd = "") {
  const d = ymd ? new Date(`${ymd}T00:00:00`) : new Date();

  const weekday = new Intl.DateTimeFormat("es-MX", { weekday: "long" }).format(d);
  const month = new Intl.DateTimeFormat("es-MX", { month: "long" }).format(d);

  const weekdayCap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const monthCap = month.charAt(0).toUpperCase() + month.slice(1);

  return `Hoy es ${weekdayCap} ${d.getDate()} de ${monthCap}`;
}

function getComplianceTone(pct = 0) {
  const n = Number(pct || 0);
  if (n >= 90) return "good";
  if (n >= 70) return "warn";
  return "bad";
}

function capitalizeFirstLetter(text = "") {
  const s = String(text || "").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

/**
 * 🧹 normalizeText — Elimina acentos y normaliza a mayúsculas para comparaciones seguras
 */
function normalizeText(text = "") {
  let s = String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
  if (s === "MARQUES" || s === "EL MARQUES") {
    return "EL MARQUES";
  }
  return s;
}

function formatDayBadgeMx(ymd = "") {
  const d = ymd ? new Date(`${ymd}T00:00:00`) : new Date();

  const weekday = capitalizeFirstLetter(
    new Intl.DateTimeFormat("es-MX", { weekday: "long" }).format(d)
  );

  const month = capitalizeFirstLetter(
    new Intl.DateTimeFormat("es-MX", { month: "long" }).format(d)
  );

  return `Hoy es ${weekday} ${d.getDate()} de ${month}`;
}

function getComplianceBadgeTone(pct = 0) {
  const n = Number(pct || 0);
  if (n >= 95) return "good";
  if (n >= 80) return "warn";
  return "bad";
}

function todayYmdLocal() {
  return dateToLocalYmd(new Date());
}

function dateToLocalYmd(d) {
  if (!d) return "";
  if (typeof d === "string") return d;
  if (!(d instanceof Date)) return "";
  if (isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isMexicanHoliday(date) {

  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();

  const fixed = [
    "01-01", // Año nuevo
    "05-01", // Trabajo
    "09-16", // Independencia
    "12-25"  // Navidad
  ];

  const mmdd = `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  if (fixed.includes(mmdd)) return true;

  // Constitución (primer lunes febrero)
  if (m === 2 && date.getDay() === 1 && d <= 7) return true;

  // Benito Juárez (tercer lunes marzo)
  if (m === 3 && date.getDay() === 1 && d >= 15 && d <= 21) return true;

  // Revolución (tercer lunes noviembre)
  if (m === 11 && date.getDay() === 1 && d >= 15 && d <= 21) return true;

  // ===== CÁLCULO SEMANA SANTA =====

  const easter = getEasterDate(y);

  const juevesSanto = new Date(easter);
  juevesSanto.setDate(easter.getDate() - 3);

  const viernesSanto = new Date(easter);
  viernesSanto.setDate(easter.getDate() - 2);

  if (
    sameDate(date, juevesSanto) ||
    sameDate(date, viernesSanto)
  ) {
    return true;
  }

  return false;
}

function isBusinessDay(date) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false; // Fin de semana
  if (isMexicanHoliday(date)) return false; // Feriado
  return true;
}

/**
 * Obtiene el X-ésimo día hábil anterior o posterior
 */
function getBusinessDayOffset(date, offset) {
  const d = new Date(date);
  let count = 0;
  const step = offset > 0 ? 1 : -1;
  const target = Math.abs(offset);

  while (count < target) {
    d.setDate(d.getDate() + step);
    if (isBusinessDay(d)) {
      count++;
    }
  }
  return new Date(d);
}

/**
 * Calcula la ventana inteligente centrada en el día 22
 * 1. Busca el día 22. Si no es hábil, retrocede al anterior más cercano.
 * 2. Calcula 1 día hábil antes y 1 después de ese punto.
 */
function calculateBioIntelligentWindow(year, month) {
  return getBioCaptureWindow(year, month + 1); // getBioCaptureWindow espera mes 1-12
}

function sameDate(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getEasterDate(year) {

  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);

  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month - 1, day);
}

function shouldEnableConsumibles() {
  return !!getConsumiblesCaptureDate();
}

function getConsumiblesCaptureDate() {

  const hoy = new Date();

  // jueves normal
  if (hoy.getDay() === 4) {
    return todayYmdLocal();
  }

  // miércoles revisar jueves
  if (hoy.getDay() === 3) {

    const jueves = new Date(hoy);
    jueves.setDate(hoy.getDate() + 1);

    const viernes = new Date(hoy);
    viernes.setDate(hoy.getDate() + 2);

    const juevesInhabil = isMexicanHoliday(jueves);
    const viernesInhabil = isMexicanHoliday(viernes);

    if (juevesInhabil || (juevesInhabil && viernesInhabil)) {
      return todayYmdLocal();
    }
  }

  return null;
}

function getLastThursdayLocal(baseYmd) {

  const override = getConsumiblesCaptureDate();
  if (override) return override;

  const d = baseYmd ? new Date(baseYmd + "T00:00:00") : new Date();

  while (d.getDay() !== 4) {
    d.setDate(d.getDate() - 1);
  }

  // ===== FIX FERiado =====
  if (isMexicanHoliday(d)) {

    const miercoles = new Date(d);
    miercoles.setDate(d.getDate() - 1);

    const yyyy = miercoles.getFullYear();
    const mm = String(miercoles.getMonth() + 1).padStart(2, "0");
    const dd = String(miercoles.getDate()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd}`;
  }

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function getConsumiblesOperationalRangeClient(base) {
  const d = new Date(base + "T00:00:00");
  const dow = d.getDay();

  if (dow === 3) {
    const jueves = new Date(d);
    jueves.setDate(d.getDate() + 1);

    if (isMexicanHoliday(jueves)) {
      return {
        fechaInicio: base,
        fechaFin: formatDateLocal(jueves)
      };
    }
  }

  if (dow === 4) {
    return {
      fechaInicio: base,
      fechaFin: base
    };
  }

  const lastThu = getLastThursdayLocal(base);

  return {
    fechaInicio: lastThu,
    fechaFin: lastThu
  };
}

function setSavedStamp() {
  const t = nowTimeStr();
  if ($("bGuardado")) $("bGuardado").style.display = "inline-flex";
  if ($("hdrGuardado")) $("hdrGuardado").textContent = `Guardado: ${t}`;
}

function runPostLoginVisualSetup() {
  setTimeout(() => {
    applyCaptureNameAutocomplete();
    bindFastNumericFocus();
    bindAdminAutocomplete();
  }, 120);
}

/**
 * 🛡️ whoami() — Validación REAL de sesión Auth + perfil fresco
 * Ya NO lee de localStorage. Valida contra Supabase Auth y luego
 * consulta public.perfiles para obtener rol, clues, municipio, etc.
 */
async function whoami() {
  try {
    // 1. Verificar que existe un usuario autenticado de forma real (vía getUser para mayor seguridad)
    const { data: { user }, error: userError } = await window.supabase.auth.getUser();

    if (userError || !user) {
      console.warn("[whoami] No hay usuario Auth activo o token inválido");
      clearSession();
      return null;
    }

    // 2. Recuperar la sesión para obtener el access_token fresco
    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) {
      clearSession();
      return null;
    }

    TOKEN = session.access_token;

    // 3. Consultar perfil fresco desde la DB (respeta RLS)
    const { data: perfil, error: perfilError } = await window.supabase
      .from('perfiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (perfilError || !perfil) {
      console.warn("[whoami] Perfil no encontrado en DB, usando fallback de metadata:", session.user.id, perfilError);
      const fallbackPerfil = {
        id: session.user.id,
        rol: session.user.user_metadata?.rol || "UNIDAD",
        clues: session.user.user_metadata?.clues || "FALLBACK",
        unidad: session.user.user_metadata?.unidad || "Unidad Fallback",
        municipio: session.user.user_metadata?.municipio || "",
        activo: "SI"
      };
      USER = buildUserFromPerfil(session.user.id, session.user.email, fallbackPerfil);
    } else {
      // 4. Verificar que el usuario esté activo
      if (String(perfil.activo || "SI").toUpperCase() !== "SI") {
        console.warn("[whoami] Usuario desactivado:", perfil.usuario);
        await window.supabase.auth.signOut();
        clearSession();
        return null;
      }
      // 5. Construir USER de forma canónica y persistir
      USER = buildUserFromPerfil(session.user.id, session.user.email, perfil);
    }

    // 🛡️ Verificar cambio obligatorio desde metadata fresca de Auth o base de datos
    if (user.user_metadata?.force_password_change || (perfil && perfil.must_change)) {
      USER.mustChange = true;
    }

    saveSession(TOKEN, USER);

    console.log("[whoami] Sesión validada:", USER.email, "Rol:", USER.rol);
    return USER;
  } catch (e) {
    console.error("[whoami] Error fatal:", e);
    clearSession();
    return null;
  }
}

/**
 * 🏗️ buildUserFromPerfil — Constructor canónico del objeto USER
 * Garantiza que municipiosAllowed se derive correctamente del rol.
 * Esta es la ÚNICA fuente de verdad para construir USER.
 */
function buildUserFromPerfil(uid, email, perfil) {
  const rol = String((perfil && perfil.rol) || "UNIDAD").toUpperCase();
  const municipio = (perfil && perfil.municipio) || "";

  // 🏢 Constantes de la Jurisdicción Sanitaria 1
  const DEFAULT_ADMIN_CLUES = "QTSSA012154";
  const DEFAULT_ADMIN_UNIDAD = "OFICINAS DE LA JURISDICCIÓN SANITARIA";

  // Derivar municipiosAllowed basándose en el rol
  let municipiosAllowed = [];
  if (rol === "ADMIN" || rol === "JURISDICCIONAL") {
    municipiosAllowed = ["*"]; // Acceso total
  } else if (rol === "MUNICIPAL") {
    // Soporte para múltiples municipios
    let rawMuni = (perfil && perfil.municipio) ? perfil.municipio : "";
    if (perfil && perfil.municipios_allowed && perfil.municipios_allowed.length > 0 && perfil.municipios_allowed !== "[]") {
      rawMuni = perfil.municipios_allowed;
    }

    let muniList = [];
    if (Array.isArray(rawMuni)) {
      muniList = rawMuni;
    } else {
      muniList = String(rawMuni).replace(/[\[\]{}"']/g, '').split(/[;,]/);
    }
    municipiosAllowed = muniList.map(x => x.trim()).filter(Boolean);

    // Auto-fix: Sincronizar municipios_allowed en BD si está vacío y hay múltiples
    if (municipiosAllowed.length > 1) {
      const dbArr = (perfil && perfil.municipios_allowed) || [];
      if (!dbArr || !dbArr.length || (Array.isArray(dbArr) && dbArr.length === 0)) {
        window.supabase?.from('perfiles')
          .update({ municipios_allowed: municipiosAllowed })
          .eq('id', uid)
          .then(res => {
            if (res.error) console.warn("[buildUser] No se pudo sincronizar municipios_allowed:", res.error);
            else console.log("[buildUser] ✅ municipios_allowed sincronizado:", municipiosAllowed);
          });
      }
    }
  }

  // 🛡️ Regla de CLUES para Administrativos: Si no tienen CLUES o tienen placeholders, se les asigna la de la Jurisdicción
  let userClues = (perfil && perfil.clues) || "";
  let userUnidad = (perfil && perfil.unidad) || "";

  const isPlaceholderClues = !userClues || userClues.toUpperCase().includes("SIN") || userClues.toUpperCase().includes("N/A");

  if (rol !== "UNIDAD" && isPlaceholderClues) {
    userClues = DEFAULT_ADMIN_CLUES;
    userUnidad = DEFAULT_ADMIN_UNIDAD;
  }

  return {
    uid: uid,
    email: email,
    rol: rol,
    usuario: (perfil && perfil.usuario) || email,
    nombre: (perfil && perfil.nombre) || "",
    clues: userClues,
    unidad: userUnidad,
    municipio: municipio,
    municipiosAllowed: municipiosAllowed,
    activo: (perfil && perfil.activo) || "SI",
    must_change: !!(perfil && perfil.must_change),
    mustChange: !!(perfil && perfil.must_change)
  };
}

/**
 * 🛡️ canSeeMunicipio_ — Validador de acceso a municipio basado en la jerarquía
 */
function canSeeMunicipio_(user, targetMuni) {
  if (!user || !targetMuni) return false;
  const role = String(user.rol || "").toUpperCase();
  if (role === "ADMIN" || role === "JURISDICCIONAL") return true;

  const allowed = Array.isArray(user.municipiosAllowed) ? user.municipiosAllowed : [];
  if (allowed.includes("*")) return true;

  const normalizedTarget = normalizeText(targetMuni);
  const result = allowed.some(a => normalizeText(a) === normalizedTarget);

  if (!result && role === "MUNICIPAL") {
    console.log(`[Hierarchy DEBUG] Access Denied: target=${normalizedTarget}, allowed=[${allowed.map(a => normalizeText(a)).join(',')}]`);
  }

  return result;
}


async function unitStatus() {
  if (!TOKEN) return null;
  const selectedMuni = $("histMunicipioFilter")?.value || "";
  const r = await apiCall({ action: "unitStatus", token: TOKEN, selectedMunicipio: selectedMuni });
  if (!r || !r.ok) return null;
  return r.data;
}

async function getTodayReports(fecha = "", force = false) {
  // SEGURO ANTI-COLAPSOS: Si el usuario aún no carga, no intenta buscar
  if (!TOKEN || !USER) return null;

  const safeFecha = String(fecha || todayYmdLocal()).trim();
  const cacheKey = buildCacheKey("TODAY_REPORTS", safeFecha);

  const fetchToday = async () => {
    try {
      const r = await apiCall("getTodayReports", { fecha: safeFecha });
      if (r && r.ok && r.data) {
        return { sr: r.data.sr || null, cons: r.data.cons || null };
      }
      return null;
    } catch (e) {
      console.error("Error al leer reportes:", e);
      return null;
    }
  };

  const data = force
    ? await fetchToday()
    : await getCachedOrFetch({
      key: cacheKey,
      ttl: CACHE_TTL.TODAY_REPORTS,
      fetcher: fetchToday,
      shouldCache: (data) => data != null
    });

  APP_STATE.todayCache = data || null;
  if (typeof TODAY_CACHE !== "undefined") TODAY_CACHE = data || null;

  return data || null;
}

window.getCaptureOverview = async function (fecha, tipo, force = false) {
  console.log(`[getCaptureOverview DEBUG] Llamado con fecha=${fecha}, tipo=${tipo}`);
  if (!TOKEN) return null;

  const safeFecha = String(fecha || todayYmdLocal()).trim();
  const safeTipo = String(tipo || "SR").trim().toUpperCase();
  const cacheKey = buildCacheKey("CAPTURE_OVERVIEW_V2", `${safeFecha}::${safeTipo}`);

  const fetchOverview = async () => {
    const r = await apiCall({
      action: "adminCaptureOverview",
      token: TOKEN,
      fecha: safeFecha,
      tipo: safeTipo
    });

    if (!r) {
      throw new Error("Sin respuesta del servidor en adminCaptureOverview.");
    }

    if (!r.ok) {
      throw new Error(r.error || "Error al cargar resumen de captura.");
    }

    return r.data || null;
  };

  const data = force
    ? await fetchOverview()
    : await getCachedOrFetch({
      key: cacheKey,
      ttl: CACHE_TTL.CAPTURE_OVERVIEW,
      fetcher: fetchOverview,
      shouldCache: (data) => data != null
    });

  return data || null;
};

// Old getHistoryMetrics removed — unified in the new version at line ~11291


/**
 * 🌓 CONTROL DE VISTAS (LOGIN vs APP)
 * Administra la entrada/salida del overlay premium y la visibilidad del dashboard.
 */

function showRightColumn(show) {
  const loginWrap = document.getElementById("loginWrapper");
  const cardLogin = document.getElementById("cardLogin");
  const footer = document.querySelector(".appFooter");

  // 1. Dashboard visibility
  toggleEl("rightColumn", show, "flex");
  toggleEl("mainHeader", show, "flex");
  if (footer) footer.style.display = show ? "block" : "none";

  // 2. Login Overlay transition
  if (loginWrap) {
    if (show) {
      // Exit: Fade out and slide up
      if (cardLogin) cardLogin.style.transform = "translateY(-40px) scale(0.95)";
      loginWrap.classList.add("hidden");
    } else {
      // Entry: Show premium overlay
      loginWrap.classList.remove("hidden");
      if (cardLogin) {
        cardLogin.style.transform = "translateY(0) scale(1)";
        cardLogin.classList.add("animate-fade-in-up");
      }
    }
  }
}

function paintStatusChips(status) {
  if (!status) return;

  const d = status.today ? new Date(status.today + "T00:00:00") : new Date();
  const fechaHumana = formatDateMx(d);

  if ($("hdrFecha")) {
    $("hdrFecha").textContent = fechaHumana;
  }

  const dayBadge = $("dayTxt");
  const container = $("bCumplimiento") || (dayBadge ? dayBadge.parentElement : null);
  const iconBg = $("bCumplimientoIconBg");

  if (dayBadge && container) {
    container.classList.remove("good", "ok", "warn", "bad");
    if (iconBg) iconBg.style.backgroundColor = "";

    // Mostrar motivo si es algo extraordinario
    if (status.isExtraordinary) {
      if ($("hdrGuardado")) {
        $("hdrGuardado").textContent = status.consReason || status.bioReason || "Apertura Especial";
        $("bGuardado").style.display = "flex";
        $("bGuardado").classList.replace("bg-status-success", "bg-orange-500");
      }
    }

    // Lógica de métrica por perfil (v5 State of the Art)
    const role = USER?.rol || "UNIDAD";

    if (role === "UNIDAD") {
      pct = Number(status.compliance_pct || 0);
      label = `${pct}%`;
    } else if (role === "MUNICIPAL") {
      pct = Number(status.municipal_avg || status.compliance_pct || 0);
      label = `${pct}%`;
    } else {
      pct = Number(status.global_avg || status.compliance_pct || 0);
      label = `${pct}%`;
    }

    dayBadge.textContent = label;

    const tone = getComplianceBadgeTone(pct);

    // Apply ranking/tier styles if present, otherwise default to tone-based semaphorization
    if (status.userRank !== undefined && status.userTier !== "riesgo") {
      updateCumplimientoMedalTone(status.userRank, status.userTier);
      const hasPodiumClass = ["podium-gold-chip", "podium-silver-chip", "podium-bronze-chip", "podium-steel-chip", "podium-emerald-chip", "podium-diamond-chip"].some(cls => container.classList.contains(cls));
      if (hasPodiumClass) {
        container.classList.remove("good", "ok", "warn", "bad");
        container.removeAttribute("data-tone");
      } else {
        container.classList.remove("good", "ok", "warn", "bad");
        container.classList.add(tone);
        container.setAttribute("data-tone", tone);
      }
    } else {
      updateCumplimientoMedalTone(undefined, undefined);
      container.classList.remove("good", "ok", "warn", "bad");
      container.classList.add(tone);
      container.setAttribute("data-tone", tone);
    }

    // Refined Week-by-Week Compliance Algorithm & Premium UX Notification Layout
    let tooltipText = "Progreso de Cumplimiento: Inicia el mes en 0% y sube conforme realizas tus entregas semanales y mensuales.";
    let statusBadgeHtml = "";
    let notifBoxHtml = "";

    if (role === "UNIDAD") {
      let upToDateText = "";
      if (status.unitDetails) {
        const details = status.unitDetails;
        const isBioOk = details.bio_ok >= details.bio_expected;
        const isConsOk = details.cons_ok >= details.cons_expected;
        const isPedidoOk = !details.is_pedido_required || details.pedido_mensual;

        // Simplify: Only check if there are pending captures to perform right now.
        const hasPendingBio = details.bio_expected > details.bio_ok;
        const hasPendingCons = details.cons_expected > details.cons_ok;
        const hasPendingPedido = details.is_pedido_required && !details.pedido_mensual;

        const isAnyPending = hasPendingBio || hasPendingCons || hasPendingPedido;

        if (isAnyPending) {
          // Status: Pending for the current active week/month capture
          statusBadgeHtml = `
            <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/20">
              <span class="status-dot bg-amber-400 animate-pulse"></span>
              <span>Pendiente</span>
            </div>
          `;
          notifBoxHtml = `
            <div class="compliance-notif-box pending">
              <span class="material-symbols-rounded">schedule</span>
              <div class="compliance-notif-text-container">
                <span class="compliance-notif-title">Pendiente</span>
                <span class="compliance-notif-desc">Captura de esta semana</span>
              </div>
            </div>
          `;
          
          const pendingList = [];
          if (hasPendingBio) pendingList.push(`Biológicos (${details.bio_ok}/${details.bio_expected})`);
          if (hasPendingCons) pendingList.push(`Consumibles (${details.cons_ok}/${details.cons_expected})`);
          if (hasPendingPedido) pendingList.push("Pedido Mensual");
          upToDateText = `\n\n⚠️ Reportes pendientes a la fecha: ${pendingList.join(", ")}.`;
        } else {
          // Status: Perfect Compliance (No pending reports in active windows)
          statusBadgeHtml = `
            <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              <span class="status-dot bg-emerald-400 animate-pulse"></span>
              <span>Al Día</span>
            </div>
          `;
          notifBoxHtml = `
            <div class="compliance-notif-box success">
              <span class="material-symbols-rounded">check_circle</span>
              <div class="compliance-notif-text-container">
                <span class="compliance-notif-title">Al Corriente</span>
                <span class="compliance-notif-desc">Entregas al corriente</span>
              </div>
            </div>
          `;
          upToDateText = "";
        }
      }
      tooltipText += upToDateText;
    } else {
      // Non-unit roles: Coordinators, Admin, Jurisdictional
      const score = Number(status.compliance_pct || 0);
      if (score >= 80) {
        statusBadgeHtml = `
          <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            <span class="status-dot bg-emerald-400"></span>
            <span>Saludable</span>
          </div>
        `;
        notifBoxHtml = `
          <div class="compliance-notif-box success">
            <span class="material-symbols-rounded">verified</span>
            <div class="compliance-notif-text-container">
              <span class="compliance-notif-title">Óptimo</span>
              <span class="compliance-notif-desc">Promedio estable</span>
            </div>
          </div>
        `;
      } else {
        statusBadgeHtml = `
          <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-500/10 text-red-300 border border-red-500/20">
            <span class="status-dot bg-red-500"></span>
            <span>Crítico</span>
          </div>
        `;
        notifBoxHtml = `
          <div class="compliance-notif-box omission">
            <span class="material-symbols-rounded">error</span>
            <div class="compliance-notif-text-container">
              <span class="compliance-notif-title">Atención</span>
              <span class="compliance-notif-desc">Omisiones acumuladas</span>
            </div>
          </div>
        `;
      }
    }

    if ($("bCumplimientoStatusBadge")) {
      $("bCumplimientoStatusBadge").innerHTML = statusBadgeHtml;
    }
    if ($("bCumplimientoNotification")) {
      $("bCumplimientoNotification").innerHTML = notifBoxHtml;
    }

    if (role === "MUNICIPAL") {
      tooltipText = "Promedio de Cumplimiento Municipal: Avance global ponderado de las unidades correspondientes a tu municipio durante el mes.";
    } else if (role === "ADMIN" || role === "JURISDICCIONAL") {
      tooltipText = "Promedio de Cumplimiento Global/Jurisdiccional: Avance acumulado de todas las unidades activas.";
    }
    container.title = tooltipText;

    // Load and paint yearly medals for the active user directly on dashboard load
    const currentYear = new Date().getFullYear();
    if (USER && USER.rol === "UNIDAD" && USER.clues) {
      getYearlyMedals(currentYear, USER.clues).then(medals => {
        renderUnitMedals(medals);
      });
    } else if (USER && (USER.rol === "MUNICIPAL" || (status.selectedMunicipio && status.selectedMunicipio !== "TODOS"))) {
      const targetMuni = USER.rol === "MUNICIPAL" ? (USER.municipio || "").split(",")[0].trim() : status.selectedMunicipio;
      if (targetMuni) {
        getYearlyMuniMedals(currentYear, targetMuni).then(medals => {
          renderUnitMedals(medals);
        });
      }
    }

    // Update icon background for premium look if colored
    if (iconBg && ["good", "warn", "bad"].includes(tone) && !status.userRank) {
      iconBg.style.backgroundColor = "rgba(255, 255, 255, 0.25)";
    }
  }
}


function updateCaptureStateBanner() {
  const box = $("captureStateBox");
  const container = $("captureStateContainer");
  const iconEl = $("captureStateIcon");
  const iconBg = $("captureStateIconBg");
  const textEl = $("captureStateText");
  const eyebrow = $("captureStateEyebrow");

  if (!box || !container || !USER || USER.rol !== "UNIDAD" || !STATUS) return;

  const activeTab =
    $("tabSR")?.classList.contains("tab-active") ? "SR" :
      $("tabCONS")?.classList.contains("tab-active") ? "CONS" :
        $("tabBIO")?.classList.contains("tab-active") ? "BIO" :
          $("tabPINOL")?.classList.contains("tab-active") ? "PINOL" : "SR";

  const setTone = (tone, icon, title, msg) => {
    box.classList.remove("hidden");

    // Move box to active panel container if it exists
    const targetContainer = $(`form${activeTab}`) || $(`panel${activeTab}`) || $("captureContentArea");
    if (targetContainer && box.parentElement !== targetContainer) {
      targetContainer.prepend(box);
    }

    container.className = `IntegratedHint tone-${tone}`;
    iconBg.className = `hint-icon-bg`;
    iconEl.className = `material-symbols-rounded text-[22px] ${tone !== "ok" ? "animate-pulse" : ""}`;
    iconEl.textContent = icon;
    eyebrow.className = `hint-eyebrow`;
    eyebrow.textContent = title;
    textEl.className = `hint-message`;
    textEl.innerHTML = msg;
  };

  if (activeTab === "SR") {
    // SR has its own static info header — hide the dynamic banner to avoid duplication
    box.classList.add("hidden");
    return;
  }

  if (activeTab === "CONS") {
    if (!(STATUS && STATUS.canCaptureConsumibles)) {
      setTone("bad", "event_busy", "No Disponible", `<b>CONSUMIBLES NO DISPONIBLE:</b> este reporte solo se captura en jueves.`);
      return;
    }

    if (STATUS.consumiblesHolidayOverride) {
      setTone("warn", "event_available", "Apertura Especial", `<b>CONSUMIBLES HABILITADO:</b> este reporte se puede capturar el día de hoy ya que el jueves es día no laborable.`);
      return;
    }

    if (STATUS.consumiblesManualOverride) {
      setTone("ok", "admin_panel_settings", "Apertura Especial", `<b>CONSUMIBLES HABILITADO:</b> apertura extraordinaria activada por administración.`);
      return;
    }

    if (HAS_TODAY_CONS && TODAY_CACHE && TODAY_CACHE.cons) {
      if (EDIT_CONS) {
        setTone("warn", "edit_square", "Modo Edición", `<b>MODO EDICIÓN ACTIVO:</b> estás corrigiendo el reporte de consumibles de hoy.`);
      } else {
        setTone("ok", "task_alt", "Reporte Completo", `<b>YA CAPTURADO HOY:</b> consumibles ya fue registrado${(TODAY_CACHE.cons && TODAY_CACHE.cons.editado === "SI") ? " y editada" : ""}. Si necesitas corregirlo, usa el botón <b>Editar reporte de hoy</b>.`);
      }
    } else {
      setTone("ok", "inventory_2", "Disponible", `<b>CONSUMIBLES HABILITADO:</b> el reporte de consumibles está disponible para captura el día de hoy.`);
    }
    return;
  }

  if (activeTab === "BIO") {
    const canBio = (typeof BIO_STATE !== "undefined" && BIO_STATE.canCapture);

    if (!canBio) {
      setTone("bad", "event_busy", "No Disponible", `<b>PEDIDO DE BIOLÓGICO NO DISPONIBLE:</b> hoy no se encuentra habilitado para captura o la ventana operativa ha cerrado.`);
      return;
    }

    if (HAS_SAVED_BIO) {
      if (EDIT_BIO) {
        setTone("warn", "edit_square", "Modo Edición", `<b>MODO EDICIÓN ACTIVO:</b> estás corrigiendo el pedido de biológico guardado.`);
      } else {
        setTone("ok", "task_alt", "Pedido Guardado", `<b>PEDIDO YA GUARDADO:</b> ya existe un pedido de biológico capturado para la fecha programada. Si necesitas corregirlo, usa el botón <b>Editar pedido guardado</b>.`);
      }
    } else {
      setTone("ok", "schedule", "Pedido Pendiente", `<b>PEDIDO HABILITADO:</b> ya puedes capturar tu pedido de biológico. Revisa los detalles en la ficha logística inferior.`);
    }
    return;
  }

  if (activeTab === "PINOL") {
    setTone("ok", "inventory_2", "Sección Pinol", USER && USER.rol === "UNIDAD" ? `<b>PINOL:</b> desde aquí puedes hacer tu solicitud de pinol.` : `<b>PINOL:</b> desde aquí puedes consultar, registrar o confirmar movimientos de pinol.`);
  }
}

let EDIT_SR = false;
let EDIT_CONS = false;
let EDIT_BIO = false;
let TODAY_CACHE = null;

let ORIGINAL_SR = null;
let ORIGINAL_CONS = null;

let HAS_TODAY_SR = false;
let HAS_TODAY_CONS = false;
let HAS_SAVED_BIO = false;

let BIO_STATE = {
  rows: [],
  isCaptureDay: false,
  canCapture: false,
  fechaPedidoProgramada: "",
  captureWindowStart: "",
  captureWindowEnd: "",
  captureWindowStatus: "EARLY",
  cache: [] // DOM references for faster access
};

function renderBioRows(rows) {
  BIO_STATE.rows = rows || [];
  const tbody = $("bioTbody");
  if (!tbody) return;

  if (!rows || !rows.length) {
    tbody.innerHTML = `<div class="p-8 text-center text-surface-onVariant/60 font-medium">No hay configuración para esta unidad</div>`;
    return;
  }

  tbody.innerHTML = rows.map((r, i) => {
    const isCamp = [
      "INFLUENZA",
      "COVID-19",
      "COVID 19",
      "VPH",
      "HEPATITIS A",
      "VARICELA"
    ].includes(String(r.biologico || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase());
    return `
    <div class="bio-card" id="bioCard_${i}">
      <div class="bio-name">
        💉 ${escapeHtml(r.biologico || "")}
      </div>
      <div class="text-center flex items-center justify-center gap-1 touch-stepper-wrap">
        <button type="button" class="stepper-btn stepper-btn-minus" onclick="const inp=this.nextElementSibling; inp.value=Math.max(0, (parseInt(inp.value)||0)-1); inp.dispatchEvent(new Event('input', {bubbles:true})); inp.dispatchEvent(new Event('change', {bubbles:true}));">-</button>
        <input
          class="bioInput"
          style="width: 80px; height: 48px; text-align: center; font-size: 18px; font-weight: 900; border: 2px solid #cbd5e1; border-radius: 12px; background: #ffffff; outline: none; box-shadow: 0 2px 4px rgba(0,0,0,0.02);"
          type="number" min="0" step="any" inputmode="decimal"
          data-i="${i}" data-kind="existencia"
          value="${r.existencia_actual_frascos ?? ""}" placeholder="0">
        <button type="button" class="stepper-btn stepper-btn-plus" onclick="const inp=this.previousElementSibling; inp.value=(parseInt(inp.value)||0)+1; inp.dispatchEvent(new Event('input', {bubbles:true})); inp.dispatchEvent(new Event('change', {bubbles:true}));">+</button>
      </div>
      <div class="text-center flex items-center justify-center gap-1 touch-stepper-wrap">
        <button type="button" class="stepper-btn stepper-btn-minus" onclick="const inp=this.nextElementSibling; inp.value=Math.max(0, (parseInt(inp.value)||0)-1); inp.dispatchEvent(new Event('input', {bubbles:true})); inp.dispatchEvent(new Event('change', {bubbles:true}));">-</button>
        <input
          class="bioInput"
          style="width: 80px; height: 48px; text-align: center; font-size: 18px; font-weight: 900; border: 2px solid #cbd5e1; border-radius: 12px; background: #ffffff; outline: none; color: #0f172a; box-shadow: 0 2px 4px rgba(0,0,0,0.02);"
          type="number" min="0" step="1" inputmode="numeric"
          data-i="${i}" data-kind="pedido"
          value="${r.pedido_frascos ?? ""}" placeholder="0">
        <button type="button" class="stepper-btn stepper-btn-plus" onclick="const inp=this.previousElementSibling; inp.value=(parseInt(inp.value)||0)+1; inp.dispatchEvent(new Event('input', {bubbles:true})); inp.dispatchEvent(new Event('change', {bubbles:true}));">+</button>
      </div>
      <div class="text-center">
        <span class="bio-metric-pill">${isCamp ? "N/A" : (r.promedio_frascos ?? "") + " fr."}</span>
      </div>
      <div class="text-center">
        <span class="bio-metric-pill">${isCamp ? "N/A" : (r.min_dosis ?? "") + " / " + (r.max_dosis ?? "")}</span>
      </div>
      <div class="text-center" style="display: flex; justify-content: center; align-items: center; width: 100%;">
        <div id="bioAlert_${i}" class="bioAlertWrap" style="display: flex; justify-content: center; align-items: center; width: 100%; border: none; background: transparent; box-shadow: none; padding: 0;"></div>
      </div>
    </div>
  `}).join("");

  // Performance Update: Cache DOM references once to avoid querySelector in refreshBioAlerts
  // Usamos document.getElementById en un setTimeout mínimo para asegurar el render
  setTimeout(() => {
    BIO_STATE.cache = rows.map((_, i) => ({
      card: document.getElementById(`bioCard_${i}`),
      pedido: document.querySelector(`input[data-i="${i}"][data-kind="pedido"]`),
      existencia: document.querySelector(`input[data-i="${i}"][data-kind="existencia"]`),
      alert: document.getElementById(`bioAlert_${i}`)
    }));
    refreshBioAlerts();
  }, 10);

  tbody.querySelectorAll("input").forEach(inp => {
    inp.addEventListener("blur", () => {
      inp.dataset.touched = "1";
      refreshBioAlerts();
    });

    inp.addEventListener("change", () => {
      inp.dataset.touched = "1";
      refreshBioAlerts();
    });
  });
}

function getSelectedExportMunicipios() {
  return Array.from(document.querySelectorAll(".exportMunicipioChk:checked"))
    .map(chk => chk.value);
}

function refreshExportSplitUi() {
  const wrap = $("exportSplitWrap");
  const chk = $("exportSplitByMunicipio");
  const tipo = $("exportTipo") ? $("exportTipo").value : "SR";
  const rol = String((USER && USER.rol) || "").toUpperCase();

  if (!wrap || !chk) return;

  // Ahora visible para ADMIN, JURISDICCIONAL y MUNICIPAL para CONS, SR (Existencia) y BIO (Pedido)
  const visible = (rol === "ADMIN" || rol === "JURISDICCIONAL" || rol === "MUNICIPAL") && (tipo === "CONS" || tipo === "SR" || tipo === "BIO");

  wrap.style.display = visible ? "block" : "none";

  if (!visible) {
    chk.checked = false;
  }
}

async function updateExportFechaHint() {
  const tipo = $("exportTipo").value;
  const hoy = todayYmdLocal();
  const titleEl = $("exportModalTitle");

  if (tipo === "BIO") {
    if (titleEl) titleEl.textContent = "Exportar Pedido de Biológico";
    $("exportFechaRangeBox").style.display = "none";
    $("exportFechaSingleBox").style.display = "none";
    $("exportFechaMonthBox").style.display = "block";
    $("exportFechaHint").textContent = "Reporte mensual en formato matriz.";

    const sugg = (USER && USER.fechaPedidoProgramada) || hoy;
    if (sugg && sugg.includes("-")) {
      if (!$("exportMonth").dataset.touched) {
        const parts = sugg.split("-");
        if ($("exportYear")) $("exportYear").value = parts[0];
        if ($("exportMonth")) $("exportMonth").value = parts[1];
        $("exportMonth").dataset.touched = "1";
      }
    }

    const yy = $("exportYear").value;
    const mm = $("exportMonth").value;
    const exactBox = $("exportBioExactDateBox");
    const exactSelect = $("exportBioExactDate");

    if (exactBox && exactSelect) {
      exactBox.style.display = "none";
      exactSelect.innerHTML = "";

      const res = await apiCall({ action: "bioGetDatesForMonth", token: TOKEN, month: mm, year: yy });
      if (res && res.ok && res.data && res.data.length > 0) {
        res.data.forEach(d => {
          const opt = document.createElement("option");
          opt.value = d.date;
          opt.textContent = `${d.date} (${d.type === "MENSUAL" ? "Pedido Mensual" : "Extraordinario"})`;
          exactSelect.appendChild(opt);
        });

        const hasMensual = res.data.some(d => d.type === "MENSUAL");
        const hasExtra = res.data.some(d => d.type === "EXTRAORDINARIO");

        if (hasMensual && hasExtra) {
          exactBox.style.display = "flex";
          $("exportFechaHint").textContent = "Múltiples tipos de pedido detectados (Ordinario y Extraordinario). Selecciona el corte exacto.";
        } else {
          exactBox.style.display = "none";
          $("exportFechaHint").textContent = "Un solo tipo de pedido detectado para este mes.";
        }
      } else {
        exactBox.style.display = "none";
        $("exportFechaHint").textContent = "No se encontraron registros de pedido para este mes.";
      }
    }

  } else if (tipo === "CONS") {
    if (titleEl) titleEl.textContent = "Exportar Consumibles";
    $("exportFechaRangeBox").style.display = "block";
    $("exportFechaSingleBox").style.display = "none";
    $("exportFechaMonthBox").style.display = "none";
    $("exportFechaHint").textContent = "Reporte de consumibles por rango operativo.";

    if (typeof getConsumiblesOperationalRangeClient === "function") {
      const range = getConsumiblesOperationalRangeClient(hoy);
      if ($("exportFechaInicio")) $("exportFechaInicio").value = range.fechaInicio;
      if ($("exportFechaFin")) $("exportFechaFin").value = range.fechaFin;
    }
  } else {
    if (titleEl) titleEl.textContent = "Exportar Existencia de Biológicos";
    $("exportFechaRangeBox").style.display = "block";
    $("exportFechaSingleBox").style.display = "none";
    $("exportFechaMonthBox").style.display = "none";
    $("exportFechaHint").textContent = "Reporte de existencia por rango de fechas.";

    if (!$("exportFechaInicio").value) $("exportFechaInicio").value = hoy;
    if (!$("exportFechaFin").value) $("exportFechaFin").value = hoy;
  }
  refreshExportSplitUi();
}

function refreshBioAlerts(force = false) {
  let hasStrongAlert = false;
  let hasBlockingError = false;
  const sinPedido = $("chkNoPedido") ? $("chkNoPedido").checked : false;

  BIO_STATE.rows.forEach((r, i) => {
    if (!BIO_STATE.cache) return;
    const cached = BIO_STATE.cache[i];
    if (!cached) return;

    const card = cached.card;
    const pedidoEl = cached.pedido;
    const existenciaEl = cached.existencia;
    const td = cached.alert;

    if (!pedidoEl || !existenciaEl || !td) return;

    if (card) {
      card.classList.remove("card-extra", "card-camp", "card-warn", "card-good");
    }

    const pedidoRaw = String(pedidoEl.value || "").trim();
    const existenciaRaw = String(existenciaEl.value || "").trim();

    const touched = force || pedidoEl.dataset.touched === "1" || existenciaEl.dataset.touched === "1";

    const bioKey = String(r.biologico || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();

    const sinValidacionOperativa = [
      "INFLUENZA",
      "COVID-19",
      "COVID 19",
      "VPH",
      "VARICELA"
    ].includes(bioKey);

    const omitirAdvertenciaPorCaravana =
      isCurrentUnitCaravana() && bioKey === "BCG";

    if (pedidoRaw === "" && existenciaRaw === "") {
      const html = `<div class="bio-chip text-surface-onVariant/60" style="background:#f1f5f9;">Pendiente</div>`;
      if (td.innerHTML !== html) {
        td.innerHTML = html;
      }
      return;
    }

    const msgs = [];
    let level = "ok";

    const pedido = pedidoRaw === "" ? 0 : Number(pedidoRaw);
    const existencia = existenciaRaw === "" ? 0 : Number(existenciaRaw);

    const promedio = Number(r.promedio_frascos || 0);
    const totalDisponible = existencia + pedido;
    const faltantePromedio = Math.max(0, promedio - totalDisponible);

    // 🛡️ REGLA SENIOR: Bloqueo en múltiplos de 5 para biológicos críticos
    const requires5 = [
      "HEXAVALENTE",
      "ROTAVIRUS",
      "NEUMOCOCICA 13",
      "NEUMOCOCICA 20",
      "SRP"
    ].includes(bioKey);

    const multiplo = requires5 ? 5 : 1;

    if (isNaN(existencia) || !Number.isInteger(pedido) || existencia < 0 || pedido < 0) {
      msgs.push("Cantidades inválidas.");
      level = "bad";
      hasStrongAlert = true;
      hasBlockingError = true;
    }

    if (sinValidacionOperativa) {
      if (card) card.classList.add("card-camp");
      const html = `<div class="bio-chip camp"><div class="bio-chip-icon">★</div> CAMPAÑA</div>`;
      if (td.innerHTML !== html) {
        td.innerHTML = html;
      }
      return;
    }

    if (multiplo > 1 && pedido > 0 && (pedido % multiplo !== 0)) {
      msgs.push(`Debe ser múltiplo de ${multiplo}.`);
      level = "bad";
      hasStrongAlert = true;
      hasBlockingError = true;
    }

    // 🛡️ REGLA: Validación de existencia vs promedio
    const threshold = sinPedido ? existencia : totalDisponible;
    if (!omitirAdvertenciaPorCaravana && promedio > 0 && threshold < promedio) {
      const diff = promedio - threshold;
      msgs.push(`Faltan ${diff} fr.`);
      if (level !== "bad") {
        level = "warn";
        hasStrongAlert = true;
      }
    }

    if (!msgs.length) {
      if (card) card.classList.add("card-good");
      const html = `<div class="bio-chip good"><div class="bio-chip-icon">✓</div> CORRECTO</div>`;
      if (td.innerHTML !== html) {
        td.innerHTML = html;
      }
    } else {
      if (level === "bad" && card) card.classList.add("card-extra");
      if (level === "warn" && card) card.classList.add("card-warn");

      const chipClass = level === "bad" ? "extra" : "warn";
      const iconChar = level === "bad" ? "✕" : "!";
      const textLabel = level === "bad" ? "ERROR" : "ADVERTENCIA";
      const html = `
          <div class="flex flex-col items-center gap-1">
            <div class="bio-chip ${chipClass}"><div class="bio-chip-icon">${iconChar}</div> ${textLabel}</div>
            <div class="text-[10px] font-bold text-red-800/80 leading-tight text-center">${msgs.join("<br>")}</div>
          </div>
        `;
      if (td.innerHTML !== html) {
        td.innerHTML = html;
      }
    }
  });

  if ($("btnSaveBIO")) {
    $("btnSaveBIO").dataset.alert = hasStrongAlert ? "1" : "";
    $("btnSaveBIO").dataset.blocked = hasBlockingError ? "1" : "";
    $("btnSaveBIO").disabled = !BIO_STATE.canCapture;
  }

  return { hasStrongAlert, hasBlockingError };
}

let BIO_CONFIRM_RESOLVER = null;

function openBioConfirm(warningRows) {
  return new Promise((resolve) => {
    let overlay = $("bioConfirmOverlay");

    if (!overlay) {
      console.warn("bioConfirmOverlay no encontrado");
      resolve(false);
      return;
    }

    // Siempre asegurar que el overlay sea hijo directo del body
    // para escapar de cualquier stacking context y asegurar el z-index
    if (overlay.parentNode !== document.body) {
      document.body.appendChild(overlay);
    }

    overlay.onclick = (e) => {
      if (e.target === overlay) closeBioConfirm(false);
    };

    const btnCancel = overlay.querySelector("#btnBioConfirmCancel");
    const btnAccept = overlay.querySelector("#btnBioConfirmAccept");

    if (btnCancel) btnCancel.onclick = () => closeBioConfirm(false);
    if (btnAccept) btnAccept.onclick = () => closeBioConfirm(true);

    BIO_CONFIRM_RESOLVER = resolve;

    const list = overlay.querySelector("#bioConfirmList");

    if (list) {
      list.innerHTML = warningRows
        .map(row => {
          let text = row.replace(/^•\s*/, "").replace(/^-/, "").trim();
          text = text.replace(/\((\d+)\)/g, '<span class="font-black text-status-warning ml-1">($1)</span>');
          return `
            <div class="flex items-start gap-3 py-1.5">
                <span class="material-symbols-rounded text-[18px] text-status-warning shrink-0 mt-0.5">priority_high</span>
                <span class="text-[13px] font-bold text-surface-onVariant/90 leading-snug">${text}</span>
            </div>`;
        })
        .join("");
    }

    // Disparar animación
    requestAnimationFrame(() => {
      overlay.classList.add("show");
      document.body.classList.add("bioConfirmOpen");
    });

    if (btnCancel) btnCancel.focus();
  });
}

function closeBioConfirm(result) {
  const overlay = $("bioConfirmOverlay");
  if (!overlay) return;

  overlay.classList.remove("show");
  document.body.classList.remove("bioConfirmOpen");

  const resolver = BIO_CONFIRM_RESOLVER;
  BIO_CONFIRM_RESOLVER = null;

  if (typeof resolver === "function") {
    setTimeout(() => resolver(!!result), 400); // 400ms to match CSS transition
  }
}

function collectBioItems() {
  const sinPedido = $("chkNoPedido") ? $("chkNoPedido").checked : false;

  // 1. Mapear valores actuales del formulario
  const formValues = {};
  (BIO_STATE.rows || []).forEach((r, i) => {
    const ex = document.querySelector(`input[data-i="${i}"][data-kind="existencia"]`);
    const pe = document.querySelector(`input[data-i="${i}"][data-kind="pedido"]`);
    formValues[r.biologico] = {
      existencia: ex ? Number(ex.value || 0) : 0,
      pedido: pe ? Number(pe.value || 0) : 0,
      r: r
    };
  });

  // 2. Construir lista final basada en el Catálogo Maestro (para integridad de exportación)
  const source = (FULL_BIO_CATALOG && FULL_BIO_CATALOG.length) ? FULL_BIO_CATALOG : BIO_STATE.rows;

  return source.map(c => {
    const val = formValues[c.biologico];
    return {
      biologico: c.biologico,
      existencia_actual_frascos: val ? val.existencia : 0,
      pedido_frascos: sinPedido ? 0 : (val ? val.pedido : 0),
      max_dosis: val ? (val.r.max_dosis || 0) : 0,
      min_dosis: val ? (val.r.min_dosis || 0) : 0,
      promedio_frascos: val ? (val.r.promedio_frascos || 0) : 0,
      multiplo: val ? (val.r.multiplo || 1) : 1
    };
  });
}

async function loadExportOptions() {
  if (!TOKEN || !USER) return;

  const box = $("exportMunicipiosBox");
  const wrap = $("exportMunicipiosChecks");

  if (!box || !wrap) return;

  if (USER.rol !== "ADMIN" && USER.rol !== "MUNICIPAL" && USER.rol !== "JURISDICCIONAL") {
    box.style.display = "none";
    return;
  }

  const r = await apiCall({
    action: "bioGetExportOptions",
    token: TOKEN
  });

  if (!r || !r.ok) {
    box.style.display = "none";
    return;
  }

  let municipios = r.data.municipios || [];
  wrap.innerHTML = "";

  // --- FILTRADO DE MUNICIPIOS PARA EXPORTACIÓN (Strict Rules) ---
  const role = String(USER.rol).toUpperCase();
  if (role === "MUNICIPAL") {
    const userMuns = String(USER.municipio || "").split(",").map(m => m.trim().toUpperCase());
    municipios = municipios.filter(m => userMuns.includes(m.toUpperCase()));
  }

  const grid = document.createElement("div");
  grid.className = "export-muni-grid";

  municipios.forEach((m) => {
    const id = "expmun_" + m.replace(/\s+/g, "_").replace(/[^\w]/g, "");

    const label = document.createElement("label");
    label.className = "export-muni-card";
    label.setAttribute("for", id);

    label.innerHTML = `
      <input type="checkbox" class="exportMunicipioChk" id="${id}" value="${escapeAttr(m)}">
      <span title="${escapeHtml(m)}">${escapeHtml(m)}</span>
    `;

    grid.appendChild(label);
  });
  wrap.appendChild(grid);
  box.style.display = "block";

  if (USER.rol === "ADMIN" || USER.rol === "JURISDICCIONAL") {
    document.querySelectorAll(".exportMunicipioChk").forEach(chk => chk.checked = true);
  }
}

async function loadBioForm() {
  if (!TOKEN || !USER || USER.rol !== "UNIDAD") return;

  if ($("bioTbody")) {
    $("bioTbody").innerHTML = getBioSkeletonHtml(6);
  }

  const r = await apiCall({ action: "bioGetForm", token: TOKEN });
  if (!r || !r.ok) {
    if ($("bioTbody")) {
      $("bioTbody").innerHTML = `<tr><td colspan="7" class="muted">${escapeHtml((r && r.error) ? r.error : "No se pudo cargar")}</td></tr>`;
    }
    return;
  }

  // --- NUEVO ALGORITMO INTELIGENTE (FRONTEND OVERRIDE) ---
  const now = new Date();
  const currentWindow = calculateBioIntelligentWindow(now.getFullYear(), now.getMonth());

  // Fechas ISO para lógica de validación
  const windowStartYmd = dateToLocalYmd(currentWindow.start);
  const windowTargetYmd = dateToLocalYmd(currentWindow.target);
  const windowEndYmd = dateToLocalYmd(currentWindow.end);

  // Fechas amigables para visualización en el Banner
  const windowStartFriendly = formatDateMx(currentWindow.start);
  const windowEndFriendly = formatDateMx(currentWindow.end);
  const windowTargetFriendly = formatDateMx(currentWindow.target);

  const hoyYmd = todayYmdLocal();

  const isInsideWindow = hoyYmd >= windowStartYmd && hoyYmd <= windowEndYmd;
  const isExtraordinary = !!(STATUS && STATUS.isExtraordinary);
  const canCaptureLocal = isInsideWindow || isExtraordinary;
  const isCaptureDayLocal = hoyYmd === windowTargetYmd;

  // Si la ventana está cerrada, limpiar el formulario y no permitir edición
  if (!canCaptureLocal) {
    if (r.data && r.data.rows) {
      r.data.rows.forEach(row => {
        row.existencia_actual_frascos = "";
        row.pedido_frascos = "";
      });
    }
    r.data.hasSavedBio = false;
  }

  let windowStatus = "EXTRAORDINARY";
  if (isInsideWindow) windowStatus = "OPEN";

  BIO_STATE = {
    rows: r.data.rows || [],
    isCaptureDay: isCaptureDayLocal,
    isInsideWindow: isInsideWindow,
    canCapture: canCaptureLocal,
    fechaPedidoProgramada: windowTargetYmd,
    fechaPedidoFriendly: windowTargetFriendly,
    captureWindowStart: windowStartFriendly,
    captureWindowEnd: windowEndFriendly,
    captureWindowStartYmd: windowStartYmd,
    captureWindowEndYmd: windowEndYmd,
    captureWindowStatus: windowStatus,
    diffDays: 0
  };



  HAS_SAVED_BIO = !!r.data.hasSavedBio;
  EDIT_BIO = false;

  if ($("fechaPedidoBIO")) $("fechaPedidoBIO").value = BIO_STATE.fechaPedidoProgramada || "";
  if ($("fechaPedidoBIOBox")) $("fechaPedidoBIOBox").textContent = BIO_STATE.fechaPedidoFriendly || "—";

  // Evaluar si es "Solo Existencias" (todos los pedidos_frascos en la base de datos están vacíos o en 0)
  let isOnlyStockSaved = false;
  if (HAS_SAVED_BIO && BIO_STATE.rows && BIO_STATE.rows.length > 0) {
    isOnlyStockSaved = BIO_STATE.rows.every(row => !row.pedido_frascos || Number(row.pedido_frascos) === 0);
  }

  // Configurar toggle de "No hacer pedido"
  const chkNoPedido = $("chkNoPedido");
  if (chkNoPedido) {
    chkNoPedido.checked = isOnlyStockSaved;
    
    // Listener interactivo para manejar la habilitación/deshabilitación y estilo de la tarjeta
    const updateStockOnlyUI = () => {
      const isChecked = chkNoPedido.checked;
      const card = $("cardNoPedido");
      const iconBg = $("iconNoPedidoBg");
      const label = $("labelNoPedido");
      const hint = $("hintNoPedido");
      
      if (card) {
        if (isChecked) {
          card.style.backgroundColor = "#f0fdf4"; // Verde muy claro premium
          card.style.borderColor = "#bbf7d0";
          if (iconBg) {
            iconBg.style.backgroundColor = "#dcfce7";
            iconBg.style.color = "#16a34a";
          }
          if (label) label.style.color = "#15803d";
          if (hint) {
            hint.innerHTML = "Modo: <b>Reportando solo existencias</b> (pedido en ceros).";
            hint.style.color = "#166534";
          }
        } else {
          card.style.backgroundColor = "#ffffff";
          card.style.borderColor = "#e2e8f0";
          if (iconBg) {
            iconBg.style.backgroundColor = "";
            iconBg.style.color = "";
          }
          if (label) label.style.color = "";
          if (hint) {
            hint.innerHTML = "Activa esta opción si <b>NO</b> necesitas realizar pedido este mes.";
            hint.style.color = "";
          }
        }
      }
      
      // Bloquear/desbloquear inputs de la columna "pedido"
      document.querySelectorAll('input[data-kind="pedido"]').forEach(inp => {
        if (isChecked) {
          // Guardar valor anterior en memoria antes de poner a 0
          if (!inp.dataset.preVal) inp.dataset.preVal = inp.value;
          inp.value = "0";
          inp.disabled = true;
          inp.style.opacity = "0.5";
          inp.style.backgroundColor = "#f1f5f9";
        } else {
          // Restaurar valor anterior si existía
          if (inp.dataset.preVal !== undefined) {
            inp.value = inp.dataset.preVal;
            delete inp.dataset.preVal;
          }
          // Habilitar solo si el formulario global no está bloqueado
          const formBioLocked = HAS_SAVED_BIO && !EDIT_BIO;
          inp.disabled = formBioLocked;
          inp.style.opacity = "";
          inp.style.backgroundColor = "";
        }
      });
      refreshBioAlerts();
    };

    chkNoPedido.onchange = updateStockOnlyUI;
    // Ejecutar inmediatamente para configurar el estado inicial
    setTimeout(updateStockOnlyUI, 50);
  }

  const bioHint = $("bioHint");
  const bioDayAlert = $("bioDayAlert");

  if (bioDayAlert) {
    if (BIO_STATE.isInsideWindow) {
      if (BIO_STATE.isCaptureDay) {
        if (bioHint) bioHint.textContent = "Día objetivo de pedido mensual.";
        bioDayAlert.className = "bioDayAlert show bg-blue-50 border-2 border-blue-200 text-blue-700";
        const icon = bioDayAlert.querySelector(".bioDayIcon");
        if (icon) icon.className = "bioDayIcon w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-100 text-blue-700";
        const msg = bioDayAlert.querySelector(".bioDayMsg");
        if (msg) msg.innerHTML = `<b>PEDIDO MENSUAL:</b> captura habilitada hoy (fecha objetivo). Ventana: ${BIO_STATE.captureWindowStart} al ${BIO_STATE.captureWindowEnd}.`;
      } else {
        if (bioHint) bioHint.textContent = "Captura de pedido mensual habilitada.";
        bioDayAlert.className = "bioDayAlert show bg-blue-50 border-2 border-blue-200 text-blue-700";
        const icon = bioDayAlert.querySelector(".bioDayIcon");
        if (icon) icon.className = "bioDayIcon w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-100 text-blue-700";
        const msg = bioDayAlert.querySelector(".bioDayMsg");
        if (msg) msg.innerHTML = `<b>PEDIDO MENSUAL:</b> te encuentras dentro de la ventana operativa (${BIO_STATE.captureWindowStart} al ${BIO_STATE.captureWindowEnd}).`;
      }
    } else if (isExtraordinary) {
      if (bioHint) bioHint.textContent = "Apertura extraordinaria activa.";
      bioDayAlert.className = "bioDayAlert show bg-amber-50 border-2 border-amber-300 text-amber-800";
      const icon = bioDayAlert.querySelector(".bioDayIcon");
      if (icon) icon.className = "bioDayIcon w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-100 text-amber-800";
      const msg = bioDayAlert.querySelector(".bioDayMsg");
      if (msg) msg.innerHTML = `<b>PEDIDO EXTRAORDINARIO:</b> hoy te encuentras fuera del periodo ordinario, pero habilitado por instrucción administrativa. Ventana ordinaria era del ${BIO_STATE.captureWindowStart} al ${BIO_STATE.captureWindowEnd}.`;
    } else {
      if (bioHint) bioHint.textContent = "Ventana de captura cerrada.";
      bioDayAlert.className = "bioDayAlert show bg-red-50 border-2 border-red-200 text-red-700";
      const icon = bioDayAlert.querySelector(".bioDayIcon");
      if (icon) icon.className = "bioDayIcon w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-red-100 text-red-700";
      const msg = bioDayAlert.querySelector(".bioDayMsg");
      if (msg) msg.innerHTML = `<b>VENTANA CERRADA:</b> la ventana operativa ordinaria (${BIO_STATE.captureWindowStart} al ${BIO_STATE.captureWindowEnd}) ha concluido.`;
    }
  }

  renderBioRows(BIO_STATE.rows || []);
  applyCaptureLockState();
  updateCaptureStateBanner();
}

function setEditModeSR(on) {
  EDIT_SR = !!on;
  applyCaptureLockState();
  updateCaptureStateBanner();
  syncCommandHub();
}

function setEditModeCONS(on) {
  EDIT_CONS = !!on;
  applyCaptureLockState();
  updateCaptureStateBanner();
  syncCommandHub();
}

function setEditModeBIO(on) {
  EDIT_BIO = !!on;
  applyCaptureLockState();
  updateCaptureStateBanner();
  syncCommandHub();
  
  // Forzar que el switch y los inputs de pedido se sincronicen con el nuevo estado de edición
  const chk = $("chkNoPedido");
  if (chk && typeof chk.onchange === "function") {
    chk.onchange();
  }
}

function setFormLocked(formId, locked) {
  const form = $(formId);
  if (!form) return;

  form.classList.toggle("formLocked", !!locked);

  form.querySelectorAll("input, select, textarea, button").forEach(el => {
    if (!el) return;
    if (el.id === "aguja_0600403711") return; // ya es automático
    // No bloquear el botón de "Agregar otro lote" si es necesario, 
    // pero sí los de eliminar.
    if (el.classList.contains("md-delete-btn") || el.classList.contains("md-clone-btn") || el.tagName === "INPUT" || el.tagName === "SELECT") {
      el.disabled = !!locked;
    }
    // El botón de "Agregar otro lote" (btnAddSRRow) también debe bloquearse
    if (el.id === "btnAddSRRow") el.disabled = !!locked;
  });
}

function applyCaptureLockState() {
  // SR
  const srLocked = HAS_TODAY_SR && !EDIT_SR;
  setFormLocked("formSR", srLocked);

  if ($("btnSaveSR")) {
    $("btnSaveSR").disabled = srLocked;
    $("btnSaveSR").textContent = EDIT_SR ? "Actualizar existencia" : "Guardar existencia";
  }

  if ($("btnEditSR")) {
    $("btnEditSR").style.display = (!EDIT_SR && HAS_TODAY_SR) ? "inline-flex" : "none";
    $("btnEditSR").classList.toggle("editCallout", !EDIT_SR && HAS_TODAY_SR);
  }

  if ($("btnCancelEditSR")) {
    $("btnCancelEditSR").style.display = EDIT_SR ? "inline-flex" : "none";
  }

  // CONSUMIBLES
  const consLocked = HAS_TODAY_CONS && !EDIT_CONS;
  setFormLocked("formCONS", consLocked);

  if ($("btnSaveCONS")) {
    $("btnSaveCONS").disabled = consLocked;
    $("btnSaveCONS").textContent = EDIT_CONS ? "Actualizar consumibles" : "Guardar consumibles";
  }

  if ($("btnEditCONS")) {
    $("btnEditCONS").style.display = (!EDIT_CONS && HAS_TODAY_CONS) ? "inline-flex" : "none";
    $("btnEditCONS").classList.toggle("editCallout", !EDIT_CONS && HAS_TODAY_CONS);
  }

  if ($("btnCancelEditCONS")) {
    $("btnCancelEditCONS").style.display = EDIT_CONS ? "inline-flex" : "none";
  }

  // BIOLÓGICOS
  const bioLocked = HAS_SAVED_BIO && !EDIT_BIO;
  setFormLocked("formBIO", bioLocked);

  if ($("btnSaveBIO")) {
    $("btnSaveBIO").disabled = bioLocked || (typeof BIO_STATE !== "undefined" && !BIO_STATE.canCapture);
    // Usamos la clase blindada en style.css para evitar que el botón desaparezca
    $("btnSaveBIO").className = "btn-save-premium";
    $("btnSaveBIO").textContent = EDIT_BIO ? "Actualizar pedido de biológico" : "Guardar pedido de biológico";
  }

  if ($("btnEditBIO")) {
    $("btnEditBIO").style.display = (!EDIT_BIO && HAS_SAVED_BIO) ? "inline-flex" : "none";
    $("btnEditBIO").classList.toggle("editCallout", !EDIT_BIO && HAS_SAVED_BIO);
    $("btnEditBIO").disabled = false;
  }

  if ($("btnCancelEditBIO")) {
    $("btnCancelEditBIO").style.display = EDIT_BIO ? "inline-flex" : "none";
    $("btnCancelEditBIO").disabled = false;
  }

  if ($("btnBioConfirmCancel")) {
    $("btnBioConfirmCancel").disabled = false;
  }

  if ($("btnBioConfirmAccept")) {
    $("btnBioConfirmAccept").disabled = false;
  }
  syncCommandHub();
}

function loadExistenciaIntoForm(srData) {
  if (!srData) return;

  if ($("nombreSR")) {
    $("nombreSR").value =
      srData.nombre_responsable ??
      srData.capturado_por ??
      "";
  }

  const tbody = $("srCaptureTbody");
  if (tbody) {
    tbody.innerHTML = "";
    if (srData.items && srData.items.length) {
      srData.items.forEach(item => addSRRow(item));
    } else {
      // Fallback: Si no hay items pero hay valores legado, podríamos intentar reconstruir,
      // pero mejor empezamos limpio o agregamos 1 fila vacía.
      addSRRow();
    }
  }

  const FIELD_MAP = {
    bcg: "bcg",
    hepatitis_b: "hepatitis_b",
    hexavalente: "hexavalente",
    dpt: "dpt",
    rotavirus: "rotavirus",
    neumococica_13: "neumococica_13",
    neumococica_20: "neumococica_20",
    srp: "srp",
    sr: "sr",
    vph: "vph",
    varicela: "varicela",
    hepatitis_a: "hepatitis_a",
    td: "td",
    tdpa: "tdpa",
    covid_19: "covid_19",
    influenza: "influenza",
    vsr: "vsr"
  };

  const original = {};

  Object.keys(FIELD_MAP).forEach((key) => {
    const inputId = FIELD_MAP[key];
    const el = $(inputId);
    const value = srData[key] ?? "";

    if (el) el.value = value;
    original[key] = String(value);
  });

  ORIGINAL_SR = original;
}

function loadCONSIntoForm(consData) {
  if (!consData) return;

  if ($("nombreCONS")) $("nombreCONS").value = consData.capturado_por || "";
  if ($("srp_dosis")) $("srp_dosis").value = consData.srp_dosis ?? "";
  if ($("sr_dosis")) $("sr_dosis").value = consData.sr_dosis ?? "";
  if ($("jeringa_reconst_5ml_0605500438")) $("jeringa_reconst_5ml_0605500438").value = consData.jeringa_reconst_5ml_0605500438 ?? "";
  if ($("jeringa_aplic_05ml_0605502657")) $("jeringa_aplic_05ml_0605502657").value = consData.jeringa_aplic_05ml_0605502657 ?? "";
  syncAguja();

  ORIGINAL_CONS = {
    srp_dosis: String(consData.srp_dosis ?? ""),
    sr_dosis: String(consData.sr_dosis ?? ""),
    jeringa_reconst_5ml_0605500438: String(consData.jeringa_reconst_5ml_0605500438 ?? ""),
    jeringa_aplic_05ml_0605502657: String(consData.jeringa_aplic_05ml_0605502657 ?? "")
  };
}

function setExistenciaReadiness(hasTodayRecord) {
  HAS_TODAY_SR = !!hasTodayRecord;
  setEditModeSR(false);
}

function setCONSReadiness(hasTodayRecord) {
  HAS_TODAY_CONS = !!hasTodayRecord;
  setEditModeCONS(false);
}

function normalizeTodayReports(data) {
  const raw = (data && typeof data === "object") ? data : {};
  const src = raw.data && typeof raw.data === "object" ? raw.data : raw;

  const sr = src.sr || null;
  const cons = src.cons || null;

  console.log("normalizeTodayReports input:", data);
  console.log("normalizeTodayReports output:", { sr, cons });

  return { sr, cons };
}

async function reloadTodayState() {
  try {
    const todayStr = todayYmdLocal();
    let today = await getTodayReports(todayStr);

    const dow = new Date().getDay();
    let isPrefill = false;

    // Persistencia Viernes (edita Jueves)
    if ((!today || !today.sr) && dow === 5) {
      const dYesterday = new Date();
      dYesterday.setDate(dYesterday.getDate() - 1);
      const yesterdayStr = dYesterday.toISOString().split('T')[0];
      const yesterday = await getTodayReports(yesterdayStr, true);

      if (yesterday && yesterday.sr) {
        if (!today) today = {};
        today.sr = yesterday.sr;
      }
    }

    // Pre-llenado semanal
    if (!today || !today.sr) {
      // Visual feedback on Friday if empty
      if (dow === 5) {
        const titleContainer = document.querySelector("#panelSR h1, #panelSR h2");
        if (titleContainer && !document.querySelector(".chip-pending")) {
          titleContainer.insertAdjacentHTML("beforeend", `<span class="chip-pending ml-4" style="vertical-align: middle;"><span class="material-symbols-rounded">pending_actions</span> Captura pendiente</span>`);
        }
      }

      const prefillData = await execPrefillSemanal(todayStr);
      if (prefillData) {
        if (!today) today = {};
        today.sr = prefillData;
        isPrefill = true;
      }
    }

    console.log("reloadTodayState today:", today);
    hydrateTodayForms(today);

    if (isPrefill) {
      const prefillDate = today.sr.fecha_prefill || today.sr.fecha;
      const userClues = (window.USER && window.USER.clues) ? window.USER.clues : 'unknown';
      const ackKey = `prefill_ack_${userClues}_${todayStr}`;

      if (!localStorage.getItem(ackKey)) {
        await openPrefillNotice(prefillDate);
        localStorage.setItem(ackKey, 'true');
      }

      EDIT_SR = false; // Es un insert nuevo para "hoy"
      HAS_TODAY_SR = false; // Desbloqueamos el form para que lo guarden de nuevo
      applyCaptureLockState(); // Refrescar los botones y el estado locked
    } else {
      window.PREFILL_SNAPSHOT = null;
    }
  } catch (e) {
    console.error("reloadTodayState error:", e);
  }
}

window.PREFILL_SNAPSHOT = null;

function openPrefillNotice(dateStr) {
  return new Promise((resolve) => {
    let overlay = $("prefillNoticeOverlay");
    if (!overlay) return resolve();
    if (overlay.parentNode !== document.body) {
      document.body.appendChild(overlay);
    }
    const msgEl = $("prefillNoticeMsg");
    if (msgEl) {
      if (dateStr && dateStr !== "undefined") {
        msgEl.innerHTML = "Hemos precargado tu última captura del día <b style='color: #0284c7;'>" + dateStr + "</b> para ahorrarte tiempo.";
      } else {
        msgEl.innerHTML = "Hemos precargado tu última captura de biológicos para ahorrarte tiempo.";
      }
    }
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        closePrefillNotice();
        resolve();
      }
    };
    const btnAccept = overlay.querySelector("#btnPrefillNoticeAccept");
    if (btnAccept) {
      btnAccept.onclick = () => {
        closePrefillNotice();
        resolve();
      };
    }
    requestAnimationFrame(() => {
      overlay.classList.add("show");
    });
  });
}
function closePrefillNotice() {
  const overlay = $("prefillNoticeOverlay");
  if (overlay) overlay.classList.remove("show");
}

function openPrefillConfirm() {
  return new Promise((resolve) => {
    let overlay = $("prefillConfirmOverlay");
    if (!overlay) return resolve(true);
    if (overlay.parentNode !== document.body) {
      document.body.appendChild(overlay);
    }
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        closePrefillConfirm();
        resolve(false);
      }
    };
    const btnCancel = overlay.querySelector("#btnPrefillConfirmCancel");
    const btnAccept = overlay.querySelector("#btnPrefillConfirmAccept");
    if (btnCancel) {
      btnCancel.onclick = () => {
        closePrefillConfirm();
        resolve(false);
      };
    }
    if (btnAccept) {
      btnAccept.onclick = () => {
        closePrefillConfirm();
        resolve(true);
      };
    }
    requestAnimationFrame(() => {
      overlay.classList.add("show");
    });
  });
}
function closePrefillConfirm() {
  const overlay = $("prefillConfirmOverlay");
  if (overlay) overlay.classList.remove("show");
}

async function execPrefillSemanal(todayStr) {
  if (!USER || !USER.clues || !window.supabase) return null;
  try {
    const { data: lastReports } = await window.supabase
      .from('biologicos_existencia')
      .select('fecha')
      .eq('clues', USER.clues)
      .order('fecha', { ascending: false })
      .limit(1);

    if (lastReports && lastReports.length > 0) {
      const lastDate = lastReports[0].fecha;
      const t1 = new Date(lastDate).getTime();
      const t2 = new Date(todayStr).getTime();
      const diffDays = (t2 - t1) / (1000 * 3600 * 24);

      if (diffDays > 1) {
        const oldReport = await getTodayReports(lastDate, true);
        if (oldReport && oldReport.sr) {
          window.PREFILL_SNAPSHOT = JSON.stringify(oldReport.sr.items || []);
          oldReport.sr.fecha_prefill = lastDate;
          return oldReport.sr;
        }
      }
    }
  } catch (err) {
    console.error("execPrefillSemanal error:", err);
  }
  return null;
}


function hydrateTodayForms(todayData) {
  const normalized = normalizeTodayReports(todayData || {});

  TODAY_CACHE = normalized;

  console.log("hydrateTodayForms() RAW =>", todayData);
  console.log("hydrateTodayForms() NORMALIZED =>", TODAY_CACHE);

  HAS_TODAY_SR = !!TODAY_CACHE.sr;
  HAS_TODAY_CONS = !!TODAY_CACHE.cons;

  if (HAS_TODAY_SR) {
    loadExistenciaIntoForm(TODAY_CACHE.sr);
  } else {
    if ($("nombreSR")) $("nombreSR").value = "";
    ORIGINAL_SR = null;

    // Limpiar tabla dinámica y agregar fila inicial vacía
    const srTbody = $("srCaptureTbody");
    if (srTbody) {
      srTbody.innerHTML = "";
      if (typeof addSRRow === "function") addSRRow();
    }
  }

  if (HAS_TODAY_CONS) {
    loadCONSIntoForm(TODAY_CACHE.cons);
  } else {
    if ($("nombreCONS")) $("nombreCONS").value = "";
    if ($("srp_dosis")) $("srp_dosis").value = "";
    if ($("sr_dosis")) $("sr_dosis").value = "";
    if ($("jeringa_reconst_5ml_0605500438")) $("jeringa_reconst_5ml_0605500438").value = "";
    if ($("jeringa_aplic_05ml_0605502657")) $("jeringa_aplic_05ml_0605502657").value = "";
    if ($("aguja_0600403711")) $("aguja_0600403711").value = "";
    ORIGINAL_CONS = null;
  }

  setEditModeSR(false);
  setEditModeCONS(false);
  applyCaptureLockState();
  updateCaptureStateBanner();
  applyCaptureNameAutocomplete();
  bindFastNumericFocus();
}

function sanitizeExistenciaFieldValue(value) {
  const raw = String(value ?? "").trim();
  if (raw === "") return "0";

  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return raw;

  return String(n);
}

function hasExistenciaNumericChanges() {
  if (!ORIGINAL_SR) return true;

  const current = {
    bcg: sanitizeExistenciaFieldValue($("bcg") ? $("bcg").value : ""),
    hepatitis_b: sanitizeExistenciaFieldValue($("hepatitis_b") ? $("hepatitis_b").value : ""),
    hexavalente: sanitizeExistenciaFieldValue($("hexavalente") ? $("hexavalente").value : ""),
    dpt: sanitizeExistenciaFieldValue($("dpt") ? $("dpt").value : ""),
    rotavirus: sanitizeExistenciaFieldValue($("rotavirus") ? $("rotavirus").value : ""),
    neumococica_13: sanitizeExistenciaFieldValue($("neumococica_13") ? $("neumococica_13").value : ""),
    neumococica_20: sanitizeExistenciaFieldValue($("neumococica_20") ? $("neumococica_20").value : ""),
    srp: sanitizeExistenciaFieldValue($("srp") ? $("srp").value : ""),
    sr: sanitizeExistenciaFieldValue($("sr") ? $("sr").value : ""),
    vph: sanitizeExistenciaFieldValue($("vph") ? $("vph").value : ""),
    varicela: sanitizeExistenciaFieldValue($("varicela") ? $("varicela").value : ""),
    hepatitis_a: sanitizeExistenciaFieldValue($("hepatitis_a") ? $("hepatitis_a").value : ""),
    td: sanitizeExistenciaFieldValue($("td") ? $("td").value : ""),
    tdpa: sanitizeExistenciaFieldValue($("tdpa") ? $("tdpa").value : ""),
    covid_19: sanitizeExistenciaFieldValue($("covid_19") ? $("covid_19").value : ""),
    influenza: sanitizeExistenciaFieldValue($("influenza") ? $("influenza").value : ""),
    vsr: sanitizeExistenciaFieldValue($("vsr") ? $("vsr").value : "")
  };

  return Object.keys(current).some(key => {
    const original = sanitizeExistenciaFieldValue(ORIGINAL_SR[key] ?? "");
    return current[key] !== original;
  });
}
function hasCONSNumericChanges() {
  syncAguja();

  if (!ORIGINAL_CONS) return true;

  const current = {
    srp_dosis: String($("srp_dosis") ? $("srp_dosis").value : ""),
    sr_dosis: String($("sr_dosis") ? $("sr_dosis").value : ""),
    jeringa_reconst_5ml_0605500438: String($("jeringa_reconst_5ml_0605500438") ? $("jeringa_reconst_5ml_0605500438").value : ""),
    jeringa_aplic_05ml_0605502657: String($("jeringa_aplic_05ml_0605502657") ? $("jeringa_aplic_05ml_0605502657").value : "")
  };

  return (
    current.srp_dosis !== ORIGINAL_CONS.srp_dosis ||
    current.sr_dosis !== ORIGINAL_CONS.sr_dosis ||
    current.jeringa_reconst_5ml_0605500438 !== ORIGINAL_CONS.jeringa_reconst_5ml_0605500438 ||
    current.jeringa_aplic_05ml_0605502657 !== ORIGINAL_CONS.jeringa_aplic_05ml_0605502657
  );
}

function renderCaptureSummary(data) {
  console.log("[renderCaptureSummary DEBUG] Iniciando render con datos:", data);
  if (!document.getElementById("panelCaptureSummary")) return;
  const fecha = data?.fecha || "";
  const tipo = data?.tipo || "SR";

  // Título Dinámico Premium
  const titleEl = document.getElementById("captureSummaryTitle");
  if (titleEl) {
    const tipoTxt = tipo === "CONS" ? "Consumibles" : (tipo === "BIO" ? "Pedido de biológico" : "Existencia de biológicos");
    let t = `Resumen de captura de ${tipoTxt}`;
    if ((tipo === "SR" || tipo === "CONS") && data.fIniStr && data.fFinStr) {
      t += ` (Semana del ${formatAppDate(data.fIniStr)} al ${formatAppDate(data.fFinStr)})`;
    } else if (tipo === "BIO" && fecha) {
      const dateObj = new Date(`${fecha}T12:00:00`);
      const monthName = dateObj.toLocaleString('es-MX', { month: 'long' });
      t += ` (${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${dateObj.getFullYear()})`;
    }
    titleEl.textContent = t;
  }

  // Lógica de Selector de Pedidos Extraordinarios
  let windowSelectorContainer = document.getElementById("captureSummaryWindowContainer");
  if (!windowSelectorContainer) {
    windowSelectorContainer = document.createElement("div");
    windowSelectorContainer.id = "captureSummaryWindowContainer";
    windowSelectorContainer.className = "mt-2 mb-4 max-w-sm";
    const headerRow = titleEl ? titleEl.parentNode : document.getElementById("panelCaptureSummary");
    headerRow.parentNode.insertBefore(windowSelectorContainer, headerRow.nextSibling);
  }

  if (data.available_windows && data.available_windows.length > 1) {
    let optionsHtml = data.available_windows.map(w => {
      const isSelected = data.active_window && data.active_window.fecha === w.fecha && data.active_window.tipo_pedido === w.tipo_pedido;
      return `<option value="${w.fecha}|${w.tipo_pedido}" ${isSelected ? 'selected' : ''}>${w.tipo_pedido} (Ventana: ${formatAppDate(w.fecha)})</option>`;
    }).join("");

    windowSelectorContainer.innerHTML = `
      <label class="text-[11px] font-black text-primary/50 uppercase tracking-widest block mb-2 ml-1">Múltiples pedidos detectados, selecciona uno:</label>
      <div class="modern-input-group">
        <span class="input-icon material-symbols-rounded">filter_list</span>
        <select id="captureSummaryWindowSelect">
          ${optionsHtml}
        </select>
      </div>
    `;

    const selectEl = document.getElementById("captureSummaryWindowSelect");
    selectEl.onchange = (e) => {
      const [selFecha, selTipo] = e.target.value.split("|");
      const payload = {
        action: "adminCaptureOverview",
        fecha: data.fecha,
        tipo: data.tipo,
        targetWindow: { fecha: selFecha, tipo_pedido: selTipo }
      };
      showOverlay("Cargando ventana...", "Resumen");
      supabaseRequest("admincaptureoverview", payload).then(res => {
        hideOverlay();
        if (res && res.ok) renderCaptureSummary(res.data);
      }).catch(err => {
        hideOverlay();
        console.error("Error al cargar ventana:", err);
      });
    };
  } else {
    windowSelectorContainer.innerHTML = "";
  }

  // Lógica de Ventana Inteligente para Pedido
  let extraInfo = "";
  if (tipo === "BIO" && fecha) {
    let windowStart, windowEnd, source;

    // 1. Prioridad: Calendario Administrativo (Apertura Manual)
    if (data.calendar_override) {
      windowStart = data.calendar_override.habilitar_desde.split("T")[0]; // ISO Date
      windowEnd = data.calendar_override.habilitar_hasta.split("T")[0];
      source = "Administración (Manual)";
    } else {
      // 2. Fallback: Algoritmo Inteligente (Día 22 +/- hábiles)
      const d = new Date(fecha + "T00:00:00");
      const window = getBioCaptureWindow(d.getFullYear(), d.getMonth() + 1);
      windowStart = dateToLocalYmd(window.start);
      windowEnd = dateToLocalYmd(window.end);
      source = "Algoritmo Inteligente";
    }

    const isInside = (fecha >= windowStart && fecha <= windowEnd);
    if (isInside) {
      extraInfo = `<span class="statusOk" style="background:#e8f5e9; color:#2e7d32; padding:4px 12px; border-radius:12px; font-size:11px; font-weight:800; border:1px solid #c8e6c9;">✅ Ventana oficial: ${windowStart} al ${windowEnd}</span>`;
    } else {
      extraInfo = `<span class="statusWarn" style="background:#fff3e0; color:#ef6c00; padding:4px 12px; border-radius:12px; font-size:11px; font-weight:800; border:1px solid #ffe0b2;">⚠️ Pedido extraordinario (Fuera de ventana)</span>`;
    }
  }

  $("sumFecha").textContent = fecha || "—";
  animateCounter("sumTotal", parseInt($("sumTotal").textContent) || 0, data?.total_unidades ?? 0);
  animateCounter("sumCapturadas", parseInt($("sumCapturadas").textContent) || 0, data?.total_capturadas ?? 0);
  animateCounter("sumFaltantes", parseInt($("sumFaltantes").textContent) || 0, data?.total_faltantes ?? 0);

  // 🛡️ FILTRO DE TIPO DE PEDIDO (Solo para BIO)
  let capturadas = data?.capturadas || [];
  let faltantes = data?.faltantes || [];

  if (tipo === "BIO") {
    const existingTypes = [...new Set(capturadas.map(c => c.tipo_pedido || "MENSUAL"))];
    if (existingTypes.length > 0) {
      let filterHtml = `
          <div class="flex items-center gap-3 bg-slate-100 p-3 rounded-2xl border border-slate-200 mt-4">
            <span class="text-[11px] font-black uppercase tracking-wider text-slate-500 ml-2">Filtrar por:</span>
            <select id="filterBioType" class="bg-white border border-slate-300 rounded-xl px-3 h-10 text-[13px] font-bold text-primary outline-none focus:border-primary shadow-sm">
              <option value="ALL">Todos los pedidos</option>
              ${existingTypes.map(t => `<option value="${t}">${t === "MENSUAL" ? "Pedido Mensual" : "Pedido Extraordinario"}</option>`).join("")}
            </select>
          </div>
        `;
      extraInfo += filterHtml;

      setTimeout(() => {
        const sel = $("filterBioType");
        if (sel) {
          sel.onchange = () => {
            const val = sel.value;
            const filtered = val === "ALL" ? data.capturadas : data.capturadas.filter(c => (c.tipo_pedido || "MENSUAL") === val);
            renderCapturadasOnly(filtered);
          };
        }
      }, 100);
    }
  }

  function renderCapturadasOnly(list) {
    const tbodyCap = $("capturadasTbody");
    if (!list.length) {
      const msg = "No hay capturas registradas";
      tbodyCap.innerHTML = `<tr><td colspan="5" class="muted">${msg}</td></tr>`;
      return;
    }
    const sortedList = [...list].sort((a, b) => {
      const cluesA = String(a.clues || a.CLUES || "").trim().toUpperCase();
      const cluesB = String(b.clues || b.CLUES || "").trim().toUpperCase();
      return cluesA.localeCompare(cluesB);
    });
    tbodyCap.innerHTML = sortedList.map(r => {
      // Determinar estado visual: verde (OK), azul (sin pedido BIO), ámbar (con ceros SR)
      let iconColor = '#22c55e'; // Verde: capturado normal
      let iconTitle = r.editado === 'SI' ? 'Editado' : 'Capturado';
      let extraTag = '';

      if (r.sin_pedido) {
        iconColor = '#3b82f6'; // Azul: sin pedido biológico
        iconTitle = 'Sin pedido de biológico (Solo Existencias)';
      } else if (r.tiene_ceros) {
        iconColor = '#f43f5e'; // Carmesí/Rosa: capturó con algún biológico en cero
        iconTitle = 'Capturó con algún biológico sin existencia';
        extraTag = '';
      }

      const tipoPedidoTag = r.tipo_pedido
        ? `<span class="opacity-60 font-black uppercase text-[10px] tracking-tighter" style="background:#f1f5f9; padding:2px 6px; border-radius:6px">${r.tipo_pedido}</span>`
        : '';

      return `
        <tr${r.tiene_ceros ? ' style="background: #fff5f5;"' : ''}>
          <td data-label="Municipio">${escapeHtml(r.municipio || '')}</td>
          <td data-label="CLUES">${escapeHtml(r.clues || '')}</td>
          <td data-label="Unidad">${escapeHtml(r.unidad || '')}</td>
          <td data-label="Estatus">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%">
              <div style="display:flex; align-items:center; gap:8px">
                <span class="material-symbols-rounded" style="color: ${iconColor}; font-size: 24px; vertical-align: middle;" title="${iconTitle}">check_circle</span>
                ${tipoPedidoTag}${extraTag}
              </div>
              <button class="live-view-btn-v2" onclick="openLiveView('${r.clues}','${escapeHtml(r.unidad)}','${escapeHtml(r.municipio)}')" title="Ver inventario en vivo">
                 <span class="material-symbols-rounded">visibility</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderFaltantesOnly(list) {
    const tbodyFal = $("faltantesTbody");
    if (!list.length) {
      const msg = "No hay pendientes";
      tbodyFal.innerHTML = `<tr><td colspan="4" class="muted">${msg}</td></tr>`;
      return;
    }
    const sortedList = [...list].sort((a, b) => {
      const cluesA = String(a.clues || a.CLUES || "").trim().toUpperCase();
      const cluesB = String(b.clues || b.CLUES || "").trim().toUpperCase();
      return cluesA.localeCompare(cluesB);
    });
    tbodyFal.innerHTML = sortedList.map(r => `
        <tr>
          <td data-label="Municipio">${escapeHtml(r.municipio || "")}</td>
          <td data-label="CLUES">${escapeHtml(r.clues || "")}</td>
          <td data-label="Unidad">${escapeHtml(r.unidad || "")}</td>
          <td data-label="Estatus" style="text-align: center;">
            <span class="material-symbols-rounded" style="color: var(--warn); font-size: 24px; vertical-align: middle;" title="Pendiente">pending</span>
          </td>
        </tr>
      `).join("");
  }

  // Mostrar u ocultar la nomenclatura dinámica según la vista activa
  const legendBio = $("legendBioSinPedido");
  if (legendBio) {
    legendBio.style.display = (tipo === "BIO") ? "flex" : "none";
  }

  // Leyenda de ceros: siempre visible en SR
  const legendCeros = $("legendBioConCeros");
  if (legendCeros) {
    legendCeros.style.display = (tipo === "SR") ? "flex" : "none";
  }

  renderCapturadasOnly(capturadas);
  renderFaltantesOnly(faltantes);
  
  window.currentFaltantesWhatsApp = faltantes;
  window.currentTipoWhatsApp = tipo;
}

window.generateWhatsAppTemplate = function() {
  if (!window.currentFaltantesWhatsApp || window.currentFaltantesWhatsApp.length === 0) {
    Swal.fire('Sin faltantes', 'No hay unidades pendientes para copiar.', 'info');
    return;
  }
  
  let titulo = "Pendientes";
  if (window.currentTipoWhatsApp === "BIO") titulo = "Pedido de biológico";
  else if (window.currentTipoWhatsApp === "CONS") titulo = "Consumibles";
  else if (window.currentTipoWhatsApp === "SR") titulo = "Existencia de biológico";
  
  let texto = `${titulo}\n\n`;
  window.currentFaltantesWhatsApp.forEach(r => {
    const unitName = (r.unidad || '').toUpperCase().trim();
    texto += `*${unitName} - PENDIENTE*\n`;
  });
  
  navigator.clipboard.writeText(texto).then(() => {
    Swal.fire({
      icon: 'success',
      title: '¡Copiado!',
      text: 'La plantilla se ha copiado al portapapeles lista para pegar en WhatsApp.',
      timer: 2000,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    });
  }).catch(err => {
    console.error("Error copiando al portapapeles:", err);
    Swal.fire('Error', 'No se pudo copiar el texto automáticamente.', 'error');
  });
};

function populateHistoryMunicipioFilter(user) {
  const container = $("filterMunicipioContainer");
  const select = $("histMunicipioFilter");
  if (!container || !select) return;

  const role = String(user.rol || "").toUpperCase();
  const allowed = Array.isArray(user.municipiosAllowed) ? user.municipiosAllowed : [];

  if (role === "ADMIN" || role === "JURISDICCIONAL") {
    // Admin/Jurisdiccional see all 4 municipalities, plus a "Todos" option
    select.innerHTML = `
      <option value="TODOS">Todos los municipios</option>
      <option value="QUERÉTARO">Querétaro</option>
      <option value="CORREGIDORA">Corregidora</option>
      <option value="EL MARQUÉS">El Marqués</option>
      <option value="HUIMILPAN">Huimilpan</option>
    `;
    container.style.display = "flex";
  } else if (role === "MUNICIPAL" && allowed.length > 0) {
    if (allowed.length > 1) {
      // Municipal user with multiple municipalities
      let html = "";
      allowed.forEach(m => {
        html += `<option value="${m.toUpperCase()}">${m}</option>`;
      });
      select.innerHTML = html;
      container.style.display = "flex";
    } else {
      // Municipal user with only 1 municipality: hide selector but set value
      select.innerHTML = `<option value="${allowed[0].toUpperCase()}">${allowed[0]}</option>`;
      container.style.display = "none";
    }
  } else {
    // Unidad or other roles: hide
    select.innerHTML = "";
    container.style.display = "none";
  }
}

function setLoggedInUI(user, status) {
  USER = user;
  document.body.setAttribute("data-role", USER.rol);
  STATUS = (status && status.data) ? status.data : (status || null);

  Object.assign(AppState, {
    user: USER,
    status: STATUS,
    token: (typeof TOKEN !== "undefined") ? TOKEN : "",
    mainPanel: "CAP"
  });

  const fechaHoy = todayYmdLocal();
  if ($("histMesEvaluacion") && !$("histMesEvaluacion").value) {
    $("histMesEvaluacion").value = fechaHoy.substring(0, 7);
  }

  // DOM ERADICATION FOR UNIDAD ROLE
  if (AppState.rol === "UNIDAD" || (typeof USER !== 'undefined' && USER.rol === "UNIDAD")) {
    const forbiddenPanels = [
      document.getElementById("panelCaptureSummary"),
      // Add any other strictly ADMIN-only parent containers here if necessary
    ];
    forbiddenPanels.forEach(p => {
      if (p) { 
        p.classList.add("hidden"); 
        p.style.setProperty("display", "none", "important"); 
      }
    });
  }

  if ($("who")) $("who").textContent = `${user.clues || "—"} — ${user.unidad || "—"}`;
  if ($("userNameFull")) $("userNameFull").textContent = user.nombre || user.usuario || "Usuario";
  if ($("rolTxt")) $("rolTxt").textContent = (user.rol || "UNIDAD").replace(/^Perfil:\s*/i, "");

  const capTab = $("btnTabCAP");
  if (capTab) {
    if (user.rol === "UNIDAD") {
      capTab.classList.add("capture-header-mode");
      if ($("tabCAPText")) $("tabCAPText").textContent = "Captura";
    } else {
      capTab.classList.remove("capture-header-mode");
      if ($("tabCAPText")) $("tabCAPText").textContent = "Panel";
    }
  }

  if (user.rol === "ADMIN") {
    if ($("munTxt")) $("munTxt").textContent = "Todos";
    refreshUsers().catch(console.error);
    refreshBulkBioSetup?.();
  } else if (user.rol === "JURISDICCIONAL") {
    if ($("munTxt")) $("munTxt").textContent = "Todos";
  } else if (user.rol === "MUNICIPAL") {
    if ($("munTxt")) $("munTxt").textContent = (user.municipio || "—").replace(/^Municipio\(s\):\s*/i, "").replace(/^Municipio:\s*/i, "");
  } else {
    if ($("munTxt")) $("munTxt").textContent = (user.municipio || "—").replace(/^Municipio:\s*/i, "");
  }

  // 🛡️ Hierarchy & Role Detection (Senior implementation)
  const role = (user.rol || "UNIDAD").trim().toUpperCase();
  document.body.setAttribute('data-user-role', role);

  const isAdmin = role === "ADMIN";
  const isJurisdiccional = role === "JURISDICCIONAL";
  const isMunicipal = role === "MUNICIPAL";
  const isUnidad = role === "UNIDAD";
  const isCaravanas = role === "CARAVANAS";

  if ($("tabADMIN")) $("tabADMIN").style.display = isAdmin ? "block" : "none";
  // Tabs y botones de acceso rápido ahora se gestionan vía data-role-gate en applyRolePermissions

  if ($("tabOPS_ADMIN")) {
    $("tabOPS_ADMIN").onclick = () => activateOpsTab("SECURITY");
  }
  if ($("tabOPS_NOTIFS")) {
    $("tabOPS_NOTIFS").onclick = () => activateOpsTab("NOTIFICATIONS");
  }

  updateDynamicGreeting();
  applyRolePermissions(role);
  populateHistoryMunicipioFilter(user);


  if (STATUS) {
    if ($("dayTxt")) $("dayTxt").textContent = formatDayBadgeMx(STATUS.today);
    paintStatusChips(STATUS);
  }



  if ($("panelCAP")) $("panelCAP").style.display = isUnidad ? "block" : "none";
  const canSeeLotes = (isAdmin || isJurisdiccional);
  const canSeeAdminCenter = isAdmin;
  const canSeeNotifsCenter = (isAdmin || isJurisdiccional || isMunicipal || isCaravanas);
  const canSeePinol = (isAdmin || isMunicipal);
  const canExport = (isAdmin || isJurisdiccional || isMunicipal || isCaravanas);

  if ($("panelAdminOpsTabs")) $("panelAdminOpsTabs").style.display = (isAdmin || isJurisdiccional || isMunicipal || isCaravanas) ? "block" : "none";
  if ($("panelUnidadOpsTabs")) $("panelUnidadOpsTabs").style.display = isUnidad ? "block" : "none";
  if ($("tabLOTES")) $("tabLOTES").style.display = canSeeLotes ? "flex" : "none";
  if ($("tabOPS_PINOL")) $("tabOPS_PINOL").style.display = canSeePinol ? "flex" : "none";
  if ($("tabOPS_NOTIFS")) $("tabOPS_NOTIFS").style.display = canSeeNotifsCenter ? "flex" : "none";
  if ($("tabOPS_ADMIN")) $("tabOPS_ADMIN").style.display = canSeeAdminCenter ? "flex" : "none";

  // 🔥 Sincronizar indicador de navegación (Premium)
  setTimeout(() => {
    syncTabGroupIndicator('#panelAdminOpsTabs .nav-container');
    syncTabGroupIndicator('#panelUnidadOpsTabs .nav-container');
  }, 350);



  if ($("notifInboxPane")) {
    $("notifInboxPane").style.display = "none";
  }
  if ($("notifListWrap")) {
    $("notifListWrap").style.display = "none";
  }
  if ($("notifComposerPane")) {
    $("notifComposerPane").style.display = (isAdmin || isJurisdiccional || isMunicipal || isCaravanas) ? "block" : "none";
  }

  if ($("notifRoleKpi")) {
    $("notifRoleKpi").textContent = user.rol || "—";
  }

  if ($("panelNOTIFS")) $("panelNOTIFS").style.display = (isAdmin || isJurisdiccional || isMunicipal || isCaravanas) ? "" : "none";


  syncTopNotifMirror();
  closeTopNotifDropdown();

  if ($("tabCONS")) {
    $("tabCONS").disabled = false;
    $("tabCONS").title = "";
  }

  if (isUnidad) {
    Object.assign(AppState, { mainPanel: "CAP", captureTab: "SR" });
    activateDefaultMainForRole();
    loadBioForm().catch(err => console.error("loadBioForm error:", err));
    reloadTodayState();
  } else {
    Object.assign(AppState, { mainPanel: "CAP" });
    activateMain("CAP");
    refreshPinolBadgeOnly();
  }

  if (canExport) {
    if ($("exportConfigBox")) $("exportConfigBox").style.display = "block";

    const hoy = todayYmdLocal();
    if ($("exportFechaInicio")) $("exportFechaInicio").value = hoy;
    if ($("exportFechaFin")) $("exportFechaFin").value = hoy;

    if (typeof updateExportFechaHint === "function") updateExportFechaHint();
    if (typeof loadExportOptions === "function") loadExportOptions().catch(() => { });
  }

  runPostLoginInit(user);
}

function updateDynamicGreeting(timeGreeting = null, customSubtitle = null) {
  const welcomeEl = $("welcome");
  if (!welcomeEl) return;

  let title = timeGreeting;
  let subtitle = customSubtitle;

  // Helper for long Spanish date
  const getLongDateSpanish = () => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    let dateStr = new Date().toLocaleDateString('es-ES', options);
    // Capitalize first letter
    return dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  };

  const longDate = getLongDateSpanish();

  if (!title) {
    const hora = new Date().getHours();
    if (hora < 12) {
      title = "¡Buenos días!";
    } else if (hora < 19) {
      title = "¡Buenas tardes!";
    } else {
      title = "¡Buenas noches!";
    }



    if (!subtitle) {
      if (hora < 12) subtitle = "Qué bueno verte por aquí, iniciamos con éxito.";
      else if (hora < 19) subtitle = "Todo listo para continuar con la gestión.";
      else subtitle = "Seguimos trabajando con compromiso.";
    }

    if (typeof STATUS !== "undefined" && STATUS && STATUS.isExtraordinary) {
      subtitle = "⚠️ Captura extraordinaria activa.";
    }
  }

  const weatherEmoji = CURRENT_WEATHER.emoji || "";
  const weatherTemp = CURRENT_WEATHER.temp !== null ? `${CURRENT_WEATHER.temp}°C` : "";
  const weatherText = CURRENT_WEATHER.text || "";
  const weatherBg = CURRENT_WEATHER.bg || "";

  const theme = CURRENT_WEATHER.theme || 'dark-bg';
  const isDarkText = theme === 'light-bg';

  // Usar estilos inline (rgba) directos asegura que siempre haya contraste perfecto
  // porque evita fallas si Tailwind no compiló las clases text-white/80 o text-primary/70
  const colorTitle = isDarkText ? '#1e293b' : '#ffffff';
  const colorSub = isDarkText ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.8)';
  const colorResumen = isDarkText ? 'rgba(30, 41, 59, 0.6)' : 'rgba(255, 255, 255, 0.7)';
  const colorDivider = isDarkText ? 'rgba(30, 41, 59, 0.2)' : 'rgba(255, 255, 255, 0.2)';

  const parentEl = welcomeEl.parentElement;
  if (parentEl) {
    parentEl.classList.add("weather-hero-block");
    parentEl.setAttribute("data-theme", theme);
    parentEl.style.setProperty('--weather-bg', `url('${weatherBg}')`);

    const resumenSpan = parentEl.querySelector("span.uppercase");
    if (resumenSpan) {
      resumenSpan.className = `text-[10px] font-black uppercase tracking-[0.25em] mb-2 block relative z-10 transition-colors duration-500`;
      resumenSpan.style.color = colorResumen;
    }
  }

  welcomeEl.classList.remove("text-3xl", "sm:text-5xl");
  welcomeEl.classList.add("text-2xl", "sm:text-[30px]", "w-full", "relative", "z-10", "pt-1");
  welcomeEl.innerHTML = `
      <div class="flex flex-col lg:flex-row lg:items-center justify-between w-full gap-4">
        <div class="flex flex-col">
          <h1 class="text-[24px] sm:text-[30px] font-black tracking-tight leading-none flex items-center flex-wrap gap-x-4 gap-y-2 drop-shadow-sm transition-colors duration-500" style="color: ${colorTitle};">
            ${title}
            <span class="text-[13px] sm:text-[14px] font-semibold opacity-85 tracking-normal hidden sm:inline-block" style="color: ${colorTitle};">
              • hoy es ${longDate}
            </span>
          </h1>
          <p class="text-[13px] sm:text-[14px] font-medium mt-1.5 max-w-[420px] leading-relaxed drop-shadow-sm transition-colors duration-500" style="color: ${colorSub};">
            ${subtitle}
          </p>
        </div>
        
        <div class="flex items-center gap-4 text-right shrink-0">
          <div class="h-8 w-px hidden lg:block transition-colors duration-500" style="background-color: ${colorDivider};"></div>
          <div class="flex flex-col items-end">
            <span class="text-[24px] sm:text-[32px] font-black flex items-center gap-2 drop-shadow-sm transition-colors duration-500 leading-none" style="color: ${colorTitle};">
              ${weatherTemp} ${weatherEmoji}
            </span>
            <span class="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest mt-1.5 drop-shadow-sm transition-colors duration-500" style="line-height:1; color: ${colorSub};">
              ${weatherText}
            </span>
          </div>
        </div>
      </div>
    `;
}

async function runPostLoginInit(user) {
  const fechaHoy = todayYmdLocal();
  await Promise.all([
    getTodayReports(fechaHoy),
    loadNotifications({ silent: true }),
    getCaptureOverview(fechaHoy, "SR"),
    refreshPinolBadgeOnly?.()
  ]);
}

// 🛑 Duplicado de hydrateSessionUi eliminado.


function resetApplicationState() {
  console.log("[State Cleanup] Resetting application state...");

  // 1. Reset variables
  USER = null;
  STATUS = null;
  TOKEN = "";
  TODAY_CACHE = null;
  HAS_TODAY_SR = false;
  HAS_TODAY_CONS = false;
  HAS_SAVED_BIO = false;
  window._pinolCache = [];

  Object.assign(AppState, {
    user: null,
    status: null,
    token: "",
    todayCache: null,
    mainPanel: "CAP",
    mainTab: "",
    captureTab: "SR",
    opsTab: "SUMMARY"
  });

  // 2. Hide all major layout panels and forms in index.html
  const panelsToHide = [
    "panelWelcome", "panelADMIN", "panelCAP", "panelSEC", "rdaDashboardOverlay",
    "formSR", "formCONS", "formBIO", "formPINOL", "pinolFlowBanner",
    "panelCaptureSummary", "panelHistoryMetrics", "panelPINOLADMIN",
    "panelUNIDADADMIN", "panelLotesAdmin", "panelConfigOverride", "panelUsersAdmin"
  ];

  panelsToHide.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = "none";
      el.classList.add("hidden");
    }
  });

  // 3. Clear active navigation styling classes
  const classesToRemove = ["active", "liveAccent", "notifHot"];
  document.querySelectorAll('.main-nav-tab, .nav-tab, .nav-item').forEach(el => {
    classesToRemove.forEach(cls => el.classList.remove(cls));
  });

  // 4. Reset forms/inputs to clean state
  document.querySelectorAll("input, textarea, select").forEach(el => {
    if (el.type === "checkbox" || el.type === "radio") {
      el.checked = false;
    } else {
      el.value = "";
    }
    el.disabled = false;
    el.style.opacity = "1";
  });

  // 5. Reset notifications and badges
  resetNotifCounter();
  clearLiveFeed();
  if ($("bGuardado")) $("bGuardado").style.display = "none";
  if ($("pinolBadgeMain")) $("pinolBadgeMain").style.display = "none";
  if ($("pinolBadgeTab")) $("pinolBadgeTab").style.display = "none";
}

function setLoggedOutUI() {
  resetApplicationState();
  stopRealtimeUX();

  localStorage.removeItem("JS1_TOKEN");
  if ($("loginStatus")) $("loginStatus").textContent = "—";
  showRightColumn(false);

  $("tabOPS_PINOL")?.classList.remove("liveAccent", "notifHot");
  $("tabCAP")?.classList.remove("liveAccent", "notifHot");

  if ($("tabOPS_PINOL")) $("tabOPS_PINOL").title = "Pinol";
  if ($("tabCAP")) $("tabCAP").title = "Captura";

  LIVE_STATE.pinolWatching = false;
  LIVE_STATE.summaryWatching = false;
  LIVE_STATE.unidadWatching = false;
  LIVE_STATE.historyWatching = false;

  // 🚪 Cerrar dropdowns de perfil y notificaciones al salir
  const profileDropdown = document.getElementById("profileDropdown");
  if (profileDropdown) {
    profileDropdown.classList.add("hidden");
    document.getElementById("btnProfileToggle")?.classList.remove("btn-active");
  }
  if (typeof closeTopNotifDropdown === "function") {
    closeTopNotifDropdown();
  }
  document.getElementById("archivosDropdown")?.classList.add("hidden");
}

function activateMain(tab) {
  const pCapSummary = document.getElementById("panelCaptureSummary");
  if (pCapSummary && AppState.rol === "UNIDAD") {
    pCapSummary.style.display = "none !important";
    pCapSummary.classList.add("hidden");
  }

  if (tab === AppState.mainTab) return;
  AppState.mainTab = tab;

  const mainTabs = document.querySelectorAll('.main-nav-tab');
  mainTabs.forEach(btn => {
    if (btn.getAttribute('onclick')?.includes(`activateMain('${tab}')`)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  const pWelcome = document.getElementById("panelWelcome");
  const pAdmin = document.getElementById("panelADMIN");
  const pCap = document.getElementById("panelCAP");
  const pSec = document.getElementById("panelSEC");
  const pRda = document.getElementById("rdaDashboardOverlay");

  if (pWelcome) pWelcome.style.display = (tab === "WELCOME") ? "block" : "none";
  if (pAdmin) pAdmin.style.display = (tab === "ADMIN") ? "block" : "none";
  if (pSec) pSec.style.display = (tab === "SEC") ? "block" : "none";

  if (pCap) {
    pCap.removeAttribute("style");
    if (tab === "CAP") {
      pCap.classList.remove("hidden");
      pCap.style.display = "block";
    } else {
      pCap.classList.add("hidden");
      pCap.style.display = "none";
    }
  }
  if (pCapSummary) {
    if (AppState.rol === "UNIDAD") {
      pCapSummary.classList.add("hidden");
      pCapSummary.style.setProperty("display", "none", "important");
    } else {
      pCapSummary.removeAttribute("style");
      if (tab === "CAP") {
        pCapSummary.classList.remove("hidden");
        pCapSummary.style.display = "block";
      } else {
        pCapSummary.classList.add("hidden");
        pCapSummary.style.setProperty("display", "none", "important");
      }
    }
  }

  const pRdaMob = document.getElementById("rdaMobileDashboard");
  const isMobileRda = tab === "RDA" && (document.body.classList.contains("touch-ui") || window.innerWidth < 768);

  if (pRda) {
    if ((tab === "RDA" || (tab === "ADMIN" && AppState.opsTab === "RDA")) && !isMobileRda) {
      pRda.classList.remove("hidden");
      pRda.style.setProperty("display", "flex", "important");
    } else {
      pRda.classList.add("hidden");
      pRda.style.setProperty("display", "none", "important");
    }
  }

  if (pRdaMob) {
    if (isMobileRda) {
      pRdaMob.classList.remove("hidden");
      pRdaMob.style.setProperty("display", "flex", "important");
      requestAnimationFrame(() => pRdaMob.classList.remove("translate-y-full"));
    } else {
      pRdaMob.classList.add("translate-y-full");
      setTimeout(() => {
        if (pRdaMob.classList.contains("translate-y-full")) {
          pRdaMob.style.setProperty("display", "none", "important");
        }
      }, 300);
    }
  }

  // --- ARCHITECTURAL FIX: HIDE LOOSE SIBLING FORMS ---
  // Corrected to the ACTUAL DOM IDs used in index.html
  const looseForms = ["formSR", "formCONS", "formBIO", "formPINOL", "panelDIST"];

  if (tab !== "CAP" && tab !== "ADMIN") {
    // Lock them down with !important
    looseForms.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.setAttribute("style", "display: none !important;");
    });
  } else {
    // Unlock them safely (removes !important but keeps them hidden natively)
    looseForms.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.setAttribute("style", "display: none;");
    });
  }

  const floatingHub = document.querySelector('.command-hub') || document.getElementById('commandHub');
  if (floatingHub) {
    if (tab !== "CAP") {
      floatingHub.setAttribute("style", "display: none !important;");
    } else {
      floatingHub.removeAttribute("style");
    }
  }

  if (tab === "CAP") {
    if (AppState.rol !== "UNIDAD") {
      activateOpsTab("CAPTURE");
    } else {
      // Restore the specifically selected capture form for UNIDAD
      if (typeof activateCapture === 'function') {
        const currentCap = AppState.capTab || "SR";
        AppState.capTab = null; // Force DOM refresh
        activateCapture(currentCap);
      }
    }
  } else if (tab === "ADMIN") {
    activateOpsTab(AppState.opsTab);
  } else if (tab === "RDA") {
    if (typeof resetRDAEsquemaToBasico === 'function') resetRDAEsquemaToBasico();
    if (typeof loadAndRender === 'function') loadAndRender();
  }
}

function activateCapture(tab) {
  const role = String((USER && USER.rol) || "").trim().toUpperCase();


  const updateTabClass = (id, cond) => {
    const el = $(id);
    if (el) {
      if (cond) el.classList.add("active");
      else el.classList.remove("active");
    }
  };

  if (role !== "UNIDAD") {
    updateTabClass("tabSR", false);
    updateTabClass("tabCONS", false);
    updateTabClass("tabBIO", false);
    updateTabClass("tabPINOL", false);

    if ($("formSR")) $("formSR").style.display = "none";
    if ($("formCONS")) $("formCONS").style.display = "none";
    if ($("formBIO")) $("formBIO").style.display = "none";
    if ($("formPINOL")) $("formPINOL").style.display = "none";

    if ($("panelCAP")) $("panelCAP").style.display = "none";
    return;
  }

  const currentTab = APP_STATE.captureTab || "SR";
  const sameTab = currentTab === tab;

  Object.assign(AppState, { captureTab: tab });

  if (tab === "SR") {
    clearTabAttention("tabSR");
  }

  if (tab === "CONS") {
    clearTabAttention("tabCONS");
  }

  if (tab === "BIO") {
    clearTabAttention("tabBIO");
  }

  if (tab === "PINOL") {
    clearTabAttention("tabPINOL");
  }

  updateTabClass("tabSR", tab === "SR");
  updateTabClass("tabCONS", tab === "CONS");
  updateTabClass("tabBIO", tab === "BIO");
  updateTabClass("tabPINOL", tab === "PINOL");

  if ($("formSR")) $("formSR").style.display = "none";
  if ($("formCONS")) $("formCONS").style.display = "none";
  if ($("formBIO")) $("formBIO").style.display = "none";
  if ($("formPINOL")) $("formPINOL").style.display = "none";

  let targetId = "formSR";
  if (tab === "SR") { if ($("formSR")) $("formSR").style.display = "block"; targetId = "formSR"; }
  if (tab === "CONS") { if ($("formCONS")) $("formCONS").style.display = "block"; targetId = "formCONS"; }
  if (tab === "BIO") { if ($("formBIO")) $("formBIO").style.display = "block"; targetId = "formBIO"; }
  if (tab === "PINOL") { if ($("formPINOL")) $("formPINOL").style.display = "block"; targetId = "formPINOL"; }

  updateCaptureStateBanner();
  applyCaptureLockState();
  applyCaptureNameAutocomplete();
  bindFastNumericFocus();

  if (tab === "CONS") {
    bindCaptureUtilityEvents();
    syncAguja();
  }

  syncTabGroupIndicator('#desktopCaptureTabs');
}

/**
 * Mueve el indicador de cualquier grupo de pestañas
 * @param {string} containerSelector - Selector del contenedor (.nav-container)
 */
function syncTabGroupIndicator(containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  const activeBtn = container.querySelector('.nav-tab.active');
  const indicator = container.querySelector('.nav-indicator');
  if (!activeBtn || !indicator) return;

  if (activeBtn.offsetWidth === 0) {
    setTimeout(() => syncTabGroupIndicator(containerSelector), 100);
    return;
  }
  const w = activeBtn.offsetWidth;
  const h = activeBtn.offsetHeight - 12 || 36;
  indicator.style.width = `${w}px`;
  indicator.style.left = `${activeBtn.offsetLeft}px`;

  // Dynamic Liquid Glass update
  if (typeof updateLiquidGlassMaps === 'function') {
    updateLiquidGlassMaps(indicator.id, w, h);
  }
}

window.addEventListener('resize', () => {
  syncTabGroupIndicator('#panelAdminOpsTabs .nav-container');
  syncTabGroupIndicator('#panelUnidadOpsTabs .nav-container');
  syncTabGroupIndicator('#panelAdminSecurityTabs .nav-container');
  syncTabGroupIndicator('#desktopCaptureTabs');
});

/**
 * ACTIVATE OPS TAB (Final Refactor - High Fidelity)
 */
window.activateOpsTab = function (tab) {
  // Normalization bridge: Map inputs to normalized tab keys
  if (tab === "NOTIFS" || tab === "NOTIF") tab = "NOTIFICATIONS";
  if (tab === "ADMIN" || tab === "SEC") tab = "SECURITY";

  if (tab === "CAPTURE" && AppState.rol === "UNIDAD") {
    if (typeof activateUnidadTab === 'function') activateUnidadTab("CAPTURE");
    return;
  }
  if (tab === "RDA" && AppState.rol === "UNIDAD") {
    if (typeof activateUnidadTab === 'function') activateUnidadTab("RDA");
    return;
  }

  const sameTab = AppState.opsTab === tab;
  AppState.opsTab = tab;

  // Sync AppState.mainTab to prevent async summary panel leaks
  if (tab === "NOTIFICATIONS") {
    AppState.mainTab = "NOTIFS";
  } else if (tab === "SECURITY") {
    AppState.mainTab = "ADMIN";
  } else {
    AppState.mainTab = "CAP";
  }

  // 1. UI: Botonera y animación (CORREGIDO AL ID REAL)
  const container = document.getElementById("panelAdminOpsTabs");
  if (container) {
    const navContainer = container.querySelector(".nav-container");
    if (navContainer) {
      navContainer.querySelectorAll(".nav-tab").forEach(b => b.classList.remove("active"));
    }

    const buttonIds = {
      "CAPTURE": "tabOPS_CAPTURE",
      "HISTORY": "tabOPS_HISTORY",
      "RDA": "tabOPS_RDA",
      "PINOL": "tabOPS_PINOL",
      "LOTES": "tabLOTES",
      "NOTIFICATIONS": "tabOPS_NOTIFS",
      "SECURITY": "tabOPS_ADMIN"
    };
    const targetId = buttonIds[tab];
    if (targetId) {
      const btn = document.getElementById(targetId);
      if (btn) btn.classList.add("active");
    }

    if (typeof syncTabGroupIndicator === 'function') {
      syncTabGroupIndicator("#panelAdminOpsTabs .nav-container");
    }
  }

  // 2. PANELES: Apagado forzoso termonuclear de todos los paneles de esta sección
  const panelIds = {
    "CAPTURE": "panelCaptureSummary",
    "HISTORY": "panelHISTORY",
    "RDA": "rdaDashboardOverlay",
    "PINOL": "panelPINOLADMIN",
    "LOTES": "panelLOTES",
    "NOTIFICATIONS": "panelNOTIFS",
    "SECURITY": "panelADMIN"
  };

  const isMobileRda = tab === "RDA" && (document.body.classList.contains("touch-ui") || window.innerWidth < 768);

  Object.keys(panelIds).forEach(k => {
    const el = document.getElementById(panelIds[k]);
    if (el) {
      el.classList.add("hidden");
      el.style.setProperty("display", "none", "important");
    }
  });

  // Explicitly hide mobile dashboard too
  const rdaMob = document.getElementById("rdaMobileDashboard");
  if (rdaMob && tab !== "RDA") {
    rdaMob.classList.add("translate-y-full");
    setTimeout(() => { if (rdaMob.classList.contains("translate-y-full")) rdaMob.style.setProperty("display", "none", "important"); }, 300);
  }

  // Encendido exclusivo del panel seleccionado
  const activePanelId = isMobileRda ? "rdaMobileDashboard" : panelIds[tab];
  if (activePanelId) {
    const activePanel = document.getElementById(activePanelId);
    if (activePanel) {
      if (activePanelId === "panelCaptureSummary" && AppState.rol === "UNIDAD") {
        activePanel.classList.add("hidden");
        activePanel.style.setProperty("display", "none", "important");
        return;
      }
      activePanel.classList.remove("hidden");

      if (activePanelId === "rdaMobileDashboard") {
        activePanel.style.setProperty("display", "flex", "important");
        requestAnimationFrame(() => activePanel.classList.remove("translate-y-full"));
      } else {
        const dType = (tab === "RDA") ? "flex" : "block";
        activePanel.style.setProperty("display", dType, "important");
        activePanel.classList.remove("tab-panel-animated");
        void activePanel.offsetWidth; // Force reflow
        activePanel.classList.add("tab-panel-animated");
      }
    }
  }

  // Standard mainTab cleanups to keep UI in sync
  const isCapTab = (AppState.mainTab === "CAP");
  const looseForms = ["formSR", "formCONS", "formBIO", "formPINOL", "panelDIST"];
  looseForms.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (!isCapTab) {
        el.setAttribute("style", "display: none !important;");
      } else {
        el.setAttribute("style", "display: none;");
      }
    }
  });

  const floatingHub = document.querySelector('.command-hub') || document.getElementById('commandHub');
  if (floatingHub) {
    if (!isCapTab) {
      floatingHub.setAttribute("style", "display: none !important;");
    } else {
      floatingHub.removeAttribute("style");
    }
  }

  // 3. DATOS: Carga de información
  if (!sameTab) {
    if (tab === "CAPTURE") {
      if (typeof runSinglePanelTask === 'function') runSinglePanelTask("ops-tab-capture", () => reloadCaptureSummarySilent());
    }
    if (tab === "HISTORY") {
      if (typeof runSinglePanelTask === 'function') runSinglePanelTask("ops-tab-history", () => reloadHistorySilent());
    }
    if (tab === "PINOL") {
      if (typeof runSinglePanelTask === 'function') runSinglePanelTask("ops-tab-pinol", () => refreshPinol());
    }
    if (tab === "RDA") {
      if (typeof resetRDAEsquemaToBasico === 'function') resetRDAEsquemaToBasico();
      if (typeof loadAndRender === 'function') loadAndRender();
    }
    if (tab === "LOTES") {
      if (typeof activateLotesAdmin === 'function') activateLotesAdmin();
    }
    if (tab === "NOTIFICATIONS") {
      if (AppState.rol !== "UNIDAD" && typeof initNotificationCenter === 'function') {
        initNotificationCenter().catch(err => console.error("initNotificationCenter error:", err));
      }
      if (typeof loadNotifications === 'function') {
        loadNotifications({ silent: false }).catch(err => {
          console.error("loadNotifications error:", err);
          if (typeof showToast === 'function') showToast("No se pudieron cargar las notificaciones", false);
        });
      }
    }
  }
};

function activateUnidadTab(tab) {
  if (tab === AppState.opsTab) return;
  AppState.opsTab = tab;

  const container = document.querySelector('#panelUnidadOpsTabs .nav-container');
  if (container) {
    container.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
    let targetId = (tab === "RDA") ? "tabUNIDAD_RDA" : "tabUNIDAD_CAPTURE";
    const btn = document.getElementById(targetId);
    if (btn) btn.classList.add('active');
    if (typeof syncTabGroupIndicator === 'function') syncTabGroupIndicator('#panelUnidadOpsTabs .nav-container');
  }

  console.log("[Navigation] UNIDAD requested main section:", tab);

  if (tab === "CAPTURE") {
    activateMain("CAP");
    if (typeof reloadCaptureSummarySilent === 'function') runSinglePanelTask("ops-tab-capture", () => reloadCaptureSummarySilent());
  } else if (tab === "RDA") {
    activateMain("RDA");
  }
}
window.activateUnidadTab = activateUnidadTab;

function resetExistencia() {
  if (HAS_TODAY_SR && TODAY_CACHE && TODAY_CACHE.sr) {
    loadExistenciaIntoForm(TODAY_CACHE.sr);
  } else {
    if ($("nombreSR")) $("nombreSR").value = "";
    const tbody = $("srCaptureTbody");
    if (tbody) {
      tbody.innerHTML = "";
      addSRRow(); // Empezar con una fila vacía
    }
    ORIGINAL_SR = null;
  }
  setEditModeSR(false);
}

function resetCONS() {
  if (HAS_TODAY_CONS && TODAY_CACHE && TODAY_CACHE.cons) {
    loadCONSIntoForm(TODAY_CACHE.cons);
  } else {
    if ($("nombreCONS")) $("nombreCONS").value = "";
    if ($("srp_dosis")) $("srp_dosis").value = "";
    if ($("sr_dosis")) $("sr_dosis").value = "";
    if ($("jeringa_reconst_5ml_0605500438")) $("jeringa_reconst_5ml_0605500438").value = "";
    if ($("jeringa_aplic_05ml_0605502657")) $("jeringa_aplic_05ml_0605502657").value = "";
    if ($("aguja_0600403711")) $("aguja_0600403711").value = "";
    ORIGINAL_CONS = null;
  }

  setEditModeCONS(false);
  bindCaptureUtilityEvents();
  syncAguja();
}

async function reloadCaptureSummary(force = false) {
  const filterKey = buildCaptureSummaryFilterKey();

  if (!shouldReloadPanelByFilters("captureSummary", filterKey, force)) {
    return null;
  }

  return runSinglePanelTask("capture-summary", async () => {
    if (!TOKEN) return null;

    try {
      const fecha = $("summaryFecha")?.value || todayYmdLocal();
      const tipo = $("summaryTipo")?.value || "SR";

      const data = await smartLoader(
        () => getCaptureOverview(fecha, tipo, !!force),
        {
          delay: 220,
          message: "Cargando resumen…",
          title: "Resumen de captura"
        }
      );

      const pCapSummary = document.getElementById("panelCaptureSummary");
      const panel = pCapSummary;
      const hasRecords = !!data;

      if (data) {
        renderCaptureSummary(data);
        commitPanelFilterState("captureSummary", `${fecha}__${tipo}`);
      }

      if (AppState.rol === "UNIDAD") {
        if (panel) {
          panel.classList.add("hidden");
          panel.style.setProperty("display", "none", "important");
        }
        return data;
      }

      if (AppState.mainTab === "CAP" && AppState.opsTab === "CAPTURE") {
        if (hasRecords) {
          if (panel) {
            panel.classList.remove("hidden");
            panel.style.display = "block";
          }
        } else {
          if (panel) { panel.style.display = "none"; }
        }
      } else {
        if (panel) {
          panel.classList.add("hidden");
          panel.style.setProperty("display", "none", "important");
        }
      }

      return data;
    } catch (e) {
      console.error("reloadCaptureSummary error:", e);
      return null;
    }
  });
}

async function reloadCaptureSummarySilent(force = false) {
  const filterKey = buildCaptureSummaryFilterKey();

  if (!shouldReloadPanelByFilters("captureSummary", filterKey, force)) {
    return null;
  }

  return runSinglePanelTask("capture-summary", async () => {
    if (!TOKEN) return null;

    try {
      const fecha = $("summaryFecha")?.value || todayYmdLocal();
      const tipo = $("summaryTipo")?.value || "SR";

      const data = await smartLoader(
        () => getCaptureOverview(fecha, tipo, !!force),
        {
          delay: 220,
          message: "Cargando resumen…",
          title: "Resumen de captura"
        }
      );

      const pCapSummary = document.getElementById("panelCaptureSummary");
      const panel = pCapSummary;
      const hasRecords = !!data;

      if (data) {
        renderCaptureSummary(data);
        commitPanelFilterState("captureSummary", `${fecha}__${tipo}`);
      }

      if (AppState.rol === "UNIDAD") {
        if (panel) {
          panel.classList.add("hidden");
          panel.style.setProperty("display", "none", "important");
        }
        return data;
      }

      if (AppState.mainTab === "CAP" && AppState.opsTab === "CAPTURE") {
        if (hasRecords) {
          if (panel) {
            panel.classList.remove("hidden");
            panel.style.display = "block";
          }
        } else {
          if (panel) { panel.style.display = "none"; }
        }
      } else {
        if (panel) {
          panel.classList.add("hidden");
          panel.style.setProperty("display", "none", "important");
        }
      }

      return data;
    } catch (e) {
      console.error("reloadCaptureSummarySilent error:", e);
      return null;
    }
  });
}

async function reloadHistorySilent(force = false) {
  const filterKey = buildHistoryFilterKey();

  if (!shouldReloadPanelByFilters("historyMetrics", filterKey, force)) {
    return null;
  }

  return runSinglePanelTask("history-metrics", async () => {
    if (!TOKEN) return null;

    try {
      const mes = $("histMesEvaluacion")?.value || todayYmdLocal().substring(0, 7);

      const data = await smartLoader(
        () => getHistoryMetrics(mes, null, !!force),
        "Consultando histórico...",
        "Calculando ranking..."
      );

      if (data && data.ok !== false) {
        renderHistoryMetrics(data);
        commitPanelFilterState("historyMetrics", filterKey);
      } else {
        if ($("historyTbody")) $("historyTbody").innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500 font-bold">Error al cargar ranking.</td></tr>`;
      }
      return data;
    } catch (e) {
      console.error("reloadHistorySilent error:", e);
      return null;
    }
  });
}
// (El listener de loginForm ya está registrado al inicio del archivo)


const bSaveSR = $("btnSaveSR");
if (bSaveSR) bSaveSR.onclick = async () => {
  const nombre = $("nombreSR")?.value.trim() || "";
  if (!nombre) return showToast("Ingresa el nombre del responsable", false, "warn");

  const isBatchExpired = (cad) => {
    if (!cad) return false;
    let cadDate = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(cad)) {
      cadDate = new Date(cad + "T23:59:59");
    } else {
      const parts = String(cad).split('-');
      if (parts.length === 2) {
        const monthsMap = {
          'ENE': 0, 'FEB': 1, 'MAR': 2, 'ABR': 3, 'MAY': 4, 'JUN': 5,
          'JUL': 6, 'AGO': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DIC': 11
        };
        const mStr = parts[0].toUpperCase();
        const yShort = parseInt(parts[1]);
        const mIdx = monthsMap[mStr];
        if (!isNaN(yShort) && mIdx !== undefined) {
          cadDate = new Date(2000 + yShort, mIdx + 1, 0, 23, 59, 59);
        }
      }
    }
    if (!cadDate || isNaN(cadDate.getTime())) return false;
    return cadDate < new Date();
  };

  const items = [];
  let hasInvalid = false;
  const errors = [];

  document.querySelectorAll("#srCaptureTbody tr").forEach((tr, index) => {
    const row = tr._cache || {};
    const bio = (row.bioSelect || tr.querySelector(".sr-bio-select"))?.value;
    const lote = (row.loteSelect || tr.querySelector(".sr-lote-select"))?.value;
    const cant = (row.cantidadInput || tr.querySelector(".sr-cantidad-input"))?.value;
    const recep = (row.recepcionInput || tr.querySelector(".sr-recepcion-input"))?.value;

    if (!bio && !lote && !cant && !recep) {
      tr.style.background = "";
      return;
    }

    const rowErrors = [];

    if (!bio) {
      rowErrors.push("falta seleccionar el biológico");
    }
    if (bio && !lote) {
      rowErrors.push("falta seleccionar el lote");
    }
    if (bio && !recep) {
      rowErrors.push("falta seleccionar la fecha de recepción");
    }
    if (cant === "") {
      rowErrors.push("falta ingresar la cantidad");
    } else if (Number(cant) < 0) {
      rowErrors.push("la cantidad no puede ser negativa");
    } else if (Number(cant) === 0) {
      rowErrors.push("no puedes guardar lotes en ceros, si se terminó la vacuna por favor elimina la fila");
    } else if (bio) {
      // Decimal validation
      const allowedDecimals = ["TD", "COVID-19", "INFLUENZA", "DPT", "HEPATITIS B"];
      const hasDecimal = Number(cant) % 1 !== 0;
      if (hasDecimal && !allowedDecimals.includes(bio)) {
        rowErrors.push(`la vacuna ${bio} no admite decimales (solo TD, COVID, INFLUENZA, DPT, HEPATITIS B)`);
      }
    }

    if (lote) {
      const loteSelect = row.loteSelect || tr.querySelector(".sr-lote-select");
      const selectedOpt = loteSelect?.selectedOptions?.[0];
      const cad = selectedOpt?.dataset?.cad;
      if (cad && isBatchExpired(cad)) {
        rowErrors.push(`el lote ${lote} de ${bio} está caducado (${formatToMmmAa(cad)})`);
      }
    }

    if (rowErrors.length > 0) {
      hasInvalid = true;
      tr.style.background = "rgba(239, 68, 68, 0.15)";
      errors.push(`Fila ${index + 1}: ${rowErrors.join(", ")}`);
    } else {
      tr.style.background = "";
      items.push({ biologico: bio, lote, cantidad: Number(cant), fecha_recepcion: recep });
    }
  });

  if (hasInvalid) {
    errors.forEach(err => showToast(err, false, "warn", { force: true }));
    return;
  }
  if (!items.length) return showToast("Captura al menos un biológico", false, "warn");

  if (window.PREFILL_SNAPSHOT) {
    try {
      const currentSnapshot = JSON.stringify(items.map(item => ({
        biologico: String(item.biologico).trim().toUpperCase(),
        lote: String(item.lote).trim().toUpperCase(),
        cantidad: Number(item.cantidad)
      })));

      const prevItems = JSON.parse(window.PREFILL_SNAPSHOT);
      const prevSnapshot = JSON.stringify(prevItems.map(item => ({
        biologico: String(item.biologico).trim().toUpperCase(),
        lote: String(item.lote).trim().toUpperCase(),
        cantidad: Number(item.cantidad)
      })));

      if (currentSnapshot === prevSnapshot) {
        const confirmed = await openPrefillConfirm();
        if (!confirmed) {
          return; // Cancels save
        }
      }
    } catch (e) { console.error("Snapshot compare error", e); }
  }

  if (HAS_TODAY_SR && !EDIT_SR) return showToast("Ya existe una captura de hoy", false, "warn");

  await AppService.runCapture({
    btnId: "btnSaveSR",
    title: EDIT_SR ? "Actualizando" : "Guardando",
    msg: "Procesando existencia de biológicos...",
    successMsg: EDIT_SR ? "Existencia actualizada" : "Existencia guardada",
    eventTitle: "Existencia de biológicos",
    eventMsg: EDIT_SR ? "Actualizada correctamente." : "Guardada correctamente.",
    mutation: { touchToday: true, touchCaptureSummary: true, touchHistory: true },
    action: () => {
      saveUxValue(UX_KEYS.existenciaName, nombre);
      return AppService.call("saveSR", {
        fecha: todayYmdLocal(),
        nombre,
        items,
        editado: EDIT_SR ? "SI" : "NO"
      });
    }
  });
};

$("btnExportSelectAll").onclick = () => {
  document.querySelectorAll(".exportMunicipioChk").forEach(chk => chk.checked = true);
};

$("btnExportClearAll").onclick = () => {
  document.querySelectorAll(".exportMunicipioChk").forEach(chk => chk.checked = false);
};

$("exportTipo").addEventListener("change", updateExportFechaHint);

refreshExportSplitUi();

const bSaveCONS = $("btnSaveCONS");
if (bSaveCONS) bSaveCONS.onclick = async () => {
  const nombre = $("nombreCONS")?.value.trim() || "";
  if (!nombre) return showToast("Ingresa el nombre del responsable", false, "warn");

  const numFields = ["srp_dosis", "sr_dosis", "jeringa_reconst_5ml_0605500438", "jeringa_aplic_05ml_0605502657"];
  for (const f of numFields) {
    const val = $(f)?.value;
    if (val !== "" && (isNaN(val) || Number(val) < 0)) {
      flashElement(f);
      return showToast("Valores numéricos inválidos", false, "warn");
    }
  }

  if (HAS_TODAY_CONS && !EDIT_CONS) return showToast("Ya existe un reporte de hoy", false, "warn");
  if (EDIT_CONS && !hasCONSNumericChanges()) return showToast("No hay cambios numéricos", false, "warn");

  const safeNum = (id) => Number($(id)?.value || 0);

  await AppService.runCapture({
    btnId: "btnSaveCONS",
    title: EDIT_CONS ? "Actualizando" : "Guardando",
    msg: "Procesando consumibles...",
    successMsg: EDIT_CONS ? "Reporte actualizado" : "Reporte guardado",
    eventTitle: "Consumibles",
    eventMsg: EDIT_CONS ? "Actualizado correctamente." : "Guardado correctamente.",
    mutation: { touchToday: true, touchCaptureSummary: true, touchHistory: true },
    action: () => {
      saveUxValue(UX_KEYS.consName, nombre);
      return AppService.call("saveConsumibles", {
        nombre,
        srp_dosis: safeNum("srp_dosis"),
        sr_dosis: safeNum("sr_dosis"),
        jeringa_reconst_5ml_0605500438: safeNum("jeringa_reconst_5ml_0605500438"),
        jeringa_aplic_05ml_0605502657: safeNum("jeringa_aplic_05ml_0605502657"),
        aguja_0600403711: safeNum("aguja_0600403711"),
        editado: EDIT_CONS ? "SI" : "NO"
      });
    }
  });
};

const bSaveBIO = $("btnSaveBIO");
if (bSaveBIO) bSaveBIO.onclick = async () => {
  if (!BIO_STATE.canCapture) return showToast("Ventana de captura cerrada", false, "warn");
  if (HAS_SAVED_BIO && !EDIT_BIO) return showToast("Pedido ya capturado", false, "warn");

  const bioValidation = refreshBioAlerts(true);
  if (bioValidation?.hasBlockingError) return showToast("Corrige los errores antes de guardar", false, "warn");

  const nombre = $("nombreBIO")?.value.trim() || "";
  const items = collectBioItems();

  // --- REGLAS MATEMÁTICAS ESTRICTAS (PHASE 2) ---
  const criticalBioNames = ["HEXAVALENTE", "NEUMOCOCICA 13", "NEUMOCOCICA 20", "SRP", "ROTAVIRUS"];
  const normalizeStr = (str) => {
    return String(str || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  };

  const warningMsgs = [];

  for (const item of items) {
    const normKey = normalizeStr(item.biologico);

    // REGLA A: Múltiplos de 5 para biológicos críticos (Hexavalente, Neumocócicas, SRP, Rotavirus)
    const isCritical = criticalBioNames.some(cName => {
      const normCritical = cName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
      return normKey === normCritical; // <-- Igualdad estricta (Evita falsos positivos con .includes)
    });

    if (isCritical) {
      const pedidoVal = Number(item.pedido_frascos || 0);
      if (pedidoVal % 5 !== 0) {
        return showToast(`El pedido para ${item.biologico} debe ser múltiplo de 5 (se ingresó ${pedidoVal}).`, false, "warn");
      }
    }

    // REGLA B: Umbral de stock mínimo (Existencia + Pedido >= Promedio)
    const existenciaVal = Number(item.existencia_actual_frascos || 0);
    const pedidoVal = Number(item.pedido_frascos || 0);
    const promedioVal = Number(item.promedio_frascos || 0);
    const totalVal = existenciaVal + pedidoVal;

    if (promedioVal > 0 && totalVal < promedioVal) {
      const isExento = ["VPH", "INFLUENZA", "COVID-19", "COVID 19", "VARICELA", "HEPATITIS A"].includes(normKey);
      if (!isExento) {
        warningMsgs.push(`- ${item.biologico}: Stock final estimado (${totalVal}) es menor al promedio mensual (${promedioVal})`);
      }
    }
  }

  if (warningMsgs.length > 0) {
    const confirmed = await openBioConfirm(warningMsgs);
    if (!confirmed) return;
  }

  await AppService.runCapture({
    btnId: "btnSaveBIO",
    title: EDIT_BIO ? "Actualizando" : "Guardando",
    msg: "Procesando pedido biológico...",
    successMsg: EDIT_BIO ? "Pedido actualizado" : "Pedido guardado",
    eventTitle: "Pedido de biológico",
    eventMsg: EDIT_BIO ? "Actualizado correctamente." : "Guardado correctamente.",
    mutation: { touchToday: true, touchCaptureSummary: true, touchHistory: true, touchBio: true },
    action: async () => {
      saveUxValue(UX_KEYS.bioName, nombre);
      const res = await AppService.call("saveBio", {
        nombre,
        items,
        tipo_pedido: BIO_STATE.isInsideWindow ? "MENSUAL" : "EXTRAORDINARIO",
        sin_pedido: $("chkNoPedido")?.checked || false,
        fecha: BIO_STATE.fechaPedidoProgramada,
        fechaPedidoProgramada: BIO_STATE.fechaPedidoProgramada,
        windowStartYmd: BIO_STATE.captureWindowStartYmd,
        windowEndYmd: BIO_STATE.captureWindowEndYmd
      });
      if (res.ok) await loadBioForm(true);
      return res;
    }
  });
};

if ($("btnBioConfirmCancel")) {
  $("btnBioConfirmCancel").onclick = () => closeBioConfirm(false);
}

if ($("btnBioConfirmAccept")) {
  $("btnBioConfirmAccept").onclick = () => closeBioConfirm(true);
}

if ($("bioConfirmOverlay")) {
  $("bioConfirmOverlay").onclick = (e) => {
    if (e.target === $("bioConfirmOverlay")) closeBioConfirm(false);
  };
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && $("bioConfirmOverlay") && $("bioConfirmOverlay").classList.contains("show")) {
    closeBioConfirm(false);
  }

});

$("btnSavePINOL").onclick = async () => {
  const nombre = $("nombrePINOL")?.value.trim() || "";
  if (!nombre) return showToast("Ingresa el nombre del responsable", false, "warn");

  const solicitud = Number($("pinol_solicitud")?.value || 0);
  if (isNaN(solicitud) || solicitud < 1) {
    return showToast("La solicitud debe ser de al menos 1 botella", false, "warn");
  }

  await AppService.runCapture({
    btnId: "btnSavePINOL",
    title: "Guardando",
    msg: "Enviando solicitud de pinol...",
    successMsg: "Solicitud de pinol guardada",
    eventTitle: "Pinol",
    eventMsg: "Tu solicitud fue enviada correctamente.",
    mutation: { touchPinol: true },
    action: async () => {
      saveUxValue(UX_KEYS.pinolName, nombre);
      const res = await AppService.call("savePinol", {
        nombre,
        existencia_actual_botellas: $("pinol_existencia")?.value,
        solicitud_botellas: $("pinol_solicitud")?.value,
        observaciones: $("pinol_observaciones")?.value.trim()
      });
      if (res.ok) {
        $("nombrePINOL").value = "";
        $("pinol_existencia").value = "";
        $("pinol_solicitud").value = "";
        $("pinol_observaciones").value = "";
      }
      return res;
    }
  });
};

$("btnEditSR").onclick = () => {
  if (!TODAY_CACHE || !TODAY_CACHE.sr) return;
  loadExistenciaIntoForm(TODAY_CACHE.sr);
  setEditModeSR(true);
  showToast("Modo edición activado (Existencia de biológicos)", true, "warn");
};
$("btnCancelEditSR").onclick = () => {
  resetExistencia();
  showToast("Edición cancelada");
};
$("btnEditCONS").onclick = () => {
  if (!TODAY_CACHE || !TODAY_CACHE.cons) return;
  loadCONSIntoForm(TODAY_CACHE.cons);
  setEditModeCONS(true);
  showToast("Modo edición activado (Consumibles)", true, "warn");
};
$("btnCancelEditCONS").onclick = () => {
  resetCONS();
  showToast("Edición cancelada");
};
$("btnEditBIO").onclick = () => {
  if (!HAS_SAVED_BIO) return;
  setEditModeBIO(true);
  showToast("Modo edición activado (Pedido de biológico)", true, "warn");
};

$("btnCancelEditBIO").onclick = async () => {
  await loadBioForm();
  showToast("Edición cancelada");
};

// EVENTOS DEL MODAL DE EXPORTACIÓN
if ($("exportTipo")) $("exportTipo").addEventListener("change", updateExportFechaHint);
if ($("exportMonth")) $("exportMonth").addEventListener("change", updateExportFechaHint);
if ($("exportYear")) $("exportYear").addEventListener("change", updateExportFechaHint);

if ($("btnExport")) $("btnExport").onclick = () => {
  $("exportOverlay")?.classList.add("show");
  updateExportFechaHint();
  loadExportOptions().catch(console.error);
};

if ($("btnCancelExport")) $("btnCancelExport").onclick = () => {
  $("exportOverlay")?.classList.remove("show");
};


if ($("btnDoExport")) $("btnDoExport").onclick = async () => {
  $("exportOverlay")?.classList.remove("show");
  showOverlay("Generando reporte...");
  try {
    const municipios = getSelectedExportMunicipios();
    const tipo = $("exportTipo").value || "SR";

    let fIni = "";
    let fFin = "";
    if (tipo === "BIO") {
      const exactSelect = $("exportBioExactDate");
      if (exactSelect && exactSelect.value) {
        fIni = exactSelect.value;
        fFin = fIni;
      } else {
        const mm = $("exportMonth") ? $("exportMonth").value : "01";
        const yy = $("exportYear") ? $("exportYear").value : "2024";
        fIni = `${yy}-${mm}-01`;
        const lastDay = new Date(parseInt(yy), parseInt(mm), 0);
        fFin = dateToLocalYmd(lastDay);
      }
    } else {
      fIni = $("exportFechaInicio").value || todayYmdLocal();
      fFin = $("exportFechaFin").value || fIni;
    }

    const res = await apiCall({
      action: tipo === "BIO" ? "bioExportMatrix" : "export",
      tipo,
      municipios,
      fechaInicio: fIni,
      fechaFin: fFin
    });

    if (!res || !res.ok) {
      showToast((res && res.error) ? res.error : "No se pudo obtener datos para el reporte", false);
      return;
    }

    await generateProfessionalXLSX(tipo, res.data, fIni, fFin, municipios);
    showToast("El reporte se generó correctamente");

  } catch (e) {
    console.error("Export error:", e);
    showToast("Error al exportar", false);
  } finally {
    hideOverlay();
  }
};

/**
 * Generador de Excel Profesional (Cliente)
 */
async function generateProfessionalXLSX(tipo, data, fIni, fFin, selectedMunicipios = []) {
  if (!window.ExcelJS) {
    showToast("Librería de exportación no cargada", false);
    return;
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'SIREVAQ';
  const sheetName = tipo === "SR" ? "EXISTENCIAS" : (tipo === "CONS" ? "CONSUMIBLES" : "PEDIDOS");
  const ws = wb.addWorksheet(sheetName, { views: [{ showGridLines: false }] });

  let arrClues = [];
  const mapUnidades = {};

  if (tipo === "BIO") {
    // Buscar todos los municipios a consultar
    let targetMuns = selectedMunicipios || [];
    if (targetMuns.length === 0) {
      const dataMuns = Array.from(new Set(data.map(d => d.municipio).filter(Boolean)));
      targetMuns = dataMuns;
    }

    // Si aún está vacío y el usuario es MUNICIPAL, usar su municipio
    if (targetMuns.length === 0 && USER && USER.municipio) {
      targetMuns = String(USER.municipio).split(",").map(m => m.trim());
    }

    if (targetMuns.length > 0) {
      try {
        const { data: dbUnits, error: dbUnitsErr } = await supabase
          .from('unidades')
          .select('clues, unidad')
          .in('municipio', targetMuns)
          .order('clues');

        if (!dbUnitsErr && dbUnits && dbUnits.length > 0) {
          dbUnits.forEach(u => {
            mapUnidades[u.clues] = u.unidad.toUpperCase();
          });
          arrClues = dbUnits.map(u => u.clues);
        }
      } catch (err) {
        console.error("Error fetching units for export:", err);
      }
    }
  }

  if (arrClues.length === 0) {
    const unidadesSet = new Set();
    data.forEach(d => {
      unidadesSet.add(d.clues);
      if (d.unidades && d.unidades.nombre) {
        mapUnidades[d.clues] = d.unidades.nombre.toUpperCase();
      } else {
        mapUnidades[d.clues] = (d.unidad || "UNIDAD DESCONOCIDA").toUpperCase();
      }
    });
    arrClues = Array.from(unidadesSet).sort();
  }

  let insumos = [];
  if (tipo === "CONS") {
    insumos = [
      { key: "srp_dosis", label: "DOSIS DE SRP", color: "B23A48", lightColor: "F3B7CA", fontColor: "FFFFFFFF" },
      { key: "sr_dosis", label: "DOSIS DE SR", color: "7B5EA7", lightColor: "C1B3D5", fontColor: "FFFFFFFF" },
      { key: "jeringa_reconst_5ml_0605500438", label: "JERINGA DE RECONSTITUCIÓN 5 mL", color: "595959", lightColor: "CCCCCC", fontColor: "FFFFFFFF" },
      { key: "jeringa_aplic_05ml_0605502657", label: "JERINGA DE APLICACIÓN 0.5 mL", color: "1A428A", lightColor: "A3B7DC", fontColor: "FFFFFFFF" },
      { key: "aguja_0600403711", label: "AGUJA", color: "D96B27", lightColor: "EFAF87", fontColor: "FF000000" }
    ];
  } else {
    insumos = [
      { key: "bcg", label: "BCG", color: "3A86B7", lightColor: "A5CBE3", fontColor: "FFFFFFFF" },
      { key: "hepatitis_b", label: "HEPATITIS B", color: "C43D3D", lightColor: "E8B2B2", fontColor: "FFFFFFFF" },
      { key: "hexavalente", label: "HEXAVALENTE", color: "9ACD32", lightColor: "CDE69A", fontColor: "FF000000" },
      { key: "dpt", label: "DPT", color: "E9C46A", lightColor: "F3E0AF", fontColor: "FF000000" },
      { key: "rotavirus", label: "ROTAVIRUS", color: "264653", lightColor: "93BCCD", fontColor: "FFFFFFFF" },
      { key: "neumococica_13", label: "NEUMOCÓCICA 13", color: "3D405B", lightColor: "ACAFC8", fontColor: "FFFFFFFF" },
      { key: "neumococica_20", label: "NEUMOCÓCICA 20", color: "3D405B", lightColor: "ACAFC8", fontColor: "FFFFFFFF" },
      { key: "srp", label: "SRP", color: "B23A48", lightColor: "F3B7CA", fontColor: "FFFFFFFF" },
      { key: "sr", label: "SR", color: "7B5EA7", lightColor: "C1B3D5", fontColor: "FFFFFFFF" },
      { key: "vph", label: "VPH", color: "2A9D8F", lightColor: "A4E6DE", fontColor: "FF000000" },
      { key: "varicela", label: "VARICELA", color: "8ED1C2", lightColor: "BEE4DC", fontColor: "FF000000" },
      { key: "hepatitis_a", label: "HEPATITIS A", color: "BDBDBD", lightColor: "DBDBDB", fontColor: "FF000000" },
      { key: "td", label: "TD", color: "9E9E9E", lightColor: "C0C0C0", fontColor: "FF000000" },
      { key: "tdpa", label: "TDPA", color: "E76F51", lightColor: "F3B9AB", fontColor: "FFFFFFFF" },
      { key: "covid_19", label: "COVID-19", color: "4A4A4A", lightColor: "BCBCBC", fontColor: "FFFFFFFF" },
      { key: "influenza", label: "INFLUENZA", color: "F1BDAD", lightColor: "F4CBBE", fontColor: "FF000000" },
      { key: "vsr", label: "VSR", color: "D8B4A0", lightColor: "EBD8CD", fontColor: "FF000000" }
    ];
  }

  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F3E46' } };
  const fontWhite = { color: { argb: 'FFFFFFFF' }, bold: true, name: 'Arial Nova', size: 11 };
  const borderAll = {
    top: { style: 'thin', color: { argb: 'FFD9D9D9' } }, left: { style: 'thin', color: { argb: 'FFD9D9D9' } }, bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } }, right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
  };

  let headerRowText = tipo === "SR" ? "EXISTENCIA DE BIOLÓGICO" : (tipo === "CONS" ? "CONSUMIBLES SR/SRP" : "PEDIDO DE BIOLÓGICO");

  ws.getCell('A1').value = headerRowText;
  ws.getCell('A1').fill = headerFill;
  ws.getCell('A1').font = { color: { argb: 'FFFFFFFF' }, bold: true, name: 'Arial Nova', size: 14 };
  ws.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
  ws.mergeCells(1, 1, 1, 2 + arrClues.length);
  ws.getRow(1).height = 50;

  let munisLabel = "TODOS";
  if (selectedMunicipios && selectedMunicipios.length > 0) {
    munisLabel = selectedMunicipios.join(", ").toUpperCase();
  } else if (data[0]?.municipio) {
    munisLabel = data[0].municipio.toUpperCase();
  }

  ws.getCell('A2').value = 'MUNICIPIO: ' + munisLabel;
  ws.getCell('A2').font = { bold: true };
  ws.getCell('A2').alignment = { horizontal: 'left' };
  ws.mergeCells('A2:B2');

  const lastColIndex = 1 + arrClues.length + (tipo === "CONS" ? 0 : 1);
  ws.getCell(2, Math.max(3, lastColIndex)).value = (tipo === 'BIO' ? 'FECHA PEDIDO: ' : 'FECHA REPORTE: ') + fIni;
  ws.getCell(2, Math.max(3, lastColIndex)).font = { bold: true };
  ws.getCell(2, Math.max(3, lastColIndex)).alignment = { horizontal: 'right' };

  const headerRowIdx = 3;
  const headerRow = ws.getRow(headerRowIdx);
  let colIndex = 1;
  const colName = tipo === "CONS" ? "INSUMO" : "BIOLÓGICO";
  ws.getCell(headerRowIdx, colIndex).value = colName;
  ws.getCell(headerRowIdx, colIndex).fill = headerFill;
  ws.getCell(headerRowIdx, colIndex).font = fontWhite;
  ws.getCell(headerRowIdx, colIndex).alignment = { vertical: 'middle', horizontal: 'center' };
  colIndex++;

  arrClues.forEach(clues => {
    ws.getCell(headerRowIdx, colIndex).value = `${clues} - ${mapUnidades[clues]}`;
    ws.getCell(headerRowIdx, colIndex).fill = headerFill;
    ws.getCell(headerRowIdx, colIndex).font = fontWhite;
    ws.getCell(headerRowIdx, colIndex).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    ws.getCell(headerRowIdx, colIndex).border = borderAll;
    ws.getColumn(colIndex).width = 20;

    if (tipo === "BIO") {
      ws.getCell(4, colIndex).value = "PEDIDO";
      ws.getCell(4, colIndex).font = { bold: true };
      ws.getCell(4, colIndex).alignment = { horizontal: 'center' };
      ws.getCell(4, colIndex).border = borderAll;
    }
    colIndex++;
  });

  ws.getCell(headerRowIdx, colIndex).value = "TOTAL";
  ws.getCell(headerRowIdx, colIndex).fill = headerFill;
  ws.getCell(headerRowIdx, colIndex).font = fontWhite;
  ws.getCell(headerRowIdx, colIndex).alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getCell(headerRowIdx, colIndex).border = borderAll;
  colIndex++;

  ws.getColumn(1).width = 30;
  headerRow.height = 40;

  let rowCursor = tipo === "BIO" ? 5 : 4;

  insumos.forEach(insumo => {
    let cIdx = 1;
    const fgColor = { argb: 'FF' + insumo.color.replace('#', '') };
    const bgColor = { argb: 'FF' + (insumo.lightColor || insumo.color).replace('#', '') };

    const labelFontColor = insumo.fontColor || 'FF000000';
    ws.getCell(rowCursor, cIdx).value = insumo.label;
    ws.getCell(rowCursor, cIdx).fill = { type: 'pattern', pattern: 'solid', fgColor };
    ws.getCell(rowCursor, cIdx).font = { color: { argb: 'FFFFFFFF' }, bold: true, name: 'Arial Nova', size: 11 };
    ws.getCell(rowCursor, cIdx).border = borderAll;
    ws.getCell(rowCursor, cIdx).alignment = { vertical: 'middle', horizontal: 'left' };

    let rowTotal = 0;
    cIdx++;

    arrClues.forEach(clues => {
      let val = 0;
      const matchingRecords = data.filter(d => d.clues === clues);

      if (tipo === "CONS") {
        matchingRecords.forEach(d => { val += Number(d[insumo.key] || 0); });
      } else if (tipo === "SR") {
        matchingRecords.forEach(d => { val += Number(d[insumo.key] || 0); });
      } else {
        const norm = (s) => String(s || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        matchingRecords.filter(d => norm(d.biologico) === norm(insumo.label))
          .forEach(d => { val += Number(d.solicitud || d.frascos || d.pedido_frascos || 0); });
      }

      rowTotal += val;
      ws.getCell(rowCursor, cIdx).value = Number(val);
      ws.getCell(rowCursor, cIdx).fill = { type: 'pattern', pattern: 'solid', fgColor: bgColor };
      ws.getCell(rowCursor, cIdx).border = borderAll;
      ws.getCell(rowCursor, cIdx).alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getCell(rowCursor, cIdx).font = { name: 'Arial Nova', size: 11, bold: true };
      cIdx++;
    });

    ws.getCell(rowCursor, cIdx).value = Number(rowTotal);
    ws.getCell(rowCursor, cIdx).border = borderAll;
    ws.getCell(rowCursor, cIdx).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell(rowCursor, cIdx).font = { name: 'Arial Nova', size: 11, bold: true };
    ws.getCell(rowCursor, cIdx).fill = { type: 'pattern', pattern: 'solid', fgColor: bgColor };
    rowCursor++;
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const todayStr = new Date().toISOString().split('T')[0];
  let exportFileName = `Reporte_${tipo}_${fIni}.xlsx`;
  if (tipo === "BIO") {
    const [yyyy, mm] = (fIni || "").split('-');
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const mesNombre = mm ? (months[parseInt(mm, 10) - 1] || mm) : "";
    exportFileName = `Pedido de biologico ${mesNombre} ${yyyy} - Exportado ${todayStr}.xlsx`;
  } else if (tipo === "CONS") {
    exportFileName = (fIni !== fFin && fFin) ? `Reporte de consumibles ${fIni} al ${fFin}.xlsx` : `Reporte de consumibles ${fIni}.xlsx`;
  } else if (tipo === "SR") {
    exportFileName = `Existencia de biologico ${fIni}.xlsx`;
  }

  a.download = exportFileName;
  a.click();
  window.URL.revokeObjectURL(url);
}

// --- PANEL ADMINISTRATIVO (LOGICA MODULAR) ---
window.activateAdminSubPanel = function (panelId) {
  // 1. Alternar Clases de Pestañas (Premium)
  const container = document.querySelector('#panelAdminSecurityTabs .nav-container');
  if (panelId === 'aperturas') {
    loadConsumiblesOverrideAdmin();
    loadExistenciaOverrideAdmin();
  }

  if (panelId === 'dashboard') {
    const activeSub = document.querySelector(".admin-tab.border-primary")?.id;
    if (activeSub === 'tabAdminUsers') refreshUsers();
    else if (activeSub === 'tabAdminCatalog') loadUnitCatalogAdmin();
    else if (activeSub === 'tabAdminAperturas') {
      loadConsumiblesOverrideAdmin();
      loadExistenciaOverrideAdmin();
    }
  }
  if (container) {
    container.querySelectorAll(".nav-tab").forEach(btn => {
      const isTarget = btn.id.toLowerCase().replace(/_/g, '').includes(panelId.toLowerCase().replace(/_/g, ''));
      btn.classList.toggle("active", isTarget);
    });
    syncTabGroupIndicator('#panelAdminSecurityTabs .nav-container');
  }

  // 2. Alternar Visibilidad de Paneles
  document.querySelectorAll(".admin-sub-panel").forEach(p => {
    const isTarget = p.id === "adminSection_" + panelId;
    p.classList.toggle("hide", !isTarget);
    p.style.display = isTarget ? "block" : "none";
  });

  // 3. Carga Automática según el Panel
  if (panelId === 'seguridad') refreshUsers();
  if (panelId === 'aperturas') loadConsumiblesOverrideAdmin();
  if (panelId === 'catalogo') refreshBulkBioSetup();
};

const rBtn = $("btnRefreshUsers");
if (rBtn) {
  rBtn.onclick = () => {
    const activeSub = document.querySelector(".nav-tab-admin.active")?.id;
    if (activeSub === 'tabAdminSeguridad') refreshUsers();
    else if (activeSub === 'tabAdminAperturas') loadConsumiblesOverrideAdmin();
    else if (activeSub === 'tabAdminCatalogo') refreshBulkBioSetup();
    else refreshUsers();
  };
}

// --- Lógica del Modal "Alta de Usuario" ---
const btnCreateUser = $("btnSubmitCreateUser");
if (btnCreateUser) {
  btnCreateUser.onclick = async () => {
    const email = $("createEmail")?.value.trim();
    const usuarioID = $("createUsuarioID")?.value.trim();
    const rol = $("createRol")?.value;
    const unidad = $("createUnidad")?.value;
    const clues = $("createClues")?.value.trim() || "";
    const municipio = $("createMunicipio")?.value;

    if (!email || !usuarioID || !rol) {
      showToast("El correo de acceso, el ID de usuario y el rol son obligatorios", false);
      return;
    }

    setBtnBusy("btnSubmitCreateUser", true);
    showOverlay("Creando usuario e inicializando sesión...", "Administración");

    try {
      const payload = {
        action: "admincreateuser",
        email: email,       // Credencial Supabase Auth
        usuario: usuarioID, // Identificador interno en tablas
        rol: rol,
        unidad: unidad,
        clues: clues,
        municipio: municipio
      };

      const res = await apiCall(payload);
      if (res && res.ok) {
        showToast(res.message || "Usuario dado de alta exitosamente", true);
        document.getElementById('createUserModal').classList.remove('show');
        // Limpiar formulario
        if ($("createEmail")) $("createEmail").value = "";
        if ($("createUsuarioID")) $("createUsuarioID").value = "";
        if ($("createRol")) $("createRol").value = "";
        if ($("createUnidad")) {
          $("createUnidad").innerHTML = '<option value="">Selecciona la Unidad</option>';
          $("createUnidad").value = "";
        }
        if ($("createClues")) $("createClues").value = "";
        if ($("createMunicipio")) $("createMunicipio").value = "";
        await refreshUsers();
      } else {
        showToast(res.error || "Hubo un error al crear el usuario", false);
      }
    } catch (err) {
      showToast(err.message || "Error de conexión", false);
      console.error(err);
    } finally {
      setBtnBusy("btnSubmitCreateUser", false);
      hideOverlay();
    }
  };
}

// Lógica dinámica para el formulario (Cascada y Auto-completado)
const createRol = $("createRol");
const createUnidad = $("createUnidad");
const createClues = $("createClues");
const createMunicipio = $("createMunicipio");
const createUsuarioID = $("createUsuarioID");

if (createRol && createUnidad && createClues && createMunicipio) {
  createRol.addEventListener("change", () => {
    const val = createRol.value;

    // Reset
    createUnidad.disabled = false;
    createMunicipio.disabled = false;
    createClues.value = "";
    createUnidad.innerHTML = '<option value="">Selecciona la Unidad</option>';

    if (val === "JURISDICCIONAL" || val === "MUNICIPAL" || val === "CARAVANAS") {
      createUnidad.innerHTML = '<option value="OFICINAS DE LA JURISDICCIÓN SANITARIA 1">OFICINAS DE LA JURISDICCIÓN SANITARIA 1</option>';
      createUnidad.value = "OFICINAS DE LA JURISDICCIÓN SANITARIA 1";
      createClues.value = "QTSSA012154";
      createUnidad.disabled = true;

      if (val === "JURISDICCIONAL") {
        createMunicipio.value = "";
        createMunicipio.disabled = true;
        createUsuarioID.value = "QTSSA012154_JURISDICCIONAL";
      } else if (val === "CARAVANAS") {
        createMunicipio.value = "";
        createMunicipio.disabled = true;
        createUsuarioID.value = "QTSSA012154_CARAVANAS";
      } else {
        // MUNICIPAL: Permite elegir municipio pero bloquea unidad
        createMunicipio.disabled = false;
        createMunicipio.value = "";
        createUsuarioID.value = "";
      }
    } else if (val === "UNIDAD") {
      createUnidad.value = "";
      createClues.value = "";
      createMunicipio.value = "";
      createUnidad.disabled = false;
      createMunicipio.disabled = false;
      createUsuarioID.value = "";
    }
  });

  createMunicipio.addEventListener("change", async () => {
    const rol = createRol.value;
    const mun = createMunicipio.value;

    if (rol === "UNIDAD" || rol === "MUNICIPAL") {
      // Asegurar que el catálogo esté cargado
      let catalog = (typeof NOTIF_UNIT_CATALOG !== "undefined") ? NOTIF_UNIT_CATALOG : [];
      if (catalog.length === 0 && typeof loadNotifUnitCatalog === "function") {
        catalog = await loadNotifUnitCatalog();
      }

      const norm = (str) => String(str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
      const munNorm = norm(mun);

      if (rol === "UNIDAD") {
        const filtered = catalog.filter(x => norm(x.municipio || x.MUNICIPIO || "") === munNorm);
        let html = '<option value="">Selecciona la Unidad</option>';
        filtered.forEach(u => {
          const name = u.unidad || u.UNIDAD || u.nombre || "";
          html += `<option value="${name}">${name}</option>`;
        });
        createUnidad.innerHTML = html;
        createUnidad.value = "";
        createClues.value = "";
      }

      if (rol === "MUNICIPAL") {
        createUsuarioID.value = `QTSSA012154_${munNorm.replace(/\s+/g, '_')}`;
      }
    }
  });

  createUnidad.addEventListener("change", async () => {
    const rol = createRol.value;
    if (rol !== "UNIDAD") return;

    const val = createUnidad.value;
    const mun = createMunicipio.value;

    let catalog = (typeof NOTIF_UNIT_CATALOG !== "undefined") ? NOTIF_UNIT_CATALOG : [];
    const norm = (str) => String(str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    const munNorm = norm(mun);
    const valNorm = norm(val);

    const match = catalog.find(x => {
      const itemMun = norm(x.municipio || x.MUNICIPIO || "");
      const itemUni = norm(x.unidad || x.UNIDAD || x.nombre || "");
      return itemMun === munNorm && itemUni === valNorm;
    });

    if (match) {
      const clues = match.clues || match.CLUES || "";
      const unitName = match.unidad || match.UNIDAD || match.nombre || "";
      createClues.value = clues;
      // Generar ID con CLUES + NOMBRE DE UNIDAD (normalizado)
      const unitID = norm(unitName).replace(/\s+/g, '_');
      createUsuarioID.value = `${clues}_${unitID}`;
    }
  });
}

const pBtn = $("btnRefreshPinol");
if (pBtn) pBtn.onclick = () => refreshPinol();

// Link Save Biological Calendar
$("btnSaveBioOverride")?.addEventListener("click", saveBioOverride);
if ($("pinolFiltroEstatus")) {
  $("pinolFiltroEstatus").addEventListener("change", () => refreshPinol());
}

async function loadConsumiblesOverrideAdmin() {
  if (!USER || USER.rol !== "ADMIN") return;

  try {
    const r = await apiCall({ action: "adminGetConsumiblesOverride" });
    const setStatus = (text, isActiva) => {
      if ($("consOverrideStateTxt")) $("consOverrideStateTxt").textContent = text;
      if ($("consOverrideDot")) {
        $("consOverrideDot").className = `w-2 h-2 rounded-full ${isActiva ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300'} animate-pulse`;
      }
      if ($("consOverrideBadge")) {
        $("consOverrideBadge").className = `px-3 py-1.5 rounded-xl border flex items-center gap-2 ${isActiva ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`;
      }
    };

    if (!r || !r.ok || !r.data) {
      setStatus("REGLA ESTÁNDAR", false);
      return;
    }

    const data = r.data || {};
    if ($("consOverrideDate")) $("consOverrideDate").value = data.fecha || "";
    if ($("consOverrideReason")) $("consOverrideReason").value = data.motivo || "";
    
    if (data.fecha) {
      setStatus("ACTIVA: " + formatDateMx(data.fecha), true);
    } else {
      setStatus("REGLA ESTÁNDAR", false);
    }
  } catch (e) {
    console.error("loadConsumiblesOverrideAdmin error:", e);
  }
}

async function loadExistenciaOverrideAdmin() {
  if (!USER || USER.rol !== "ADMIN") return;

  try {
    const r = await apiCall({ action: "adminGetExistenciaOverride" });
    const setStatus = (text, isActiva) => {
      if ($("existenciaOverrideStateTxt")) $("existenciaOverrideStateTxt").textContent = text;
      if ($("existenciaOverrideDot")) {
        $("existenciaOverrideDot").className = `w-2 h-2 rounded-full ${isActiva ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-slate-300'} animate-pulse`;
      }
      if ($("existenciaOverrideBadge")) {
        $("existenciaOverrideBadge").className = `px-3 py-1.5 rounded-xl border flex items-center gap-2 ${isActiva ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-100'}`;
      }
    };

    if (!r || !r.ok || !r.data) {
      setStatus("REGLA ESTÁNDAR", false);
      return;
    }

    const data = r.data || {};
    if ($("existenciaOverrideDate")) $("existenciaOverrideDate").value = data.fecha || "";
    if ($("existenciaOverrideReason")) $("existenciaOverrideReason").value = data.motivo || "";
    
    if (data.fecha) {
      setStatus("ACTIVA: " + formatDateMx(data.fecha), true);
    } else {
      setStatus("REGLA ESTÁNDAR", false);
    }
  } catch (e) {
    console.error("loadExistenciaOverrideAdmin error:", e);
  }
}

async function refreshConsumiblesStatusUi() {
  const st = await unitStatus();
  if (!st) return;

  STATUS = st;

  if ($("dayTxt")) {
    $("dayTxt").textContent = formatDayBadgeMx(STATUS.today);
  }

  if ($("tabCONS")) {
    const can = !!(STATUS && STATUS.canCaptureConsumibles);
    $("tabCONS").disabled = false;
    $("tabCONS").title = can ? (STATUS.consumiblesReason || "Abierto") : "";

    // Mostrar leyenda de motivo si está abierto
    if (can && (STATUS.consumiblesReason && !STATUS.consumiblesReason.includes("Jueves"))) {
      showToast(STATUS.consumiblesReason, true, "info");
    }
  }

  if ($("tabBIO")) {
    const can = !!(STATUS && STATUS.canCaptureBio);
    $("tabBIO").title = can ? (STATUS.bioReason || "Abierto") : "Cerrado: Solo jueves/viernes o ventana mensual";
  }

  paintStatusChips(STATUS);
}

$("btnSaveConsOverride").onclick = async () => {
  if (isBtnBusy("btnSaveConsOverride")) return;

  const fecha = $("consOverrideDate").value;
  const motivo = $("consOverrideReason").value;

  if (!fecha) {
    showToast("Selecciona una fecha de apertura", false, "warn");
    return;
  }

  setBtnBusy("btnSaveConsOverride", true, "Guardando...");
  showOverlay("Configurando apertura extraordinaria...", "Administración");

  try {
    const r = await apiCall({
      action: "adminSetConsumiblesOverride",
      fecha,
      motivo,
      enabled: "SI"
    });

    if (!r || !r.ok) {
      showToast(r?.error || "No se pudo guardar la apertura", false);
      return;
    }

    showToast("Apertura extraordinaria habilitada con éxito", true);
    await loadConsumiblesOverrideAdmin();
    await refreshConsumiblesStatusUi();
  } catch (e) {
    console.error("btnSaveConsOverride error:", e);
    showToast("Error al guardar apertura extraordinaria", false);
  } finally {
    setBtnBusy("btnSaveConsOverride", false);
    hideOverlay();
  }
};

$("btnClearConsOverride").onclick = async () => {
  if (isBtnBusy("btnClearConsOverride")) return;
  if (!confirm("¿Deseas desactivar la apertura extraordinaria de consumibles?")) return;

  setBtnBusy("btnClearConsOverride", true, "Limpiando...");
  try {
    const r = await apiCall({
      action: "adminSetConsumiblesOverride",
      enabled: "NO"
    });

    if (!r || !r.ok) throw new Error(r?.error || "Error al desactivar");

    showToast("Apertura extraordinaria desactivada");
    $("consOverrideDate").value = "";
    $("consOverrideReason").value = "";
    await loadConsumiblesOverrideAdmin();
    await refreshConsumiblesStatusUi();
  } catch (e) {
    console.error("btnClearConsOverride error:", e);
    showToast("Error al desactivar", false);
  } finally {
    setBtnBusy("btnClearConsOverride", false);
  }
};

$("btnSaveExistenciaOverride").onclick = async () => {
  if (isBtnBusy("btnSaveExistenciaOverride")) return;

  const fecha = $("existenciaOverrideDate").value;
  const motivo = $("existenciaOverrideReason").value;

  if (!fecha) {
    showToast("Selecciona una fecha de apertura", false, "warn");
    return;
  }

  setBtnBusy("btnSaveExistenciaOverride", true, "Guardando...");
  showOverlay("Configurando apertura extraordinaria...", "Administración");

  try {
    const r = await apiCall({
      action: "adminSetExistenciaOverride",
      fecha,
      motivo,
      enabled: "SI"
    });

    if (!r || !r.ok) {
      showToast(r?.error || "No se pudo guardar la apertura", false);
      return;
    }

    showToast("Apertura extraordinaria de existencia habilitada", true);
    await loadExistenciaOverrideAdmin();
    await refreshConsumiblesStatusUi(); // Reusamos el refresco ya que llama a unitStatus()
  } catch (e) {
    console.error("btnSaveExistenciaOverride error:", e);
    showToast("Error al guardar apertura extraordinaria", false);
  } finally {
    setBtnBusy("btnSaveExistenciaOverride", false);
    hideOverlay();
  }
};

$("btnClearExistenciaOverride").onclick = async () => {
  if (isBtnBusy("btnClearExistenciaOverride")) return;
  if (!confirm("¿Deseas desactivar la apertura extraordinaria de existencia?")) return;

  setBtnBusy("btnClearExistenciaOverride", true, "Limpiando...");
  try {
    const r = await apiCall({
      action: "adminSetExistenciaOverride",
      enabled: "NO"
    });

    if (!r || !r.ok) throw new Error(r?.error || "Error al desactivar");

    showToast("Apertura extraordinaria desactivada");
    $("existenciaOverrideDate").value = "";
    $("existenciaOverrideReason").value = "";
    await loadExistenciaOverrideAdmin();
    await refreshConsumiblesStatusUi();
  } catch (e) {
    console.error("btnClearExistenciaOverride error:", e);
    showToast("Error al desactivar", false);
  } finally {
    setBtnBusy("btnClearExistenciaOverride", false);
  }
};


async function refreshUsers() {
  if (!USER || USER.rol !== "ADMIN") return;

  // Asegurar que catálogos de apoyo estén cargados
  loadNotifUnitCatalog().catch(console.error);
  loadNotifUserCatalog().catch(console.error);

  const tbody = $("usersTbody");
  if (tbody) {
    tbody.innerHTML = getTableSkeletonHtml(6);
  }

  try {
    const r = await smartLoader(
      () => apiCall({ action: "adminListUsers", token: TOKEN }),
      {
        delay: 140,
        message: "Cargando usuarios…",
        title: "Usuarios"
      }
    );
    if (!r || !r.ok) {
      showToast((r && r.error) ? r.error : "No se pudo cargar", false);
      return;
    }

    const users = r.data || [];
    if ($("usersCount")) $("usersCount").textContent = `${users.length} usuario(s)`;

    const tbody = $("usersTbody");
    if (!tbody) throw new Error("No existe #usersTbody");

    tbody.innerHTML = "";

    if (users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="muted">Sin usuarios</td></tr>`;
      return;
    }

    for (const u of users) {
      const tr = document.createElement("tr");
      tr.className = "hover:bg-primary/5 transition-colors group border-b border-outline-variant/30";

      const isActivo = u.activo === "SI";
      const roleClass = u.rol === "ADMIN" ? "bg-primary/10 text-primary border-primary/20" : "bg-slate-100 text-slate-600 border-slate-200";
      const statusClass = isActivo ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700";

      tr.innerHTML = `
        <td class="px-6 py-5 align-middle" style="word-break: break-all; overflow-wrap: break-word;">
           <div class="flex flex-col min-w-0" style="word-break: break-all; overflow-wrap: break-word;">
              <span class="font-extrabold text-primary text-[13px] tracking-tight leading-normal" title="${escapeHtml(u.usuario)}" style="word-break: break-all; overflow-wrap: break-word; white-space: normal; display: block;">${escapeHtml(u.usuario)}</span>
              <span class="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">Cuenta Activa</span>
           </div>
        </td>
        <td class="px-6 py-5 align-middle" style="word-break: break-all; overflow-wrap: break-word;">
           <div class="flex flex-col min-w-0" style="word-break: break-all; overflow-wrap: break-word;">
              <span class="font-bold text-slate-600 text-[13px] tracking-tight leading-normal" title="${escapeHtml(u.email || 'Sin correo registrado')}" style="word-break: break-all; overflow-wrap: break-word; white-space: normal; display: block;">${escapeHtml(u.email || 'Sin correo registrado')}</span>
           </div>
        </td>
        <td class="px-6 py-5 align-middle">
           <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${roleClass}">${escapeHtml(u.rol)}</span>
        </td>
        <td class="px-6 py-5 align-middle">
           <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full shrink-0 ${isActivo ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-400'}"></span>
              <span class="text-[11px] font-black uppercase tracking-wide ${statusClass.split(' ')[1]}">${isActivo ? 'Habilitado' : 'Suspendido'}</span>
           </div>
        </td>
        <td class="px-6 py-5 align-middle text-right">
          <div class="flex items-center justify-end gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
            <button class="adminActionBtn w-8 h-8 rounded-xl bg-surface-variant flex items-center justify-center text-surface-on hover:bg-primary hover:text-white transition-all shadow-sm cursor-pointer border-none" data-action="reset" data-user="${escapeAttr(u.usuario)}" title="Nueva Contraseña">
              <span class="material-symbols-rounded text-lg">key</span>
            </button>
            <button class="adminActionBtn w-8 h-8 rounded-xl ${isActivo ? 'bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white'} flex items-center justify-center transition-all shadow-sm cursor-pointer border-none" data-action="toggle" data-user="${escapeAttr(u.usuario)}" data-active="${escapeAttr(u.activo)}" title="${isActivo ? 'Bloquear Acceso' : 'Activar Acceso'}">
              <span class="material-symbols-rounded text-lg">${isActivo ? 'block' : 'check_circle'}</span>
            </button>
            <button class="adminActionBtn w-8 h-8 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white flex items-center justify-center transition-all shadow-sm cursor-pointer border-none" data-action="delete" data-user="${escapeAttr(u.usuario)}" title="Eliminar definitivamente">
              <span class="material-symbols-rounded text-lg">delete</span>
            </button>
          </div>
        </td>`;
      tbody.appendChild(tr);
    }

    // VINCULAR EVENTOS
    document.querySelectorAll("#usersTbody .adminActionBtn").forEach(btn => {
      btn.onclick = async () => {
        const action = btn.dataset.action;
        const targetUser = btn.dataset.user;
        const currentActive = btn.dataset.active;

        if (action === "delete" && !confirm(`¿Estás seguro de eliminar a ${targetUser}?`)) return;

        try {
          showOverlay("Procesando...", "Admin");
          let r;
          if (action === "toggle") {
            const newActive = String(currentActive || "SI").toUpperCase() === "SI" ? "NO" : "SI";
            r = await apiCall({ action: "adminToggleUser", usuario: targetUser, activo: newActive });
          } else if (action === "reset") {
            r = await apiCall({ action: "adminResetPassword", usuario: targetUser });
          } else if (action === "delete") {
            r = await apiCall({ action: "adminDeleteUser", usuario: targetUser });
          }

          if (r && r.ok) {
            showToast(r.message || "Operación exitosa", true);
            await refreshUsers();
          } else {
            showToast(r.error || "Error en la operación", false);
          }
        } catch (e) {
          showToast("Error de conexión", false);
        } finally {
          hideOverlay();
        }
      };
    });
  } catch (e) {
    console.error("refreshUsers error:", e);
  }
}


async function listPinol(force = false) {
  if (!TOKEN) throw new Error("Sin token de sesión");

  const cacheKey = buildCacheKey("PINOL_LIST", "BASE");

  const data = force
    ? await (async () => {
      const r = await apiCall({ action: "listPinol", token: TOKEN });

      if (!r) throw new Error("Respuesta vacía del servidor");
      if (!r.ok) throw new Error(r.error || "No se pudo consultar PINOL");

      return Array.isArray(r.data) ? r.data : [];
    })()
    : await getCachedOrFetch({
      key: cacheKey,
      ttl: CACHE_TTL.PINOL_LIST,
      fetcher: async () => {
        const r = await apiCall({ action: "listPinol", token: TOKEN });

        if (!r) throw new Error("Respuesta vacía del servidor");
        if (!r.ok) throw new Error(r.error || "No se pudo consultar PINOL");

        return Array.isArray(r.data) ? r.data : [];
      },
      shouldCache: (data) => Array.isArray(data)
    });

  const result = Array.isArray(data) ? data : [];
  window._pinolCache = result; // Expose for syncCommandHub PINOL state machine
  return result;
}

function openPinolEntregaModal(item) {
  PINOL_ENTREGA_CTX = item || null;

  $("pinolEntregaMetaMunicipio").textContent = item?.municipio || "—";
  $("pinolEntregaMetaClues").textContent = item?.clues || "—";
  $("pinolEntregaMetaUnidad").textContent = item?.unidad || "—";
  $("pinolEntregaComentario").value = "";

  $("pinolEntregaModal")?.classList.add("show");

  setTimeout(() => {
    $("pinolEntregaComentario")?.focus();
  }, 30);
}

function closePinolEntregaModal() {
  PINOL_ENTREGA_CTX = null;
  $("pinolEntregaComentario").value = "";
  $("pinolEntregaModal")?.classList.remove("show");
}

async function confirmPinolDeliveredFromModal() {
  const item = PINOL_ENTREGA_CTX;
  if (!item?.id) {
    showToast("No se encontró la solicitud de pinol", false);
    closePinolEntregaModal();
    return;
  }

  const comentario = String($("pinolEntregaComentario")?.value || "").trim();

  closePinolEntregaModal();
  showOverlay("Marcando solicitud como entregada…", "Pinol");

  await markPinolDelivered(item.id, comentario);
}

async function markPinolDelivered(id, comentario = "") {
  try {
    const r = await apiCall({
      action: "markPinolDelivered",
      token: TOKEN,
      id,
      comentario_notificacion: String(comentario || "").trim()
    });

    if (!r || !r.ok) {
      showToast((r && r.error) ? r.error : "No se pudo marcar como entregada", false);
      return;
    }

    showToast("Solicitud marcada como entregada");


    await refreshAfterMutation({
      touchPinol: true
    });

    await loadNotifications({ silent: true });
  } catch (e) {
    console.error("markPinolDelivered error:", e);
    showToast("Error al marcar solicitud como entregada", false);
  } finally {
    hideOverlay();
  }
}

function updatePinolTabBadge(items) {
  const badgeTab = $("pinolBadgeTab");
  const badgeMain = $("pinolBadgeMain");
  const tabPinol = $("tabOPS_PINOL");
  const tabMain = $("tabCAP");

  const pendientes = (items || []).filter(x =>
    String(x.estatus || "PENDIENTE").toUpperCase() === "PENDIENTE"
  ).length;

  const hasPending = pendientes > 0;
  const badgeText = pendientes > 99 ? "99+" : String(pendientes);

  if (badgeTab) {
    badgeTab.textContent = badgeText;
    badgeTab.title = hasPending
      ? `${pendientes} solicitud(es) de pinol pendiente(s)`
      : "Sin solicitudes pendientes";
    badgeTab.style.display = hasPending ? "inline-flex" : "none";
    badgeTab.style.background = hasPending ? "#ef4444" : "#64748b";
  }

  if (badgeMain && USER && (USER.rol === "ADMIN" || USER.rol === "MUNICIPAL")) {
    badgeMain.textContent = badgeText;
    badgeMain.title = hasPending
      ? `${pendientes} solicitud(es) de pinol pendiente(s)`
      : "Sin solicitudes pendientes";
    badgeMain.style.display = hasPending ? "inline-flex" : "none";
    badgeMain.style.background = hasPending ? "#ef4444" : "#64748b";
  } else if (badgeMain) {
    badgeMain.style.display = "none";
  }

  if (tabPinol) {
    tabPinol.classList.toggle("liveAccent", hasPending);
    tabPinol.classList.toggle("notifHot", pendientes >= 5);
    tabPinol.title = hasPending
      ? `${pendientes} solicitud(es) pendiente(s) de pinol`
      : "Pinol sin pendientes";
  }

  if (tabMain && USER && (USER.rol === "ADMIN" || USER.rol === "MUNICIPAL")) {
    tabMain.classList.toggle("liveAccent", hasPending);
    tabMain.classList.toggle("notifHot", pendientes >= 5);
    tabMain.title = hasPending
      ? `Captura / Operación con ${pendientes} pendiente(s) de pinol`
      : "Captura / Operación";
  } else if (tabMain) {
    tabMain.classList.remove("liveAccent", "notifHot");
    tabMain.title = "Captura";
  }
}

async function refreshPinolBadgeOnly() {
  if (!USER || (USER.rol !== "ADMIN" && USER.rol !== "MUNICIPAL")) {
    $("tabOPS_PINOL")?.classList.remove("liveAccent", "notifHot");
    $("tabCAP")?.classList.remove("liveAccent", "notifHot");
    if ($("pinolBadgeMain")) $("pinolBadgeMain").style.display = "none";
    if ($("pinolBadgeTab")) $("pinolBadgeTab").style.display = "none";
    return;
  }

  try {
    const items = await listPinol(false);
    updatePinolTabBadge(items);
  } catch (e) {
    console.error("No se pudo actualizar badge de pinol", e);
  }
}

function formatPinolDate(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d)) return isoString;
  const meses = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = meses[d.getMonth()];
  const anio = d.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

function showPinolObsModal(text, event) {
  if (event) {
    event.stopPropagation();
  }

  const modal = $("pinolObsModal");
  const textEl = $("pinolObsText");
  if (!modal || !textEl) return;

  textEl.textContent = text || "";

  const triggerEl = event ? event.currentTarget : null;

  if (triggerEl) {
    const rect = triggerEl.getBoundingClientRect();
    const modalWidth = 340;

    const btnCenterX = rect.left + rect.width / 2;

    let left = btnCenterX - modalWidth / 2;
    if (left < 16) {
      left = 16;
    } else if (left + modalWidth > window.innerWidth - 16) {
      left = window.innerWidth - modalWidth - 16;
    }

    const originXPercent = ((btnCenterX - left) / modalWidth) * 100;

    // Default to opening above the icon
    let top = rect.top - 148;
    modal.style.transformOrigin = `${originXPercent}% 100%`;

    // Fallback below if it goes off-screen vertically at the top
    if (top < 16) {
      top = rect.bottom + 12;
      modal.style.transformOrigin = `${originXPercent}% 0%`;
    }

    modal.style.left = `${left}px`;
    modal.style.top = `${top}px`;
  }

  modal.classList.remove("pointer-events-none", "opacity-0");
  modal.style.opacity = "1";
  modal.style.pointerEvents = "auto";
  modal.style.transform = "scale(1)";

  if (window._pinolObsCloseListener) {
    document.removeEventListener("click", window._pinolObsCloseListener);
  }

  window._pinolObsCloseListener = (e) => {
    if (!modal.contains(e.target) && triggerEl && !triggerEl.contains(e.target)) {
      closePinolObsModal();
    }
  };

  document.addEventListener("click", window._pinolObsCloseListener);
}

function closePinolObsModal() {
  const modal = $("pinolObsModal");
  if (!modal) return;
  modal.classList.add("pointer-events-none", "opacity-0");
  modal.style.opacity = "0";
  modal.style.pointerEvents = "none";
  modal.style.transform = "scale(0.95)";

  if (window._pinolObsCloseListener) {
    document.removeEventListener("click", window._pinolObsCloseListener);
    window._pinolObsCloseListener = null;
  }
}

async function deletePinolRow(id) {
  if (!confirm("¿Estás seguro de que deseas eliminar esta solicitud permanentemente?")) return;
  showOverlay("Eliminando solicitud...", "Pinol");
  try {
    const { error } = await window.supabase.from("pinol_solicitudes").delete().eq("id", id);
    if (error) throw error;
    showToast("Solicitud eliminada", true, "good");
    invalidatePinolCache();
    await refreshPinol();
  } catch (e) {
    showToast("Error al eliminar", false, "bad");
    console.error(e);
  } finally {
    hideOverlay();
  }
}

async function refreshPinol() {
  if (!USER || (USER.rol !== "ADMIN" && USER.rol !== "MUNICIPAL")) return;

  const tbody = $("pinolTbody");
  if (tbody) {
    tbody.innerHTML = getPinolSkeletonHtml(5);
  }

  try {
    const items = await smartLoader(
      () => listPinol(true),
      {
        delay: 220,
        message: "Cargando solicitudes de pinol…",
        title: "Pinol"
      }
    );

    const tbody = $("pinolTbody");
    const filtroSel = $("pinolFiltroEstatus");
    const totalEl = $("pinolTotal");
    const pendientesEl = $("pinolPendientes");
    const entregadasEl = $("pinolEntregadas");
    const recibidasEl = $("pinolRecibidas");
    const alertMsgEl = $("pinolAlertMsg");

    if (!tbody) throw new Error("No existe #pinolTbody");

    const filtro = filtroSel
      ? String(filtroSel.value || "TODOS").toUpperCase()
      : "TODOS";

    const safeItems = Array.isArray(items) ? items : [];

    const total = safeItems.length;
    const pendientes = safeItems.filter(x => String(x?.estatus_visual || x?.estatus || "PENDIENTE").toUpperCase() === "PENDIENTE");
    const entregadas = safeItems.filter(x => String(x?.estatus_visual || x?.estatus || "").toUpperCase() === "ENTREGADO");
    const recibidas = safeItems.filter(x => String(x?.estatus_visual || x?.estatus || "").toUpperCase() === "RECIBIDO");

    updatePinolTabBadge(safeItems);

    if (totalEl) animateCounter("pinolTotal", parseInt(totalEl.textContent) || 0, total);
    if (pendientesEl) animateCounter("pinolPendientes", parseInt(pendientesEl.textContent) || 0, pendientes.length);
    if (entregadasEl) animateCounter("pinolEntregadas", parseInt(entregadasEl.textContent) || 0, entregadas.length);
    if (recibidasEl) animateCounter("pinolRecibidas", parseInt(recibidasEl.textContent) || 0, recibidas.length);

    // Semáforo automático
    if ($("kpiCardPinolPendientes")) {
      $("kpiCardPinolPendientes").className = "kpiCard " + (pendientes.length > 0 ? "warn" : "ok");
    }

    if (alertMsgEl) {
      alertMsgEl.className = "hint pinolAlertBox " + (pendientes.length > 0 ? "warn" : "ok");
      alertMsgEl.innerHTML = pendientes.length > 0
        ? `⚠️ Hay <b>${pendientes.length}</b> solicitud(es) de pinol pendientes por atender.`
        : `✅ No hay solicitudes pendientes de pinol. <span style="opacity:.9">Recibidas por unidad: <b>${recibidas.length}</b></span>`;
    }

    let filtered = safeItems.slice();

    if (filtro === "PENDIENTE") {
      filtered = filtered.filter(x => String(x?.estatus_visual || x?.estatus || "PENDIENTE").toUpperCase() === "PENDIENTE");
    } else if (filtro === "ENTREGADO") {
      filtered = filtered.filter(x => String(x?.estatus_visual || x?.estatus || "").toUpperCase() === "ENTREGADO");
    } else if (filtro === "RECIBIDO") {
      filtered = filtered.filter(x => String(x?.estatus_visual || x?.estatus || "").toUpperCase() === "RECIBIDO");
    }

    filtered.sort((a, b) => {
      const ea = String(a?.estatus_visual || a?.estatus || "PENDIENTE").toUpperCase();
      const eb = String(b?.estatus_visual || b?.estatus || "PENDIENTE").toUpperCase();

      const order = {
        "PENDIENTE": 1,
        "ENTREGADO": 2,
        "RECIBIDO": 3
      };

      const oa = order[ea] || 99;
      const ob = order[eb] || 99;

      if (oa !== ob) return oa - ob;

      return String(b?.fecha_solicitud || "").localeCompare(String(a?.fecha_solicitud || ""), "es");
    });

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="12" class="muted">Sin solicitudes para ese filtro</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(x => {
      const estatus = String(x?.estatus_visual || x?.estatus || "").toUpperCase();

      let estatusHtml = `
  <span class="crystalStatus warn">
    <span class="material-symbols-rounded">schedule</span>
    <span>Pendiente</span>
  </span>
`;

      if (estatus === "ENTREGADO") {
        estatusHtml = `
    <span class="crystalStatus info">
      <span class="material-symbols-rounded">local_shipping</span>
      <span>Entregado</span>
    </span>
  `;
      }

      if (estatus === "RECIBIDO") {
        estatusHtml = `
    <span class="crystalStatus ok">
      <span class="material-symbols-rounded">task_alt</span>
      <span>Recibido</span>
    </span>
  `;
      }
      const obsText = String(x?.observaciones || "").trim();
      const obsHtml = obsText ? `<button type="button" class="ghostBtn" onclick="showPinolObsModal('${escapeHtml(escapeAttr(obsText))}', event)" title="Ver observación" style="margin: 0 auto; display: flex;"><span class="material-symbols-rounded">chat</span></button>` : `<span class="muted text-center block">—</span>`;

      const fechaSoliFormateada = formatPinolDate(x?.fecha_solicitud);
      const fechaEntrega = x?.fecha_entrega || x?.timestamp_entrega || "";
      const fechaEntregaFormateada = formatPinolDate(fechaEntrega);

      let deleteHtml = "";
      if (USER && USER.rol === "ADMIN") {
        deleteHtml = `<button class="miniBtn ghostBtn btnPinolDelete" data-id="${escapeAttr(x?.id || "")}" style="color:#ef4444;" title="Eliminar"><span class="material-symbols-rounded">delete</span></button>`;
      }

      let actionContent = "";
      if (estatus === "PENDIENTE") {
        actionContent += `<button class="miniBtn btnPinolDeliver" data-id="${escapeAttr(x?.id || "")}">
      <span class="material-symbols-rounded">local_shipping</span> Entregar
    </button>`;
      }

      if (deleteHtml) {
        actionContent += deleteHtml;
      }

      if (!actionContent) {
        actionContent = `<span class="muted block text-center">—</span>`;
      }

      return `
        <tr>
          <td>${escapeHtml(fechaSoliFormateada)}</td>
          <td>${escapeHtml(x?.municipio || "")}</td>
          <td>${escapeHtml(x?.clues || "")}</td>
          <td>${escapeHtml(x?.unidad || "")}</td>
          <td class="text-center">${Number(x?.existencia_actual_botellas || 0)}</td>
          <td class="text-center">${Number(x?.solicitud_botellas || 0)}</td>
          <td>${obsHtml}</td>
          <td>${escapeHtml(fechaEntregaFormateada)}</td>
          <td>${estatusHtml}</td>
          <td>
            <div class="flex items-center justify-center gap-2">
              ${actionContent}
            </div>
          </td>
        </tr>
      `;
    }).join("");


    document.querySelectorAll(".btnPinolDeliver").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-id");
        if (!id) return;

        const item = Array.isArray(items)
          ? items.find(x => String(x?.id || "") === String(id))
          : null;

        if (!item) {
          showToast("No se encontró la solicitud seleccionada", false);
          return;
        }

        openPinolEntregaModal(item);
      };
    });

    document.querySelectorAll(".btnPinolDelete").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-id");
        if (id) deletePinolRow(id);
      };
    });

  } catch (e) {
    console.error("refreshPinol error:", e);
    showToast("No se pudo cargar PINOL", false);
  } finally {
    hideOverlay();
  }
}


document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !FACTS_TIMER) {
    startFactsRotation();
  }
});

// Arranque unificado activo.



async function getHistoryMetrics(mes, _ignored, force = false) {
  if (!TOKEN) return null;

  const m = mes || todayYmdLocal().substring(0, 7);
  const cacheKey = buildCacheKey("HISTORY_METRICS", `${m}`);

  const fetcher = async () => {
    try {
      const { data, error } = await window.supabase.rpc('get_history_metrics_rpc', { p_mes: m });
      if (error) {
        console.error("RPC Error in getHistoryMetrics:", error);
        return null;
      }
      
      // Mapear campos devueltos por el RPC para coincidir con la nomenclatura del frontend camelCase
      const rows = (data || []).map(r => ({
        clues: r.clues,
        municipio: r.municipio,
        unidad: r.unidad,
        bio_semanas_ok: r.bio_semanas_ok,
        cons_semanas_ok: r.cons_semanas_ok,
        pedido_mensual: r.pedido_mensual,
        ultima_captura: r.ultima_captura,
        score: r.score,
        tier: r.tier,
        eBio: r.ebio,
        eCons: r.econs,
        isPedidoRequired: r.ispedidorequired
      }));

      const role = String(USER?.rol || "").toUpperCase();
      return { rows, role };
    } catch (e) {
      console.error("Exception in getHistoryMetrics fetcher:", e);
      return null;
    }
  };

  return force ? await fetcher() : await getCachedOrFetch({
    key: cacheKey,
    ttl: CACHE_TTL.HISTORY_METRICS,
    fetcher,
    shouldCache: (data) => data != null
  });
}


let YEARLY_MEDALS_CACHE = {};

async function getYearlyMedals(year, clues) {
  console.log("[getYearlyMedals] Fetching medals for clues:", clues, "year:", year);
  const cacheKey = year + "__" + clues;
  if (YEARLY_MEDALS_CACHE[cacheKey]) {
    console.log("[getYearlyMedals] Returning cached medals:", YEARLY_MEDALS_CACHE[cacheKey]);
    return YEARLY_MEDALS_CACHE[cacheKey];
  }

  const months = [];
  const currentYear = new Date().getFullYear();
  const currentMonthNum = new Date().getMonth() + 1;
  const limitMonth = (year == currentYear) ? currentMonthNum : 12;

  for (let m = 1; m <= limitMonth; m++) {
    const monthStr = year + "-" + String(m).padStart(2, '0');
    months.push(monthStr);
  }

  const medals = [];
  let hasError = false;
  const promises = months.map(async (m) => {
    try {
      const data = await getHistoryMetrics(m, null, true);
      if (!data || !data.rows) {
        console.warn("[getYearlyMedals] No history metrics data for month", m);
        hasError = true;
        return;
      }

      const rows = [...data.rows];

      rows.forEach(r => {
        const expectedBio = r.eBio || 4;
        const expectedCons = r.eCons || 4;
        let bPct = expectedBio > 0 ? (r.bio_semanas_ok / expectedBio) * 100 : 100;
        let cPct = expectedCons > 0 ? (r.cons_semanas_ok / expectedCons) * 100 : 100;
        let pPct = 100;
        if (r.isPedidoRequired) {
          const hasPedido = r.pedido_mensual || r.has_pedido || r.pedido || r.pedido_capturado || r.is_pedido_done;
          pPct = hasPedido ? 100 : 0;
        }
        r.score = r.isPedidoRequired ?
          Math.round((bPct * 0.4) + (cPct * 0.4) + (pPct * 0.2)) :
          Math.round((bPct * 0.5) + (cPct * 0.5));
        if (r.score > 100) r.score = 100;
      });

      rows.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const capA = (a.bio_semanas_ok || 0) + (a.cons_semanas_ok || 0);
        const capB = (b.bio_semanas_ok || 0) + (b.cons_semanas_ok || 0);
        if (capB !== capA) return capB - capA;
        return (a.municipio || "").localeCompare(b.municipio || "");
      });

      const index = rows.findIndex(r => String(r.clues).trim().toUpperCase() === String(clues).trim().toUpperCase());
      console.log(`[getYearlyMedals] Month: ${m}, Clues to find: ${clues}, index found: ${index}`);
      if (index >= 0) {
        const uRow = rows[index];
        let tier = "riesgo";
        if (uRow.score === 100) tier = "diamante";
        else if (uRow.score >= 90) tier = "oro";
        else if (uRow.score >= 80) tier = "plata";
        else if (uRow.score >= 70) tier = "bronce";
        else if (uRow.score >= 60) tier = "acero";
        else if (uRow.score >= 50) tier = "jade";

        console.log(`[getYearlyMedals] Clues: ${clues}, Month: ${m}, Score: ${uRow.score}, Tier: ${tier}`);
        if (tier !== "riesgo") {
          medals.push({
            month: m,
            rank: index + 1,
            score: uRow.score,
            tier: tier
          });
        }
      }
    } catch (err) {
      console.error("Error loading medals for month " + m + ":", err);
      hasError = true;
    }
  });

  await Promise.all(promises);
  medals.sort((a, b) => a.month.localeCompare(b.month));
  if (!hasError && medals.length > 0) {
    YEARLY_MEDALS_CACHE[cacheKey] = medals;
  }
  return medals;
}

let MUNI_MEDALS_CACHE = {};

async function getYearlyMuniMedals(year, municipio) {
  console.log("[getYearlyMuniMedals] Fetching medals for muni:", municipio, "year:", year);
  const cacheKey = year + "__" + municipio;
  if (MUNI_MEDALS_CACHE[cacheKey]) {
    return MUNI_MEDALS_CACHE[cacheKey];
  }

  const months = [];
  const currentYear = new Date().getFullYear();
  const currentMonthNum = new Date().getMonth() + 1;
  const limitMonth = (year == currentYear) ? currentMonthNum : 12;

  for (let m = 1; m <= limitMonth; m++) {
    const monthStr = year + "-" + String(m).padStart(2, '0');
    months.push(monthStr);
  }

  const medals = [];
  let hasError = false;
  const promises = months.map(async (m) => {
    try {
      const data = await getHistoryMetrics(m, null, true);
      if (!data || !data.rows) {
        hasError = true;
        return;
      }

      const rows = [...data.rows];

      rows.forEach(r => {
        const expectedBio = r.eBio || 4;
        const expectedCons = r.eCons || 4;
        let bPct = expectedBio > 0 ? (r.bio_semanas_ok / expectedBio) * 100 : 100;
        let cPct = expectedCons > 0 ? (r.cons_semanas_ok / expectedCons) * 100 : 100;
        let pPct = 100;
        if (r.isPedidoRequired) {
          const hasPedido = r.pedido_mensual || r.has_pedido || r.pedido || r.pedido_capturado || r.is_pedido_done;
          pPct = hasPedido ? 100 : 0;
        }
        r.score = r.isPedidoRequired ?
          Math.round((bPct * 0.4) + (cPct * 0.4) + (pPct * 0.2)) :
          Math.round((bPct * 0.5) + (cPct * 0.5));
        if (r.score > 100) r.score = 100;
      });

      // Group by municipality
      const muniGroups = {};
      rows.forEach(r => {
        const mName = normalizeText(r.municipio || "");
        if (!mName) return;
        if (!muniGroups[mName]) {
          muniGroups[mName] = { scoreSum: 0, count: 0 };
        }
        muniGroups[mName].scoreSum += r.score;
        muniGroups[mName].count++;
      });

      // Calculate averages
      const muniList = Object.keys(muniGroups).map(name => {
        return {
          municipio: name,
          score: Math.round(muniGroups[name].scoreSum / muniGroups[name].count)
        };
      }).sort((a, b) => b.score - a.score);

      const index = muniList.findIndex(x => normalizeText(x.municipio) === normalizeText(municipio));
      if (index >= 0) {
        const score = muniList[index].score;
        let tier = "riesgo";
        if (score === 100) tier = "diamante";
        else if (score >= 90) tier = "oro";
        else if (score >= 80) tier = "plata";
        else if (score >= 70) tier = "bronce";
        else if (score >= 60) tier = "acero";
        else if (score >= 50) tier = "jade";

        if (tier !== "riesgo") {
          medals.push({
            month: m,
            rank: index + 1,
            score: score,
            tier: tier
          });
        }
      }
    } catch (err) {
      console.error("Error loading medals for month " + m + ":", err);
      hasError = true;
    }
  });

  await Promise.all(promises);
  medals.sort((a, b) => a.month.localeCompare(b.month));
  if (!hasError && medals.length > 0) {
    MUNI_MEDALS_CACHE[cacheKey] = medals;
  }
  return medals;
}

function renderUnitMedals(medals) {
  console.log("[renderUnitMedals] Rendering medals in UI:", medals);
  const container = $("bCumplimientoMedals");
  if (!container) {
    console.warn("[renderUnitMedals] Element #bCumplimientoMedals not found!");
    return;
  }
  container.innerHTML = "";

  if (!medals || !medals.length) {
    console.log("[renderUnitMedals] Empty medals array, rendering nothing.");
    return;
  }

  const monthNames = {
    "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr", "05": "May", "06": "Jun",
    "07": "Jul", "08": "Ago", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic"
  };

  const fullMonthNames = {
    "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril", "05": "Mayo", "06": "Junio",
    "07": "Julio", "08": "Agosto", "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre"
  };

  const iconNameMap = {
    diamante: "diamond",
    oro: "workspace_premium",
    plata: "military_tech",
    bronce: "military_tech",
    acero: "workspace_premium",
    jade: "military_tech"
  };

  const classMap = {
    diamante: "tier-diamante",
    oro: "tier-oro",
    plata: "tier-plata",
    bronce: "tier-bronze",
    acero: "tier-steel",
    jade: "tier-emerald"
  };

  const titleMap = {
    diamante: "Diamante",
    oro: "Oro",
    plata: "Plata",
    bronce: "Bronce",
    acero: "Acero",
    jade: "Jade"
  };

  medals.forEach(m => {
    const monthParts = m.month.split("-");
    const mm = monthParts[1];
    const fullMonthLabel = fullMonthNames[mm] || mm;
    const tierKey = String(m.tier || "").trim().toLowerCase();
    const iconName = iconNameMap[tierKey] || "military_tech";
    const tierClass = classMap[tierKey] || "tier-riesgo";
    const label = titleMap[tierKey] || "Cumplimiento";
    const title = `Medalla de cumplimiento ${label} - ${fullMonthLabel} (${m.score}%)`;

    container.innerHTML += `
      <span class="material-symbols-rounded chip-medal-icon ${tierClass}" title="${title}">${iconName}</span>
    `;
  });
}

function updateCumplimientoMedalTone(userRank, userTier = "") {
  const container = $("bCumplimiento");
  if (!container) return;

  container.classList.remove("podium-gold-chip", "podium-silver-chip", "podium-bronze-chip", "podium-steel-chip", "podium-emerald-chip", "podium-diamond-chip");

  const normalizedTier = String(userTier || "").trim().toLowerCase();

  if (normalizedTier === "diamante") {
    container.classList.add("podium-diamond-chip");
  } else if (normalizedTier === "oro") {
    container.classList.add("podium-gold-chip");
  } else if (normalizedTier === "plata") {
    container.classList.add("podium-silver-chip");
  } else if (normalizedTier === "bronce") {
    container.classList.add("podium-bronze-chip");
  } else if (normalizedTier === "acero") {
    container.classList.add("podium-steel-chip");
  } else if (normalizedTier === "jade") {
    container.classList.add("podium-emerald-chip");
  }
}

function renderHistoryMetrics(data) {
  const getProgressBg = (pct) => {
    if (pct === 100) return "linear-gradient(90deg, #10b981, #059669)";
    if (pct >= 90) return "linear-gradient(90deg, #22c55e, #84cc16)";
    if (pct >= 70) return "linear-gradient(90deg, #eab308, #ca8a04)";
    return "linear-gradient(90deg, #ef4444, #dc2626)";
  };

  const rows = data?.rows || [];
  const role = data?.role || "UNIDAD";
  const tbody = $("historyTbody");

  const selectedMuni = $("histMunicipioFilter")?.value || "TODOS";
  let activeRows = [...rows];
  const userRole = String(USER?.rol || "").toUpperCase();
  if (userRole === "UNIDAD") {
    activeRows = activeRows.filter(r => r.clues === USER.clues);
  } else if (userRole === "MUNICIPAL") {
    activeRows = activeRows.filter(r => canSeeMunicipio_(USER, r.municipio));
  } else if (userRole === "CARAVANAS") {
    activeRows = activeRows.filter(r => isCaravanaUnit_({ unidad: r.unidad }));
    if (selectedMuni && selectedMuni !== "TODOS") {
      activeRows = activeRows.filter(r => normalizeText(r.municipio) === normalizeText(selectedMuni));
    }
  } else {
    // ADMIN / JURISDICCIONAL: Permite filtro manual por municipio en la vista
    if (selectedMuni && selectedMuni !== "TODOS") {
      activeRows = activeRows.filter(r => normalizeText(r.municipio) === normalizeText(selectedMuni));
    }
  }

  // ORDENAR: Mayor score a menor score. A igualdad de score, por última captura de forma descendente, y luego por nombre
  activeRows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const dateA = a.ultima_captura || "—";
    const dateB = b.ultima_captura || "—";
    if (dateA !== dateB) {
      if (dateA === "—") return 1;
      if (dateB === "—") return -1;
      return dateB.localeCompare(dateA);
    }
    return a.unidad.localeCompare(b.unidad);
  });

  const targetYmd = $("histMesEvaluacion")?.value || todayYmdLocal().substring(0, 7);
  const yearParts = targetYmd.split("-");
  const year = yearParts[0];

  // Fetch and render yearly medals on bCumplimientoMedals
  if (USER && USER.rol === "UNIDAD" && USER.clues) {
    getYearlyMedals(year, USER.clues).then(medals => {
      renderUnitMedals(medals);
    });
  } else if (USER && (USER.rol === "MUNICIPAL" || selectedMuni !== "TODOS")) {
    const targetMuni = USER.rol === "MUNICIPAL" ? (USER.municipio || "").split(",")[0].trim() : selectedMuni;
    getYearlyMuniMedals(year, targetMuni).then(medals => {
      renderUnitMedals(medals);
    });
  } else {
    const medalsContainer = $("bCumplimientoMedals");
    if (medalsContainer) medalsContainer.innerHTML = "";
  }

  // Update dynamic KPIs based on activeRows
  if ($("histTotalUnidades")) $("histTotalUnidades").textContent = activeRows.length;

  const diamantes = activeRows.filter(r => r.tier === "diamante").length;
  const riesgos = activeRows.filter(r => r.tier === "riesgo").length;

  if ($("histTotalDiamante")) $("histTotalDiamante").textContent = diamantes;
  if ($("histTotalRiesgo")) $("histTotalRiesgo").textContent = riesgos;

  if (!activeRows.length) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-surface-onVariant/60">Sin datos para ese periodo</td></tr>`;
    if ($("adminPodiumArea")) $("adminPodiumArea").style.display = "none";
    return;
  }

  const separarMuni = $("histSepararMunicipio")?.checked;

  // Render Podium Area
  if ((role === "ADMIN" || role === "JURISDICCIONAL") && $("adminPodiumArea")) {
    if (separarMuni) {
      // 3-step Municipality Average Podium using all rows (global comparison)
      const muniScores = {};
      rows.forEach(r => {
        const muni = r.municipio || "OTROS";
        if (!muniScores[muni]) muniScores[muni] = { scoreSum: 0, count: 0 };
        muniScores[muni].scoreSum += r.score;
        muniScores[muni].count++;
      });
      const muniArr = Object.keys(muniScores).map(m => ({
        municipio: m,
        avg: Math.round(muniScores[m].scoreSum / muniScores[m].count)
      })).sort((a, b) => b.avg - a.avg);

      if (muniArr.length >= 3) {
        $("adminPodiumArea").style.display = "block";
        $("adminPodiumArea").innerHTML = `
          <div class="podium-container">
            <div class="podium-step p-2">
              <div class="podium-medal"><span class="material-symbols-rounded" style="color: #94a3b8">military_tech</span></div>
              <div class="podium-score">${muniArr[1].avg}%</div>
              <div class="podium-name">${muniArr[1].municipio}</div>
            </div>
            <div class="podium-step p-1">
              <div class="podium-medal"><span class="material-symbols-rounded" style="color: #f59e0b">workspace_premium</span></div>
              <div class="podium-score">${muniArr[0].avg}%</div>
              <div class="podium-name">${muniArr[0].municipio}</div>
            </div>
            <div class="podium-step p-3">
              <div class="podium-medal"><span class="material-symbols-rounded" style="color: #d97706">military_tech</span></div>
              <div class="podium-score">${muniArr[2].avg}%</div>
              <div class="podium-name">${muniArr[2].municipio}</div>
            </div>
          </div>
        `;
      } else {
        $("adminPodiumArea").style.display = "none";
      }
    } else {
      // 5-step Unit Podium using filtered activeRows
      const top5 = [...activeRows].slice(0, 5);
      const order = [4, 2, 0, 1, 3]; // 5th, 3rd, 1st, 2nd, 4th
      let podiumHtml = "";

      order.forEach(i => {
        if (top5[i]) {
          const item = top5[i];
          const place = i + 1;
          let medalColor = "";
          let medalIcon = "military_tech";
          if (place === 1) { medalColor = "#ffd700"; medalIcon = "workspace_premium"; }
          else if (place === 2) { medalColor = "#cbd5e1"; }
          else if (place === 3) { medalColor = "#fed7aa"; }
          else if (place === 4) { medalColor = "#99f6e4"; medalIcon = "workspace_premium"; }
          else if (place === 5) { medalColor = "#bbf7d0"; }

          podiumHtml += `
            <div class="podium-step p-${place}">
              <div class="podium-medal"><span class="material-symbols-rounded" style="color: ${medalColor}">${medalIcon}</span></div>
              <div class="podium-score">${item.score}%</div>
              <div class="podium-name" title="${escapeHtml(item.unidad)}">${escapeHtml(item.unidad)}</div>
              <div class="text-[9px] text-slate-400 mt-1 uppercase truncate max-w-[120px]" title="${escapeHtml(item.municipio)}">${escapeHtml(item.municipio)}</div>
            </div>
          `;
        }
      });

      if (top5.length > 0) {
        $("adminPodiumArea").style.display = "block";
        $("adminPodiumArea").innerHTML = `<div class="podium-container">${podiumHtml}</div>`;
      } else {
        $("adminPodiumArea").style.display = "none";
      }
    }
  } else if ($("adminPodiumArea")) {
    $("adminPodiumArea").style.display = "none";
  }

  const tierIcons = {
    diamante: '<span class="material-symbols-rounded medal-icon tier-diamante" title="Diamante">diamond</span>',
    oro: '<span class="material-symbols-rounded medal-icon tier-oro" title="Oro">workspace_premium</span>',
    plata: '<span class="material-symbols-rounded medal-icon tier-plata" title="Plata">military_tech</span>',
    bronce: '<span class="material-symbols-rounded medal-icon tier-bronze" style="color: #b45309 !important;" title="Bronce">military_tech</span>',
    acero: '<span class="material-symbols-rounded medal-icon tier-steel" style="color: #0d9488 !important;" title="Acero">workspace_premium</span>',
    jade: '<span class="material-symbols-rounded medal-icon tier-emerald" style="color: #059669 !important;" title="Jade">military_tech</span>',
    riesgo: '<span class="material-symbols-rounded medal-icon tier-riesgo" title="En Riesgo">warning</span>'
  };

  if (separarMuni) {
    // Group units by municipality and render groups
    const groups = {};
    activeRows.forEach(r => {
      const muni = r.municipio || "OTROS";
      if (!groups[muni]) groups[muni] = [];
      groups[muni].push(r);
    });

    let html = "";
    Object.keys(groups).sort().forEach(muniName => {
      const muniRows = groups[muniName];
      muniRows.sort((a, b) => b.score - a.score || a.unidad.localeCompare(b.unidad));

      const avgScore = Math.round(muniRows.reduce((sum, row) => sum + row.score, 0) / muniRows.length);

      html += `
        <tr class="bg-slate-100/50 font-bold border-b border-slate-200">
          <td colspan="6" class="p-3 text-primary font-black uppercase text-[12px] tracking-wider">
            Municipio: ${escapeHtml(muniName)} <span class="ml-2 text-slate-500 font-bold">(Promedio: ${avgScore}%)</span>
          </td>
        </tr>
      `;

      muniRows.forEach((r, idx) => {
        let rankBadge = `<span class="rank-badge">${idx + 1}</span>`;
        if (idx === 0) rankBadge = `<span class="rank-badge rank-1">1</span>`;
        else if (idx === 1) rankBadge = `<span class="rank-badge rank-2">2</span>`;
        else if (idx === 2) rankBadge = `<span class="rank-badge rank-3">3</span>`;
        else if (idx === 3) rankBadge = `<span class="rank-badge rank-4">4</span>`;
        else if (idx === 4) rankBadge = `<span class="rank-badge rank-5">5</span>`;

        let bPct = r.eBio > 0 ? (r.bio_semanas_ok / r.eBio) * 100 : 100;
        let cPct = r.eCons > 0 ? (r.cons_semanas_ok / r.eCons) * 100 : 100;
        const hasPedido = !!(r.pedido_mensual || r.has_pedido || r.pedido || r.pedido_capturado || r.is_pedido_done);
        let pedidoIcon = !r.isPedidoRequired ? `<span class="material-symbols-rounded text-slate-400 text-[14px]">horizontal_rule</span>` :
          (hasPedido ? `<span class="material-symbols-rounded text-[14px]" style="color: #22c55e !important;" title="Pedido Registrado">check_circle</span>` : `<span class="material-symbols-rounded text-[14px]" style="color: #ef4444 !important;" title="Falta Pedido">cancel</span>`);

        html += `
          <tr>
            <td class="text-center">${rankBadge}</td>
            <td class="text-center">${tierIcons[r.tier]}</td>
            <td class="font-bold text-slate-700">${escapeHtml(r.municipio)}</td>
            <td>
              <div class="font-bold text-primary">${escapeHtml(r.unidad)}</div>
              <div class="text-[10px] text-slate-400">CLUES: ${escapeHtml(r.clues)}</div>
            </td>
            <td class="text-center">
              <span class="font-black text-[16px] text-slate-700">${r.score}%</span>
            </td>
            <td>
              <div class="flex items-center gap-3 text-[10px] font-bold text-slate-500 w-full max-w-[250px]">
                  <div class="flex-1">
                      BIO (${r.bio_semanas_ok}/${r.eBio})
                      <div class="lb-progress-wrap"><div class="lb-progress-fill" style="width: ${bPct}%; background: ${getProgressBg(bPct)} !important;"></div></div>
                  </div>
                  <div class="flex-1">
                      CONS (${r.cons_semanas_ok}/${r.eCons})
                      <div class="lb-progress-wrap"><div class="lb-progress-fill" style="width: ${cPct}%; background: ${getProgressBg(cPct)} !important;"></div></div>
                  </div>
                  <div class="flex flex-col items-center justify-center w-10 ml-2" title="Pedido Mensual">
                      <span class="text-[9px]">PED</span>
                      ${pedidoIcon}
                  </div>
              </div>
            </td>
          </tr>
        `;
      });
    });
    if (tbody) tbody.innerHTML = html;
  } else {
    // Render standard rows sorted by score descending
    let html = "";
    activeRows.forEach((r, idx) => {
      let rankBadge = `<span class="rank-badge">${idx + 1}</span>`;
      if (idx === 0) rankBadge = `<span class="rank-badge rank-1">1</span>`;
      else if (idx === 1) rankBadge = `<span class="rank-badge rank-2">2</span>`;
      else if (idx === 2) rankBadge = `<span class="rank-badge rank-3">3</span>`;
      else if (idx === 3) rankBadge = `<span class="rank-badge rank-4">4</span>`;
      else if (idx === 4) rankBadge = `<span class="rank-badge rank-5">5</span>`;

      let bPct = r.eBio > 0 ? (r.bio_semanas_ok / r.eBio) * 100 : 100;
      let cPct = r.eCons > 0 ? (r.cons_semanas_ok / r.eCons) * 100 : 100;
      const hasPedido = !!(r.pedido_mensual || r.has_pedido || r.pedido || r.pedido_capturado || r.is_pedido_done);
      let pedidoIcon = !r.isPedidoRequired ? `<span class="material-symbols-rounded text-slate-400 text-[14px]">horizontal_rule</span>` :
        (hasPedido ? `<span class="material-symbols-rounded text-[14px]" style="color: #22c55e !important;" title="Pedido Registrado">check_circle</span>` : `<span class="material-symbols-rounded text-[14px]" style="color: #ef4444 !important;" title="Falta Pedido">cancel</span>`);

      html += `
        <tr>
          <td class="text-center">${rankBadge}</td>
          <td class="text-center">${tierIcons[r.tier]}</td>
          <td class="font-bold text-slate-700">${escapeHtml(r.municipio)}</td>
          <td>
            <div class="font-bold text-primary">${escapeHtml(r.unidad)}</div>
            <div class="text-[10px] text-slate-400">CLUES: ${escapeHtml(r.clues)}</div>
          </td>
          <td class="text-center">
            <span class="font-black text-[16px] text-slate-700">${r.score}%</span>
          </td>
          <td>
            <div class="flex items-center gap-3 text-[10px] font-bold text-slate-500 w-full max-w-[250px]">
                <div class="flex-1">
                    BIO (${r.bio_semanas_ok}/${r.eBio})
                    <div class="lb-progress-wrap"><div class="lb-progress-fill" style="width: ${bPct}%; background: ${getProgressBg(bPct)} !important;"></div></div>
                </div>
                <div class="flex-1">
                    CONS (${r.cons_semanas_ok}/${r.eCons})
                    <div class="lb-progress-wrap"><div class="lb-progress-fill" style="width: ${cPct}%; background: ${getProgressBg(cPct)} !important;"></div></div>
                </div>
                <div class="flex flex-col items-center justify-center w-10 ml-2" title="Pedido Mensual">
                    <span class="text-[9px]">PED</span>
                    ${pedidoIcon}
                </div>
            </div>
          </td>
        </tr>
      `;
    });
    if (tbody) tbody.innerHTML = html;
  }

  // Trigger confetti if there is a top score of 90% or more
  function triggerConfettiFallback() {
    if (typeof confetti === "function") {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#ffd700', '#cbd5e1', '#cd7f32', '#06b6d4', '#10b981']
      });
      return;
    }

    console.log("[Confetti] Running HTML5 fallback animation...");
    const canvas = document.createElement("canvas");
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "999999";
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const colors = ['#ffd700', '#cbd5e1', '#cd7f32', '#06b6d4', '#10b981', '#ff4b5c', '#3f72af'];
    const particles = [];

    for (let i = 0; i < 120; i++) {
      particles.push({
        x: width / 2,
        y: height * 0.7,
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.85) * 22,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 8
      });
    }

    let startTime = Date.now();
    function animate() {
      ctx.clearRect(0, 0, width, height);
      let alive = false;

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.5;
        p.vx *= 0.98;
        p.rotation += p.rotationSpeed;

        if (p.y < height && p.x > 0 && p.x < width) {
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation * Math.PI / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        }
      });

      if (alive && Date.now() - startTime < 4000) {
        requestAnimationFrame(animate);
      } else {
        canvas.remove();
      }
    }
    animate();
  }

  if (activeRows.length > 0) {
    setTimeout(() => {
      triggerConfettiFallback();
    }, 300);
  }
}

async function watchPinolRealtime() {
  if (!USER || (USER.rol !== "ADMIN" && USER.rol !== "MUNICIPAL")) return;
  if (LIVE_STATE.pinolWatching) return;

  LIVE_STATE.pinolWatching = true;

  try {
    const items = await listPinol(false);
    const pendientes = (items || []).filter(x =>
      String(x.estatus || "PENDIENTE").toUpperCase() === "PENDIENTE"
    ).length;

    if (LIVE_STATE.pinolPendientes === null) {
      LIVE_STATE.pinolPendientes = pendientes;
      updatePinolTabBadge(items);
      return;
    }

    if (pendientes !== LIVE_STATE.pinolPendientes) {
      const prev = Number(LIVE_STATE.pinolPendientes || 0);
      LIVE_STATE.pinolPendientes = pendientes;

      updatePinolTabBadge(items);

      pulseTabBadge("tabOPS_PINOL", {
        hot: pendientes >= 5
      });

      pulseTabBadge("tabCAP", {
        hot: pendientes >= 5
      });

      pulseValueChange("pinolBadgeMain", pendientes > prev ? "rise" : "drop");
      pulseValueChange("pinolBadgeTab", pendientes > prev ? "rise" : "drop");

      if ($("panelPINOLADMIN")?.style.display !== "none") {
        flashElement("panelPINOLADMIN");
      }

      if (pendientes > prev) {
        showWarnToast(`Hay ${pendientes} solicitud(es) pendientes de pinol`);
      } else {
        showToast("Cambió el estado de solicitudes de pinol");
      }
    }
  } catch (e) {
    console.error("watchPinolRealtime error:", e);
  } finally {
    LIVE_STATE.pinolWatching = false;
  }
}

async function watchCaptureSummaryRealtime() {
  if (!USER || (USER.rol !== "ADMIN" && USER.rol !== "MUNICIPAL" && USER.rol !== "JURISDICCIONAL")) return;

  if (!$("panelCaptureSummary")) return;
  if (LIVE_STATE.summaryWatching) return;

  LIVE_STATE.summaryWatching = true;

  try {
    const fecha = $("summaryFecha")?.value || todayYmdLocal();
    const tipo = $("summaryTipo")?.value || "SR";
    const data = await getCaptureOverview(fecha, tipo);
    if (!data) return;

    const capturadas = Number(data.total_capturadas || 0);
    const faltantes = Number(data.total_faltantes || 0);
    const keyNow = `${tipo}_${fecha}`;

    if (LIVE_STATE.summaryKey !== keyNow) {
      LIVE_STATE.summaryKey = keyNow;
      LIVE_STATE.summaryCapturadas = capturadas;
      LIVE_STATE.summaryFaltantes = faltantes;
      return;
    }

    const prevCapturadas = Number(LIVE_STATE.summaryCapturadas ?? capturadas);
    const prevFaltantes = Number(LIVE_STATE.summaryFaltantes ?? faltantes);

    if (
      LIVE_STATE.summaryCapturadas !== null &&
      (capturadas !== LIVE_STATE.summaryCapturadas || faltantes !== LIVE_STATE.summaryFaltantes)
    ) {
      LIVE_STATE.summaryCapturadas = capturadas;
      LIVE_STATE.summaryFaltantes = faltantes;

      renderCaptureSummary(data);
      flashElement("panelCaptureSummary");

      if (capturadas !== prevCapturadas) {
        pulseBadge("capturadasCount");
        pulseValueChange("capturadasCount", capturadas > prevCapturadas ? "rise" : "drop");
      }

      if (faltantes !== prevFaltantes) {
        pulseBadge("faltantesCount");
        pulseValueChange("faltantesCount", faltantes < prevFaltantes ? "rise" : "drop");
      }

      if (capturadas > prevCapturadas) {
        showToast(
          `Nueva captura detectada en ${tipo === "CONS" ? "Consumibles" : "Existencia de biológicos"}`,
          true,
          "good"
        );
      }
    }
  } catch (e) {
    console.error("watchCaptureSummaryRealtime error:", e);
  } finally {
    LIVE_STATE.summaryWatching = false;
  }
}

let LAST_TODAY_SNAPSHOT = "";

async function watchUnidadTodayRealtime() {
  if (!USER || USER.rol !== "UNIDAD") return;
  if (LIVE_STATE.unidadWatching) return;

  LIVE_STATE.unidadWatching = true;

  try {
    const today = await getTodayReports(todayYmdLocal());
    const snapshot = JSON.stringify(today || null);

    if (snapshot === LAST_TODAY_SNAPSHOT) {
      return;
    }

    LAST_TODAY_SNAPSHOT = snapshot;

    const normalized = normalizeTodayReports(today);

    const existenciaNow = !!normalized.sr;
    const consNow = !!normalized.cons;

    if (LIVE_STATE.todayExistenciaCaptured === null) {
      LIVE_STATE.todayExistenciaCaptured = existenciaNow;
      LIVE_STATE.todayConsCaptured = consNow;
      return;
    }

    const existenciaChanged = existenciaNow !== LIVE_STATE.todayExistenciaCaptured;
    const consChanged = consNow !== LIVE_STATE.todayConsCaptured;

    if (!existenciaChanged && !consChanged) {
      return;
    }

    LIVE_STATE.todayExistenciaCaptured = existenciaNow;
    LIVE_STATE.todayConsCaptured = consNow;

    if (existenciaChanged || consChanged) {
      hydrateTodayForms(today);
    }

    if (existenciaChanged) {
      flashElement("formSR");
      pulseValueChange("tabSR", "rise");

      if (existenciaNow) {
        showToast("Tu captura de existencia de biológicos ya quedó reflejada en tiempo real");
        pushLiveEvent("Existencia de biológicos", "El estado de la captura de hoy cambió automáticamente.", "good", "formSR");
      }
    }

    if (consChanged) {
      flashElement("formCONS");
      pulseValueChange("tabCONS", "rise");

      if (consNow) {
        showToast("Tu reporte de consumibles ya quedó reflejado en tiempo real");
        pushLiveEvent("Consumibles", "El estado del reporte de hoy cambió automáticamente.", "good", "formCONS");
      }
    }
  } catch (e) {
    console.error("watchUnidadTodayRealtime error:", e);
  } finally {
    LIVE_STATE.unidadWatching = false;
  }
}

async function watchHistoryRealtimeLight() {
  if (!USER || (USER.rol !== "ADMIN" && USER.rol !== "MUNICIPAL" && USER.rol !== "JURISDICCIONAL")) return;

  if (LIVE_STATE.historyWatching) return;

  LIVE_STATE.historyWatching = true;

  try {
    const mes = $("histMesEvaluacion")?.value || todayYmdLocal().substring(0, 7);
    const data = await getHistoryMetrics(mes, null);
    if (!data) return;

    const rows = Array.isArray(data.rows) ? data.rows.length : 0;

    if (LIVE_STATE.lastHistoryRows === null) {
      LIVE_STATE.lastHistoryRows = rows;
      return;
    }

    if (rows !== LIVE_STATE.lastHistoryRows) {
      LIVE_STATE.lastHistoryRows = rows;

      if ($("panelHISTORY")?.style.display !== "none") {
        renderHistoryMetrics(data);
        flashElement("panelHISTORY");
      }

      pulseTabBadge("tabOPS_HISTORY", {
        hot: rows > 0
      });

      pulseTabBadge("tabCAP", {
        hot: false
      });

      pushLiveEvent(
        "Métricas históricas",
        "Se actualizó la información del panel histórico.",
        "good",
        "panelHISTORY"
      );
    }
  } catch (e) {
    console.error("watchHistoryRealtimeLight error:", e);
  } finally {
    LIVE_STATE.historyWatching = false;
  }
}

function startRealtimeUX() {
  startPublicClockTimer();

  if (LIVE_TIMERS_STARTED) return;
  LIVE_TIMERS_STARTED = true;

  // Optimización de Cuotas: Se relajan los ciclos (Throttling) para prevenir el límite estricto de 20,000 Trigger Quotas diarios de GAS.
  LIVE_TIMERS.push(setInterval(() => {
    if (!canRunRealtime()) return;
    watchPinolRealtime();
  }, 120000)); // 2 mins

  LIVE_TIMERS.push(setInterval(() => {
    if (!canRunRealtime()) return;
    watchCaptureSummaryRealtime();
  }, 180000)); // 3 mins

  LIVE_TIMERS.push(setInterval(() => {
    if (!canRunRealtime()) return;
    watchUnidadTodayRealtime();
  }, 30000));

  LIVE_TIMERS.push(setInterval(() => {
    if (!canRunRealtime()) return;
    watchHistoryRealtimeLight();
  }, 45000));

  LIVE_TIMERS.push(setInterval(() => {
    if (!canRunRealtime()) return;
    loadNotifications({ silent: true }).catch(err => {
      console.warn("realtime loadNotifications error:", err);
    });
  }, 45000));
}

/**
 * 🌤️ Weather Loader: Obtiene el clima de la API Open-Meteo.
 * Se ejecuta al cargar y se re-lanza cada 15 min.
 */
async function initWeather() {
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=20.5881&longitude=-100.3899&current_weather=true&timezone=America/Mexico_City`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data && data.current_weather) {
      const temp = Math.round(data.current_weather.temperature);
      const code = data.current_weather.weathercode;
      const isDay = data.current_weather.is_day === 1;

      const details = getWeatherDetails(code, isDay);

      CURRENT_WEATHER = {
        temp,
        emoji: details.emoji,
        text: details.text,
        bg: details.bg,
        theme: details.theme,
        code
      };

      // Update legacy headers if they exist
      const hdr1 = $("hdrClima");
      if (hdr1) hdr1.textContent = `Qro ${temp}°C`;

      const hdr2 = $("hdrClima2");
      if (hdr2) hdr2.textContent = `${temp}°C`;

      // Update greeting in real time
      if (USER) {
        updateDynamicGreeting();
      }
    }
  } catch (e) {
    console.warn("initWeather failed:", e);
    CURRENT_WEATHER = { temp: 24, emoji: "🌤️", text: "Despejado", bg: "https://images.unsplash.com/photo-1601297183305-6df142704ea2?auto=format&fit=crop&q=80&w=600", theme: "light-bg", code: 1 };
    if (USER) updateDynamicGreeting();
  }
}

function getWeatherDetails(code, isDay) {
  if (code === null) return { emoji: "🌡️", text: "Desconocido", bg: "", theme: "dark-bg" };

  const bgs = {
    clearDay: "https://images.unsplash.com/photo-1601297183305-6df142704ea2?auto=format&fit=crop&q=80&w=600",
    clearNight: "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?auto=format&fit=crop&q=80&w=600",
    cloudyDay: "https://images.unsplash.com/photo-1534088568595-a066f410bcda?auto=format&fit=crop&q=80&w=600",
    cloudyNight: "https://images.unsplash.com/photo-1534088568595-a066f410bcda?auto=format&fit=crop&q=80&w=600", // Placeholder for night clouds
    rain: "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&q=80&w=600",
    snow: "https://images.unsplash.com/photo-1478265409131-1f65c88f965c?auto=format&fit=crop&q=80&w=600",
    thunder: "https://images.unsplash.com/photo-1605727216801-e27ce1d0ce49?auto=format&fit=crop&q=80&w=600",
    fog: "https://images.unsplash.com/photo-1487621167305-5d248087c724?auto=format&fit=crop&q=80&w=600"
  };

  let theme = "dark-bg";
  if (isDay && [0, 1, 2, 3].includes(code)) {
    theme = "light-bg";
  }

  if (code === 0) return { emoji: isDay ? "☀️" : "🌙", text: isDay ? "Despejado" : "Noche clara", bg: isDay ? bgs.clearDay : bgs.clearNight, theme };
  if ([1, 2].includes(code)) return { emoji: isDay ? "🌤️" : "☁️", text: isDay ? "Parcialmente nublado" : "Nubes dispersas", bg: isDay ? bgs.cloudyDay : bgs.cloudyNight, theme };
  if (code === 3) return { emoji: "☁️", text: "Nublado", bg: isDay ? bgs.cloudyDay : bgs.cloudyNight, theme };
  if ([45, 48].includes(code)) return { emoji: "🌫️", text: "Niebla", bg: bgs.fog, theme };
  if ([51, 53, 55].includes(code)) return { emoji: "🌦️", text: "Llovizna", bg: bgs.rain, theme };
  if ([61, 63, 65].includes(code)) return { emoji: "🌧️", text: "Lluvia", bg: bgs.rain, theme };
  if ([71, 73, 75].includes(code)) return { emoji: "❄️", text: "Nieve", bg: bgs.snow, theme };
  if ([80, 81, 82].includes(code)) return { emoji: "🌦️", text: "Chubascos", bg: bgs.rain, theme };
  if ([95, 96, 99].includes(code)) return { emoji: "⛈️", text: "Tormenta", bg: bgs.thunder, theme };

  return { emoji: "🌤️", text: "Clima", bg: bgs.clearDay, theme: "light-bg" };
}

// Esperar a que el DOM esté listo antes de arrancar
document.addEventListener('DOMContentLoaded', () => {
  initWeather();
  // Añadirlo a LIVE_TIMERS solo si está definido (evitar ReferenceError preventivo)
  if (typeof LIVE_TIMERS !== 'undefined') {
    LIVE_TIMERS.push(setInterval(initWeather, 900000));
  }
});

// Fallback por si DOMContentLoaded ya pasó
if (document.readyState === "complete" || document.readyState === "interactive") {
  initWeather();
}



/** ===== DRIVE UPLOAD LOGIC ===== **/
let ALL_UNITS_CATALOG = null;

async function openUploadFilesModal() {
  const modal = $("uploadFilesOverlay");
  if (!modal) return;

  modal.classList.add("show");
  resetUploadForm();

  const role = String(USER?.rol || "UNIDAD").toUpperCase();
  const categorySelect = $("uploadCategory");
  const muniWrap = $("uploadMunicipalMuniWrap");
  const unitWrap = $("uploadMunicipalUnitWrap");
  const cluesView = $("uploadCluesView");
  const modalTitle = modal.querySelector(".modalTitle");
  const btnDoUpload = $("btnDoUpload");

  // Clear previous dynamic state
  muniWrap.style.display = "none";
  unitWrap.style.display = "none";
  cluesView.style.display = "none";

  if (role === "MUNICIPAL") {
    // REGLA: SÓLO MUNICIPAL SUBE SUPERVISIONES
    categorySelect.innerHTML = '<option value="Supervisión" selected>Supervisión</option>';
    categorySelect.disabled = true;
    if (modalTitle) modalTitle.textContent = "Subir supervisión";
    if (btnDoUpload) btnDoUpload.innerHTML = '<span class="material-symbols-rounded">cloud_upload</span> Subir supervisión';
    await loadMunicipalUploadContext();
  } else if (role === "UNIDAD") {
    // REGLA: SÓLO UNIDAD SUBE EVIDENCIAS
    categorySelect.innerHTML = `
        <option value="Evidencia de capacitaciones" selected>Evidencia de capacitaciones</option>
        <option value="Evidencias de campaña">Evidencias de campaña</option>
        <option value="Otros reportes">Otros reportes</option>
      `;
    categorySelect.disabled = false;
    if (modalTitle) modalTitle.textContent = "Subir evidencias";
    if (btnDoUpload) btnDoUpload.innerHTML = '<span class="material-symbols-rounded">cloud_upload</span> Subir evidencia';
  } else {
    // ADMIN / JURISDICCIONAL: NO SUBEN NADA
    modal.classList.remove("show");
    showToast("Acceso denegado: Tu perfil no tiene permisos para subir archivos.", false);
    return;
  }
}

async function loadMunicipalUploadContext() {
  try {
    if (!ALL_UNITS_CATALOG) {
      showOverlay("Cargando catálogo…", "Catálogo");
      const res = await apiCall({ action: "unitCatalog" });
      hideOverlay();
      if (res && res.ok) {
        ALL_UNITS_CATALOG = res.data || [];
      }
    }

    const munis = USER.municipiosAllowed || [];
    const muniSelect = $("uploadMuniSelect");
    const muniWrap = $("uploadMunicipalMuniWrap");

    if (munis.length > 1 || (munis.length === 1 && munis[0] === "*")) {
      // Multi-municipio or Admin-like municipal
      muniWrap.style.display = "block";
      const uniqueMunis = [...new Set(ALL_UNITS_CATALOG.map(u => u.municipio))].filter(m => canSeeMunicipio_(USER, m));

      muniSelect.innerHTML = '<option value="" disabled selected>Selecciona municipio...</option>' +
        uniqueMunis.map(m => `<option value="${m}">${m}</option>`).join("");
    } else {
      // Single municipio: Skip selection, jump to units
      muniWrap.style.display = "none";
      muniSelect.value = munis[0] || "";
      updateUploadUnitList();
    }
  } catch (e) {
    showToast("Error al cargar contexto municipal", false);
  }
}

function updateUploadUnitList() {
  const muni = $("uploadMuniSelect").value || (USER.municipiosAllowed?.[0] !== "*" ? USER.municipiosAllowed?.[0] : "");
  if (!muni) return;

  const units = (ALL_UNITS_CATALOG || []).filter(u => u.municipio === muni);
  const unitSelect = $("uploadUnitSelect");
  const unitWrap = $("uploadMunicipalUnitWrap");

  unitWrap.style.display = "block";
  unitSelect.innerHTML = '<option value="" disabled selected>Selecciona unidad...</option>' +
    units.map(u => `<option value="${u.clues}" data-name="${u.unidad}">${u.unidad}</option>`).join("");
}

function updateUploadCluesView() {
  const unitSelect = $("uploadUnitSelect");
  const cluesValue = $("uploadCluesValue");
  const cluesView = $("uploadCluesView");

  const selected = unitSelect.value;
  if (selected) {
    cluesView.style.display = "block";
    cluesValue.textContent = selected;
  } else {
    cluesView.style.display = "none";
  }
}

$("uploadMuniSelect")?.addEventListener("change", updateUploadUnitList);
$("uploadUnitSelect")?.addEventListener("change", updateUploadCluesView);

function closeUploadFilesModal() {
  const modal = $("uploadFilesOverlay");
  if (!modal) return;
  modal.classList.remove("show");
  resetUploadForm();
}


function resetUploadForm() {
  const fileInput = $("uploadFileInput");
  if (fileInput) fileInput.value = "";
  const fileNameLabel = $("fileNameLabel");
  if (fileNameLabel) fileNameLabel.textContent = "Ningún archivo seleccionado";
  const btnBrowse = $("btnBrowseFile");
  if (btnBrowse) btnBrowse.classList.remove("hasFile");
  const btnDoUpload = $("btnDoUpload");
  if (btnDoUpload) btnDoUpload.disabled = true;

  // Reset selections
  $("uploadUnitSelect").innerHTML = "";
  $("uploadMuniSelect").value = "";
  $("uploadCluesValue").textContent = "—";
}

$("btnOpenUpload")?.addEventListener("click", openUploadFilesModal);
$("btnCloseUpload")?.addEventListener("click", closeUploadFilesModal);

$("btnBrowseFile")?.addEventListener("click", () => {
  $("uploadFileInput")?.click();
});

$("uploadFileInput")?.addEventListener("change", (e) => {
  const file = e.target.files[0];
  const fileNameLabel = $("fileNameLabel");
  const btnBrowse = $("btnBrowseFile");
  const btnDoUpload = $("btnDoUpload");

  if (file) {
    if (file.size > 15 * 1024 * 1024) {
      showToast("El archivo excede el límite de 15MB. Por favor selecciona un archivo más pequeño.", false, "bad");
      resetUploadForm();
      return;
    }
    if (fileNameLabel) fileNameLabel.textContent = file.name;
    if (btnBrowse) btnBrowse.classList.add("hasFile");
    if (btnDoUpload) btnDoUpload.disabled = false;
  } else {
    resetUploadForm();
  }
});

$("btnDoUpload")?.addEventListener("click", handleFileUploadFlow);

async function handleFileUploadFlow() {
  const fileInput = $("uploadFileInput");
  const file = fileInput?.files?.[0];
  const category = $("uploadCategory")?.value || "Otros reportes";

  if (!file) {
    showToast("Por favor selecciona un archivo primero", false, "bad");
    return;
  }

  if (file.size > 15 * 1024 * 1024) {
    showToast("El archivo excede el límite de 15MB. Por favor selecciona un archivo más pequeño.", false, "bad");
    return;
  }

  let targetClues = USER.clues;
  let targetUnidad = USER.unidad;
  let targetMunicipio = USER.municipio; // Valor por defecto del usuario

  if (USER.rol === "MUNICIPAL") {
    const unitSelect = $("uploadUnitSelect");
    targetClues = unitSelect.value;
    if (!targetClues) {
      showToast("Debes seleccionar una unidad a supervisar", false, "bad");
      return;
    }
    const option = unitSelect.options[unitSelect.selectedIndex];
    targetUnidad = option.getAttribute("data-name") || "";
    // REGLA: Detectar municipio de la unidad para crear la carpeta correcta
    targetMunicipio = option.getAttribute("data-muni") || "";
  }

  // 1. Close current upload modal
  closeUploadFilesModal();

  // 2. Setup progress overlay UI elements
  const progressOverlay = $("uploadProgressOverlay");
  const progressBar = $("uploadProgressBar");
  const progressPercent = $("uploadProgressPercent");
  const progressBytes = $("uploadProgressBytes");

  if (progressOverlay) progressOverlay.classList.add("show");
  if (progressBar) progressBar.style.width = "0%";
  if (progressPercent) progressPercent.textContent = "0%";
  if (progressBytes) progressBytes.textContent = `0 MB / ${(file.size / (1024 * 1024)).toFixed(2)} MB`;

  try {
    const res = await apiCall({
      action: "uploadFile",
      file: file,
      category: category,
      targetClues: targetClues,
      targetUnidad: targetUnidad,
      targetMunicipio: targetMunicipio
    }, {}, {
      onUploadProgress: (progress) => {
        const loaded = progress.loaded || 0;
        const total = progress.total || file.size;
        const pct = Math.min(100, Math.round((loaded / total) * 100));

        if (progressBar) progressBar.style.width = `${pct}%`;
        if (progressPercent) progressPercent.textContent = `${pct}%`;
        if (progressBytes) {
          progressBytes.textContent = `${(loaded / (1024 * 1024)).toFixed(2)} MB / ${(total / (1024 * 1024)).toFixed(2)} MB`;
        }
      }
    });

    if (res && res.ok) {
      showToast("¡Carga exitosa!", true, "good");
    } else {
      showToast("Error al subir: " + (res?.error || "Desconocido"), false, "bad");
    }
  } catch (err) {
    console.error("Upload Error:", err);
    let errMsg = "Error de conexión al subir el archivo";
    if (err.message && (err.message.includes("Payload Too Large") || err.message.includes("413") || err.message.includes("size") || err.message.includes("limit"))) {
      errMsg = "El archivo excede el límite permitido de 15MB.";
    } else if (err.message) {
      errMsg = err.message;
    }
    showToast(errMsg, false, "bad");
  } finally {
    if (progressOverlay) progressOverlay.classList.remove("show");
  }
}

// ✅ VISTA EN VIVO LOGIC
let CHART_SEM = null;
let CHART_CAD = null;

function formatAppDate(dateStr) {
  if (!dateStr || dateStr === "—") return "—";
  try {
    // Intentar parsear fecha ISO o similar
    const normalizedStr = dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00`;
    const d = new Date(normalizedStr);
    if (isNaN(d.getTime())) return dateStr;

    const day = String(d.getDate()).padStart(2, '0');
    const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
    const month = months[d.getMonth()];
    const year = d.getFullYear();

    return `${day}-${month}-${year}`;
  } catch (e) {
    return dateStr;
  }
}

/**
 * Sanitiza una cadena para uso en Storage (remueve acentos y caracteres especiales)
 */
function normalizePath(str) {
  if (!str) return "";
  return str.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remueve acentos
    .replace(/[^a-zA-Z0-9\/\-\_\.\s]/g, "") // Solo permite ASCII básico, /, -, ., _ y espacios
    .trim();
}

async function openLiveView(clues, unidad, municipio) {
  const overlay = $("liveViewOverlay");
  const tbody = $("liveViewTbody");
  const headRow = $("liveViewTable")?.querySelector("thead tr");

  if (!overlay || !tbody) return;

  try {
    /* Semaforización de Cumplimiento (Bulletproof) */
    /* CSS handled externally: #bCumplimiento.good, #bCumplimiento[data-tone="good"] { ... } */

    // 1. Mostrar modal inmediatamente con estado de carga
    overlay.classList.add("show");
    overlay.style.display = "flex";
    overlay.ariaHidden = "false";
    tbody.innerHTML = '<tr><td colspan="6" class="muted" style="padding:60px; text-align:center;"><div class="spinner-small" style="margin:0 auto 12px;"></div>Obteniendo detalle...</td></tr>';

    const fecha = ($("summaryFecha") && $("summaryFecha").value) ? $("summaryFecha").value : todayYmdLocal();
    const tipo = ($("summaryTipo") && $("summaryTipo").value) ? $("summaryTipo").value : "SR";
    const fechaFormatted = formatAppDate(fecha);

    // 2. Títulos
    if ($("liveViewUnidad")) {
      let titlePrefix = "Existencia: ";
      let tableTitle = "Detalle de Existencia Actual";
      if (tipo === "CONS") { titlePrefix = "Consumibles: "; tableTitle = "Detalle de Consumibles"; }
      else if (tipo === "BIO") { titlePrefix = "Pedido BIO: "; tableTitle = "Detalle del Pedido"; }
      $("liveViewUnidad").textContent = titlePrefix + unidad;
      if ($("liveViewTableTitle")) $("liveViewTableTitle").textContent = tableTitle;
    }
    if ($("liveViewMunicipio")) {
      $("liveViewMunicipio").innerHTML =
        escapeHtml(municipio) + " &nbsp;|&nbsp; " + escapeHtml(clues) +
        `<span style="margin-left:12px; font-size:11px; background:#e8f0fe; color:#003366; padding:2px 10px; border-radius:20px; font-weight:700;" id="liveViewDateBadge">📅 ${fechaFormatted}</span>`;
    }

    // 3. Petición real
    const res = await apiCall("adminGetUnitDetail", { clues, fecha, tipo });
    if (!res || !res.ok) throw new Error((res && res.error) || "Sin respuesta del servidor");

    // 3.5 Actualizar la fecha y capturista
    let capturistaStr = "—";
    if (res.data && res.data.length > 0) {
      capturistaStr = res.data[0].capturado_por || "SISTEMA";
    }

    if (res.meta && res.meta.fecha && res.meta.fecha !== fecha) {
      const realFechaFormatted = formatAppDate(res.meta.fecha);
      const badge = document.getElementById("liveViewDateBadge");
      if (badge) badge.textContent = `📅 ${realFechaFormatted}`;
    }

    if ($("liveViewMunicipio")) {
      $("liveViewMunicipio").insertAdjacentHTML('beforeend', `<span style="margin-left:8px; font-size:11px; background:#f1f5f9; color:#475569; padding:2px 10px; border-radius:20px; font-weight:700;">👤 Capturó: ${escapeHtml(capturistaStr)}</span>`);
    }

    // 4. Renderizar según tipo
    if (tipo === "SR") {
      // Ajustar headers Bio
      if (headRow) {
        headRow.innerHTML = `
             <th style="padding: 16px 24px; text-align: left;">Biológico</th>
             <th style="padding: 16px 24px; text-align: left;">Lote</th>
             <th style="padding: 16px 24px; text-align: center;">Existencia</th>
             <th style="padding: 16px 24px; text-align: center;">Caducidad</th>
             <th style="padding: 16px 24px; text-align: center;">Vigencia</th>
             <th style="padding: 16px 24px; text-align: center; white-space: nowrap; min-width: 190px;">Periodo de almacenamiento</th>
           `;
      }

      if (!res.data || !res.data.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="muted" style="padding:40px; text-align:center;">No hay registros detallados para esta fecha.</td></tr>';
        const zeroAlertEmpty = $("liveViewZeroAlert");
        if (zeroAlertEmpty) { zeroAlertEmpty.style.display = 'none'; zeroAlertEmpty.innerHTML = ''; }
        renderLiveCharts("SR", null, null);
      } else {
        const items = res.data;
        let semStats = { pronto: 0, normal: 0, lejana: 0 };
        let cadStats = { m3: 0, m6: 0, m12: 0, more: 0 };

        const getPermanenciaStatus = (recepcionIso) => {
          if (!recepcionIso) return { html: `<span style="color:#94a3b8; font-size:11px;">Sin fecha</span>` };
          const dRec = new Date(recepcionIso);
          const now = new Date();
          dRec.setHours(0, 0, 0, 0); now.setHours(0, 0, 0, 0);
          const diffDays = Math.floor((now - dRec) / (1000 * 60 * 60 * 24));

          const formatTime = (d) => {
            const m = Math.floor(d / 30); const rd = d % 30;
            let p = [];
            if (m > 0) p.push(`${m}m`);
            if (rd > 0 || m === 0) p.push(`${rd}d`);
            return p.join(' ');
          };

          let tone = "good", icon = "check_circle", text = formatTime(diffDays);
          if (diffDays > 90) { tone = "bad"; icon = "error"; text = "Límite excedido (" + formatTime(diffDays) + ")"; }
          else if (diffDays >= 60) { tone = "warn"; icon = "warning"; text = "Alerta: " + text; }

          let bg = tone === "bad" ? "#fef2f2" : tone === "warn" ? "#fffbeb" : "#f0fdf4";
          let color = tone === "bad" ? "#ef4444" : tone === "warn" ? "#d97706" : "#10b981";

          return {
            html: `
              <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                <span style="font-size:11px; color:#64748b; font-weight:700; white-space: nowrap;">${formatAppDate(recepcionIso)}</span>
                <span style="display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:12px; background:${bg}; color:${color}; font-size:10px; font-weight:800; border: 1px solid ${color}40; white-space: nowrap;">
                  <span class="material-symbols-rounded" style="font-size:12px;">${icon}</span> ${text}
                </span>
              </div>
            `
          };
        };

        tbody.innerHTML = items.map(r => {
          const status = getSemaforoStatus(r.caducidad);
          semStats[status.key]++;
          const diffMonths = getMonthsTo(r.caducidad);
          if (diffMonths <= 3) cadStats.m3++;
          else if (diffMonths <= 6) cadStats.m6++;
          else if (diffMonths <= 12) cadStats.m12++;
          else cadStats.more++;

          const perm = getPermanenciaStatus(r.fecha_recepcion);

          return `
                <tr class="live-view-row" style="border-bottom: 1px solid #f1f5f9; transition: all 0.2s ease;">
                  <td style="padding:14px 24px; font-weight:800; color:#0f172a;">${escapeHtml(r.biologico || "—")}</td>
                  <td style="padding:14px 24px; font-weight:600; color:#475569;">${escapeHtml(r.lote || "—")}</td>
                  <td style="padding:14px 24px; text-align:center;">
                    <span class="live-view-count-badge">${escapeHtml(r.cantidad || 0)}</span>
                  </td>
                  <td style="padding:14px 24px; font-weight:700; text-align:center; color:#1e293b;">${escapeHtml(isoToMmmaa(r.caducidad))}</td>
                  <td style="padding:14px 24px; text-align:center;">
                    <span class="status-pill-pro ${status.key}">${status.label}</span>
                  </td>
                  <td style="padding:14px 24px; text-align:center; min-width: 190px;">
                    ${perm.html}
                  </td>
                </tr>
              `;
        }).join("");

        // --- Panel de Alerta: Vacunas en Cero ---
        const bioTotals = {};
        items.forEach(r => {
          const bioName = (r.biologico || '').trim().toUpperCase();
          if (bioName) {
            bioTotals[bioName] = (bioTotals[bioName] || 0) + Number(r.cantidad || 0);
          }
        });

        const biosConCeroTotal = Object.keys(bioTotals).filter(name => bioTotals[name] === 0);

        const zeroAlertEl = $("liveViewZeroAlert");
        if (zeroAlertEl) {
          if (biosConCeroTotal.length > 0) {
            const pillsHtml = biosConCeroTotal.map(name => {
              const origItem = items.find(r => (r.biologico || '').trim().toUpperCase() === name);
              const displayName = origItem ? (origItem.biologico || '').trim() : name;
              return `<span style="display:inline-flex; align-items:center; gap:4px; background:#fff; border:1.5px solid #fecdd3; color:#be123c; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:800; white-space:nowrap;">
                <span class="material-symbols-rounded" style="font-size:14px; color:#f43f5e;">inventory_2</span>
                ${escapeHtml(displayName || '—')}
              </span>`;
            }).join('');
            zeroAlertEl.style.display = 'block';
            zeroAlertEl.innerHTML = `
              <div style="background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%); border: 1.5px solid #fecdd3; border-radius: 20px; padding: 16px 20px; display:flex; flex-wrap:wrap; align-items:center; gap:12px;">
                <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                  <span class="material-symbols-rounded" style="font-size:24px; color:#f43f5e;">warning</span>
                  <div>
                    <div style="font-size:12px; font-weight:900; color:#be123c; text-transform:uppercase; letter-spacing:0.05em;">Vacunas sin existencia</div>
                    <div style="font-size:11px; color:#e11d48; font-weight:600;">Esta unidad capturó con ${biosConCeroTotal.length} biológico${biosConCeroTotal.length > 1 ? 's' : ''} en cero</div>
                  </div>
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:6px; flex:1;">
                  ${pillsHtml}
                </div>
              </div>
            `;
          } else {
            zeroAlertEl.style.display = 'none';
            zeroAlertEl.innerHTML = '';
          }
        }

        // Resaltar filas con cantidad = 0 en carmesí/rosa dentro de la tabla si y solo si el stock total de ese biológico es 0
        if (biosConCeroTotal.length > 0) {
          Array.from(tbody.querySelectorAll('tr')).forEach(tr => {
            const cells = tr.querySelectorAll('td');
            if (cells.length > 0) {
              const bioText = cells[0].textContent.trim().toUpperCase();
              const countBadge = tr.querySelector('.live-view-count-badge');
              if (countBadge && (countBadge.textContent.trim() === '0') && bioTotals[bioText] === 0) {
                tr.style.background = '#fff5f5';
                countBadge.style.background = '#ffe4e6';
                countBadge.style.color = '#be123c';
                countBadge.style.borderColor = '#fecdd3';
              }
            }
          });
        }

        renderLiveCharts("SR", semStats, cadStats);
      }
    } else if (tipo === "BIO") {
      if (headRow) {
        headRow.innerHTML = `
             <th style="padding: 16px 24px; text-align: left;">Biológico</th>
             <th style="padding: 16px 24px; text-align: center;">Existencia (Frascos)</th>
             <th style="padding: 16px 24px; text-align: center;">Pedido (Frascos)</th>
             <th style="padding: 16px 24px; text-align: center;">Promedio</th>
             <th style="padding: 16px 24px; text-align: center;">Dosis Mín/Máx</th>
           `;
      }

      if (!res.data || !res.data.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="muted" style="padding:40px; text-align:center;">No hay pedido de biológicos para esta fecha.</td></tr>';
        renderLiveCharts("BIO", null, null);
      } else {
        const items = res.data;
        tbody.innerHTML = items.map(r => `
             <tr class="live-view-row" style="border-bottom: 1px solid #f1f5f9; transition: all 0.2s ease;">
               <td style="padding:14px 24px; font-weight:800; color:#0f172a;">${escapeHtml(r.biologico || "—")}</td>
               <td style="padding:14px 24px; text-align:center;">
                 <span class="live-view-count-badge bg-slate-100 text-slate-800">${r.existencia_actual_frascos ?? r.existencia ?? 0}</span>
               </td>
               <td style="padding:14px 24px; text-align:center;">
                 <span class="live-view-count-badge">${r.pedido_frascos ?? r.solicitud ?? 0}</span>
               </td>
               <td style="padding:14px 24px; text-align:center; font-weight:700; color:#475569;">${r.promedio_frascos ?? 0}</td>
               <td style="padding:14px 24px; text-align:center; font-weight:600; color:#64748b;">${r.min_dosis ?? 0} / ${r.max_dosis ?? 0}</td>
             </tr>
           `).join("");
        let sumExistencia = 0, sumPedido = 0;
        let topBio = items.map(r => ({ bio: r.biologico, cant: r.pedido_frascos ?? r.solicitud ?? 0 })).sort((a, b) => b.cant - a.cant).slice(0, 4);
        items.forEach(r => {
          sumExistencia += (r.existencia_actual_frascos ?? r.existencia ?? 0);
          sumPedido += (r.pedido_frascos ?? r.solicitud ?? 0);
        });
        renderLiveCharts("BIO", { existencia: sumExistencia, pedido: sumPedido }, topBio);
      }
    } else {
      // Tipo CONSUMIBLES
      if (headRow) {
        headRow.innerHTML = `
             <th style="padding: 16px 24px; text-align: left;">Insumo / Concepto</th>
             <th style="padding: 16px 24px; text-align: center;">Cantidad / Dosis</th>
           `;
      }

      if (!res.data || !res.data.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="muted" style="padding:40px; text-align:center;">No hay reporte de consumibles hoy.</td></tr>';
        renderLiveCharts("CONS", null, null);
      } else {
        const c = res.data[0];
        const rows = [
          { label: "Existencia SRP (Dosis)", val: c.srp_dosis || 0 },
          { label: "Existencia SR (Dosis)", val: c.sr_dosis || 0 },
          { label: "Jeringa de 5 ml", val: c.jeringa_reconst_5ml_0605500438 || 0 },
          { label: "Jeringa de 0.5 ml", val: c.jeringa_aplic_05ml_0605502657 || 0 },
          { label: "Aguja", val: c.aguja_0600403711 || 0 }
        ];
        tbody.innerHTML = rows.map(r => `
             <tr class="live-view-row" style="border-bottom: 1px solid #f1f5f9; transition: all 0.2s ease;">
               <td style="padding:16px 24px; font-weight:800; color:#0f172a;">${r.label}</td>
               <td style="padding:16px 24px; text-align:center;">
                 <span class="live-view-count-badge">${r.val || 0}</span>
               </td>
             </tr>
           `).join("");
        let srp = c.srp_dosis || 0, sr = c.sr_dosis || 0;
        let j5 = c.jeringa_reconst_5ml_0605500438 || 0, j05 = c.jeringa_aplic_05ml_0605502657 || 0, ag = c.aguja_0600403711 || 0;
        renderLiveCharts("CONS", { j5, j05, ag }, { srp, sr });
      }
    }

  } catch (e) {
    console.error("openLiveView error:", e);
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="muted" style="padding:40px; text-align:center;">Error al cargar: ${escapeHtml(e.message)}</td></tr>`;
    showToast("Error al cargar detalle: " + e.message, false);
  }
}

function getMonthsTo(mmmaa) {
  if (!mmmaa) return 99;
  // Soporte tanto para MMM-YY como para ISO YYYY-MM-DD
  let mStr, yStr;
  if (mmmaa.includes("-") && mmmaa.length <= 7) {
    const parts = mmmaa.split("-");
    mStr = parts[0].toUpperCase();
    yStr = parts[1];
  } else {
    // Es ISO? yyyy-mm-dd
    const parts = mmmaa.split("-");
    if (parts.length < 2) return 99;
    const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
    mStr = months[parseInt(parts[1]) - 1];
    yStr = parts[0].substring(2);
  }

  const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  const mIdx = months.indexOf(mStr);
  if (mIdx === -1) return 99;

  const year = 2000 + parseInt(yStr);
  const cadDate = new Date(year, mIdx, 1);
  const now = new Date();

  return (cadDate.getFullYear() - now.getFullYear()) * 12 + (cadDate.getMonth() - now.getMonth());
}

function mmmaaToIsoDate(str) {
  if (!str || !str.includes("-") || str.length > 7) return str;
  try {
    const [mStr, yStr] = str.toUpperCase().split("-");
    const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
    const mIdx = months.indexOf(mStr);
    if (mIdx === -1) return str;
    const year = 2000 + parseInt(yStr);
    const lastDay = new Date(year, mIdx + 1, 0).getDate();
    return `${year}-${String(mIdx + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  } catch (e) { return str; }
}

function isoToMmmaa(isoStr) {
  if (!isoStr || isoStr.length < 7) return isoStr;
  try {
    const parts = isoStr.split("-");
    if (parts.length < 2) return isoStr;
    const y = parts[0].substring(2);
    const mIdx = parseInt(parts[1]) - 1;
    const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
    return `${months[mIdx]}-${y}`;
  } catch (e) { return isoStr; }
}

function getSemaforoStatus(val) {
  const diff = getMonthsTo(val);
  if (diff < 0) return { key: "expired", label: "Expirado", color: "#ba1a1a" };
  if (diff <= 3) return { key: "pronto", label: "Cad. Próxima", color: "#ef4444" };
  if (diff <= 6) return { key: "normal", label: "Cad. Media", color: "#f59e0b" };
  return { key: "lejana", label: "Vigente", color: "#10b981" };
}

function renderLiveCharts(tipo, leftData, rightData) {
  try {
    const ctxLeft = $("liveChartLeft");
    const ctxRight = $("liveChartRight");
    if (!ctxLeft || !ctxRight) return;

    if (CHART_SEM) { CHART_SEM.dispose(); CHART_SEM = null; }
    if (CHART_CAD) { CHART_CAD.dispose(); CHART_CAD = null; }

    const setDOM = (kL, tL, dL, kR, tR, dR) => {
      if ($("liveChartLeftKicker")) $("liveChartLeftKicker").textContent = kL;
      if ($("liveChartLeftTitle")) $("liveChartLeftTitle").textContent = tL;
      if ($("liveChartLeftDesc")) $("liveChartLeftDesc").textContent = dL;
      if ($("liveChartRightKicker")) $("liveChartRightKicker").textContent = kR;
      if ($("liveChartRightTitle")) $("liveChartRightTitle").textContent = tR;
      if ($("liveChartRightDesc")) $("liveChartRightDesc").textContent = dR;
    };

    if (tipo === "SR") {
      setDOM("Salud del Inventario", "Estado Semafórico", "Distribución por vigencia", "Riesgo de Caducidad", "Próximos Vencimientos", "Análisis de tiempo");
      let sem = leftData || { pronto: 0, normal: 0, lejana: 0 };
      let cad = rightData || { m3: 0, m6: 0, m12: 0, more: 0 };

      CHART_SEM = echarts.init(ctxLeft);
      CHART_SEM.setOption({
        animationDuration: 800, animationEasing: 'cubicOut',
        tooltip: { trigger: 'item', backgroundColor: 'rgba(15, 23, 42, 0.9)', textStyle: { color: '#fff', fontSize: 10 }, borderWidth: 0, borderRadius: 8, padding: [4, 8] },
        series: [{
          type: 'pie', radius: ['60%', '90%'], avoidLabelOverlap: false,
          itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          data: [
            { value: sem.pronto, name: 'Próxima', itemStyle: { color: '#f87171' } },
            { value: sem.normal, name: 'Media', itemStyle: { color: '#fbbf24' } },
            { value: sem.lejana, name: 'Vigente', itemStyle: { color: '#4ade80' } }
          ]
        }]
      });

      CHART_CAD = echarts.init(ctxRight);
      CHART_CAD.setOption({
        animationDuration: 800, animationEasing: 'cubicOut',
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(15, 23, 42, 0.9)', textStyle: { color: '#fff', fontSize: 10 }, borderWidth: 0, borderRadius: 8, padding: [4, 8] },
        grid: { left: '0%', right: '0%', top: '15%', bottom: '5%', containLabel: true },
        xAxis: { type: 'category', data: ['< 3m', '3-6m', '6-12m', '> 12m'], axisLabel: { fontSize: 9, fontWeight: 'bold', color: '#64748b' }, axisLine: { show: false }, axisTick: { show: false } },
        yAxis: { type: 'value', show: false },
        series: [{
          name: 'Lotes', type: 'bar', data: [cad.m3, cad.m6, cad.m12, cad.more],
          itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] }
        }]
      });

    } else if (tipo === "BIO") {
      setDOM("Balance Global", "Relación de Inventario", "Total Existencia vs Pedido", "Volumen Solicitado", "Top Biológicos", "Mayor cantidad de frascos");
      let ex = leftData?.existencia || 0;
      let pd = leftData?.pedido || 0;
      let top = rightData || [];

      CHART_SEM = echarts.init(ctxLeft);
      CHART_SEM.setOption({
        animationDuration: 800, animationEasing: 'cubicOut',
        tooltip: { trigger: 'item', backgroundColor: 'rgba(15, 23, 42, 0.9)', textStyle: { color: '#fff', fontSize: 10 }, borderWidth: 0, borderRadius: 8, padding: [4, 8] },
        series: [{
          type: 'pie', radius: ['60%', '90%'], avoidLabelOverlap: false,
          itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          data: [
            { value: ex, name: 'Existencia Actual', itemStyle: { color: '#94a3b8' } },
            { value: pd, name: 'Pedido Solicitado', itemStyle: { color: '#8b5cf6' } }
          ]
        }]
      });

      let topLabels = top.length ? top.map(t => t.bio) : ['Sin datos'];
      let topCant = top.length ? top.map(t => t.cant) : [0];
      
      CHART_CAD = echarts.init(ctxRight);
      CHART_CAD.setOption({
        animationDuration: 800, animationEasing: 'cubicOut',
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(15, 23, 42, 0.9)', textStyle: { color: '#fff', fontSize: 10 }, borderWidth: 0, borderRadius: 8, padding: [4, 8] },
        grid: { left: '0%', right: '0%', top: '15%', bottom: '5%', containLabel: true },
        xAxis: { type: 'category', data: topLabels, axisLabel: { fontSize: 8, fontWeight: 'bold', color: '#64748b', interval: 0, rotate: 45 }, axisLine: { show: false }, axisTick: { show: false } },
        yAxis: { type: 'value', show: false },
        series: [{
          name: 'Frascos', type: 'bar', data: topCant,
          itemStyle: { color: '#c084fc', borderRadius: [4, 4, 0, 0] }
        }]
      });

    } else if (tipo === "CONS") {
      setDOM("Distribución", "Insumos Reportados", "Proporción de material", "Dosis Reportadas", "Existencia Dosis", "SRP vs SR");
      let j5 = leftData?.j5 || 0, j05 = leftData?.j05 || 0, ag = leftData?.ag || 0;
      let srp = rightData?.srp || 0, sr = rightData?.sr || 0;

      CHART_SEM = echarts.init(ctxLeft);
      CHART_SEM.setOption({
        animationDuration: 800, animationEasing: 'cubicOut',
        tooltip: { trigger: 'item', backgroundColor: 'rgba(15, 23, 42, 0.9)', textStyle: { color: '#fff', fontSize: 10 }, borderWidth: 0, borderRadius: 8, padding: [4, 8] },
        series: [{
          type: 'pie', radius: ['60%', '90%'], avoidLabelOverlap: false,
          itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          data: [
            { value: j5, name: 'Jeringa 5ml', itemStyle: { color: '#38bdf8' } },
            { value: j05, name: 'Jeringa 0.5ml', itemStyle: { color: '#0ea5e9' } },
            { value: ag, name: 'Agujas', itemStyle: { color: '#0284c7' } }
          ]
        }]
      });

      CHART_CAD = echarts.init(ctxRight);
      CHART_CAD.setOption({
        animationDuration: 800, animationEasing: 'cubicOut',
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(15, 23, 42, 0.9)', textStyle: { color: '#fff', fontSize: 10 }, borderWidth: 0, borderRadius: 8, padding: [4, 8] },
        grid: { left: '0%', right: '0%', top: '15%', bottom: '5%', containLabel: true },
        xAxis: { type: 'category', data: ['SRP', 'SR'], axisLabel: { fontSize: 10, fontWeight: 'bold', color: '#64748b' }, axisLine: { show: false }, axisTick: { show: false } },
        yAxis: { type: 'value', show: false },
        series: [{
          name: 'Dosis', type: 'bar', data: [srp, sr],
          itemStyle: { color: '#059669', borderRadius: [4, 4, 0, 0] }
        }]
      });
    }
  } catch (err) {
    console.warn("Chart error:", err);
  }
}

if ($("btnLiveViewClose")) {
  $("btnLiveViewClose").onclick = () => {
    $("liveViewOverlay").classList.remove("show");
    $("liveViewOverlay").style.display = "none";
    $("liveViewOverlay").ariaHidden = "true";
  };
}

window.openLiveView = openLiveView;

// ✅ AUTO-UPPERCASE FOR LOTES
document.addEventListener("input", e => {
  if (e.target && (e.target.id === "loteTxt" || e.target.classList.contains("sr-lote-select") || e.target.classList.contains("rowLoteInput"))) {
    if (typeof e.target.value === "string") {
      e.target.value = e.target.value.toUpperCase();
    }
  }
});

// ==========================================
// PANEL DE ARCHIVOS (VISUALIZADOR DROPDOWN)
// ==========================================
let ARCHIVOS_DATA = [];
let CURRENT_EVIDENCE_CATEGORY = "Evidencia_de_capacitaciones";

function getArchivosDropdownRefs() {
  return {
    box: $("archivosDropdown"),
    btn: $("btnViewArchivos"),
    host: $("cardSide")
  };
}

function positionArchivosDropdown() {
  const refs = getArchivosDropdownRefs();
  const box = refs.box;
  const btn = refs.btn;
  if (!box || !btn) return;

  const btnRect = btn.getBoundingClientRect();
  const boxWidth = box.offsetWidth;
  const padding = 12;

  let top = btnRect.bottom + 12;
  let left = btnRect.right - boxWidth;

  if (left < padding) left = padding;
  if (left + boxWidth > window.innerWidth - padding) {
    left = window.innerWidth - boxWidth - padding;
  }

  const availableHeight = window.innerHeight - top - padding;

  box.style.position = "fixed";
  box.style.top = top + "px";
  box.style.left = left + "px";
  box.style.maxHeight = availableHeight + "px";
  box.style.zIndex = "10000";
}


function toggleArchivosDropdown() {
  const box = $("archivosDropdown");
  if (!box) return;

  const isOpen = box.style.display === "block";
  if (isOpen) {
    box.classList.remove("open");
    box.style.display = "none";
  } else {
    // Ocultar notif si está abierto
    if (typeof closeTopNotifDropdown === "function") closeTopNotifDropdown();

    box.style.display = "block";
    // Force reflow for animation
    void box.offsetWidth;
    box.classList.add("open");
    positionArchivosDropdown();
    renderArchivosView();
  }
}

$("btnViewArchivos")?.addEventListener("click", ev => {
  ev.preventDefault();
  ev.stopPropagation();
  toggleArchivosDropdown();
});

$("btnArchivosClose")?.addEventListener("click", ev => {
  ev.preventDefault();
  toggleArchivosDropdown();
});

document.addEventListener("click", ev => {
  const box = $("archivosDropdown");
  if (box && box.style.display === "block") {
    const isBtn = ev.target.closest("#btnViewArchivos");
    if (!box.contains(ev.target) && !isBtn) {
      box.classList.remove("open");
      box.style.display = "none";
    }
  }
});

document.addEventListener("keydown", ev => {
  if (ev.key === "Escape") {
    const box = $("archivosDropdown");
    if (box && box.style.display === "block") {
      box.classList.remove("open");
      box.style.display = "none";
    }
  }
});

$("btnRefreshArchivos")?.addEventListener("click", renderArchivosView);
$("archivosSearch")?.addEventListener("input", filterArchivosGrid);

function syncEvidenceExplorerTabs() {
  const tabs = document.querySelectorAll(".evidence-tab");
  tabs.forEach(tab => {
    const cat = tab.getAttribute("data-category");
    if (cat === CURRENT_EVIDENCE_CATEGORY) {
      tab.className = "evidence-tab flex-1 h-12 flex items-center justify-center rounded-2xl transition-all bg-primary text-white shadow-md border-transparent scale-105 z-10";
    } else {
      tab.className = "evidence-tab flex-1 h-12 flex items-center justify-center rounded-2xl transition-all bg-white text-slate-500 hover:text-primary hover:bg-primary/5 shadow-sm border border-slate-200";
    }
  });
}

function initEvidenceTabs() {
  const tabs = document.querySelectorAll(".evidence-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      CURRENT_EVIDENCE_CATEGORY = tab.getAttribute("data-category");
      syncEvidenceExplorerTabs();
      renderArchivosView();
    });
  });
  syncEvidenceExplorerTabs();
}

initEvidenceTabs();

async function renderArchivosView() {
  try {
    showOverlay("Cargando evidencias...", "Leyendo desde Supabase");

    // 🛡️ Garantizar que el catálogo de unidades esté cargado (crítico para filtro MUNICIPAL)
    if (!UNIT_CATALOG || UNIT_CATALOG.length === 0) {
      await loadUnitCatalog();
    }

    const res = await apiCall({ action: "listfiles", category: CURRENT_EVIDENCE_CATEGORY });
    if (res && res.ok) {
      ARCHIVOS_DATA = res.data;
      filterArchivosGrid();
    } else {
      showToast("Error al cargar archivos", false);
    }
  } catch (e) {
    console.error(e);
    showToast("Error", false);
  } finally {
    hideOverlay();
  }
}

function filterArchivosGrid() {
  const container = $("archivosContainer");
  if (!container) return;

  const catFilt = (CURRENT_EVIDENCE_CATEGORY || "").toLowerCase();
  const txtFilt = ($("archivosSearch")?.value || "").toLowerCase();
  const role = String((typeof USER !== "undefined" && USER && USER.rol) ? USER.rol : "").toUpperCase();
  const myClues = (typeof USER !== "undefined" && USER && USER.clues) ? USER.clues : "";
  const myMunicipio = (typeof USER !== "undefined" && USER && USER.municipio) ? USER.municipio : "";
  const isUnidad = role === "UNIDAD";
  const isMunicipal = role === "MUNICIPAL";
  const isAdmin = role === "ADMIN" || role === "JURISDICCIONAL";

  // 🛡️ Para MUNICIPAL: construir set de CLUES permitidas basándose en sus municipios autorizados
  let allowedCluesSet = null;
  if (isMunicipal) {
    allowedCluesSet = new Set();
    const catalog = Array.isArray(UNIT_CATALOG) ? UNIT_CATALOG : [];
    catalog.forEach(u => {
      if (canSeeMunicipio_(USER, u.municipio)) {
        allowedCluesSet.add(String(u.clues || "").trim().toUpperCase());
      }
    });
  }

  let filtered = ARCHIVOS_DATA.filter(f => {
    const pathParts = (f.name || "").split("/");
    if (pathParts.length < 3) return false;

    const category = (pathParts[0] || "").toLowerCase();
    const cluMun = (pathParts[1] || "").toUpperCase();

    // ✅ REGLA: UNIDAD solo ve 'Supervisión' de su CLUES
    if (isUnidad) {
      const myCluesClean = String(myClues).trim().toUpperCase();
      if (!category.includes("supervisi")) return false;
      if (!cluMun.includes(myCluesClean)) return false;
    }

    // ✅ REGLA: MUNICIPAL solo ve archivos de CLUES de su municipio
    if (isMunicipal && allowedCluesSet) {
      const cluesFromPath = cluMun.split("_")[0];
      if (!allowedCluesSet.has(cluesFromPath)) return false;
    }

    // ✅ REGLA: CARAVANAS solo ve archivos de unidades móviles (FAM/UMME)
    if (role === "CARAVANAS") {
      let isCaravana = false;
      const cluesFromPath = cluMun.split("_")[0];
      const catalog = Array.isArray(UNIT_CATALOG) ? UNIT_CATALOG : [];
      const uInfo = catalog.find(u => u.clues === cluesFromPath);
      if (uInfo) {
        const uName = (uInfo.unidad || uInfo.UNIDAD || uInfo.nombre || "").toUpperCase().trim();
        isCaravana = uName.startsWith("FAM") || uName.startsWith("UMME");
      } else {
        isCaravana = cluMun.includes("FAM") || cluMun.includes("UMME");
      }
      if (!isCaravana) return false;
    }

    return true;
  });

  if (txtFilt) {
    filtered = filtered.filter(f => f.name.toLowerCase().includes(txtFilt));
  }

  // Filtro de categoría inteligente (ignora guiones bajos y acentos)
  if (catFilt) {
    const normalize = str => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/_/g, " ");
    const normalizedCat = normalize(catFilt).toLowerCase();
    filtered = filtered.filter(f => {
      const pathCat = normalize(f.name.split("/")[0] || "").toLowerCase();
      return pathCat === normalizedCat;
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div class="col-span-full text-center text-outline p-8 bg-surface-variant rounded-2xl">No se encontraron archivos.</div>`;
    return;
  }

  // Helper para extraer datos enriquecidos del path
  const enrichFile = (f) => {
    const url = `${SUPABASE_URL}/storage/v1/object/public/evidencias/${encodeURIComponent(f.name)}`;
    const parts = f.name.split("/");
    const fileName = parts[2] || "Desconocido";
    const cluesUnidadStr = parts[1] || "";
    const cluesId = cluesUnidadStr.split("_")[0] || "Desconocido";
    const dObj = new Date(f.created_at);
    const dateStr = dObj.toLocaleDateString();

    // Buscar municipio de la CLUES (usando UNIT_CATALOG si está disponible)
    let municipio = "DESCONOCIDO";
    if (typeof UNIT_CATALOG !== 'undefined' && Array.isArray(UNIT_CATALOG)) {
      const uInfo = UNIT_CATALOG.find(u => u.clues === cluesId);
      if (uInfo && uInfo.municipio) municipio = uInfo.municipio;
    }

    return { ...f, url, fileName, cluesId, cluesUnidadStr, dateStr, dObj, municipio };
  };

  const enrichedFiles = filtered.map(enrichFile);

  // Generador de tarjeta de archivo
  const fileCardHTML = (file) => `
    <div class="bg-white border border-outline-variant/30 rounded-lg p-3 flex items-center gap-3 transition-all hover:bg-slate-50 hover:border-primary/20 hover:shadow-sm group mt-2">
      <div class="w-10 h-10 rounded bg-primary/5 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10">
        <span class="material-symbols-rounded text-primary text-[20px]">description</span>
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-bold text-[12px] text-primary truncate leading-tight" title="${file.fileName}">${file.fileName}</p>
        <div class="flex items-center gap-2 mt-0.5">
          <span class="text-[9px] font-bold text-outline-variant uppercase tracking-wider truncate max-w-[150px]">${file.cluesUnidadStr.replace(/_/g, ' ')}</span>
          <span class="text-[9px] text-outline opacity-60">•</span>
          <span class="text-[9px] text-outline font-medium">${file.dateStr}</span>
        </div>
      </div>
      <a href="${file.url}" target="_blank" class="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center transition-all hover:bg-primary hover:text-white" title="Ver archivo">
        <span class="material-symbols-rounded text-[18px]">visibility</span>
      </a>
    </div>
  `;

  // Generador de acordeón de fecha
  const dateAccordionHTML = (dateStr, filesArray) => `
    <details class="group bg-slate-50/50 rounded-xl border border-slate-200 mt-3 overflow-hidden" open>
      <summary class="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-100 transition-colors list-none select-none">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
             <span class="material-symbols-rounded text-[18px]">calendar_today</span>
          </div>
          <div>
            <h5 class="text-[12px] font-bold text-primary leading-none">${dateStr}</h5>
            <span class="text-[9px] text-slate-500 font-medium">${filesArray.length} archivos</span>
          </div>
        </div>
        <span class="material-symbols-rounded text-slate-400 group-open:rotate-180 transition-transform text-[18px]">expand_more</span>
      </summary>
      <div class="px-3 pb-3 pt-0 border-t border-slate-100 flex flex-col">
        ${filesArray.map(f => fileCardHTML(f)).join("")}
      </div>
    </details>
  `;

  // Generador de acordeón de unidad (CLUES)
  const cluesAccordionHTML = (cluesId, cluesUnidadStr, filesByDate) => {
    let dateHTMLs = "";
    // Ordenar fechas descendente
    const sortedDates = Object.keys(filesByDate).sort((a, b) => {
      const d1 = filesByDate[a][0].dObj;
      const d2 = filesByDate[b][0].dObj;
      return d2 - d1;
    });
    sortedDates.forEach(dateStr => {
      dateHTMLs += dateAccordionHTML(dateStr, filesByDate[dateStr]);
    });

    return `
      <details class="group bg-white rounded-2xl border border-slate-200 mb-4 overflow-hidden shadow-sm">
        <summary class="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors list-none select-none">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
               <span class="material-symbols-rounded">folder_open</span>
            </div>
            <div>
              <h4 class="text-[13px] font-bold text-primary leading-tight">${cluesId}</h4>
              <span class="text-[10px] text-slate-500 font-medium">${cluesUnidadStr.replace(/_/g, ' ')}</span>
            </div>
          </div>
          <span class="material-symbols-rounded text-slate-400 group-open:rotate-180 transition-transform">expand_more</span>
        </summary>
        <div class="px-4 pb-4 pt-1 bg-slate-50/30 flex flex-col gap-1 border-t border-slate-100">
          ${dateHTMLs}
        </div>
      </details>
    `;
  };

  let finalHTML = "";

  if (isUnidad) {
    // UNIDAD: No hay carpetas de CLUES. Solo subcarpetas de fechas.
    const byDate = {};
    enrichedFiles.forEach(f => {
      if (!byDate[f.dateStr]) byDate[f.dateStr] = [];
      byDate[f.dateStr].push(f);
    });

    const sortedDates = Object.keys(byDate).sort((a, b) => byDate[b][0].dObj - byDate[a][0].dObj);
    finalHTML = sortedDates.map(dateStr => dateAccordionHTML(dateStr, byDate[dateStr])).join("");
  }
  else if (isMunicipal) {
    // MUNICIPAL: Carpetas por CLUES, sin dividir por Municipio
    const byClues = {};
    enrichedFiles.forEach(f => {
      if (!byClues[f.cluesId]) byClues[f.cluesId] = { cluesUnidadStr: f.cluesUnidadStr, dates: {} };
      if (!byClues[f.cluesId].dates[f.dateStr]) byClues[f.cluesId].dates[f.dateStr] = [];
      byClues[f.cluesId].dates[f.dateStr].push(f);
    });

    // Ordenar CLUES alfabéticamente
    const sortedClues = Object.keys(byClues).sort();
    sortedClues.forEach(cluesId => {
      finalHTML += cluesAccordionHTML(cluesId, byClues[cluesId].cluesUnidadStr, byClues[cluesId].dates);
    });
  }
  else {
    // ADMIN/JURISDICCIONAL: Separación por Municipio -> Carpetas de CLUES -> Carpetas de Fecha
    const byMun = {};
    enrichedFiles.forEach(f => {
      const m = f.municipio;
      if (!byMun[m]) byMun[m] = {};
      if (!byMun[m][f.cluesId]) byMun[m][f.cluesId] = { cluesUnidadStr: f.cluesUnidadStr, dates: {} };
      if (!byMun[m][f.cluesId].dates[f.dateStr]) byMun[m][f.cluesId].dates[f.dateStr] = [];
      byMun[m][f.cluesId].dates[f.dateStr].push(f);
    });

    const sortedMuns = Object.keys(byMun).sort();
    sortedMuns.forEach(mun => {
      finalHTML += `
        <div class="mb-6">
          <div class="flex items-center gap-2 mb-3 px-1">
            <span class="material-symbols-rounded text-orange-400 text-[18px]">location_on</span>
            <h3 class="text-[13px] font-black text-slate-700 uppercase tracking-widest">${mun}</h3>
          </div>
      `;
      const cluesObj = byMun[mun];
      const sortedClues = Object.keys(cluesObj).sort();
      sortedClues.forEach(cluesId => {
        finalHTML += cluesAccordionHTML(cluesId, cluesObj[cluesId].cluesUnidadStr, cluesObj[cluesId].dates);
      });
      finalHTML += `</div>`;
    });
  }

  container.innerHTML = finalHTML;
}

/**
 * ✅ GESTIÓN LOGÍSTICA - ADMIN
 */
/**
 * ✅ GESTIÓN LOGÍSTICA - ADMIN (REFACTORED FOR TABS)
 */
async function refreshBulkBioSetup() {
  if (!USER || USER.rol !== "ADMIN") return;

  // 1. Cargar Catálogo de Biológicos para el Bulk Tool
  loadBioBulkCatalogo();

  // 2. Listener de Búsqueda de Unidades
  const searchInput = $("unitBulkSearch");
  if (searchInput) {
    searchInput.oninput = debounce(() => searchBioBulkUnits(searchInput.value), 300);
  }
}

async function loadBioBulkCatalogo() {
  const wrap = $("bioBulkVaccinesList");
  if (!wrap) return;

  try {
    const res = await supabase.from('biologicos_catalogo').select('*').order('orden_biologico');
    if (res.error) throw res.error;

    wrap.innerHTML = res.data.map(v => `
        <label class="flex items-center gap-3 p-2.5 rounded-xl bg-white hover:bg-primary/5 cursor-pointer transition-all border border-outline-variant/30 group">
          <input type="checkbox" class="bioBulkCheckbox w-4 h-4 rounded border-primary" value="${escapeAttr(v.biologico)}">
          <div class="flex flex-col min-w-0">
            <span class="text-[11px] font-black text-primary truncate">${escapeHtml(v.biologico)}</span>
            <span class="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">${escapeHtml(v.clave_biologico || 'S.C.')}</span>
          </div>
        </label>
      `).join('');
  } catch (e) {
    console.error("Error loading bio catalog:", e);
    wrap.innerHTML = `<div class="muted col-span-2 text-center text-[11px]">Error al cargar catálogo</div>`;
  }
}

window.loadAllUnitsBulk = async function () {
  const wrap = $("unitBulkList");
  if (!wrap) return;

  showOverlay("Cargando todas las unidades...", "Carga Global");
  try {
    const { data, error } = await supabase
      .from('unidades')
      .select('clues, unidad, municipio')
      .eq('activo', 'SI')
      .order('municipio', { ascending: true })
      .order('clues', { ascending: true });

    if (error) throw error;
    renderBulkUnitItems(data);
    showToast(`Cargadas ${data.length} unidades`, true);
  } catch (e) {
    console.error("Error global units load:", e);
    showToast("Error al cargar todas las unidades", false, "error");
  } finally {
    hideOverlay();
  }
};

window.selectAllFilteredUnits = function () {
  const checks = document.querySelectorAll(".unitBulkCheckbox");
  if (checks.length === 0) {
    showToast("No hay unidades listadas para marcar", false, "warn");
    return;
  }
  checks.forEach(i => i.checked = true);
  showToast(`Marcadas ${checks.length} unidades`, true);
};

window.deselectAllUnits = function () {
  const checks = document.querySelectorAll(".unitBulkCheckbox");
  checks.forEach(i => i.checked = false);
  showToast("Unidades desmarcadas");
};

window.selectAllVaccinesBulk = function () {
  const checks = document.querySelectorAll(".bioBulkCheckbox");
  checks.forEach(i => i.checked = true);
  showToast("Todos los biológicos marcados");
};

window.deselectAllVaccinesBulk = function () {
  const checks = document.querySelectorAll(".bioBulkCheckbox");
  checks.forEach(i => i.checked = false);
  showToast("Biológicos desmarcados");
};

function renderBulkUnitItems(data) {
  const wrap = $("unitBulkList");
  if (!wrap) return;
  if (!data || data.length === 0) {
    wrap.innerHTML = `<div class="muted p-2 text-center text-[11px] font-bold opacity-40 py-10 w-full">No se encontraron unidades</div>`;
    return;
  }
  wrap.innerHTML = data.map(u => `
      <label class="flex items-center gap-3 p-3 rounded-xl bg-white hover:bg-primary/5 cursor-pointer transition-all border border-outline-variant/30 group shadow-sm min-w-[200px] flex-1">
        <input type="checkbox" class="unitBulkCheckbox w-4 h-4 rounded border-primary" value="${escapeAttr(u.clues)}">
        <div class="flex flex-col min-w-0">
          <span class="text-[11px] font-black text-primary truncate">${escapeHtml(u.unidad)}</span>
          <span class="text-[9px] font-bold text-slate-400 uppercase tracking-tight truncate">${escapeHtml(u.municipio)}</span>
        </div>
      </label>
    `).join('');
}

async function searchBioBulkUnits(query) {
  const wrap = $("unitBulkList");
  if (!wrap) return;
  if (!query || query.length < 2) {
    wrap.innerHTML = `<div class="muted p-2 text-center text-[11px] font-bold opacity-40 py-10 w-full flex flex-col items-center gap-3">
                        <span class="material-symbols-rounded text-[32px]">manage_search</span>
                        Escribe para buscar unidades...
                      </div>`;
    return;
  }

  try {
    const { data, error } = await supabase
      .from('unidades')
      .select('clues, unidad, municipio')
      .or(`clues.ilike.%${query}%,unidad.ilike.%${query}%`)
      .order('municipio', { ascending: true })
      .order('clues', { ascending: true })
      .limit(30);

    if (error) throw error;
    renderBulkUnitItems(data);
  } catch (e) {
    console.error("Error searching units:", e);
    wrap.innerHTML = `<div class="muted p-2 text-center text-[11px]">Error en la búsqueda</div>`;
  }
}

window.handleBulkBioVisibility = async function (activo) {
  const selectedClues = Array.from(document.querySelectorAll(".unitBulkCheckbox:checked")).map(i => i.value);
  const selectedVaccines = Array.from(document.querySelectorAll(".bioBulkCheckbox:checked")).map(i => i.value);

  if (selectedClues.length === 0 || selectedVaccines.length === 0) {
    showToast("Selecciona al menos una unidad y un biológico", false, "warn");
    return;
  }

  const actionText = activo === 'SI' ? 'HABILITAR' : 'OCULTAR';
  if (!confirm(`¿Estás seguro de ${actionText} los ${selectedVaccines.length} biológicos seleccionados en las ${selectedClues.length} unidades?`)) return;

  showOverlay("Aplicando cambios masivos...", "Admin Logística");
  try {
    const res = await apiCall({
      action: "adminToggleBioParam",
      cluesList: selectedClues,
      vaccinesList: selectedVaccines,
      activo: activo
    });

    if (res && res.ok) {
      showToast("Configuración actualizada con éxito", true);
      document.querySelectorAll(".unitBulkCheckbox, .bioBulkCheckbox").forEach(i => i.checked = false);
    } else {
      throw new Error(res?.error || "Error en el servidor");
    }
  } catch (e) {
    showToast("Error: " + e.message, false);
  } finally {
    hideOverlay();
  }
};

async function saveBioOverride() {
  const month = $("bioOverrideMonth").value; // YYYY-MM
  const target = $("bioOverrideTarget").value;
  const start = $("bioOverrideStart").value;
  const end = $("bioOverrideEnd").value;

  if (!month || !target || !start || !end) {
    showToast("Por favor completa todos los campos de la ventana", false, "warn");
    return;
  }

  showOverlay("Guardando ventana extraordinaria...", "Calendario");
  try {
    const res = await apiCall({
      action: "adminSetBioOverride",
      anio_mes: month,
      fecha_target: target,
      habilitar_desde: start,
      habilitar_hasta: end,
      motivo: "APERTURA EXTRAORDINARIA ADMIN",
      activo: "SI"
    });

    if (res && res.ok) {
      showToast("Ventana extraordinaria habilitada", true);
      // Limpiar para evitar duplicados accidentales
      $("bioOverrideTarget").value = "";
      $("bioOverrideStart").value = "";
      $("bioOverrideEnd").value = "";
      await refreshConsumiblesStatusUi();
    } else {
      throw new Error(res?.error || "Error al guardar");
    }
  } catch (e) {
    showToast("Error: " + e.message, false);
  } finally {
    hideOverlay();
  }
}

// === GLOBAL UX ENHANCEMENTS ===

// 1. Open native date picker when clicking anywhere in the input or its container group
document.addEventListener("click", (e) => {
  // Only target date or month inputs
  const isDateInput = (el) => el && el.tagName === "INPUT" && (el.type === "date" || el.type === "month");

  let targetInput = null;
  if (isDateInput(e.target)) {
    targetInput = e.target;
  } else {
    // Check if clicking inside a group that contains a date input (icon, padding, etc)
    const group = e.target.closest(".modern-input-group");
    if (group) {
      targetInput = group.querySelector('input[type="date"], input[type="month"]');
    }
  }

  if (targetInput && typeof targetInput.showPicker === "function") {
    try {
      targetInput.showPicker();
    } catch (err) {
      // Silently fail if browser doesn't support it or state doesn't allow it
    }
  }
});

// Dinamización instantánea del Resumen de Captura
document.getElementById("summaryTipo")?.addEventListener("change", () => reloadCaptureSummarySilent());
document.getElementById("summaryFecha")?.addEventListener("change", () => reloadCaptureSummarySilent());

function isWorkDay(d) {
  if (!d) return false;
  const dateObj = (d instanceof Date) ? d : new Date(d + "T00:00:00");
  return isBusinessDay(dateObj);
}

function getBioCaptureWindow(year, month) {
  let target = new Date(year, month - 1, 22);
  while (!isBusinessDay(target)) {
    target.setDate(target.getDate() - 1);
  }
  let start = new Date(target);
  start.setDate(start.getDate() - 1);
  while (!isBusinessDay(start)) {
    start.setDate(start.getDate() - 1);
  }
  let end = new Date(target);
  end.setDate(end.getDate() + 1);
  while (!isBusinessDay(end)) {
    end.setDate(end.getDate() + 1);
  }
  return { start, target, end };
}

// Profile Dropdown Toggle Logic
// Profile Dropdown Toggle Logic
function initProfileDropdown() {
  const btn = document.getElementById("btnProfileToggle");
  const dropdown = document.getElementById("profileDropdown");
  if (!btn || !dropdown) return;

  btn.onclick = (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("hidden");
    btn.classList.toggle("btn-active", !dropdown.classList.contains("hidden"));
  };

  document.addEventListener("click", (e) => {
    if (!dropdown.classList.contains("hidden") && !dropdown.contains(e.target) && !btn.contains(e.target)) {
      dropdown.classList.add("hidden");
      btn.classList.remove("btn-active");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !dropdown.classList.contains("hidden")) {
      dropdown.classList.add("hidden");
      btn.classList.remove("btn-active");
    }
  });
}



/**
 * 🛡️ CENTRALIZED PERMISSION ENGINE (Attribute-Based)
 * Scans the DOM for [data-role-gate] and toggles visibility based on role.
 */
function applyRolePermissions(role) {
  const normalizedRole = String(role || "UNIDAD").trim().toUpperCase();
  console.log("🛡️ Applying permissions for role:", normalizedRole);

  document.querySelectorAll("[data-role-gate]").forEach(el => {
    const allowedRoles = el.getAttribute("data-role-gate").split(",").map(r => r.trim().toUpperCase());
    const isAllowed = allowedRoles.includes(normalizedRole);

    if (isAllowed) {
      el.classList.remove("nav-hidden");
      el.style.removeProperty("display");
    } else {
      el.classList.add("nav-hidden");
      el.style.setProperty("display", "none", "important");
    }
  });

  // Especial: Ajustes de UI que no son solo ocultar (placeholders, etc)
  const isUnidad = normalizedRole === "UNIDAD";
  const isMunicipal = normalizedRole === "MUNICIPAL" || normalizedRole === "CARAVANAS";
  if ($("archivosSearch")) {
    $("archivosSearch").placeholder = isUnidad ? "Buscar por fecha..." : "Buscar por Clues o Unidad...";
  }
  const subtitleEl = $("archivosSubtitle");
  if (subtitleEl) {
    if (isUnidad) {
      subtitleEl.textContent = "Consulta tus supervisiones";
    } else {
      subtitleEl.textContent = "Consulta supervisiones y evidencias";
    }
  }
  const tabContainer = $("archivosTabsContainer");
  if (tabContainer) {
    if (isUnidad) {
      tabContainer.style.display = "none";
      CURRENT_EVIDENCE_CATEGORY = "Supervision";
      syncEvidenceExplorerTabs();
    } else {
      tabContainer.style.display = "flex";
    }
  }
  const btnOpenUpload = $("btnOpenUpload");
  if (btnOpenUpload) {
    const tooltipText = isMunicipal ? "Cargar Supervisiones" : "Subir archivos";
    btnOpenUpload.setAttribute("title", tooltipText);
    btnOpenUpload.setAttribute("data-tooltip", tooltipText);
  }
}

// Iniciar componentes al cargar
function toggleProfileDropdown() {
  const dropdown = document.getElementById("profileDropdown");
  if (!dropdown) return;


  dropdown.classList.toggle("hidden");
}

function toggleNotifications() {
  const btn = document.getElementById("btnTopNotifications");
  if (btn) btn.click(); // Trigger the existing logic
}

/**
 * 🛸 SYNC COMMAND HUB (Control Flotante Premium)
 */
function syncCommandHub() {
  const hub = document.getElementById("globalCommandHub");
  if (!hub) return;

  const mainPanel = AppState.mainPanel; // CAP, ARCHIVOS, NOTIFS, ADMIN
  const captureTab = AppState.captureTab || "SR";

  const isEditing = (captureTab === "SR" && typeof EDIT_SR !== "undefined" && EDIT_SR) ||
                    (captureTab === "CONS" && typeof EDIT_CONS !== "undefined" && EDIT_CONS) ||
                    (captureTab === "BIO" && typeof EDIT_BIO !== "undefined" && EDIT_BIO);
  const isAlreadySaved = (captureTab === "SR" && typeof HAS_TODAY_SR !== "undefined" && HAS_TODAY_SR) ||
                         (captureTab === "CONS" && typeof HAS_TODAY_CONS !== "undefined" && HAS_TODAY_CONS) ||
                         (captureTab === "BIO" && typeof HAS_SAVED_BIO !== "undefined" && HAS_SAVED_BIO);
  const canEdit = isAlreadySaved && !isEditing;

  // 1. Visibilidad Global (Solo en paneles de captura)
  const isCapture = (mainPanel === "CAP");
  const isUnidad = (typeof USER !== "undefined" && USER?.rol === "UNIDAD");

  if (isCapture && isUnidad) {
    hub.classList.add("visible");
  } else {
    hub.classList.remove("visible");
    return;
  }

  // 2. Mapeo de botones por pestaña
  // Nota: Aunque los eliminamos del HTML, las funciones de JS siguen buscando estos IDs
  // por lo que crearemos referencias virtuales o proxies.
  let realSaveBtn = document.getElementById("btnSave" + captureTab);
  let realEditBtn = document.getElementById("btnEdit" + captureTab);
  let realCancelBtn = document.getElementById("btnCancelEdit" + captureTab);

  if (captureTab === "SR") {
    realSaveBtn = document.getElementById("btnSaveSR");
    realEditBtn = document.getElementById("btnEditSR");
    realCancelBtn = document.getElementById("btnCancelEditSR");
  }

  // 3. Sincronizar visibilidad y estados en el Hub
  const hubEdit = document.getElementById("hubEditBtn");
  const hubCancel = document.getElementById("hubCancelBtn");
  const hubSave = document.getElementById("hubSaveBtn");
  const hubStatus = document.getElementById("hubStatusChip");
  const hubStatusText = document.getElementById("hubStatusText");

  // Gatekeeper Logic
  let isValidDate = true;
  let reasonInvalid = "";

  if (captureTab === "SR") {
    const day = new Date().getDay();
    const isValidSR = (day === 4 || day === 5);
    if (!isValidSR) {
      isValidDate = false;
      reasonInvalid = "El reporte de biológicos solo se puede capturar en jueves o viernes.";
    }
  } else if (captureTab === "CONS") {
    if (!(STATUS && STATUS.canCaptureConsumibles)) {
      isValidDate = false;
      reasonInvalid = "El reporte de consumibles solo se puede capturar en jueves o por apertura extraordinaria.";
    }
  } else if (captureTab === "BIO") {
    if (typeof BIO_STATE !== "undefined" && !BIO_STATE.canCapture) {
      isValidDate = false;
      reasonInvalid = "La ventana de pedidos de biológico se encuentra cerrada.";
    }
  }
  // PINOL: always valid date (no window restriction for solicitudes)

  // Lógica del Status Chip (¿Está guardado hoy?)
  let isSaved = false;
  if (captureTab === "SR") isSaved = !!HAS_TODAY_SR;
  if (captureTab === "CONS") isSaved = !!HAS_TODAY_CONS;
  if (captureTab === "BIO") isSaved = !!HAS_SAVED_BIO;
  if (captureTab === "PINOL") {
    // Pinol state machine: check for pending solicitud from this unit
    try {
      const pinolItems = typeof listPinol === "function" ? (window._pinolCache || []) : [];
      const pending = pinolItems.filter(x => String(x?.estatus || "").toUpperCase() === "PENDIENTE");
      const fulfilled = pinolItems.filter(x => ["ENTREGADO", "RECIBIDO"].includes(String(x?.estatus || "").toUpperCase()));
      if (pending.length > 0) {
        isSaved = true; // Has an active request
      } else if (fulfilled.length > 0) {
        isSaved = true;
      }
    } catch (e) { /* silent */ }
  }

  if (hubStatus && hubStatusText) {
    hubStatus.style.display = "flex";
    if (!isValidDate) {
      hubStatus.className = "status-chip-v5";
      hubStatusText.textContent = "Captura Cerrada";
    } else if (captureTab === "PINOL") {
      // PINOL state machine for status chip
      try {
        if (USER && USER.rol === "UNIDAD") {
          const flowStatus = getPinolFlowStatus();
          if (flowStatus === "PENDING") {
            hubStatus.className = "status-chip-v5 pinol-pending";
            hubStatusText.textContent = "Solicitud en curso";
          } else if (flowStatus === "DELIVERED") {
            hubStatus.className = "status-chip-v5 pinol-delivered";
            hubStatusText.textContent = "Envío realizado";
          } else {
            hubStatus.className = "status-chip-v5";
            hubStatusText.textContent = "Sin solicitud";
          }
        } else {
          const pinolItems = window._pinolCache || [];
          const pending = pinolItems.filter(x => String(x?.estatus || "").toUpperCase() === "PENDIENTE");
          const fulfilled = pinolItems.filter(x => ["ENTREGADO", "RECIBIDO"].includes(String(x?.estatus || "").toUpperCase()));
          if (pending.length > 0) {
            hubStatus.className = "status-chip-v5 pending";
            hubStatusText.textContent = "Solicitudes Pendientes";
          } else if (fulfilled.length > 0) {
            hubStatus.className = "status-chip-v5 saved";
            hubStatusText.textContent = "Atendidas";
          } else {
            hubStatus.className = "status-chip-v5";
            hubStatusText.textContent = "Sin solicitudes";
          }
        }
      } catch (e) {
        hubStatus.className = "status-chip-v5";
        hubStatusText.textContent = "Sin solicitud";
      }
    } else if (isSaved) {
      hubStatus.className = "status-chip-v5 saved";
      hubStatusText.textContent = "Reporte Guardado";
    } else {
      hubStatus.className = "status-chip-v5 pending";
      hubStatusText.textContent = "Pendiente de Captura";
    }
  }

  if (realSaveBtn && hubSave) {
    hubSave.disabled = realSaveBtn.disabled;

    if (realSaveBtn.hasAttribute("data-alert")) hubSave.setAttribute("data-alert", realSaveBtn.getAttribute("data-alert"));
    else hubSave.removeAttribute("data-alert");

    if (realSaveBtn.hasAttribute("data-blocked")) hubSave.setAttribute("data-blocked", realSaveBtn.getAttribute("data-blocked"));
    else hubSave.removeAttribute("data-blocked");

    const saveText = hubSave.querySelector('span:last-child');
    if (saveText) {
      if (isEditing) saveText.textContent = "Actualizar";
      else saveText.textContent = "Guardar";
    }
  }


  if (canEdit && captureTab !== "PINOL") hubEdit.style.display = "flex";
  else hubEdit.style.display = "none";

  if (isEditing && captureTab !== "PINOL") hubCancel.style.display = "flex";
  else hubCancel.style.display = "none";

  if (hubSave) {
    const isSaveDisabled = !isValidDate || hubSave.disabled || (realSaveBtn && realSaveBtn.disabled);
    hubSave.disabled = isSaveDisabled;

    // Remove legacy Tailwind classes and ensure base class
    hubSave.classList.remove("bg-primary", "hover:bg-primary-action", "text-white", "shadow-lg", "shadow-primary/20", "text-slate-600", "opacity-60");
    if (!hubSave.classList.contains("hub-action-btn-primary")) {
      hubSave.classList.add("hub-action-btn-primary");
    }

    if (isSaveDisabled) {
      hubSave.onclick = () => {
        const alertMsg = (realSaveBtn && realSaveBtn.getAttribute("data-alert")) ? "Corrige las alertas antes de guardar" : "No es posible guardar en este momento";
        showToast(alertMsg, false, "warn");
      };
    } else {
      hubSave.onclick = () => realSaveBtn && realSaveBtn.click();
    }

    // Minimalist design: always hide text, show only icon
    hubSave.querySelectorAll("span").forEach(span => {
      if (span.classList.contains("material-symbols-rounded")) {
        span.className = "material-symbols-rounded text-[24px]";
      } else {
        span.className = "hidden";
      }
    });
  }

  if (hubEdit) hubEdit.onclick = () => realEditBtn && realEditBtn.click();
  if (hubCancel) hubCancel.onclick = () => realCancelBtn && realCancelBtn.click();
}

// Hook into existing events
const originalActivateCapture = window.activateCapture;
window.activateCapture = function (tab) {
  if (typeof originalActivateCapture === "function") originalActivateCapture(tab);
  applyPinolFormLock();
  syncCommandHub();
};

const originalActivateMain = window.activateMain;
window.activateMain = function (panel, sub) {
  if (typeof originalActivateMain === "function") originalActivateMain(panel, sub);
  syncCommandHub();
};

// ============================================================================
// DYNAMIC HEADER LIQUID GLASS GENERATOR (Lens Refraction + Frosted Blur)
// ============================================================================
// ============================================================================
// DYNAMIC HEADER LIQUID GLASS GENERATOR (Lens Refraction + Frosted Blur)
// ============================================================================
function initHeaderGlass() {
  let svgContainer = document.getElementById('header-glass-svg-container');
  if (!svgContainer) {
    svgContainer = document.createElement('div');
    svgContainer.id = 'header-glass-svg-container';
    svgContainer.style.width = '0';
    svgContainer.style.height = '0';
    svgContainer.style.position = 'absolute';
    svgContainer.style.overflow = 'hidden';
    document.body.appendChild(svgContainer);
  }

  const items = document.querySelectorAll('.header-liquid-glass');
  let svgDefs = '<svg xmlns="http://www.w3.org/2000/svg"><defs>';

  items.forEach((item, index) => {
    const rect = item.getBoundingClientRect();
    const width = Math.max(10, Math.round(rect.width));
    const height = Math.max(10, Math.round(rect.height));
    const computedStyle = window.getComputedStyle(item);
    let radius = parseInt(computedStyle.borderTopLeftRadius) || 28;

    // Neutral displacement map with a subtle bevel at the edges.
    // #808080 represents 0 displacement.
    // We use an inset shadow-like gradient by using a slightly darker/lighter edge.
    const mapSvg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <radialGradient id="lensGrad-${index}" cx="50%" cy="50%" r="60%">
                    <stop offset="60%" stop-color="#808080"/>
                    <stop offset="100%" stop-color="#404040"/>
                </radialGradient>
            </defs>
            <rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" fill="url(#lensGrad-${index})" />
        </svg>`;

    const encodedMap = btoa(unescape(encodeURIComponent(mapSvg)));
    const dataUri = `data:image/svg+xml;base64,${encodedMap}`;

    // Refraction without chromatic aberration + frosted blur
    svgDefs += `
            <filter id="headerGlassFilter-${index}" x="-20%" y="-20%" width="140%" height="140%">
                <!-- Load the displacement map -->
                <feImage x="0" y="0" width="${width}" height="${height}" result="map" href="${dataUri}"></feImage>
                
                <!-- Displace the background cleanly -->
                <feDisplacementMap in="SourceGraphic" in2="map" xChannelSelector="R" yChannelSelector="G" scale="18" result="refraction" />
                
                <!-- Frosted blur effect (CONTROL DE TRANSPARENCIA / BLUR) -->
                <!-- Cambia el valor de stdDeviation para más o menos blur. Ej: 0.5 (muy transparente), 4.0 (muy borroso) -->
                <feGaussianBlur in="refraction" stdDeviation="1.3" result="frosted" />
                
                <!-- Slight brightness boost -->
                <feComponentTransfer in="frosted">
                    <feFuncR type="linear" slope="1.05"/>
                    <feFuncG type="linear" slope="1.05"/>
                    <feFuncB type="linear" slope="1.05"/>
                </feComponentTransfer>
            </filter>
        `;

    item.style.setProperty('backdrop-filter', `url(#headerGlassFilter-${index})`, 'important');
    item.style.setProperty('-webkit-backdrop-filter', `url(#headerGlassFilter-${index})`, 'important');
  });

  svgDefs += '</defs></svg>';
  svgContainer.innerHTML = svgDefs;
}

window.addEventListener('resize', () => {
  if (window.headerGlassTimeout) clearTimeout(window.headerGlassTimeout);
  window.headerGlassTimeout = setTimeout(initHeaderGlass, 200);
});

// Event Delegation global master
document.addEventListener('click', (e) => {
  // 1. Cierre de modales
  const closeBtn = e.target.closest('.modal-close-btn') || e.target.closest('[data-modal-close]');
  if (closeBtn) {
    const modal = closeBtn.closest('.modal-container') || closeBtn.closest('.modal') || document.querySelector('.modal-open');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('modal-open');
    }
  }

  // 2. Click fuera del modal (cerrar)
  const backdrop = e.target;
  if (backdrop && (backdrop.classList.contains('modal-backdrop') || backdrop.classList.contains('modal-container'))) {
    backdrop.style.display = 'none';
    backdrop.classList.remove('modal-open');
  }

  // 3. Efecto interactivo Ripple
  const rippleBtn = e.target.closest('.btn-ripple') || e.target.closest('button:not(.no-ripple)');
  if (rippleBtn) {
    const rect = rippleBtn.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ripple = document.createElement('span');
    ripple.className = 'ripple-effect';
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    
    rippleBtn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  }
});

/* ==========================================================================
   REAL LIQUID GLASS OPTICAL ENGINE
   ========================================================================== */
const SurfaceEquations = { 
  convex_squircle: (x) => Math.pow(1 - Math.pow(1 - x, 4), 1 / 4) 
};

function calculateDisplacementMap1D(gt, bw, sf, ri, s = 128) { 
  const e = 1 / ri;
  const r = []; 
  for (let i = 0; i < s; i++) { 
    const x = i / s;
    const y = sf(x);
    const dx = x < 1 ? 0.0001 : -0.0001;
    const d = (sf(Math.max(0, Math.min(1, x + dx))) - y) / dx;
    const m = Math.sqrt(d * d + 1);
    const n = [-d / m, -1 / m];
    const dt = n[1];
    const k = 1 - e * e * (1 - dt * dt); 
    
    if (k < 0) {
      r.push(0); 
    } else { 
      const rf = [
        -(e * dt + Math.sqrt(k)) * n[0], 
        e - (e * dt + Math.sqrt(k)) * n[1]
      ]; 
      r.push(rf[0] * ((y * bw + gt) / rf[1])); 
    } 
  } 
  return r; 
}

function calculateDisplacementMap2D(cw, ch, ow, oh, rad, bw, md, pMap) { 
  const img = new ImageData(cw, ch); 
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = 128;
    img.data[i + 1] = 128;
    img.data[i + 3] = 255;
  } 
  const rSq = rad * rad;
  const rp1Sq = (rad + 1) ** 2;
  const rmBwSq = Math.max(0, rad - bw) ** 2;
  const wB = ow - rad * 2;
  const hB = oh - rad * 2;
  const oX = (cw - ow) / 2;
  const oY = (ch - oh) / 2; 

  for (let y1 = 0; y1 < oh; y1++) {
    for (let x1 = 0; x1 < ow; x1++) {
      const idx = ((oY + y1) * cw + oX + x1) * 4;
      const x = x1 < rad ? x1 - rad : x1 >= ow - rad ? x1 - rad - wB : 0;
      const y = y1 < rad ? y1 - rad : y1 >= oh - rad ? y1 - rad - hB : 0;
      const dSq = x * x + y * y; 

      if (dSq <= rp1Sq && dSq >= rmBwSq) {
        const dist = Math.sqrt(dSq);
        const op = dSq < rSq ? 1 : 1 - (dist - rad) / (Math.sqrt(rp1Sq) - rad);
        const bIdx = Math.floor(Math.max(0, Math.min(1, (rad - dist) / bw)) * pMap.length);
        const dVal = pMap[Math.max(0, Math.min(bIdx, pMap.length - 1))] || 0;
        const dX = md > 0 ? (-(dist > 0 ? x / dist : 0) * dVal) / md : 0;
        const dY = md > 0 ? (-(dist > 0 ? y / dist : 0) * dVal) / md : 0; 

        img.data[idx] = Math.max(0, Math.min(255, 128 + dX * 127 * op)); 
        img.data[idx + 1] = Math.max(0, Math.min(255, 128 + dY * 127 * op));
      }
    }
  } 
  return img; 
}

function calculateSpecularHighlight(ow, oh, rad, bw) { 
  const img = new ImageData(ow, oh);
  const sVec = [Math.cos(Math.PI / 3), Math.sin(Math.PI / 3)];
  const rSq = rad * rad;
  const rp1Sq = (rad + 1) ** 2;
  const rmSSq = Math.max(0, (rad - 1.5) ** 2); 

  for (let y1 = 0; y1 < oh; y1++) {
    for (let x1 = 0; x1 < ow; x1++) {
      const x = x1 < rad ? x1 - rad : x1 >= ow - rad ? x1 - rad - (ow - rad * 2) : 0;
      const y = y1 < rad ? y1 - rad : y1 >= oh - rad ? y1 - rad - (oh - rad * 2) : 0;
      const dSq = x * x + y * y; 

      if (dSq <= rp1Sq && dSq >= rmSSq) {
        const dist = Math.sqrt(dSq);
        const op = dSq < rSq ? 1 : 1 - (dist - rad) / (Math.sqrt(rp1Sq) - rad);
        const dp = Math.abs((dist > 0 ? x / dist : 0) * sVec[0] + (dist > 0 ? -y / dist : 0) * sVec[1]);
        const cf = dp * Math.sqrt(1 - (1 - Math.max(0, Math.min(1, (rad - dist) / 1.5))) ** 2);
        const c = Math.min(255, 255 * cf);
        const idx = (y1 * ow + x1) * 4; 

        img.data[idx] = img.data[idx + 1] = img.data[idx + 2] = c; 
        img.data[idx + 3] = Math.min(255, c * cf * op);
      }
    }
  } 
  return img; 
}

function imageDataToDataURL(img) { 
  const c = document.createElement("canvas"); 
  c.width = img.width; 
  c.height = img.height; 
  c.getContext("2d").putImageData(img, 0, 0); 
  return c.toDataURL(); 
}

function updateLiquidGlassMaps(indicatorId, w, h) {
  const radius = Math.floor(h / 2);
  const bezelWidth = 10;
  const glassThickness = 60;
  const refractiveIndex = 1.6;

  const pMap = calculateDisplacementMap1D(glassThickness, bezelWidth, SurfaceEquations.convex_squircle, refractiveIndex);
  const maxDisp = Math.max(...pMap.map(Math.abs));

  let prefix = "";
  if (indicatorId === "unidadTabIndicator") prefix = "unidadTab";
  else if (indicatorId === "captureTabIndicator") prefix = "captureTab";
  else if (indicatorId === "opsTabIndicator") prefix = "opsTab";
  else if (indicatorId === "adminTabIndicator") prefix = "adminTab";
  else return;

  const dispImage = document.getElementById(`${prefix}DisplacementImage`);
  const specImage = document.getElementById(`${prefix}SpecularImage`);
  const dispMap = document.getElementById(`${prefix}DisplacementMap`);

  if (!dispImage || !specImage || !dispMap) return;

  const dispImgData = calculateDisplacementMap2D(w, h, w, h, radius, bezelWidth, maxDisp || 1, pMap);
  const specImgData = calculateSpecularHighlight(w, h, radius, bezelWidth);

  dispImage.setAttribute("href", imageDataToDataURL(dispImgData));
  dispImage.setAttribute("width", w);
  dispImage.setAttribute("height", h);

  specImage.setAttribute("href", imageDataToDataURL(specImgData));
  specImage.setAttribute("width", w);
  specImage.setAttribute("height", h);

  dispMap.setAttribute("scale", (maxDisp * 1.5).toString());
}

// ===== PREMIUM SKELETON HELPERS =====
function getTableSkeletonHtml(rowsCount = 5) {
  let html = "";
  for (let i = 0; i < rowsCount; i++) {
    html += `
      <tr class="border-b border-outline-variant/10">
        <td class="px-6 py-5">
          <div class="skeleton-loader skeleton-text w-24"></div>
          <div class="skeleton-loader skeleton-text w-16 mt-1" style="height: 8px;"></div>
        </td>
        <td class="px-6 py-5">
          <div class="skeleton-loader skeleton-text w-48"></div>
        </td>
        <td class="px-6 py-5">
          <div class="skeleton-loader skeleton-text w-12 h-6" style="border-radius: 9999px;"></div>
        </td>
        <td class="px-6 py-5">
          <div class="flex items-center gap-2">
            <div class="skeleton-loader w-2.5 h-2.5 rounded-full"></div>
            <div class="skeleton-loader skeleton-text w-16" style="margin-bottom: 0;"></div>
          </div>
        </td>
        <td class="px-6 py-5 text-right">
          <div class="flex items-center justify-end gap-1.5 opacity-30">
            <div class="skeleton-loader w-8 h-8 rounded-xl"></div>
            <div class="skeleton-loader w-8 h-8 rounded-xl"></div>
            <div class="skeleton-loader w-8 h-8 rounded-xl"></div>
          </div>
        </td>
      </tr>
    `;
  }
  return html;
}

function getBioSkeletonHtml(count = 5) {
  let html = "";
  for (let i = 0; i < count; i++) {
    html += `
      <div class="bio-card opacity-75">
        <div class="skeleton-loader skeleton-text w-32 h-5"></div>
        <div class="flex justify-center"><div class="skeleton-loader w-20 h-10 rounded-xl"></div></div>
        <div class="flex justify-center"><div class="skeleton-loader w-20 h-10 rounded-xl"></div></div>
        <div class="flex justify-center"><div class="skeleton-loader w-16 h-8 rounded-lg"></div></div>
        <div class="flex justify-center"><div class="skeleton-loader w-16 h-8 rounded-lg"></div></div>
        <div class="flex justify-center"><div class="skeleton-loader w-24 h-8 rounded-lg"></div></div>
      </div>
    `;
  }
  return html;
}

function getPinolSkeletonHtml(count = 4) {
  let html = "";
  for (let i = 0; i < count; i++) {
    html += `
      <tr class="border-b border-outline-variant/10">
        <td class="px-6 py-5"><div class="skeleton-loader skeleton-text w-20"></div></td>
        <td class="px-6 py-5"><div class="skeleton-loader skeleton-text w-24"></div></td>
        <td class="px-6 py-5"><div class="skeleton-loader skeleton-text w-32"></div></td>
        <td class="px-6 py-5"><div class="skeleton-loader skeleton-text w-16"></div></td>
        <td class="px-6 py-5 text-center"><div class="skeleton-loader skeleton-text w-12 mx-auto"></div></td>
        <td class="px-6 py-5 text-center"><div class="skeleton-loader skeleton-text w-12 mx-auto"></div></td>
        <td class="px-6 py-5"><div class="skeleton-loader skeleton-text w-20"></div></td>
        <td class="px-6 py-5 text-right"><div class="skeleton-loader w-8 h-8 rounded-xl ml-auto"></div></td>
      </tr>
    `;
  }
  return html;
}

// ===== COUNTER ANIMATION HELPER =====
function animateCounter(elementId, start, end, duration = 1000) {
  const el = document.getElementById(elementId);
  if (!el) return;
  
  const range = end - start;
  if (range === 0) {
    el.textContent = end;
    return;
  }
  
  let current = start;
  const increment = range > 0 ? 1 : -1;
  const stepTime = Math.abs(Math.floor(duration / range));
  const timer = setInterval(() => {
    current += increment;
    el.textContent = current;
    if (current == end) {
      clearInterval(timer);
    }
  }, Math.max(stepTime, 10));
}

// ===== SUPABASE PASSKEYS (WEBAUTHN BIOMETRICS) =====
async function checkPasskeySupport() {
  if (window.PublicKeyCredential && 
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
    try {
      const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (available) {
        const biometricLoginBtn = document.getElementById("btnBiometricLogin");
        if (biometricLoginBtn) biometricLoginBtn.style.display = "flex";
        
        const passkeyRegContainer = document.getElementById("passkeyRegContainer");
        if (passkeyRegContainer) passkeyRegContainer.style.display = "block";
      }
    } catch (e) {
      console.warn("Error checking biometric auth availability:", e);
    }
  }
}

async function registerPasskey() {
  if (!window.supabase) {
    showToast("Supabase no está disponible", false, "error");
    return;
  }
  showOverlay("Registrando huella / Face ID...", "Seguridad");
  try {
    const { data, error } = await window.supabase.auth.registerPasskey();
    if (error) throw error;
    showToast("Dispositivo biométrico registrado con éxito", true, "good");
  } catch (e) {
    console.error("Passkey registration failed:", e);
    showToast("Error al registrar datos biométricos: " + e.message, false, "bad");
  } finally {
    hideOverlay();
  }
}

async function loginWithPasskey() {
  if (!window.supabase) {
    showToast("Supabase no está disponible", false, "error");
    return;
  }
  showOverlay("Iniciando sesión biométrica...", "Seguridad");
  try {
    const { data, error } = await window.supabase.auth.signInWithPasskey();
    if (error) throw error;

    if (!data.session) throw new Error("No se pudo establecer la sesión.");

    const { data: perfil, error: perfilError } = await window.supabase
      .from('perfiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (perfilError) console.warn("[Auth] Error en perfil:", perfilError);

    TOKEN = data.session.access_token;
    USER = buildUserFromPerfil(data.user.id, data.user.email, perfil);

    await hydrateSessionUi(USER, null, {
      showSuccessToast: true,
      mustChangePassword: !!USER.mustChange
    });
  } catch (e) {
    console.error("Passkey authentication failed:", e);
    showToast("Error de autenticación biométrica: " + e.message, false, "bad");
  } finally {
    hideOverlay();
  }
}


