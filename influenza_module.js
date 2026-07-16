// --- SIREVAQ INFLUENZA META-LOGRO MODULE ---
const INFLUENZA_RUBROS = [
  { id: "r1", categoria: "Población blanca", grupo: "Primera dosis", edad: "6 a 11 meses" },
  { id: "r2", categoria: "Población blanca", grupo: "Primera dosis", edad: "12 a 23 meses" },
  { id: "r3", categoria: "Población blanca", grupo: "Primera dosis", edad: "24 a 35 meses" },
  { id: "r4", categoria: "Población blanca", grupo: "Primera dosis", edad: "36 a 47 meses" },
  { id: "r5", categoria: "Población blanca", grupo: "Primera dosis", edad: "48 a 59 meses" },
  { id: "r6", categoria: "Población blanca", grupo: "Segunda dosis", edad: "7 a 11 meses" },
  { id: "r7", categoria: "Población blanca", grupo: "Segunda dosis", edad: "12 a 23 meses" },
  { id: "r8", categoria: "Población blanca", grupo: "Segunda dosis", edad: "24 a 35 meses" },
  { id: "r9", categoria: "Población blanca", grupo: "Segunda dosis", edad: "36 a 47 meses" },
  { id: "r10", categoria: "Población blanca", grupo: "Segunda dosis", edad: "48 a 59 meses" },
  { id: "r11", categoria: "Población blanca", grupo: "Revacunación", edad: "18 a 23 meses" },
  { id: "r12", categoria: "Población blanca", grupo: "Revacunación", edad: "24 a 35 meses" },
  { id: "r13", categoria: "Población blanca", grupo: "Revacunación", edad: "36 a 47 meses" },
  { id: "r14", categoria: "Población blanca", grupo: "Revacunación", edad: "48 a 59 meses" },
  { id: "r15", categoria: "Población blanca", grupo: "Revacunación", edad: "60 años y más" },
  { id: "r16", categoria: "Población de riesgo de 5 a 59 años", grupo: "Grupos de riesgo", edad: "EMBARAZADAS" },
  { id: "r17", categoria: "Población de riesgo de 5 a 59 años", grupo: "Grupos de riesgo", edad: "PERSONAL DE SALUD EN UNIDADES MÉDICAS" },
  { id: "r18", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas que viven con VIH/SIDA", edad: "5 a 9 años" },
  { id: "r19", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas que viven con VIH/SIDA", edad: "10 a 19 años" },
  { id: "r20", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas que viven con VIH/SIDA", edad: "20 a 59 años" },
  { id: "r21", categoria: "Población de riesgo de 5 a 59 años", grupo: "Diabetes mellitus", edad: "5 a 9 años" },
  { id: "r22", categoria: "Población de riesgo de 5 a 59 años", grupo: "Diabetes mellitus", edad: "10 a 19 años" },
  { id: "r23", categoria: "Población de riesgo de 5 a 59 años", grupo: "Diabetes mellitus", edad: "20 a 59 años" },
  { id: "r24", categoria: "Población de riesgo de 5 a 59 años", grupo: "Obesidad mórbida", edad: "5 a 9 años" },
  { id: "r25", categoria: "Población de riesgo de 5 a 59 años", grupo: "Obesidad mórbida", edad: "10 a 19 años" },
  { id: "r26", categoria: "Población de riesgo de 5 a 59 años", grupo: "Obesidad mórbida", edad: "20 a 59 años" },
  { id: "r27", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas con cardiopatías agudas o crónicas", edad: "5 a 9 años" },
  { id: "r28", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas con cardiopatías agudas o crónicas", edad: "10 a 19 años" },
  { id: "r29", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas con cardiopatías agudas o crónicas", edad: "20 a 59 años" },
  { id: "r30", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas con enfermedad pulmonar crónica, incluye EPOC y asma", edad: "5 a 9 años" },
  { id: "r31", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas con enfermedad pulmonar crónica, incluye EPOC y asma", edad: "10 a 19 años" },
  { id: "r32", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas con enfermedad pulmonar crónica, incluye EPOC y asma", edad: "20 a 59 años" },
  { id: "r33", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas con cáncer", edad: "5 a 9 años" },
  { id: "r34", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas con cáncer", edad: "10 a 19 años" },
  { id: "r35", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas con cáncer", edad: "20 a 59 años" },
  { id: "r36", categoria: "Población de riesgo de 5 a 59 años", grupo: "Enfermedades cardiacas o pulmonares congénitas, u otros padecimientos crónicos que requieran consumo prolongado de salicilatos", edad: "5 a 9 años" },
  { id: "r37", categoria: "Población de riesgo de 5 a 59 años", grupo: "Enfermedades cardiacas o pulmonares congénitas, u otros padecimientos crónicos que requieran consumo prolongado de salicilatos", edad: "10 a 19 años" },
  { id: "r38", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas con insuficiencia renal", edad: "5 a 9 años" },
  { id: "r39", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas con insuficiencia renal", edad: "10 a 19 años" },
  { id: "r40", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas con insuficiencia renal", edad: "20 a 59 años" },
  { id: "r41", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas con inmunosupresión adquirida por enfermedad o tratamiento, excepto VIH /SIDA", edad: "5 a 9 años" },
  { id: "r42", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas con inmunosupresión adquirida por enfermedad o tratamiento, excepto VIH /SIDA", edad: "10 a 19 años" },
  { id: "r43", categoria: "Población de riesgo de 5 a 59 años", grupo: "Personas con inmunosupresión adquirida por enfermedad o tratamiento, excepto VIH /SIDA", edad: "20 a 59 años" },
  { id: "r44", categoria: "Población de riesgo de 5 a 59 años", grupo: "Otros grupos", edad: "5 a 9 años" },
  { id: "r45", categoria: "Población de riesgo de 5 a 59 años", grupo: "Otros grupos", edad: "10 a 19 años" },
  { id: "r46", categoria: "Población de riesgo de 5 a 59 años", grupo: "Otros grupos", edad: "20 a 59 años" }
];

// ISO Week Helper
function getISOWeek(date) {
  const tempDate = new Date(date.valueOf());
  tempDate.setHours(0, 0, 0, 0);
  tempDate.setDate(tempDate.getDate() + 4 - (tempDate.getDay() || 7));
  const yearStart = new Date(tempDate.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((tempDate - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}

let _campaignConfig = { fecha_inicio: "2025-10-03", fecha_fin: "2026-04-25" };

/**
 * Deriva el nombre de campaña (ej. "2025-2026") a partir de las fechas.
 * Si la campaña ya terminó, calcula la siguiente automáticamente.
 */
function deriveCampaignName(startStr, endStr) {
  const start = new Date(startStr + "T12:00:00");
  const end   = new Date(endStr   + "T12:00:00");
  const today = new Date();

  // Años iniciales de la campaña configurada
  let yr1 = start.getFullYear();
  let yr2 = end.getFullYear();

  // Si la campaña ya terminó, avanzar un año
  if (today > end) {
    yr1++;
    yr2++;
  }
  return `${yr1}-${yr2}`;
}

/** Puebla todos los selectores de campaña en el DOM */
function populateCampaignSelectors() {
  const name = deriveCampaignName(_campaignConfig.fecha_inicio, _campaignConfig.fecha_fin);
  const label = `Campaña ${name}`;
  const html  = `<option value="${name}">${label}</option>`;

  ["influenza_campana", "metaCampaignSelect"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  });

  // Actualizar badge/eyebrow si existe
  const badge = document.getElementById("influenzaCampaignBadge");
  if (badge) badge.textContent = label;
}

async function loadCampaignConfig() {
  try {
    const resConfig = await AppService.call("getinfluenza_config", {});
    if (resConfig && resConfig.data) {
      _campaignConfig.fecha_inicio = resConfig.data.fecha_inicio;
      _campaignConfig.fecha_fin    = resConfig.data.fecha_fin;
    }
  } catch (err) {
    console.error("Error al cargar configuración de campaña:", err);
  }
  // Siempre sincronizar los selectores después de cargar
  populateCampaignSelectors();
}

// Generar semanas epidemiológicas de Influenza
function generateCampaignWeeks() {
  const weeks = [];
  const startStr = _campaignConfig.fecha_inicio || "2025-10-03";
  const endStr   = _campaignConfig.fecha_fin    || "2026-04-25";
  let d = new Date(startStr + "T12:00:00");
  const end = new Date(endStr + "T12:00:00");

  // Si la campaña ya terminó, generar semanas de la SIGUIENTE campaña
  const today = new Date();
  if (today > end) {
    // Calcular fecha de inicio de la nueva campaña (primer viernes de octubre del año siguiente)
    const nextYear = end.getFullYear() + 1;
    d = new Date(`${nextYear}-10-01T12:00:00`);
    // Avanzar hasta el primer viernes
    while (d.getDay() !== 5) d.setDate(d.getDate() + 1);
    const nextEnd = new Date(`${nextYear + 1}-04-30T12:00:00`);
    while (d <= nextEnd) {
      const ymd = d.toISOString().split('T')[0];
      const weekNum = getISOWeek(d);
      weeks.push({ semana: weekNum, fecha: ymd, label: `Semana ${weekNum} (Viernes ${ymd})` });
      d.setDate(d.getDate() + 7);
    }
    return weeks;
  }

  while (d <= end) {
    const ymd = d.toISOString().split('T')[0];
    const weekNum = getISOWeek(d);
    weeks.push({ semana: weekNum, fecha: ymd, label: `Semana ${weekNum} (Viernes ${ymd})` });
    d.setDate(d.getDate() + 7);
  }
  return weeks;
}

// Inicializar el flujo de captura en UNIDAD
let _influenzaMetasCache = {};
let _influenzaCapturasCache = [];
let _influenzaDistribucionCache = [];

async function initInfluenzaCaptureFlow() {
  if (USER.rol !== "UNIDAD") return;
  
  await loadCampaignConfig();
  
  // Enlazar pestañas de Unidad
  const unitTabs = ["subtabUnitCaptura", "subtabUnitHistorico"];
  unitTabs.forEach(t => {
    const el = document.getElementById(t);
    if (el) {
      el.onclick = () => {
        unitTabs.forEach(x => {
          document.getElementById(x)?.classList.remove("active");
        });
        el.classList.add("active");

        document.getElementById("secUnitCaptura").style.setProperty("display", "none", "important");
        document.getElementById("secUnitHistorico").style.setProperty("display", "none", "important");

        const targetSec = t.replace("subtabUnit", "secUnit");
        document.getElementById(targetSec).style.setProperty("display", targetSec === "secUnitCaptura" ? "flex" : "block", "important");

        if (typeof syncTabGroupIndicator === 'function') {
          syncTabGroupIndicator('#influenzaUnitTabsContainer');
        }
      };
    }
  });
  
  // Inicializar indicador
  setTimeout(() => {
    if (typeof syncTabGroupIndicator === 'function') {
      syncTabGroupIndicator('#influenzaUnitTabsContainer');
    }
  }, 150);

  const weeks = generateCampaignWeeks();
  const weekSelect = document.getElementById("influenza_semana");
  if (weekSelect) {
    weekSelect.innerHTML = weeks.map(w => `<option value="${w.fecha}">${w.label}</option>`).join("");
    // Autoseleccionar la semana actual si coincide, o la última activa
    const today = new Date().toISOString().split("T")[0];
    const matchingWeek = weeks.find(w => w.fecha >= today);
    if (matchingWeek) {
      weekSelect.value = matchingWeek.fecha;
    } else {
      weekSelect.value = weeks[weeks.length - 1].fecha;
    }
    
    weekSelect.removeEventListener("change", renderCaptureGrid);
    weekSelect.addEventListener("change", renderCaptureGrid);
  }

  // Cargar datos iniciales
  await loadInfluenzaUnitData();
  renderCaptureGrid();
  loadInfluenzaHistoryList();
  // Nota: el guardado se maneja desde el globalCommandHub (syncCommandHub → saveInfluenzaReport)
}

async function loadInfluenzaUnitData() {
  try {
    // 1. Metas de la unidad
    const campana = document.getElementById("influenza_campana").value;
    const resMetas = await AppService.call("getinfluenza_metas", { anio_campana: campana });
    const unitMetaRec = resMetas.data.find(r => r.clues === USER.clues);
    _influenzaMetasCache = unitMetaRec ? unitMetaRec.metas : {};

    // 2. Historial de capturas
    const resCapturas = await AppService.call("getinfluenza_capturas", { clues: USER.clues, anio_campana: campana });
    _influenzaCapturasCache = resCapturas.data || [];

    // 3. Distribución de frascos
    const resFrascos = await AppService.call("getinfluenza_distribucion", { clues: USER.clues });
    _influenzaDistribucionCache = resFrascos.data || [];
  } catch (err) {
    console.error("Error al cargar datos de Influenza:", err);
  }
}

function renderCaptureGrid() {
  const container = document.getElementById("influenzaCaptureGroupsContainer");
  if (!container) return;
  container.innerHTML = "";

  const selectedFecha = document.getElementById("influenza_semana").value;
  const currentReport = _influenzaCapturasCache.find(r => r.fecha === selectedFecha);
  const currentValores = currentReport ? currentReport.valores : {};

  // Calcular acumulado previo (excluyendo la semana seleccionada)
  const acumuladosPrevios = {};
  INFLUENZA_RUBROS.forEach(rb => {
    acumuladosPrevios[rb.id] = 0;
    _influenzaCapturasCache.forEach(r => {
      if (r.fecha !== selectedFecha) {
        acumuladosPrevios[rb.id] += Number(r.valores[rb.id] || 0);
      }
    });
  });

  // Agrupar rubros por categoría y grupo para una presentación visual limpia y organizada
  const groups = {};
  INFLUENZA_RUBROS.forEach(rb => {
    const groupKey = `${rb.categoria} - ${rb.grupo}`;
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(rb);
  });

  // Renderizar cada grupo en un panel/tarjeta con fondo blanco sólido
  Object.entries(groups).forEach(([groupTitle, rubros]) => {
    const card = document.createElement("div");
    card.className = "bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm flex flex-col gap-4";
    card.style.backgroundColor = "#ffffff";

    card.innerHTML = `
      <div class="pb-2 border-b border-slate-100">
        <h4 class="text-xs font-black text-violet-900 uppercase tracking-wider m-0">${groupTitle}</h4>
      </div>
      <div class="tableWrap overflow-x-auto w-full rounded-xl border border-slate-200 bg-white">
        <table class="w-full border-collapse text-left text-xs font-semibold text-slate-700">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200">
              <th class="p-3">Subgrupo / Edad</th>
              <th class="p-3 text-center" style="width: 100px;">Meta Anual</th>
              <th class="p-3 text-center" style="width: 100px;">Acumulado</th>
              <th class="p-3 text-center" style="width: 120px;">Esta Semana</th>
              <th class="p-3 text-center" style="width: 100px;">Avance %</th>
            </tr>
          </thead>
          <tbody class="tbody-inputs">
          </tbody>
        </table>
      </div>
    `;

    const tbody = card.querySelector(".tbody-inputs");

    rubros.forEach(rb => {
      const meta = Number(_influenzaMetasCache[rb.id] || 0);
      const acum = acumuladosPrevios[rb.id];
      const val = currentValores[rb.id] !== undefined ? currentValores[rb.id] : "";
      const isLocked = meta === 0;

      const row = document.createElement("tr");

      // Calcular avance inicial
      const currentVal = Number(val || 0);
      const totalDoses = acum + currentVal;
      const pct = meta > 0 ? Math.round((totalDoses / meta) * 100) : 0;
      const cappedPct = Math.min(pct, 100);

      // Semáforo de color
      let barColor, badgeBg, badgeText, badgeBorder;
      if (!meta) {
        barColor = '#cbd5e1'; badgeBg = '#f1f5f9'; badgeText = '#94a3b8'; badgeBorder = '#e2e8f0';
      } else if (pct >= 85) {
        barColor = '#10b981'; badgeBg = '#d1fae5'; badgeText = '#065f46'; badgeBorder = '#6ee7b7';
      } else if (pct >= 50) {
        barColor = '#f59e0b'; badgeBg = '#fef3c7'; badgeText = '#92400e'; badgeBorder = '#fcd34d';
      } else {
        barColor = '#ef4444'; badgeBg = '#fee2e2'; badgeText = '#991b1b'; badgeBorder = '#fca5a5';
      }

      // Estilo de fila inhabilitada
      if (isLocked) {
        row.style.cssText = 'opacity:0.4; pointer-events:none; background: #f8fafc;';
      } else {
        row.className = 'border-b border-slate-100 hover:bg-violet-50/30 transition-all duration-200';
      }

      row.innerHTML = `
        <td class="p-3">
          <span class="text-xs font-semibold ${isLocked ? 'text-slate-400 italic' : 'text-slate-700'}">${rb.edad}</span>
          ${isLocked ? '<span style="display:inline-block;margin-left:6px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;background:#e2e8f0;color:#94a3b8;padding:1px 6px;border-radius:20px;">Sin meta</span>' : ''}
        </td>
        <td class="p-3 text-center font-bold text-slate-600 text-xs">${meta || '—'}</td>
        <td class="p-3 text-center font-bold text-xs" style="color:#6d28d9;">${acum}</td>
        <td class="p-3 text-center">
          <input type="number" min="0" step="1"
            id="input_inf_${rb.id}"
            style="width:70px; text-align:center; font-weight:700; font-size:12px;
              background:${isLocked ? '#f1f5f9' : '#fff'};
              border:1.5px solid ${isLocked ? '#e2e8f0' : '#c4b5fd'};
              border-radius:10px; padding:5px 8px; outline:none;
              cursor:${isLocked ? 'not-allowed' : 'text'};
              transition: border-color 0.2s, box-shadow 0.2s;"
            value="${val}"
            ${isLocked ? 'disabled placeholder="—"' : 'placeholder="0"'}
          >
        </td>
        <td class="p-3" style="min-width:110px;">
          <div style="display:flex; flex-direction:column; align-items:flex-start; gap:3px;">
            <div style="display:flex; justify-content:space-between; width:100%; margin-bottom:2px;">
              <span id="pct_inf_${rb.id}" style="
                font-size:10px; font-weight:800;
                background:${badgeBg}; color:${badgeText};
                border:1px solid ${badgeBorder};
                padding:2px 7px; border-radius:20px;
                transition: background 0.3s, color 0.3s;
              ">${meta > 0 ? pct + '%' : 'N/A'}</span>
            </div>
            <div style="width:100%; height:6px; background:#e2e8f0; border-radius:6px; overflow:hidden;">
              <div id="bar_inf_${rb.id}" style="
                height:100%; width:${cappedPct}%;
                background:${barColor};
                border-radius:6px;
                transition: width 0.5s cubic-bezier(0.34,1.56,0.64,1), background 0.3s;
              "></div>
            </div>
          </div>
        </td>
      `;
      tbody.appendChild(row);

      // Eventos en vivo para validación y avance % con barra
      if (!isLocked) {
        const input  = row.querySelector(`#input_inf_${rb.id}`);
        const pctEl  = row.querySelector(`#pct_inf_${rb.id}`);
        const barEl  = row.querySelector(`#bar_inf_${rb.id}`);

        input.addEventListener("focus", () => {
          input.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.2)';
        });
        input.addEventListener("blur", () => {
          input.style.boxShadow = '';
        });

        input.addEventListener("input", () => {
          let v = parseInt(input.value) || 0;
          if (v < 0) { v = 0; input.value = 0; }

          const total = acum + v;
          const overMeta = total > meta;

          if (overMeta) {
            input.style.borderColor = '#ef4444';
            input.style.background  = '#fee2e2';
          } else {
            input.style.borderColor = '#c4b5fd';
            input.style.background  = '#fff';
          }

          const livePct = Math.round((total / meta) * 100);
          const liveCapped = Math.min(livePct, 100);

          let lBarColor, lBadgeBg, lBadgeText, lBadgeBorder;
          if (livePct >= 85) {
            lBarColor = '#10b981'; lBadgeBg = '#d1fae5'; lBadgeText = '#065f46'; lBadgeBorder = '#6ee7b7';
          } else if (livePct >= 50) {
            lBarColor = '#f59e0b'; lBadgeBg = '#fef3c7'; lBadgeText = '#92400e'; lBadgeBorder = '#fcd34d';
          } else {
            lBarColor = '#ef4444'; lBadgeBg = '#fee2e2'; lBadgeText = '#991b1b'; lBadgeBorder = '#fca5a5';
          }

          pctEl.textContent = `${livePct}%`;
          pctEl.style.background   = lBadgeBg;
          pctEl.style.color        = lBadgeText;
          pctEl.style.borderColor  = lBadgeBorder;
          barEl.style.width        = liveCapped + '%';
          barEl.style.background   = lBarColor;
        });
      }
    });

    container.appendChild(card);
  });
}

function updateFlaskCalculation() {
  // El cálculo y control de frascos para UNIDAD ha sido removido de su formulario.
  // La comparación y el balance se manejan ahora a nivel MUNICIPAL.
}

async function loadInfluenzaHistoryList() {
  const container = document.getElementById("influenzaHistorialList");
  if (!container) return;
  container.innerHTML = "";

  if (!_influenzaCapturasCache.length) {
    container.innerHTML = `<div class="text-sm text-slate-400 font-medium p-4 text-center">No se han registrado reportes aún.</div>`;
    return;
  }

  _influenzaCapturasCache.forEach(r => {
    let totalDosis = 0;
    Object.values(r.valores).forEach(v => totalDosis += Number(v || 0));

    // Generar Folio Único
    const shortId = r.id ? r.id.substring(0, 8).toUpperCase() : "TEMP";
    const dateStr = r.fecha.replace(/-/g, "");
    const folio = `INF-${dateStr}-${shortId}`;

    const card = document.createElement("div");
    card.className = "p-4 rounded-xl border border-slate-200 hover:border-violet-300 hover:bg-violet-50/20 transition-all flex items-center justify-between cursor-pointer bg-white";
    card.style.backgroundColor = "#ffffff";
    card.innerHTML = `
      <div>
        <div class="text-[10px] font-extrabold text-violet-600 mb-1 tracking-wider">FOLIO: ${folio}</div>
        <div class="text-sm font-extrabold text-slate-700">Semana del reporte: ${r.fecha}</div>
        <div class="text-xs text-slate-500 mt-1">Dosis aplicadas: <b>${totalDosis}</b> | Reportado por: ${r.capturado_por}</div>
      </div>
      <button class="ghostBtn h-[32px] text-xs font-bold flex items-center justify-center">
        <span class="material-symbols-rounded mr-1 text-[16px]">edit</span> Cargar
      </button>
    `;
    card.onclick = () => {
      document.getElementById("influenza_semana").value = r.fecha;
      renderCaptureGrid();
      // Cambiar automáticamente a la pestaña de captura
      document.getElementById("subtabUnitCaptura").click();
      showToast(`Reporte con folio ${folio} cargado para edición/consulta.`, true, "info");
    };
    container.appendChild(card);
  });
}

async function saveInfluenzaReport() {
  const selectedFecha = document.getElementById("influenza_semana").value;
  const nombre = document.getElementById("nombreINFLUENZA").value.trim();
  const campana = document.getElementById("influenza_campana").value;

  if (!nombre) {
    showToast("Por favor ingresa el nombre de quien reporta la captura.", false, "bad");
    return;
  }

  // Validaciones del reporte
  let hasOverMetaError = false;
  const valores = {};
  
  for (const rb of INFLUENZA_RUBROS) {
    const input = document.getElementById(`input_inf_${rb.id}`);
    const val = input ? parseInt(input.value) || 0 : 0;
    valores[rb.id] = val;

    // Calcular acumulado
    let acum = 0;
    _influenzaCapturasCache.forEach(r => {
      if (r.fecha !== selectedFecha) {
        acum += Number(r.valores[rb.id] || 0);
      }
    });

    const meta = Number(_influenzaMetasCache[rb.id] || 0);
    if (meta > 0 && (acum + val) > meta) {
      hasOverMetaError = true;
    }
  }

  if (hasOverMetaError) {
    showToast("No se puede guardar el reporte. Uno o más rubros superan la meta asignada.", false, "bad");
    return;
  }

  // Lógica de ventana: Jueves y Viernes
  const d_dow = new Date().getDay();
  // Permitir capturar/editar solo Jueves (4) o Viernes (5)
  if (d_dow !== 4 && d_dow !== 5) {
    // Si queremos probar en desarrollo sin restricción, podemos desactivarlo, pero el cliente pidió restrictivo:
    // "estableceremos de igual manera los días JUEVES Y VIERNES para captura semanal"
    // Validar con Override si existiese
    showToast("El reporte de Influenza solo se puede capturar los días Jueves o Viernes.", false, "bad");
    return;
  }

  const payload = {
    clues: USER.clues,
    unidad: USER.unidad,
    municipio: USER.municipio,
    fecha: selectedFecha,
    anio_campana: campana,
    valores,
    capturado_por: nombre,
    editado_por: "UNIDAD"
  };

  const totalDosisEstaSemana = Object.values(valores).reduce((s, v) => s + Number(v || 0), 0);
  const rubrosCapturados = Object.values(valores).filter(v => Number(v) > 0).length;
  const metaTotal = Object.values(_influenzaMetasCache).reduce((s, v) => s + Number(v || 0), 0);
  
  // Acumulado general antes de este reporte
  const acumPrevio = {};
  INFLUENZA_RUBROS.forEach(rb => {
    acumPrevio[rb.id] = 0;
    _influenzaCapturasCache.forEach(r => {
      if (r.fecha !== selectedFecha) acumPrevio[rb.id] += Number(r.valores[rb.id] || 0);
    });
  });
  const totalAcumPrevio = Object.values(acumPrevio).reduce((s, v) => s + v, 0);
  const totalConNuevo = totalAcumPrevio + totalDosisEstaSemana;
  const avanceGlobal = metaTotal > 0 ? Math.round((totalConNuevo / metaTotal) * 100) : 0;

  await AppService.runCapture({
    btnId: "btnSaveINFLUENZA",
    title: "Guardando reporte",
    msg: "Registrando reporte semanal de Influenza...",
    successMsg: `✅ Reporte guardado · ${totalDosisEstaSemana} dosis esta semana · Avance global: ${avanceGlobal}%`,
    eventTitle: "Influenza",
    eventMsg: `Captura semana ${selectedFecha}: ${totalDosisEstaSemana} dosis en ${rubrosCapturados} rubros. Avance acumulado: ${avanceGlobal}%.`,
    action: async () => {
      const res = await AppService.call("saveinfluenza_captura", payload);
      await loadInfluenzaUnitData();
      renderCaptureGrid();
      loadInfluenzaHistoryList();
      return res;
    }
  });
}


// --- LÓGICA DE ADMINISTRACIÓN Y MUNICIPIOS ---

async function refreshInfluenzaAdminPanel() {
  // Manejador de subpestañas
  initInfluenzaSubtabs();

  // Cargar configuración de fechas
  await loadCampaignConfig();

  // Cargar metas de la campaña y catálogo de unidades
  await loadInfluenzaAdminData();

  // Poblar Filtros
  await populateInfluenzaAdminFilters();

  // Renderizar la sección activa
  renderActiveAdminSection();
}

function initInfluenzaSubtabs() {
  const tabs = ["subtabInfluenzaAvances", "subtabInfluenzaMetas", "subtabInfluenzaFrascos", "subtabInfluenzaConfig"];
  
  // Inicializar estado de visibilidad
  tabs.forEach(t => {
    const el = document.getElementById(t);
    const targetSec = t.replace("subtab", "sec");
    if (el && targetSec) {
      if (el.classList.contains("active")) {
        document.getElementById(targetSec).style.setProperty("display", "flex", "important");
      } else {
        document.getElementById(targetSec).style.setProperty("display", "none", "important");
      }
    }
  });

  tabs.forEach(t => {
    const el = document.getElementById(t);
    if (el) {
      el.onclick = () => {
        tabs.forEach(x => {
          document.getElementById(x)?.classList.remove("active");
        });
        el.classList.add("active");

        // Ocultar todas las secciones
        document.getElementById("secInfluenzaAvances").style.setProperty("display", "none", "important");
        document.getElementById("secInfluenzaMetas").style.setProperty("display", "none", "important");
        document.getElementById("secInfluenzaFrascos").style.setProperty("display", "none", "important");
        const configSec = document.getElementById("secInfluenzaConfig");
        if (configSec) configSec.style.setProperty("display", "none", "important");

        const targetSec = t.replace("subtab", "sec");
        const secEl = document.getElementById(targetSec);
        if (secEl) secEl.style.setProperty("display", "flex", "important");

        if (typeof syncTabGroupIndicator === 'function') {
          syncTabGroupIndicator('#influenzaAdminTabsContainer');
        }

        renderActiveAdminSection();
      };
    }
  });

  // Inicializar indicador
  setTimeout(() => {
    if (typeof syncTabGroupIndicator === 'function') {
      syncTabGroupIndicator('#influenzaAdminTabsContainer');
    }
  }, 150);
}

let _adminMetasArray = [];
let _adminCapturasArray = [];
let _adminFrascosArray = [];
let _allUnidades = [];

async function loadInfluenzaAdminData() {
  try {
    const campana = document.getElementById("metaCampaignSelect").value;
    
    // 1. Cargar metas
    const resMetas = await AppService.call("getinfluenza_metas", { anio_campana: campana });
    _adminMetasArray = resMetas.data || [];

    // 2. Cargar capturas
    const resCapturas = await AppService.call("getinfluenza_capturas", { anio_campana: campana });
    _adminCapturasArray = resCapturas.data || [];

    // 3. Cargar catálogo de unidades
    const { data: units } = await window.supabase.from("unidades").select("clues, unidad, municipio").eq("activo", "SI");
    _allUnidades = units || [];

    // 4. Cargar entregas de frascos
    const resFrascos = await AppService.call("getinfluenza_distribucion", {});
    _adminFrascosArray = resFrascos.data || [];
  } catch (err) {
    console.error("Error al cargar datos administrativos de Influenza:", err);
  }
}

async function populateInfluenzaAdminFilters() {
  const muniSelect = document.getElementById("adminInfluenzaMuni");
  const cluesSelect = document.getElementById("adminInfluenzaClues");
  const semSelect = document.getElementById("adminInfluenzaSemana");

  if (!muniSelect) return;

  const role = USER.rol.toUpperCase();
  const allowedMunis = USER.municipiosAllowed || [USER.municipio];

  // Municipios
  let munis = ["QUERETARO", "CORREGIDORA", "EL MARQUES", "HUIMILPAN"];
  if (role === "MUNICIPAL") {
    munis = munis.filter(m => allowedMunis.includes(m.toUpperCase()));
  }

  muniSelect.innerHTML = munis.map(m => `<option value="${m}">${m}</option>`).join("");
  muniSelect.removeEventListener("change", updateCluesFilterAndRender);
  muniSelect.addEventListener("change", updateCluesFilterAndRender);

  // Semanas
  const weeks = generateCampaignWeeks();
  semSelect.innerHTML = weeks.map(w => `<option value="${w.fecha}">${w.label}</option>`).join("");
  semSelect.removeEventListener("change", renderAvancesAndConcentrados);
  semSelect.addEventListener("change", renderAvancesAndConcentrados);

  await updateCluesFilterAndRender();
}

async function updateCluesFilterAndRender() {
  const muniSelect = document.getElementById("adminInfluenzaMuni").value;
  const cluesSelect = document.getElementById("adminInfluenzaClues");

  if (!cluesSelect) return;

  const units = _allUnidades.filter(u => u.municipio.toUpperCase() === muniSelect.toUpperCase());
  
  cluesSelect.innerHTML = `<option value="CONCENTRADO_MUNICIPAL">-- CONCENTRADO MUNICIPAL --</option>` + 
    units.map(u => `<option value="${u.clues}">${u.unidad} (${u.clues})</option>`).join("");

  cluesSelect.removeEventListener("change", renderAvancesAndConcentrados);
  cluesSelect.addEventListener("change", renderAvancesAndConcentrados);

  renderAvancesAndConcentrados();
}

function renderActiveAdminSection() {
  const advancesTab = document.getElementById("subtabInfluenzaAvances");
  const metasTab = document.getElementById("subtabInfluenzaMetas");
  const frascosTab = document.getElementById("subtabInfluenzaFrascos");
  const configTab = document.getElementById("subtabInfluenzaConfig");

  if (advancesTab && advancesTab.classList.contains("active")) {
    renderAvancesAndConcentrados();
  } else if (metasTab && metasTab.classList.contains("active")) {
    renderMetasConfigurationGrid();
  } else if (frascosTab && frascosTab.classList.contains("active")) {
    renderFrascosDistribution();
  } else if (configTab && configTab.classList.contains("active")) {
    renderCampaignConfigScreen();
  }
}

// Helper to map cut date to month and week number in template
function mapDateToMonthAndWeek(fechaStr) {
  const d = new Date(fechaStr + "T12:00:00");
  const monthNames = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
  const monthName = monthNames[d.getMonth()];
  
  const year = d.getFullYear();
  const month = d.getMonth();
  const fridays = [];
  const temp = new Date(year, month, 1, 12, 0, 0);
  while (temp.getMonth() === month) {
    if (temp.getDay() === 5) {
      fridays.push(temp.getDate());
    }
    temp.setDate(temp.getDate() + 1);
  }
  
  const day = d.getDate();
  const weekIndex = fridays.indexOf(day);
  
  return {
    month: monthName,
    weekNumInMonth: weekIndex >= 0 ? weekIndex + 1 : 1
  };
}

async function exportUnitReportExcel(report, fecha) {
  try {
    showToast("Generando reporte de Excel...", true, "info");
    
    const response = await fetch("./Análisis_Meta_Logro_Influenza_2025-2026_UNIDAD_DE_SALUD.xlsx");
    if (!response.ok) throw new Error("No se pudo cargar la plantilla de Excel.");
    const arrayBuffer = await response.arrayBuffer();
    
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer);
    
    const unitMetaRecord = _adminMetasArray.find(m => m.clues === report.clues);
    const sheetMeta = wb.getWorksheet('ANÁLIS DE META-LOGRO') || wb.worksheets[1];
    
    if (sheetMeta) {
      sheetMeta.getCell('A5').value = `Meta-Logro de Vacuna Anti Influenza Estacional Temporada Invernal 2025-2026 - ${report.unidad} (${report.clues})`;
      
      INFLUENZA_RUBROS.forEach((rb, idx) => {
        // Meta
        const metaVal = unitMetaRecord ? (unitMetaRecord.metas[rb.id] || 0) : 0;
        sheetMeta.getCell(9 + idx, 8).value = Number(metaVal);
        
        // Logro (Suma de acumulado histórico de la unidad hasta la fecha seleccionada)
        let totalLogro = 0;
        _adminCapturasArray.forEach(c => {
          if (c.clues === report.clues && c.fecha <= report.fecha) {
            totalLogro += Number(c.valores[rb.id] || 0);
          }
        });
        sheetMeta.getCell(9 + idx, 7).value = totalLogro;
      });
      
      // Cambiar fórmula del total general G55 a suma local ya que no hay hojas mensuales
      sheetMeta.getCell('G55').value = { formula: 'SUM(G9:G54)' };
    }
    
    // Eliminar hojas que no correspondan
    const sheetsToRemove = ['INSTRUCTIVO', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL'];
    sheetsToRemove.forEach(name => {
      const sh = wb.getWorksheet(name);
      if (sh) wb.removeWorksheet(sh.id);
    });
    
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Análisis_Meta_Logro_Influenza_2025-2026_${report.unidad.replace(/ /g, "_")}_${fecha}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Reporte Excel descargado exitosamente.", true, "good");
  } catch (err) {
    console.error("Error al exportar reporte Excel:", err);
    showToast("Error al generar el archivo Excel.", false, "bad");
  }
}

async function exportMunicipalConcentradoExcel(muni, fecha) {
  try {
    showToast("Generando concentrado municipal de Excel...", true, "info");
    
    const response = await fetch("./Análisis_Meta_Logro_Influenza_2025-2026_UNIDAD_DE_SALUD.xlsx");
    if (!response.ok) throw new Error("No se pudo cargar la plantilla de Excel.");
    const arrayBuffer = await response.arrayBuffer();
    
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer);
    
    const units = _allUnidades.filter(u => u.municipio.toUpperCase() === muni.toUpperCase());
    
    const sheetMeta = wb.getWorksheet('ANÁLIS DE META-LOGRO') || wb.worksheets[1];
    if (sheetMeta) {
      sheetMeta.getCell('A5').value = `Meta-Logro de Vacuna Anti Influenza Estacional Temporada Invernal 2025-2026 - Concentrado Municipal: ${muni}`;
      
      INFLUENZA_RUBROS.forEach((rb, idx) => {
        // Meta del municipio (suma de las de cada unidad)
        let totalMeta = 0;
        units.forEach(u => {
          const unitMetaRecord = _adminMetasArray.find(m => m.clues === u.clues);
          totalMeta += unitMetaRecord ? Number(unitMetaRecord.metas[rb.id] || 0) : 0;
        });
        sheetMeta.getCell(9 + idx, 8).value = totalMeta;
        
        // Logro municipal acumulado hasta la fecha seleccionada
        let totalLogro = 0;
        _adminCapturasArray.forEach(c => {
          if (c.municipio.toUpperCase() === muni.toUpperCase() && c.fecha <= fecha) {
            totalLogro += Number(c.valores[rb.id] || 0);
          }
        });
        sheetMeta.getCell(9 + idx, 7).value = totalLogro;
      });
      
      sheetMeta.getCell('G55').value = { formula: 'SUM(G9:G54)' };
    }
    
    const ws = wb.addWorksheet('CONCENTRADO MUNICIPAL', { views: [{ showGridLines: true }] });
    // Mover la hoja recién agregada al inicio (índice 0)
    const sheets = wb.worksheets;
    const addedSheet = sheets.pop();
    sheets.unshift(addedSheet);
    
    ws.getColumn(1).width = 4;
    ws.getColumn(2).width = 6;
    ws.getColumn(3).width = 35;
    ws.getColumn(4).width = 18;
    ws.getColumn(5).width = 15;
    ws.getColumn(6).width = 18;
    ws.getColumn(7).width = 15;
    
    ws.getCell('B2').value = "ANÁLISIS DE META-LOGRO DE INFLUENZA";
    ws.getCell('B2').font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF2E1065' } };
    
    ws.getCell('B3').value = `Concentrado Municipal - ${muni} | Campaña: 2025-2026 | Semana Epidemiológica: ${fecha}`;
    ws.getCell('B3').font = { name: 'Arial', size: 11, italic: true, color: { argb: 'FF64748B' } };
    
    const headers = ["#", "UNIDAD DE SALUD", "CLUES", "META ANUAL", "LOGRO ACUMULADO", "% AVANCE"];
    const headerRowIdx = 5;
    
    headers.forEach((h, i) => {
      const cell = ws.getCell(headerRowIdx, 2 + i);
      cell.value = h;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4C1D95' }
      };
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: i === 1 ? 'left' : 'center' };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF2E1065' } },
        bottom: { style: 'medium', color: { argb: 'FF2E1065' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };
    });
    ws.getRow(headerRowIdx).height = 25;
    
    let rowIdx = 6;
    units.forEach((u, index) => {
      const unitMetaRecord = _adminMetasArray.find(m => m.clues === u.clues);
      let totalMeta = 0;
      if (unitMetaRecord) {
        Object.values(unitMetaRecord.metas).forEach(v => totalMeta += Number(v || 0));
      }
      
      let totalLogro = 0;
      _adminCapturasArray.forEach(c => {
        if (c.clues === u.clues && c.fecha <= fecha) {
          Object.values(c.valores).forEach(v => totalLogro += Number(v || 0));
        }
      });
      
      ws.getCell(rowIdx, 2).value = index + 1;
      ws.getCell(rowIdx, 3).value = u.unidad;
      ws.getCell(rowIdx, 4).value = u.clues;
      ws.getCell(rowIdx, 5).value = totalMeta;
      ws.getCell(rowIdx, 6).value = totalLogro;
      
      const cellPercent = ws.getCell(rowIdx, 7);
      cellPercent.value = { formula: `IFERROR(F${rowIdx}/E${rowIdx}, 0)` };
      cellPercent.numFmt = '0.0%';
      
      ws.getCell(rowIdx, 5).numFmt = '#,##0';
      ws.getCell(rowIdx, 6).numFmt = '#,##0';
      
      const borderThin = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };
      
      for (let i = 0; i < 6; i++) {
        const cell = ws.getCell(rowIdx, 2 + i);
        cell.font = { name: 'Arial', size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: i === 1 ? 'left' : 'center' };
        cell.border = borderThin;
      }
      
      const pct = totalMeta > 0 ? (totalLogro / totalMeta) : 0;
      let bg = 'FFFFF2F2';
      let fg = 'FF991B1B';
      
      if (pct >= 0.95) {
        bg = 'FFE6FBF0';
        fg = 'FF047857';
      } else if (pct >= 0.80) {
        bg = 'FFFFFDF0';
        fg = 'FFB45309';
      }
      
      cellPercent.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bg }
      };
      cellPercent.font = { name: 'Arial', size: 10, bold: true, color: { argb: fg } };
      
      rowIdx++;
    });
    
    ws.getCell(rowIdx, 2).value = "";
    ws.getCell(rowIdx, 3).value = "TOTAL MUNICIPAL";
    ws.getCell(rowIdx, 3).font = { name: 'Arial', size: 10, bold: true };
    ws.getCell(rowIdx, 4).value = "";
    
    ws.getCell(rowIdx, 5).value = { formula: `SUM(E6:E${rowIdx-1})` };
    ws.getCell(rowIdx, 5).numFmt = '#,##0';
    ws.getCell(rowIdx, 5).font = { name: 'Arial', size: 10, bold: true };
    
    ws.getCell(rowIdx, 6).value = { formula: `SUM(F6:F${rowIdx-1})` };
    ws.getCell(rowIdx, 6).numFmt = '#,##0';
    ws.getCell(rowIdx, 6).font = { name: 'Arial', size: 10, bold: true };
    
    const cellTotalPercent = ws.getCell(rowIdx, 7);
    cellTotalPercent.value = { formula: `IFERROR(F${rowIdx}/E${rowIdx}, 0)` };
    cellTotalPercent.numFmt = '0.0%';
    cellTotalPercent.font = { name: 'Arial', size: 10, bold: true };
    
    const borderDouble = {
      top: { style: 'thin', color: { argb: 'FF2E1065' } },
      bottom: { style: 'double', color: { argb: 'FF2E1065' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
    
    for (let i = 0; i < 6; i++) {
      const cell = ws.getCell(rowIdx, 2 + i);
      cell.border = borderDouble;
      cell.alignment = { vertical: 'middle', horizontal: i === 1 ? 'left' : 'center' };
    }
    
    // Eliminar hojas del mensual que no se necesitan
    const sheetsToRemove = ['INSTRUCTIVO', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL'];
    sheetsToRemove.forEach(name => {
      const sh = wb.getWorksheet(name);
      if (sh) wb.removeWorksheet(sh.id);
    });
    
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Concentrado_Influenza_${muni.replace(/ /g, "_")}_${fecha}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Concentrado municipal descargado exitosamente.", true, "good");
  } catch (err) {
    console.error("Error al exportar concentrado Excel:", err);
    showToast("Error al generar el archivo Excel.", false, "bad");
  }
}

// 1. AVANCES Y CONCENTRADOS ADMIN/MUNI
let _currentEditingReport = null;

function renderAvancesAndConcentrados() {
  const cluesSelect = document.getElementById("adminInfluenzaClues");
  if (!cluesSelect) return;

  const clues = cluesSelect.value;
  const fecha = document.getElementById("adminInfluenzaSemana").value;
  const muni = document.getElementById("adminInfluenzaMuni").value;

  const container = document.getElementById("adminInfluenzaReportContainer");
  const muniFrascosBox = document.getElementById("muniFrascosAnalisisBox");
  const muniTableContainer = document.getElementById("adminInfluenzaMunicipalTableContainer");
  const muniTbody = document.getElementById("adminInfluenzaMunicipalTbody");

  // Limpiar listener de exportar concentrado para evitar duplicación
  const exportBtn = document.getElementById("btnExportInfluenzaConcentrado");
  if (exportBtn) {
    exportBtn.onclick = null;
  }

  if (clues === "CONCENTRADO_MUNICIPAL") {
    if (container) container.style.setProperty("display", "none", "important");
    if (muniFrascosBox) muniFrascosBox.style.setProperty("display", "block", "important");
    if (muniTableContainer) muniTableContainer.style.setProperty("display", "flex", "important");

    // Obtener unidades del municipio
    const units = _allUnidades.filter(u => u.municipio.toUpperCase() === muni.toUpperCase());
    
    // Sumar dosis aplicadas en el municipio de todos los reportes capturados para la semana seleccionada
    const municipalReportsForWeek = _adminCapturasArray.filter(r => r.fecha === fecha && r.municipio.toUpperCase() === muni.toUpperCase());
    let totalDosesWeek = 0;
    municipalReportsForWeek.forEach(r => {
      Object.values(r.valores).forEach(v => totalDosesWeek += Number(v || 0));
    });

    // Calcular frascos entregados en el municipio
    let totalFrascosEntregados = 0;
    _adminFrascosArray.forEach(d => {
      if (d.municipio.toUpperCase() === muni.toUpperCase()) {
        totalFrascosEntregados += Number(d.cantidad_frascos || 0);
      }
    });

    const frascosAplicadosWeek = totalDosesWeek / 10;
    const dif = totalFrascosEntregados - frascosAplicadosWeek;

    muniFrascosBox.innerHTML = `
      <div class="text-sm font-extrabold text-violet-900 mb-2">Resumen Municipal: ${muni} (${fecha})</div>
      <div>Dosis aplicadas en esta semana en el municipio: <b>${totalDosesWeek.toLocaleString('es-MX')} dosis</b> (${frascosAplicadosWeek} frascos).</div>
      <div>Total de frascos entregados acumulado: <b>${totalFrascosEntregados} frascos</b> (${totalFrascosEntregados * 10} dosis).</div>
      <div class="mt-1">Diferencia (Frascos estimados en resguardo en el municipio): <b>${dif} frascos</b>.</div>
    `;

    // Renderizar desglose de unidades
    muniTbody.innerHTML = "";
    const csvData = [
      ["Unidad", "CLUES", "Meta Anual (Dosis)", "Acumulado Aplicado", "Meta Logro %", "Frascos Entregados", "Equivalente Dosis"]
    ];

    units.forEach(u => {
      // Sumar metas de la unidad
      const unitMetaRecord = _adminMetasArray.find(m => m.clues === u.clues);
      let totalMeta = 0;
      if (unitMetaRecord && unitMetaRecord.metas) {
        Object.values(unitMetaRecord.metas).forEach(v => totalMeta += Number(v || 0));
      }

      // Sumar capturas acumuladas de la unidad hasta la fecha seleccionada
      let totalAcumulado = 0;
      _adminCapturasArray.forEach(c => {
        if (c.clues === u.clues && c.fecha <= fecha) {
          Object.values(c.valores).forEach(v => totalAcumulado += Number(v || 0));
        }
      });

      // Calcular %
      const pct = totalMeta > 0 ? ((totalAcumulado / totalMeta) * 100).toFixed(1) : "0.0";

      // Sumar frascos entregados
      let unitFrascos = 0;
      _adminFrascosArray.forEach(d => {
        if (d.clues === u.clues) {
          unitFrascos += Number(d.cantidad_frascos || 0);
        }
      });
      const unitDosisEquiv = unitFrascos * 10;

      const row = document.createElement("tr");
      row.className = "border-b border-slate-100 hover:bg-slate-50";
      row.innerHTML = `
        <td class="p-3 text-xs font-semibold text-slate-700">${u.unidad}</td>
        <td class="p-3 text-xs text-slate-500 font-mono">${u.clues}</td>
        <td class="p-3 text-center text-xs font-bold text-slate-600">${totalMeta.toLocaleString('es-MX')}</td>
        <td class="p-3 text-center text-xs font-bold text-violet-950">${totalAcumulado.toLocaleString('es-MX')}</td>
        <td class="p-3 text-center text-xs font-bold ${Number(pct) >= 95 ? 'text-emerald-600' : 'text-slate-600'}">${pct}%</td>
        <td class="p-3 text-center text-xs font-bold text-slate-700">${unitFrascos}</td>
        <td class="p-3 text-center text-xs font-bold text-slate-500">${unitDosisEquiv.toLocaleString('es-MX')}</td>
      `;
      muniTbody.appendChild(row);

      csvData.push([u.unidad, u.clues, totalMeta, totalAcumulado, `${pct}%`, unitFrascos, unitDosisEquiv]);
    });

    // Vincular botón de descarga Excel para concentrado municipal
    if (exportBtn) {
      exportBtn.onclick = () => {
        exportMunicipalConcentradoExcel(muni, fecha);
      };
    }

  } else {
    if (muniFrascosBox) muniFrascosBox.style.setProperty("display", "none", "important");
    if (muniTableContainer) muniTableContainer.style.setProperty("display", "none", "important");
    if (container) container.style.setProperty("display", "flex", "important");

    // Mostrar el reporte de la unidad para la semana seleccionada
    const report = _adminCapturasArray.find(r => r.clues === clues && r.fecha === fecha);
    _currentEditingReport = report;

    const titleEl = document.getElementById("adminInfluenzaReportTitle");
    const subtitleEl = document.getElementById("adminInfluenzaReportSubtitle");
    const badgeEl = document.getElementById("adminInfluenzaEditBadge");

    if (report) {
      titleEl.textContent = `Reporte de ${report.unidad}`;
      subtitleEl.textContent = `Semana: ${report.fecha} | Reportado por: ${report.capturado_por}`;
      if (report.editado_por === "MUNICIPAL") {
        badgeEl.classList.remove("hidden");
      } else {
        badgeEl.classList.add("hidden");
      }

      // Renderizar valores
      renderReportTableValues(report);

      // Vincular botón de descarga Excel para reporte de unidad
      if (exportBtn) {
        exportBtn.onclick = () => {
          exportUnitReportExcel(report, fecha);
        };
      }
    } else {
      titleEl.textContent = `Sin reporte registrado`;
      subtitleEl.textContent = `No se ha capturado reporte para la semana ${fecha}`;
      badgeEl.classList.add("hidden");
      
      const tbody = document.getElementById("adminInfluenzaReportTbody");
      tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400 font-bold">La unidad no cuenta con reporte en esta semana.</td></tr>`;
    }
  }
}

function renderReportTableValues(report) {
  const tbody = document.getElementById("adminInfluenzaReportTbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  // Obtener metas de la unidad
  const unitMeta = _adminMetasArray.find(r => r.clues === report.clues);
  const metas = unitMeta ? unitMeta.metas : {};

  // Calcular acumulado
  const acumuladosPrevios = {};
  INFLUENZA_RUBROS.forEach(rb => {
    acumuladosPrevios[rb.id] = 0;
    _adminCapturasArray.forEach(r => {
      if (r.clues === report.clues && r.fecha !== report.fecha) {
        acumuladosPrevios[rb.id] += Number(r.valores[rb.id] || 0);
      }
    });
  });

  const isMunicipal = USER.rol === "MUNICIPAL" || USER.rol === "ADMIN";

  INFLUENZA_RUBROS.forEach(rb => {
    const meta = Number(metas[rb.id] || 0);
    const acum = acumuladosPrevios[rb.id];
    const val = report.valores[rb.id] || 0;
    const isLocked = meta === 0;

    const total = acum + val;
    const pct = meta > 0 ? Math.round((total / meta) * 100) : 0;
    let badgeClass = "bg-slate-100 text-slate-700";
    if (meta > 0) {
      if (pct >= 85) badgeClass = "bg-emerald-100 text-emerald-800";
      else if (pct >= 50) badgeClass = "bg-amber-100 text-amber-800";
      else badgeClass = "bg-rose-100 text-rose-800";
    }

    const row = document.createElement("tr");
    row.className = "border-b border-slate-100 hover:bg-slate-50 transition-colors";
    row.innerHTML = `
      <td class="p-3 text-xs font-semibold text-slate-700">${rb.categoria} - ${rb.grupo}</td>
      <td class="p-3 text-xs text-slate-600">${rb.edad}</td>
      <td class="p-3 text-center text-xs font-bold">${meta}</td>
      <td class="p-3 text-center text-xs text-slate-500">${acum}</td>
      <td class="p-3 text-center">
        <input type="number" min="0" step="1" 
          id="admin_input_inf_${rb.id}"
          class="w-16 text-center font-bold text-xs bg-slate-50 border border-slate-300 rounded-lg p-1 outline-none"
          value="${val}" 
          ${isLocked || !isMunicipal ? 'disabled style="background-color:#f1f5f9; cursor:not-allowed;"' : ''}
        >
      </td>
      <td class="p-3 text-center">
        <span class="px-2 py-1 rounded-full text-[10px] font-bold ${badgeClass}">${meta > 0 ? `${pct}%` : 'N/A'}</span>
      </td>
    `;
    tbody.appendChild(row);
  });

  // Evento cancelar y guardar edición
  document.getElementById("btnCancelAdminInfluenzaEdit").onclick = () => {
    renderAvancesAndConcentrados();
  };

  document.getElementById("btnSaveAdminInfluenzaEdit").onclick = async () => {
    await saveAdminInfluenzaCorrections();
  };
}

async function saveAdminInfluenzaCorrections() {
  if (!_currentEditingReport) return;

  const valores = {};
  let hasOverMetaError = false;

  const unitMeta = _adminMetasArray.find(r => r.clues === _currentEditingReport.clues);
  const metas = unitMeta ? unitMeta.metas : {};

  // Calcular acumulado
  const acumuladosPrevios = {};
  INFLUENZA_RUBROS.forEach(rb => {
    acumuladosPrevios[rb.id] = 0;
    _adminCapturasArray.forEach(r => {
      if (r.clues === _currentEditingReport.clues && r.fecha !== _currentEditingReport.fecha) {
        acumuladosPrevios[rb.id] += Number(r.valores[rb.id] || 0);
      }
    });
  });

  for (const rb of INFLUENZA_RUBROS) {
    const input = document.getElementById(`admin_input_inf_${rb.id}`);
    const val = input ? parseInt(input.value) || 0 : 0;
    valores[rb.id] = val;

    const meta = Number(metas[rb.id] || 0);
    const acum = acumuladosPrevios[rb.id];
    if (meta > 0 && (acum + val) > meta) {
      hasOverMetaError = true;
    }
  }

  if (hasOverMetaError) {
    showToast("No se puede guardar. Uno o más rubros superan la meta de la unidad.", false, "bad");
    return;
  }

  const payload = {
    clues: _currentEditingReport.clues,
    unidad: _currentEditingReport.unidad,
    municipio: _currentEditingReport.municipio,
    fecha: _currentEditingReport.fecha,
    valores,
    editado_por: "MUNICIPAL"
  };

  await AppService.runCapture({
    btnId: "btnSaveAdminInfluenzaEdit",
    title: "Guardando correcciones",
    msg: "Registrando modificaciones del supervisor municipal...",
    successMsg: "Reporte corregido correctamente",
    eventTitle: "Influenza",
    eventMsg: "Modificación de reporte semanal por nivel municipal",
    action: async () => {
      const res = await AppService.call("saveinfluenza_captura", payload);
      await loadInfluenzaAdminData();
      renderAvancesAndConcentrados();
      return res;
    }
  });
}


// 2. CONFIGURACIÓN DE METAS (ADMIN / MUNICIPAL)

function renderMetasConfigurationGrid() {
  const isMuni = USER.rol === "MUNICIPAL";
  const selectMuni = document.getElementById("adminInfluenzaMuni").value;
  const hints = document.getElementById("secInfluenzaMetasHint");
  const thead = document.getElementById("influenzaMetasThead");
  const tbody = document.getElementById("influenzaMetasTbody");

  tbody.innerHTML = "";

  // Sincronizar el indicador de las subpestañas
  if (typeof syncTabGroupIndicator === 'function') {
    syncTabGroupIndicator('#influenzaAdminTabsContainer');
  }

  if (!isMuni) {
    // Modo ADMIN: Configura metas de los 4 municipios
    hints.textContent = "Modo Administrador: Configura las metas anuales para los 4 municipios. El total jurisdiccional se calcula automáticamente.";
    
    thead.innerHTML = `
      <tr class="bg-slate-50 border-b border-slate-200">
        <th class="p-3 text-xs font-black text-slate-500 uppercase text-left" style="width: 280px; min-width: 280px; max-width: 280px;">Grupo</th>
        <th class="p-3 text-xs font-black text-slate-500 uppercase text-left" style="width: 150px; min-width: 150px; max-width: 150px;">Subgrupo / Edad</th>
        <th class="p-3 text-center text-xs font-black text-slate-500 uppercase" style="width: 11%;">Querétaro</th>
        <th class="p-3 text-center text-xs font-black text-slate-500 uppercase" style="width: 11%;">Corregidora</th>
        <th class="p-3 text-center text-xs font-black text-slate-500 uppercase" style="width: 11%;">El Marqués</th>
        <th class="p-3 text-center text-xs font-black text-slate-500 uppercase" style="width: 11%;">Huimilpan</th>
        <th class="p-3 text-center text-xs font-black text-slate-500 uppercase font-bold" style="width: 11%;">Total Jurisd.</th>
      </tr>
    `;

    INFLUENZA_RUBROS.forEach(rb => {
      const metas = {
        "QUERETARO": 0,
        "CORREGIDORA": 0,
        "EL MARQUES": 0,
        "HUIMILPAN": 0
      };

      _adminMetasArray.forEach(m => {
        if (!m.clues) {
          const name = m.municipio.toUpperCase();
          if (metas[name] !== undefined) {
            metas[name] = m.metas[rb.id] || 0;
          }
        }
      });

      const totalJ = Number(metas["QUERETARO"] || 0) + Number(metas["CORREGIDORA"] || 0) + Number(metas["EL MARQUES"] || 0) + Number(metas["HUIMILPAN"] || 0);

      const row = document.createElement("tr");
      row.className = "border-b border-slate-100 hover:bg-slate-50";
      row.innerHTML = `
        <td class="p-3 align-middle"><div style="width: 280px; min-width: 280px; max-width: 280px; word-break: break-word; white-space: normal; line-height: 1.25; font-size: 12px; font-weight: 600; color: #334155;">${rb.categoria} - ${rb.grupo}</div></td>
        <td class="p-3 align-middle"><div style="width: 150px; min-width: 150px; max-width: 150px; word-break: break-word; white-space: normal; line-height: 1.25; font-size: 12px; color: #475569;">${rb.edad}</div></td>
        <td class="p-3 text-center"><input type="number" min="0" class="meta-input w-20 text-center font-bold bg-slate-50 border border-slate-300 rounded-xl px-2 py-1 focus:border-violet-500 outline-none" data-rb="${rb.id}" data-muni="QUERETARO" value="${metas["QUERETARO"]}"></td>
        <td class="p-3 text-center"><input type="number" min="0" class="meta-input w-20 text-center font-bold bg-slate-50 border border-slate-300 rounded-xl px-2 py-1 focus:border-violet-500 outline-none" data-rb="${rb.id}" data-muni="CORREGIDORA" value="${metas["CORREGIDORA"]}"></td>
        <td class="p-3 text-center"><input type="number" min="0" class="meta-input w-20 text-center font-bold bg-slate-50 border border-slate-300 rounded-xl px-2 py-1 focus:border-violet-500 outline-none" data-rb="${rb.id}" data-muni="EL MARQUES" value="${metas["EL MARQUES"]}"></td>
        <td class="p-3 text-center"><input type="number" min="0" class="meta-input w-20 text-center font-bold bg-slate-50 border border-slate-300 rounded-xl px-2 py-1 focus:border-violet-500 outline-none" data-rb="${rb.id}" data-muni="HUIMILPAN" value="${metas["HUIMILPAN"]}"></td>
        <td class="p-3 text-center font-bold text-slate-800 text-xs align-middle" id="total_j_${rb.id}">${totalJ}</td>
      `;
      tbody.appendChild(row);

      row.querySelectorAll("input").forEach(inp => {
        inp.addEventListener("input", () => {
          let sum = 0;
          row.querySelectorAll("input").forEach(i => sum += parseInt(i.value) || 0);
          document.getElementById(`total_j_${rb.id}`).textContent = sum;
        });
      });
    });

  } else {
    // Modo MUNICIPAL: Desglosa metas municipales a nivel CLUES
    hints.textContent = `Modo Municipal (${selectMuni}): Desglosa tu meta municipal asignada entre las unidades (CLUES).`;
    
    // Obtener unidades del municipio
    const muniUnits = _allUnidades.filter(u => u.municipio.toUpperCase() === selectMuni.toUpperCase());
    
    thead.innerHTML = `
      <tr class="bg-slate-50 border-b border-slate-200">
        <th class="p-3 text-xs font-black text-slate-500 uppercase text-left" style="width: 280px; min-width: 280px; max-width: 280px;">Grupo</th>
        <th class="p-3 text-xs font-black text-slate-500 uppercase text-left" style="width: 150px; min-width: 150px; max-width: 150px;">Subgrupo / Edad</th>
        <th class="p-3 text-center text-xs font-black text-slate-500 uppercase font-bold" style="width: 10%;">Meta Muni</th>
        ${muniUnits.map(u => `<th class="p-3 text-center text-[10px] font-black text-slate-500 uppercase truncate" style="max-width: 90px; min-width: 80px;" title="${u.unidad}">${u.unidad.substring(0, 12)}...</th>`).join("")}
        <th class="p-3 text-center text-xs font-black text-slate-500 uppercase font-bold" style="width: 10%;">Por Asignar</th>
      </tr>
    `;

    INFLUENZA_RUBROS.forEach(rb => {
      // Meta asignada al municipio
      const muniMetaRec = _adminMetasArray.find(m => !m.clues && m.municipio.toUpperCase() === selectMuni.toUpperCase());
      const muniMeta = muniMetaRec ? (muniMetaRec.metas[rb.id] || 0) : 0;

      // Metas ya asignadas a las CLUES
      const cluesMetas = {};
      muniUnits.forEach(u => {
        const rec = _adminMetasArray.find(m => m.clues === u.clues);
        cluesMetas[u.clues] = rec ? (rec.metas[rb.id] || 0) : 0;
      });

      const totalAsignado = Object.values(cluesMetas).reduce((a, b) => a + b, 0);
      const restante = muniMeta - totalAsignado;

      const row = document.createElement("tr");
      row.className = "border-b border-slate-100 hover:bg-slate-50";
      
      let inputsHtml = "";
      muniUnits.forEach(u => {
        inputsHtml += `<td class="p-2 text-center"><input type="number" min="0" class="clues-meta-input w-16 text-center font-bold bg-slate-50 border border-slate-300 rounded-xl px-1 py-1 focus:border-violet-500 outline-none" data-rb="${rb.id}" data-clues="${u.clues}" value="${cluesMetas[u.clues]}"></td>`;
      });

      row.innerHTML = `
        <td class="p-3 align-middle"><div style="width: 280px; min-width: 280px; max-width: 280px; word-break: break-word; white-space: normal; line-height: 1.25; font-size: 12px; font-weight: 600; color: #334155;">${rb.categoria} - ${rb.grupo}</div></td>
        <td class="p-3 align-middle"><div style="width: 150px; min-width: 150px; max-width: 150px; word-break: break-word; white-space: normal; line-height: 1.25; font-size: 12px; color: #475569;">${rb.edad}</div></td>
        <td class="p-3 text-center font-bold text-violet-900 text-xs align-middle" id="muni_meta_${rb.id}">${muniMeta}</td>
        ${inputsHtml}
        <td class="p-3 text-center font-bold text-xs align-middle" id="restante_${rb.id}" style="color: ${restante < 0 ? '#ef4444' : '#64748b'}">${restante}</td>
      `;
      tbody.appendChild(row);

      row.querySelectorAll(".clues-meta-input").forEach(inp => {
        inp.addEventListener("input", () => {
          let sum = 0;
          row.querySelectorAll(".clues-meta-input").forEach(i => sum += parseInt(i.value) || 0);
          const rest = muniMeta - sum;
          const cell = document.getElementById(`restante_${rb.id}`);
          cell.textContent = rest;
          cell.style.color = rest < 0 ? "#ef4444" : "#64748b";
        });
      });
    });
  }

  // Enlazar guardado
  document.getElementById("btnSaveInfluenzaMetas").onclick = async () => {
    await saveInfluenzaMetasConfig();
  };
}

async function saveInfluenzaMetasConfig() {
  const isMuni = USER.rol === "MUNICIPAL";
  const selectMuni = document.getElementById("adminInfluenzaMuni").value;
  const campana = document.getElementById("metaCampaignSelect").value;

  const rows = [];

  if (!isMuni) {
    // Guardar para los 4 municipios
    const munis = ["QUERETARO", "CORREGIDORA", "EL MARQUES", "HUIMILPAN"];
    munis.forEach(m => {
      const metasObj = {};
      INFLUENZA_RUBROS.forEach(rb => {
        const input = document.querySelector(`input[data-rb="${rb.id}"][data-muni="${m}"]`);
        metasObj[rb.id] = input ? (parseInt(input.value) || 0) : 0;
      });

      rows.push({
        anio_campana: campana,
        municipio: m,
        clues: null,
        metas: metasObj,
        modificado_por: USER.usuario
      });
    });
  } else {
    // Guardar desglose de las CLUES del municipio
    const muniUnits = _allUnidades.filter(u => u.municipio.toUpperCase() === selectMuni.toUpperCase());
    
    // Validación previa: Que ningún rubro tenga restante negativo
    let hasValidationError = false;
    INFLUENZA_RUBROS.forEach(rb => {
      const muniMetaRec = _adminMetasArray.find(m => !m.clues && m.municipio.toUpperCase() === selectMuni.toUpperCase());
      const muniMeta = muniMetaRec ? (muniMetaRec.metas[rb.id] || 0) : 0;

      let sum = 0;
      muniUnits.forEach(u => {
        const input = document.querySelector(`input[data-rb="${rb.id}"][data-clues="${u.clues}"]`);
        sum += input ? (parseInt(input.value) || 0) : 0;
      });

      if (sum > muniMeta) {
        hasValidationError = true;
      }
    });

    if (hasValidationError) {
      showToast("Error de validación. La suma asignada a las unidades supera la meta municipal en uno o más rubros.", false, "bad");
      return;
    }

    muniUnits.forEach(u => {
      const metasObj = {};
      INFLUENZA_RUBROS.forEach(rb => {
        const input = document.querySelector(`input[data-rb="${rb.id}"][data-clues="${u.clues}"]`);
        metasObj[rb.id] = input ? (parseInt(input.value) || 0) : 0;
      });

      rows.push({
        anio_campana: campana,
        municipio: selectMuni,
        clues: u.clues,
        metas: metasObj,
        modificado_por: USER.usuario
      });
    });
  }

  await AppService.runCapture({
    btnId: "btnSaveInfluenzaMetas",
    title: "Guardando metas",
    msg: "Registrando metas de Influenza en la base de datos...",
    successMsg: "Configuración de metas guardada correctamente",
    eventTitle: "Influenza",
    eventMsg: "Actualización de catálogo de metas anuales",
    action: async () => {
      const res = await AppService.call("saveinfluenza_metas", { rows });
      await loadInfluenzaAdminData();
      renderMetasConfigurationGrid();
      return res;
    }
  });
}


// 3. CONTROL DE FRASCOS (MUNICIPAL / ADMIN)

function updateFlaskCalculationMuni() {
  const selectMuni = document.getElementById("adminInfluenzaMuni")?.value;
  if (!selectMuni) return;

  // 1. Dosis aplicadas en todo el municipio (acumuladas + reporte actual de todas las unidades)
  let totalDosis = 0;
  
  // Sumamos todos los reportes capturados para este municipio
  _adminCapturasArray.forEach(r => {
    if (r.municipio.toUpperCase() === selectMuni.toUpperCase()) {
      INFLUENZA_RUBROS.forEach(rb => {
        totalDosis += Number(r.valores[rb.id] || 0);
      });
    }
  });

  const frascosAplicados = totalDosis / 10;

  // 2. Frascos entregados en el municipio
  let totalFrascosEntregados = 0;
  _adminFrascosArray.forEach(d => {
    if (d.municipio.toUpperCase() === selectMuni.toUpperCase()) {
      totalFrascosEntregados += Number(d.cantidad_frascos || 0);
    }
  });

  const dif = totalFrascosEntregados - frascosAplicados;

  const entregadosEl = document.getElementById("muniFrascosEntregados");
  const reportadosEl = document.getElementById("muniFrascosReportados");
  const diferenciaEl = document.getElementById("muniFrascosDiferencia");
  const warningBox = document.getElementById("muniFrascosWarningBox");

  if (entregadosEl) entregadosEl.textContent = totalFrascosEntregados;
  if (reportadosEl) reportadosEl.textContent = `${frascosAplicados} frascos (${totalDosis} dosis)`;
  if (diferenciaEl) diferenciaEl.textContent = `${dif} frascos`;

  if (warningBox) {
    if (totalFrascosEntregados > 0) {
      warningBox.className = "mb-4 p-4 rounded-xl border-2 block text-xs font-semibold ";
      if (dif < 0) {
        warningBox.classList.add("bg-rose-50", "border-rose-200", "text-rose-950");
        warningBox.innerHTML = `⚠️ <b>Inconsistencia:</b> Se han reportado más dosis aplicadas en el municipio (${totalDosis} dosis = ${frascosAplicados} frascos) que el total de frascos entregados (${totalFrascosEntregados} frascos).`;
      } else if (dif > 0 && dif >= (totalFrascosEntregados * 0.5)) {
        warningBox.classList.add("bg-amber-50", "border-amber-200", "text-amber-950");
        warningBox.innerHTML = `⚠️ <b>Observación:</b> Se han entregado ${totalFrascosEntregados} frascos, pero las unidades solo han reportado aplicar ${totalDosis} dosis (${frascosAplicados} frascos). Hay un resguardo del ${Math.round((dif/totalFrascosEntregados)*100)}% sin aplicar en el municipio.`;
      } else {
        warningBox.classList.add("bg-emerald-50", "border-emerald-200", "text-emerald-950");
        warningBox.innerHTML = `✅ <b>Balance Logístico:</b> Balance correcto. Frascos en resguardo estimado municipal: ${dif} frascos (${dif * 10} dosis).`;
      }
    } else {
      warningBox.className = "hidden";
    }
  }
}

function renderFrascosDistribution() {
  const selectMuni = document.getElementById("adminInfluenzaMuni").value;
  const tbody = document.getElementById("frascosBatchTbody");
  const historyTbody = document.getElementById("frascosEntregaTbody");

  const deliveryForm = document.getElementById("influenzaFrascosDeliveryForm");
  const historyContainer = document.getElementById("influenzaFrascosHistoryContainer");
  const adminMuniTableContainer = document.getElementById("adminFrascosMunicipalTableContainer");

  if (USER.rol === "ADMIN" || USER.rol === "JURISDICCIONAL") {
    // Nivel ADMIN y JURISDICCIONAL: Mostrar resumen municipal consolidado
    if (deliveryForm) deliveryForm.style.setProperty("display", "none", "important");
    if (historyContainer) historyContainer.style.setProperty("display", "none", "important");
    if (adminMuniTableContainer) adminMuniTableContainer.style.setProperty("display", "flex", "important");

    const munis = ["QUERETARO", "CORREGIDORA", "EL MARQUES", "HUIMILPAN"];
    const tbodyMuni = document.getElementById("adminFrascosMunicipalTbody");
    tbodyMuni.innerHTML = "";

    const csvData = [
      ["Municipio", "Frascos Entregados (Total)", "Equivalente en Dosis", "Dosis Aplicadas", "Estimado en Resguardo (Frascos)", "Aprovechamiento %"]
    ];

    munis.forEach(m => {
      // Sumar frascos entregados a este municipio
      let totalFrascos = 0;
      _adminFrascosArray.forEach(d => {
        if (d.municipio.toUpperCase() === m) {
          totalFrascos += Number(d.cantidad_frascos || 0);
        }
      });
      const equivDosis = totalFrascos * 10;

      // Sumar dosis aplicadas en este municipio (en todas las capturas)
      let totalAplicadas = 0;
      _adminCapturasArray.forEach(c => {
        if (c.municipio.toUpperCase() === m) {
          Object.values(c.valores).forEach(v => {
            totalAplicadas += Number(v || 0);
          });
        }
      });

      const resguardo = totalFrascos - (totalAplicadas / 10);
      const pct = equivDosis > 0 ? ((totalAplicadas / equivDosis) * 100).toFixed(1) : "0.0";

      const row = document.createElement("tr");
      row.className = "border-b border-slate-100 hover:bg-slate-50";
      row.innerHTML = `
        <td class="p-3 text-xs font-bold text-slate-700">${m}</td>
        <td class="p-3 text-center text-xs font-bold text-slate-600">${totalFrascos.toLocaleString('es-MX')}</td>
        <td class="p-3 text-center text-xs font-bold text-slate-500">${equivDosis.toLocaleString('es-MX')}</td>
        <td class="p-3 text-center text-xs font-bold text-violet-950">${totalAplicadas.toLocaleString('es-MX')}</td>
        <td class="p-3 text-center text-xs font-bold text-amber-600">${resguardo.toFixed(1)}</td>
        <td class="p-3 text-center text-xs font-bold text-emerald-600">${pct}%</td>
      `;
      tbodyMuni.appendChild(row);

      csvData.push([m, totalFrascos, equivDosis, totalAplicadas, resguardo.toFixed(1), `${pct}%`]);
    });

    const exportBtn = document.getElementById("btnExportFrascosMuni");
    if (exportBtn) {
      exportBtn.onclick = () => {
        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
          + csvData.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Concentrado_Municipal_Frascos_Influenza.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Archivo CSV exportado exitosamente.", true, "good");
      };
    }

  } else {
    // Nivel MUNICIPAL: Mostrar formulario de entrega masiva e historial por unidad
    if (deliveryForm) deliveryForm.style.setProperty("display", "flex", "important");
    if (historyContainer) historyContainer.style.setProperty("display", "flex", "important");
    if (adminMuniTableContainer) adminMuniTableContainer.style.setProperty("display", "none", "important");

    if (!tbody || !historyTbody) return;

    // Poner fecha de hoy por defecto en el input
    document.getElementById("frascoFechaInput").value = new Date().toISOString().split("T")[0];
    if (!document.getElementById("frascoEntregaInput").value) {
      document.getElementById("frascoEntregaInput").value = "1";
    }

    // Obtener unidades del municipio
    const units = _allUnidades.filter(u => u.municipio.toUpperCase() === selectMuni.toUpperCase());
    
    // Renderizar tabla de captura masiva
    tbody.innerHTML = "";
    units.forEach(u => {
      // Calcular acumulado previo
      let totalFrascosEntregadosUnit = 0;
      _adminFrascosArray.forEach(d => {
        if (d.clues === u.clues) {
          totalFrascosEntregadosUnit += Number(d.cantidad_frascos || 0);
        }
      });

      const row = document.createElement("tr");
      row.className = "border-b border-slate-100 hover:bg-slate-50";
      row.innerHTML = `
        <td class="p-3 text-xs font-semibold text-slate-700">${u.unidad} <br><span class="text-[10px] text-slate-400 font-normal">${u.clues}</span></td>
        <td class="p-3 text-center text-xs font-bold text-slate-500">${totalFrascosEntregadosUnit} frascos (${totalFrascosEntregadosUnit * 10} dosis)</td>
        <td class="p-3 text-center">
          <input type="number" min="0" step="1" 
            id="batch_frascos_${u.clues}"
            class="w-20 text-center font-bold text-xs bg-slate-50 border border-slate-300 rounded-xl px-2 py-1 focus:border-violet-500 outline-none mx-auto"
            placeholder="0"
          >
        </td>
      `;
      tbody.appendChild(row);
    });

    // Renderizar tabla de historial de entregas del municipio
    historyTbody.innerHTML = "";
    const deliveries = _adminFrascosArray.filter(d => d.municipio.toUpperCase() === selectMuni.toUpperCase());

    if (!deliveries.length) {
      historyTbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-slate-400 font-bold">No hay entregas registradas para este municipio.</td></tr>`;
    } else {
      deliveries.forEach(d => {
        const unit = _allUnidades.find(u => u.clues === d.clues);
        const unitName = unit ? unit.unidad : d.clues;

        const row = document.createElement("tr");
        row.className = "border-b border-slate-100 hover:bg-slate-50";
        row.innerHTML = `
          <td class="p-3 text-xs font-semibold text-slate-700">${unitName} <br><span class="text-[10px] text-slate-400 font-normal">${d.clues}</span></td>
          <td class="p-3 text-center text-xs">${d.numero_entrega}</td>
          <td class="p-3 text-center text-xs font-mono text-slate-600">${d.lote || '<span class="text-slate-300">-</span>'}</td>
          <td class="p-3 text-center text-xs">${d.fecha_caducidad || '<span class="text-slate-300">-</span>'}</td>
          <td class="p-3 text-center text-xs font-bold text-violet-900">${d.cantidad_frascos}</td>
          <td class="p-3 text-center text-xs font-bold text-slate-600">${d.cantidad_frascos * 10} dosis</td>
          <td class="p-3 text-center text-xs">${d.fecha_entrega}</td>
          <td class="p-3 text-xs text-slate-500">${d.entregado_por}</td>
        `;
        historyTbody.appendChild(row);
      });
    }

    // Enlazar guardado
    document.getElementById("btnSaveFrascoEntrega").onclick = async () => {
      await saveFrascosDelivery();
    };
  }

  // Actualizar cálculo de frascos municipal
  updateFlaskCalculationMuni();
}

async function saveFrascosDelivery() {
  const selectMuni = document.getElementById("adminInfluenzaMuni").value;
  const num = parseInt(document.getElementById("frascoEntregaInput").value) || 0;
  const fecha = document.getElementById("frascoFechaInput").value;
  const lote = document.getElementById("frascoLoteInput").value.trim().toUpperCase();
  const caducidad = document.getElementById("frascoCaducidadInput").value;

  if (num <= 0 || !fecha) {
    showToast("Por favor ingresa un número de entrega y fecha válidos.", false, "bad");
    return;
  }

  // Buscar todos los inputs que tengan valor mayor que 0
  const units = _allUnidades.filter(u => u.municipio.toUpperCase() === selectMuni.toUpperCase());
  const deliveriesToSave = [];

  units.forEach(u => {
    const input = document.getElementById(`batch_frascos_${u.clues}`);
    const cantidad = parseInt(input?.value || 0);
    if (cantidad > 0) {
      deliveriesToSave.push({
        clues: u.clues,
        municipio: selectMuni,
        cantidad_frascos: cantidad,
        fecha_entrega: fecha,
        numero_entrega: num,
        lote: lote || null,
        fecha_caducidad: caducidad || null,
        entregado_por: USER.usuario
      });
    }
  });

  if (deliveriesToSave.length === 0) {
    showToast("Ingresa al menos una cantidad mayor a cero para alguna de las unidades.", false, "bad");
    return;
  }

  await AppService.runCapture({
    btnId: "btnSaveFrascoEntrega",
    title: "Registrando entregas",
    msg: `Registrando ${deliveriesToSave.length} entregas de frascos en lote...`,
    successMsg: "Entregas en lote guardadas correctamente",
    eventTitle: "Influenza",
    eventMsg: "Distribución de frascos registrada en lote",
    action: async () => {
      // Guardar todos los registros
      for (const delivery of deliveriesToSave) {
        await AppService.call("saveinfluenza_distribucion", delivery);
      }

      // Limpiar inputs
      units.forEach(u => {
        const input = document.getElementById(`batch_frascos_${u.clues}`);
        if (input) input.value = "";
      });
      document.getElementById("frascoLoteInput").value = "";
      document.getElementById("frascoCaducidadInput").value = "";

      await loadInfluenzaAdminData();
      renderFrascosDistribution();
      return { ok: true };
    }
  });
}


// --- ═══════════ INDICADORES — EVALUACIÓN META-LOGRO INFLUENZA ═══════════ ---

async function renderInfluenzaIndicatorsDashboard(muniFilter, uniFilter) {
  const container = document.getElementById("rdaDashboardContent");
  if (!container) return;

  // Título e info de cierre
  const scopeEl = document.getElementById("rdaScopeLabel");
  if (scopeEl) {
    if (uniFilter) scopeEl.textContent = `Unidad: ${uniFilter}`;
    else if (muniFilter) scopeEl.textContent = `Municipio: ${muniFilter}`;
    else scopeEl.textContent = "Jurisdicción Sanitaria 1";
  }

  const cierreEl = document.getElementById("rdaCierreLabel");
  if (cierreEl) {
    cierreEl.textContent = `Meta-Logro Influenza | Campaña: 2025-2026`;
  }

  // 1. Obtener la lista de CLUES a evaluar
  let evalCluesList = [];
  if (uniFilter) {
    evalCluesList = [uniFilter];
  } else {
    // Cargar catálogo de unidades
    const { data: allUnits } = await window.supabase.from("unidades").select("clues, municipio, unidad").eq("activo", "SI");
    const filtered = allUnits.filter(u => !muniFilter || u.municipio.toUpperCase() === muniFilter.toUpperCase());
    evalCluesList = filtered.map(u => u.clues);
  }

  // 2. Fetch metas y capturas de la campaña
  const [resMetas, resCapturas] = await Promise.all([
    AppService.call("getinfluenza_metas", { anio_campana: "2025-2026" }),
    AppService.call("getinfluenza_capturas", { anio_campana: "2025-2026" })
  ]);

  const metasData = resMetas.data || [];
  const capturasData = resCapturas.data || [];

  // Calcular agregados
  let totalMetaDosis = 0;
  let totalDosisAplicadas = 0;
  let totalBlancoMeta = 0;
  let totalBlancoAplicadas = 0;
  let totalRiesgoMeta = 0;
  let totalRiesgoAplicadas = 0;

  evalCluesList.forEach(c => {
    const metaRec = metasData.find(m => m.clues === c);
    const metas = metaRec ? metaRec.metas : {};

    // Sumar metas
    INFLUENZA_RUBROS.forEach(rb => {
      const metaVal = Number(metas[rb.id] || 0);
      totalMetaDosis += metaVal;
      if (rb.categoria.includes("blanca")) totalBlancoMeta += metaVal;
      else totalRiesgoMeta += metaVal;
    });

    // Sumar capturas
    const unitCapturas = capturasData.filter(r => r.clues === c);
    unitCapturas.forEach(r => {
      INFLUENZA_RUBROS.forEach(rb => {
        const valVal = Number(r.valores[rb.id] || 0);
        totalDosisAplicadas += valVal;
        if (rb.categoria.includes("blanca")) totalBlancoAplicadas += valVal;
        else totalRiesgoAplicadas += valVal;
      });
    });
  });

  const pctTotal = totalMetaDosis > 0 ? Math.round((totalDosisAplicadas / totalMetaDosis) * 100) : 0;
  const pctBlanco = totalBlancoMeta > 0 ? Math.round((totalBlancoAplicadas / totalBlancoMeta) * 100) : 0;
  const pctRiesgo = totalRiesgoMeta > 0 ? Math.round((totalRiesgoAplicadas / totalRiesgoMeta) * 100) : 0;

  // Inyectar HTML en el contenedor de indicadores
  container.innerHTML = `
    <!-- KPI Cards Grid -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; margin-bottom: 32px;">
      
      <div class="rda-kpi-card">
        <div class="rda-icon-box" style="background: #f0f9ff; color: #0284c7;">
          <span class="material-symbols-rounded">child_care</span>
        </div>
        <div style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;">Población Blanco</div>
        <div style="font-size: 36px; font-weight: 900; color: ${pctBlanco >= 85 ? '#059669' : pctBlanco >= 50 ? '#d97706' : '#dc2626'}; letter-spacing: -0.04em; line-height: 1.1;">${pctBlanco}%</div>
        <div style="font-size: 13px; font-weight: 700; color: #64748b; margin-top: 8px;">${totalBlancoAplicadas.toLocaleString('es-MX')} de ${totalBlancoMeta.toLocaleString('es-MX')} dosis</div>
      </div>

      <div class="rda-kpi-card">
        <div class="rda-icon-box" style="background: #f5f3ff; color: #7c3aed;">
          <span class="material-symbols-rounded">warning</span>
        </div>
        <div style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;">Población de Riesgo</div>
        <div style="font-size: 36px; font-weight: 900; color: ${pctRiesgo >= 85 ? '#059669' : pctRiesgo >= 50 ? '#d97706' : '#dc2626'}; letter-spacing: -0.04em; line-height: 1.1;">${pctRiesgo}%</div>
        <div style="font-size: 13px; font-weight: 700; color: #64748b; margin-top: 8px;">${totalRiesgoAplicadas.toLocaleString('es-MX')} de ${totalRiesgoMeta.toLocaleString('es-MX')} dosis</div>
      </div>

      <div class="rda-kpi-card">
        <div class="rda-icon-box" style="background: #fdf2f8; color: #db2777;">
          <span class="material-symbols-rounded">vaccines</span>
        </div>
        <div style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;">Total Campaña</div>
        <div style="font-size: 36px; font-weight: 900; color: ${pctTotal >= 85 ? '#059669' : pctTotal >= 50 ? '#d97706' : '#dc2626'}; letter-spacing: -0.04em; line-height: 1.1;">${pctTotal}%</div>
        <div style="font-size: 13px; font-weight: 700; color: #64748b; margin-top: 8px;">${totalDosisAplicadas.toLocaleString('es-MX')} de ${totalMetaDosis.toLocaleString('es-MX')} dosis</div>
      </div>

    </div>

    <!-- Tabla Detallada por Rubro -->
    <div class="bg-surface rounded-3xl border border-slate-200 shadow-sm p-6 overflow-hidden">
      <h3 class="text-sm font-extrabold text-slate-700 mb-4 uppercase tracking-wider">Desglose de Meta-Logro por Rubro</h3>
      <div class="tableWrap overflow-x-auto w-full rounded-xl border border-slate-200">
        <table class="w-full border-collapse text-left text-xs font-semibold text-slate-700">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200">
              <th class="p-3 text-xs font-black text-slate-500 uppercase tracking-wider">Grupo</th>
              <th class="p-3 text-xs font-black text-slate-500 uppercase tracking-wider">Subgrupo / Edad</th>
              <th class="p-3 text-xs font-black text-slate-500 uppercase tracking-wider text-center">Meta Total</th>
              <th class="p-3 text-xs font-black text-slate-500 uppercase tracking-wider text-center">Aplicadas</th>
              <th class="p-3 text-xs font-black text-slate-500 uppercase tracking-wider text-center">Avance %</th>
            </tr>
          </thead>
          <tbody>
            ${INFLUENZA_RUBROS.map(rb => {
              // Calcular para cada rubro
              let rMeta = 0;
              let rAplicadas = 0;

              evalCluesList.forEach(c => {
                const metaRec = metasData.find(m => m.clues === c);
                rMeta += metaRec ? Number(metaRec.metas[rb.id] || 0) : 0;

                const unitCapturas = capturasData.filter(r => r.clues === c);
                unitCapturas.forEach(r => {
                  rAplicadas += Number(r.valores[rb.id] || 0);
                });
              });

              const rPct = rMeta > 0 ? Math.round((rAplicadas / rMeta) * 100) : 0;
              let progressColor = "text-slate-700";
              let progressBg = "bg-slate-100";
              if (rMeta > 0) {
                if (rPct >= 85) { progressColor = "text-emerald-800"; progressBg = "bg-emerald-100"; }
                else if (rPct >= 50) { progressColor = "text-amber-800"; progressBg = "bg-amber-100"; }
                else { progressColor = "text-rose-800"; progressBg = "bg-rose-100"; }
              }

              return `
                <tr class="border-b border-slate-100 hover:bg-slate-50">
                  <td class="p-3 font-bold">${rb.categoria} - ${rb.grupo}</td>
                  <td class="p-3 font-medium text-slate-600">${rb.edad}</td>
                  <td class="p-3 text-center font-bold">${rMeta.toLocaleString('es-MX')}</td>
                  <td class="p-3 text-center font-bold text-slate-500">${rAplicadas.toLocaleString('es-MX')}</td>
                  <td class="p-3 text-center">
                    <span class="px-2 py-1 rounded-full text-[10px] font-bold ${progressColor} ${progressBg}">${rMeta > 0 ? `${rPct}%` : 'N/A'}</span>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderCampaignConfigScreen() {
  const startInput = document.getElementById("configFechaInicio");
  const endInput = document.getElementById("configFechaFin");
  const saveBtn = document.getElementById("btnSaveInfluenzaConfig");

  if (!startInput || !endInput || !saveBtn) return;

  // Cargar valores actuales en los inputs
  startInput.value = _campaignConfig.fecha_inicio || "";
  endInput.value = _campaignConfig.fecha_fin || "";

  saveBtn.onclick = async () => {
    const startVal = startInput.value;
    const endVal = endInput.value;

    if (!startVal || !endVal) {
      showToast("Por favor selecciona ambas fechas de inicio y fin.", false, "bad");
      return;
    }

    if (new Date(startVal) >= new Date(endVal)) {
      showToast("La fecha de inicio debe ser anterior a la fecha de fin.", false, "bad");
      return;
    }

    await AppService.runCapture({
      btnId: "btnSaveInfluenzaConfig",
      title: "Guardando configuración",
      msg: "Actualizando fechas oficiales de la campaña de Influenza...",
      successMsg: "Fechas de campaña guardadas correctamente",
      eventTitle: "Influenza",
      eventMsg: "Actualización de fechas oficiales de campaña",
      action: async () => {
        const res = await AppService.call("saveinfluenza_config", {
          fecha_inicio: startVal,
          fecha_fin: endVal
        });

        // Actualizar configuración en memoria y recrear las semanas
        await loadCampaignConfig();
        
        // Repoblar los filtros y vistas
        await populateInfluenzaAdminFilters();
        
        return res;
      }
    });
  };
}
