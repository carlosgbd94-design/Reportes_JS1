/**
 * rda_ui.js — Dashboard Ejecutivo RDA 2026 v4
 */
let _rdaCharts = {};
let _rdaCache = { unidades: null, registros: null };
let _rdaState = { trimestre: 1, modo: 'trimestral', meses: 3, sortCol: null, sortAsc: true };
const MUNI_ORDER = ['CORREGIDORA','HUIMILPAN','EL MARQUES','MARQUÉS','MARQUES','QUERETARO','QUERÉTARO'];

function initRDADashboard() {
    const overlay = document.getElementById('rdaDashboardOverlay');
    const btnOpen = document.getElementById('btnOpenRdaDashboard');
    const btnClose = document.getElementById('btnCloseRda');

    if (btnOpen && overlay) {
        btnOpen.addEventListener('click', () => {
            overlay.style.opacity = '1'; overlay.style.visibility = 'visible';
            document.getElementById('rdaDashboardPanel').style.transform = 'scale(1)';
            document.body.style.overflow = 'hidden';
            _rdaCache = { unidades: null, registros: null };
            loadAndRender();
        });
    }
    if (btnClose && overlay) {
        const closeDash = () => {
            overlay.style.opacity = '0'; overlay.style.visibility = 'hidden';
            document.getElementById('rdaDashboardPanel').style.transform = 'scale(0.97)';
            document.body.style.overflow = '';
            Object.values(_rdaCharts).forEach(c => c?.destroy());
            _rdaCharts = {};
        };
        btnClose.addEventListener('click', closeDash);
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.style.visibility === 'visible') closeDash(); });
    }

    // Time tabs
    document.querySelectorAll('.rda-time-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.rda-time-tab').forEach(t => {
                t.style.background = 'transparent'; t.style.color = 'rgba(255,255,255,0.5)';
            });
            tab.style.background = 'rgba(103,232,249,0.25)'; tab.style.color = '#fff';
            const val = tab.dataset.trimestre;
            const ms = document.getElementById('rdaMonthSelect');
            if (val === 'mensual') {
                _rdaState.modo = 'mensual'; ms.style.display = 'block';
                _rdaState.meses = parseInt(ms.value, 10);
            } else {
                _rdaState.modo = 'trimestral'; ms.style.display = 'none';
                _rdaState.trimestre = parseInt(val, 10);
                _rdaState.meses = _rdaState.trimestre * 3;
            }
            renderDashboard();
        });
    });

    document.getElementById('rdaMonthSelect')?.addEventListener('change', e => {
        _rdaState.meses = parseInt(e.target.value, 10); renderDashboard();
    });
    document.getElementById('rdaFilterMunicipio')?.addEventListener('change', () => {
        populateUnidadFilter(); renderDashboard();
    });
    document.getElementById('rdaFilterUnidad')?.addEventListener('change', () => renderDashboard());

    // Export dropdown
    const expBtn = document.getElementById('btnExportRdaToggle');
    const expDrop = document.getElementById('rdaExportDropdown');
    if (expBtn && expDrop) {
        expBtn.addEventListener('click', () => expDrop.style.display = expDrop.style.display === 'none' ? 'block' : 'none');
        document.addEventListener('click', e => {
            if (!document.getElementById('rdaExportContainer')?.contains(e.target)) expDrop.style.display = 'none';
        });
    }
    document.querySelectorAll('.rda-export-opt').forEach(btn => {
        btn.addEventListener('mouseenter', () => btn.style.background = '#f1f5f9');
        btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');
        btn.addEventListener('click', () => {
            expDrop.style.display = 'none';
            btn.dataset.export === 'individual' ? exportIndividualPDF() : exportMasivoZIP();
        });
    });

    // Table sort
    document.querySelectorAll('#rdaDetailTable th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (_rdaState.sortCol === col) _rdaState.sortAsc = !_rdaState.sortAsc;
            else { _rdaState.sortCol = col; _rdaState.sortAsc = false; }
            renderDashboard();
        });
    });
}

