/**
 * rda_ui.js — Indicadores Vacunas 2026 v5 (Premium Analysis)
 */
let _rdaCharts = {};
let _rdaCache = { unidades: null, registros: null, anio: 2026, maxMes: 0 };
let _rdaState = { sortCol: null, sortAsc: true, esquema: 'basico' };
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

    // Pilar 1: Inyección del Selector de Esquemas MD3
    const filterContainer = document.querySelector('#rdaDashboardPanel div div[style*="background: #f1f5f9"]');
    if (filterContainer && !document.getElementById('rdaFilterEsquema')) {
        const sel = document.createElement('select');
        sel.id = 'rdaFilterEsquema';
        sel.style.cssText = `
            height: 38px; padding: 0 16px; min-width: 220px;
            border-radius: 10px; border: 1px solid #e2e8f0;
            background: #0f172a; color: #fff;
            font-size: 13px; font-weight: 700; outline: none; cursor: pointer;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;
        sel.innerHTML = `
            <option value="basico">Esquema Básico (0 a 8 años)</option>
            <option value="adultos">Esquemas Adolescentes y Adultos</option>
            <option value="mayores">Esquemas Adultos Mayores</option>
        `;
        sel.addEventListener('change', () => {
            _rdaState.esquema = sel.value;
            renderDashboard();
        });
        filterContainer.insertBefore(sel, filterContainer.firstChild);
    }

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
    const esquema = _rdaState.esquema || 'basico';

    let fUnits = unidades;
    if (muniFilter) fUnits = fUnits.filter(u => (u.municipio || '').toUpperCase().trim() === muniFilter.toUpperCase().trim());
    if (uniFilter) fUnits = fUnits.filter(u => u.clues === uniFilter);

    const fClues = new Set(fUnits.map(u => u.clues));
    const fRegs = registros.filter(r => fClues.has(r.clues));

    // Labels
    const scopeEl = document.getElementById('rdaScopeLabel');
    if (scopeEl) {
        if (uniFilter) scopeEl.textContent = fUnits[0]?.nombre || uniFilter;
        else if (muniFilter) scopeEl.textContent = `Municipio: ${muniFilter}`;
        else scopeEl.textContent = 'Jurisdicción Sanitaria 1';
    }
    const cierreEl = document.getElementById('rdaCierreLabel');
    if (cierreEl) {
        const label = esquema === 'basico' ? 'Esquema 0-8 años' : esquema === 'adultos' ? 'Adolescentes/Adultos' : 'Adultos Mayores';
        cierreEl.textContent = `${label} | Cierre: ${MONTH_NAMES[maxMes-1] || 'Sin datos'}`;
    }

    // Cálculos y KPIs según esquema
    const global = RDA2026Calculator.calcularGlobal(fUnits, fRegs, maxMes);
    
    if (esquema === 'basico') {
        setKPI('kpiMenor1', global.coberturas.menor1);
        setKPI('kpi1Ano', global.coberturas.uno);
        setKPI('kpi4Anos', global.coberturas.cuatro);
        
        setDosis('kpiMenor1Dosis', fRegs, [...DICT_RDA.BCG,...DICT_RDA.HepB_0_7,...DICT_RDA.Hexa_3,...DICT_RDA.Rota_2,...DICT_RDA.Neumo_2], maxMes);
        setDosis('kpi1AnoDosis', fRegs, [...DICT_RDA.Hexa_Ref,...DICT_RDA.Neumo_Ref,...DICT_RDA.SRP_2], maxMes);
        setDosis('kpi4AnosDosis', fRegs, DICT_RDA.DPT_4, maxMes);

        updateKPILabels(['< 1 Año', '1 Año', '4 Años']);
    } else if (esquema === 'adultos') {
        const apps = RDA2026Calculator.aplicacionesAdolescentes(fRegs, maxMes);
        document.getElementById('kpiMenor1').textContent = apps.hb.toLocaleString('es-MX');
        document.getElementById('kpi1Ano').textContent = apps.sr.toLocaleString('es-MX');
        document.getElementById('kpi4Anos').textContent = apps.vph.toLocaleString('es-MX');
        
        document.getElementById('kpiMenor1Dosis').textContent = 'Hepatitis B';
        document.getElementById('kpi1AnoDosis').textContent = 'SR';
        document.getElementById('kpi4AnosDosis').textContent = 'VPH';
        
        updateKPILabels(['HepB', 'SR', 'VPH']);
    } else {
        const apps = RDA2026Calculator.aplicacionesMayores(fRegs, maxMes);
        document.getElementById('kpiMenor1').textContent = apps.td.toLocaleString('es-MX');
        document.getElementById('kpi1Ano').textContent = (apps.neumo13 + apps.neumo20).toLocaleString('es-MX');
        document.getElementById('kpi4Anos').textContent = '—';
        
        document.getElementById('kpiMenor1Dosis').textContent = 'Td Mayores';
        document.getElementById('kpi1AnoDosis').textContent = 'Neumo Mayores';
        document.getElementById('kpi4AnosDosis').textContent = 'N/A';
        
        updateKPILabels(['Td', 'Neumo', '—']);
    }

    const totalPob = global.poblacion.menor1 + global.poblacion.uno + global.poblacion.cuatro;
    const kpiPob = document.getElementById('kpiPoblacion');
    if (kpiPob) kpiPob.textContent = totalPob.toLocaleString('es-MX');
    const kpiUni = document.getElementById('kpiUnidades');
    if (kpiUni) kpiUni.textContent = `${global.totalUnidades} unidades médicas`;

    renderDoughnut(global.coberturas, esquema);
    renderBarChart(fUnits, fRegs, maxMes, muniFilter, esquema);
    renderTable(fUnits, fRegs, maxMes, esquema);
}

function updateKPILabels(labels) {
    const containers = document.querySelectorAll('.rda-kpi-card');
    if (containers.length < 3) return;
    [0,1,2].forEach(i => {
        const labelEl = containers[i].querySelector('div[style*="text-transform: uppercase"]');
        if (labelEl) labelEl.textContent = labels[i];
    });
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
function renderDoughnut(cob, esquema) {
    const ctx = document.getElementById('chartDoughnut');
    if (!ctx) return;
    if (_rdaCharts.d) _rdaCharts.d.destroy();

    let labels = ['< 1 Año', '1 Año', '4 Años'];
    let data = [cob.menor1, cob.uno, cob.cuatro];

    if (esquema !== 'basico') {
        // En otros esquemas, el doughnut muestra proporción de aplicaciones totales
        labels = esquema === 'adultos' ? ['HepB', 'SR', 'VPH'] : ['Td', 'Neumo', '—'];
        const apps = esquema === 'adultos' 
            ? RDA2026Calculator.aplicacionesAdolescentes(_rdaCache.registros, _rdaCache.maxMes)
            : RDA2026Calculator.aplicacionesMayores(_rdaCache.registros, _rdaCache.maxMes);
        
        data = esquema === 'adultos' 
            ? [apps.hb, apps.sr, apps.vph]
            : [apps.td, apps.neumo13 + apps.neumo20, 0];
    }

    _rdaCharts.d = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{ 
                data: data, 
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

function renderBarChart(units, regs, meses, muniFilter, esquema) {
    const ctx = document.getElementById('chartBar');
    if (!ctx) return;
    if (_rdaCharts.b) _rdaCharts.b.destroy();

    const titleEl = document.getElementById('chartBarTitle');
    let labels = [], d1 = [], d2 = [], d3 = [];
    const role = (typeof USER !== 'undefined' && USER?.rol) || 'UNIDAD';
    
    let datasetLabels = esquema === 'basico' ? ['< 1 Año', '1 Año', '4 Años'] 
                      : esquema === 'adultos' ? ['HepB', 'SR', 'VPH']
                      : ['Td', 'Neumo', '—'];

    if (!muniFilter && (role === 'ADMIN' || role === 'JURISDICCIONAL')) {
        if (titleEl) titleEl.textContent = 'Análisis por Municipio';
        const munis = [...new Set(units.map(u => (u.municipio||'').toUpperCase().trim()))].filter(Boolean).sort();
        for (const m of munis) {
            labels.push(m);
            if (esquema === 'basico') {
                const r = RDA2026Calculator.calcularPorMunicipio(m, units, regs, meses);
                d1.push(r.coberturas.menor1); d2.push(r.coberturas.uno); d3.push(r.coberturas.cuatro);
            } else if (esquema === 'adultos') {
                const uList = units.filter(u => (u.municipio||'').toUpperCase().trim() === m);
                const uClues = new Set(uList.map(u => u.clues));
                const mRegs = regs.filter(r => uClues.has(r.clues));
                const apps = RDA2026Calculator.aplicacionesAdolescentes(mRegs, meses);
                d1.push(apps.hb); d2.push(apps.sr); d3.push(apps.vph);
            } else {
                const uList = units.filter(u => (u.municipio||'').toUpperCase().trim() === m);
                const uClues = new Set(uList.map(u => u.clues));
                const mRegs = regs.filter(r => uClues.has(r.clues));
                const apps = RDA2026Calculator.aplicacionesMayores(mRegs, meses);
                d1.push(apps.td); d2.push(apps.neumo13 + apps.neumo20); d3.push(0);
            }
        }
    } else {
        if (titleEl) titleEl.textContent = 'Top 12 Unidades';
        const results = units.map(u => {
            const res = { clues: u.clues, nombre: u.nombre };
            if (esquema === 'basico') {
                const r = RDA2026Calculator.calcularPorUnidad(u, regs, meses);
                res.v1 = r.coberturas.menor1; res.v2 = r.coberturas.uno; res.v3 = r.coberturas.cuatro;
            } else if (esquema === 'adultos') {
                const uRegs = regs.filter(r => r.clues === u.clues);
                const apps = RDA2026Calculator.aplicacionesAdolescentes(uRegs, meses);
                res.v1 = apps.hb; res.v2 = apps.sr; res.v3 = apps.vph;
            } else {
                const uRegs = regs.filter(r => r.clues === u.clues);
                const apps = RDA2026Calculator.aplicacionesMayores(uRegs, meses);
                res.v1 = apps.td; res.v2 = apps.neumo13 + apps.neumo20; res.v3 = 0;
            }
            return res;
        }).sort((a, b) => b.v1 - a.v1).slice(0, 12);
        
        for (const r of results) {
            labels.push((r.nombre||r.clues).substring(0, 20)); d1.push(r.v1); d2.push(r.v2); d3.push(r.v3);
        }
    }

    _rdaCharts.b = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [
            { label: datasetLabels[0], data: d1, backgroundColor: '#0d9488', borderRadius: 6, barThickness: 12 },
            { label: datasetLabels[1], data: d2, backgroundColor: '#0284c7', borderRadius: 6, barThickness: 12 },
            { label: datasetLabels[2], data: d3, backgroundColor: '#7c3aed', borderRadius: 6, barThickness: 12 }
        ]},
        options: { 
            indexAxis: 'y', responsive: true, maintainAspectRatio: false, 
            animation: { duration: 1000, easing: 'easeOutQuart' },
            plugins: { 
                legend: { display: false },
                tooltip: { backgroundColor: '#0f172a', padding: 12, cornerRadius: 10, callbacks: { label: c => ` ${c.dataset.label}: ${c.raw}${esquema==='basico'?'%':''}` } }
            },
            scales: { 
                x: { beginAtZero: true, ticks: { color: '#94a3b8', font: { size: 11, weight: '600' } }, grid: { color: '#f1f5f9', borderDash: [5,5] } },
                y: { ticks: { color: '#0f172a', font: { size: 11, weight: '800' } }, grid: { display: false } } 
            }
        }
    });
}

// ══════════ TABLE ══════════
function renderTable(units, regs, meses, esquema) {
    const table = document.getElementById('rdaDetailTable');
    const tbody = document.getElementById('rdaDetailTbody');
    const countEl = document.getElementById('rdaTableCount');
    if (!tbody || !table) return;

    // 1. Cabeceras Dinámicas
    let vCols = [];
    if (esquema === 'basico') {
        vCols = [{ n: '< 1 Año', s: 'v1' }, { n: '1 Año', s: 'v2' }, { n: '4 Años', s: 'v3' }];
    } else if (esquema === 'adultos') {
        vCols = [
            { n: 'HepB', s: 'v1' }, { n: 'SR', s: 'v2' }, { n: 'VPH', s: 'v3' }, 
            { n: 'Td', s: 'v4' }, { n: 'Tdpa', s: 'v5' }
        ];
    } else {
        vCols = [{ n: 'Td', s: 'v1' }, { n: 'Neumo', s: 'v2' }];
    }

    const thead = table.querySelector('thead');
    thead.innerHTML = `
        <tr style="background: #f8fafc;">
            <th style="padding: 16px 24px; text-align: left; font-size: 11px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid #f1f5f9; cursor: pointer;" data-sort="clues">CLUES ↕</th>
            <th style="padding: 16px 24px; text-align: left; font-size: 11px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid #f1f5f9; cursor: pointer;" data-sort="nombre">Nombre ↕</th>
            <th style="padding: 16px 24px; text-align: left; font-size: 11px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid #f1f5f9; cursor: pointer;" data-sort="municipio">Municipio ↕</th>
            ${vCols.map(c => `<th style="padding: 16px 24px; text-align: center; font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid #f1f5f9; cursor: pointer;" data-sort="${c.s}">${c.n} ↕</th>`).join('')}
            <th style="padding: 16px 24px; text-align: center; font-size: 11px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid #f1f5f9; cursor: pointer;" data-sort="pob">Meta ↕</th>
            <th style="padding: 16px 24px; text-align: center; font-size: 11px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid #f1f5f9; cursor: pointer;" data-sort="dosis">Total ↕</th>
        </tr>`;

    // Re-vincular eventos de sort ya que borramos el HTML
    thead.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (_rdaState.sortCol === col) _rdaState.sortAsc = !_rdaState.sortAsc;
            else { _rdaState.sortCol = col; _rdaState.sortAsc = false; }
            renderDashboard();
        });
    });

    // 2. Datos Dinámicos
    const rows = units.map(u => {
        const uRegs = regs.filter(r => r.clues === u.clues);
        const res = { clues: u.clues, nombre: u.nombre, municipio: u.municipio, pob: (u.pob_menor_1||0)+(u.pob_1_ano||0)+(u.pob_4_anos||0) };
        
        if (esquema === 'basico') {
            const r = RDA2026Calculator.calcularPorUnidad(u, regs, meses);
            res.v1 = r.coberturas.menor1; res.v2 = r.coberturas.uno; res.v3 = r.coberturas.cuatro;
            res.dosis = (r.dosis.menor1||0) + (r.dosis.uno||0) + (r.dosis.cuatro||0);
        } else if (esquema === 'adultos') {
            const apps = RDA2026Calculator.aplicacionesAdolescentes(uRegs, meses);
            res.v1 = apps.hb; res.v2 = apps.sr; res.v3 = apps.vph; res.v4 = apps.td; res.v5 = apps.tdpa;
            res.dosis = res.v1 + res.v2 + res.v3 + res.v4 + res.v5;
        } else {
            const apps = RDA2026Calculator.aplicacionesMayores(uRegs, meses);
            res.v1 = apps.td; res.v2 = apps.neumo13 + apps.neumo20;
            res.dosis = res.v1 + res.v2;
        }
        return res;
    });

    if (_rdaState.sortCol) {
        const col = _rdaState.sortCol;
        rows.sort((a, b) => { 
            const va = a[col], vb = b[col]; 
            return typeof va === 'string' ? (_rdaState.sortAsc ? va.localeCompare(vb) : vb.localeCompare(va)) : (_rdaState.sortAsc ? va - vb : vb - va); 
        });
    }

    if (countEl) countEl.textContent = `${rows.length} unidades`;
    
    const badge = v => {
        if (esquema !== 'basico') return `<span style="font-weight:800;color:#0f172a">${v.toLocaleString('es-MX')}</span>`;
        const bg = v >= 80 ? '#dcfce7' : v >= 50 ? '#fef3c7' : '#fee2e2';
        const fg = v >= 80 ? '#166534' : v >= 50 ? '#92400e' : '#991b1b';
        return `<span style="display:inline-block;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:800;background:${bg};color:${fg}">${v}%</span>`;
    };

    tbody.innerHTML = rows.length === 0
        ? `<tr><td colspan="${4 + vCols.length}" style="padding:40px;text-align:center;color:#94a3b8;font-weight:600;">Sin datos</td></tr>`
        : rows.map(r => `<tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:16px 24px;font-size:11px;font-weight:700;color:#64748b;font-family:monospace">${r.clues}</td>
            <td style="padding:16px 24px;font-size:11px;font-weight:800;color:#0f172a">${r.nombre}</td>
            <td style="padding:16px 24px;font-size:11px;color:#64748b;font-weight:600;">${r.municipio}</td>
            ${vCols.map(c => `<td style="padding:8px 12px;text-align:center">${badge(r[c.s])}</td>`).join('')}
            <td style="padding:16px 24px;text-align:center;font-size:11px;font-weight:800;color:#64748b">${r.pob.toLocaleString('es-MX')}</td>
            <td style="padding:16px 24px;text-align:center;font-size:11px;font-weight:800;color:#0f172a">${r.dosis.toLocaleString('es-MX')}</td>
          </tr>`).join('');
}

// ══════════ EXPORT ══════════
function _tLabel() { return `Cierre_${MONTH_NAMES[_rdaCache.maxMes-1] || 'Final'}`; }
function _dateStr() { return new Date().toISOString().slice(0,10).replace(/-/g,''); }
function _safeName(n) { return (n||'').replace(/[^a-zA-Z0-9]/g,'_').substring(0,40); }

/**
 * Motor de exportación a PDF (Plantilla en Memoria)
 * Pilar 3: Generación limpia sin capturas de Viewport.
 * Convierte gráficas a PNG y usa una tabla HTML pura para evitar recortes.
 */
/**
 * Motor de exportación a PDF (Ultra-Safe Direct Render)
 * Soluciona el problema de los PDFs en blanco mediante construcción limpia e inline-styles.
 */
async function generarPDFRobusto(elementoOrigenId, nombreArchivo, devolverBlob = false) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log("[RDA PDF] Iniciando exportación robusta...");
            
            // 1. Capturar Imágenes de Gráficas (Base64 Síncrono)
            const imgA = _rdaCharts.d ? _rdaCharts.d.toBase64Image() : '';
            const imgB = _rdaCharts.b ? _rdaCharts.b.toBase64Image() : '';
            
            // 2. Obtener metadatos
            const esquemaSel = document.getElementById('rdaFilterEsquema');
            const esquemaTexto = esquemaSel ? esquemaSel.options[esquemaSel.selectedIndex].text : 'Análisis RDA';
            const muni = document.getElementById('rdaFilterMunicipio')?.value || 'JURISDICCIÓN SANITARIA 1';
            const maxMesLabel = MONTH_NAMES[_rdaCache.maxMes-1] || 'FINAL';

            // 3. Reconstrucción de la Tabla (Evita herencia de estilos rotos)
            const tablaOriginal = document.querySelector('#rdaDetailTable');
            if (!tablaOriginal) return reject("Tabla de datos no encontrada");

            const headers = Array.from(tablaOriginal.querySelectorAll('thead th')).map(th => th.innerText);
            const rows = Array.from(tablaOriginal.querySelectorAll('tbody tr')).map(tr => {
                return Array.from(tr.querySelectorAll('td')).map(td => ({
                    html: td.innerHTML,
                    align: window.getComputedStyle(td).textAlign
                }));
            });

            // 4. Crear Contenedor de Alta Visibilidad
            const pdfContainer = document.createElement('div');
            pdfContainer.id = 'pdf-ultra-safe-template';
            // IMPORTANTE: Fixed asegura que no sea cortado por modales o scrolls
            pdfContainer.style.cssText = `
                position: fixed; top: 0; left: 0; width: 1200px; 
                background: #ffffff; z-index: 10000000; padding: 50px; 
                box-sizing: border-box; font-family: 'Inter', Arial, sans-serif;
                visibility: visible; opacity: 1; color: #000;
            `;

            let tableRowsHTML = rows.map(r => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    ${r.map(td => `<td style="padding: 10px; font-size: 10px; color: #1e293b; text-align: ${td.align}; border: 1px solid #f1f5f9;">${td.html}</td>`).join('')}
                </tr>
            `).join('');

            pdfContainer.innerHTML = `
                <div style="width: 100%; background: #ffffff;">
                    <!-- Cabecera -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px;">
                        <div>
                            <h1 style="margin: 0; font-size: 28px; font-weight: 900; color: #0f172a;">Indicadores RDA 2026</h1>
                            <p style="margin: 5px 0 0 0; font-size: 16px; font-weight: 700; color: #64748b; text-transform: uppercase;">${esquemaTexto} | ${muni}</p>
                        </div>
                        <div style="text-align: right;">
                            <p style="margin: 0; font-size: 14px; font-weight: 900; color: #0d9488;">AVANCE AL CIERRE: ${maxMesLabel}</p>
                            <p style="margin: 2px 0 0 0; font-size: 10px; color: #94a3b8; font-weight: 800;">JS1 QUERÉTARO - REPORTE OFICIAL</p>
                        </div>
                    </div>

                    <!-- Gráficas -->
                    <div style="display: flex; gap: 30px; margin-bottom: 40px;">
                        <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 15px; padding: 20px; background: #f8fafc; text-align: center;">
                            <p style="margin: 0 0 15px 0; font-size: 11px; font-weight: 900; color: #64748b; text-transform: uppercase;">Distribución de Avance</p>
                            <img src="${imgA}" style="max-height: 250px; width: auto; margin: 0 auto;">
                        </div>
                        <div style="flex: 2; border: 1px solid #e2e8f0; border-radius: 15px; padding: 20px; background: #f8fafc; text-align: center;">
                            <p style="margin: 0 0 15px 0; font-size: 11px; font-weight: 900; color: #64748b; text-transform: uppercase;">Top Unidades / Municipios</p>
                            <img src="${imgB}" style="max-height: 250px; width: auto; margin: 0 auto;">
                        </div>
                    </div>

                    <!-- Tabla -->
                    <div style="border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: #0f172a;">
                                    ${headers.map(h => `<th style="padding: 12px; color: #ffffff; font-size: 10px; font-weight: 900; text-align: center; border: 1px solid #1e293b;">${h.replace('↕','')}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRowsHTML}
                            </tbody>
                        </table>
                    </div>

                    <div style="margin-top: 30px; text-align: center; font-size: 9px; color: #94a3b8; font-weight: 700;">
                        REPORTE GENERADO EL ${new Date().toLocaleString('es-MX')} - JS1 PLATAFORMA RDA
                    </div>
                </div>
            `;

            document.body.appendChild(pdfContainer);

            // 5. Espera Crítica para Renderizado
            await new Promise(r => setTimeout(r, 800));

            // 6. Configuración de Paginación
            const opt = {
                margin:       [0.4, 0.4, 0.4, 0.4],
                filename:     nombreArchivo,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { 
                    scale: 2, 
                    useCORS: true, 
                    windowWidth: 1200,
                    backgroundColor: '#ffffff',
                    logging: true // Para depuración en consola
                },
                jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' },
                pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
            };

            // 7. Generación y Limpieza
            try {
                let resultado;
                if (devolverBlob) {
                    resultado = await html2pdf().set(opt).from(pdfContainer).output('blob');
                } else {
                    await html2pdf().set(opt).from(pdfContainer).save();
                    resultado = true;
                }
                pdfContainer.remove();
                resolve(resultado);
            } catch (err) {
                pdfContainer.remove();
                reject(err);
            }

        } catch (error) {
            console.error("[RDA PDF Error]", error);
            const tmpl = document.getElementById('pdf-ultra-safe-template');
            if (tmpl) tmpl.remove();
            reject(error);
        }
    });
}

async function exportIndividualPDF() {
    const content = document.getElementById('rdaDashboardContent');
    if (!content) return;
    if (typeof showOverlay === 'function') showOverlay('Preparando reporte...', 'Exportando');

    const muni = document.getElementById('rdaFilterMunicipio')?.value || '';
    const uni = document.getElementById('rdaFilterUnidad')?.value || '';
    let fname = `Indicadores_RDA2026_${_tLabel()}_${_dateStr()}.pdf`;

    if (uni) {
        const u = (_rdaCache.unidades||[]).find(x=>x.clues===uni);
        fname = `RDA_${uni}_${_safeName(u?.nombre)}_${_tLabel()}.pdf`;
    } else if (muni) {
        fname = `RDA_${_safeName(muni)}_${_tLabel()}.pdf`;
    }

    try {
        await generarPDFRobusto('rdaDashboardContent', fname, false);
        if (typeof showToast === 'function') showToast('Reporte generado exitosamente', true, 'good');
    } catch (e) {
        if (typeof showToast === 'function') showToast('Error al generar PDF', false, 'bad');
    } finally {
        if (typeof hideOverlay === 'function') hideOverlay();
    }
}

async function exportMasivoZIP() {
    if (typeof JSZip === 'undefined') { if (typeof showToast === 'function') showToast('JSZip no disponible', false, 'bad'); return; }

    const { unidades } = _rdaCache;
    if (!unidades) return;

    const muniSelect = document.getElementById('rdaFilterMunicipio');
    const uniSelect = document.getElementById('rdaFilterUnidad');
    if (!muniSelect || !uniSelect) return;

    const originalMuni = muniSelect.value || '';
    const originalUni = uniSelect.value || '';

    let targets = unidades;
    if (originalMuni) targets = targets.filter(u => (u.municipio||'').toUpperCase().trim() === originalMuni.toUpperCase().trim());

    if (targets.length > 50) {
        if (!confirm(`Vas a generar ${targets.length} reportes robustos. Esto puede tardar varios minutos. ¿Continuar?`)) return;
    }

    if (typeof showOverlay === 'function') showOverlay('Iniciando proceso masivo...', 'ZIP');

    let originalChartAnim = null;
    if (typeof Chart !== 'undefined' && Chart.defaults && Chart.defaults.animation) {
        originalChartAnim = Chart.defaults.animation;
        Chart.defaults.animation = false;
    }

    try {
        const zip = new JSZip();

        for (let i = 0; i < targets.length; i++) {
            const u = targets[i];
            const pct = Math.round(((i + 1) / targets.length) * 100);
            if (typeof showOverlay === 'function') showOverlay(`${pct}%: ${(u.nombre||u.clues).substring(0,25)}`, 'Generando reporte...');

            muniSelect.value = u.municipio ? u.municipio.toUpperCase() : '';
            if (typeof populateUnidadFilter === 'function') populateUnidadFilter();
            uniSelect.value = u.clues;
            
            if (typeof renderDashboard === 'function') renderDashboard();

            // Dar tiempo a Chart.js para inicializarse
            await new Promise(resolve => setTimeout(resolve, 450));

            const fname = `RDA_${u.clues}_${_safeName(u.nombre)}.pdf`;
            const blob = await generarPDFRobusto('rdaDashboardContent', fname, true);
            zip.file(fname, blob);
        }

        if (typeof showOverlay === 'function') showOverlay('Finalizando compresión...', 'ZIP');
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = `Indicadores_RDA2026_${_safeName(originalMuni) || 'JS1'}_${_dateStr()}.zip`;
        link.click();
        URL.revokeObjectURL(link.href);

        if (typeof showToast === 'function') showToast(`Exportación masiva completada`, true, 'good');

    } catch (e) {
        console.error('[RDA ZIP]', e);
        if (typeof showToast === 'function') showToast('Error en exportación masiva', false, 'bad');
    } finally {
        if (originalChartAnim !== null && typeof Chart !== 'undefined') {
            Chart.defaults.animation = originalChartAnim;
        }

        muniSelect.value = originalMuni;
        if (typeof populateUnidadFilter === 'function') populateUnidadFilter();
        uniSelect.value = originalUni;
        if (typeof renderDashboard === 'function') renderDashboard();

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
