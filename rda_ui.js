/**
 * rda_ui.js — Indicadores Vacunas 2026 v5 (Premium Analysis)
 */
let _rdaCharts = {};
let _rdaCache = { unidades: null, registros: null, anio: 2026, maxMes: 0 };
let _rdaState = { sortCol: null, sortAsc: true };
const MUNI_ORDER = ['CORREGIDORA','HUIMILPAN','EL MARQUES','MARQUÉS','MARQUES','QUERETARO','QUERÉTARO'];
const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function initRDADashboard() {
    const overlay = document.getElementById('rdaDashboardOverlay');
    const btnOpen = document.getElementById('btnOpenRdaDashboard');
    const btnClose = document.getElementById('btnCloseRda');

    if (btnOpen && overlay) {
        btnOpen.addEventListener('click', () => {
            overlay.style.opacity = '1'; overlay.style.visibility = 'visible';
            document.getElementById('rdaDashboardPanel').style.transform = 'scale(1)';
            document.body.style.overflow = 'hidden';
            _rdaCache.unidades = null;
            _rdaCache.registros = null;
            _rdaCache.maxMes = 0;
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

    // Removed Trimester tabs and month select logic as per request.
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

    // Fetch ALL unidades (población is fixed here)
    const { data: unidades, error: e1 } = await window.supabase
        .from('unidades_medicas').select('*').limit(5000);
    if (e1) throw e1;

    // OPTIMIZATION: Filter by Year (Integer) to avoid 400 errors and speed up load
    const curYear = _rdaCache.anio;
    // Supabase default max = 1000 rows per request. pageSize MUST be <= 1000.
    let allRegs = [], page = 0, pageSize = 1000, hasMore = true;
    while (hasMore) {
        const { data, error } = await window.supabase
            .from('registros_sis')
            .select('clues, variable_sis, valor, mes, anio')
            .eq('anio', curYear)
            .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        if (data && data.length > 0) {
            allRegs = allRegs.concat(data);
            page++;
        }
        if (!data || data.length < pageSize) hasMore = false;
    }

    // Detect latest month for progressive logic
    const maxMes = allRegs.length > 0 ? Math.max(...allRegs.map(r => r.mes)) : 0;

    console.log(`[RDA] Loaded 2026: ${unidades.length} unidades, ${allRegs.length} registros. Cierre: Mes ${maxMes}`);
    
    // ═══ DIAGNÓSTICO DETALLADO POR MUNICIPIO ═══
    if (allRegs.length > 0) {
        const regClues = new Set(allRegs.map(r => r.clues));
        const uniClues = new Set((unidades||[]).map(u => u.clues));
        const soloEnRegs = [...regClues].filter(c => !uniClues.has(c));
        const soloEnUnis = [...uniClues].filter(c => !regClues.has(c));
        const enAmbos = [...regClues].filter(c => uniClues.has(c));
        
        console.log(`%c[RDA DIAGNÓSTICO COMPLETO]`, 'color: #0d9488; font-weight: bold; font-size: 14px');
        console.log(`CLUES en registros: ${regClues.size} | en unidades: ${uniClues.size} | Coinciden: ${enAmbos.length}`);
        console.log(`Solo en registros (sin unidad): ${soloEnRegs.length}`, soloEnRegs.slice(0,10));
        console.log(`Solo en unidades (sin registros): ${soloEnUnis.length}`, soloEnUnis.slice(0,10));
        
        // Desglose por municipio
        const muniMap = {};
        for (const u of (unidades||[])) {
            const m = (u.municipio||'DESCONOCIDO').toUpperCase().trim();
            if (!muniMap[m]) muniMap[m] = { uniClues: [], uniConRegs: 0, uniSinRegs: 0, pobTotal: 0 };
            muniMap[m].uniClues.push(u.clues);
            muniMap[m].pobTotal += (u.pob_menor_1||0) + (u.pob_1_ano||0) + (u.pob_4_anos||0);
            if (regClues.has(u.clues)) muniMap[m].uniConRegs++;
            else muniMap[m].uniSinRegs++;
        }
        console.table(Object.entries(muniMap).map(([m, d]) => ({
            Municipio: m, 
            'Total Unidades': d.uniClues.length,
            'Con Registros': d.uniConRegs, 
            'Sin Registros': d.uniSinRegs,
            'Poblacion': d.pobTotal,
            'CLUES (muestra)': d.uniClues.slice(0,3).join(', ')
        })));
    } else {
        console.warn(`[RDA DIAG] ⚠️ 0 registros cargados para año ${curYear}. ¿Se subió el CSV?`);
    }
    _rdaCache.unidades = unidades || [];
    _rdaCache.registros = allRegs;
    _rdaCache.maxMes = maxMes;
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
    const { unidades, registros, maxMes } = _rdaCache;
    if (!unidades || !registros) return;

    const muniFilter = document.getElementById('rdaFilterMunicipio')?.value || '';
    const uniFilter = document.getElementById('rdaFilterUnidad')?.value || '';

    let fUnits = unidades;
    if (muniFilter) fUnits = fUnits.filter(u => (u.municipio || '').toUpperCase().trim() === muniFilter.toUpperCase().trim());
    if (uniFilter) fUnits = fUnits.filter(u => u.clues === uniFilter);

    const fClues = new Set(fUnits.map(u => u.clues));
    const fRegs = registros.filter(r => fClues.has(r.clues));

    // Progressive Calculation (up to maxMes)
    const global = RDA2026Calculator.calcularGlobal(fUnits, fRegs, maxMes);

    // Labels
    const scopeEl = document.getElementById('rdaScopeLabel');
    if (scopeEl) {
        if (uniFilter) scopeEl.textContent = fUnits[0]?.nombre || uniFilter;
        else if (muniFilter) scopeEl.textContent = `Municipio: ${muniFilter}`;
        else scopeEl.textContent = 'Jurisdicción Sanitaria 1';
    }
    const cierreEl = document.getElementById('rdaCierreLabel');
    if (cierreEl) cierreEl.textContent = `Avance al cierre de ${MONTH_NAMES[maxMes-1] || 'Sin datos'}`;

    // KPIs
    setKPI('kpiMenor1', global.coberturas.menor1);
    setKPI('kpi1Ano', global.coberturas.uno);
    setKPI('kpi4Anos', global.coberturas.cuatro);

    const totalPob = global.poblacion.menor1 + global.poblacion.uno + global.poblacion.cuatro;
    const kpiPob = document.getElementById('kpiPoblacion');
    if (kpiPob) kpiPob.textContent = totalPob.toLocaleString('es-MX');
    const kpiUni = document.getElementById('kpiUnidades');
    if (kpiUni) kpiUni.textContent = `${global.totalUnidades} unidades médicas`;

    setDosis('kpiMenor1Dosis', fRegs, [...DICT_RDA.BCG,...DICT_RDA.HepB_0_7,...DICT_RDA.Hexa_3,...DICT_RDA.Rota_2,...DICT_RDA.Neumo_2], maxMes);
    setDosis('kpi1AnoDosis', fRegs, [...DICT_RDA.Hexa_Ref,...DICT_RDA.Neumo_Ref,...DICT_RDA.SRP_2], maxMes);
    setDosis('kpi4AnosDosis', fRegs, DICT_RDA.DPT_4, maxMes);

    renderDoughnut(global.coberturas);
    renderBarChart(fUnits, fRegs, maxMes, muniFilter);
    renderTable(fUnits, fRegs, maxMes);
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
            datasets: [{ 
                data: [cob.menor1, cob.uno, cob.cuatro], 
                backgroundColor: ['#0d9488','#0284c7','#7c3aed'], 
                hoverOffset: 12,
                borderWidth: 0,
                borderRadius: 8
            }]
        },
        options: { 
            responsive: true, maintainAspectRatio: false, cutout: '75%', animation: { duration: 800, easing: 'easeOutQuart' },
            plugins: { 
                legend: { position: 'bottom', labels: { font: { size: 12, weight: '700' }, color: '#64748b', padding: 20, usePointStyle: true, pointStyle: 'circle' } },
                tooltip: { backgroundColor: '#0f172a', titleFont: { size: 13 }, bodyFont: { size: 13 }, padding: 12, cornerRadius: 10 }
            }
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
        if (titleEl) titleEl.textContent = 'Análisis por Municipio';
        const munis = [...new Set(units.map(u => (u.municipio||'').toUpperCase().trim()))].filter(Boolean).sort();
        for (const m of munis) {
            const r = RDA2026Calculator.calcularPorMunicipio(m, units, regs, meses);
            labels.push(m); d1.push(r.coberturas.menor1); d2.push(r.coberturas.uno); d3.push(r.coberturas.cuatro);
        }
    } else {
        if (titleEl) titleEl.textContent = 'Top 12 Unidades (Cobertura)';
        const results = units.map(u => RDA2026Calculator.calcularPorUnidad(u, regs, meses))
            .sort((a, b) => b.coberturas.menor1 - a.coberturas.menor1).slice(0, 12);
        for (const r of results) {
            labels.push((r.nombre||r.clues).substring(0, 20)); d1.push(r.coberturas.menor1); d2.push(r.coberturas.uno); d3.push(r.coberturas.cuatro);
        }
    }

    _rdaCharts.b = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [
            { label: '< 1 Año', data: d1, backgroundColor: '#0d9488', borderRadius: 6, barThickness: 12 },
            { label: '1 Año', data: d2, backgroundColor: '#0284c7', borderRadius: 6, barThickness: 12 },
            { label: '4 Años', data: d3, backgroundColor: '#7c3aed', borderRadius: 6, barThickness: 12 }
        ]},
        options: { 
            indexAxis: 'y', responsive: true, maintainAspectRatio: false, 
            animation: { duration: 1000, easing: 'easeOutQuart' },
            plugins: { 
                legend: { display: false },
                tooltip: { backgroundColor: '#0f172a', padding: 12, cornerRadius: 10, callbacks: { label: c => ` ${c.dataset.label}: ${c.raw}%` } }
            },
            scales: { 
                x: { beginAtZero: true, max: 100, ticks: { color: '#94a3b8', font: { size: 11, weight: '600' } }, grid: { color: '#f1f5f9', borderDash: [5,5] } },
                y: { ticks: { color: '#0f172a', font: { size: 11, weight: '800' } }, grid: { display: false } } 
            }
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
        const dosis = r.dosis || { menor1: 0, uno: 0, cuatro: 0 };
        return { clues: u.clues, nombre: r.nombre, municipio: r.municipio,
            menor1: r.coberturas.menor1, uno: r.coberturas.uno, cuatro: r.coberturas.cuatro,
            pob: (u.pob_menor_1||0)+(u.pob_1_ano||0)+(u.pob_4_anos||0),
            dosis: dosis.menor1 + dosis.uno + dosis.cuatro };
    });

    // Default sort: by municipio (custom order) then CLUES ascending
    const muniIdx = m => { 
        const n = (m||'').toUpperCase().trim(); 
        if (n.includes('CORREGIDORA')) return 0;
        if (n.includes('HUIMILPAN')) return 1;
        if (n.includes('MARQUES') || n.includes('MARQUÉS')) return 2;
        if (n.includes('QUERETARO') || n.includes('QUERÉTARO')) return 3;
        return 99;
    };
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
        ? '<tr><td colspan="8" style="padding:40px;text-align:center;color:#94a3b8;font-weight:600;">Sin datos</td></tr>'
        : rows.map(r => `<tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:16px 24px;font-size:11px;font-weight:700;color:#64748b;font-family:monospace">${r.clues}</td>
            <td style="padding:16px 24px;font-size:11px;font-weight:800;color:#0f172a">${r.nombre}</td>
            <td style="padding:16px 24px;font-size:11px;color:#64748b;font-weight:600;">${r.municipio}</td>
            <td style="padding:8px 12px;text-align:center">${badge(r.menor1)}</td>
            <td style="padding:8px 12px;text-align:center">${badge(r.uno)}</td>
            <td style="padding:8px 12px;text-align:center">${badge(r.cuatro)}</td>
            <td style="padding:16px 24px;text-align:center;font-size:11px;font-weight:800;color:#64748b">${r.pob.toLocaleString('es-MX')}</td>
            <td style="padding:16px 24px;text-align:center;font-size:11px;font-weight:800;color:#0f172a">${r.dosis.toLocaleString('es-MX')}</td>
          </tr>`).join('');
}