async function loadAndRender() {
    try { await fetchRDAData(); populateFilters(); renderDashboard(); }
    catch (e) { console.error('[RDA]', e); }
}

// ══════════ DATA FETCH (paginated to get ALL rows) ══════════
async function fetchRDAData() {
    if (_rdaCache.unidades && _rdaCache.registros) return _rdaCache;

    // Fetch ALL unidades
    const { data: unidades, error: e1 } = await window.supabase
        .from('unidades_medicas').select('*').limit(5000);
    if (e1) throw e1;

    // Fetch ALL registros (paginated — Supabase default max is 1000)
    let allRegs = [], page = 0, pageSize = 1000, hasMore = true;
    while (hasMore) {
        const { data, error } = await window.supabase
            .from('registros_sis')
            .select('clues, variable_sis, valor, mes, anio')
            .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        if (data && data.length > 0) { allRegs = allRegs.concat(data); page++; }
        if (!data || data.length < pageSize) hasMore = false;
    }

    console.log(`[RDA] Loaded: ${unidades.length} unidades, ${allRegs.length} registros`);
    _rdaCache.unidades = unidades || [];
    _rdaCache.registros = allRegs;
    return _rdaCache;
}

// ══════════ FILTERS ══════════
function populateFilters() {
    const { unidades } = _rdaCache;
    const muniSel = document.getElementById('rdaFilterMunicipio');
    if (!muniSel || !unidades) return;

    let municipios = [...new Set(unidades.map(u => (u.municipio || '').toUpperCase().trim()))].filter(Boolean).sort();

    const role = (typeof USER !== 'undefined' && USER?.rol) || 'UNIDAD';
    if (role === 'MUNICIPAL' || role === 'UNIDAD') {
        const allowed = (typeof USER !== 'undefined' && Array.isArray(USER?.municipiosAllowed)) ? USER.municipiosAllowed : [];
        if (!allowed.includes('*')) {
            const norm = allowed.map(m => m.toUpperCase().trim());
            municipios = municipios.filter(m => norm.some(a => m.includes(a) || a.includes(m)));
        }
    }

    muniSel.innerHTML = '<option value="">Todos los municipios</option>' +
        municipios.map(m => `<option value="${m}">${m}</option>`).join('');
    populateUnidadFilter();
}

function populateUnidadFilter() {
    const muni = document.getElementById('rdaFilterMunicipio')?.value || '';
    const uniSel = document.getElementById('rdaFilterUnidad');
    if (!uniSel) return;
    if (!muni) { uniSel.style.display = 'none'; uniSel.value = ''; return; }

    uniSel.style.display = 'block';
    const units = (_rdaCache.unidades || [])
        .filter(u => (u.municipio || '').toUpperCase().trim() === muni.toUpperCase().trim())
        .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

    uniSel.innerHTML = '<option value="">Todas las unidades</option>' +
        units.map(u => `<option value="${u.clues}">${u.nombre || u.clues}</option>`).join('');
}

