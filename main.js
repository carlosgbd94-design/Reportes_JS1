import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBzhNWRQZpDHoIBJrcuXy2a4EnHzEZuzVc",
  authDomain: "js1-reportes.firebaseapp.com",
  projectId: "js1-reportes",
  storageBucket: "js1-reportes.firebasestorage.app",
  messagingSenderId: "398603830899",
  appId: "1:398603830899:web:92e916daec0cead2324c06"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- LÓGICA DE LOGIN FIREBASE ---
document.addEventListener("DOMContentLoaded", () => {
    const formLogin = document.getElementById("loginForm");
    if (formLogin) {
        formLogin.addEventListener("submit", async (ev) => {
            // Esto evita que la página parpadee o se recargue al dar clic
            ev.preventDefault();
            
            // Tomamos los valores de los inputs
            const email = document.getElementById("usuario").value.trim();
            const password = document.getElementById("password").value.trim();

            if (!email || !password) {
                showToast("Por favor, ingresa usuario y contraseña", false, "warn");
                return;
            }
            
            showOverlay("Validando en Firebase…", "Iniciando sesión");
            
            try {
                // Se conecta con Firebase Auth
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                
                // Si es exitoso, lanza tu función nativa
                showToast("Sesión iniciada correctamente");
                showRightColumn(true); 
                
            } catch (error) {
                // Si falla, lanza tu alerta nativa
                showToast("Usuario o contraseña incorrectos", false, "bad");
                console.error("Error Firebase:", error);
            } finally {
                hideOverlay();
            }
        });
    }
});
// --------------------------------

  const $ = (id) => document.getElementById(id);
  const overlay = $("overlay");
  const overlayMsg = $("overlayMsg");
  const toast = $("toast");
  const toastMsg = $("toastMsg");

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

  /* MQ3 Ripple Effect */
  function createRipple(event) {
    const button = event.currentTarget;
    const circle = document.createElement("span");
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;

    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - button.getBoundingClientRect().left - radius}px`;
    circle.style.top = `${event.clientY - button.getBoundingClientRect().top - radius}px`;
    circle.classList.add("ripple");

    const ripple = button.getElementsByClassName("ripple")[0];
    if (ripple) { ripple.remove(); }
    button.appendChild(circle);
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
    if (!toast || !toastMsg) return;

    const {
      force = false,
      cooldownMs = 1400
    } = options || {};

    const finalType = type ? type : (ok ? "good" : "bad");
    const cleanMsg = String(msg || "").trim();
    const toastKey = `${cleanMsg}|${finalType}`;
    const now = Date.now();

    if (!LIVE_STATE.toastMeta) {
      LIVE_STATE.toastMeta = {
        key: "",
        ts: 0
      };
    }

    const sameToast =
      LIVE_STATE.toastMeta.key === toastKey &&
      (now - Number(LIVE_STATE.toastMeta.ts || 0)) < cooldownMs;

    if (!force && sameToast) return;

    LIVE_STATE.toastMeta.key = toastKey;
    LIVE_STATE.toastMeta.ts = now;
    LIVE_STATE.lastToastKey = toastKey;

    toastMsg.textContent = cleanMsg;
    toast.classList.remove("good", "bad", "warn");
    toast.classList.add(finalType);

    toast.classList.remove("show");
    void toast.offsetWidth;
    toast.classList.add("show");

    if (TOAST_TIMER) clearTimeout(TOAST_TIMER);
    TOAST_TIMER = setTimeout(() => {
      toast.classList.remove("show");
      LIVE_STATE.lastToastKey = "";
      if (LIVE_STATE.toastMeta) {
        LIVE_STATE.toastMeta.key = "";
        LIVE_STATE.toastMeta.ts = 0;
      }
    }, 3600);
  }  /** ===== UTILS PORTED FROM BACKEND ===== **/
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
    if (!toast) return;

    if (TOAST_TIMER) {
      clearTimeout(TOAST_TIMER);
      TOAST_TIMER = null;
    }

    toast.classList.remove("show");
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
    const badge = $("bNotif");
    const txt = $("notifTxt");
    const btnClear = $("btnClearLiveFeed");

    if (!badge || !txt) return;

    const n = Number(LIVE_STATE.notifCount || 0);
    const warn = Number(LIVE_STATE.notifWarnCount || 0);

    const shouldShow = n > 0;
    const nextText = warn > 0
      ? `Actividad: ${n} · Alertas: ${warn}`
      : `Actividad: ${n}`;

    if (shouldShow) {
      if (badge.style.display !== "inline-flex") {
        badge.style.display = "inline-flex";
      }
      if (!badge.classList.contains("liveAccent")) {
        badge.classList.add("liveAccent");
      }
      badge.classList.toggle("notifHot", warn > 0);

      if (txt.textContent !== nextText) {
        txt.textContent = nextText;
      }

      pulseBadge("bNotif");

      if (btnClear && btnClear.style.display !== "inline-flex") {
        btnClear.style.display = "inline-flex";
      }
      return;
    }

    if (badge.style.display !== "none") {
      badge.style.display = "none";
    }
    badge.classList.remove("notifHot", "liveAccent", "pulse", "warn");

    if (txt.textContent !== "Actividad: 0") {
      txt.textContent = "Actividad: 0";
    }

    if (btnClear && btnClear.style.display !== "none") {
      btnClear.style.display = "none";
    }
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
        <div class="notifCardHead">
          <div style="min-width:0; flex:1;">
            <div class="notifCardTitle">
              ${escapeHtml(item.title || "Notificación")}
              ${pinolTag}
              ${frascosTag}
              ${unreadDot}
            </div>
            <div class="notifMeta">
              ${escapeHtml(item.created_ts || "")}
              ${item.from_usuario ? ` · ${escapeHtml(item.from_usuario)}` : ""}
            </div>
          </div>

          <span class="notifType ${type}">
            <span class="material-symbols-rounded">${typeIcon}</span>
            ${escapeHtml(notifTypeLabel(type))}
          </span>
        </div>

        <div class="notifBody">${escapeHtml(item.message || "")}</div>

        <div class="notifActions">
          ${showConfirmPinol
          ? `
                <button
                  type="button"
                  class="md-btn-icon"
                  title="Confirmar recibido"
                  onclick="confirmPinolReceiptFlow('${escapeAttr(item.id || "")}')"
                  style="color: var(--md-sys-color-primary);"
                >
                  <span class="material-symbols-rounded">task_alt</span>
                </button>
              `
          : ``
        }

          ${!showConfirmPinol && !pinolConfirmed && !isPinolAck && !isRead
          ? `
                <button
                  type="button"
                  class="md-btn-icon"
                  title="Marcar como leída"
                  onclick="markNotificationReadFlow('${escapeAttr(item.id || "")}')"
                  style="color: var(--md-sys-color-primary);"
                >
                  <span class="material-symbols-rounded">done</span>
                </button>
              `
          : ``
        }

          ${createDeleteButtonHtml(`deleteNotificationFlow('${escapeAttr(item.id || "")}')`, "Borrar notificación")}
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

        <div class="notifGroupBody" style="display:${collapsed ? "none" : "flex"};">
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
        if (topBadge.style.display !== "inline-flex") topBadge.style.display = "inline-flex";
        if (topBadge.textContent !== nextText) topBadge.textContent = nextText;
        btnTopNotifications?.classList.add("liveAccent", "notifHot");
      } else {
        if (topBadge.style.display !== "none") topBadge.style.display = "none";
        if (topBadge.textContent !== "0") topBadge.textContent = "0";
        btnTopNotifications?.classList.remove("liveAccent", "notifHot");
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
    const unreadForBadge = unreadServerCount === null ? unreadLocal : Number(unreadServerCount || 0);
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

    syncMainNotifBadge(unreadForBadge);
    LIVE_STATE.notifCount = unreadForBadge;

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

  async function sendNotificationFlow() {
    try {
      const payload = {
        target_scope: $("notifTargetScope")?.value || "ALL_MY_UNITS",
        target_municipio: $("notifTargetMunicipio")?.value || "",
        target_clues: $("notifTargetClues")?.value || "",
        type: $("notifType")?.value || "INFO",
        title: $("notifTitle")?.value || "",
        message: $("notifMessage")?.value || ""
      };

      if (payload.target_scope === "ALL_MY_UNITS" && USER?.rol === "MUNICIPAL" && !String(payload.target_municipio).trim()) {
        payload.target_municipio = USER?.municipio || "";
      }

      if (payload.target_scope === "MUNICIPIO" && !String(payload.target_municipio).trim()) {
        showWarnToast("Selecciona un municipio");
        return;
      }

      if (payload.target_scope === "CLUES") {
        if (!String(payload.target_municipio).trim()) {
          showWarnToast("Selecciona un municipio");
          return;
        }
        if (!String(payload.target_clues).trim()) {
          showWarnToast("Selecciona una unidad / CLUES");
          return;
        }
      }

      if (!String(payload.title).trim()) {
        showWarnToast("Escribe un título para la notificación");
        return;
      }

      if (!String(payload.message).trim()) {
        showWarnToast("Escribe el mensaje de la notificación");
        return;
      }

      setBtnBusy("btnSendNotification", true, "Enviando…");
      showOverlay("Enviando notificación interna…", "Notificaciones");

      await apiCall("sendNotification", payload);

      $("notifTitle").value = "";
      $("notifMessage").value = "";
      if ($("notifTemplate")) $("notifTemplate").value = "";

      showToast("Notificación enviada correctamente");

      loadNotifications({ silent: true }).catch(err => {
        console.error("sendNotificationFlow loadNotifications error:", err);
      });

    } catch (e) {
      console.error("sendNotificationFlow error:", e);
      showToast(e.message || "No se pudo enviar la notificación", false);
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
      const btn = ev.target.closest(".md-btn, .btn, .ghostBtn, .miniBtn");
      if (btn) createRipple(ev);

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

    if (!Array.isArray(LIVE_STATE.notifications) || !LIVE_STATE.notifications.length) {
      loadNotifications({ silent: true }).catch(err => {
        console.error("toggleTopNotifDropdown loadNotifications error:", err);
      });
    }
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
    const usuario = $("forgotUsuario") ? $("forgotUsuario").value.trim() : "";

    if (!usuario) {
      showToast("Ingresa tu usuario", false);
      return;
    }

    // Primero cerramos el modal para que no estorbe la pantalla de carga global
    closeForgotModal();

    // Mostramos la pantalla de carga global del sistema
    showOverlay("Estamos enviando el enlace de recuperación…", "Recuperando acceso");

    try {
      const r = await apiCall({
        action: "requestPasswordReset",
        usuario
      });

      if (!r || !r.ok) {
        showToast((r && r.error) ? r.error : "No se pudo enviar el enlace", false);
        return;
      }

      showToast("Se envió el enlace de recuperación");
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

  function apiCall(actionOrPayload, payload = {}) {
    let finalPayload = {};

    if (typeof actionOrPayload === "string") {
      finalPayload = Object.assign({}, payload, {
        action: actionOrPayload,
        token: payload.token || TOKEN
      });
    } else if (actionOrPayload && typeof actionOrPayload === "object") {
      finalPayload = Object.assign({}, actionOrPayload);
      if (!finalPayload.token) {
        finalPayload.token = TOKEN;
      }
    } else {
      return Promise.reject(new Error("Parámetros inválidos para apiCall"));
    }

    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler((res) => {
          resolve(res);
        })
        .withFailureHandler((err) => {
          reject(err instanceof Error ? err : new Error(String(err || "Error de servidor.")));
        })
        .api(finalPayload);
    });
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

  let TOKEN = localStorage.getItem("JS1_TOKEN") || "";
  let USER = null;
  let STATUS = null;
  let UNIT_CATALOG = [];
  let LIVE_TIMERS_STARTED = false;
  let LIVE_TIMERS = [];

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
    historyWatching: false
  };

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
      stopNotificationsAutoRefresh();
      clearSessionCaches();
      resetOpsPrewarmFlags();
      setLoggedOutUI();
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
    const src = $("jeringa_reconst_5ml_0605500438");
    if (!src) return;

    if (src.dataset.syncAgujaBound === "1") return;
    src.dataset.syncAgujaBound = "1";

    src.addEventListener("input", syncAguja);
    src.addEventListener("change", syncAguja);
    src.addEventListener("blur", syncAguja);
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

  let BATCH_CATALOG = []; // Catálogo completo (ADMIN)
  let UNIT_BATCHES = [];  // Catálogo filtrado por municipio (UNIDAD)

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

    // Inicializar catálogos de lotes
    try {
      if (user.rol === "ADMIN" || user.rol === "JURISDICCIONAL") {
        toggleEl("tabLOTES", true, "flex");
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

    console.log("today en hydrateSessionUi:", today);
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

    deferPostLoginTask(async () => {
      await loadNotifications({ silent: true });
      startNotificationsAutoRefresh();

      if (isOps) {
        await loadNotifUnitCatalog();
        refreshNotifScopeUi();
      }
    });
  }


  async function loadBatchesForSession(user) {
    if (!user) return;
    const res = await apiCall({ action: "getLotesByMunicipio", token: TOKEN });
    if (res && res.ok) {
      UNIT_BATCHES = res.data || [];
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

    if (!BATCH_CATALOG.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="muted">Sin lotes cargados.</td></tr>`;
      return;
    }

    tbody.innerHTML = BATCH_CATALOG.map((item, idx) => `
      <tr>
        <td>${escapeHtml(item.biologico)}</td>
        <td>${escapeHtml(item.lote)}</td>
        <td>${escapeHtml(item.caducidad)}</td>
        <td>${escapeHtml(item.fecha_recepcion || "—")}</td>
        <td>${escapeHtml(item.municipio)}</td>
        <td>
          <button type="button" class="miniBtn bad" onclick="deleteLoteRowAdmin(${idx})">
            <span class="material-symbols-rounded">delete</span>
          </button>
        </td>
      </tr>
    `).join("");
  }

  // ELIMINADO: El listener de btnAddSRRow se movió a la sección de inicialización para evitar duplicados.

  $("btnAddLoteRow")?.addEventListener("click", () => {
    const biologico = $("loteBio").value;
    const rawLote = $("loteTxt").value.trim().toUpperCase();
    const rawCad = $("loteCad").value.trim().toUpperCase();
    
    // Forzar formateo final por si no se disparó el blur
    const lote = rawLote;
    const caducidad = parseInputToMmmAa(rawCad);
    
    const fecha_recepcion = $("loteRec").value;
    const municipio = $("loteMuni").value; // Ahora es un SELECT

    if (!lote || !caducidad) {
      showToast("Lote y caducidad son obligatorios", false, "warn");
      return;
    }

    // Validar formato caducidad MMM-AA despues del parseo
    if (!/^[A-Z]{3}-\d{2}$/.test(caducidad)) {
      showToast("Formato de caducidad inválido. Usa ENE-25, JUL-27, etc.", false, "warn");
      return;
    }

    // VALIDACIÓN DE DUPLICADOS
    const exists = BATCH_CATALOG.find(x => x.biologico === biologico && x.lote === lote);
    if (exists) {
      showToast(`El lote ${lote} ya existe para ${biologico}`, false, "warn");
      return;
    }

    BATCH_CATALOG.push({ biologico, lote, caducidad, fecha_recepcion, municipio });
    renderLotesAdmin();

    // Limpiar campos parciales
    $("loteTxt").value = "";
    $("loteCad").value = "";
    $("loteRec").value = "";
    $("loteTxt").focus();
  });

  function deleteLoteRowAdmin(idx) {
    BATCH_CATALOG.splice(idx, 1);
    renderLotesAdmin();
  }

  $("btnSaveLotesAdmin")?.addEventListener("click", async () => {
    setBtnBusy("btnSaveLotesAdmin", true, "Guardando…");
    showOverlay("Guardando catálogo de lotes…", "Administración");
    try {
      const res = await apiCall({
        action: "saveLotes",
        token: TOKEN,
        lotes: BATCH_CATALOG
      });

      if (res && res.ok) {
        showToast("Catálogo de lotes guardado correctamente", true, "good");
        await loadBatchesForSession(USER); // Recargar para la unidad si aplica
      } else {
        showToast(res?.error || "Error al guardar lotes", false);
      }
    } catch (e) {
      showToast("Error de conexión", false);
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

  function addSRRow(data = null) {
    const tbody = $("srCaptureTbody");
    const tr = document.createElement("tr");
    
    const biotics = [
      "BCG","HEPATITIS B","HEXAVALENTE","DPT","ROTAVIRUS",
      "NEUMOCÓCICA 13","NEUMOCÓCICA 20","SRP","SR","VPH",
      "VARICELA","HEPATITIS A","TD","TDPA","COVID-19","INFLUENZA","VSR"
    ];

    const bioOptions = biotics.map(b => `<option value="${b}" ${data?.biologico === b ? 'selected' : ''}>${b}</option>`).join("");
    
    tr.innerHTML = `
      <td>
        <select class="sr-bio-select" onchange="handleSRBioChange(this)">
          <option value="">Selecciona…</option>
          ${bioOptions}
        </select>
      </td>
      <td>
        <select class="sr-lote-select" onchange="handleSRLoteChange(this)">
          <option value="">—</option>
        </select>
      </td>
      <td class="sr-cad-cell">—</td>
      <td>
        <input type="date" class="sr-recepcion-input" value="${data?.fecha_recepcion || ""}">
      </td>
      <td>
        <input type="number" class="sr-cantidad-input" min="0" step="1" value="${data?.cantidad || ""}" placeholder="0">
      </td>
      <td>
        <button type="button" class="miniBtn bad" onclick="this.closest('tr').remove(); updateCaptureStateBanner();">
          <span class="material-symbols-rounded">delete</span>
        </button>
      </td>
    `;
    
    tbody.appendChild(tr);
    
    if (data) {
      handleSRBioChange(tr.querySelector(".sr-bio-select"), data.lote);
    }
  }

  function handleSRBioChange(selectEl, preselectLote = null) {
    const tr = selectEl.closest("tr");
    const bio = selectEl.value;
    const loteSelect = tr.querySelector(".sr-lote-select");
    const cadCell = tr.querySelector(".sr-cad-cell");
    
    loteSelect.innerHTML = '<option value="">Selecciona lote…</option>';
    cadCell.textContent = "—";
    cadCell.className = "sr-cad-cell";

    if (!bio) return;

    const filtered = UNIT_BATCHES.filter(l => l.biologico === bio);
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

    if (preselectLote) handleSRLoteChange(loteSelect);
  }

  function handleSRLoteChange(selectEl) {
    const tr = selectEl.closest("tr");
    const opt = selectEl.selectedOptions[0];
    const cadCell = tr.querySelector(".sr-cad-cell");
    
    if (!opt || !opt.dataset.cad) {
      cadCell.textContent = "—";
      cadCell.className = "sr-cad-cell";
      return;
    }

    const cad = opt.dataset.cad;
    const rec = opt.dataset.rec || "";
    
    // Limpiar contenido previo por completo
    cadCell.innerHTML = "";
    cadCell.textContent = "";

    // Blindaje: si por alguna razón llega un formato de fecha largo, intentar formatear
    let displayCad = cad || "—";
    if (cad && cad.includes(" ") && cad.length > 15) {
      const d = new Date(cad);
      if (!isNaN(d.getTime())) {
        const months = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
        displayCad = `${months[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
      }
    }

    if (!cad) {
      cadCell.textContent = "—";
      cadCell.className = "sr-cad-cell";
    } else {
      const span = document.createElement("span");
      span.className = getShelfLifeClass(displayCad);
      span.textContent = displayCad;
      cadCell.appendChild(span);
      cadCell.className = "sr-cad-cell"; // El TD mantiene su clase, el SPAN lleva el color
    }

    const recInput = tr.querySelector(".sr-recepcion-input");
    if (recInput && !recInput.value) {
      recInput.value = rec;
    }
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
    const src = $("jeringa_reconst_5ml_0605500438");
    const dst = $("aguja_0600403711");

    if (!src || !dst) return;

    const v = Number(src.value || 0);
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

    if (refs.hdrFecha) refs.hdrFecha.textContent = `Fecha: ${fechaHumana}`;
    if (refs.hdrHora) refs.hdrHora.textContent = `Hora: ${horaHumana}`;
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
    if (n >= 80) return "good";
    if (n >= 50) return "warn";
    return "bad";
  }

  function todayYmdLocal() {
    const d = new Date();
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

  async function whoami() {
    if (!TOKEN) return null;
    const r = await apiCall({ action: "whoami", token: TOKEN });
    if (!r || !r.ok) return null;
    return r.data;
  }

  async function unitStatus() {
    if (!TOKEN) return null;
    const r = await apiCall({ action: "unitStatus", token: TOKEN });
    if (!r || !r.ok) return null;
    return r.data;
  }

  async function getTodayReports(fecha = "", force = false) {
    if (!TOKEN) return null;

    const safeFecha = String(fecha || todayYmdLocal()).trim();
    const cacheKey = buildCacheKey("TODAY_REPORTS", safeFecha);

    const fetchToday = async () => {
      const r = await apiCall({
        action: "getTodayReports",
        token: TOKEN,
        fecha: safeFecha
      });

      if (!r || !r.ok) return null;
      return r.data || null;
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

    if (typeof TODAY_CACHE !== "undefined") {
      TODAY_CACHE = data || null;
    }

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


  function showRightColumn(show) {
    const loginWrap = document.querySelector(".loginWrap");
    toggleEl("rightColumn", show, "block");
    toggleEl("cardLogin", !show, "block");

    if (loginWrap) {
      loginWrap.style.display = show ? "none" : "flex";
    }
  }

  function paintStatusChips(status) {
    if (!status) return;

    const d = status.today ? new Date(status.today + "T00:00:00") : new Date();
    const fechaHumana = formatDateMx(d);

    if ($("hdrFecha")) {
      $("hdrFecha").textContent = `Fecha: ${fechaHumana}`;
    }

    if ($("dayTxt")) {
      if (typeof status.compliance_pct !== "undefined") {
        $("dayTxt").textContent = `Cumplimiento: ${Number(status.compliance_pct || 0)}%`;
      } else {
        $("dayTxt").textContent = status.isThursday ? "Hoy sí es jueves" : "Hoy no es operativo";
      }
    }

    // Si tu index HTML tiene el wrapper con id="bCumplimiento", lo actualizará
    if ($("bCumplimiento")) {
      $("bCumplimiento").classList.remove("good", "warn", "bad");

      if (typeof status.compliance_pct !== "undefined") {
        const tone = getComplianceBadgeTone(status.compliance_pct);
        $("bCumplimiento").classList.add(tone);
      } else {
        $("bCumplimiento").classList.add(status.isThursday ? "good" : "warn");
      }
    }
  }


  function updateCaptureStateBanner() {
    const box = $("captureStateBox");
    if (!box || !USER || USER.rol !== "UNIDAD") return;

    const activeTab =
      $("tabSR")?.classList.contains("active") ? "SR" :
        $("tabCONS")?.classList.contains("active") ? "CONS" :
          $("tabBIO")?.classList.contains("active") ? "BIO" :
            $("tabPINOL")?.classList.contains("active") ? "PINOL" : "SR";

    box.className = "captureStateBox";
    box.textContent = "";

    if (activeTab === "SR") {
      if (HAS_TODAY_SR && TODAY_CACHE && TODAY_CACHE.sr) {
        if (EDIT_SR) {
          box.classList.add("show", "warn");
          box.innerHTML = `<span class="material-symbols-rounded">edit_square</span><b>MODO EDICIÓN ACTIVO:</b> estás corrigiendo la existencia de biológicos de hoy.`;
        } else {
          box.classList.add("show", "ok");
          box.innerHTML = `<span class="material-symbols-rounded">task_alt</span><b>YA CAPTURADO HOY:</b> la existencia de biológicos ya fue registrada${(TODAY_CACHE.sr && TODAY_CACHE.sr.editado === "SI") ? " y editada" : ""}. Si necesitas corregirla, usa el botón <b>Editar existencia de hoy</b>.`;
        }
      } else {
        box.classList.add("show", "warn");
        box.innerHTML = `<span class="material-symbols-rounded">schedule</span><b>AÚN SIN CAPTURA:</b> la existencia de biológicos todavía no se ha registrado hoy.`;
      }
      return;
    }

    if (activeTab === "CONS") {
      if (!(STATUS && STATUS.canCaptureConsumibles)) {
        box.classList.add("show", "bad");
        box.innerHTML = `<span class="material-symbols-rounded">event_busy</span><b>CONSUMIBLES NO DISPONIBLE:</b> este reporte solo se captura en jueves.`;
        return;
      }

      if (STATUS.consumiblesHolidayOverride) {
        box.classList.add("show", "warn");
        box.innerHTML = `<span class="material-symbols-rounded">event_available</span><b>CONSUMIBLES HABILITADO:</b> este reporte se puede capturar el día de hoy ya que el jueves es día no laborable.`;
        return;
      }

      if (STATUS.consumiblesManualOverride) {
        box.classList.add("show", "ok");
        box.innerHTML = `<span class="material-symbols-rounded">admin_panel_settings</span><b>CONSUMIBLES HABILITADO:</b> apertura extraordinaria activada por administración.`;
        return;
      }

      if (HAS_TODAY_CONS && TODAY_CACHE && TODAY_CACHE.cons) {
        if (EDIT_CONS) {
          box.classList.add("show", "warn");
          box.innerHTML = `<span class="material-symbols-rounded">edit_square</span><b>MODO EDICIÓN ACTIVO:</b> estás corrigiendo el reporte de consumibles de hoy.`;
        } else {
          box.classList.add("show", "ok");
          box.innerHTML = `<span class="material-symbols-rounded">task_alt</span><b>YA CAPTURADO HOY:</b> consumibles ya fue registrado${(TODAY_CACHE.cons && TODAY_CACHE.cons.editado === "SI") ? " y editado" : ""}. Si necesitas corregirlo, usa el botón <b>Editar reporte de hoy</b>.`;
        }
      } else {
        box.classList.add("show", "ok");
        box.innerHTML = `<span class="material-symbols-rounded">inventory_2</span><b>CONSUMIBLES HABILITADO:</b> el reporte de consumibles está disponible para captura el día de hoy.`;
      }
      return;
    }

    if (activeTab === "BIO") {
      if (!BIO_IS_ENABLED) {
        box.classList.add("show", "bad");
        box.innerHTML = `<span class="material-symbols-rounded">event_busy</span><b>PEDIDO DE BIOLÓGICO NO DISPONIBLE:</b> hoy no se encuentra habilitado para captura.`;
        return;
      }

      if (HAS_SAVED_BIO) {
        if (EDIT_BIO) {
          box.classList.add("show", "warn");
          box.innerHTML = `<span class="material-symbols-rounded">edit_square</span><b>MODO EDICIÓN ACTIVO:</b> estás corrigiendo el pedido de biológico guardado.`;
        } else {
          box.classList.add("show", "ok");
          box.innerHTML = `<span class="material-symbols-rounded">task_alt</span><b>PEDIDO YA GUARDADO:</b> ya existe un pedido de biológico capturado para la fecha programada. Si necesitas corregirlo, usa el botón <b>Editar pedido guardado</b>.`;
        }
      } else {
        box.classList.add("show", "warn");
        box.innerHTML = `<span class="material-symbols-rounded">schedule</span><b>PEDIDO PENDIENTE:</b> aún no se registra el pedido de biológico actual.`;
      }
      return;
    }

    if (activeTab === "PINOL") {
      box.classList.add("show", "ok");
      if (USER && USER.rol === "UNIDAD") {
        box.innerHTML = `<span class="material-symbols-rounded">inventory_2</span><b>PINOL:</b> desde aquí puedes hacer tu solicitud de pinol.`;
      } else {
        box.innerHTML = `<span class="material-symbols-rounded">inventory_2</span><b>PINOL:</b> desde aquí puedes consultar, registrar o confirmar movimientos de pinol.`;
      }
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
    captureWindowStatus: "EARLY"
  };

  function renderBioRows(rows) {
    BIO_STATE.rows = rows || [];
    const tbody = $("bioTbody");

    if (!rows || !rows.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="muted">No hay configuración para esta unidad</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((r, i) => `
    <tr>
      <td class="bioNameCell">
        <div class="bioName">💉 ${escapeHtml(r.biologico || "")}</div>
      </td>
      <td class="bioInputCell bioExistenciaCell">
        <input
          class="bioInput"
          type="number"
          min="0"
          step="1"
          inputmode="numeric"
          data-i="${i}"
          data-kind="existencia"
          value="${r.existencia_actual_frascos ?? ""}"
          placeholder="0"
        >
      </td>
      <td class="bioInputCell bioPedidoCell">
        <input
          class="bioInput"
          type="number"
          min="0"
          step="1"
          inputmode="numeric"
          data-i="${i}"
          data-kind="pedido"
          value="${r.pedido_frascos ?? ""}"
          placeholder="0"
        >
      </td>
      <td class="bioValidationCell">
        <div id="bioAlert_${i}" class="bioAlertWrap"></div>
      </td>
      <td class="bioMetricCell bioPromedioCell"><div class="bioMetric bioPromedioValue">${r.promedio_frascos ?? ""}</div></td>
      <td class="bioMetricCell"><div class="bioMetric">${r.max_dosis ?? ""}</div></td>
      <td class="bioMetricCell"><div class="bioMetric">${r.min_dosis ?? ""}</div></td>
    </tr>
  `).join("");

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
        if (res && res.ok && res.data && res.data.length > 1) {
          res.data.forEach(d => {
            const opt = document.createElement("option");
            opt.value = d;
            opt.textContent = `${d} (Captura detectada)`;
            exactSelect.appendChild(opt);
          });
          exactBox.style.display = "block";
          $("exportFechaHint").textContent = "Múltiples capturas detectadas. Elige una.";
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

    BIO_STATE.rows.forEach((r, i) => {
      const pedidoEl = document.querySelector(`input[data-i="${i}"][data-kind="pedido"]`);
      const existenciaEl = document.querySelector(`input[data-i="${i}"][data-kind="existencia"]`);

      const pedidoRaw = pedidoEl ? String(pedidoEl.value || "").trim() : "";
      const existenciaRaw = existenciaEl ? String(existenciaEl.value || "").trim() : "";

      const touched =
        force ||
        pedidoEl?.dataset.touched === "1" ||
        existenciaEl?.dataset.touched === "1";

      const td = $("bioAlert_" + i);
      if (!td) return;

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
        td.className = "bioAlertWrap neutral";
        td.innerHTML = `
    <span class="bioAlertBadge neutral">⏳ Pendiente</span>
    <div class="bioAlertText">Vacío = 0 al guardar.</div>
  `;
        return;
      }

      const msgs = [];
      let level = "ok";

      const pedido = pedidoRaw === "" ? 0 : Number(pedidoRaw);
      const existencia = existenciaRaw === "" ? 0 : Number(existenciaRaw);

      const multiplo = Number(r.multiplo_pedido || 1);
      const promedio = Number(r.promedio_frascos || 0);
      const totalDisponible = existencia + pedido;
      const faltantePromedio = Math.max(0, promedio - totalDisponible);

      const requiereMultiplo =
        ["HEXAVALENTE", "ROTAVIRUS", "NEUMO 13", "NEUMO 20", "SRP"].includes(bioKey);

      if (!Number.isInteger(existencia) || !Number.isInteger(pedido) || existencia < 0 || pedido < 0) {
        msgs.push("Usa frascos enteros iguales o mayores a 0.");
        level = "bad";
        hasStrongAlert = true;
        hasBlockingError = true;
      }

      if (sinValidacionOperativa) {
        td.className = "bioAlertWrap info";
        td.innerHTML = `
    <span class="bioAlertBadge info">ℹ️ Sin validación operativa</span>
    <div class="bioAlertText">
      Captura referencial o extraordinaria. Sin validación por promedio en este momento.
    </div>
  `;
        return;
      }

      if (requiereMultiplo && multiplo > 1 && pedido > 0 && (pedido % multiplo !== 0)) {
        msgs.push(`El pedido debe ser múltiplo de ${multiplo}.`);
        level = "bad";
        hasStrongAlert = true;
        hasBlockingError = true;
      }

      if (!omitirAdvertenciaPorCaravana && promedio > 0 && totalDisponible < promedio) {
        msgs.push(
          `Total al pedir: ${totalDisponible} frascos. Promedio esperado: ${promedio}. Faltan ${faltantePromedio} frascos.`
        );
        if (level !== "bad") {
          level = "warn";
          hasStrongAlert = true;
        }
      }

      if (!msgs.length) {
        td.className = "bioAlertWrap ok";
        td.innerHTML = `
    <span class="bioAlertBadge ok">✅ Correcto</span>
    <div class="bioAlertText">
      Captura lista. Total al pedir: ${totalDisponible} frascos${promedio > 0 ? ` · promedio: ${promedio}.` : "."}
    </div>
  `;
      } else {
        td.className = `bioAlertWrap ${level}`;
        td.innerHTML = `
    <span class="bioAlertBadge ${level}">
      ${level === "bad" ? "⛔ Error" : "⚠️ Atención"}
    </span>
    <div class="bioAlertText">${msgs.map(escapeHtml).join(" · ")}</div>
  `;
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
    return BIO_STATE.rows.map((r, i) => {
      const ex = document.querySelector(`input[data-i="${i}"][data-kind="existencia"]`);
      const pe = document.querySelector(`input[data-i="${i}"][data-kind="pedido"]`);

      const existencia = ex ? String(ex.value || "").trim() : "";
      const pedido = pe ? String(pe.value || "").trim() : "";

      return {
        biologico: r.biologico,
        existencia_actual_frascos: existencia === "" ? 0 : Number(existencia),
        pedido_frascos: pedido === "" ? 0 : Number(pedido)
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

    if (USER.rol === "ADMIN") {
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

    BIO_STATE = {
      rows: r.data.rows || [],
      isCaptureDay: !!r.data.isCaptureDay,
      canCapture: !!r.data.canCapture,
      fechaPedidoProgramada: r.data.fechaPedidoProgramada || "",
      captureWindowStart: r.data.captureWindowStart || "",
      captureWindowEnd: r.data.captureWindowEnd || "",
      captureWindowStatus: r.data.captureWindowStatus || "EARLY",
      diffDays: Number(r.data.diffDays || 0)
    };

    HAS_SAVED_BIO = !!r.data.hasSavedBio;
    EDIT_BIO = false;

    $("fechaPedidoBIO").value = r.data.fechaPedidoProgramada || "";
    $("fechaPedidoBIOBox").textContent = r.data.fechaPedidoProgramada || "—";

    const bioHint = $("bioHint");
    const bioDayAlert = $("bioDayAlert");

    bioDayAlert.className = "bioDayAlert show";

    if (r.data.canCapture && r.data.isCaptureDay) {
      bioHint.textContent = "Hoy corresponde la captura del pedido biológico.";
      bioDayAlert.classList.add("ok");
      bioDayAlert.innerHTML = `<span class="material-symbols-rounded">event_available</span><span>Captura habilitada hoy. Ventana operativa: <b>${escapeHtml(r.data.captureWindowStart || "")}</b> al <b>${escapeHtml(r.data.captureWindowEnd || "")}</b>.</span>`;
    } else if (r.data.canCapture) {
      bioHint.textContent = "Captura habilitada dentro de la ventana operativa.";
      bioDayAlert.classList.add("ok");
      bioDayAlert.innerHTML = `<span class="material-symbols-rounded">event_available</span><span>Puedes capturar del <b>${escapeHtml(r.data.captureWindowStart || "")}</b> al <b>${escapeHtml(r.data.captureWindowEnd || "")}</b>. Fecha objetivo: <b>${escapeHtml(r.data.fechaPedidoProgramada || "")}</b>.</span>`;
    } else if (r.data.captureWindowStatus === "EARLY") {
      bioHint.textContent = "Aún no inicia la ventana de captura.";
      bioDayAlert.classList.add("warn");
      bioDayAlert.innerHTML = `<span class="material-symbols-rounded">schedule</span><span>La captura se habilita del <b>${escapeHtml(r.data.captureWindowStart || "")}</b> al <b>${escapeHtml(r.data.captureWindowEnd || "")}</b>. Fecha objetivo: <b>${escapeHtml(r.data.fechaPedidoProgramada || "")}</b>.</span>`;
    } else {
      bioHint.textContent = "La ventana de captura ya cerró.";
      bioDayAlert.classList.add("bad");
      bioDayAlert.innerHTML = `<span class="material-symbols-rounded">event_busy</span><span>La ventana operativa terminó el <b>${escapeHtml(r.data.captureWindowEnd || "")}</b>. Fecha objetivo: <b>${escapeHtml(r.data.fechaPedidoProgramada || "")}</b>.</span>`;
    }

    renderBioRows(r.data.rows || []);
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
    const normalized = normalizeTodayReports(todayData);

    TODAY_CACHE = normalized;

    console.log("hydrateTodayForms() RAW =>", todayData);
    console.log("hydrateTodayForms() NORMALIZED =>", TODAY_CACHE);

    HAS_TODAY_SR = !!TODAY_CACHE.sr;
    HAS_TODAY_CONS = !!TODAY_CACHE.cons;

    if (HAS_TODAY_SR) {
      loadExistenciaIntoForm(TODAY_CACHE.sr);
    } else {
      if ($("nombreSR")) $("nombreSR").value = "";

      [
        "bcg",
        "hepatitis_b",
        "hexavalente",
        "dpt",
        "rotavirus",
        "neumococica_13",
        "neumococica_20",
        "srp",
        "sr",
        "vph",
        "varicela",
        "hepatitis_a",
        "td",
        "tdpa",
        "covid_19",
        "influenza",
        "vsr"
      ].forEach(id => {
        if ($(id)) $(id).value = "";
      });

      ORIGINAL_SR = null;
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
    $("sumFecha").textContent = data?.fecha || "—";
    $("sumTotal").textContent = data?.total_unidades ?? 0;
    $("sumCapturadas").textContent = data?.total_capturadas ?? 0;
    $("sumFaltantes").textContent = data?.total_faltantes ?? 0;

    const capturadas = data?.capturadas || [];
    const faltantes = data?.faltantes || [];

    $("capturadasCount").textContent = `${capturadas.length}`;
    $("faltantesCount").textContent = `${faltantes.length}`;

    // Semáforo automático
    if ($("kpiCardFaltantes")) {
      $("kpiCardFaltantes").className = "kpiCard " + (faltantes.length > 0 ? "warn" : "ok");
    }


    const tipoTxt = (data?.tipo === "CONS") ? "Consumibles" : "Existencia de biológicos";
    const msg = data?.mensaje || `Consulta cargada: ${tipoTxt} del ${data?.fecha || "—"}`;
    $("summaryMsg").textContent = msg;

    const tbodyCap = $("capturadasTbody");
    const tbodyFal = $("faltantesTbody");
    const cardsCap = $("capturadasCards");
    const cardsFal = $("faltantesCards");

    if (!capturadas.length) {
      tbodyCap.innerHTML = `<tr><td colspan="5" class="muted">No hay capturas registradas para esa consulta</td></tr>`;
      if (cardsCap) {
        cardsCap.innerHTML = `<div class="muted">No hay capturas registradas para esa consulta</div>`;
      }
    } else {
      tbodyCap.innerHTML = capturadas.map(r => `
      <tr>
        <td>${escapeHtml(r.municipio || "")}</td>
        <td>${escapeHtml(r.clues || "")}</td>
        <td>${escapeHtml(r.unidad || "")}</td>
        <td>${escapeHtml(r.capturado_por || "")}</td>
        <td><span class="statusOk">${r.editado === "SI" ? "Capturado / editado" : "Capturado"}</span></td>
      </tr>
    `).join("");

      if (cardsCap) {
        cardsCap.innerHTML = capturadas.map(r => `
        <div class="captureMobileCard">
          <div class="captureMobileHead">
            <div class="captureMobileTitle">${escapeHtml(r.unidad || "Unidad sin nombre")}</div>
            <div class="captureMobileStatus ok">${r.editado === "SI" ? "Capturado / editado" : "Capturado"}</div>
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

            <div class="captureMobileField">
              <div class="captureMobileLabel">Capturó</div>
              <div class="captureMobileValue">${escapeHtml(r.capturado_por || "")}</div>
            </div>
          </div>
        </div>
      `).join("");
      }
    }

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
    STATUS = status || null;

    syncAppState({
      user: USER,
      status: STATUS,
      token: (typeof TOKEN !== "undefined") ? TOKEN : "",
      isMobile: document.body.classList.contains("mobile-mode"),
      isLowPerf: document.body.classList.contains("lowperf"),
      mainPanel: "CAP"
    });

    showRightColumn(true);

    $("who").textContent = `${user.clues || "—"} — ${user.unidad || "—"}`;
    $("welcome").textContent = `Hola, ${user.usuario}`;
    $("rolTxt").textContent = `Perfil: ${user.rol || "UNIDAD"}`;
    if ($("tabCAPText")) {
      $("tabCAPText").textContent = (user.rol === "UNIDAD") ? "Captura" : "Panel";
    }

    if ($("btnOpenUpload")) {
      const isOpsAdmin = user.rol === "ADMIN" || user.rol === "JURISDICCIONAL";
      $("btnOpenUpload").style.display = isOpsAdmin ? "none" : "inline-flex";
    }

    if (user.rol === "ADMIN" || user.rol === "JURISDICCIONAL") {
      $("munTxt").textContent = "Municipio(s): Todos";
    } else if (user.rol === "MUNICIPAL") {
      $("munTxt").textContent = `Municipio(s): ${user.municipio || "—"}`;
    } else {
      $("munTxt").textContent = `Municipio: ${user.municipio || "—"}`;
    }
    if (STATUS) {
      $("dayTxt").textContent = formatDayBadgeMx(STATUS.today);

      const hora = new Date().getHours();

      let saludo = "";

      if (hora < 12) {
        saludo = "Buenos días ☀️ Qué bueno verte por aquí";
      } else if (hora < 19) {
        saludo = "Buenas tardes 🌤️ Todo listo para continuar";
      } else {
        saludo = "Buenas noches 🌙 Seguimos trabajando";
      }

      $("capStatus").innerHTML = `<h2 class="greetingTitle">${saludo}</h2>`;
      paintStatusChips(STATUS);
    }

    const isUnidad = user.rol === "UNIDAD";
    const isAdmin = user.rol === "ADMIN";
    const isJurisdiccional = user.rol === "JURISDICCIONAL";
    const isMunicipal = user.rol === "MUNICIPAL";
    const canExport = isAdmin || isJurisdiccional || isMunicipal;


    if ($("btnExport")) $("btnExport").style.display = canExport ? "inline-flex" : "none";
    if ($("btnExportBIO")) $("btnExportBIO").style.display = canExport ? "inline-flex" : "none";
    if ($("tabADMIN")) $("tabADMIN").style.display = isAdmin ? "block" : "none";
    if ($("tabNOTIFS")) $("tabNOTIFS").style.display = (isAdmin || isJurisdiccional || isMunicipal) ? "block" : "none";
    if ($("btnTopNotifications")) $("btnTopNotifications").style.display = (isUnidad || isAdmin || isJurisdiccional || isMunicipal) ? "inline-flex" : "none";

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
    $("loginStatus").textContent = "—";
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

  function activateMain(panel) {
    if (panel === "NOTIFS" && USER && USER.rol === "UNIDAD") {
      closeTopNotifDropdown();
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

    const role = String((USER && USER.rol) || "").trim().toUpperCase();
    const isUnidad = role === "UNIDAD";
    const isAdmin = role === "ADMIN";
    const isMunicipal = role === "MUNICIPAL";
    const isJurisdiccional = role === "JURISDICCIONAL";
    const isOps = isAdmin || isMunicipal || isJurisdiccional;

    $("tabCAP")?.classList.toggle("active", panel === "CAP");
    $("tabNOTIFS")?.classList.toggle("active", panel === "NOTIFS");
    $("tabADMIN")?.classList.toggle("active", panel === "ADMIN");

    if ($("panelCAP")) $("panelCAP").style.display = (panel === "CAP" && isUnidad) ? "block" : "none";
    if ($("panelAdminOpsTabs")) $("panelAdminOpsTabs").style.display = (panel === "CAP" && isOps) ? "block" : "none";
    if ($("panelCaptureSummary")) $("panelCaptureSummary").style.display = "none";
    if ($("panelPINOLADMIN")) $("panelPINOLADMIN").style.display = "none";
    if ($("panelHISTORY")) $("panelHISTORY").style.display = "none";
    if ($("panelEDITLOG")) $("panelEDITLOG").style.display = "none";
    if ($("panelNOTIFS")) $("panelNOTIFS").style.display = (panel === "NOTIFS") ? "block" : "none";
    if ($("panelADMIN")) $("panelADMIN").style.display = (panel === "ADMIN" && isAdmin) ? "block" : "none";

    if (panel === "CAP" && isOps) {
      if (!samePanel || APP_STATE.opsTab !== "CAPTURE") {
        syncAppState({ opsTab: "CAPTURE" });
        activateOpsTab("CAPTURE");
      }
      refreshPinolBadgeOnly().catch(() => { });
      if (!samePanel) schedulePanelScroll("panelCaptureSummary", 80, false);
    }

    if (panel === "CAP" && isUnidad) {
      if (!samePanel) schedulePanelScroll("panelCAP", 80, false);
    }

    if (panel === "NOTIFS") {
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
    if (role !== "UNIDAD") {
      $("tabSR")?.classList.remove("active");
      $("tabCONS")?.classList.remove("active");
      $("tabBIO")?.classList.remove("active");
      $("tabPINOL")?.classList.remove("active");

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

    $("tabSR").classList.toggle("active", tab === "SR");
    $("tabCONS").classList.toggle("active", tab === "CONS");
    $("tabBIO").classList.toggle("active", tab === "BIO");
    $("tabPINOL").classList.toggle("active", tab === "PINOL");

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
    const isOps = role === "ADMIN" || role === "MUNICIPAL" || role === "JURISDICCIONAL";
    if (!isOps) return;

    const panelCaptureSummary = $("panelCaptureSummary");
    const panelPINOLADMIN = $("panelPINOLADMIN");
    const panelHISTORY = $("panelHISTORY");
    const panelLOTES = $("panelLOTES");

    $("tabOPS_CAPTURE")?.classList.toggle("active", tab === "CAPTURE");
    $("tabOPS_PINOL")?.classList.toggle("active", tab === "PINOL");
    $("tabOPS_HISTORY")?.classList.toggle("active", tab === "HISTORY");
    $("tabLOTES")?.classList.toggle("active", tab === "LOTES");

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

    if (tab === "LOTES" && !sameTab) {
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

  $("loginForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    showOverlay("Validando tus credenciales…", "Iniciando sesión");

    try {
      const usuario = $("usuario").value.trim();
      const password = $("password").value.trim();

      if (!usuario || !password) {
        showToast("Por favor, ingresa usuario y contraseña", false, "warn");
        hideOverlay();
        return;
      }

      const r = await apiCall({ action: "login", usuario, password });

      if (!r || !r.ok) {
        showToast((r && r.error) ? r.error : "No se pudo iniciar sesión", false);
        return;
      }

      TOKEN = r.data.token;
      saveUxValue(UX_KEYS.lastUser, usuario);
      localStorage.setItem("JS1_TOKEN", TOKEN);

      try {
        const st = await unitStatus();
        await hydrateSessionUi(r.data.user, st, {
          showSuccessToast: true,
          mustChangePassword: !!r.data.mustChange
        });

      } catch (postLoginError) {
        console.error("Post-login error:", postLoginError);
        showToast("Sesión iniciada, pero hubo un error al cargar algunos paneles", true, "warn");
      }

    } catch (e) {
      console.error("Login flow error:", e);
      showToast("Error al iniciar sesión o cargar datos iniciales", false);
    } finally {
      hideOverlay();
    }
  });

  $("btnSaveSR").onclick = async () => {
    if (isBtnBusy("btnSaveSR")) return;
    
    const nombre = $("nombreSR") ? $("nombreSR").value.trim() : "";
    if (!nombre) {
      showToast("Por favor, ingresa el nombre del responsable", false, "warn");
      return;
    }

    // Colectar items de la tabla dinámica
    const items = [];
    let hasInvalid = false;
    document.querySelectorAll("#srCaptureTbody tr").forEach(tr => {
      const bio = tr.querySelector(".sr-bio-select").value;
      const lote = tr.querySelector(".sr-lote-select").value;
      const cantidad = tr.querySelector(".sr-cantidad-input").value;
      const recepcion = tr.querySelector(".sr-recepcion-input").value;

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
      showToast("Corrige las filas marcadas en rojo (biológico, lote y cantidad son obligatorios)", false, "warn");
      return;
    }

    if (items.length === 0) {
      showToast("Captura al menos un biológico con lote y cantidad", false, "warn");
      return;
    }

    setBtnBusy("btnSaveSR", true, EDIT_SR ? "Actualizando…" : "Guardando…");
    showOverlay(
      EDIT_SR ? "Estamos actualizando la existencia de biológicos…" : "Estamos guardando la existencia de biológicos…",
      EDIT_SR ? "Actualizando existencia" : "Guardando existencia"
    );

    try {
      saveUxValue(UX_KEYS.existenciaName, nombre);

      if (HAS_TODAY_SR && !EDIT_SR) {
        showToast("Ya existe una captura de hoy. Usa el botón Editar existencia de hoy.", false, "warn");
        return;
      }

      const action = EDIT_SR ? "updateSR" : "saveSR";

      const r = await apiCall({
        action,
        token: TOKEN,
        nombre,
        items: items
      });

      if (!r || !r.ok) {
        const msg = (r && r.error) ? r.error : "No se pudo guardar";

        if (msg.toLowerCase().includes("ya existe una captura") || msg.toLowerCase().includes("editar")) {
          invalidateTodayCache();
          const today = await getTodayReports(todayYmdLocal(), true);
          hydrateTodayForms(today);
          showToast(msg, false, "warn");
          return;
        }

        showToast(msg, false);
        return;
      }

      muteRealtimeFor(12000);

      showToast(
        EDIT_SR
          ? "Existencia de biológicos actualizada correctamente"
          : "Existencia de biológicos guardada correctamente",
        true,
        "good"
      );

      pushLiveEvent(
        "Existencia de biológicos",
        EDIT_SR
          ? "La existencia de biológicos fue actualizada correctamente."
          : "La existencia de biológicos fue guardada correctamente.",
        "good"
      );

      flashElement("formSR");
      setSavedStamp();

      await refreshAfterMutation({
        touchToday: true,
        touchCaptureSummary: true,
        touchHistory: true
      });

    } catch (e) {
      console.error("btnSaveSR error:", e);
      showToast("Error al guardar", false);
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
        items
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
      const zip = $("exportSplitByMunicipio") && $("exportSplitByMunicipio").checked ? "SI" : "NO";

      const res = await apiCall({
        action: tipo === "BIO" ? "bioExportMatrix" : "export",
        token: TOKEN,
        tipo,
        municipios,
        fechaInicio: fIni,
        fechaFin: fFin,
        fechaPedido: fIni,
        separarPorMunicipio: zip
      });

      if (!res || !res.ok) {
        showToast((res && res.error) ? res.error : "No se pudo generar el reporte", false);
        return;
      }

      const { filename, b64, mimeType } = res.data;
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: mimeType || "application/octet-stream" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename || "reporte.xlsx";
      link.click();

      showToast("El archivo se exportó correctamente");

    } catch (e) {
      showToast("Error al exportar", false);
    } finally {
      hideOverlay();
    }
  };



  $("btnRefreshUsers").onclick = () => refreshUsers();
  $("btnRefreshPinol").onclick = () => refreshPinol();
  $("pinolFiltroEstatus").addEventListener("change", () => refreshPinol());

  async function loadConsumiblesOverrideAdmin() {
    if (!USER || USER.rol !== "ADMIN") return;

    try {
      const r = await apiCall({
        action: "adminGetConsumiblesOverride",
        token: TOKEN
      });

      if (!r || !r.ok) return;

      const data = r.data || {};

      if ($("consOverrideDate")) $("consOverrideDate").value = data.fecha || "";
      if ($("consOverrideReason")) $("consOverrideReason").value = data.motivo || "";

      if ($("consOverrideStateTxt")) {
        $("consOverrideStateTxt").textContent = data.enabled
          ? `Activa: ${data.fecha || "—"}`
          : "Inactiva";
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
      $("tabCONS").disabled = !(STATUS && STATUS.canCaptureConsumibles);
      $("tabCONS").title = $("tabCONS").disabled
        ? "Disponible solo jueves o por apertura extraordinaria"
        : "";
    }

    paintStatusChips(STATUS);
  }

  $("btnSaveConsOverride").onclick = async () => {
    if (isBtnBusy("btnSaveConsOverride")) return;

    setBtnBusy("btnSaveConsOverride", true, "Guardando…");
    showOverlay("Guardando apertura extraordinaria…", "Consumibles");

    const safeNum = v => Number(v || 0);

    const payloadConsumibles = {
      srp_dosis: safeNum($("srp_dosis")?.value),
      sr_dosis: safeNum($("sr_dosis")?.value),
      jeringa_reconst_5ml_0605500438: safeNum($("jeringa_reconst_5ml_0605500438")?.value),
      jeringa_aplic_05ml_0605502657: safeNum($("jeringa_aplic_05ml_0605502657")?.value),
      aguja_0600403711: safeNum($("aguja_0600403711")?.value)
    };

    try {
      const r = await apiCall({
        action: "adminSetConsumiblesOverride",
        token: TOKEN,
        enabled: "SI",
        fecha: $("consOverrideDate") ? $("consOverrideDate").value : "",
        motivo: $("consOverrideReason") ? $("consOverrideReason").value.trim() : ""
      });

      if (!r || !r.ok) {
        showToast((r && r.error) ? r.error : "No se pudo guardar", false);
        return;
      }

      showToast("Apertura extraordinaria guardada");
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

    setBtnBusy("btnClearConsOverride", true, "Desactivando…");
    showOverlay("Desactivando apertura extraordinaria…", "Consumibles");

    try {
      const r = await apiCall({
        action: "adminSetConsumiblesOverride",
        token: TOKEN,
        enabled: "NO"
      });

      if (!r || !r.ok) {
        showToast((r && r.error) ? r.error : "No se pudo desactivar", false);
        return;
      }

      showToast("Apertura extraordinaria desactivada");
      await loadConsumiblesOverrideAdmin();
      await refreshConsumiblesStatusUi();
    } catch (e) {
      console.error("btnClearConsOverride error:", e);
      showToast("Error al desactivar apertura extraordinaria", false);
    } finally {
      setBtnBusy("btnClearConsOverride", false);
      hideOverlay();
    }
  };

  $("btnCreateUser").onclick = async () => {
    if (isBtnBusy("btnCreateUser")) return;
    setBtnBusy("btnCreateUser", true, "Creando…");
    showOverlay("Creando usuario…");
    try {
      const payload = {
        action: "adminCreateUser",
        token: TOKEN,
        usuario: $("new_usuario").value.trim(),
        password: $("new_password").value.trim(),
        municipio: $("new_municipio").value.trim(),
        clues: $("new_clues").value.trim(),
        unidad: $("new_unidad").value.trim(),
        rol: $("new_rol").value,
        activo: $("new_activo").value
      };

      const r = await apiCall(payload);
      if (!r || !r.ok) { showToast((r && r.error) ? r.error : "No se pudo crear", false); return; }

      showToast("Usuario creado");
      $("new_usuario").value = "";
      $("new_password").value = "";
      $("new_municipio").value = "";
      $("new_clues").value = "";
      $("new_unidad").value = "";
      $("new_rol").value = "UNIDAD";
      $("new_activo").value = "SI";

      await loadUnitCatalog();
      bindAdminAutocomplete();
      refreshUsers();
    } catch (e) {
      showToast("Error al crear usuario", false);
    } finally {
      setBtnBusy("btnCreateUser", false);
      hideOverlay();
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
        tr.innerHTML = `
        <td>${escapeHtml(u.usuario)}</td>
        <td>${escapeHtml(u.municipio)}</td>
        <td>${escapeHtml(u.clues)}</td>
        <td>${escapeHtml(u.unidad)}</td>
        <td>${escapeHtml(u.rol)}</td>
        <td>${escapeHtml(u.activo)}</td>
        <td>
          <div class="miniRow">
            <button class="miniBtn" data-action="reset" data-user="${escapeAttr(u.usuario)}" title="Reset password">
              <span class="material-symbols-rounded">lock_reset</span> Reset
            </button>
            <button class="miniBtn" data-action="toggle" data-user="${escapeAttr(u.usuario)}" data-active="${escapeAttr(u.activo)}" title="Activar/Inactivar">
              <span class="material-symbols-rounded">toggle_on</span> Activo
            </button>
          </div>
        </td>
      `;
        tbody.appendChild(tr);
      }

      if (cards) {
        cards.style.display = "block";
        cards.innerHTML = users.map(u => `
        <div class="mobileInfoCard">
          <div class="mobileInfoHead">
            <div class="mobileInfoTitle">${escapeHtml(u.usuario || "Usuario")}</div>
            <div class="mobileInfoBadge ${String(u.activo || "").toUpperCase() === "SI" ? "ok" : "bad"}">
              ${String(u.activo || "").toUpperCase() === "SI" ? "Activo" : "Inactivo"}
            </div>
          </div>

          <div class="mobileInfoFields">
            <div class="mobileInfoField">
              <div class="mobileInfoLabel">Municipio</div>
              <div class="mobileInfoValue">${escapeHtml(u.municipio || "—")}</div>
            </div>

            <div class="mobileInfoField">
              <div class="mobileInfoLabel">CLUES</div>
              <div class="mobileInfoValue">${escapeHtml(u.clues || "—")}</div>
            </div>

            <div class="mobileInfoField">
              <div class="mobileInfoLabel">Unidad</div>
              <div class="mobileInfoValue">${escapeHtml(u.unidad || "—")}</div>
            </div>

            <div class="mobileInfoField">
              <div class="mobileInfoLabel">Rol</div>
              <div class="mobileInfoValue">${escapeHtml(u.rol || "—")}</div>
            </div>
          </div>

          <div class="mobileActionRow">
            <button class="miniBtn" data-action="reset" data-user="${escapeAttr(u.usuario)}">
              <span class="material-symbols-rounded">lock_reset</span> Reset
            </button>
            <button class="miniBtn" data-action="toggle" data-user="${escapeAttr(u.usuario)}" data-active="${escapeAttr(u.activo)}">
              <span class="material-symbols-rounded">toggle_on</span> Activo
            </button>
          </div>
        </div>
      `).join("");
      }

      document.querySelectorAll("button[data-action]").forEach(btn => {
        btn.onclick = async () => {
          const act = btn.getAttribute("data-action");
          const user = btn.getAttribute("data-user");

          if (act === "reset") {
            const np = prompt("Nueva contraseña para: " + user);
            if (!np) return;
            await adminReset(user, np);
          }

          if (act === "toggle") {
            const current = btn.getAttribute("data-active") || "SI";
            const next = (current === "SI") ? "NO" : "SI";
            const ok = confirm(`Cambiar activo de ${user}: ${current} → ${next}?`);
            if (!ok) return;
            await adminSetActive(user, next);
          }
        };
      });

    } catch (e) {
      console.error("refreshUsers error:", e);
      showToast("Error al cargar usuarios", false);
    }
  }


  async function adminReset(usuario, newPassword) {
    showOverlay("Actualizando contraseña…");
    try {
      const r = await apiCall({ action: "adminResetPassword", token: TOKEN, usuario, newPassword });
      if (!r || !r.ok) { showToast((r && r.error) ? r.error : "No se pudo", false); return; }
      showToast("Contraseña actualizada");
      refreshUsers();
    } catch (e) {
      showToast("Error en reset", false);
    } finally {
      hideOverlay();
    }
  }

  async function adminSetActive(usuario, activo) {
    showOverlay("Actualizando estatus…");
    try {
      const r = await apiCall({ action: "adminSetActive", token: TOKEN, usuario, activo });
      if (!r || !r.ok) { showToast((r && r.error) ? r.error : "No se pudo", false); return; }
      showToast("Estatus actualizado");
      refreshUsers();
    } catch (e) {
      showToast("Error en estatus", false);
    } finally {
      hideOverlay();
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
  let FACTS_TIMER = null;

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

  (async function init() {

    showOverlay("Cargando plataforma…");
    startFactsRotation();
    try {
      const u = await whoami();
      if (u) {
        const st = await unitStatus();
        await hydrateSessionUi(u, st, {
          showSuccessToast: true,
          mustChangePassword: !!u.mustChange
        });
      } else {
        setLoggedOutUI();
      }
    } catch (e) {
      setLoggedOutUI();
    } finally {
      hideOverlay();
    }
  })();

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
    const hdr1 = $("hdrClima");
    const hdr2 = $("hdrClima2");
    if (!hdr1 && !hdr2) return;

    try {
      if (hdr1) hdr1.textContent = "Obteniendo...";
      if (hdr2) hdr2.textContent = "Obteniendo...";

      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=20.5881&longitude=-100.3899&current=temperature_2m`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data && data.current) {
        const temp = Math.round(data.current.temperature_2m);
        if (hdr1) hdr1.textContent = `Qro ${temp}°C`;
        if (hdr2) hdr2.textContent = `${temp}°C`;

        const bcl1 = $("bClima");
        const bcl2 = $("bClima2");
        if (bcl1) {
          bcl1.classList.remove("warn");
          bcl1.classList.add("good");
        }
        if (bcl2) {
          bcl2.style.background = "var(--md-sys-color-secondary-container)";
          bcl2.style.color = "var(--md-sys-color-on-secondary-container)";
        }
      }
    } catch (e) {
      console.warn("initWeather failed:", e);
      if (hdr1) hdr1.textContent = "Qro 24°C";
      if (hdr2) hdr2.textContent = "24°C";
    }
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

    // Role specific targets
    let targetClues = "";
    let targetUnidad = "";

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

    // Límite de 15MB
    if (file.size > 15 * 1024 * 1024) {
      showToast("El archivo es demasiado grande (máx 15MB)", false);
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result.split(",")[1];
      const payload = {
        action: "uploadFile",
        token: TOKEN,
        filename: file.name,
        mimeType: file.type,
        base64: base64,
        category: category,
        targetClues: targetClues,
        targetUnidad: targetUnidad
      };

      try {
        closeUploadFilesModal();
        showOverlay("Subiendo archivo a Drive...", "Drive");
        setBtnBusy("btnDoUpload", true, "Subiendo…");
        const res = await apiCall(payload);
        if (res && res.ok) {
          showToast("¡Archivo subido exitosamente a Drive!", true);
        } else {
          showToast("Error al subir: " + (res?.error || "Desconocido"), false);
        }
      } catch (err) {
        showToast("Error de conexión: " + err.message, false);
      } finally {
        setBtnBusy("btnDoUpload", false);
      }
    };

    reader.onerror = () => {
      showToast("Error al leer el archivo local", false);
    };

    reader.readAsDataURL(file);
  }
