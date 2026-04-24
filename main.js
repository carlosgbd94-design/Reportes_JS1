// ============================================
// JS1 REPORTES — BACKEND: GOOGLE APPS SCRIPT
// ============================================
// Toda la lógica de datos pasa por doPost() de GAS.
// Firebase ha sido completamente eliminado.

// GAS Bridge URL (Nuevo)
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbyV5NGNP6_6goMa2rRxtIsS9AMp05yIVXR7BkP9DQHsN3aFgls9yKKA5ADVQ3KaPOSGxw/exec";

// SUPABASE CONFIG
const SUPABASE_URL = "https://utclfqjietlxzlorxhrs.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Y2xmcWppZXRseHpsb3J4aHJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTYyNTQsImV4cCI6MjA5MTkzMjI1NH0.EgDK7xkSZHZyUlGF5m2C7bZjrfkx1M8cBXzxIFedDa4";
window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Estado de sesión y UI
let BIO_IS_ENABLED = false;
let CON_IS_ENABLED = false;
let USER = null;
let TOKEN = null;
let UNIT_BATCHES = [];

let BATCH_CATALOG = [];
let BATCH_FILTER = "all"; 
let BATCH_SEARCH_QUERY = "";
let CONFIG_BIOLOGICOS_CATALOG = [];
let FULL_BIO_CATALOG = [];
let CURRENT_WEATHER = { temp: null, emoji: null, code: null };

// Estado reactivo de la UI — debe declararse aquí para que showToast funcione pre-login
const LIVE_STATE = {
  pinolPendientes: null,
  summaryCapturadas: null,
  summaryFaltantes: null,
  todayExistenciaCaptured: null,
  todayConsCaptured: null,
  lastHistoryRows: null,
  summaryKey: null,
  notifCount: 0,
  notifWarnCount: 0,
  notifGoodCount: 0,
  lastToastKey: "",
  lastEventKey: "",
  mutedUntil: 0,
  lastEventTs: 0,
  eventCooldownMs: 2200,
  eventHistory: {},
  pinolWatching: false,
  summaryWatching: false,
  unidadWatching: false,
  historyWatching: false,
  toastMeta: { key: "", ts: 0 }
};

// --- OPTIMIZACIÓN DE API (BATCHING) ---
let API_BATCH_QUEUE = [];
let API_BATCH_TIMER = null;
const CACHEABLE_ACTIONS = {
  "getLotesByMunicipio": 3600000,    // 1 hora
  "unitCatalog": 3600000,            // 1 hora
  "notificationUserCatalog": 3600000 // 1 hora
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
  } catch(e) { console.warn("No se pudo guardar sesión:", e); }
}

function loadSession() {
  try {
    const t = localStorage.getItem("JS1_TOKEN");
    const u = localStorage.getItem("JS1_USER");
    if (t && u) return { token: t, user: JSON.parse(u) };
  } catch(e) {}
  return null;
}

function clearSession() {
  try {
    localStorage.removeItem("JS1_TOKEN");
    localStorage.removeItem("JS1_USER");
  } catch(e) {}
}

// 📌 CONFIGURACIÓN DE ROTACIÓN DE DATOS (FACTS)
let FACTS_TIMER = null;