// ══════════ RENDER ══════════
function renderDashboard() {
    const { unidades, registros } = _rdaCache;
    if (!unidades || !registros) return;

    const meses = _rdaState.meses;
    const muniFilter = document.getElementById('rdaFilterMunicipio')?.value || '';
    const uniFilter = document.getElementById('rdaFilterUnidad')?.value || '';

    let fUnits = unidades;
    if (muniFilter) fUnits = fUnits.filter(u => (u.municipio || '').toUpperCase().trim() === muniFilter.toUpperCase().trim());
    if (uniFilter) fUnits = fUnits.filter(u => u.clues === uniFilter);

    const fClues = new Set(fUnits.map(u => u.clues));
    const fRegs = registros.filter(r => fClues.has(r.clues));

    // 🔍 DIAGNÓSTICO — ver en consola para detectar problemas de mapeo
    console.log(`[RDA DEBUG] Meses: ${meses} | Unidades filtradas: ${fUnits.length} | Registros total: ${registros.length} | Registros filtrados: ${fRegs.length}`);
    if (registros.length > 0) {
        console.log('[RDA DEBUG] Ejemplo registro:', registros[0]);
        const vars = [...new Set(registros.map(r => r.variable_sis))].sort();
        console.log('[RDA DEBUG] Variables únicas en registros:', vars.join(', '));
        const cluesInRegs = [...new Set(registros.map(r => r.clues))];
        const cluesInUnits = [...new Set(fUnits.map(u => u.clues))];
        const matching = cluesInRegs.filter(c => fClues.has(c));
        console.log(`[RDA DEBUG] CLUES en registros: ${cluesInRegs.length} | CLUES en unidades: ${cluesInUnits.length} | Coinciden: ${matching.length}`);
        if (matching.length === 0 && cluesInRegs.length > 0) {
            console.warn('[RDA DEBUG] ⚠️ NINGUNA CLUES coincide! Ejemplos — Registros:', cluesInRegs.slice(0,3), 'Unidades:', cluesInUnits.slice(0,3));
        }
    } else {
        console.warn('[RDA DEBUG] ⚠️ No hay registros en registros_sis. ¿Ya se subió el CSV?');
    }

    const global = RDA2026Calculator.calcularGlobal(fUnits, fRegs, meses);

    // Scope label
    const scopeEl = document.getElementById('rdaScopeLabel');
    if (scopeEl) {
        if (uniFilter) scopeEl.textContent = fUnits[0]?.nombre || uniFilter;
        else if (muniFilter) scopeEl.textContent = `Municipio: ${muniFilter}`;
        else scopeEl.textContent = 'Jurisdicción Sanitaria 1';
    }

    // KPIs
    setKPI('kpiMenor1', global.coberturas.menor1);
    setKPI('kpi1Ano', global.coberturas.uno);
    setKPI('kpi4Anos', global.coberturas.cuatro);

    const totalPob = global.poblacion.menor1 + global.poblacion.uno + global.poblacion.cuatro;
    const kpiPob = document.getElementById('kpiPoblacion');
    if (kpiPob) kpiPob.textContent = totalPob.toLocaleString('es-MX');
    const kpiUni = document.getElementById('kpiUnidades');
    if (kpiUni) kpiUni.textContent = `${global.totalUnidades} unidades médicas`;

    setDosis('kpiMenor1Dosis', fRegs, [...DICT_RDA.BCG,...DICT_RDA.HepB_0_7,...DICT_RDA.Hexa_3,...DICT_RDA.Rota_2,...DICT_RDA.Neumo_2], meses);
    setDosis('kpi1AnoDosis', fRegs, [...DICT_RDA.Hexa_Ref,...DICT_RDA.Neumo_Ref,...DICT_RDA.SRP_2], meses);
    setDosis('kpi4AnosDosis', fRegs, DICT_RDA.DPT_4, meses);

    renderDoughnut(global.coberturas);
    renderBarChart(fUnits, fRegs, meses, muniFilter);
    renderTable(fUnits, fRegs, meses);
}

function setKPI(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = `${val}%`;
    el.style.color = val >= 80 ? '#059669' : val >= 50 ? '#d97706' : '#dc2626';
}
function setDosis(id, regs, vars, m) {
    const el = document.getElementById(id);
    if (el) el.textContent = `${RDA2026Calculator.sumVariables(regs, vars, m).toLocaleString('es-MX')} dosis`;
}

// ══════════ CHARTS ══════════
function renderDoughnut(cob) {
    const ctx = document.getElementById('chartDoughnut');
    if (!ctx) return;
    if (_rdaCharts.d) _rdaCharts.d.destroy();
    _rdaCharts.d = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['< 1 Año', '1 Año', '4 Años'],
            datasets: [{ data: [cob.menor1, cob.uno, cob.cuatro], backgroundColor: ['#0d9488','#0284c7','#4338ca'], borderWidth: 3, borderColor: '#fff', borderRadius: 4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '65%', animation: false,
            plugins: { legend: { position: 'bottom', labels: { font: { size: 11, weight: 'bold' }, color: '#475569', padding: 12, usePointStyle: true } } }
        }
    });
}