// ══════════ EXPORT ══════════
function _tLabel() { return `Cierre_${MONTH_NAMES[_rdaCache.maxMes-1] || 'Final'}`; }
function _dateStr() { return new Date().toISOString().slice(0,10).replace(/-/g,''); }
function _safeName(n) { return (n||'').replace(/[^a-zA-Z0-9]/g,'_').substring(0,40); }

async function exportIndividualPDF() {
    const content = document.getElementById('rdaDashboardContent');
    if (!content) return;
    if (typeof showOverlay === 'function') showOverlay('Preparando reporte...', 'Exportando');

    const muni = document.getElementById('rdaFilterMunicipio')?.value || '';
    const uni = document.getElementById('rdaFilterUnidad')?.value || '';
    let fname = `Reporte_RDA2026_${_tLabel()}_${_dateStr()}.pdf`;
    
    // Better naming
    if (uni) { 
        const u = (_rdaCache.unidades||[]).find(x=>x.clues===uni); 
        fname = `RDA_${uni}_${_safeName(u?.nombre)}_${_tLabel()}.pdf`; 
    } else if (muni) {
        fname = `RDA_${_safeName(muni)}_${_tLabel()}.pdf`;
    }

    // Capture the Dashboard for premium look but strip scrollbars/fixed heights
    const clone = content.cloneNode(true);
    clone.style.width = '1200px'; // Forced width for landscape letter
    clone.style.height = 'auto';
    clone.style.overflow = 'visible';
    clone.style.padding = '40px';
    clone.style.background = '#f8fafc';
    clone.style.position = 'absolute';
    clone.style.left = '-5000px';
    clone.style.top = '0';
    
    // Remove scrollbars from any child
    clone.querySelectorAll('*').forEach(el => {
        if (el.style.overflow) el.style.overflow = 'visible';
        if (el.style.overflowY) el.style.overflowY = 'visible';
    });

    document.body.appendChild(clone);

    try {
        const opt = {
            margin: 0,
            filename: fname,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
                scale: 2, 
                useCORS: true, 
                letterRendering: true,
                logging: false,
                width: 1200
            },
            jsPDF: { unit: 'px', format: [1200, 927], orientation: 'landscape' }, // Aspect ratio for letter-like
            pagebreak: { mode: ['avoid-all'] }
        };

        await html2pdf().set(opt).from(clone).save();
        if (typeof showToast === 'function') showToast('Reporte generado exitosamente', true, 'good');
    } catch (e) { 
        console.error('[RDA Export]', e); 
        if (typeof showToast === 'function') showToast('Error al generar PDF', false, 'bad'); 
    } finally { 
        document.body.removeChild(clone); 
        if (typeof hideOverlay === 'function') hideOverlay(); 
    }
}

