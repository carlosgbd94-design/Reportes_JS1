
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

let IS_INITIALIZED = false;
document.addEventListener("DOMContentLoaded", () => {
    if (IS_INITIALIZED) return;
    IS_INITIALIZED = true;

    // --- ARRANQUE INTEGRADO ---
    if (typeof initStaticAssets === 'function') initStaticAssets();
    if (typeof runBootUiSetup === 'function') runBootUiSetup();
    if (typeof paintPublicClock === 'function') paintPublicClock();
    if (typeof startPublicClockTimer === 'function') startPublicClockTimer();
    if (typeof initWeather === 'function') {
        initWeather();
        if (typeof LIVE_TIMERS !== 'undefined' && Array.isArray(LIVE_TIMERS)) {
            LIVE_TIMERS.push(setInterval(initWeather, 900000));
        }
    }

    const saved = loadSession();
    if (saved && saved.token && saved.user) {
      TOKEN = saved.token;
      USER = saved.user;
      apiCall("whoami").then(r => {
        if (r && r.ok && r.data) {
          USER = r.data;
          TOKEN = saved.token;
          saveSession(TOKEN, USER);
          hydrateSessionUi(USER, null, { showSuccessToast: false });
        } else {
          TOKEN = null; USER = null; clearSession();
        }
      }).catch(() => {
        TOKEN = null; USER = null; clearSession();
      });
    }

    const formLogin = document.getElementById("loginForm");
    if (formLogin) {
        formLogin.addEventListener("submit", async (ev) => {
            ev.preventDefault();
            const email = document.getElementById("usuario").value.trim();
            const password = document.getElementById("password").value.trim();
            if (!email || !password) { showToast("Ingresa credenciales", false, "warn"); return; }
            showOverlay("Iniciando sesión...", "Conectando");
            try {
                const loginResult = await apiCall("login", { usuario: email, password: password });
                if (!loginResult || !loginResult.ok) { throw new Error((loginResult && loginResult.error) || "Credenciales incorrectas."); }
                TOKEN = loginResult.data.token;
                USER = loginResult.data.user;
                saveSession(TOKEN, USER);
                try { 
                  await Promise.all([
                    loadBatchesForSession(USER),
                    unitStatus().then(estado => hydrateSessionUi(USER, estado, { showSuccessToast: true }))
                  ]);
                } catch(e) { await hydrateSessionUi(USER, null, { showSuccessToast: true }); }
                if (USER && USER.rol && ["ADMIN", "MUNICIPAL", "JURISDICCIONAL"].includes(USER.rol)) {
                    apiCall("silentAdminReminders").catch(()=>{});
                }
            } catch (error) { showToast(error.message || "Error al iniciar sesión", false, "bad"); } finally { hideOverlay(); }
        });
    }

    const footerYear = document.getElementById("footerYear");
    if (footerYear) footerYear.textContent = new Date().getFullYear();

    document.querySelectorAll(".nav-item[data-tab]").forEach(btn => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab");
        const panel = tab.replace("tab", "");
        activateMain(panel);
      });
    });

    navLogout?.addEventListener("click", () => {
      btnLogout?.click();
    });
});

const overlay = overlay;
const overlayMsg = overlayMsg;
const toast = toast;
const toastMsg = toastMsg;
const overlayTitle = overlayTitle;