function renderBarChart(units, regs, meses, muniFilter) {
    const ctx = document.getElementById('chartBar');
    if (!ctx) return;
    if (_rdaCharts.b) _rdaCharts.b.destroy();

    const titleEl = document.getElementById('chartBarTitle');
    let labels = [], d1 = [], d2 = [], d3 = [];
    const role = (typeof USER !== 'undefined' && USER?.rol) || 'UNIDAD';

    if (!muniFilter && (role === 'ADMIN' || role === 'JURISDICCIONAL')) {
        if (titleEl) titleEl.textContent = 'Cobertura por Municipio';
        const munis = [...new Set(units.map(u => (u.municipio||'').toUpperCase().trim()))].filter(Boolean).sort();
        for (const m of munis) {
            const r = RDA2026Calculator.calcularPorMunicipio(m, units, regs, meses);
            labels.push(m); d1.push(r.coberturas.menor1); d2.push(r.coberturas.uno); d3.push(r.coberturas.cuatro);
        }
    } else {
        if (titleEl) titleEl.textContent = 'Cobertura por Unidad';
        const results = units.map(u => RDA2026Calculator.calcularPorUnidad(u, regs, meses))
            .sort((a, b) => b.coberturas.menor1 - a.coberturas.menor1).slice(0, 15);
        for (const r of results) {
            labels.push((r.nombre||r.clues).substring(0, 22)); d1.push(r.coberturas.menor1); d2.push(r.coberturas.uno); d3.push(r.coberturas.cuatro);
        }
    }

    _rdaCharts.b = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [
            { label: '< 1 Año', data: d1, backgroundColor: '#0d9488', borderRadius: 3 },
            { label: '1 Año', data: d2, backgroundColor: '#0284c7', borderRadius: 3 },
            { label: '4 Años', data: d3, backgroundColor: '#4338ca', borderRadius: 3 }
        ]},
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: false,
            plugins: { legend: { position: 'top', labels: { font: { size: 10, weight: 'bold' }, usePointStyle: true, padding: 10 } } },
            scales: { x: { beginAtZero: true, max: 100, ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#f1f5f9' } },
                      y: { ticks: { color: '#334155', font: { size: 10, weight: '700' } }, grid: { display: false } } }
        }
    });
}

// ══════════ TABLE ══════════
function renderTable(units, regs, meses) {
    const tbody = document.getElementById('rdaDetailTbody');
    const countEl = document.getElementById('rdaTableCount');
    if (!tbody) return;

    const rows = units.map(u => {
        const r = RDA2026Calculator.calcularPorUnidad(u, regs, meses);
        return { clues: u.clues, nombre: r.nombre, municipio: r.municipio,
            menor1: r.coberturas.menor1, uno: r.coberturas.uno, cuatro: r.coberturas.cuatro,
            pob: (u.pob_menor_1||0)+(u.pob_1_ano||0)+(u.pob_4_anos||0) };
    });

    // Default sort: by municipio (custom order) then CLUES ascending
    const muniIdx = m => { const n = (m||'').toUpperCase().trim(); const i = MUNI_ORDER.findIndex(x => n.includes(x) || x.includes(n)); return i >= 0 ? i : 99; };
    if (_rdaState.sortCol) {
        const col = _rdaState.sortCol;
        rows.sort((a, b) => { const va = a[col], vb = b[col]; return typeof va === 'string' ? (_rdaState.sortAsc ? va.localeCompare(vb) : vb.localeCompare(va)) : (_rdaState.sortAsc ? va - vb : vb - va); });
    } else {
        rows.sort((a, b) => muniIdx(a.municipio) - muniIdx(b.municipio) || a.clues.localeCompare(b.clues));
    }

    if (countEl) countEl.textContent = `${rows.length} unidades`;
    const badge = v => {
        const bg = v >= 80 ? '#dcfce7' : v >= 50 ? '#fef3c7' : '#fee2e2';
        const fg = v >= 80 ? '#166534' : v >= 50 ? '#92400e' : '#991b1b';
        return `<span style="display:inline-block;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:800;background:${bg};color:${fg}">${v}%</span>`;
    };
    tbody.innerHTML = rows.length === 0
        ? '<tr><td colspan="7" style="padding:40px;text-align:center;color:#94a3b8;font-weight:600;">Sin datos</td></tr>'
        : rows.map(r => `<tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:8px 12px;font-size:11px;font-weight:700;color:#64748b;font-family:monospace">${r.clues}</td>
            <td style="padding:8px 12px;font-size:11px;font-weight:700;color:#0f172a">${r.nombre}</td>
            <td style="padding:8px 12px;font-size:11px;color:#64748b">${r.municipio}</td>
            <td style="padding:8px 12px;text-align:center">${badge(r.menor1)}</td>
            <td style="padding:8px 12px;text-align:center">${badge(r.uno)}</td>
            <td style="padding:8px 12px;text-align:center">${badge(r.cuatro)}</td>
            <td style="padding:8px 12px;text-align:center;font-size:11px;font-weight:700;color:#64748b">${r.pob.toLocaleString('es-MX')}</td>
          </tr>`).join('');
}