async function exportMasivoZIP() {
    if (typeof JSZip === 'undefined') { if (typeof showToast === 'function') showToast('JSZip no disponible', false, 'bad'); return; }
    
    const { unidades, registros, maxMes } = _rdaCache;
    if (!unidades) return;

    const muni = document.getElementById('rdaFilterMunicipio')?.value || '';
    let targets = unidades;
    if (muni) targets = targets.filter(u => (u.municipio||'').toUpperCase().trim() === muni.toUpperCase().trim());

    if (targets.length > 50) {
        if (!confirm(`Vas a generar ${targets.length} reportes. Esto puede tardar un momento. ¿Continuar?`)) return;
    }

    if (typeof showOverlay === 'function') showOverlay('Iniciando proceso masivo...', 'ZIP');

    try {
        const zip = new JSZip();
        const worker = html2pdf(); // Reuse worker for performance
        
        for (let i = 0; i < targets.length; i++) {
            const u = targets[i];
            const pct = Math.round(((i + 1) / targets.length) * 100);
            if (typeof showOverlay === 'function') showOverlay(`${pct}%: ${(u.nombre||u.clues).substring(0,25)}`, 'Procesando reportes');

            const r = RDA2026Calculator.calcularPorUnidad(u, registros, maxMes);

            const tmpDiv = document.createElement('div');
            tmpDiv.style.cssText = 'position:fixed;left:-5000px;top:0;width:800px;background:#fff;padding:50px;font-family:sans-serif;';
            tmpDiv.innerHTML = `
                <div style="border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
                    <div>
                        <h1 style="font-size:24px; color:#0f172a; margin:0;">Reporte RDA 2026</h1>
                        <p style="font-size:12px; color:#64748b; margin:2px 0 0 0;">Cierre de información: ${MONTH_NAMES[maxMes-1] || 'Sin datos'}</p>
                    </div>
                    <div style="text-align:right;">
                        <p style="font-size:10px; color:#94a3b8; margin:0;">CLUES: ${u.clues}</p>
                    </div>
                </div>
                
                <div style="margin-bottom: 30px;">
                    <h2 style="font-size:16px; margin:0 0 10px 0;">Datos de la Unidad</h2>
                    <p style="font-size:14px; margin:0;"><strong>Nombre:</strong> ${u.nombre}</p>
                    <p style="font-size:14px; margin:4px 0 0 0;"><strong>Municipio:</strong> ${u.municipio}</p>
                </div>

                <table style="width:100%; border-collapse:collapse; margin-bottom:30px;">
                    <thead>
                        <tr style="background:#f8fafc;">
                            <th style="padding:12px; text-align:left; border:1px solid #e2e8f0; font-size:12px; color:#64748b;">CATEGORÍA</th>
                            <th style="padding:12px; text-align:center; border:1px solid #e2e8f0; font-size:12px; color:#64748b;">META (POB)</th>
                            <th style="padding:12px; text-align:center; border:1px solid #e2e8f0; font-size:12px; color:#64748b;">AVANCE (DOSIS)</th>
                            <th style="padding:12px; text-align:center; border:1px solid #e2e8f0; font-size:12px; color:#64748b;">COBERTURA</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding:12px; border:1px solid #e2e8f0; font-size:14px; font-weight:700;">Menores de 1 Año</td>
                            <td style="padding:12px; border:1px solid #e2e8f0; text-align:center; font-size:14px;">${u.pob_menor_1 || 0}</td>
                            <td style="padding:12px; border:1px solid #e2e8f0; text-align:center; font-size:14px;">${r.dosis.menor1}</td>
                            <td style="padding:12px; border:1px solid #e2e8f0; text-align:center; font-size:14px; font-weight:800; color:${r.coberturas.menor1 >= 80 ? '#059669' : '#dc2626'}">${r.coberturas.menor1}%</td>
                        </tr>
                        <tr>
                            <td style="padding:12px; border:1px solid #e2e8f0; font-size:14px; font-weight:700;">Niños de 1 Año</td>
                            <td style="padding:12px; border:1px solid #e2e8f0; text-align:center; font-size:14px;">${u.pob_1_ano || 0}</td>
                            <td style="padding:12px; border:1px solid #e2e8f0; text-align:center; font-size:14px;">${r.dosis.uno}</td>
                            <td style="padding:12px; border:1px solid #e2e8f0; text-align:center; font-size:14px; font-weight:800; color:${r.coberturas.uno >= 80 ? '#059669' : '#dc2626'}">${r.coberturas.uno}%</td>
                        </tr>
                        <tr>
                            <td style="padding:12px; border:1px solid #e2e8f0; font-size:14px; font-weight:700;">Niños de 4 Años</td>
                            <td style="padding:12px; border:1px solid #e2e8f0; text-align:center; font-size:14px;">${u.pob_4_anos || 0}</td>
                            <td style="padding:12px; border:1px solid #e2e8f0; text-align:center; font-size:14px;">${r.dosis.cuatro}</td>
                            <td style="padding:12px; border:1px solid #e2e8f0; text-align:center; font-size:14px; font-weight:800; color:${r.coberturas.cuatro >= 80 ? '#059669' : '#dc2626'}">${r.coberturas.cuatro}%</td>
                        </tr>
                    </tbody>
                </table>

                <div style="background:#fffbeb; border:1px solid #fde68a; padding:15px; border-radius:8px;">
                    <p style="margin:0; font-size:12px; color:#92400e; line-height:1.5;">
                        <strong>Nota:</strong> Los datos presentados corresponden al avance acumulado reportado en el sistema SIS hasta el mes de ${MONTH_NAMES[maxMes-1]}.
                    </p>
                </div>
                
                <div style="margin-top:50px; border-top:1px solid #e2e8f0; padding-top:10px;">
                    <p style="font-size:10px; color:#94a3b8; margin:0;">Jurisdicción Sanitaria 1 — Reporte Generado el ${new Date().toLocaleString('es-MX')}</p>
                </div>
            `;
            document.body.appendChild(tmpDiv);

            const blob = await worker.set({
                margin: 10,
                image: { type: 'jpeg', quality: 0.8 },
                html2canvas: { scale: 1.5, logging: false },
                jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
            }).from(tmpDiv).outputPdf('blob');

            document.body.removeChild(tmpDiv);
            zip.file(`RDA_${u.clues}_${_safeName(u.nombre)}.pdf`, blob);
        }

        if (typeof showOverlay === 'function') showOverlay('Finalizando compresión...', 'ZIP');
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = `Reportes_RDA2026_${_safeName(muni) || 'JS1'}_${_dateStr()}.zip`;
        link.click();
        URL.revokeObjectURL(link.href);
        
        if (typeof showToast === 'function') showToast(`Exportación masiva completada`, true, 'good');
    } catch (e) { 
        console.error('[RDA ZIP]', e); 
        if (typeof showToast === 'function') showToast('Error en exportación masiva', false, 'bad'); 
    } finally { 
        if (typeof hideOverlay === 'function') hideOverlay(); 
    }
}

window.refreshRDADashboard = () => { 
    _rdaCache.unidades = null; 
    _rdaCache.registros = null; 
    _rdaCache.maxMes = 0;
    loadAndRender(); 
};
window.addEventListener('DOMContentLoaded', () => initRDADashboard());