document.addEventListener("DOMContentLoaded", () => {
    // 🛡️ ARRANQUE ÚNICO (Expert Implementation)
    (async () => {
        showOverlay("Cargando JS1 Reportes…", "Inicializando");
        try {
            initProfileDropdown();
            // whoami verifica la sesión y recupera USER/TOKEN automáticamente
            const u = await whoami();
            if (u) {
                // Una sola llamada de hidratación que agrupará todo en el Batcher
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
        togglePass.textContent = isPass ? "visibility" : "visibility_off";
      });
    }

    if (formLogin) {
        formLogin.addEventListener("submit", async (ev) => {
            ev.preventDefault();
            const email = document.getElementById("usuario").value.trim();
            const password = document.getElementById("password").value.trim();

            if (!email || !password) {
                showToast("Ingresa credenciales", false, "warn");
                return;
            }

            showOverlay("Iniciando sesión...", "Conectando");

            try {
                // Autenticación Nativa Supabase
                const { data, error } = await window.supabase.auth.signInWithPassword({
                    email: email,
                    password: password
                });
                
                if (error) {
                    throw new Error("Credenciales incorrectas.");
                }

                // Extrayendo el Perfil atado por el Trigger SQL
                const { data: perfil, error: perfilError } = await window.supabase
                    .from('perfiles')
                    .select('*')
                    .eq('id', data.user.id)
                    .single();

                if (perfilError) {
                    console.warn("[Auth] No se pudo recuperar perfil extendido:", perfilError);
                }

                if (!data.session) throw new Error("No se pudo establecer la sesión.");
                TOKEN = data.session.access_token;
                USER = buildUserFromPerfil(data.user.id, data.user.email, perfil);

                saveSession(TOKEN, USER);
                await hydrateSessionUi(USER, null, { showSuccessToast: true });
                    
                if (USER?.rol && ["ADMIN", "MUNICIPAL", "JURISDICCIONAL"].includes(USER.rol)) {
                    apiCall("silentAdminReminders").catch(()=>{});
                }
            } catch (error) {
                console.error("Error en login:", error);
                showToast(error.message || "Error al iniciar sesión", false, "bad");
            } finally {
                hideOverlay();
            }
        });
    }

    // 🗓️ ACTUALIZAR AÑO EN FOOTER
    const footerYear = document.getElementById("footerYear");
    if (footerYear) footerYear.textContent = new Date().getFullYear();

    // 📱 LISTENERS DE NAVEGACIÓN MÓVIL (BOTTOM NAV)
    document.querySelectorAll(".nav-item[data-tab]").forEach(btn => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab");
        const panel = tab.replace("tab", "");
        activateMain(panel);
      });
    });

    $("navLogout")?.addEventListener("click", () => {
      $("btnLogout")?.click();
    });
});
  const $ = (id) => document.getElementById(id);
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
    `;

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
    return String(v ?? "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");
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
    window.reloadCaptureSummarySilent = reloadCaptureSummarySilent;
  }

  function assertCriticalFns() {
    const required = [
      "getTodayReports",
      "getCaptureOverview",
      "getHistoryMetrics",
      "loadNotifications",
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

  function startNotificationsAutoRefresh() {
    stopNotificationsAutoRefresh();

    NOTIF_AUTO_REFRESH_TIMER = setInterval(() => {
      const role = String((USER && USER.rol) || "").trim().toUpperCase();

      if (!TOKEN || !USER || !role) return;
      if (document.hidden) return;

      loadNotifications({ silent: true }).catch(err => {
        console.warn("auto notif refresh error:", err);
      });
    }, 45000);
  }

  function stopNotificationsAutoRefresh() {
    if (NOTIF_AUTO_REFRESH_TIMER) {
      clearInterval(NOTIF_AUTO_REFRESH_TIMER);
      NOTIF_AUTO_REFRESH_TIMER = null;
    }
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
        message: `Se solicita realizar la captura correspondiente en JS1 Reportes a la brevedad.\n\nEste aviso forma parte del seguimiento operativo de la Jurisdicción Sanitaria 1.`,
        suggestScope: role === "MUNICIPAL" ? "ALL_MY_UNITS" : "MUNICIPIO"
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
        message: `Se comparte el siguiente aviso operativo mediante JS1 Reportes.\n\nFavor de tomar conocimiento y dar seguimiento en caso necesario.`,
        suggestScope: role === "MUNICIPAL" ? "ALL_MY_UNITS" : "MUNICIPIO"
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
    const isDelivery = (title && title.toLowerCase().includes("entrega")) || message.toLowerCase().includes("entregada");
    
    if (isDelivery) {
      clean = "Pinol entregado:";
    } else {
      clean = title ? `${title}:` : "Notificación:";
    }

    const unidadMatch = message.match(/Unidad:\s*([^.\n]+)/i);
    const unidad = unidadMatch ? unidadMatch[1].trim().split(" CLUES:")[0].split(" Solicitó:")[0] : "";
    
    const fechaMatch = message.match(/Fecha de solicitud:\s*([\d-]+)/i);
    let fechaReq = fechaMatch ? fechaMatch[1] : "";
    if (fechaReq) {
      const d = new Date(fechaReq);
      if (!isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth()+1).padStart(2, '0');
        const yy = String(d.getFullYear()).slice(-2);
        fechaReq = `${dd}-${mm}-${yy}`;
      }
    }

    let html = `<strong style="color:var(--md-sys-color-primary);">${clean}</strong>`;
    if (fechaReq) html += `<div style="margin-top:2px;">Fecha de solicitud: ${fechaReq}</div>`;
    if (unidad) html += `<div>Unidad de salud: ${unidad}</div>`;
    
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
              "notifications"
      );

      const cardClass = [
        "notifCard",
        isRead ? "read" : "unread",
        pinolConfirmed ? "flowClosed" : ""
      ].join(" ").trim();

      return `
      <div class="${cardClass}" data-id="${escapeAttr(item.id || "")}">
        <div class="notifCardContent">
          <div class="notifHeaderRow">
            <div class="notifMainInfo">
              <div class="notifCardTitle">
                ${unreadDot}
                ${escapeHtml(item.title || "Notificación")}
                ${pinolTag}
                ${frascosTag}
              </div>
              <div class="notifMeta">
                ${formatNotifDate(item.created_ts)}
              </div>
            </div>
            
            <div class="notifCompactActions">
              ${showConfirmPinol
                ? `<button type="button" class="notifMiniBtn good" title="Confirmar" onclick="confirmPinolReceiptFlow('${escapeAttr(item.id || "")}')"><span class="material-symbols-rounded">task_alt</span></button>`
                : ``
              }
              ${!showConfirmPinol && !pinolConfirmed && !isPinolAck && !isRead
                ? `<button type="button" class="notifMiniBtn primary" title="Leída" onclick="markNotificationReadFlow('${escapeAttr(item.id || "")}')"><span class="material-symbols-rounded">done</span></button>`
                : ``
              }
              <button type="button" class="notifMiniBtn delete" title="Borrar" onclick="deleteNotificationFlow('${escapeAttr(item.id || "")}')"><span class="material-symbols-rounded">delete</span></button>
            </div>
          </div>
          
          <div class="notifBody snippet">${formatNotifBody(item.title, item.message)}</div>
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

    // Sync state for local logic
    if (typeof LIVE_STATE !== "undefined") {
      LIVE_STATE.notifCount = n;
    }

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

    // Sync state for local logic
    if (typeof LIVE_STATE !== "undefined") {
      LIVE_STATE.notifCount = n;
    }

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
        const items = Array.isArray(data.items) ? data.items : [];
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
        return Object.assign({}, item, { status: "READ" });
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
          status: "READ"
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

  // === CENTRO DE NOTIFICACIONES: LGICA DE ENVIO HIERÁRQUICO ===
  window.initNotificationCenter = async function() {
    const scopeSelect = $("notifTargetScope");
    const roleBadge = $("notifBadgeRole");
    if (!scopeSelect || !USER) return;

    roleBadge.textContent = USER.rol || "PERFIL";
    
    // 1. Poblar alcances permitidos según ROL
    const role = USER.rol?.toUpperCase();
    let options = "";

    if (role === "ADMIN") {
      options = `
        <option value="">Seleccionar alcance...</option>
        <option value="GLOBAL">🌎 Global (Todos)</option>
        <option value="MUNICIPIO">🏙️ Personal Municipal (Staff)</option>
        <option value="CLUES">🏥 Unidad Específica (CLUES)</option>
        <option value="USUARIO">👤 Usuario Específico</option>
      `;
    } else if (role === "JURISDICCIONAL") {
      options = `
        <option value="">Seleccionar alcance...</option>
        <option value="MUNICIPAL_USERS_ALL">👥 Todos los Municipales</option>
        <option value="USUARIO">👤 Usuario Municipal Específico</option>
      `;
    } else if (role === "MUNICIPAL") {
      options = `
        <option value="">Seleccionar alcance...</option>
        <option value="ALL_MY_UNITS">📋 Todas mis Unidades</option>
        <option value="CLUES">🏥 Unidad Específica</option>
      `;
    } else {
      options = `<option value="">Sin permisos de envío</option>`;
      $("btnSendNotification").disabled = true;
      $("btnSendNotification").style.opacity = "0.5";
    }

    scopeSelect.innerHTML = options;

    // 2. Manejar cambios de alcance para mostrar/ocultar selectores extra
    scopeSelect.onchange = async () => {
      const scope = scopeSelect.value;
      $("notifMunicipioBox").style.display = (scope === "MUNICIPIO" || (scope === "CLUES" && role === "ADMIN")) ? "block" : "none";
      $("notifUnidadBox").style.display = (scope === "CLUES") ? "block" : "none";
      $("notifUserBox").style.display = (scope === "USUARIO" || scope === "MUNICIPAL_USER_SPECIFIC") ? "block" : "none";

      // Resetear dropdowns
      if ($("notifTargetMunicipio")) $("notifTargetMunicipio").innerHTML = "<option value=''>Cargando...</option>";
      if ($("notifTargetClues")) $("notifTargetClues").innerHTML = "<option value=''>Cargando...</option>";
      if ($("notifTargetUser")) $("notifTargetUser").innerHTML = "<option value=''>Cargando...</option>";

      // Lógica de carga dinámica
      if (scope === "MUNICIPIO" || (scope === "CLUES" && role === "ADMIN")) {
        await populateMunicipiosNotif();
      } else if (scope === "CLUES" && role === "MUNICIPAL") {
        await populateCluesNotif(USER.municipio);
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
      const unique = [...new Set(data.map(i => i.municipio))];
      select.innerHTML = `<option value="">Seleccionar municipio...</option>` + 
        unique.map(m => `<option value="${escapeAttr(m)}">${escapeHtml(m)}</option>`).join("");
    } catch(e) { select.innerHTML = "<option>Error</option>"; }
  }

  async function populateCluesNotif(mun) {
    const select = $("notifTargetClues");
    if (!select || !mun) return;
    try {
      const { data } = await supabase.from('unidades').select('clues, unidad').eq('municipio', mun).order('unidad');
      select.innerHTML = `<option value="">Seleccionar unidad...</option>` + 
        data.map(u => `<option value="${escapeAttr(u.clues)}">${escapeHtml(u.unidad)}</option>`).join("");
    } catch(e) { select.innerHTML = "<option>Error</option>"; }
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
    } catch(e) { select.innerHTML = "<option>Error</option>"; }
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

      // Auto-completar municipio para el rol MUNICIPAL
      if (USER.rol === "MUNICIPAL") {
        if (scope === "ALL_MY_UNITS") {
           payload.target_scope = "MUNICIPIO_UNITS"; // Nuevo scope interno para diferenciar de MUNICIPIO (Staff)
           payload.target_municipio = USER.municipio;
        } else if (scope === "CLUES") {
           payload.target_municipio = USER.municipio;
        }
      }

      // Jurisdiccional a todos los municipales
      if (USER.rol === "JURISDICCIONAL" && scope === "MUNICIPAL_USERS_ALL") {
         payload.target_scope = "ROLE";
         payload.target_usuario = "MUNICIPAL"; // Usamos target_usuario para el rol destino en este caso especial
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
    const host = refs.host;

    if (!box || !btn || !host) return;

    const hostRect = host.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const boxWidth = box.offsetWidth;
    const hostWidth = host.clientWidth;

    let top = (btnRect.bottom - hostRect.top) + 4;
    let left = (btnRect.right - hostRect.left) - boxWidth;

    if (left < 12) left = 12;

    const maxLeft = Math.max(12, hostWidth - boxWidth - 12);
    if (left > maxLeft) left = maxLeft;

    const availableHeight = Math.max(360, window.innerHeight - btnRect.bottom - 16);

    const nextTop = top + "px";
    const nextLeft = left + "px";
    const nextMaxHeight = availableHeight + "px";

    if (box.style.top !== nextTop) box.style.top = nextTop;
    if (box.style.left !== nextLeft) box.style.left = nextLeft;
    if (box.style.maxHeight !== nextMaxHeight) box.style.maxHeight = nextMaxHeight;

    const card = box.querySelector(".topNotifCard");
    if (card && card.style.maxHeight !== nextMaxHeight) {
      card.style.maxHeight = nextMaxHeight;
    }
  }

  function openTopNotifDropdown() {
    const refs = getTopNotifDropdownRefs();
    const box = refs.box;

    if (!box) return;

    box.style.display = "block";
    box.classList.add("open");

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

    positionTopNotifDropdown();
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

    if (!forceRefresh && cached && Array.isArray(cached)) {
      NOTIF_UNIT_CATALOG = cached;
      return NOTIF_UNIT_CATALOG;
    }

    const res = await apiCall("unitCatalog", {});
    NOTIF_UNIT_CATALOG = Array.isArray(res.data) ? res.data : [];

    writeCache(cacheKey, NOTIF_UNIT_CATALOG);
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
    fillIfEmpty("nombreSR", getUxValue(UX_KEYS.existenciaName));
    fillIfEmpty("nombreCONS", getUxValue(UX_KEYS.consName));
    fillIfEmpty("nombreBIO", getUxValue(UX_KEYS.bioName));
    fillIfEmpty("nombrePINOL", getUxValue(UX_KEYS.pinolName));
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

    UNIT_CATALOG = Array.isArray(data) ? data : [];
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
    const currentPassword = $("pwdCurrent") ? $("pwdCurrent").value.trim() : "";
    const newPassword = $("pwdNew") ? $("pwdNew").value.trim() : "";
    const confirmPassword = $("pwdConfirm") ? $("pwdConfirm").value.trim() : "";
    const email = $("myEmail") ? $("myEmail").value.trim() : "";

    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast("Completa todos los campos de contraseña", false);
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast("La nueva contraseña y la confirmación no coinciden", false);
      return;
    }

    if (!email) {
      showToast("Debes capturar un correo electrónico", false);
      return;
    }

    showOverlay("Estamos actualizando tu contraseña y guardando tu correo…", "Actualizando seguridad");
    closePasswordModal();

    try {
      const r = await apiCall({
        action: "changeMyPassword",
        token: TOKEN,
        currentPassword,
        newPassword,
        confirmPassword
      });

      if (!r || !r.ok) {
        showToast((r && r.error) ? r.error : "No se pudo actualizar la contraseña", false);
        return;
      }

      const rEmail = await apiCall({
        action: "saveMyEmail",
        token: TOKEN,
        email
      });

      if (!rEmail || !rEmail.ok) {
        showToast((rEmail && rEmail.error) ? rEmail.error : "La contraseña cambió, pero no se pudo guardar el correo", false);
        return;
      }

      FORCE_PASSWORD_CHANGE = false;
      window.MUST_CHANGE_PASSWORD = false;

      if (USER) {
        USER.email = email;
      }

      showToast("Contraseña y correo guardados correctamente");
    } catch (e) {
      console.error(e);
      showToast("Error al guardar la información", false);
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

  async function requestPasswordResetFlow() {
    const email = $("forgotUsuario") ? $("forgotUsuario").value.trim() : "";

    if (!email) {
      showToast("Ingresa tu correo institucional", false);
      return;
    }

    // Primero cerramos el modal para que no estorbe la pantalla de carga global
    closeForgotModal();

    // Mostramos la pantalla de carga global del sistema
    showOverlay("Estamos enviando el enlace de recuperación…", "Recuperando acceso");

    try {
      // Usamos el cliente global window.supabase inicializado en main.js
      const { data, error } = await window.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://carlosgbd94-design.github.io/Reportes_JS1/reset.html',
      });

      if (error) {
        showToast(error.message || "No se pudo enviar el enlace", false);
        return;
      }

      showToast("Se envió el enlace de recuperación a tu correo");
    } catch (e) {
      console.error(e);
      showToast("Error al solicitar recuperación", false);
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

  async function apiCall(actionOrPayload, payload = {}, options = {}) {
    const { immediate = false, noCache = false } = options;
    let body = {};
    let action = "";

    if (typeof actionOrPayload === "string") {
      action = actionOrPayload;
      body = Object.assign({}, payload, { action, token: payload.token || TOKEN });
    } else {
      body = Object.assign({}, actionOrPayload, { token: actionOrPayload.token || TOKEN });
      action = body.action;
    }

    // --- ENRUTADO SUPABASE (MIGRACIÓN) ---
    const SUPABASE_ACTIONS = [
      "login", "whoami", "savesr", "saveconsumibles", "savebio", 
      "gettodayreports", "admincaptureoverview", "historymetrics",
      "listmynotifications", "marknotificationread", "deletenotification",
      "biogetform", "biogetdatesformonth", "unitstatus", "unitcatalog", 
      "pinolsolicitud", "listpinol", "markpinoldelivered", "confirmpinolreceipt",
      "sendnotification", "getlotesbymunicipio", "savelotes", "uploadfile", "listfiles",
      "export", "bioexportmatrix", "biogetexportoptions", "admingetunitdetail", "requestpasswordreset",
      "adminlistusers", "admincreateuser", "admintoggleuser", "adminresetpassword", "admindeleteuser", 
      "adminsetbiooverride", "admintogglebioparam", "adminsetconsumiblesoverride", "admingetconsumiblesoverride"
    ];

    if (SUPABASE_ACTIONS.includes(action.toLowerCase())) {
      return supabaseRequest(action.toLowerCase(), body);
    }

    // --- ACCIONES LEGADAS (DRIVE / GAS) ---
    // (Removido uploadfile legacy)

    // --- FALLBACK BATCHING LEGADO ---
    // 1. Verificar Caché (Si no es inmediata o batch)
    if (!noCache && CACHEABLE_ACTIONS[action]) {
      try {
        const cached = localStorage.getItem(`GAS_CACHE_${action}`);
        if (cached) {
          const { data, ts } = JSON.parse(cached);
          if (Date.now() - ts < CACHEABLE_ACTIONS[action]) return { ok: true, data };
        }
      } catch(e) {}
    }

    // 2. Acciones que SIEMPRE son inmediatas
    const CRITICAL = ["unitStatus"];
    if (immediate || CRITICAL.includes(action)) {
      return _rawApiCall(body);
    }

    // 3. Encolar para Batching
    return new Promise((resolve, reject) => {
      API_BATCH_QUEUE.push({ body, resolve, reject });
      if (!API_BATCH_TIMER) {
        API_BATCH_TIMER = setTimeout(_dispatchBatch, 50);
      }
    });
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
  async function supabaseRequest(action, payload) {
    const actionLower = action.toLowerCase();
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
                municipiosAllowed: dataFromDb.municipios_allowed || [],
                clues: dataFromDb.clues,
                unidad: dataFromDb.unidad,
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

           // 1. Obtener catálogo de lotes para autocompletado de caducidad
           const { data: catLotes } = await supabase.from('lotes').select('biologico, lote, caducidad');
           const loteMap = {};
           if (catLotes) {
             catLotes.forEach(l => {
               const key = `${l.biologico.toUpperCase()}:${l.lote.toUpperCase()}`;
               loteMap[key] = l.caducidad;
             });
           }

           // 2. Preparar Matriz Resumen (Wide Table - EXISTENCIA_BIOLOGICOS)
           const summaryRecord = {
             id: btoa(clues + ":" + fecha + ":" + Date.now()),
             timestamp: new Date().toISOString(),
             fecha,
             municipio,
             clues,
             unidad,
             capturado_por: USER.usuario
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
               capturado_por: USER.usuario
             };
           });

           // 4. Ejecutar Inserción Dual en Paralelo
           const [resSummary, resDetail] = await Promise.all([
             supabase.from('biologicos_existencia').insert(summaryRecord),
             supabase.from('existencia_detalle').insert(detailRecords)
           ]);

           if (resSummary.error) throw resSummary.error;
           if (resDetail.error) throw resDetail.error;

           return { ok: true };
        }

        case "saveconsumibles": {
          const record = {
            id: btoa(USER.clues + ":" + (payload.fecha || todayYmdLocal())),
            timestamp: new Date().toISOString(),
            fecha: payload.fecha || todayYmdLocal(),
            municipio: payload.municipio || USER.municipio,
            clues: payload.clues || USER.clues,
            unidad: payload.unidad || USER.unidad,
            srp_dosis: Number(payload.srp_dosis || 0),
            sr_dosis: Number(payload.sr_dosis || 0),
            jeringa_reconst_5ml_0605500438: Number(payload.jeringa_reconst_5ml_0605500438 || 0),
            jeringa_aplic_05ml_0605502657: Number(payload.jeringa_aplic_05ml_0605502657 || 0),
            aguja_0600403711: Number(payload.aguja_0600403711 || payload.aguja_06004037 || 0),
            capturado_por: USER.usuario,
            editado: payload.editado || 'NO'
          };

          const { error } = await supabase.from('consumibles').insert(record);
          if (error) throw error;
          return { ok: true };
        }

        case "savebio": {
          const items = payload.items || [];
          const records = items.map(it => ({
            id: btoa(USER.clues + ":" + it.biologico + ":" + Date.now()),
            timestamp: new Date().toISOString(),
            fecha_captura: payload.fecha || todayYmdLocal(),
            fecha_pedido_programada: payload.fechaPedidoProgramada || todayYmdLocal(),
            municipio: payload.municipio || USER.municipio,
            clues: payload.clues || USER.clues,
            unidad: payload.unidad || USER.unidad,
            biologico: it.biologico,
            max_dosis: Number(it.max_dosis || 0),
            min_dosis: Number(it.min_dosis || 0),
            promedio_frascos: Number(it.promedio_frascos || 0),
            multiplo: Number(it.multiplo || 1),
            existencia: Number(it.existencia_actual_frascos || 0),
            solicitud: Number(it.pedido_frascos || 0),
            observaciones: it.observaciones || "",
            usuario: USER.usuario,
            capturado_por: USER.usuario
          }));

          const { error } = await supabase.from('biologicos_pedido').insert(records);
          if (error) throw error;
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
          const role = String(USER?.rol || "").toUpperCase();
          const clues = String(USER?.clues || "").trim();
          const municipio = String(USER?.municipio || "").trim();
          const usuario = String(USER?.usuario || "").trim();

          let query = supabase.from('notificaciones')
            .select('*')
            .order('created_ts', { ascending: false })
            .limit(50);

          if (role === 'UNIDAD') {
            // UNIDADES: Solo ven Global, lo dirigido a su CLUES específica, o a su Municipio (como grupo de UNIDADES).
            const filters = ['target_scope.eq.GLOBAL'];
            if (clues)     filters.push(`and(target_scope.eq.CLUES,target_clues.eq."${clues}")`);
            if (municipio) filters.push(`and(target_scope.eq.MUNICIPIO_UNITS,target_municipio.eq."${municipio}")`);
            if (usuario)   filters.push(`and(target_scope.eq.USUARIO,target_usuario.eq."${usuario}")`);
            query = query.or(filters.join(','));
          } 
          else if (role === 'MUNICIPAL') {
            // MUNICIPAL: Ve Global, lo dirigido a su Municipio (Staff), lo dirigido a su ROL, o a su Usuario.
            const filters = ['target_scope.eq.GLOBAL'];
            filters.push('and(target_scope.eq.ROLE,target_usuario.eq.MUNICIPAL)');
            if (municipio) filters.push(`and(target_scope.eq.MUNICIPIO,target_municipio.eq."${municipio}")`);
            if (usuario)   filters.push(`and(target_scope.eq.USUARIO,target_usuario.eq."${usuario}")`);
            query = query.or(filters.join(','));
          }
          else if (role === 'JURISDICCIONAL') {
            // JURISDICCIONAL: Ve Global o dirigido a su Usuario.
            const filters = ['target_scope.eq.GLOBAL'];
            if (usuario)   filters.push(`and(target_scope.eq.USUARIO,target_usuario.eq."${usuario}")`);
            query = query.or(filters.join(','));
          }
          else if (role === 'ADMIN') {
             // ADMIN: Ve todo (Global y cualquier otro que haya sido enviado o sea relevante)
             // Para que el Admin pueda auditar el sistema
             const filters = ['target_scope.eq.GLOBAL', 'target_scope.eq.MUNICIPIO', 'target_scope.eq.CLUES', 'target_scope.eq.USUARIO', 'target_scope.eq.MUNICIPIO_UNITS', 'target_scope.eq.ROLE'];
             query = query.or(filters.join(','));
          }

          const { data, error } = await query;
          if (error) throw error;

          // Calcular unread localmente del set devuelto o con otra query si es necesario
          // Por simplicidad y performance, calculamos sobre el set de los últimos 50
          const unreadCount = (data || []).filter(n => String(n.is_read).toUpperCase() === 'NO').length;

          console.log(`[Supabase DEBUG] listMyNotifications for ${role}:`, { items: data?.length, unread: unreadCount });

          // IMPORTANTE: Mapeo compatible con loadNotifications() en main.js:1118
          return { 
            ok: true, 
            data: { 
              items: data || [], 
              unread: unreadCount 
            } 
          };
        }

        case "biogetform": {
          const role = String(USER?.rol || "").toUpperCase();
          const clues = String(USER?.clues || "").trim();

          // 🛡️ Filtro Crítico: Solo traer parámetros de la unidad actual y que estén activos
          // Si no hay CLUES (caso raro en Admin), intentamos traer un set global (*)
          let query = supabase.from('biologicos_params')
            .select('*')
            .eq('activo', 'SI');
          
          if (clues) {
            query = query.ilike('clues', clues);
          } else {
            query = query.eq('clues', '*');
          }

          console.log(`[Supabase DEBUG] biogetform for ${clues} (Role: ${role})`);

          const [resParams, resSaved, resCalendar] = await Promise.all([
            query,
            supabase.from('biologicos_pedido').select('*').ilike('clues', clues).eq('fecha_captura', todayYmdLocal()),
            supabase.from('calendario_pedidos').select('*').eq('anio_mes', todayYmdLocal().substring(0, 7)).eq('activo', 'SI')
          ]);

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

          return {
            ok: true,
            data: {
              rows: (resParams.data || []).map(p => ({
                biologico: p.biologico,
                multiplo: p.multiplo,
                min_dosis: p.min_dosis,
                max_dosis: p.max_dosis,
                promedio_frascos: p.promedio_frascos,
                existencia_actual_frascos: null,
                pedido_frascos: null
              })),
              hasSavedBio: resSaved.data && resSaved.data.length > 0,
              isCaptureDay: isCaptureDayLocal,
              fechaPedidoProgramada: windowTargetYmd,
              captureWindowStart: windowStartYmd,
              captureWindowEnd: windowEndYmd,
              windowSource: windowSource
            }
          };
        }

        case "admincaptureoverview": {
          const { fecha, tipo } = payload;
          
          let consDates = [fecha];
          if (tipo === "CONS") {
            const d = new Date(`${fecha}T12:00:00`);
            if (d.getDay() === 4) { // Jueves
              const ayer = new Date(d);
              ayer.setDate(d.getDate() - 1);
              if (isMexicanHoliday(d)) {
                 consDates.push(dateToLocalYmd(ayer));
              }
            }
          }

          // 🛡️ Logística de Ventanas: Traemos también el calendario por si hay apertura manual
          const currentMonth = fecha.substring(0, 7); // YYYY-MM

          const [resSR, resCons, resBio, resUnits, resCalendar] = await Promise.all([
            supabase.from('biologicos_existencia').select('clues').eq('fecha', fecha),
            supabase.from('consumibles').select('clues').in('fecha', consDates),
            supabase.from('biologicos_pedido').select('clues').eq('fecha_captura', fecha),
            supabase.from('unidades').select('*').eq('activo', 'SI'),
            supabase.from('calendario_pedidos').select('*').eq('anio_mes', currentMonth).eq('activo', 'SI').maybeSingle()
          ]);

          let capturedClues = [];
          if (tipo === "SR") capturedClues = [...new Set((resSR.data || []).map(x => x.clues || x.CLUES))];
          else if (tipo === "CONS") capturedClues = [...new Set((resCons.data || []).map(x => x.clues || x.CLUES))];
          else if (tipo === "BIO") {
            capturedClues = [...new Set((resBio.data || []).map(x => x.clues || x.CLUES))];
          }

          const allUnits = resUnits.data || [];
          const capturadas = allUnits.filter(u => capturedClues.includes(u.clues || u.CLUES));
          const faltantes = allUnits.filter(u => !capturedClues.includes(u.clues || u.CLUES));

          return {
            ok: true,
            data: {
              fecha,
              tipo,
              total_unidades: allUnits.length,
              total_capturadas: capturadas.length,
              total_faltantes: faltantes.length,
              calendar_override: resCalendar.data || null,
              capturadas: capturadas.map(u => {
                let metadata = { municipio: u.municipio || u.MUNICIPIO, clues: u.clues || u.CLUES, unidad: u.unidad || u.UNIDAD, capturo: "SI", estatus: "OK" };
                if (tipo === "BIO") {
                  const record = (resBio.data || []).find(r => r.clues === (u.clues || u.CLUES));
                  metadata.tipo_pedido = record?.tipo_pedido || "MENSUAL";
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
          const fechaInicio = payload.fechaInicio || payload.inicio;
          const fechaFin = payload.fechaFin || payload.fin;

          if (!fechaInicio || fechaInicio === "undefined" || !fechaFin || fechaFin === "undefined") {
             return { ok: true, data: { rows: [] } };
          }

          // 1. Consultas paralelas
          const [resBio, resCons, resUnits] = await Promise.all([
            supabase.from('biologicos_existencia').select('clues, fecha').gte('fecha', fechaInicio).lte('fecha', fechaFin),
            supabase.from('consumibles').select('clues, fecha').gte('fecha', fechaInicio).lte('fecha', fechaFin),
            supabase.from('unidades').select('*').eq('activo', 'SI')
          ]);

          const rawBio = resBio.data || [];
          const rawCons = resCons.data || [];
          const units = resUnits.data || [];

          // 2. Calcular días esperados (Logística Senior)
          const getExpectedDates = (start, end, tipo) => {
            const dates = [];
            let curr = new Date(start + "T12:00:00");
            const stop = new Date(end + "T12:00:00");
            
            while (curr <= stop) {
              const dow = curr.getDay();
              const ymd = dateToLocalYmd(curr);
              
              if (tipo === "CONS") {
                // Jueves es el día estándar
                if (dow === 4) dates.push(ymd);
              } else {
                // Biológicos: Viernes es el día de corte semanal (o el que se decida)
                // Según LOGICA_SISTEMA es diaria, pero para métricas históricas se suele medir por semana.
                // Si el usuario no especificó cambio en métricas de BIO, mantenemos Viernes (Día 5).
                if (dow === 5) dates.push(ymd);
              }
              curr.setDate(curr.getDate() + 1);
            }
            return dates;
          };

          const expectedDatesCons = getExpectedDates(fechaInicio, fechaFin, "CONS");
          const expectedDatesBio = getExpectedDates(fechaInicio, fechaFin, "BIO");

          // 3. Agrupar capturas por unidad y ventana
          const metricsMap = {};
          units.forEach(u => {
            metricsMap[u.clues] = {
              municipio: u.municipio || u.MUNICIPIO,
              clues: u.clues || u.CLUES,
              unidad: u.unidad || u.UNIDAD,
              bio_capturas: 0,
              cons_capturas: 0,
              ultima_cons: "—"
            };
          });

          // Consumibles: Una captura por cada ventana esperada
          expectedDatesCons.forEach(targetJueves => {
            const dJue = new Date(`${targetJueves}T12:00:00`);
            const targetWindow = [targetJueves];
            
            // Si el jueves es festivo, permitimos también el miércoles
            if (isMexicanHoliday(dJue)) {
               const dMie = new Date(dJue);
               dMie.setDate(dJue.getDate() - 1);
               targetWindow.push(dateToLocalYmd(dMie));
            }

            units.forEach(u => {
              const hasCapture = rawCons.some(r => r.clues === u.clues && targetWindow.includes(r.fecha));
              if (hasCapture) metricsMap[u.clues].cons_capturas++;
            });
          });

          // Biológicos: Seguimos lógica similar por Viernes
          expectedDatesBio.forEach(targetViernes => {
            units.forEach(u => {
              const hasCapture = rawBio.some(r => r.clues === u.clues && r.fecha === targetViernes);
              if (hasCapture) metricsMap[u.clues].bio_capturas++;
            });
          });

          // Última fecha de consumibles para visualización
          rawCons.forEach(r => {
            if (metricsMap[r.clues]) {
               if (metricsMap[r.clues].ultima_cons === "—" || r.fecha > metricsMap[r.clues].ultima_cons) {
                 metricsMap[r.clues].ultima_cons = r.fecha;
               }
            }
          });

          // 4. Calcular % final
          const rows = units.map(u => {
            const m = metricsMap[u.clues];
            const eBio = expectedDatesBio.length;
            const eCons = expectedDatesCons.length;
            
            const bPct = eBio > 0 ? Math.round((m.bio_capturas / eBio) * 100) : 100;
            const cPct = eCons > 0 ? Math.round((m.cons_capturas / eCons) * 100) : 100;
            const operPct = Math.round((bPct + cPct) / 2);

            return {
              ...m,
              bio_cumplimiento: Math.min(bPct, 100),
              cons_cumplimiento: Math.min(cPct, 100),
              cumplimiento_operativo: Math.min(operPct, 100),
              bio_faltas: Math.max(0, eBio - m.bio_capturas),
              cons_faltas: Math.max(0, eCons - m.cons_capturas),
              total_capturado: m.bio_capturas + m.cons_capturas,
              total_faltas: Math.max(0, (eBio + eCons) - (m.bio_capturas + m.cons_capturas))
            };
          });

          return { ok: true, data: { rows, expectedBio: expectedDatesBio.length, expectedCons: expectedDatesCons.length } };
        }

        case "unitstatus": {
          const today = todayYmdLocal();
          const clues = USER.clues;
          
          // 1. Verificar Apertura Manual (Consumibles)
          const { data: consOverride, error: consErr } = await supabase
            .from('aperturas_consumibles')
            .select('*')
            .eq('fecha', today)
            .eq('activo', 'SI')
            .maybeSingle();
          
          if (consErr) console.warn("[Supabase] Fallo al consultar aperturas_consumibles (posiblemente tabla inexistente):", consErr);

          // 2. Verificar Apertura Manual (Biológicos - Calendario Pedidos)
          // (Este usa el mes actual y busca si hoy cae en ventana habilitada)
          const currentMonth = today.substring(0, 7); // YYYY-MM
          const { data: bioOverride } = await supabase
            .from('calendario_pedidos')
            .select('*')
            .eq('anio_mes', currentMonth)
            .eq('activo', 'SI')
            .maybeSingle();

          // 3. Lógica Inteligente (Días festivos / Fines de semana)
          const consIntelligent = await getConsumiblesStatus(today, clues);
          
          // Bio pedidos: Jueves y Viernes por estándar
          const dow = new Date().getDay();
          const canCaptureExistenciaBioStandard = (dow === 4 || dow === 5);
          
          // Pedido mensual (Ventana inteligente)
          const bioWindow = calculateBioIntelligentWindow(new Date().getFullYear(), new Date().getMonth());
          const isBioWindowOpen = today >= dateToLocalYmd(bioWindow.start) && today <= dateToLocalYmd(bioWindow.end);

          // 4. Consolidar Respuestas
          let canCons = consIntelligent.canCaptureConsumibles;
          let consReason = consIntelligent.consumiblesReason || "Disponible solo jueves";
          
          if (consOverride) {
            canCons = true;
            consReason = consOverride.motivo || "Apertura extraordinaria habilitada por Administrador";
          }

          let canBio = canCaptureExistenciaBioStandard || isBioWindowOpen;
          let bioReason = isBioWindowOpen ? "Ventana de pedido mensual abierta" : (canCaptureExistenciaBioStandard ? "Día operativo (Jueves/Viernes)" : "Disponible jueves y viernes");

          if (bioOverride) {
            const isTodayInBioWindow = today >= bioOverride.habilitar_desde && today <= bioOverride.habilitar_hasta;
            if (isTodayInBioWindow) {
              canBio = true;
              bioReason = bioOverride.motivo || "Apertura extraordinaria habilitada por Administrador";
            }
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
              isExtraordinary: !!(consOverride || (bioOverride && today >= bioOverride.habilitar_desde && today <= bioOverride.habilitar_hasta))
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

        case "unitcatalog": {
          const { data, error } = await supabase.from('unidades').select('*').eq('activo', 'SI');
          if (error) throw error;
          return { ok: true, data };
        }

        case "biogetexportoptions": {
          const { data, error } = await supabase.from('unidades').select('municipio');
          if (error) throw error;
          const uniqueMunis = [...new Set(data.map(u => u.municipio))].sort();
          return { ok: true, data: { municipios: uniqueMunis } };
        }

        case "export": {
          const tipo = (payload.tipo || "SR").toUpperCase();
          const table = tipo === "SR" ? "biologicos_existencia" : "consumibles";
          let query = supabase
            .from(table)
            .select('*')
            .gte('fecha', payload.fechaInicio)
            .lte('fecha', payload.fechaFin);

          const { data, error } = await query;
          if (error) throw error;
          
          const municipios = payload.municipios || [];
          const filtered = municipios.length > 0
            ? data.filter(d => municipios.includes(d.unidades?.municipio || d.municipio))
            : data;

          return { ok: true, data: filtered };
        }

        case "bioexportmatrix": {
          let query = supabase
            .from('biologicos_pedido')
            .select('*');
          
          if (payload.fechaInicio) {
             query = query.eq('fecha_objetivo', payload.fechaInicio);
          }

          const { data, error } = await query;
          if (error) throw error;

          const municipios = payload.municipios || [];
          const filtered = municipios.length > 0
            ? data.filter(d => municipios.includes(d.unidades?.municipio || d.municipio))
            : data;

          return { ok: true, data: filtered };
        }

        case "listpinol": {
          let query = supabase
            .from('pinol_solicitudes')
            .select('*')
            .order('timestamp_solicitud', { ascending: false });

          if (USER.rol === 'UNIDAD') {
            query = query.eq('clues', USER.clues);
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
            fecha_entrega: d.editado_ts,
            entregado_por: d.editado_por,
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
            capturado_por: USER.usuario
          };
          const { error } = await supabase.from('pinol_solicitudes').insert(record);
          if (error) throw error;
          return { ok: true };
        }

        case "confirmpinolreceipt": {
          // El payload usa notification_id por compatibilidad heredada
          const { data: notif } = await supabase.from('notificaciones').select('*').eq('id', payload.notification_id).single();
          if (!notif) throw new Error("Notificación no encontrada");

          const meta = JSON.parse(notif.meta_json || "{}");
          const pinolId = meta.pinol_id;

          // 1. Marcar notificación como leída y confirmada
          meta.confirmed_by_unit = "SI";
          meta.confirmation_ts = new Date().toISOString();

          const { error: notifError } = await supabase
            .from('notificaciones')
            .update({ 
               meta_json: JSON.stringify(meta),
               is_read: 'SI',
               read_ts: new Date().toISOString()
            })
            .eq('id', payload.notification_id);
          
          if (notifError) throw notifError;

          // 2. Marcar solicitud de Pinol como RECIBIDA
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
          const record = {
            id: btoa(USER.usuario + ":" + Date.now()),
            created_ts: new Date().toISOString(),
            created_date: todayYmdLocal(),
            from_usuario: USER.usuario,
            from_rol: USER.rol,
            target_scope: payload.scope || "GLOBAL",
            target_municipio: payload.municipio || null,
            target_clues: payload.clues || null,
            target_usuario: payload.usuario_destino || null,
            title: payload.title || "Notificación",
            message: payload.message || "",
            is_read: 'NO'
          };
          const { error } = await supabase.from('notificaciones').insert(record);
          if (error) throw error;
          return { ok: true };
        }

        case "marknotificationread": {
          const { error } = await supabase
            .from('notificaciones')
            .update({ is_read: 'SI', read_ts: new Date().toISOString() })
            .eq('id', payload.id);
          if (error) throw error;
          return { ok: true };
        }

        case "deletenotification": {
          const { error } = await supabase
            .from('notificaciones')
            .delete()
            .eq('id', payload.id);
          if (error) throw error;
          return { ok: true };
        }

        case "admingetunitdetail": {
          const targetFecha = payload.fecha || todayYmdLocal();
          const tipo = (payload.tipo || "SR").toUpperCase();
          
          if (tipo === "SR") {
            const { data, error } = await window.supabase
              .from('existencia_detalle')
              .select('*')
              .eq('clues', payload.clues)
              .eq('fecha', targetFecha)
              .order('biologico', { ascending: true });
            if (error) throw error;
            return { ok: true, data: data || [], meta: { fecha: targetFecha, tipo } };
          } else {
            const { data, error } = await window.supabase
              .from('consumibles')
              .select('*')
              .eq('clues', payload.clues)
              .eq('fecha', targetFecha)
              .limit(1);
            if (error) throw error;
            return { ok: true, data: data || [], meta: { fecha: targetFecha, tipo } };
          }
        }

        case "adminlistusers": {
          const { data, error } = await supabase
            .from('usuarios_legacy')
            .select('*')
            .order('usuario', { ascending: true });
          if (error) throw error;
          return { ok: true, data: data || [] };
        }

        case "admincreateuser": {
          const inputHash = await hashPassword(payload.password);
          const record = {
            usuario: payload.usuario,
            password: inputHash,
            municipio: payload.municipio,
            clues: payload.clues,
            unidad: payload.unidad,
            rol: payload.rol,
            activo: 'SI'
          };
          const { error } = await supabase.from('usuarios_legacy').insert(record);
          if (error) throw error;
          return { ok: true };
        }

        case "uploadfile": {
          const file = payload.file;
          const { category, targetClues, targetUnidad } = payload;
          
          // Mapear categoría a TIPO para la nomenclatura oficial
          let tipo = "REPORTE";
          const catUpper = category.toUpperCase();
          if (catUpper.includes("CAPACITACI")) tipo = "CAPACITACIÓN";
          else if (catUpper.includes("CAMPA")) tipo = "CAMPAÑA";
          else if (catUpper.includes("SUPERVISI")) tipo = "SUPERVISIÓN";

          // Formatter para la fecha: YYYY-MM-DD
          const now = new Date();
          const yyyy = now.getFullYear();
          const mm = String(now.getMonth() + 1).padStart(2, '0');
          const dd = String(now.getDate()).padStart(2, '0');
          const dateSlug = `${yyyy}-${mm}-${dd}`;

          // Nomenclatura oficial: YYYY-MM-DD-EVIDENCIA-TIPO-CLUES_UNIDAD.ext
          const extension = file.name.split('.').pop();
          const cleanUnidad = normalizePath(targetUnidad).replace(/[\s\/]/g, '_');
          const officialName = `${dateSlug}-EVIDENCIA-${tipo}-${targetClues}_${cleanUnidad}.${extension}`;
          
          // Ruta final: Categoria / CLUES_Unidad / Nombre_Oficial
          const folderPath = `${cleanCat}/${targetClues}_${cleanUnidad}/${officialName}`;
          
          const { error } = await supabase.storage.from('evidencias').upload(folderPath, file, {
            cacheControl: '3600',
            upsert: true
          });
          if (error) throw error;
          return { ok: true, data: { path: folderPath } };
        }

        case "listfiles": {
          const { data: filesData, error: filesErr } = await supabase.rpc('get_evidences_list');
          if (filesErr) throw filesErr;
          return { ok: true, data: filesData || [] };
        }

        case "adminresetpassword": {
          const inputHash = await hashPassword(payload.newPassword);
          const { error } = await supabase
            .from('usuarios_legacy')
            .update({ password: inputHash })
            .eq('usuario', payload.usuario);
          if (error) throw error;
          return { ok: true };
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
               editado: 'SI', 
               editado_por: USER.usuario,
               editado_ts: new Date().toISOString()
            })
            .eq('id', payload.id);

          if (updateError) throw updateError;

          // Crear notificación para la unidad
          const { data: sol } = await supabase.from('pinol_solicitudes').select('*').eq('id', payload.id).single();
          if (sol) {
            await supabase.from('notificaciones').insert({
              id: 'NOTIF:' + btoa(sol.clues + ":" + Date.now()),
              created_ts: new Date().toISOString(),
              created_date: todayYmdLocal(),
              from_usuario: USER.usuario,
              from_rol: USER.rol,
              target_scope: 'CLUES',
              target_clues: sol.clues,
              title: 'Pinol entregado',
              message: payload.comentario_notificacion || 'Tu solicitud de pinol ha sido marcada como entregada.',
              is_read: 'NO',
              meta_json: JSON.stringify({ source: 'PINOL', event: 'PINOL_ENTREGADO', pinol_id: sol.id })
            });
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
          
          // Buscamos capturas reales en biologicos_pedido para este mes
          const start = `${year}-${month.padStart(2, '0')}-01`;
          const end = `${year}-${month.padStart(2, '0')}-31`;

          const { data, error } = await supabase
            .from('biologicos_pedido')
            .select('fecha_captura, fecha_pedido_programada')
            .gte('fecha_captura', start)
            .lte('fecha_captura', end);
            
          if (error) throw error;
          
          // Formatear fechas únicas y detectar tipo
          const uniqueDates = Array.from(new Set((data || []).map(d => d.fecha_captura))).sort();
          const targetBioWindow = calculateBioIntelligentWindow(parseInt(year), parseInt(month) - 1);
          const windowStartYmd = dateToLocalYmd(targetBioWindow.start);
          const windowEndYmd = dateToLocalYmd(targetBioWindow.end);

          const result = uniqueDates.map(d => {
            const isMensual = d >= windowStartYmd && d <= windowEndYmd;
            return {
              date: d,
              type: isMensual ? "MENSUAL" : "EXTRAORDINARIO"
            };
          });

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
            .in('clues', cluesList);
          
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
            redirectTo: 'https://carlosgbd94-design.github.io/Reportes_JS1/reset.html'
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

  async function _rawApiCall(body) {
    const action = body.action;
    try {
      const res = await fetch(GAS_API_URL, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "text/plain;charset=utf-8" }
      });

      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        console.error("Respuesta inválida:", text);
        return { ok: false, error: "Error en formato de respuesta." };
      }

      // Guardar en caché si aplica
      if (json.ok && CACHEABLE_ACTIONS[action]) {
        try {
          localStorage.setItem(`GAS_CACHE_${action}`, JSON.stringify({ data: json.data, ts: Date.now() }));
        } catch(e) {}
      }

      return json;
    } catch (err) {
      console.error(`Error en _rawApiCall (${action}):`, err);
      return { ok: false, error: "Error de conexión: " + err.message };
    }
  }


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

  const CACHE_TTL = {
    TODAY_REPORTS: 1000 * 60 * 1,        // 1 min
    CAPTURE_OVERVIEW: 1000 * 60 * 2,     // 2 min
    HISTORY_METRICS: 1000 * 60 * 3,      // 3 min
    UNIT_CATALOG: 1000 * 60 * 30,        // 30 min
    PINOL_LIST: 1000 * 30                // 30 seg
  };

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
    const histInicio = $("histFechaInicio")?.value || todayYmdLocal();
    const histFin = $("histFechaFin")?.value || todayYmdLocal();

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
        getHistoryMetrics(histInicio, histFin, false).catch((e) => {
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

    const fallbackA = "https://raw.githubusercontent.com/carlosgbd94-design/Logos/main/Seseq_vertical_2025.png";
    const fallbackB = "https://raw.githubusercontent.com/carlosgbd94-design/Logos/main/logo_Q.png";

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

    if ($("btnSaveMyPassword")) {
      $("btnSaveMyPassword").onclick = () => saveMyPasswordFlow();
    }

    if ($("btnPwdClose")) {
      $("btnPwdClose").onclick = () => closePasswordModal();
    }
  }

  function bindHistoryUiEvents() {
    $("btnRefreshEditLog")?.addEventListener("click", () => refreshEditLog());
    $("editLogFecha")?.addEventListener("change", () => debouncedReloadHistory());
    $("editLogTipo")?.addEventListener("change", () => debouncedReloadHistory());
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

    $("btnLogout")?.addEventListener("click", () => {
      showOverlay("Cerrando sesión...", "Desconectando");
      stopNotificationsAutoRefresh();
      clearSessionCaches();
      resetOpsPrewarmFlags();
      USER = null;
      TOKEN = null;
      clearSession();
      if ($("mobileBottomNav")) $("mobileBottomNav").style.display = "none";
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

    $("histFechaInicio")?.addEventListener("change", () => {
      OPS_PREWARM_DONE.history = false;
      resetPanelFilterState("historyMetrics");
      debouncedReloadHistory();
    });

    $("histFechaFin")?.addEventListener("change", () => {
      OPS_PREWARM_DONE.history = false;
      resetPanelFilterState("historyMetrics");
      debouncedReloadHistory();
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

  const debouncedRefreshEditLog = debounce(() => {
    refreshEditLog();
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
    const inicio = $("histFechaInicio")?.value || todayYmdLocal();
    const fin = $("histFechaFin")?.value || todayYmdLocal();
    return `${inicio}__${fin}`;
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
    bindHistoryUiEvents();
    bindLiveFeedUiEvents();
    bindToastUiEvents();
    bindNavigationUiEvents();
    bindNotificationsUiEvents();
    bindSummaryUiEvents();
    bindMetricsUiEvents();
    bindCaptureUtilityEvents();
    runBootUiSetup();

    syncAppState({
      isMobile: document.body.classList.contains("mobile-mode"),
      isLowPerf: document.body.classList.contains("lowperf"),
      initialized: true
    });
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

  BATCH_CATALOG = []; // Catálogo completo (ADMIN)
  UNIT_BATCHES = [];  // Catálogo filtrado por municipio (UNIDAD)

  async function hydrateSessionUi(user, status, opts = {}) {
    exposeAppFns();
    assertCriticalFns();

    const {
      showSuccessToast = false,
      mustChangePassword = false
    } = opts;

    setLoggedInUI(user, status);
    window.MUST_CHANGE_PASSWORD = !!mustChangePassword;

    if (window.MUST_CHANGE_PASSWORD && typeof openPasswordModal === "function") {
      showToast("Debes cambiar tu contraseña para continuar", true, "warn");
      openPasswordModal(true);
    }

    // ✅ OPTIMIZACIÓN: Carga concurrente y agrupada
    // Al usar apiCall para múltiples cosas aquí, el API_BATCH_TIMER las agrupará en UN solo POST
    try {
      // ? Visibilidad de pestañas por Rol
      const isOps = user?.rol && ["ADMIN", "MUNICIPAL", "JURISDICCIONAL"].includes(user.rol);
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
        const userMuni = normalizeTextKey_(user.municipio);
        UNIT_BATCHES = allLotes.filter(l => {
            const loteMuni = normalizeTextKey_(l.municipio);
            return loteMuni === "*" || loteMuni === userMuni || loteMuni === "TODOS";
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

  function parseInputToMmmAa(str) {
    if (!str) return "";
    const s = str.trim().toUpperCase();
    
    // Si ya tiene el formato correcto ENE-25
    if (/^[A-Z]{3}-\d{2}$/.test(s)) return s;

    // Intentar detectar formatos comunes: 28/06/26, 28-06-26, 2026-06-28
    let d = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      d = new Date(s + "T00:00:00");
    } else {
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
      const months = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
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
      const months = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
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
        e.target.value = parseInputToMmmAa(val);
      }
    }
  }, true);


  async function activateLotesAdmin() {
    showOverlay("Cargando catálogo de lotes…", "Lotes");
    try {
      // Cargar lista de biológicos para el select
      const bios = [
        "BCG","HEPATITIS B","HEXAVALENTE","DPT","ROTAVIRUS",
        "NEUMOCÓCICA 13","NEUMOCÓCICA 20","SRP","SR","VPH",
        "VARICELA","HEPATITIS A","TD","TDPA","COVID-19","INFLUENZA","VSR"
      ];
      const sel = $("loteBio");
      if (sel) {
        sel.innerHTML = bios.map(b => `<option value="${b}">${b}</option>`).join("");
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
      
      return `
        <tr class="lote-row-${expiryInfo.class}">
          <td>
            <div style="font-weight:900; color:var(--md-sys-color-primary);">${escapeHtml(item.biologico)}</div>
            <div style="font-size:10px; opacity:0.6; font-weight:600;">${escapeHtml(item.fecha_recepcion || "—")}</div>
          </td>
          <td style="font-family:monospace; font-weight:700; font-size:14px;">${escapeHtml(item.lote)}</td>
          <td>
             <div style="font-weight:900;">${escapeHtml(item.caducidad)}</div>
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
            <button type="button" class="md-delete-btn group" title="Eliminar este lote" onclick="deleteLoteRowAdmin(${idx})">
              <svg viewBox="0 0 24 24" class="w-6 h-6">
                <path class="trash-lid transition-transform duration-200 group-hover:-translate-y-1" fill="currentColor" d="M15 4V3H9v1H4v2h16V4h-5z" />
                <path fill="currentColor" d="M5 21a2 2 0 002 2h10a2 2 0 002-2V7H5v14zM8 9h2v10H8V9zm4 0h2v10h-2V9zm4 0h2v10h-2V9z" />
              </svg>
            </button>
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
    
    const months = { "ENE":0,"FEB":1,"MAR":2,"ABR":3,"MAY":4,"JUN":5,"JUL":6,"AGO":7,"SEP":8,"OCT":9,"NOV":10,"DIC":11 };
    const parts = cadStr.split("-");
    if (parts.length !== 2) return { label: "ERROR", class: "bad", icon: "error", days: 0, level: 0 };
    
    const m = months[parts[0]];
    const y = 2000 + parseInt(parts[1]);
    const expiryDate = new Date(y, m + 1, 0); // Último día del mes
    const today = new Date();
    today.setHours(0,0,0,0);
    
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
      <div class="logistics-card filter-btn ${BATCH_FILTER === 'all' ? 'active' : ''}" onclick="setLoteFilter('all')">
        <span class="val">${BATCH_CATALOG.length}</span>
        <span class="lbl">TOTAL LOTES</span>
      </div>
      <div class="logistics-card filter-btn ${BATCH_FILTER === 'critical' ? 'active' : ''}" onclick="setLoteFilter('critical')" style="--card-color: #dc2626">
        <span class="val" style="color:#dc2626">${summary.critical}</span>
        <span class="lbl">CRÍTICO</span>
      </div>
      <div class="logistics-card filter-btn ${BATCH_FILTER === 'alert' ? 'active' : ''}" onclick="setLoteFilter('alert')" style="--card-color: #d97706">
        <span class="val" style="color:#d97706">${summary.alert}</span>
        <span class="lbl">EN ALERTA</span>
      </div>
      <div class="logistics-card filter-btn ${BATCH_FILTER === 'expired' ? 'active' : ''}" onclick="setLoteFilter('expired')" style="--card-color: #7f1d1d">
        <span class="val" style="color:#7f1d1d">${summary.expired}</span>
        <span class="lbl">VENCIDOS</span>
      </div>
    `;
  }

  window.setLoteFilter = function(filter) {
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

  $("btnAddLoteRow")?.addEventListener("click", () => {
    const biologico = $("loteBio").value;
    const rawLote = $("loteTxt").value.trim().toUpperCase();
    const rawCad = $("loteCad").value.trim().toUpperCase();
    
    // Forzar formateo final por si no se disparó el blur
    const lote = rawLote;
    const caducidad = parseInputToMmmAa(rawCad);
    
    const fecha_recepcion = $("loteRec").value;
    
    // RECOLECCIÓN MULTIMUNICIPIO (Lógica individual explícita)
    const selectedMunis = Array.from(document.querySelectorAll(".loteMuniChk:checked")).map(cb => cb.value);

    if (!lote || !caducidad) {
      showToast("Lote y caducidad son obligatorios", false, "warn");
      return;
    }

    if (selectedMunis.length === 0) {
      showToast("Selecciona al menos un municipio", false, "warn");
      return;
    }

    // Validar formato caducidad MMM-AA despues del parseo
    if (!/^[A-Z]{3}-\d{2}$/.test(caducidad)) {
      showToast("Formato de caducidad inválido. Usa ENE-25, JUL-27, etc.", false, "warn");
      return;
    }

    let addedCount = 0;
    selectedMunis.forEach(muni => {
      // VALIDACIÓN DE DUPLICADOS (Por Municipio)
      const exists = BATCH_CATALOG.find(x => x.biologico === biologico && x.lote === lote && x.municipio === muni);
      if (!exists) {
        BATCH_CATALOG.push({ biologico, lote, caducidad, fecha_recepcion, municipio: muni });
        addedCount++;
      }
    });

    if (addedCount > 0) {
      renderLotesAdmin();
      showToast(selectedMunis.length > 1 ? `${addedCount} municipios asignados al lote` : "Lote agregado correctamente");
    } else {
      showToast("El lote ya existe en los municipios seleccionados", false, "warn");
    }

    // Limpiar campos parciales y desmarcar
    $("loteTxt").value = "";
    $("loteCad").value = "";
    $("loteRec").value = "";
    
    document.querySelectorAll(".loteMuniChk").forEach(chk => chk.checked = false);

    $("loteTxt").focus();
  });

  window.deleteLoteRowAdmin = function(idx) {
    BATCH_CATALOG.splice(idx, 1);
    renderLotesAdmin();
  }

$("btnSaveLotesAdmin")?.addEventListener("click", async () => {
    setBtnBusy("btnSaveLotesAdmin", true, "Guardando…");
    showOverlay("Actualizando catálogo de lotes…", "Administración");
    
    try {
        const r = await apiCall("saveLotes", { lotes: BATCH_CATALOG });
        
        if (!r || !r.ok) {
            throw new Error((r && r.error) || "Error al guardar lotes.");
        }

        showToast("Catálogo de lotes actualizado correctamente", true, "good");
        // Invalidar caché de lotes
        try { localStorage.removeItem("GAS_CACHE_getLotesByMunicipio"); } catch(e){}
        await loadBatchesForSession(USER); 
    } catch (e) {
        console.error("Error al guardar lotes:", e);
        showToast("Error al guardar en la base de datos: " + e.message, false);
    } finally {
        setBtnBusy("btnSaveLotesAdmin", false);
        hideOverlay();
    }
});

  // ==========================================
  // CAPTURA DINÁMICA DE BIOLÓGICOS (SR)
  // ==========================================

  function getShelfLifeClass(cadMmmAa) {
    if (!cadMmmAa || cadMmmAa.length < 6) return "";
    
    const monthsMap = {
      'ENE':0,'FEB':1,'MAR':2,'ABR':3,'MAY':4,'JUN':5,
      'JUL':6,'AGO':7,'SEP':8,'OCT':9,'NOV':10,'DIC':11
    };
    
    const parts = cadMmmAa.split('-');
    if (parts.length !== 2) return "";
    
    const mStr = parts[0].toUpperCase();
    const yShort = parseInt(parts[1]);
    const mIdx = monthsMap[mStr];
    
    if (isNaN(yShort) || mIdx === undefined) return "";
    
    const cadDate = new Date(2000 + yShort, mIdx, 1);
    const today = new Date();
    const firstOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const diffMonths = (cadDate.getFullYear() - firstOfCurrentMonth.getFullYear()) * 12 + (cadDate.getMonth() - firstOfCurrentMonth.getMonth());
    
    if (diffMonths < 0) return "shelf-life-danger"; // Expirado
    if (diffMonths <= 3) return "shelf-life-danger"; // < 3 meses
    if (diffMonths <= 6) return "shelf-life-warn";   // < 6 meses
    return "shelf-life-ok";
  }

  window.addSRRow = function(data = null) {
    const tbody = document.getElementById("srCaptureTbody");
    if (!tbody) return;
    const tr = document.createElement("tr");
    
    const biotics = [
      "BCG","HEPATITIS B","HEXAVALENTE","DPT","ROTAVIRUS",
      "NEUMOCÓCICA 13","NEUMOCÓCICA 20","SRP","SR","VPH",
      "VARICELA","HEPATITIS A","TD","TDPA","COVID-19","INFLUENZA","VSR"
    ];

    const bioOptions = biotics.map(b => `<option value="${b}" ${data?.biologico === b ? 'selected' : ''}>${b}</option>`).join("");
    
    tr.innerHTML = `
      <td class="p-4 py-3">
        <select class="sr-bio-select w-full bg-slate-50 border-2 border-slate-400 rounded-xl px-3 py-2.5 text-[14px] font-black text-slate-900 focus:border-primary focus:bg-white focus:shadow-[0_4px_10px_rgba(0,51,102,0.08)] outline-none transition-all" onchange="handleSRBioChange(this)">
          <option value="">Selecciona…</option>
          ${bioOptions}
        </select>
      </td>
      <td class="p-4 py-3">
        <select class="sr-lote-select w-full bg-slate-50 border-2 border-slate-400 rounded-xl px-3 py-2.5 text-[14px] font-black text-slate-900 focus:border-primary focus:bg-white focus:shadow-[0_4px_10px_rgba(0,51,102,0.08)] outline-none transition-all" onchange="handleSRLoteChange(this)">
          <option value="">—</option>
        </select>
      </td>
      <td class="sr-cad-cell p-4 py-3 font-black text-[13px] text-slate-900/60">—</td>
      <td class="p-4 py-3">
        <div class="relative group">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-rounded text-slate-400 text-[18px] pointer-events-none transition-colors group-focus-within:text-primary">calendar_month</span>
          <input type="date" style="padding-left: 38px !important;" class="sr-recepcion-input w-full bg-slate-50 border-2 border-slate-400 rounded-xl pr-3 py-2 text-[14px] font-black text-slate-900 focus:border-primary focus:bg-white focus:shadow-[0_4px_10px_rgba(0,51,102,0.08)] outline-none transition-all" value="${data?.fecha_recepcion || ""}">
        </div>
        <div class="sr-permanencia-hint" style="display: none;"></div>
      </td>
      <td class="p-4 py-3">
        <div class="relative group">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-rounded text-slate-400 text-[18px] pointer-events-none transition-colors group-focus-within:text-primary">inventory_2</span>
          <input type="number" style="padding-left: 38px !important;" class="sr-cantidad-input w-full bg-slate-50 border-2 border-slate-400 rounded-xl pr-3 py-2.5 text-[14px] font-black text-slate-900 focus:border-primary focus:bg-white focus:shadow-[0_4px_10px_rgba(0,51,102,0.08)] outline-none transition-all" min="0" step="1" value="${data?.cantidad || ""}" placeholder="0">
        </div>
      </td>
      <td class="p-4 py-3 text-center">
        <div class="flex justify-center items-center">
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
    }
}

window.updatePermanenciaHint = function(tr) {
    const cache = tr._cache || {};
    const recInput = cache.recepcionInput || tr.querySelector(".sr-recepcion-input");
    const hint = cache.permanenciaHint || tr.querySelector(".sr-permanencia-hint");
    
    if (!recInput || !recInput.value || !hint) {
        if (hint) hint.style.display = "none";
        return;
    }

    const dRec = new Date(recInput.value);
    const now = new Date();
    const diffDays = Math.floor((now - dRec) / (1000 * 60 * 60 * 24));

    hint.classList.remove("hint-warn", "hint-bad");

    if (diffDays > 90) {
        hint.style.display = "flex";
        hint.classList.add("hint-bad");
        hint.innerHTML = `<span class="material-symbols-rounded" style="font-size:14px">history_toggle_off</span> Límite excedido (> 3 meses)`;
    } else if (diffDays >= 60) {
        hint.style.display = "flex";
        hint.classList.add("hint-warn");
        hint.innerHTML = `<span class="material-symbols-rounded" style="font-size:14px">warning</span> Próximo a límite (90 días)`;
    } else {
        hint.style.display = "none";
    }
}

window.handleSRBioChange = function(selectEl, preselectLote = null) {
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


window.handleSRLoteChange = function(selectEl) {
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
    
    // ✅ Envolver en span para que se vea como pill centrado
    cadCell.innerHTML = `<span class="${getShelfLifeClass(cad)}">${cad}</span>`;
    cadCell.className = "sr-cad-cell"; // Limpiar clases en el td

    if (recInput && !recInput.value && rec) {
      recInput.value = rec;
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

    // Scroll-aware sticky headers for tables
    document.addEventListener("scroll", (e) => {
      const wrap = e.target;
      if (wrap && wrap.classList && wrap.classList.contains("tableWrap")) {
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

  const APP_STATE = {
    user: null,
    status: null,
    token: "",
    todayCache: null,
    mainPanel: "CAP",
    captureTab: "SR",
    opsTab: "SUMMARY",
    isMobile: false,
    isLowPerf: false,
    lastLoginUser: "",
    initialized: false
  };

  function syncAppState(partial = {}) {
    Object.assign(APP_STATE, partial);
    return APP_STATE;
  }

  function syncAppStateFromGlobals() {
    syncAppState({
      user: (typeof USER !== "undefined") ? USER : null,
      status: (typeof STATUS !== "undefined") ? STATUS : null,
      token: (typeof TOKEN !== "undefined") ? TOKEN : "",
      todayCache: (typeof TODAY_CACHE !== "undefined") ? TODAY_CACHE : null,
      isMobile: document.body.classList.contains("mobile-mode"),
      isLowPerf: document.body.classList.contains("lowperf")
    });
    return APP_STATE;
  }

  function syncGlobalsFromAppState() {
    if (typeof USER !== "undefined") USER = APP_STATE.user;
    if (typeof STATUS !== "undefined") STATUS = APP_STATE.status;
    if (typeof TOKEN !== "undefined") TOKEN = APP_STATE.token;
    if (typeof TODAY_CACHE !== "undefined") TODAY_CACHE = APP_STATE.todayCache;
  }

  function isMobileMode() {
    return document.body.classList.contains("mobile-mode");
  }

  let PANEL_SCROLL_TIMER = null;

  function schedulePanelScroll(targetId, delay = 80, doFlash = false) {
    if (!isMobileMode()) return;

    clearTimeout(PANEL_SCROLL_TIMER);

    PANEL_SCROLL_TIMER = setTimeout(() => {
      const el = $(targetId);
      if (!el) return;

      requestAnimationFrame(() => {
        el.scrollIntoView({
          behavior: "auto",
          block: "start"
        });

        if (doFlash && typeof flashElement === "function") {
          flashElement(targetId);
        }
      });
    }, delay);
  }

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

    const v = Number(j05.value || 0) + Number(j50.value || 0);
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
        // 1. Verificar que existe una sesión activa en Supabase Auth
        const { data: { session }, error: sessionError } = await window.supabase.auth.getSession();
        if (sessionError || !session) {
            console.warn("[whoami] No hay sesión Auth activa");
            clearSession();
            return null;
        }

        // 2. Actualizar TOKEN con el access_token fresco
        TOKEN = session.access_token;

        // 3. Consultar perfil fresco desde la DB (respeta RLS)
        const { data: perfil, error: perfilError } = await window.supabase
            .from('perfiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

        if (perfilError || !perfil) {
            console.error("[whoami] Perfil no encontrado para UID:", session.user.id, perfilError);
            clearSession();
            return null;
        }

        // 4. Verificar que el usuario esté activo
        if (String(perfil.activo || "SI").toUpperCase() !== "SI") {
            console.warn("[whoami] Usuario desactivado:", perfil.usuario);
            await window.supabase.auth.signOut();
            clearSession();
            return null;
        }

        // 5. Construir USER de forma canónica y persistir
        USER = buildUserFromPerfil(session.user.id, session.user.email, perfil);
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

    // Derivar municipiosAllowed basándose en el rol
    let municipiosAllowed = [];
    if (rol === "ADMIN" || rol === "JURISDICCIONAL") {
        municipiosAllowed = ["*"]; // Acceso total
    } else if (rol === "MUNICIPAL") {
        municipiosAllowed = municipio ? [municipio] : [];
    }
    // UNIDAD no necesita municipiosAllowed

    return {
        uid: uid,
        email: email,
        rol: rol,
        usuario: (perfil && perfil.usuario) || email,
        clues: (perfil && perfil.clues) || "",
        unidad: (perfil && perfil.unidad) || "",
        municipio: municipio,
        municipiosAllowed: municipiosAllowed,
        activo: (perfil && perfil.activo) || "SI",
        must_change: !!(perfil && perfil.must_change),
        mustChange: !!(perfil && perfil.must_change)
    };
}


  async function unitStatus() {
    if (!TOKEN) return null;
    const r = await apiCall({ action: "unitStatus", token: TOKEN });
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
    if (!TOKEN) return null;

    const safeFecha = String(fecha || todayYmdLocal()).trim();
    const safeTipo = String(tipo || "SR").trim().toUpperCase();
    const cacheKey = buildCacheKey("CAPTURE_OVERVIEW", `${safeFecha}::${safeTipo}`);

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

  window.getHistoryMetrics = async function (fechaInicio, fechaFin, force = false) {
    if (!TOKEN) return null;

    const inicio = String(fechaInicio || todayYmdLocal()).trim();
    const fin = String(fechaFin || todayYmdLocal()).trim();
    const cacheKey = buildCacheKey("HISTORY_METRICS", `${inicio}::${fin}`);

    const fetchMetrics = async () => {
      const r = await apiCall({
        action: "historyMetrics",
        token: TOKEN,
        fechaInicio: inicio,
        fechaFin: fin
      });

      if (!r) {
        throw new Error("Sin respuesta del servidor en historyMetrics.");
      }

      if (!r.ok) {
        throw new Error(r.error || "Error al cargar métricas históricas.");
      }

      return r.data || null;
    };

    const data = force
      ? await fetchMetrics()
      : await getCachedOrFetch({
        key: cacheKey,
        ttl: CACHE_TTL.HISTORY_METRICS,
        fetcher: fetchMetrics,
        shouldCache: (data) => data != null
      });

    return data || null;
  };


  /**
   * 🌓 CONTROL DE VISTAS (LOGIN vs APP)
   * Administra la entrada/salida del overlay premium y la visibilidad del dashboard.
   */

  function showRightColumn(show) {
    const loginWrap = document.getElementById("loginWrapper");
    const cardLogin = document.getElementById("cardLogin");

    // 1. Dashboard visibility
    toggleEl("rightColumn", show, "flex");

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
      
      // Forzar limpieza y aplicación de tono
      container.classList.remove("good", "ok", "warn", "bad");
      container.classList.add(tone);
      container.setAttribute("data-tone", tone);
      // Update icon background for premium look if colored
      if (iconBg && ["good", "warn", "bad"].includes(tone)) {
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
      const config = {
        ok: { bg: "bg-emerald-100", border: "border-emerald-200", iconBg: "bg-emerald-500/10", iconBorder: "border-emerald-500/20", iconColor: "text-emerald-600", textColor: "text-emerald-900", accent: "text-emerald-600/70" },
        warn: { bg: "bg-orange-100", border: "border-orange-200", iconBg: "bg-orange-500/10", iconBorder: "border-orange-500/20", iconColor: "text-orange-600", textColor: "text-orange-900", accent: "text-orange-600/70" },
        bad: { bg: "bg-rose-100", border: "border-rose-200", iconBg: "bg-rose-500/10", iconBorder: "border-rose-500/20", iconColor: "text-rose-600", textColor: "text-rose-900", accent: "text-rose-600/70" }
      }[tone];

      container.className = `flex items-center gap-5 bg-white border p-5 rounded-[22px] transition-all shadow-sm ${config.bg} ${config.border}`;
      iconBg.className = `w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-all ${config.iconBg} ${config.iconBorder}`;
      iconEl.className = `material-symbols-rounded text-[26px] ${config.iconColor} ${tone !== "ok" ? "animate-pulse" : ""}`;
      iconEl.textContent = icon;
      eyebrow.className = `text-[10px] font-black uppercase tracking-[0.15em] leading-none mb-1 ${config.accent}`;
      eyebrow.textContent = title;
      textEl.className = `text-[14px] font-bold leading-snug ${config.textColor}`;
      textEl.innerHTML = msg;
    };

    if (activeTab === "SR") {
      if (HAS_TODAY_SR && TODAY_CACHE && TODAY_CACHE.sr) {
        if (EDIT_SR) {
          setTone("warn", "edit_square", "Modo Edición", `<b>MODO EDICIÓN ACTIVO:</b> estás corrigiendo la existencia de biológicos de hoy.`);
        } else {
          setTone("ok", "task_alt", "Reporte Completo", `<b>YA CAPTURADO HOY:</b> la existencia de biológicos ya fue registrada${(TODAY_CACHE.sr && TODAY_CACHE.sr.editado === "SI") ? " y editada" : ""}. Si necesitas corregirla, usa el botón <b>Editar existencia de hoy</b>.`);
        }
      } else {
        setTone("warn", "schedule", "Pendiente de Captura", `<b>AÚN SIN CAPTURA:</b> la existencia de biológicos todavía no se ha registrado hoy.`);
      }
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

    if (!rows || !rows.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="muted">No hay configuración para esta unidad</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((r, i) => `
    <tr class="transition-colors hover:bg-surface-variant/5">
      <td class="p-4 py-3 bioNameCell">
        <div class="bioName font-black text-primary tracking-tight text-[14px]">
          💉 ${escapeHtml(r.biologico || "")}
        </div>
      </td>
      <td class="p-4 py-3 bioInputCell bioExistenciaCell">
        <div class="relative group">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-rounded text-slate-400 text-[18px] pointer-events-none transition-colors group-focus-within:text-primary">inventory_2</span>
          <input
            class="bioInput w-full bg-slate-50 border-2 border-slate-400 rounded-xl pr-3 py-2 text-[15px] font-black text-slate-900 focus:border-primary focus:bg-white focus:shadow-[0_4px_10px_rgba(0,51,102,0.08)] outline-none transition-all placeholder:text-slate-400/50"
            style="padding-left: 38px !important;"
            type="number"
            min="0"
            step="1"
            inputmode="numeric"
            data-i="${i}"
            data-kind="existencia"
            value="${r.existencia_actual_frascos ?? ""}"
            placeholder="0"
          >
        </div>
      </td>
      <td class="p-4 py-3 bioInputCell bioPedidoCell">
        <div class="relative group">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-rounded text-primary/40 text-[18px] pointer-events-none transition-colors group-focus-within:text-primary">add_box</span>
          <input
            class="bioInput w-full bg-slate-50 border-2 border-primary/40 rounded-xl pr-3 py-2 text-[15px] font-black text-primary focus:border-primary focus:bg-white focus:shadow-[0_4px_10px_rgba(37,99,235,0.1)] outline-none transition-all placeholder:text-primary/30"
            style="padding-left: 38px !important;"
            type="number"
            min="0"
            step="1"
            inputmode="numeric"
            data-i="${i}"
            data-kind="pedido"
            value="${r.pedido_frascos ?? ""}"
            placeholder="0"
          >
        </div>
      </td>
      <td class="p-4 py-3 bioValidationCell">
        <div id="bioAlert_${i}" class="bioAlertWrap flex justify-center"></div>
      </td>
      <td class="p-4 py-3 text-center bioMetricCell bioPromedioCell">
        <div class="bioMetric bioPromedioValue font-black text-surface-on/70 text-[13px]">${r.promedio_frascos ?? ""}</div>
      </td>
      <td class="p-4 py-3 text-center bioMetricCell">
        <div class="bioMetric font-bold text-surface-on/60 text-[13px]">${r.max_dosis ?? ""}</div>
      </td>
      <td class="p-4 py-3 text-center bioMetricCell">
        <div class="bioMetric font-bold text-surface-on/60 text-[13px]">${r.min_dosis ?? ""}</div>
      </td>
    </tr>
  `).join("");

    // Performance Update: Cache DOM references once to avoid querySelector in refreshBioAlerts
    BIO_STATE.cache = rows.map((_, i) => ({
      pedido: tbody.querySelector(`input[data-i="${i}"][data-kind="pedido"]`),
      existencia: tbody.querySelector(`input[data-i="${i}"][data-kind="existencia"]`),
      alert: document.getElementById(`bioAlert_${i}`)
    }));

    refreshBioAlerts();

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

    // Ahora visible para CONS, SR (Existencia) y BIO (Pedido)
    const visible = rol === "ADMIN" && (tipo === "CONS" || tipo === "SR" || tipo === "BIO");

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
          exactBox.style.display = "block";
          $("exportFechaHint").textContent = res.data.length > 1 ? "Múltiples capturas detectadas. Elige una." : "1 captura detectada para este mes.";
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
      const cached = BIO_STATE.cache[i];
      if (!cached) return;

      const pedidoEl = cached.pedido;
      const existenciaEl = cached.existencia;
      const td = cached.alert;

      if (!pedidoEl || !existenciaEl || !td) return;

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
        "HEPATITIS A",
        "VARICELA"
      ].includes(bioKey);

      const omitirAdvertenciaPorCaravana =
        isCurrentUnitCaravana() && bioKey === "BCG";

      if (pedidoRaw === "" && existenciaRaw === "") {
        const html = `
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-outline-variant/30 bg-surface-variant/50 text-surface-onVariant/70 shadow-sm">
            <span class="material-symbols-rounded text-base">hourglass_empty</span>
            <span class="text-[11px] font-bold uppercase tracking-wider">Pendiente</span>
          </div>
        `;
        if (td.innerHTML !== html) {
          td.className = "bioAlertWrap flex items-center justify-center h-full";
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
      // Solo estos biológicos bloquean el guardado si no son múltiplos de 5
      const requires5 = [
        "HEXAVALENTE", 
        "ROTAVIRUS", 
        "NEUMOCOCICA 13", 
        "NEUMOCOCICA 20", 
        "SRP"
      ].includes(bioKey);
      
      const multiplo = requires5 ? 5 : 1;

      if (!Number.isInteger(existencia) || !Number.isInteger(pedido) || existencia < 0 || pedido < 0) {
        msgs.push("Cantidades inválidas.");
        level = "bad";
        hasStrongAlert = true;
        hasBlockingError = true;
      }

      if (sinValidacionOperativa) {
        const html = `
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-blue-200 bg-blue-50 text-blue-700 shadow-sm">
            <span class="material-symbols-rounded text-base">info</span>
            <span class="text-[11px] font-bold uppercase tracking-wider">Extraordinaria</span>
          </div>
        `;
        if (td.innerHTML !== html) {
          td.className = "bioAlertWrap flex items-center justify-center h-full whitespace-normal";
          td.innerHTML = html;
        }
        return;
      }

      if (multiplo > 1 && pedido > 0 && (pedido % multiplo !== 0)) {
        msgs.push(`El pedido debe ser múltiplo de ${multiplo}.`);
        level = "bad";
        hasStrongAlert = true;
        hasBlockingError = true;
      }

      // 🛡️ REGLA: Validación de existencia vs promedio
      const threshold = sinPedido ? existencia : totalDisponible;
      if (!omitirAdvertenciaPorCaravana && promedio > 0 && threshold < promedio) {
        const diff = promedio - threshold;
        msgs.push(sinPedido 
          ? `Existencia (${threshold}) menor al promedio (${promedio}). Faltan ${diff} frascos.`
          : `Total (${threshold}) menor al promedio (${promedio}). Faltan ${diff} frascos.`
        );
        if (level !== "bad") {
          level = "warn";
          hasStrongAlert = true;
        }
      }

      if (!msgs.length) {
        const html = `
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm">
            <span class="material-symbols-rounded text-base">check_circle</span>
            <span class="text-[11px] font-bold uppercase tracking-wider">Correcto</span>
          </div>
        `;
        if (td.innerHTML !== html) {
          td.className = "bioAlertWrap flex items-center justify-center h-full whitespace-normal";
          td.innerHTML = html;
        }
      } else {
        const tone = level === "bad" ? "rose" : "amber";
        const icon = level === "bad" ? "error" : "warning";
        const text = level === "bad" ? "Error" : "Atención";
        
        const html = `
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-${tone}-200 bg-${tone}-50 text-${tone}-700 shadow-sm">
            <span class="material-symbols-rounded text-base animate-pulse">${icon}</span>
            <span class="text-[11px] font-bold uppercase tracking-wider">${text}</span>
          </div>
          <div class="text-[10px] font-bold text-${tone}-800/80 px-2 leading-tight text-center max-w-full">${msgs.join("<br>")}</div>
        `;
        if (td.innerHTML !== html) {
          td.className = "bioAlertWrap flex flex-col gap-1 items-center justify-center h-full whitespace-normal py-2";
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

  function closeBioConfirm(result) {
    const overlay = $("bioConfirmOverlay");
    if (!overlay) return;
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("bioConfirmOpen");


    const resolver = BIO_CONFIRM_RESOLVER;
    BIO_CONFIRM_RESOLVER = null;

    if (typeof resolver === "function") {
      resolver(!!result);
    }
  }

  function openBioConfirm(warningRows) {
    return new Promise((resolve) => {
      const overlay = $("bioConfirmOverlay");
      const list = $("bioConfirmList");
      const intro = $("bioConfirmIntro");

      if (!overlay || !list || !intro) {
        resolve(window.confirm(
          "La validación detectó que no estás solicitando biológico suficiente en algunos renglones:\n\n" +
          warningRows.join("\n") +
          "\n\n¿Deseas continuar con el guardado de pedido?"
        ));
        return;
      }

      BIO_CONFIRM_RESOLVER = resolve;

      intro.textContent = "La validación detectó que no estás solicitando biológico suficiente en algunos renglones:";
      list.innerHTML = warningRows
        .map(row => `<div class="bioConfirmItem">${escapeHtml(row.replace(/^•\s*/, ""))}</div>`)
        .join("");

      overlay.classList.add("show");
      overlay.setAttribute("aria-hidden", "false");
      document.body.classList.add("bioConfirmOpen");

      const btnCancel = $("btnBioConfirmCancel");
      const btnAccept = $("btnBioConfirmAccept");

      if (btnCancel) btnCancel.focus();
    });
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

    const municipios = r.data.municipios || [];
    wrap.innerHTML = "";

    if (!municipios.length) {
      wrap.innerHTML = `<div class="muted">No hay municipios disponibles para exportar.</div>`;
      box.style.display = "block";
      return;
    }

    const grid = document.createElement("div");
    grid.className = "exportMunicipiosGrid";

    municipios.forEach((m) => {
      const id = "expmun_" + m.replace(/\s+/g, "_").replace(/[^\w]/g, "");

      const label = document.createElement("label");
      label.className = "modern-toggle exportMunicipioToggle";
      label.setAttribute("for", id);

      label.innerHTML = `
      <div class="modernToggleText">
        <div class="modernToggleTitle">${escapeHtml(m)}</div>
      </div>
      <div class="modernToggleSwitch">
        <input
          type="checkbox"
          class="exportMunicipioChk"
          id="${id}"
          value="${escapeAttr(m)}"
        >
        <span class="modernToggleSlider"></span>
      </div>
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

    const r = await apiCall({ action: "bioGetForm", token: TOKEN });
    if (!r || !r.ok) {
      $("bioTbody").innerHTML = `<tr><td colspan="7" class="muted">${escapeHtml((r && r.error) ? r.error : "No se pudo cargar")}</td></tr>`;
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

    const canCaptureLocal = true; // Siempre permitir captura (Mensual o Extraordinaria)
    const isInsideWindow = hoyYmd >= windowStartYmd && hoyYmd <= windowEndYmd;
    const isCaptureDayLocal = hoyYmd === windowTargetYmd;

    let windowStatus = "EXTRAORDINARY";
    if (isInsideWindow) windowStatus = "OPEN";

    BIO_STATE = {
      rows: r.data.rows || [], 
      isCaptureDay: isCaptureDayLocal,
      isInsideWindow: isInsideWindow,
      canCapture: true,
      fechaPedidoProgramada: windowTargetYmd,
      fechaPedidoFriendly: windowTargetFriendly, 
      captureWindowStart: windowStartFriendly, 
      captureWindowEnd: windowEndFriendly,     
      captureWindowStatus: windowStatus,
      diffDays: 0 
    };

    HAS_SAVED_BIO = !!r.data.hasSavedBio;
    EDIT_BIO = false;

    $("fechaPedidoBIO").value = BIO_STATE.fechaPedidoProgramada || "";
    $("fechaPedidoBIOBox").textContent = BIO_STATE.fechaPedidoFriendly || "—";
    
    // Resetear toggle de "No hacer pedido"
    if ($("chkNoPedido")) $("chkNoPedido").checked = false;

    const bioHint = $("bioHint");
    const bioDayAlert = $("bioDayAlert");

    bioDayAlert.className = "bioDayAlert show";

    if (BIO_STATE.isInsideWindow) {
      if (BIO_STATE.isCaptureDay) {
        bioHint.textContent = "Día objetivo de pedido mensual.";
        bioDayAlert.className = "bioDayAlert show border-emerald-500/30 bg-emerald-50/50";
        bioDayAlert.querySelector(".bioDayIcon").className = "bioDayIcon w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/10 text-emerald-600";
        bioDayAlert.querySelector(".bioDayMsg").innerHTML = `<b>PEDIDO MENSUAL:</b> captura habilitada hoy (fecha objetivo). Ventana: ${BIO_STATE.captureWindowStart} al ${BIO_STATE.captureWindowEnd}.`;
      } else {
        bioHint.textContent = "Captura de pedido mensual habilitada.";
        bioDayAlert.className = "bioDayAlert show border-emerald-500/30 bg-emerald-50/50";
        bioDayAlert.querySelector(".bioDayIcon").className = "bioDayIcon w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/10 text-emerald-600";
        bioDayAlert.querySelector(".bioDayMsg").innerHTML = `<b>PEDIDO MENSUAL:</b> te encuentras dentro de la ventana operativa (${BIO_STATE.captureWindowStart} al ${BIO_STATE.captureWindowEnd}).`;
      }
    } else {
      bioHint.textContent = "Fuera de ventana oficial.";
      bioDayAlert.className = "bioDayAlert show border-amber-500/30 bg-amber-50/50";
      bioDayAlert.querySelector(".bioDayIcon").className = "bioDayIcon w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/10 text-amber-600";
      bioDayAlert.querySelector(".bioDayMsg").innerHTML = `<b>PEDIDO EXTRAORDINARIO:</b> hoy te encuentras fuera de la ventana oficial (${BIO_STATE.captureWindowStart} al ${BIO_STATE.captureWindowEnd}).`;
    }

    renderBioRows(BIO_STATE.rows || []);
    applyCaptureLockState();
    updateCaptureStateBanner();
  }

  function setEditModeSR(on) {
    EDIT_SR = !!on;
    applyCaptureLockState();
    updateCaptureStateBanner();
  }

  function setEditModeCONS(on) {
    EDIT_CONS = !!on;
    applyCaptureLockState();
    updateCaptureStateBanner();
  }

  function setEditModeBIO(on) {
    EDIT_BIO = !!on;
    applyCaptureLockState();
    updateCaptureStateBanner();
  }

  function setFormLocked(formId, locked) {
    const form = $(formId);
    if (!form) return;

    form.classList.toggle("formLocked", !!locked);

    form.querySelectorAll("input, select, textarea").forEach(el => {
      if (!el) return;
      if (el.id === "aguja_0600403711") return; // ya es automático
      el.disabled = !!locked;
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
      $("btnSaveBIO").disabled = bioLocked || !BIO_STATE.canCapture;
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
      const today = await getTodayReports(todayYmdLocal());
      console.log("reloadTodayState today:", today);
      hydrateTodayForms(today);
    } catch (e) {
      console.error("reloadTodayState error:", e);
    }
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
    const fecha = data?.fecha || "";
    const tipo = data?.tipo || "SR";
    
    // Título Dinámico Premium
    const titleEl = document.getElementById("captureSummaryTitle");
    if (titleEl) {
       const tipoTxt = tipo === "CONS" ? "Consumibles" : (tipo === "BIO" ? "Pedido de biológico" : "Existencia de biológicos");
       titleEl.textContent = `Resumen de captura de ${tipoTxt} - ${formatAppDate(fecha)}`;
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
    $("sumTotal").textContent = data?.total_unidades ?? 0;
    $("sumCapturadas").textContent = data?.total_capturadas ?? 0;
    $("sumFaltantes").textContent = data?.total_faltantes ?? 0;

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
      const cardsCap = $("capturadasCards");
      if (!list.length) {
        tbodyCap.innerHTML = `<tr><td colspan="5" class="muted">No hay capturas con este filtro</td></tr>`;
        if (cardsCap) cardsCap.innerHTML = `<div class="muted">No hay capturas</div>`;
        return;
      }
      tbodyCap.innerHTML = list.map(r => `
        <tr>
          <td>${escapeHtml(r.municipio || "")}</td>
          <td>${escapeHtml(r.clues || "")}</td>
          <td>${escapeHtml(r.unidad || "")}</td>
          <td>${escapeHtml(r.capturado_por || "")} <br><small class="opacity-60 font-bold">${r.tipo_pedido || "MENSUAL"}</small></td>
          <td>
            <div style="display:flex; align-items:center; gap:8px">
              <span class="statusOk">${r.editado === "SI" ? "Capturado / editado" : "Capturado"}</span>
              <button class="miniBtn ghostBtn" onclick="openLiveView('${r.clues}','${escapeHtml(r.unidad)}','${escapeHtml(r.municipio)}')" title="Ver inventario en vivo">
                 <span class="material-symbols-rounded" style="font-size:18px">visibility</span>
              </button>
            </div>
          </td>
        </tr>
      `).join("");
      // ... cards update omitted for brevity in this replace call, will unify below
    }

    $("capturadasCount").textContent = `${capturadas.length}`;
    $("faltantesCount").textContent = `${faltantes.length}`;

    // Semáforo automático
    if ($("kpiCardFaltantes")) {
      $("kpiCardFaltantes").className = "kpiCard " + (faltantes.length > 0 ? "warn" : "ok");
    }


    const finalMsg = extraInfo || `Consulta cargada: ${tipo === "CONS" ? "Consumibles" : (tipo === "BIO" ? "Pedido" : "Existencia")} del ${fecha || "—"}`;
    $("summaryMsg").innerHTML = finalMsg;

    function renderCapturadasOnly(list) {
      const tbodyCap = $("capturadasTbody");
      const cardsCap = $("capturadasCards");
      if (!list.length) {
        const msg = `No hay capturas registradas para esa consulta`;
        tbodyCap.innerHTML = `<tr><td colspan="5" class="muted">${msg}</td></tr>`;
        if (cardsCap) cardsCap.innerHTML = `<div class="muted">${msg}</div>`;
        return;
      }
      tbodyCap.innerHTML = list.map(r => `
        <tr>
          <td>${escapeHtml(r.municipio || "")}</td>
          <td>${escapeHtml(r.clues || "")}</td>
          <td>${escapeHtml(r.unidad || "")}</td>
          <td>
            ${escapeHtml(r.capturado_por || "")}
            ${r.tipo_pedido ? `<br><small class="text-primary font-black uppercase tracking-tighter opacity-70">${r.tipo_pedido}</small>` : ""}
          </td>
          <td>
            <div style="display:flex; align-items:center; gap:8px">
              <span class="statusOk">${r.editado === "SI" ? "Capturado / editado" : "Capturado"}</span>
              <button class="miniBtn ghostBtn" onclick="openLiveView('${r.clues}','${escapeHtml(r.unidad)}','${escapeHtml(r.municipio)}')" title="Ver inventario en vivo">
                 <span class="material-symbols-rounded" style="font-size:18px">visibility</span>
              </button>
            </div>
          </td>
        </tr>
      `).join("");

      if (cardsCap) {
        cardsCap.innerHTML = list.map(r => `
        <div class="captureMobileCard">
          <div class="captureMobileHead">
            <div class="captureMobileTitle">${escapeHtml(r.unidad || "Unidad sin nombre")}</div>
            <div class="captureMobileStatus ok">${r.editado === "SI" ? "Capturado / editado" : "Capturado"}</div>
          </div>
          <div class="captureMobileFields">
            <div class="captureMobileField">
              <div class="captureMobileLabel">Municipio / CLUES</div>
              <div class="captureMobileValue">${escapeHtml(r.municipio || "")} (${escapeHtml(r.clues || "")})</div>
            </div>
            <div class="captureMobileField">
              <div class="captureMobileLabel">Capturó ${r.tipo_pedido ? `(${r.tipo_pedido})` : ""}</div>
              <div class="captureMobileValue">${escapeHtml(r.capturado_por || "")}</div>
            </div>
          </div>
        </div>
      `).join("");
      }
    }

    renderCapturadasOnly(capturadas);

    const tbodyFal = $("faltantesTbody");
    const cardsFal = $("faltantesCards");

    if (!faltantes.length) {
      tbodyFal.innerHTML = `<tr><td colspan="4" class="muted">No hay pendientes</td></tr>`;
      if (cardsFal) {
        cardsFal.innerHTML = `<div class="muted">No hay pendientes</div>`;
      }
    } else {
      tbodyFal.innerHTML = faltantes.map(r => `
      <tr>
        <td>${escapeHtml(r.municipio || "")}</td>
        <td>${escapeHtml(r.clues || "")}</td>
        <td>${escapeHtml(r.unidad || "")}</td>
        <td><span class="statusPending">Pendiente</span></td>
      </tr>
    `).join("");

      if (cardsFal) {
        cardsFal.innerHTML = faltantes.map(r => `
        <div class="captureMobileCard">
          <div class="captureMobileHead">
            <div class="captureMobileTitle">${escapeHtml(r.unidad || "Unidad sin nombre")}</div>
            <div class="captureMobileStatus pending">Pendiente</div>
          </div>

          <div class="captureMobileFields">
            <div class="captureMobileField">
              <div class="captureMobileLabel">Municipio</div>
              <div class="captureMobileValue">${escapeHtml(r.municipio || "")}</div>
            </div>

            <div class="captureMobileField">
              <div class="captureMobileLabel">CLUES</div>
              <div class="captureMobileValue">${escapeHtml(r.clues || "")}</div>
            </div>
          </div>
        </div>
      `).join("");
      }
    }
  }

  function setLoggedInUI(user, status) {
    USER = user;
    STATUS = (status && status.data) ? status.data : (status || null);

    syncAppState({
      user: USER,
      status: STATUS,
      token: (typeof TOKEN !== "undefined") ? TOKEN : "",
      isMobile: document.body.classList.contains("mobile-mode"),
      isLowPerf: document.body.classList.contains("lowperf"),
      mainPanel: "CAP"
    });

    $("who").textContent = `${user.clues || "—"} — ${user.unidad || "—"}`;
    if ($("userNameFull")) $("userNameFull").textContent = user.nombre || user.usuario || "Usuario";
    // ✅ SALUDO DINÁMICO (Cargando...)
    // ✅ SALUDO DINÁMICO INTELIGENTE (Procesando...)
    $("rolTxt").textContent = (user.rol || "UNIDAD").replace(/^Perfil:\s*/i, "");
    
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

    if ($("btnOpenUpload")) {
      const isOpsAdmin = user.rol === "ADMIN" || user.rol === "JURISDICCIONAL";
      $("btnOpenUpload").style.display = isOpsAdmin ? "none" : "inline-flex";
    }

    if (user.rol === "ADMIN") {
      if ($("munTxt")) $("munTxt").textContent = "Todos";
      refreshUsers().catch(console.error);
      refreshBulkBioSetup?.();
    } else if (user.rol === "JURISDICCIONAL") {
      if ($("munTxt")) $("munTxt").textContent = "Todos";
    } else if (user.rol === "MUNICIPAL") {
      $("munTxt").textContent = (user.municipio || "—").replace(/^Municipio\(s\):\s*/i, "").replace(/^Municipio:\s*/i, "");
    } else {
      $("munTxt").textContent = (user.municipio || "—").replace(/^Municipio:\s*/i, "");
    }

    const isAdmin = user.rol?.toUpperCase() === "ADMIN";
    const isJurisdiccional = user.rol?.toUpperCase() === "JURISDICCIONAL";
    const isMunicipal = user.rol?.toUpperCase() === "MUNICIPAL";
    const isUnidad = user.rol?.toUpperCase() === "UNIDAD";

    // --- BOTTOM NAV PERMISSIONS ---
    const isMobile = window.innerWidth <= 768;
    const mobileNav = $("mobileBottomNav");
    if (mobileNav) {
      mobileNav.style.display = isMobile ? "flex" : "none";
      if ($("navNotifs")) $("navNotifs").style.display = (isAdmin || isJurisdiccional || isMunicipal) ? "flex" : "none";
      if ($("navAdmin")) $("navAdmin").style.display = isAdmin ? "flex" : "none";
    }

    if ($("tabOPS_ADMIN")) {
      $("tabOPS_ADMIN").onclick = () => activateMain("ADMIN");
    }
    if ($("tabOPS_NOTIFS")) {
      $("tabOPS_NOTIFS").onclick = () => activateMain("NOTIFS");
    }

    updateDynamicGreeting();


    if (STATUS) {
      $("dayTxt").textContent = formatDayBadgeMx(STATUS.today);
      paintStatusChips(STATUS);
    }

    const canExport = isAdmin || isJurisdiccional || isMunicipal;


    if ($("btnExport")) $("btnExport").style.display = canExport ? "inline-flex" : "none";
    if ($("btnExportBIO")) $("btnExportBIO").style.display = canExport ? "inline-flex" : "none";
    if ($("tabADMIN")) $("tabADMIN").style.display = isAdmin ? "block" : "none";
    if ($("tabNOTIFS")) $("tabNOTIFS").style.display = (isUnidad || isAdmin || isJurisdiccional || isMunicipal) ? "block" : "none";
    if ($("btnTopNotifications")) $("btnTopNotifications").style.display = (isUnidad || isAdmin || isJurisdiccional || isMunicipal) ? "inline-flex" : "none";

    // ✅ EXPLORADOR REFUEZO (HEADER ONLY)
    if ($("btnViewArchivos")) {
      $("btnViewArchivos").style.display = "flex";
    }

    // Role-based tailoring for Explorer UI
    if (isUnidad) {
       if ($("archivosSearch")) $("archivosSearch").placeholder = "Buscar por fecha...";
       if ($("archivosCategoria")) $("archivosCategoria").style.display = "none";
    } else {
       if ($("archivosSearch")) $("archivosSearch").placeholder = "Buscar por Clues o Unidad...";
       if ($("archivosCategoria")) $("archivosCategoria").style.display = "block";
    }

    if ($("topNotifRoleKpi")) $("topNotifRoleKpi").textContent = user.rol || "—";

    if ($("tabSR")) $("tabSR").style.display = isUnidad ? "block" : "none";
    if ($("tabCONS")) $("tabCONS").style.display = isUnidad ? "block" : "none";
    if ($("tabBIO")) $("tabBIO").style.display = isUnidad ? "block" : "none";
    if ($("tabPINOL")) $("tabPINOL").style.display = isUnidad ? "block" : "none";

    if ($("formSR")) $("formSR").style.display = isUnidad ? "block" : "none";
    if ($("formCONS")) $("formCONS").style.display = "none";
    if ($("formBIO")) $("formBIO").style.display = "none";
    if ($("formPINOL")) $("formPINOL").style.display = "none";

    if ($("sectionCapturaUnidad")) $("sectionCapturaUnidad").style.display = isUnidad ? "block" : "none";
    if ($("panelCAP")) $("panelCAP").style.display = isUnidad ? "block" : "none";
    if ($("panelAdminOpsTabs")) $("panelAdminOpsTabs").style.display = (isAdmin || isJurisdiccional || isMunicipal) ? "block" : "none";
    if ($("tabOPS_PINOL")) $("tabOPS_PINOL").style.display = (isAdmin || isMunicipal) ? "block" : "none";
    if ($("tabOPS_NOTIFS")) $("tabOPS_NOTIFS").style.display = (isAdmin || isJurisdiccional || isMunicipal) ? "block" : "none";
    if ($("tabOPS_ADMIN")) $("tabOPS_ADMIN").style.display = isAdmin ? "flex" : "none";



    if ($("notifInboxPane")) {
      $("notifInboxPane").style.display = "none";
    }
    if ($("notifListWrap")) {
      $("notifListWrap").style.display = "none";
    }
    if ($("notifComposerPane")) {
      $("notifComposerPane").style.display = (isAdmin || isJurisdiccional || isMunicipal) ? "block" : "none";
    }

    if ($("notifRoleKpi")) {
      $("notifRoleKpi").textContent = user.rol || "—";
    }

    if ($("panelNOTIFS")) $("panelNOTIFS").style.display = (isAdmin || isJurisdiccional || isMunicipal) ? "" : "none";


    syncTopNotifMirror();
    closeTopNotifDropdown();

    if ($("tabCONS")) {
      $("tabCONS").disabled = isUnidad
        ? !(STATUS && STATUS.canCaptureConsumibles)
        : true;

      $("tabCONS").title = isUnidad
        ? (
          $("tabCONS").disabled
            ? "Disponible solo jueves o por apertura extraordinaria"
            : ""
        )
        : "";
    }

    if (isUnidad) {
      syncAppState({ mainPanel: "CAP", captureTab: "SR" });
      activateDefaultMainForRole();
      loadBioForm().catch(err => console.error("loadBioForm error:", err));
      reloadTodayState();
      schedulePanelScroll("panelCAP", 120, false);
    } else {
      syncAppState({ mainPanel: "CAP" });
      activateMain("CAP");
      refreshPinolBadgeOnly();
    }

    if (canExport) {
      if ($("exportConfigBox")) $("exportConfigBox").style.display = "block";

      const hoy = todayYmdLocal();
      if ($("exportFechaInicio")) $("exportFechaInicio").value = hoy;
      if ($("exportFechaFin")) $("exportFechaFin").value = hoy;

      updateExportFechaHint();
      loadExportOptions().catch(() => { });
    }

    runPostLoginInit(user);
  }

  function updateDynamicGreeting(timeGreeting = null, customSubtitle = null) {
    const welcomeEl = $("welcome");
    if (!welcomeEl) return;

    let title = timeGreeting;
    let subtitle = customSubtitle;

    if (!title) {
      const hora = new Date().getHours();
      if (hora < 12) { 
        title = "¡Buenos días!"; 
        subtitle = "Qué bueno verte por aquí, iniciamos con éxito.";
      } else if (hora < 19) { 
        title = "¡Buenas tardes!"; 
        subtitle = "Todo listo para continuar con la gestión.";
      } else { 
        title = "¡Buenas noches!"; 
        subtitle = "Seguimos trabajando con compromiso.";
      }
      
      if (typeof STATUS !== "undefined" && STATUS && STATUS.isExtraordinary) {
        subtitle = "⚠️ Captura extraordinaria activa.";
      }
    }

    const weatherEmoji = CURRENT_WEATHER.emoji || "";
    const weatherTemp = CURRENT_WEATHER.temp !== null ? `${CURRENT_WEATHER.temp}°C` : "";

    welcomeEl.innerHTML = `
      <div class="flex flex-col leading-tight">
        <span class="text-primary flex items-baseline gap-3">
          ${title}
          <span class="text-[16px] sm:text-[22px] font-bold text-primary/40 flex items-center gap-1.5">
            ${weatherEmoji} ${weatherTemp}
          </span>
        </span>
        <span class="text-base sm:text-lg font-medium text-primary/40 mt-1 block">${subtitle}</span>
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

  async function hydrateSessionUi(user, status, opts = {}) {
    exposeAppFns();
    assertCriticalFns();

    const {
      showSuccessToast = false,
      mustChangePassword = false
    } = opts;

    setLoggedInUI(user, status);
    showRightColumn(true); 
    hideOverlay(); // Resolve mobile stuck-at-overlay issue

    window.MUST_CHANGE_PASSWORD = !!mustChangePassword;

    // Inicializar catálogos de lotes
    try {
      if (user.rol === "ADMIN" || user.rol === "JURISDICCIONAL") {
        toggleEl("tabLOTES", true, "flex");
      } else {
        toggleEl("tabLOTES", false);
        toggleEl("panelLOTES", false);
      }
      await loadBatchesForSession(user);
    } catch (e) {
      console.warn("Error cargando lotes:", e);
    }

    const today = await smartLoader(
      () => getTodayReports(todayYmdLocal(), true),
      {
        message: "Cargando información del día…",
        title: "Inicializando"
      }
    );

    hydrateTodayForms(today);

    const isOps = user && (user.rol === "ADMIN" || user.rol === "MUNICIPAL" || user.rol === "JURISDICCIONAL");
    if (isOps) {
      const fechaHoy = todayYmdLocal();
      if ($("summaryFecha")) $("summaryFecha").value = fechaHoy;
      if ($("summaryTipo")) $("summaryTipo").value = "SR";
      if ($("histFechaInicio")) $("histFechaInicio").value = fechaHoy;
      if ($("histFechaFin")) $("histFechaFin").value = fechaHoy;

      const [summary] = await Promise.all([
        getCaptureOverview(fechaHoy, "SR"),
        refreshPinolBadgeOnly()
      ]);

      if (summary) renderCaptureSummary(summary);
    }

    if (showSuccessToast) {
      showToast("Sesión iniciada correctamente");
    }

    requestAnimationFrame(async () => {
      await loadNotifications({ silent: true });
      startNotificationsAutoRefresh();
    });
  }

  function setLoggedOutUI() {
    USER = null;
    STATUS = null;
    TOKEN = "";
    TODAY_CACHE = null;

    stopRealtimeUX();

    syncAppState({
      user: null,
      status: null,
      token: "",
      todayCache: null,
      mainPanel: "CAP",
      captureTab: "SR",
      opsTab: "SUMMARY"
    });
    localStorage.removeItem("JS1_TOKEN");
    if ($("loginStatus")) $("loginStatus").textContent = "—";
    showRightColumn(false);

    if ($("bGuardado")) $("bGuardado").style.display = "none";
    if ($("pinolBadgeMain")) $("pinolBadgeMain").style.display = "none";
    if ($("pinolBadgeTab")) $("pinolBadgeTab").style.display = "none";

    $("tabOPS_PINOL")?.classList.remove("liveAccent", "notifHot");
    $("tabCAP")?.classList.remove("liveAccent", "notifHot");

    if ($("tabOPS_PINOL")) $("tabOPS_PINOL").title = "Pinol";
    if ($("tabCAP")) $("tabCAP").title = "Captura";

    LIVE_STATE.pinolWatching = false;
    LIVE_STATE.summaryWatching = false;
    LIVE_STATE.unidadWatching = false;
    LIVE_STATE.historyWatching = false;

    resetNotifCounter();
    clearLiveFeed();
  }

  function activateMain(panel, forceSubTab) {
    // --- SEGURIDAD DE ROLES (PRO-UX GUARD) ---
    const role = String((USER && USER.rol) || "").trim().toUpperCase();
    if (panel === "ADMIN" && role !== "ADMIN") {
        console.warn("Intento de acceso no autorizado a ADMIN bloqueado.");
        return;
    }

    if (panel === "NOTIFS" && role === "UNIDAD") {
      openTopNotifDropdown();
      loadNotifications({ silent: true }).catch(err => {
        console.error("activateMain NOTIFS unidad error:", err);
      });
      return;
    }
    const currentPanel = APP_STATE.mainPanel || "CAP";
    const samePanel = currentPanel === panel;

    syncAppState({ mainPanel: panel });

    if (panel === "CAP") clearTabAttention("tabCAP");
    if (panel === "NOTIFS") clearTabAttention("tabNOTIFS");
    if (panel === "ADMIN") clearTabAttention("tabADMIN");

    const isUnidad = role === "UNIDAD";
    const isAdmin = role === "ADMIN";
    const isMunicipal = role === "MUNICIPAL";
    const isJurisdiccional = role === "JURISDICCIONAL";
    const isOps = isAdmin || isMunicipal || isJurisdiccional;

    const updateTabClass = (id, cond) => {
      const el = $(id);
      if (el) {
        if (cond) { el.classList.add("tab-active"); el.classList.remove("tab-inactive"); }
        else { el.classList.add("tab-inactive"); el.classList.remove("tab-active"); }
      }
    };

    updateTabClass("tabCAP", panel === "CAP");
    updateTabClass("tabNOTIFS", panel === "NOTIFS");
    updateTabClass("tabADMIN", panel === "ADMIN");

    // Sincronizar Pestañas de Operaciones/Admin (Bottom Row)
    updateTabClass("tabOPS_NOTIFS", panel === "NOTIFS");
    updateTabClass("tabOPS_ADMIN", panel === "ADMIN");
    
    // Si entramos en ADMIN o NOTIFS, debemos desmarcar las pestañas de OPS
    if (panel === "ADMIN" || panel === "NOTIFS") {
      updateTabClass("tabOPS_CAPTURE", false);
      updateTabClass("tabOPS_HISTORY", false);
      updateTabClass("tabOPS_PINOL", false);
      updateTabClass("tabLOTES", false);
    }

    // Sincronizar Bottom Nav
    document.querySelectorAll(".nav-item").forEach(el => {
      const target = el.getAttribute("data-tab");
      el.classList.toggle("active", target === `tab${panel}`);
    });


    // --- Panel Isolation Guard (Crucial for Mobile UX) ---
    const allPanels = [
      "panelCAP", "panelNOTIFS", "panelADMIN", "panelCaptureSummary", 
      "panelPINOLADMIN", "panelHISTORY", "panelEDITLOG", "panelLOTES", "panelArchivos"
    ];
    allPanels.forEach(pId => {
      const p = $(pId);
      if (p) p.style.display = "none";
    });

    if ($("panelCAP")) $("panelCAP").style.display = (panel === "CAP") ? "block" : "none";
    
    if ($("panelAdminOpsTabs")) {
      const isVisible = (panel === "CAP" || panel === "ADMIN" || panel === "NOTIFS") && isOps;
      $("panelAdminOpsTabs").style.display = isVisible ? "block" : "none";
    }

    if ($("panelNOTIFS")) $("panelNOTIFS").style.display = (panel === "NOTIFS") ? "block" : "none";
    if ($("panelADMIN")) $("panelADMIN").style.display = (panel === "ADMIN" && isAdmin) ? "block" : "none";


    if (panel === "CAP" && isOps) {
      const targetSub = forceSubTab || APP_STATE.opsTab || "CAPTURE";
      if (!samePanel || APP_STATE.opsTab !== targetSub) {
        syncAppState({ opsTab: targetSub });
        activateOpsTab(targetSub);
      }
      refreshPinolBadgeOnly().catch(() => { });
      if (!samePanel) schedulePanelScroll("panelCaptureSummary", 80, false);
    }

    if (panel === "CAP" && isUnidad) {
      if (!samePanel) schedulePanelScroll("panelCAP", 80, false);
    }

    if (panel === "NOTIFS") {
      if (isOps) {
        initNotificationCenter().catch(err => console.error("initNotificationCenter error:", err));
      }
      
      loadNotifications({ silent: false }).catch(err => {
        console.error("loadNotifications error:", err);
        showToast("No se pudieron cargar las notificaciones", false);
      });

      if (!samePanel) {
        schedulePanelScroll("panelNOTIFS", 80, false);
      }
    }

    if (panel === "ADMIN" && isAdmin) {
      if (!samePanel) schedulePanelScroll("panelADMIN", 80, false);
    }
  }

  function activateCapture(tab) {
    const role = String((USER && USER.rol) || "").trim().toUpperCase();

    const updateTabClass = (id, cond) => {
      const el = $(id);
      if (el) {
        if (cond) { el.classList.add("tab-active"); el.classList.remove("tab-inactive"); }
        else { el.classList.add("tab-inactive"); el.classList.remove("tab-active"); }
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

    syncAppState({ captureTab: tab });

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

    $("formSR").style.display = "none";
    $("formCONS").style.display = "none";
    $("formBIO").style.display = "none";
    $("formPINOL").style.display = "none";

    let targetId = "formSR";

    if (tab === "SR") {
      $("formSR").style.display = "block";
      targetId = "formSR";
    }

    if (tab === "CONS") {
      $("formCONS").style.display = "block";
      targetId = "formCONS";
    }

    if (tab === "BIO") {
      $("formBIO").style.display = "block";
      targetId = "formBIO";
    }

    if (tab === "PINOL") {
      $("formPINOL").style.display = "block";
      targetId = "formPINOL";
    }

    if (!sameTab) {
      schedulePanelScroll(targetId, 80, true);
    }

    updateCaptureStateBanner();
    applyCaptureLockState();
    applyCaptureNameAutocomplete();
    bindFastNumericFocus();

    if (tab === "CONS") {
      bindCaptureUtilityEvents();
      syncAguja();
    }
  }

  function activateOpsTab(tab) {
    const currentOpsTab = APP_STATE.opsTab || "CAPTURE";
    const sameTab = currentOpsTab === tab;

    syncAppState({ opsTab: tab });

    if (tab === "CAPTURE") clearTabAttention("tabOPS_CAPTURE");
    if (tab === "PINOL") clearTabAttention("tabOPS_PINOL");
    if (tab === "HISTORY") clearTabAttention("tabOPS_HISTORY");
    if (tab === "LOTES") clearTabAttention("tabLOTES");

     const role = String((USER && USER.rol) || "").trim().toUpperCase();
     const isOps = ["ADMIN", "MUNICIPAL", "JURISDICCIONAL"].includes(role);
     const canSeeLotes = ["ADMIN", "JURISDICCIONAL"].includes(role);

     if (tab === "LOTES" && !canSeeLotes) return;
     if (!isOps) return;

    const panelCaptureSummary = $("panelCaptureSummary");
    const panelPINOLADMIN = $("panelPINOLADMIN");
    const panelHISTORY = $("panelHISTORY");
    const panelLOTES = $("panelLOTES");

    const updateTabClass = (id, cond) => {
      const el = $(id);
      if (el) {
        if (cond) { el.classList.add("tab-active"); el.classList.remove("tab-inactive"); }
        else { el.classList.add("tab-inactive"); el.classList.remove("tab-active"); }
      }
    };

    updateTabClass("tabOPS_CAPTURE", tab === "CAPTURE");
    updateTabClass("tabOPS_PINOL", tab === "PINOL");
    updateTabClass("tabOPS_HISTORY", tab === "HISTORY");
    updateTabClass("tabLOTES", tab === "LOTES");
    updateTabClass("tabOPS_ADMIN", false); // Siempre desactiva admin al entrar a una opsTab

    // Si no estamos en el panel de CAP (Dashboard), forzamos el cambio
    if (APP_STATE.mainPanel !== "CAP") {
      activateMain("CAP", tab);
    }

    if (panelCaptureSummary) panelCaptureSummary.style.display = (tab === "CAPTURE") ? "block" : "none";
    if ($("panelEDITLOG")) $("panelEDITLOG").style.display = "none";
    if (panelPINOLADMIN) panelPINOLADMIN.style.display = (tab === "PINOL") ? "block" : "none";
    if (panelHISTORY) panelHISTORY.style.display = (tab === "HISTORY") ? "block" : "none";
    if (panelLOTES) panelLOTES.style.display = (tab === "LOTES") ? "block" : "none";

    if (tab === "CAPTURE" && !sameTab) {
      runSinglePanelTask("ops-tab-capture", () => reloadCaptureSummarySilent())
        .finally(() => {
          schedulePanelScroll("panelCaptureSummary", 80, true);
          clearTabAttention("tabCAP");
          scheduleOpsPrewarm(180);
        });
    }

    if (tab === "PINOL" && !sameTab) {
      runSinglePanelTask("ops-tab-pinol", () => refreshPinol())
        .finally(() => {
          refreshPinolBadgeOnly().catch(() => { });
          scheduleOpsPrewarm(180);
          schedulePanelScroll("panelPINOLADMIN", 80, true);
          clearTabAttention("tabCAP");
        });
    }

    if (tab === "HISTORY" && !sameTab) {
      runSinglePanelTask("ops-tab-history", () => reloadHistorySilent())
        .finally(() => {
          schedulePanelScroll("panelHISTORY", 80, true);
          scheduleOpsPrewarm(180);
        });
    }

    if (tab === "LOTES") {
      // MEJORA: Siempre refrescar o asegurar que hay datos al entrar
      activateLotesAdmin();
    }
  }

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

        if (data) {
          renderCaptureSummary(data);
          commitPanelFilterState("captureSummary", `${fecha}__${tipo}`);
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
        const inicio = $("histFechaInicio")?.value || todayYmdLocal();
        const fin = $("histFechaFin")?.value || todayYmdLocal();

        const data = await smartLoader(
          () => getHistoryMetrics(inicio, fin, !!force),
          {
            delay: 220,
            message: "Cargando métricas…",
            title: "Histórico"
          }
        );

        if (data) {
          renderHistoryMetrics(data);
          commitPanelFilterState("historyMetrics", `${inicio}__${fin}`);
        }

        return data;
      } catch (e) {
        console.error("reloadHistorySilent error:", e);
        return null;
      }
    });
  }
  // (El listener de loginForm ya está registrado al inicio del archivo)


$("btnSaveSR").onclick = async () => {
  if (isBtnBusy("btnSaveSR")) return;

  const nombre = $("nombreSR") ? $("nombreSR").value.trim() : "";
  if (!nombre) {
    showToast("Por favor, ingresa el nombre del responsable", false, "warn");
    return;
  }

  const items = [];
  let hasInvalid = false;
  document.querySelectorAll("#srCaptureTbody tr").forEach(tr => {
    const cache = tr._cache || {};
    const bioSelect = cache.bioSelect || tr.querySelector(".sr-bio-select");
    const loteSelect = cache.loteSelect || tr.querySelector(".sr-lote-select");
    const cantidadInput = cache.cantidadInput || tr.querySelector(".sr-cantidad-input");
    const recepcionInput = cache.recepcionInput || tr.querySelector(".sr-recepcion-input");

    const bio = bioSelect.value;
    const lote = loteSelect.value;
    const cantidad = cantidadInput.value;
    const recepcion = recepcionInput.value;

    if (!bio && !lote && !cantidad) return; // Fila vacía, ignorar

    if (!bio || !lote || cantidad === "" || Number(cantidad) < 0) {
      hasInvalid = true;
      tr.style.background = "rgba(239, 68, 68, 0.1)";
    } else {
      tr.style.background = "";
      items.push({
        biologico: bio,
        lote: lote,
        cantidad: Number(cantidad),
        fecha_recepcion: recepcion
      });
    }
  });

  if (hasInvalid) {
    showToast("Corrige las filas en rojo (biológico, lote y cantidad)", false, "warn");
    return;
  }

  if (items.length === 0) {
    showToast("Captura al menos un biológico con lote y cantidad", false, "warn");
    return;
  }

  setBtnBusy("btnSaveSR", true, EDIT_SR ? "Actualizando…" : "Guardando…");
  showOverlay(
    EDIT_SR ? "Actualizando existencia…" : "Guardando existencia…",
    EDIT_SR ? "Actualizando" : "Guardando"
  );

  try {
    saveUxValue(UX_KEYS.existenciaName, nombre);

    if (HAS_TODAY_SR && !EDIT_SR) {
      showToast("Ya existe una captura de hoy. Usa el botón Editar.", false, "warn");
      return;
    }

    // === GUARDADO EN FIRESTORE ===
    const res = await apiCall({
      action: "saveSR",
      fecha: todayYmdLocal(),
      nombre: nombre,
      items: items,
      editado: EDIT_SR ? "SI" : "NO"
    });

    if (!res.ok) throw new Error(res.error || "Error en apiCall");

    muteRealtimeFor(12000);
    showToast(EDIT_SR ? "Existencia actualizada" : "Existencia guardada", true, "good");
    pushLiveEvent("Existencia de biológicos", EDIT_SR ? "Actualizada correctamente." : "Guardada correctamente.", "good");

    flashElement("formSR");
    setSavedStamp();

    await refreshAfterMutation({ touchToday: true, touchCaptureSummary: true, touchHistory: true });

  } catch (e) {
    console.error("btnSaveSR error:", e);
    showToast("Error de conexión al guardar", false);
  } finally {
    setBtnBusy("btnSaveSR", false);
    hideOverlay();
  }
};

  $("btnExportSelectAll").onclick = () => {
    document.querySelectorAll(".exportMunicipioChk").forEach(chk => chk.checked = true);
  };

  $("btnExportClearAll").onclick = () => {
    document.querySelectorAll(".exportMunicipioChk").forEach(chk => chk.checked = false);
  };

  $("exportTipo").addEventListener("change", updateExportFechaHint);

  refreshExportSplitUi();

  $("btnSaveCONS").onclick = async () => {
    if (isBtnBusy("btnSaveCONS")) return;
    setBtnBusy("btnSaveCONS", true, EDIT_CONS ? "Actualizando…" : "Guardando…");
    showOverlay(
      EDIT_CONS ? "Estamos actualizando el reporte de consumibles…" : "Estamos guardando el reporte de consumibles…",
      EDIT_CONS ? "Actualizando consumibles" : "Guardando consumibles"
    );

    try {
      const nombre = $("nombreCONS") ? $("nombreCONS").value.trim() : "";
      saveUxValue(UX_KEYS.consName, nombre);
      syncAguja();

      if (!nombre) {
        showToast("Por favor, ingresa el nombre del responsable", false, "warn");
        return;
      }

      // Validar numéricos
      const numFields = ["srp_dosis", "sr_dosis", "jeringa_reconst_5ml_0605500438", "jeringa_aplic_05ml_0605502657"];
      for (const f of numFields) {
        const val = $(f)?.value;
        if (val !== "" && (isNaN(val) || Number(val) < 0)) {
          showToast("Ingresa valores numéricos válidos (0 o más)", false, "warn");
          flashElement(f);
          return;
        }
      }

      if (HAS_TODAY_CONS && !EDIT_CONS) {
        showToast("Ya existe un reporte de hoy. Usa el botón Editar reporte de hoy.", false, "warn");
        return;
      }

      if (EDIT_CONS && !hasCONSNumericChanges()) {
        showToast("No hiciste cambios en los valores numéricos de consumibles", false, "warn");
        return;
      }

      const safeNum = (id) => {
        const el = $(id);
        return Number(el && el.value !== "" ? el.value : 0);
      };

      const action = EDIT_CONS ? "updateConsumibles" : "saveConsumibles";

      const r = await apiCall({
        action,
        token: TOKEN,
        nombre,
        srp_dosis: safeNum("srp_dosis"),
        sr_dosis: safeNum("sr_dosis"),
        jeringa_reconst_5ml_0605500438: safeNum("jeringa_reconst_5ml_0605500438"),
        jeringa_aplic_05ml_0605502657: safeNum("jeringa_aplic_05ml_0605502657"),
        aguja_0600403711: safeNum("aguja_0600403711")
      });

      if (!r || !r.ok) {
        const msg = (r && r.error) ? r.error : "No se pudo guardar";

        if (msg.toLowerCase().includes("ya existe un reporte") || msg.toLowerCase().includes("editar")) {
          invalidateTodayCache();
          const today = await getTodayReports(todayYmdLocal());
          hydrateTodayForms(today);
          showToast(msg, false, "warn");
          return;
        }

        showToast(msg, false);
        return;
      }
      muteRealtimeFor(12000);
      showToast(EDIT_CONS ? "Reporte de consumibles actualizado correctamente" : "Reporte de consumibles guardado correctamente");
      pushLiveEvent(
        "Consumibles",
        EDIT_CONS ? "El reporte de consumibles fue actualizado correctamente." : "El reporte de consumibles fue guardado correctamente.",
        "good"
      );
      flashElement("formCONS");
      setSavedStamp();

      await refreshAfterMutation({
        touchToday: true,
        touchCaptureSummary: true,
        touchHistory: true
      });

    } catch (e) {
      console.error("btnSaveCONS error:", e);
      showToast("Error al guardar", false);
    } finally {
      setBtnBusy("btnSaveCONS", false);
      hideOverlay();
    }
  };

  $("btnSaveBIO").onclick = async () => {
    if (isBtnBusy("btnSaveBIO")) return;

    const bioValidation = refreshBioAlerts(true);

    if (!BIO_STATE.canCapture) {
      showToast(
        `La captura de pedido biológico está habilitada del ${BIO_STATE.captureWindowStart || "—"} al ${BIO_STATE.captureWindowEnd || "—"}.`,
        false,
        "warn"
      );
      return;
    }

    if (HAS_SAVED_BIO && !EDIT_BIO) {
      showToast("Este pedido ya fue capturado. Usa el botón Editar pedido actual.", false, "warn");
      return;
    }

    if (bioValidation && bioValidation.hasBlockingError) {
      showToast("Corrige los biológicos con error antes de guardar. La única restricción bloqueante es el múltiplo configurado.", false, "warn");
      return;
    }

    const nombre = $("nombreBIO") ? $("nombreBIO").value.trim() : "";
    saveUxValue(UX_KEYS.bioName, nombre);

    const items = collectBioItems();
    const warningRows = [];

    const bioStateByKey = {};
    (BIO_STATE.rows || []).forEach(r => {
      const key = String(r && r.biologico || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toUpperCase();

      if (!key) return;
      bioStateByKey[key] = r;
    });

    items.forEach((item) => {
      const itemKey = String(item && item.biologico || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toUpperCase();

      const r = bioStateByKey[itemKey] || {};
      const bioKey = itemKey;

      const sinValidacionOperativa = [
        "INFLUENZA",
        "COVID-19",
        "COVID 19",
        "VPH",
        "HEPATITIS A",
        "VARICELA"
      ].includes(bioKey);

      const omitirAdvertenciaPorCaravana =
        isCurrentUnitCaravana() && bioKey === "BCG";

      if (sinValidacionOperativa || omitirAdvertenciaPorCaravana) return;

      const existencia = Number(item.existencia_actual_frascos || 0);
      const pedido = Number(item.pedido_frascos || 0);
      const promedio = Number(r.promedio_frascos || 0);
      const totalDisponible = existencia + pedido;

      if (promedio > 0 && totalDisponible < promedio) {
        warningRows.push(
          `• ${r.biologico || item.biologico}: existencia ${existencia} + pedido ${pedido} = ${totalDisponible}; promedio ${promedio}.`
        );
      }
    });

    if (warningRows.length) {
      const ok = await openBioConfirm(warningRows);
      if (!ok) return;
    }

    setBtnBusy("btnSaveBIO", true, EDIT_BIO ? "Actualizando…" : "Guardando…");
    showOverlay(
      EDIT_BIO ? "Estamos actualizando el pedido biológico…" : "Estamos guardando el pedido biológico…",
      EDIT_BIO ? "Actualizando pedido" : "Guardando pedido"
    );

    try {
      const r = await apiCall({
        action: "saveBio",
        token: TOKEN,
        nombre,
        items,
        tipo_pedido: BIO_STATE.isInsideWindow ? "MENSUAL" : "EXTRAORDINARIO",
        sin_pedido: $("chkNoPedido") ? $("chkNoPedido").checked : false
      });

      if (!r || !r.ok) {
        showToast((r && r.error) ? r.error : "No se pudo guardar el pedido de biológico", false);
        return;
      }

      muteRealtimeFor(12000);

      const insertedCount = Number((r && r.insertedCount) || 0);
      const updatedCount = Number((r && r.updatedCount) || 0);
      const fechaProgramada = (r && r.fecha_pedido_programada) ? r.fecha_pedido_programada : "—";

      const msgOk =
        `Pedido ${EDIT_BIO ? "actualizado" : "guardado"}. Fecha programada: ${fechaProgramada}. Insertados: ${insertedCount}. Actualizados: ${updatedCount}.`;

      showToast(msgOk, true, "good");

      pushLiveEvent(
        "Pedido de biológico",
        msgOk,
        "good"
      );

      flashElement("formBIO");
      setSavedStamp();

      if (r) {
        console.log("saveBio spreadsheet_url:", r.spreadsheet_url);
        console.log("saveBio spreadsheet_id:", r.spreadsheet_id);
        console.log("saveBio spreadsheet_name:", r.spreadsheet_name);
        console.log("saveBio sheet_name:", r.sheet_name);
      }

      await refreshAfterMutation({
        touchToday: true,
        touchCaptureSummary: true,
        touchHistory: true
      });

      await loadBioForm(true);
    } catch (e) {
      console.error("btnSaveBIO error:", e);
      showToast("Error al guardar pedido de biológico", false);
    } finally {
      setBtnBusy("btnSaveBIO", false);
      hideOverlay();
    }
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
    if (isBtnBusy("btnSavePINOL")) return;
    setBtnBusy("btnSavePINOL", true, "Guardando…");
    showOverlay("Guardando solicitud de pinol…");
    try {
      const nombrePINOL = $("nombrePINOL").value.trim();
      saveUxValue(UX_KEYS.pinolName, nombrePINOL);

      const r = await apiCall({
        action: "savePinol",
        token: TOKEN,
        nombre: nombrePINOL,
        existencia_actual_botellas: $("pinol_existencia").value,
        solicitud_botellas: $("pinol_solicitud").value,
        observaciones: $("pinol_observaciones").value.trim()
      });

      if (!r || !r.ok) {
        showToast((r && r.error) ? r.error : "No se pudo guardar la solicitud", false);
        return;
      }

      muteRealtimeFor(12000);
      showToast("Solicitud de pinol guardada");
      pushLiveEvent("Pinol", "Tu solicitud fue enviada correctamente.", "good");
      flashElement("formPINOL");
      setSavedStamp();

      $("nombrePINOL").value = "";
      $("pinol_existencia").value = "";
      $("pinol_solicitud").value = "";
      $("pinol_observaciones").value = "";

      await refreshAfterMutation({
        touchPinol: true
      });

    } catch (e) {
      showToast("Error al guardar solicitud de pinol", false);
    } finally {
      setBtnBusy("btnSavePINOL", false);
      hideOverlay();
    }
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
      if (tipo === "BIO") {
        const exactBox = $("exportBioExactDateBox");
        if (exactBox && exactBox.style.display !== "none" && $("exportBioExactDate").value) {
          fIni = $("exportBioExactDate").value;
        } else {
          const mm = $("exportMonth") ? $("exportMonth").value : "01";
          const yy = $("exportYear") ? $("exportYear").value : "2024";
          fIni = `${yy}-${mm}-01`;
        }
      } else {
        fIni = $("exportFechaInicio").value || todayYmdLocal();
      }

      const fFin = (tipo === "BIO" ? fIni : ($("exportFechaFin").value || fIni));

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
    wb.creator = 'JS1 Reportes';
    const sheetName = tipo === "SR" ? "EXISTENCIAS" : (tipo === "CONS" ? "CONSUMIBLES" : "PEDIDOS");
    const ws = wb.addWorksheet(sheetName, { views: [{ showGridLines: false }] });

    const unidadesSet = new Set();
    const mapUnidades = {};
    
    data.forEach(d => {
      unidadesSet.add(d.clues);
      if (d.unidades && d.unidades.nombre) {
        mapUnidades[d.clues] = d.unidades.nombre.toUpperCase();
      } else {
        mapUnidades[d.clues] = (d.unidad || "UNIDAD DESCONOCIDA").toUpperCase();
      }
    });

    const arrClues = Array.from(unidadesSet).sort();
    
    let insumos = [];
    if (tipo === "CONS") {
      insumos = [
        { key: "srp_dosis", label: "DOSIS DE SRP", color: "A75985" },
        { key: "sr_dosis", label: "DOSIS DE SR", color: "5C4B92" },
        { key: "jeringa_reconst_5ml_0605500438", label: "JERINGA DE RECONSTITUCIÓN 5 mL", color: "EAD1DC" },
        { key: "jeringa_aplic_05ml_0605502657", label: "JERINGA DE APLICACIÓN 0.5 mL", color: "E2B7A8" },
        { key: "aguja_0600403711", label: "AGUJA", color: "E1955D" }
      ];
    } else {
      insumos = [
        { key: "BCG", label: "BCG", color: "4A86E8" },
        { key: "HEPATITIS 10", label: "HEPATITIS 10", color: "CC0000" },
        { key: "HEXAVALENTE", label: "HEXAVALENTE", color: "93C47D" },
        { key: "DPT", label: "DPT", color: "F1C232" },
        { key: "ROTAVIRUS", label: "ROTAVIRUS", color: "3D85C6" },
        { key: "NEUMOCOCO 13", label: "NEUMOCOCO 13", color: "1155CC" },
        { key: "NEUMOCOCO 23", label: "NEUMOCOCO 23", color: "0B5394" },
        { key: "SRP", label: "SRP", color: "A64D79" },
        { key: "SR", label: "SR", color: "741B47" },
        { key: "VPH", label: "VPH", color: "76A5AF" },
        { key: "VARICELA", label: "VARICELA", color: "45818E" },
        { key: "HEPATITIS 20", label: "HEPATITIS 20", color: "8E7CC3" },
        { key: "TD", label: "TD", color: "999999" },
        { key: "TDPA", label: "TDPA", color: "E69138" },
        { key: "INFLUENZA", label: "INFLUENZA", color: "B6D7A8" },
        { key: "RABIA", label: "RABIA", color: "C90076" },
        { key: "FAVI", label: "FAVI", color: "A61D2B" }
      ];
    }

    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F3E46' } };
    const fontWhite = { color: { argb: 'FFFFFFFF' }, bold: true, name: 'Arial', size: 12 };
    const borderAll = {
      top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
    };
    
    let headerRowText = tipo === "SR" ? "EXISTENCIA DE BIOLÓGICO" : (tipo === "CONS" ? "CONSUMIBLES SR/SRP" : "PEDIDO BIOLÓGICO");

    ws.getCell('A1').value = 'REPORTE';
    ws.getCell('A1').fill = headerFill;
    ws.getCell('A1').font = fontWhite;
    ws.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
    ws.mergeCells('A1:B1');
    ws.getCell('C1').value = headerRowText;
    ws.getCell('C1').font = { color: { argb: 'FFFFFFFF' }, bold: true, name: 'Arial', size: 18 };
    ws.getCell('C1').fill = headerFill;
    ws.getCell('C1').alignment = { vertical: 'middle', horizontal: 'center' };
    ws.mergeCells(1, 3, 1, 3 + arrClues.length);
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
    ws.getCell(2, Math.max(3, lastColIndex)).value = (tipo==='BIO'? 'FECHA PEDIDO: ': 'FECHA REPORTE: ') + fIni;
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

    if (tipo !== "CONS") {
      ws.getCell(headerRowIdx, colIndex).value = "TOTAL";
      ws.getCell(headerRowIdx, colIndex).fill = headerFill;
      ws.getCell(headerRowIdx, colIndex).font = fontWhite;
      ws.getCell(headerRowIdx, colIndex).alignment = { vertical: 'middle', horizontal: 'center' };
      ws.getCell(headerRowIdx, colIndex).border = borderAll;
      colIndex++;
    }

    ws.getColumn(1).width = 30;
    headerRow.height = 40;

    let rowCursor = tipo === "BIO" ? 5 : 4;

    insumos.forEach(insumo => {
      let cIdx = 1;
      const fgColor = { argb: 'FF' + insumo.color.replace('#', '') };
      
      ws.getCell(rowCursor, cIdx).value = insumo.label;
      ws.getCell(rowCursor, cIdx).fill = { type: 'pattern', pattern: 'solid', fgColor };
      ws.getCell(rowCursor, cIdx).font = { color: { argb: 'FFFFFFFF' }, bold: true };
      ws.getCell(rowCursor, cIdx).border = borderAll;
      
      let rowTotal = 0;
      cIdx++;

      arrClues.forEach(clues => {
        let val = 0;
        const matchingRecords = data.filter(d => d.clues === clues);
        
        if (tipo === "CONS") {
          matchingRecords.forEach(d => { val += Number(d[insumo.key] || 0); });
        } else if (tipo === "SR") {
          matchingRecords.filter(d => String(d.biologico).toUpperCase() === String(insumo.label).toUpperCase())
            .forEach(d => { val += Number(d.cantidad_frascos || 0); });
        } else {
          matchingRecords.filter(d => String(d.biologico).toUpperCase() === String(insumo.label).toUpperCase())
            .forEach(d => { val += Number(d.pedido_frascos || 0); });
        }

        rowTotal += val;
        ws.getCell(rowCursor, cIdx).value = val || '';
        ws.getCell(rowCursor, cIdx).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '40' + insumo.color } };
        ws.getCell(rowCursor, cIdx).border = borderAll;
        ws.getCell(rowCursor, cIdx).alignment = { horizontal: 'center' };
        cIdx++;
      });

      if (tipo !== "CONS") {
        ws.getCell(rowCursor, cIdx).value = rowTotal || '';
        ws.getCell(rowCursor, cIdx).border = borderAll;
        ws.getCell(rowCursor, cIdx).alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getCell(rowCursor, cIdx).font = { bold: true };
      }
      rowCursor++;
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_${tipo}_${fIni}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  // --- PANEL ADMINISTRATIVO (LOGICA MODULAR) ---
  window.activateAdminSubPanel = function(panelId) {
    // 1. Alternar Clases de Pestañas
    document.querySelectorAll(".nav-tab-admin").forEach(btn => {
      const isTarget = btn.id === "tabAdmin" + panelId.charAt(0).toUpperCase() + panelId.slice(1);
      btn.classList.toggle("active", isTarget);
    });

    // 2. Alternar Visibilidad de Paneles
    document.querySelectorAll(".admin-sub-panel").forEach(p => {
      const isTarget = p.id === "adminSection_" + panelId;
      p.classList.toggle("hide", !isTarget);
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
      if (!r || !r.ok) {
        if ($("consOverrideStateTxt")) $("consOverrideStateTxt").textContent = "REGLA ESTÁNDAR";
        return;
      }
      
      const data = r.data || {};
      if ($("consOverrideDate")) $("consOverrideDate").value = data.fecha || "";
      if ($("consOverrideReason")) $("consOverrideReason").value = data.motivo || "";
      if ($("consOverrideStateTxt")) {
        $("consOverrideStateTxt").textContent = data.fecha ? "ACTIVA: " + formatDateMx(data.fecha) : "REGLA ESTÁNDAR";
      }
    } catch (e) {
      console.error("loadConsumiblesOverrideAdmin error:", e);
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
      $("tabCONS").disabled = !can;
      $("tabCONS").title = can ? (STATUS.consumiblesReason || "Abierto") : "Cerrado: Solo jueves o por apertura extraordinaria";
      
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


  async function refreshUsers() {
    if (!USER || USER.rol !== "ADMIN") return;

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
      const cards = $("usersCards");

      if (!tbody) throw new Error("No existe #usersTbody");
      if (!cards) console.warn("No existe #usersCards");

      tbody.innerHTML = "";
      if (cards) cards.innerHTML = "";

      if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="muted">Sin usuarios</td></tr>`;
        if (cards) {
          cards.style.display = "block";
          cards.innerHTML = `<div class="muted" style="margin-top:10px;">Sin usuarios</div>`;
        }
        return;
      }

      for (const u of users) {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-primary/5 transition-colors group border-b border-outline-variant/30";
        
        const isActivo = u.activo === "SI";
        const roleClass = u.rol === "ADMIN" ? "bg-primary/10 text-primary border-primary/20" : "bg-slate-100 text-slate-600 border-slate-200";
        const statusClass = isActivo ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700";

        tr.innerHTML = `
        <td class="px-6 py-5">
           <div class="flex flex-col">
              <span class="font-extrabold text-primary text-[14px]">${escapeHtml(u.usuario)}</span>
              <span class="text-[10px] font-bold text-slate-400">CUENTA ACTIVA</span>
           </div>
        </td>
        <td class="px-6 py-5">
           <div class="flex flex-col gap-0.5">
              <span class="text-[11px] font-black text-slate-600 uppercase tracking-tighter">${escapeHtml(u.unidad || 'Unidad No Asignada')}</span>
              <span class="text-[10px] font-bold text-slate-400">${escapeHtml(u.municipio)} | <span class="text-primary/70">${escapeHtml(u.clues)}</span></span>
           </div>
        </td>
        <td class="px-6 py-5">
           <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${roleClass}">${escapeHtml(u.rol)}</span>
        </td>
        <td class="px-6 py-5">
           <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full ${isActivo ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-400'}"></span>
              <span class="text-[11px] font-black uppercase ${statusClass.split(' ')[1]}">${isActivo ? 'Habilitado' : 'Suspendido'}</span>
           </div>
        </td>
        <td class="px-6 py-5 text-right">
          <div class="flex items-center justify-end gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
            <button class="w-8 h-8 rounded-xl bg-surface-variant flex items-center justify-center text-surface-on hover:bg-primary hover:text-white transition-all shadow-sm" data-action="reset" data-user="${escapeAttr(u.usuario)}" title="Nueva Contraseña">
              <span class="material-symbols-rounded text-lg">key</span>
            </button>
            <button class="w-8 h-8 rounded-xl ${isActivo ? 'bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white'} flex items-center justify-center transition-all shadow-sm" data-action="toggle" data-user="${escapeAttr(u.usuario)}" data-active="${escapeAttr(u.activo)}" title="${isActivo ? 'Bloquear Acceso' : 'Activar Acceso'}">
              <span class="material-symbols-rounded text-lg">${isActivo ? 'block' : 'check_circle'}</span>
            </button>
            <button class="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white flex items-center justify-center transition-all shadow-sm" data-action="delete" data-user="${escapeAttr(u.usuario)}" title="Eliminar definitivamente">
              <span class="material-symbols-rounded text-lg">delete</span>
            </button>
          </div>
        </td>`;
        tbody.appendChild(tr);

        // Cards Mobile (Modernizadas)
        if (cards) {
          const card = document.createElement("div");
          card.className = "bg-white p-6 rounded-[28px] border border-outline-variant/30 shadow-sm flex flex-col gap-4";
          card.innerHTML = `
            <div class="flex items-center justify-between">
               <div class="flex flex-col">
                 <span class="text-[14px] font-black text-primary">${escapeHtml(u.usuario)}</span>
                 <span class="text-[10px] font-black uppercase text-slate-400 tracking-widest">${escapeHtml(u.rol)}</span>
               </div>
               <span class="px-3 py-1 rounded-full text-[10px] font-black ${statusClass}">${isActivo ? 'ACTIVO' : 'SUSPENDIDO'}</span>
            </div>
            <div class="text-[11px] font-bold text-slate-600 leading-snug">
               <span class="text-primary/70">${escapeHtml(u.clues)}</span> — ${escapeHtml(u.unidad || 'Sin Unidad')}
            </div>
            <div class="grid grid-cols-3 gap-2 border-t border-outline-variant/20 pt-4">
               <button class="h-11 rounded-2xl bg-surface-variant flex items-center justify-center text-primary" data-action="reset" data-user="${escapeAttr(u.usuario)}"><span class="material-symbols-rounded text-xl">key</span></button>
               <button class="h-11 rounded-2xl bg-surface-variant flex items-center justify-center text-primary" data-action="toggle" data-user="${escapeAttr(u.usuario)}" data-active="${escapeAttr(u.activo)}"><span class="material-symbols-rounded text-xl">${isActivo ? 'lock' : 'lock_open'}</span></button>
               <button type="button" class="md-delete-btn group" title="Eliminar usuario" onclick="deleteUserFlow('${escapeAttr(u.usuario)}')">
                 <svg viewBox="0 0 24 24" class="w-6 h-6">
                   <path class="trash-lid transition-transform duration-200 group-hover:-translate-y-1" fill="currentColor" d="M15 4V3H9v1H4v2h16V4h-5z" />
                   <path fill="currentColor" d="M5 21a2 2 0 002 2h10a2 2 0 002-2V7H5v14zM8 9h2v10H8V9zm4 0h2v10h-2V9zm4 0h2v10h-2V9z" />
                 </svg>
               </button>
            </div>
          `;
          cards.appendChild(card);
        }
      }

      // VINCULAR EVENTOS
      document.querySelectorAll("#usersTbody .miniBtn, #usersCards .miniBtn").forEach(btn => {
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

    return Array.isArray(data) ? data : [];
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
      pushLiveEvent(
        "Pinol entregado",
        "Se notificó a la unidad que su solicitud fue entregada.",
        "good",
        "panelPINOLADMIN",
        { cooldownMs: 1400 }
      );

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

  async function refreshPinol() {
    if (!USER || (USER.rol !== "ADMIN" && USER.rol !== "MUNICIPAL")) return;

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
      const cards = $("pinolCards");
      const filtroSel = $("pinolFiltroEstatus");
      const totalEl = $("pinolTotal");
      const pendientesEl = $("pinolPendientes");
      const entregadasEl = $("pinolEntregadas");
      const recibidasEl = $("pinolRecibidas");
      const alertMsgEl = $("pinolAlertMsg");

      if (!tbody) throw new Error("No existe #pinolTbody");
      if (!cards) console.warn("No existe #pinolCards");

      const filtro = filtroSel
        ? String(filtroSel.value || "TODOS").toUpperCase()
        : "TODOS";

      const safeItems = Array.isArray(items) ? items : [];

      const total = safeItems.length;
      const pendientes = safeItems.filter(x => String(x?.estatus_visual || x?.estatus || "PENDIENTE").toUpperCase() === "PENDIENTE");
      const entregadas = safeItems.filter(x => String(x?.estatus_visual || x?.estatus || "").toUpperCase() === "ENTREGADO");
      const recibidas = safeItems.filter(x => String(x?.estatus_visual || x?.estatus || "").toUpperCase() === "RECIBIDO");

      updatePinolTabBadge(safeItems);

      if (totalEl) totalEl.textContent = String(total);
      if (pendientesEl) pendientesEl.textContent = String(pendientes.length);
      if (entregadasEl) entregadasEl.textContent = String(entregadas.length);
      if (recibidasEl) recibidasEl.textContent = String(recibidas.length);

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
        if (cards) {
          cards.style.display = "block";
          cards.innerHTML = `<div class="muted" style="margin-top:10px;">Sin solicitudes para ese filtro</div>`;
        }
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
        return `
        <tr>
          <td>${escapeHtml(x?.fecha_solicitud || "")}</td>
          <td>${escapeHtml(x?.municipio || "")}</td>
          <td>${escapeHtml(x?.clues || "")}</td>
          <td>${escapeHtml(x?.unidad || "")}</td>
          <td>${Number(x?.existencia_actual_botellas || 0)}</td>
          <td>${Number(x?.solicitud_botellas || 0)}</td>
          <td>${escapeHtml(x?.observaciones || "")}</td>
          <td>${escapeHtml(x?.capturado_por || "")}</td>
          <td>${escapeHtml(x?.fecha_entrega || "")}</td>
          <td>${escapeHtml(x?.entregado_por || "")}</td>
          <td>${estatusHtml}</td>
          <td>
            ${estatus === "PENDIENTE"
            ? `<button class="miniBtn btnPinolDeliver" data-id="${escapeAttr(x?.id || "")}">
    <span class="material-symbols-rounded">local_shipping</span> Entregar
  </button>`
            : `<span class="muted">—</span>`
          }
          </td>
        </tr>
      `;
      }).join("");

      if (cards) {
        cards.style.display = "block";
        cards.innerHTML = filtered.map(x => {
          const estatus = String(x?.estatus_visual || x?.estatus || "").toUpperCase();

          let statusLabel = "Pendiente";
          let badgeClass = "warn";

          if (estatus === "ENTREGADO") {
            statusLabel = "Entregado";
            badgeClass = "ok";
          }

          if (estatus === "RECIBIDO") {
            statusLabel = "Recibido";
            badgeClass = "good";
          }

          return `
          <div class="mobileInfoCard">
            <div class="mobileInfoHead">
              <div class="mobileInfoTitle">${escapeHtml(x?.unidad || "Unidad sin nombre")}</div>
              <div class="mobileInfoBadge ${badgeClass}">
                ${statusLabel}
              </div>
            </div>

            <div class="mobileInfoFields">
              <div class="mobileInfoField">
                <div class="mobileInfoLabel">Fecha</div>
                <div class="mobileInfoValue">${escapeHtml(x?.fecha_solicitud || "")}</div>
              </div>

              <div class="mobileInfoField">
                <div class="mobileInfoLabel">Municipio</div>
                <div class="mobileInfoValue">${escapeHtml(x?.municipio || "")}</div>
              </div>

              <div class="mobileInfoField">
                <div class="mobileInfoLabel">CLUES</div>
                <div class="mobileInfoValue">${escapeHtml(x?.clues || "")}</div>
              </div>

              <div class="mobileInfoField">
                <div class="mobileInfoLabel">Existencia actual</div>
                <div class="mobileInfoValue">${Number(x?.existencia_actual_botellas || 0)} botella(s)</div>
              </div>

              <div class="mobileInfoField">
                <div class="mobileInfoLabel">Solicitud</div>
                <div class="mobileInfoValue">${Number(x?.solicitud_botellas || 0)} botella(s) de 828 mL</div>
              </div>

              <div class="mobileInfoField">
                <div class="mobileInfoLabel">Observaciones</div>
                <div class="mobileInfoValue">${escapeHtml(x?.observaciones || "—")}</div>
              </div>

              <div class="mobileInfoField">
                <div class="mobileInfoLabel">Capturó</div>
                <div class="mobileInfoValue">${escapeHtml(x?.capturado_por || "")}</div>
              </div>

              <div class="mobileInfoField">
                <div class="mobileInfoLabel">Fecha entrega</div>
                <div class="mobileInfoValue">${escapeHtml(x?.fecha_entrega || "—")}</div>
              </div>

              <div class="mobileInfoField">
                <div class="mobileInfoLabel">Entregó</div>
                <div class="mobileInfoValue">${escapeHtml(x?.entregado_por || "—")}</div>
              </div>

              ${estatus === "RECIBIDO"
              ? `
                    <div class="mobileInfoField">
                      <div class="mobileInfoLabel">Fecha recibido</div>
                      <div class="mobileInfoValue">${escapeHtml(x?.fecha_recibido || "—")}</div>
                    </div>

                    <div class="mobileInfoField">
                      <div class="mobileInfoLabel">Recibido por</div>
                      <div class="mobileInfoValue">${escapeHtml(x?.recibido_por || "—")}</div>
                    </div>
                  `
              : ``
            }
            </div>

            ${estatus === "PENDIENTE"
              ? `
                  <div class="mobileActionRow">
                    <button class="miniBtn btnPinolDeliver" data-id="${escapeAttr(x?.id || "")}">
                      <span class="material-symbols-rounded">inventory_2</span> Entregar
                    </button>
                  </div>
                `
              : ``
            }
          </div>
        `;
        }).join("");
      }

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

    } catch (e) {
      console.error("refreshPinol error:", e);
      showToast("No se pudo cargar PINOL", false);
    } finally {
      hideOverlay();
    }
  }

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
    { icon: "settings", tag: "Operación", title: "Comunicación", body: "La coordinación entre unidad y jurisdicción mejora la distribución de biológicos." }
  ];
  let factIdx = Math.floor(Math.random() * FACTS.length);

  function rotateFact() {
    renderFact();
  }

  function renderFact() {
    if (!FACTS || !FACTS.length) return;

    const tagEl = $("factTag");
    const titleEl = $("factTitle");
    const bodyEl = $("factBody");
    const iconEl = $("factIcon");

    if (!tagEl || !titleEl || !bodyEl || !iconEl) return;

    const f = FACTS[factIdx % FACTS.length];

    const tagIconMap = {
      "Cadena fría": "ac_unit",
      "Frascos": "science",
      "Inventario": "inventory_2",
      "Planeación": "analytics",
      "Registro": "edit_note",
      "Cobertura": "query_stats",
      "Operación": "settings"
    };

    const curIcon = tagIconMap[f.tag] || f.icon || "syringe";
    tagEl.innerHTML = `<span class="material-symbols-rounded" style="font-size:12px; margin-right:4px;">${curIcon}</span>` + (f.tag || "");
    titleEl.textContent = f.title || "";
    bodyEl.textContent = f.body || "";
    iconEl.textContent = f.icon || "syringe";

    factIdx = (factIdx + 1) % FACTS.length;
  }

  function startFactsRotation() {
    stopFactsRotation();
    renderFact();

    FACTS_TIMER = setInterval(() => {
      if (document.hidden) return;
      renderFact();
    }, 9000);
  }

  function stopFactsRotation() {
    if (FACTS_TIMER) {
      clearInterval(FACTS_TIMER);
      FACTS_TIMER = null;
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !FACTS_TIMER) {
      startFactsRotation();
    }
  });

  // Arranque unificado activo.

  async function getEditLog(fecha, tipo) {
    if (!TOKEN) return [];

    const r = await apiCall({
      action: "getEditLog",
      token: TOKEN,
      fecha: fecha || "",
      tipo: tipo || "TODOS"
    });

    if (!r || !r.ok) return [];
    return Array.isArray(r.data) ? r.data : [];
  }

  async function refreshEditLog() {
    if (!USER || (USER.rol !== "ADMIN" && USER.rol !== "MUNICIPAL" && USER.rol !== "JURISDICCIONAL")) return;

    showOverlay("Cargando historial de ediciones…");
    try {
      const fecha = $("editLogFecha") ? $("editLogFecha").value : "";
      const tipo = $("editLogTipo") ? $("editLogTipo").value : "TODOS";

      const items = await getEditLog(fecha, tipo);
      renderEditLog(items);
    } catch (e) {
      console.error("refreshEditLog error:", e);
      showToast("Error al cargar historial de ediciones", false);
    } finally {
      hideOverlay();
    }
  }

  async function getHistoryMetrics(fechaInicio, fechaFin, force = false) {
    if (!TOKEN) return null;

    const inicio = fechaInicio || todayYmdLocal();
    const fin = fechaFin || todayYmdLocal();
    const cacheKey = buildCacheKey("HISTORY_METRICS", `${inicio}::${fin}`);

    const data = force
      ? await (async () => {
        const r = await apiCall({
          action: "historyMetrics",
          token: TOKEN,
          fechaInicio: inicio,
          fechaFin: fin
        });

        if (!r || !r.ok) return null;
        return r.data || null;
      })()
      : await getCachedOrFetch({
        key: cacheKey,
        ttl: CACHE_TTL.HISTORY_METRICS,
        fetcher: async () => {
          const r = await apiCall({
            action: "historyMetrics",
            token: TOKEN,
            fechaInicio: inicio,
            fechaFin: fin
          });

          if (!r || !r.ok) return null;
          return r.data || null;
        },
        shouldCache: (data) => data != null
      });

    return data || null;
  }

  function renderHistoryMetrics(data) {
    const rows = data?.rows || [];
    const tbody = $("historyTbody");
    const cards = $("historyCards");

    const avgBIO = rows.length ? Math.round(rows.reduce((a, b) => a + Number(b.bio_cumplimiento || 0), 0) / rows.length) : 0;
    const avgCONS = rows.length ? Math.round(rows.reduce((a, b) => a + Number(b.cons_cumplimiento || 0), 0) / rows.length) : 0;

    $("histTotalUnidades").textContent = rows.length;
    $("histPromSR").textContent = `${avgBIO}%`;
    $("histPromCONS").textContent = `${avgCONS}%`;

    // Semáforo automático
    if ($("kpiCardHistSR")) $("kpiCardHistSR").className = "kpiCard " + getComplianceTone(avgBIO);
    if ($("kpiCardHistCONS")) $("kpiCardHistCONS").className = "kpiCard " + getComplianceTone(avgCONS);

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="11" class="muted">Sin datos para ese periodo</td></tr>`;
      if (cards) cards.innerHTML = `<div class="muted">Sin datos para ese periodo</div>`;
      return;
    }

    tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${escapeHtml(r.municipio || "")}</td>
      <td>${escapeHtml(r.clues || "")}</td>
      <td>${escapeHtml(r.unidad || "")}</td>
      <td>${Number(r.cumplimiento_operativo || 0)}%</td>
      <td>${Number(r.bio_cumplimiento || 0)}%</td>
      <td>${Number(r.bio_capturas || 0)}</td>
      <td>${Number(r.bio_faltas || 0)}</td>
      <td>${Number(r.cons_cumplimiento || 0)}%</td>
      <td>${Number(r.cons_capturas || 0)}</td>
      <td>${Number(r.cons_faltas || 0)}</td>
      <td>${escapeHtml(r.ultima_cons || "—")}</td>
    </tr>
  `).join("");

    if (cards) {
      cards.innerHTML = rows.map(r => {
        const tone =
          Number(r.cumplimiento_operativo || 0) >= 90 ? "ok" :
            Number(r.cumplimiento_operativo || 0) >= 70 ? "warn" : "bad";

        return `
        <div class="mobileInfoCard">
          <div class="mobileInfoHead">
            <div class="mobileInfoTitle">${escapeHtml(r.unidad || "Unidad")}</div>
            <div class="mobileInfoBadge ${tone}">
              Operativo ${Number(r.cumplimiento_operativo || 0)}%
            </div>
          </div>

          <div class="mobileInfoFields">
            <div class="mobileInfoField">
              <div class="mobileInfoLabel">Municipio</div>
              <div class="mobileInfoValue">${escapeHtml(r.municipio || "")}</div>
            </div>
            <div class="mobileInfoField">
              <div class="mobileInfoLabel">CLUES</div>
              <div class="mobileInfoValue">${escapeHtml(r.clues || "")}</div>
            </div>
            <div class="mobileInfoField">
              <div class="mobileInfoLabel">Cumplimiento biológico</div>
              <div class="mobileInfoValue">${Number(r.bio_cumplimiento || 0)}% · Capturas: ${Number(r.bio_capturas || 0)} · Faltas: ${Number(r.bio_faltas || 0)}</div>
            </div>
            <div class="mobileInfoField">
              <div class="mobileInfoLabel">Cumplimiento consumibles</div>
              <div class="mobileInfoValue">${Number(r.cons_cumplimiento || 0)}% · Capturas: ${Number(r.cons_capturas || 0)} · Faltas: ${Number(r.cons_faltas || 0)}</div>
            </div>
            <div class="mobileInfoField">
              <div class="mobileInfoLabel">Cumplimiento operativo total</div>
              <div class="mobileInfoValue">${Number(r.cumplimiento_operativo || 0)}% · Capturas: ${Number(r.total_capturado || 0)} · Faltas: ${Number(r.total_faltas || 0)}</div>
            </div>
            <div class="mobileInfoField">
              <div class="mobileInfoLabel">Última consumibles</div>
              <div class="mobileInfoValue">${escapeHtml(r.ultima_cons || "—")}</div>
            </div>
          </div>
        </div>
      `;
      }).join("");
    }
  }

  const ADAPTIVE_MODE_STATE = {
    isMobileLike: null,
    isLowPerf: null,
    widthBucket: null
  };

  let MOBILE_HELPERS_CACHE = null;

  function getAdaptiveWidthBucket() {
    return window.innerWidth <= 820 ? "mobile" : "desktop";
  }

  /**
   * ✅ MICRO-BENCHMARK: Mide la potencia real de cálculo (Math/Loop burst)
   * Ayuda a detectar equipos lentos sin depender solo de especificaciones.
   */
  function runPerfBenchmark() {
    const start = performance.now();
    let sum = 0;
    // Bucle intensivo de 1M de operaciones
    for (let i = 0; i < 1000000; i++) {
      sum += Math.sqrt(i) * Math.sin(i);
    }
    const end = performance.now();
    return end - start; // Tiempo en ms
  }

  function applyAdaptiveModes(force) {
    const perfTime = runPerfBenchmark();
    const lowRam = navigator.deviceMemory && navigator.deviceMemory <= 2;
    const lowCpu = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;

    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const smallScreen = window.innerWidth <= 820;
    const mobileUA = /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(navigator.userAgent);
    const touchPoints = (navigator.maxTouchPoints || 0) > 0;

    const isMobileLike = !!(
      mobileUA ||
      (smallScreen && coarsePointer) ||
      (smallScreen && touchPoints && window.innerWidth <= 820)
    );

    /**
     * Detección inteligente: Si el benchmark tarda más de 30ms (un equipo moderno tarda ~4ms),
     * es un equipo lento. También consideramos el hardware como fallback.
     */
    const isLowPerf = !!(perfTime >= 30 || lowRam || lowCpu);
    const widthBucket = getAdaptiveWidthBucket();

    const mobileChanged = ADAPTIVE_MODE_STATE.isMobileLike !== isMobileLike;
    const lowPerfChanged = ADAPTIVE_MODE_STATE.isLowPerf !== isLowPerf;
    const widthBucketChanged = ADAPTIVE_MODE_STATE.widthBucket !== widthBucket;

    if (!force && !mobileChanged && !lowPerfChanged && !widthBucketChanged) {
      return;
    }

    ADAPTIVE_MODE_STATE.isMobileLike = isMobileLike;
    ADAPTIVE_MODE_STATE.isLowPerf = isLowPerf;
    ADAPTIVE_MODE_STATE.widthBucket = widthBucket;

    document.body.classList.toggle("mobile-mode", isMobileLike);
    document.body.classList.toggle("lowperf", isLowPerf);

    document.documentElement.classList.toggle("mobile-mode", isMobileLike);
    document.documentElement.classList.toggle("lowperf", isLowPerf);

    document.body.setAttribute("data-mobile-mode", isMobileLike ? "on" : "off");
    document.body.setAttribute("data-lowperf-mode", isLowPerf ? "on" : "off");

    refreshMobileUIHelpers(isMobileLike, force || mobileChanged);

    console.log("AdaptiveModes:", {
      isMobileLike,
      isLowPerf,
      benchmark: `${perfTime.toFixed(2)}ms`,
      width: window.innerWidth,
      lowRam,
      lowCpu
    });
  }

  function getMobileHelpersCache() {
    if (MOBILE_HELPERS_CACHE) return MOBILE_HELPERS_CACHE;

    const cardIds = [
      "usersCards",
      "pinolCards",
      "historyCards",
      "editLogCards",
      "capturadasCards",
      "faltantesCards"
    ];

    MOBILE_HELPERS_CACHE = {
      cards: cardIds.map(id => $(id)).filter(Boolean),
      tables: Array.from(document.querySelectorAll(".captureTableDesktop, .pinolTableDesktop, .usersTableDesktop"))
    };

    return MOBILE_HELPERS_CACHE;
  }

  function refreshMobileUIHelpers(isMobile, force) {
    const cache = getMobileHelpersCache();
    const visibleCards = isMobile ? "block" : "none";
    const visibleTables = isMobile ? "none" : "block";

    cache.cards.forEach(el => {
      if (force || el.style.display !== visibleCards) {
        el.style.display = visibleCards;
      }
    });

    cache.tables.forEach(el => {
      if (force || el.style.display !== visibleTables) {
        el.style.display = visibleTables;
      }
    });
  }

  (function initAdaptiveModes() {
    applyAdaptiveModes(true);

    let resizeTimer = null;
    let resizeRaf = 0;

    function queueAdaptiveResize(force = false) {
      clearTimeout(resizeTimer);

      resizeTimer = setTimeout(() => {
        if (resizeRaf) cancelAnimationFrame(resizeRaf);

        resizeRaf = requestAnimationFrame(() => {
          resizeRaf = 0;
          applyAdaptiveModes(force);

          const box = $("topNotifDropdown");
          if (box && box.style.display === "block") {
            positionTopNotifDropdown();
          }
        });
      }, 120);
    }

    window.addEventListener("resize", () => {
      queueAdaptiveResize(false);
    }, { passive: true });

    window.addEventListener("orientationchange", () => {
      queueAdaptiveResize(true);
    }, { passive: true });
  })();

  function softenMobileFocusZoom() {
    if (window.__softenMobileFocusZoomBound) return;
    window.__softenMobileFocusZoomBound = true;

    const isMobile = () => document.body.classList.contains("mobile-mode");
    let blurTimer = null;

    const syncFocusedField = (el) => {
      if (!el || !isMobile()) return;
      if (!el.matches("input, select, textarea")) return;

      const vv = window.visualViewport;
      const viewportHeight = vv ? vv.height : (window.innerHeight || document.documentElement.clientHeight);
      const rect = el.getBoundingClientRect();

      const tooLow = rect.bottom > (viewportHeight - 96);
      const tooHigh = rect.top < 72;

      if (tooLow || tooHigh) {
        el.scrollIntoView({
          behavior: "auto",
          block: "center",
          inline: "nearest"
        });
      }
    };

    document.addEventListener("focusin", (e) => {
      const el = e.target;
      if (!el || !isMobile()) return;
      if (!el.matches("input, select, textarea")) return;

      clearTimeout(blurTimer);

      requestAnimationFrame(() => {
        setTimeout(() => syncFocusedField(el), 120);
      });
    }, { passive: true });

    document.addEventListener("focusout", () => {
      if (!isMobile()) return;
      clearTimeout(blurTimer);
    }, { passive: true });

    if (window.visualViewport) {
      let vvFrame = 0;
      let vvTimer = null;

      const syncActiveElement = () => {
        if (vvFrame) return;

        vvFrame = requestAnimationFrame(() => {
          vvFrame = 0;

          if (!isMobile()) return;

          const el = document.activeElement;
          if (!el || !el.matches("input, select, textarea")) return;

          clearTimeout(vvTimer);
          vvTimer = setTimeout(() => syncFocusedField(el), 60);
        });
      };

      window.visualViewport.addEventListener("resize", syncActiveElement, { passive: true });
      window.visualViewport.addEventListener("scroll", syncActiveElement, { passive: true });
    }
  }

  function setupMobileViewportGuards() {
    if (window.__mobileViewportGuardsBound) return;
    window.__mobileViewportGuardsBound = true;

    const syncToastPosition = () => {
      if (!document.body.classList.contains("mobile-mode")) return;
      if (!toast) return;

      const vv = window.visualViewport;
      const topOffset = vv ? Math.max(12, vv.offsetTop + 12) : 12;

      toast.style.top = `${topOffset}px`;
      toast.style.bottom = "auto";
    };

    syncToastPosition();

    if (window.visualViewport) {
      let vvTimer = null;

      const syncLight = () => {
        clearTimeout(vvTimer);
        vvTimer = setTimeout(syncToastPosition, 60);
      };

      window.visualViewport.addEventListener("resize", syncLight);
      window.visualViewport.addEventListener("scroll", syncLight);
    }

    window.addEventListener("orientationchange", () => {
      setTimeout(syncToastPosition, 180);
    });
  }


  function renderEditLog(items) {
    const tbody = $("editLogTbody");
    const cards = $("editLogCards");

    if (!tbody) return;

    if (!items || !items.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="muted">Sin ediciones para ese filtro</td></tr>`;
      if (cards) cards.innerHTML = `<div class="muted">Sin ediciones para ese filtro</div>`;
      return;
    }

    tbody.innerHTML = items.map(x => `
    <tr>
      <td>${escapeHtml(x.fecha_reporte || "")}</td>
      <td>${escapeHtml(x.tipo || "")}</td>
      <td>${escapeHtml(x.municipio || "")}</td>
      <td>${escapeHtml(x.clues || "")}</td>
      <td>${escapeHtml(x.unidad || "")}</td>
      <td>${escapeHtml(x.editado_por || "")}</td>
      <td>${escapeHtml(x.editado_ts || "")}</td>
      <td>${escapeHtml(x.detalle || "")}</td>
    </tr>
  `).join("");

    if (cards) {
      cards.innerHTML = items.map(x => `
      <div class="mobileInfoCard">
        <div class="mobileInfoHead">
          <div class="mobileInfoTitle">${escapeHtml(x.unidad || "Unidad")}</div>
          <div class="mobileInfoBadge warn">${escapeHtml(x.tipo || "EDICIÓN")}</div>
        </div>

        <div class="mobileInfoFields">
          <div class="mobileInfoField">
            <div class="mobileInfoLabel">Fecha reporte</div>
            <div class="mobileInfoValue">${escapeHtml(x.fecha_reporte || "")}</div>
          </div>
          <div class="mobileInfoField">
            <div class="mobileInfoLabel">Municipio</div>
            <div class="mobileInfoValue">${escapeHtml(x.municipio || "")}</div>
          </div>
          <div class="mobileInfoField">
            <div class="mobileInfoLabel">CLUES</div>
            <div class="mobileInfoValue">${escapeHtml(x.clues || "")}</div>
          </div>
          <div class="mobileInfoField">
            <div class="mobileInfoLabel">Editó</div>
            <div class="mobileInfoValue">${escapeHtml(x.editado_por || "")}</div>
          </div>
          <div class="mobileInfoField">
            <div class="mobileInfoLabel">Fecha edición</div>
            <div class="mobileInfoValue">${escapeHtml(x.editado_ts || "")}</div>
          </div>
          <div class="mobileInfoField">
            <div class="mobileInfoLabel">Detalle</div>
            <div class="mobileInfoValue">${escapeHtml(x.detalle || "")}</div>
          </div>
        </div>
      </div>
    `).join("");
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
      const inicio = $("histFechaInicio")?.value || todayYmdLocal();
      const fin = $("histFechaFin")?.value || todayYmdLocal();
      const data = await getHistoryMetrics(inicio, fin);
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
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=20.5881&longitude=-100.3899&current=temperature_2m,weather_code`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data && data.current) {
        const temp = Math.round(data.current.temperature_2m);
        const code = data.current.weather_code;
        const emoji = getWeatherEmoji(code);

        CURRENT_WEATHER = { temp, emoji, code };

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
      CURRENT_WEATHER = { temp: 24, emoji: "🌤️", code: 1 };
      if (USER) updateDynamicGreeting();
    }
  }

  function getWeatherEmoji(code) {
    if (code === null) return "🌡️";
    // Open-Meteo WMO Weather interpretation codes (WW)
    if (code === 0) return "☀️"; // Clear sky
    if ([1, 2].includes(code)) return "🌤️"; // Mainly clear, partly cloudy
    if (code === 3) return "☁️"; // Overcast
    if ([45, 48].includes(code)) return "🌫️"; // Fog and depositing rime fog
    if ([51, 53, 55].includes(code)) return "🌦️"; // Drizzle: Light, moderate, and dense intensity
    if ([61, 63, 65].includes(code)) return "🌧️"; // Rain: Slight, moderate and heavy intensity
    if ([71, 73, 75].includes(code)) return "❄️"; // Snow fall: Slight, moderate, and heavy intensity
    if ([80, 81, 82].includes(code)) return "🌦️"; // Rain showers: Slight, moderate, and violent
    if ([95, 96, 99].includes(code)) return "⛈️"; // Thunderstorm: Slight or moderate
    return "🌤️";
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


  softenMobileFocusZoom();
  setupMobileViewportGuards();

  /** ===== DRIVE UPLOAD LOGIC ===== **/
  let ALL_UNITS_CATALOG = null;

  async function openUploadFilesModal() {
    const modal = $("uploadFilesOverlay");
    if (!modal) return;

    // UI Initial State
    modal.classList.add("show");
    resetUploadForm();


    const role = USER?.rol || "UNIDAD";
    const categorySelect = $("uploadCategory");
    const muniWrap = $("uploadMunicipalMuniWrap");
    const unitWrap = $("uploadMunicipalUnitWrap");
    const cluesView = $("uploadCluesView");

    // Clear previous dynamic state
    muniWrap.style.display = "none";
    unitWrap.style.display = "none";
    cluesView.style.display = "none";

    if (role === "MUNICIPAL") {
      // 1. Only Supervision
      categorySelect.innerHTML = '<option value="Supervisión" selected>Supervisión</option>';
      categorySelect.disabled = true;

      // 2. Load Unit Catalog
      await loadMunicipalUploadContext();
    } else {
      // Role UNIDAD or fallback
      categorySelect.innerHTML = `
        <option value="Evidencia de capacitaciones" selected>Evidencia de capacitaciones</option>
        <option value="Evidencias de campaña">Evidencias de campaña</option>
        <option value="Otros reportes">Otros reportes</option>
      `;
      categorySelect.disabled = false;
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
      showToast("Por favor selecciona un archivo primero", false);
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      showToast("El archivo es demasiado grande (máx 15MB)", false);
      return;
    }

    let targetClues = USER.clues;
    let targetUnidad = USER.unidad;

    if (USER.rol === "MUNICIPAL") {
      const unitSelect = $("uploadUnitSelect");
      targetClues = unitSelect.value;
      if (!targetClues) {
        showToast("Debes seleccionar una unidad a supervisar", false);
        return;
      }
      const option = unitSelect.options[unitSelect.selectedIndex];
      targetUnidad = option.getAttribute("data-name") || "";
    }

    try {
      showOverlay("Subiendo archivo…", "Cargando");
      setBtnBusy("btnDoUpload", true, "Subiendo…");
      
      const res = await apiCall({
        action: "uploadFile",
        file: file,
        category: category,
        targetClues: targetClues,
        targetUnidad: targetUnidad
      });

      if (res && res.ok) {
        showToast("¡Archivo subido exitosamente!", true);
        closeUploadFilesModal();
      } else {
        showToast("Error al subir: " + (res?.error || "Desconocido"), false);
      }
    } catch (err) {
      console.error("Upload Error:", err);
      showToast("Error de conexión al subir el archivo", false);
    } finally {
      setBtnBusy("btnDoUpload", false);
      hideOverlay();
    }
  }

  // ✅ VISTA EN VIVO LOGIC
  let CHART_SEM = null;
  let CHART_CAD = null;

  function formatAppDate(dateStr) {
    if (!dateStr || dateStr === "—") return "—";
    try {
      // Intentar parsear fecha ISO o similar
      const d = new Date(dateStr);
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
       if ($("liveViewUnidad")) $("liveViewUnidad").textContent = (tipo === "SR" ? "Existencia: " : "Consumibles: ") + unidad;
       if ($("liveViewMunicipio")) {
         $("liveViewMunicipio").innerHTML = 
           escapeHtml(municipio) + " &nbsp;|&nbsp; " + escapeHtml(clues) +
           `<span style="margin-left:12px; font-size:11px; background:#e8f0fe; color:#003366; padding:2px 10px; border-radius:20px; font-weight:700;">📅 ${fechaFormatted}</span>`;
       }

       // 3. Petición real
       const res = await apiCall("adminGetUnitDetail", { clues, fecha, tipo });
       if (!res || !res.ok) throw new Error((res && res.error) || "Sin respuesta del servidor");

       // 4. Renderizar según tipo
       if (tipo === "SR") {
         // Ajustar headers Bio
         if (headRow) {
           headRow.innerHTML = `
             <th style="padding: 16px 24px; text-align: left;">Biológico</th>
             <th style="padding: 16px 24px; text-align: left;">Lote</th>
             <th style="padding: 16px 24px; text-align: center;">Existencia</th>
             <th style="padding: 16px 24px; text-align: center;">Caducidad</th>
             <th style="padding: 16px 24px; text-align: center;">Semaforización</th>
             <th style="padding: 16px 24px; text-align: center;">Última Rec.</th>
           `;
         }

         if (!res.data || !res.data.length) {
           tbody.innerHTML = '<tr><td colspan="6" class="muted" style="padding:40px; text-align:center;">No hay registros detallados para esta fecha.</td></tr>';
           renderLiveCharts({pronto:0,normal:0,lejana:0}, {m3:0,m6:0,m12:0,more:0});
         } else {
           const items = res.data;
           let semStats = { pronto: 0, normal: 0, lejana: 0 };
           let cadStats = { m3: 0, m6: 0, m12: 0, more: 0 };

           tbody.innerHTML = items.map(r => {
              const status = getSemaforoStatus(r.caducidad);
              semStats[status.key]++;
              const diffMonths = getMonthsTo(r.caducidad);
              if (diffMonths <= 3) cadStats.m3++;
              else if (diffMonths <= 6) cadStats.m6++;
              else if (diffMonths <= 12) cadStats.m12++;
              else cadStats.more++;

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
                  <td style="padding:14px 24px; font-weight:600; text-align:center; color:#94a3b8; font-size: 11px;">${formatAppDate(r.fecha_recepcion)}</td>
                </tr>
              `;
           }).join("");
           renderLiveCharts(semStats, cadStats);
         }
       } else {
         // Tipo CONSUMIBLES
         if (headRow) {
           headRow.innerHTML = `
             <th style="padding: 16px 24px; text-align: left;">Insumo / Concepto</th>
             <th style="padding: 16px 24px; text-align: center;">Cantidad / Dosis</th>
             <th style="padding: 16px 24px; text-align: left;" colspan="4">Detalles adicionales</th>
           `;
         }

         if (!res.data || !res.data.length) {
           tbody.innerHTML = '<tr><td colspan="6" class="muted" style="padding:40px; text-align:center;">No hay reporte de consumibles hoy.</td></tr>';
           renderLiveCharts({pronto:0,normal:0,lejana:0}, {m3:0,m6:0,m12:0,more:0});
         } else {
           const c = res.data[0];
           const rows = [
             { label: "Surtimiento SRP (Dosis)", val: c.srp_dosis || 0 },
             { label: "Surtimiento SR (Dosis)", val: c.sr_dosis || 0 },
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
               <td colspan="4" style="padding:16px 24px; color:#94a3b8; font-size:12px; font-weight:600;">Reportado por ${escapeHtml(c.capturado_por || "—")}</td>
             </tr>
           `).join("");
           renderLiveCharts({pronto:0,normal:0,lejana:1}, {m3:0,m6:0,m12:0,more:1}); 
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
      const months = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
      mStr = months[parseInt(parts[1]) - 1];
      yStr = parts[0].substring(2);
    }

    const months = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
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
      const months = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
      const mIdx = months.indexOf(mStr);
      if (mIdx === -1) return str;
      const year = 2000 + parseInt(yStr);
      const lastDay = new Date(year, mIdx + 1, 0).getDate();
      return `${year}-${String(mIdx + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } catch(e) { return str; }
  }

  function isoToMmmaa(isoStr) {
    if (!isoStr || isoStr.length < 7) return isoStr;
    try {
      const parts = isoStr.split("-"); 
      if (parts.length < 2) return isoStr;
      const y = parts[0].substring(2);
      const mIdx = parseInt(parts[1]) - 1;
      const months = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
      return `${months[mIdx]}-${y}`;
    } catch(e) { return isoStr; }
  }

  function getSemaforoStatus(val) {
    const diff = getMonthsTo(val);
    if (diff < 0) return { key: "expired", label: "Expirado", color: "#ba1a1a" };
    if (diff <= 3) return { key: "pronto", label: "Cad. Próxima", color: "#ef4444" };
    if (diff <= 6) return { key: "normal", label: "Cad. Media", color: "#f59e0b" };
    return { key: "lejana", label: "Vigente", color: "#10b981" };
  }

   function renderLiveCharts(sem, cad) {
     try {
       const ctxSem = $("chartSemaforo")?.getContext("2d");
       const ctxCad = $("chartCaducidad")?.getContext("2d");
       if (!ctxSem || !ctxCad) return;

       if (CHART_SEM) CHART_SEM.destroy();
       if (CHART_CAD) CHART_CAD.destroy();

    CHART_SEM = new Chart(ctxSem, {
      type: 'doughnut',
      data: {
        labels: ['Próxima', 'Media', 'Vigente'],
        datasets: [{
          data: [sem.pronto, sem.normal, sem.lejana],
          backgroundColor: ['#f87171', '#fbbf24', '#4ade80'],
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { boxWidth: 8, font: { size: 9, weight: '700' } } } }
      }
    });

    CHART_CAD = new Chart(ctxCad, {
      type: 'bar',
      data: {
        labels: ['< 3m', '3-6m', '6-12m', '> 12m'],
        datasets: [{
          label: 'Lotes',
          data: [cad.m3, cad.m6, cad.m12, cad.more],
          backgroundColor: '#3b82f6',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { 
          y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 8 } }, grid: { display: false } },
          x: { ticks: { font: { size: 8, weight: '700' } }, grid: { display: false } }
        },
        plugins: { legend: { display: false } }
      }
    });
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

  function getArchivosDropdownRefs() {
    return {
      box: $("archivosDropdown"),
      btn: $("btnViewArchivos"),
      host: $("cardSide")
    };
  }

  function positionArchivosDropdown() {
    const refs = getArchivosDropdownRefs();
    if (!refs.box || !refs.host || !refs.btn) return;

    const hostRect = refs.host.getBoundingClientRect();
    const btnRect = refs.btn.getBoundingClientRect();
    const boxWidth = refs.box.offsetWidth;
    const hostWidth = refs.host.clientWidth;

    let top = (btnRect.bottom - hostRect.top) + 8;
    let left = (btnRect.right - hostRect.left) - boxWidth;

    if (left < 12) left = 12;
    const maxLeft = Math.max(12, hostWidth - boxWidth - 12);
    if (left > maxLeft) left = maxLeft;

    const availableHeight = Math.max(380, window.innerHeight - btnRect.bottom - 24);

    refs.box.style.top = top + "px";
    refs.box.style.left = left + "px";
    refs.box.style.maxHeight = availableHeight + "px";
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
  $("archivosCategoria")?.addEventListener("change", filterArchivosGrid);

  async function renderArchivosView() {
    try {
      showOverlay("Cargando evidencias...", "Leyendo desde Supabase");
      const res = await apiCall({ action: "listfiles" });
      if (res && res.ok) {
        ARCHIVOS_DATA = res.data;
        filterArchivosGrid();
      } else {
        showToast("Error al cargar archivos", false);
      }
    } catch(e) {
       console.error(e);
       showToast("Error", false);
    } finally {
      hideOverlay();
    }
  }

  function filterArchivosGrid() {
    const container = $("archivosContainer");
    if (!container) return;

    const catFilt = ($("archivosCategoria")?.value || "").toLowerCase();
    const txtFilt = ($("archivosSearch")?.value || "").toLowerCase();
    const role = String((typeof USER !== "undefined" && USER && USER.rol) ? USER.rol : "").toUpperCase();
    const myClues = (typeof USER !== "undefined" && USER && USER.clues) ? USER.clues : "";
    const isUnidad = role === "UNIDAD";

    let filtered = ARCHIVOS_DATA.filter(f => {
       const pathParts = (f.name||"").split("/");
       if (pathParts.length < 3) return false;
       
        const category = (pathParts[0] || "").toLowerCase();
        const cluMun = (pathParts[1] || "").toLowerCase();
        const myCluesClean = String(myClues).trim().toLowerCase();

        // ✅ REGLA: UNIDAD solo ve 'Supervisión'
        if (isUnidad) {
           if (!category.includes("supervisi")) return false;
           if (!cluMun.includes(myCluesClean)) return false;
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

    container.innerHTML = filtered.map(f => {
       const url = `${SUPABASE_URL}/storage/v1/object/public/evidencias/${encodeURIComponent(f.name)}`;
       const parts = f.name.split("/");
       const fileName = parts[2];
       const cluesUnidad = parts[1];
       const dObj = new Date(f.created_at);

       return `<div class="bg-surface-variant/20 border border-outline-variant/30 rounded-xl p-3 flex items-center gap-3 transition-all hover:bg-surface-variant/50 group">
                  <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20">
                     <span class="material-symbols-rounded text-primary text-[22px]">description</span>
                  </div>
                  <div class="flex-1 min-w-0">
                     <p class="font-bold text-[12px] text-primary truncate leading-tight" title="${fileName}">${fileName}</p>
                     <div class="flex items-center gap-2 mt-0.5">
                        <span class="text-[9px] font-bold text-outline-variant uppercase tracking-wider truncate max-w-[150px]">${cluesUnidad.replace(/_/g, ' ')}</span>
                        <span class="text-[9px] text-outline opacity-60">•</span>
                        <span class="text-[9px] text-outline font-medium">${dObj.toLocaleDateString()}</span>
                     </div>
                  </div>
                  <a href="${url}" target="_blank" class="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center transition-all hover:scale-110 shadow-sm" title="Ver archivo">
                    <span class="material-symbols-rounded text-[18px]">visibility</span>
                  </a>
               </div>`;
    }).join("");
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

  window.loadAllUnitsBulk = async function() {
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

  window.selectAllFilteredUnits = function() {
    const checks = document.querySelectorAll(".unitBulkCheckbox");
    if (checks.length === 0) {
      showToast("No hay unidades listadas para marcar", false, "warn");
      return;
    }
    checks.forEach(i => i.checked = true);
    showToast(`Marcadas ${checks.length} unidades`, true);
  };

  window.deselectAllUnits = function() {
    const checks = document.querySelectorAll(".unitBulkCheckbox");
    checks.forEach(i => i.checked = false);
    showToast("Unidades desmarcadas");
  };

  window.selectAllVaccinesBulk = function() {
    const checks = document.querySelectorAll(".bioBulkCheckbox");
    checks.forEach(i => i.checked = true);
    showToast("Todos los biológicos marcados");
  };

  window.deselectAllVaccinesBulk = function() {
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

  window.handleBulkBioVisibility = async function(activo) {
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
  function initProfileDropdown() {
    const btn = document.getElementById("btnProfileToggle");
    const dropdown = document.getElementById("profileDropdown");
    if (!btn || !dropdown) return;

    btn.onclick = (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("hidden");
    };

    document.addEventListener("click", (e) => {
      if (dropdown && !dropdown.classList.contains("hidden") && !dropdown.contains(e.target)) {
        dropdown.classList.add("hidden");
      }
    });
  }