// ══════════ EXPORT ══════════
function _tLabel() { return _rdaState.modo === 'mensual' ? `M${_rdaState.meses}` : `T${_rdaState.trimestre}`; }
function _dateStr() { return new Date().toISOString().slice(0,10).replace(/-/g,''); }
function _safeName(n) { return (n||'').replace(/[^a-zA-Z0-9]/g,'_').substring(0,40); }

async function exportIndividualPDF() {
    const content = document.getElementById('rdaDashboardContent');
    if (!content) return;
    if (typeof showOverlay === 'function') showOverlay('Generando PDF...', 'Exportando');

    const muni = document.getElementById('rdaFilterMunicipio')?.value || '';
    const uni = document.getElementById('rdaFilterUnidad')?.value || '';
    let fname = `RDA2026_${_tLabel()}_${_dateStr()}.pdf`;
    if (uni) { const u = (_rdaCache.unidades||[]).find(x=>x.clues===uni); fname = `${uni}_${_safeName(u?.nombre)}_${_tLabel()}_${_dateStr()}.pdf`; }
    else if (muni) fname = `${_safeName(muni)}_${_tLabel()}_${_dateStr()}.pdf`;

    // Clone content to avoid modifying live DOM
    const clone = content.cloneNode(true);
    clone.style.width = '1000px';
    clone.style.padding = '16px';
    clone.style.background = '#fff';
    document.body.appendChild(clone);

    try {
        await html2pdf().set({
            margin: [10, 10, 10, 10], filename: fname,
            image: { type: 'jpeg', quality: 0.9 },
            html2canvas: { scale: 1.5, useCORS: true, scrollY: -window.scrollY },
            jsPDF: { unit: 'mm', format: 'letter', orientation: 'landscape' },
            pagebreak: { mode: ['avoid-all'], before: '.no-break' }
        }).from(clone).save();
        if (typeof showToast === 'function') showToast('PDF generado', true, 'good');
    } catch (e) { console.error(e); if (typeof showToast === 'function') showToast('Error al exportar', false, 'bad'); }
    finally { document.body.removeChild(clone); if (typeof hideOverlay === 'function') hideOverlay(); }
}

async function exportMasivoZIP() {
    if (typeof JSZip === 'undefined') { if (typeof showToast === 'function') showToast('JSZip no disponible', false, 'bad'); return; }
    if (typeof showOverlay === 'function') showOverlay('Preparando exportación...', 'ZIP');

    try {
        const { unidades, registros } = _rdaCache;
        const meses = _rdaState.meses;
        const muni = document.getElementById('rdaFilterMunicipio')?.value || '';
        let targets = unidades;
        if (muni) targets = targets.filter(u => (u.municipio||'').toUpperCase().trim() === muni.toUpperCase().trim());

        const zip = new JSZip();

        for (let i = 0; i < targets.length; i++) {
            const u = targets[i];
            if (typeof showOverlay === 'function') showOverlay(`${i+1}/${targets.length}: ${(u.nombre||u.clues).substring(0,30)}`, 'Generando PDFs');

            const r = RDA2026Calculator.calcularPorUnidad(u, registros, meses);

            // Create a temporary visible div appended to body
            const tmpDiv = document.createElement('div');
            tmpDiv.style.cssText = 'position:fixed;left:0;top:0;width:700px;background:#fff;padding:30px;z-index:-1;opacity:0.01;';
            tmpDiv.innerHTML = `<div style="font-family:Arial,sans-serif;">
                <h1 style="font-size:18px;font-weight:900;color:#003366;margin:0 0 4px 0;">Reporte RDA 2026 — ${_tLabel()}</h1>
                <p style="font-size:11px;color:#64748b;margin:0 0 16px 0;">CLUES: ${u.clues} | ${u.nombre} | ${u.municipio}</p>
                <table style="width:100%;border-collapse:collapse;">
                    <tr style="background:#f0f9ff"><th style="padding:8px;text-align:left;border:1px solid #e2e8f0;font-size:11px">Indicador</th><th style="padding:8px;text-align:center;border:1px solid #e2e8f0;font-size:11px">Cobertura</th><th style="padding:8px;text-align:center;border:1px solid #e2e8f0;font-size:11px">Población</th></tr>
                    <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:700">< 1 Año</td><td style="padding:8px;text-align:center;border:1px solid #e2e8f0;font-weight:800">${r.coberturas.menor1}%</td><td style="padding:8px;text-align:center;border:1px solid #e2e8f0">${r.poblacion.menor1}</td></tr>
                    <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:700">1 Año</td><td style="padding:8px;text-align:center;border:1px solid #e2e8f0;font-weight:800">${r.coberturas.uno}%</td><td style="padding:8px;text-align:center;border:1px solid #e2e8f0">${r.poblacion.uno}</td></tr>
                    <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:700">4 Años</td><td style="padding:8px;text-align:center;border:1px solid #e2e8f0;font-weight:800">${r.coberturas.cuatro}%</td><td style="padding:8px;text-align:center;border:1px solid #e2e8f0">${r.poblacion.cuatro}</td></tr>
                </table>
                <p style="font-size:8px;color:#94a3b8;margin-top:12px;">Generado: ${new Date().toLocaleString('es-MX')} | JS1</p>
            </div>`;
            document.body.appendChild(tmpDiv);

            // Wait for DOM paint
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

            const blob = await html2pdf().set({
                margin: 10, image: { type: 'jpeg', quality: 0.85 },
                html2canvas: { scale: 1.5, scrollY: -window.scrollY, useCORS: true },
                jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' },
                pagebreak: { mode: ['avoid-all'] }
            }).from(tmpDiv).outputPdf('blob');

            document.body.removeChild(tmpDiv);
            zip.file(`${u.clues}_${_safeName(u.nombre)}_${_tLabel()}_${_dateStr()}.pdf`, blob);
        }

        if (typeof showOverlay === 'function') showOverlay('Comprimiendo...', 'Finalizando');
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = `Reporte_RDA2026_${muni || 'JS1'}_${_dateStr()}.zip`;
        link.click(); URL.revokeObjectURL(link.href);
        if (typeof showToast === 'function') showToast(`ZIP con ${targets.length} PDFs listo`, true, 'good');
    } catch (e) { console.error(e); if (typeof showToast === 'function') showToast('Error en exportación', false, 'bad'); }
    finally { if (typeof hideOverlay === 'function') hideOverlay(); }
}

window.refreshRDADashboard = () => { _rdaCache = { unidades: null, registros: null }; loadAndRender(); };
window.addEventListener('DOMContentLoaded', () => initRDADashboard());
