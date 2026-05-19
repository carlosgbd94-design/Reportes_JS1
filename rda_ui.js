/**
 * rda_ui.js — Indicadores Vacunas 2026 v6 (Premium Analysis - Highly Optimized Vanilla JS)
 */
let _rdaCharts = {};
let _rdaCache = { unidades: null, registros: null, anio: 2026, maxMes: 0 };
let _rdaState = { sortCol: null, sortAsc: true, esquema: 'basico' };
const MUNI_ORDER = ['CORREGIDORA','HUIMILPAN','EL MARQUES','MARQUÉS','MARQUES','QUERETARO','QUERÉTARO'];
const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Definición de KPIs para cada uno de los 5 esquemas de vacunación
const SCHEME_KPIS = {
    basico: [
        { label: 'Menores de 1 Año', icon: 'child_care', bg: '#f0fdfa', fg: '#0d9488', key: 'menor1' },
        { label: 'Niños de 1 Año', icon: 'face', bg: '#f0f9ff', fg: '#0284c7', key: 'uno' },
        { label: 'Niños de 4 Años', icon: 'school', bg: '#f5f3ff', fg: '#7c3aed', key: 'cuatro' },
        { label: 'Meta Poblacional', icon: 'groups', bg: '#fff7ed', fg: '#ea580c', key: 'pob' }
    ],
    adultos: [
        { label: 'Hepatitis B', icon: 'vaccines', bg: '#f0fdfa', fg: '#0d9488', key: 'adol_hb' },
        { label: 'SR', icon: 'face_retouching_natural', bg: '#f0f9ff', fg: '#0284c7', key: 'adol_sr' },
        { label: 'VPH', icon: 'girl', bg: '#f5f3ff', fg: '#7c3aed', key: 'adol_vph' },
        { label: 'Td', icon: 'biotech', bg: '#fff7ed', fg: '#ea580c', key: 'adol_td' },
        { label: 'Tdpa', icon: 'pregnant_woman', bg: '#fdf2f8', fg: '#db2777', key: 'adol_tdpa' }
    ],
    mayores: [
        { label: 'Neumo 13', icon: 'elderly', bg: '#f0fdfa', fg: '#0d9488', key: 'am_neumo13' },
        { label: 'Neumo 20', icon: 'elderly_3', bg: '#f0f9ff', fg: '#0284c7', key: 'am_neumo20' },
        { label: 'Td Mayores', icon: 'healing', bg: '#f5f3ff', fg: '#7c3aed', key: 'am_td' }
    ],
    embarazadas: [
        { label: 'Tdpa Embarazadas', icon: 'pregnant_woman', bg: '#fdf2f8', fg: '#db2777', key: 'emb_tdpa' },
        { label: 'VSR Embarazadas', icon: 'baby_changing_station', bg: '#f0fdfa', fg: '#0d9488', key: 'emb_vsr' }
    ],
    invernal: [
        { label: 'Influenza', icon: 'ac_unit', bg: '#f0f9ff', fg: '#0284c7', key: 'inv_influenza' },
        { label: 'COVID-19', icon: 'coronavirus', bg: '#f5f3ff', fg: '#7c3aed', key: 'inv_covid' }
    ]
};

function initRDADashboard() {
    const overlay = document.getElementById('rdaDashboardOverlay');
    
    // Legacy modal logic (btnOpen, btnClose, Escape) has been entirely removed
    // The RDA Dashboard now operates purely via the standardized 'activateOpsTab' / 'activateUnidadTab'
    

    // Inyección de select con soporte completo para los 5 esquemas de vacunación
    const filterContainer = document.querySelector('#rdaDashboardPanel div div[style*="background: #f1f5f9"]');
    if (filterContainer && !document.getElementById('rdaFilterEsquema')) {
        const sel = document.createElement('select');
        sel.id = 'rdaFilterEsquema';
        sel.style.cssText = `
            height: 38px; padding: 0 16px; min-width: 260px;
            border-radius: 10px; border: 1px solid #e2e8f0;
            background: #0f172a; color: #fff;
            font-size: 13px; font-weight: 700; outline: none; cursor: pointer;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;
        sel.innerHTML = `
            <option value="basico">Esquema Básico (0 a 8 años)</option>
            <option value="adultos">Esquemas Adolescentes y Adultos</option>
            <option value="mayores">Esquemas Adultos Mayores</option>
            <option value="embarazadas">Esquema Embarazadas (Tdpa, VSR)</option>
            <option value="invernal">Temporada Invernal (Influenza, COVID)</option>
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

    // Table sort listeners
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
    try { 
        showSkeletons(); 
        await fetchRDAData(); 
        populateFilters(); 
        renderDashboard(); 
    }
    catch (e) { 
        console.error('[RDA]', e); 
    }
}

// Inyección de Skeleton Loader mientras carga los datos de Supabase
function showSkeletons() {
    const kpiContainer = document.getElementById('rdaKpiGrid');
    if (kpiContainer) {
        kpiContainer.innerHTML = Array(4).fill(0).map(() => `
            <div class="rda-kpi-card" style="position: relative; overflow: hidden; background: #fff;">
                <div style="width: 48px; height: 48px; border-radius: 14px; background: #e2e8f0; margin-bottom: 16px;" class="animate-pulse"></div>
                <div style="width: 120px; height: 12px; background: #e2e8f0; border-radius: 4px; margin-bottom: 8px;" class="animate-pulse"></div>
                <div style="width: 80px; height: 32px; background: #e2e8f0; border-radius: 6px; margin-bottom: 12px;" class="animate-pulse"></div>
                <div style="width: 140px; height: 12px; background: #e2e8f0; border-radius: 4px;" class="animate-pulse"></div>
            </div>
        `).join('');
    }

    const tbody = document.getElementById('rdaDetailTbody');
    if (tbody) {
        tbody.innerHTML = Array(5).fill(0).map(() => `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding:16px 24px;"><div style="width: 100px; height: 12px; background: #e2e8f0; border-radius: 4px;" class="animate-pulse"></div></td>
                <td style="padding:16px 24px;"><div style="width: 180px; height: 12px; background: #e2e8f0; border-radius: 4px;" class="animate-pulse"></div></td>
                <td style="padding:16px 24px;"><div style="width: 100px; height: 12px; background: #e2e8f0; border-radius: 4px;" class="animate-pulse"></div></td>
                <td style="padding:16px 24px; text-align: center;"><div style="width: 60px; height: 12px; background: #e2e8f0; border-radius: 4px; margin: 0 auto;" class="animate-pulse"></div></td>
                <td style="padding:16px 24px; text-align: center;"><div style="width: 60px; height: 12px; background: #e2e8f0; border-radius: 4px; margin: 0 auto;" class="animate-pulse"></div></td>
                <td style="padding:16px 24px; text-align: center;"><div style="width: 60px; height: 12px; background: #e2e8f0; border-radius: 4px; margin: 0 auto;" class="animate-pulse"></div></td>
                <td style="padding:16px 24px; text-align: center;"><div style="width: 65px; height: 20px; background: #e2e8f0; border-radius: 6px; margin: 0 auto;" class="animate-pulse"></div></td>
            </tr>
        `).join('');
    }
}

// Supabase fetching con Server-Side RPC
async function fetchRDAData() {
    if (_rdaCache.unidades) return _rdaCache;

    const curYear = _rdaCache.anio;

    // 1. Obtener el mes máximo progresivo en registros_sis
    const { data: mesData, error: mesError } = await window.supabase
        .from('registros_sis')
        .select('mes')
        .eq('anio', curYear)
        .order('mes', { ascending: false })
        .limit(1);
    
    if (mesError) throw mesError;
    const maxMes = (mesData && mesData.length > 0) ? mesData[0].mes : 12;

    // 2. Consultar el stored procedure de Supabase (pre-agregación en BD)
    const { data: indicators, error: indError } = await window.supabase
        .rpc('get_rda_indicators', { p_anio: curYear, p_max_mes: maxMes });

    if (indError) throw indError;

    console.log(`[RDA] Loaded 2026 pre-aggregated indicators: ${indicators.length} records. Max Mes: ${maxMes}`);

    _rdaCache.unidades = indicators || [];
    _rdaCache.registros = indicators || [];
    _rdaCache.maxMes = maxMes;
    return _rdaCache;
}

function populateFilters() {
    const { unidades } = _rdaCache;
    const muniSel = document.getElementById('rdaFilterMunicipio');
    const uniSel = document.getElementById('rdaFilterUnidad');
    const esquemaSel = document.getElementById('rdaFilterEsquema');
    if (!muniSel || !unidades) return;

    const role = String((typeof USER !== 'undefined' && USER?.rol) || 'UNIDAD').toUpperCase();
    let allowed = (typeof USER !== 'undefined' && Array.isArray(USER?.municipiosAllowed)) ? USER.municipiosAllowed : [];
    if (allowed.length === 0 && typeof USER !== 'undefined' && USER?.municipio) {
        allowed = String(USER.municipio).split(',').map(m => m.trim().toUpperCase()).filter(Boolean);
    }

    let municipios = [...new Set(unidades.map(u => (u.municipio || '').toUpperCase().trim()))].filter(Boolean).sort();

    // Reset visibility of the filters and container
    if (muniSel.parentElement) {
        muniSel.parentElement.style.display = 'flex';
    }
    muniSel.style.display = 'block';
    if (uniSel) uniSel.style.display = 'block';
    if (esquemaSel) {
        esquemaSel.disabled = false;
        esquemaSel.style.display = 'block';
    }

    if (role === 'ADMIN' || role === 'JURISDICCIONAL') {
        muniSel.disabled = false;
        if (uniSel) uniSel.disabled = false;
        muniSel.innerHTML = '<option value="">Todos los municipios</option>' +
            municipios.map(m => `<option value="${m}">${m}</option>`).join('');
        muniSel.value = '';
        populateUnidadFilter();
    } else if (role === 'MUNICIPAL') {
        if (uniSel) uniSel.disabled = false;
        const norm = allowed.map(m => m.toUpperCase().trim());
        municipios = municipios.filter(m => norm.some(a => m.includes(a) || a.includes(m)));
        
        muniSel.innerHTML = municipios.map(m => `<option value="${m}">${m}</option>`).join('');
        
        if (municipios.length === 1) {
            muniSel.disabled = true;
            muniSel.value = municipios[0];
        } else {
            muniSel.disabled = false;
            if (municipios.length > 0) {
                muniSel.value = municipios[0];
            }
        }
        populateUnidadFilter();
    } else if (role === 'UNIDAD') {
        muniSel.disabled = true;
        if (uniSel) uniSel.disabled = true;

        const userClues = (typeof USER !== 'undefined' && USER?.clues) || '';
        const matchUnit = unidades.find(u => u.clues === userClues);
        if (matchUnit) {
            muniSel.innerHTML = `<option value="${(matchUnit.municipio || '').toUpperCase().trim()}">${matchUnit.municipio}</option>`;
            muniSel.value = (matchUnit.municipio || '').toUpperCase().trim();
            if (uniSel) {
                uniSel.innerHTML = `<option value="${matchUnit.clues}">${matchUnit.nombre || matchUnit.clues}</option>`;
                uniSel.value = matchUnit.clues;
            }
        } else {
            muniSel.innerHTML = '';
            muniSel.value = '';
            if (uniSel) {
                uniSel.innerHTML = '';
                uniSel.value = '';
            }
        }
    }
}

function populateUnidadFilter() {
    const muni = document.getElementById('rdaFilterMunicipio')?.value || '';
    const uniSel = document.getElementById('rdaFilterUnidad');
    if (!uniSel) return;

    const role = String((typeof USER !== 'undefined' && USER?.rol) || 'UNIDAD').toUpperCase();
    if (role === 'UNIDAD') {
        uniSel.style.display = 'block';
        uniSel.disabled = true;
        return;
    }

    if (!muni) {
        uniSel.style.display = 'none';
        uniSel.value = '';
        return;
    }

    uniSel.style.display = 'block';
    uniSel.disabled = false;
    const units = (_rdaCache.unidades || [])
        .filter(u => (u.municipio || '').toUpperCase().trim() === muni.toUpperCase().trim())
        .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

    uniSel.innerHTML = '<option value="">Todas las unidades</option>' +
        units.map(u => `<option value="${u.clues}">${u.nombre || u.clues}</option>`).join('');
    uniSel.value = '';
}

// Renderización Principal del Tablero
function renderDashboard() {
    const { unidades, maxMes } = _rdaCache;
    if (!unidades) return;

    const muniFilter = document.getElementById('rdaFilterMunicipio')?.value || '';
    const uniFilter = document.getElementById('rdaFilterUnidad')?.value || '';
    const esquema = _rdaState.esquema || 'basico';

    let fUnits = unidades;
    if (muniFilter) fUnits = fUnits.filter(u => (u.municipio || '').toUpperCase().trim() === muniFilter.toUpperCase().trim());
    if (uniFilter) fUnits = fUnits.filter(u => u.clues === uniFilter);

    // Labels
    const scopeEl = document.getElementById('rdaScopeLabel');
    if (scopeEl) {
        if (uniFilter) scopeEl.textContent = fUnits[0]?.nombre || uniFilter;
        else if (muniFilter) scopeEl.textContent = `Municipio: ${muniFilter}`;
        else scopeEl.textContent = 'Jurisdicción Sanitaria 1';
    }
    const cierreEl = document.getElementById('rdaCierreLabel');
    if (cierreEl) {
        const labelMap = {
            basico: 'Esquema Básico (0-8 años)',
            adultos: 'Adolescentes y Adultos',
            mayores: 'Adultos Mayores',
            embarazadas: 'Embarazadas',
            invernal: 'Temporada Invernal'
        };
        const label = labelMap[esquema] || 'Análisis RDA';
        cierreEl.textContent = `${label} | Cierre: ${MONTH_NAMES[maxMes-1] || 'Sin datos'}`;
    }

    // Calcular agregaciones a nivel de filtro actual
    let agg = {
        pob_menor_1: 0, pob_1_ano: 0, pob_4_anos: 0, pob_total: 0,
        bcg_dosis: 0, hepb_0_7_dosis: 0, hexa_3_dosis: 0, rota_2_dosis: 0, neumo_2_dosis: 0,
        hexa_ref_dosis: 0, neumo_ref_dosis: 0, srp_2_dosis: 0, dpt_4_dosis: 0,
        adol_hb: 0, adol_sr: 0, adol_vph: 0, adol_td: 0, adol_tdpa: 0,
        am_neumo13: 0, am_neumo20: 0, am_td: 0,
        emb_tdpa: 0, emb_vsr: 0,
        inv_influenza: 0, inv_covid: 0,
        total_unidades: fUnits.length
    };

    for (const u of fUnits) {
        agg.pob_menor_1 += u.pob_menor_1 || 0;
        agg.pob_1_ano += u.pob_1_ano || 0;
        agg.pob_4_anos += u.pob_4_anos || 0;

        agg.bcg_dosis += u.bcg_dosis || 0;
        agg.hepb_0_7_dosis += u.hepb_0_7_dosis || 0;
        agg.hexa_3_dosis += u.hexa_3_dosis || 0;
        agg.rota_2_dosis += u.rota_2_dosis || 0;
        agg.neumo_2_dosis += u.neumo_2_dosis || 0;

        agg.hexa_ref_dosis += u.hexa_ref_dosis || 0;
        agg.neumo_ref_dosis += u.neumo_ref_dosis || 0;
        agg.srp_2_dosis += u.srp_2_dosis || 0;
        agg.dpt_4_dosis += u.dpt_4_dosis || 0;

        agg.adol_hb += u.adol_hb || 0;
        agg.adol_sr += u.adol_sr || 0;
        agg.adol_vph += u.adol_vph || 0;
        agg.adol_td += u.adol_td || 0;
        agg.adol_tdpa += u.adol_tdpa || 0;

        agg.am_neumo13 += u.am_neumo13 || 0;
        agg.am_neumo20 += u.am_neumo20 || 0;
        agg.am_td += u.am_td || 0;

        agg.emb_tdpa += u.emb_tdpa || 0;
        agg.emb_vsr += u.emb_vsr || 0;

        agg.inv_influenza += u.inv_influenza || 0;
        agg.inv_covid += u.inv_covid || 0;
    }

    agg.pob_total = agg.pob_menor_1 + agg.pob_1_ano + agg.pob_4_anos;

    // Coberturas globales
    const factorMenor1 = (agg.pob_menor_1 * 0.0833) * maxMes;
    const factorUno = (agg.pob_1_ano * 0.0833) * maxMes;
    const factorCuatro = (agg.pob_4_anos * 0.0833) * maxMes;

    const sumaDosisMenor1 = agg.bcg_dosis + agg.hepb_0_7_dosis + agg.hexa_3_dosis + agg.rota_2_dosis + agg.neumo_2_dosis;
    const sumaDosisUno = agg.hexa_ref_dosis + agg.neumo_ref_dosis + agg.srp_2_dosis;
    const sumaDosisCuatro = agg.dpt_4_dosis;

    agg.cobertura_menor1 = factorMenor1 > 0 ? Math.round((((sumaDosisMenor1 / 4.0) / factorMenor1) * 100) * 10) / 10 : 0;
    agg.cobertura_uno = factorUno > 0 ? Math.round(((sumaDosisUno / factorUno) * 100) * 10) / 10 : 0;
    agg.cobertura_cuatro = factorCuatro > 0 ? Math.round(((sumaDosisCuatro / factorCuatro) * 100) * 10) / 10 : 0;

    // Renderizar componentes
    renderKPIs(agg, esquema);
    renderDoughnut(agg, esquema);
    renderBarChart(fUnits, muniFilter, esquema);
    renderTable(fUnits, esquema);
}

// Constructor Dinámico de KPIs
function renderKPIs(agg, esquema) {
    const container = document.getElementById('rdaKpiGrid');
    if (!container) return;
    container.innerHTML = '';

    const list = SCHEME_KPIS[esquema] || SCHEME_KPIS.basico;
    
    list.forEach(k => {
        let valText = '';
        let subText = '';
        let valNum = 0;
        
        if (esquema === 'basico') {
            if (k.key === 'menor1') {
                valNum = agg.cobertura_menor1;
                valText = `${valNum}%`;
                subText = `${(agg.bcg_dosis + agg.hepb_0_7_dosis + agg.hexa_3_dosis + agg.rota_2_dosis + agg.neumo_2_dosis).toLocaleString('es-MX')} dosis`;
            } else if (k.key === 'uno') {
                valNum = agg.cobertura_uno;
                valText = `${valNum}%`;
                subText = `${(agg.hexa_ref_dosis + agg.neumo_ref_dosis + agg.srp_2_dosis).toLocaleString('es-MX')} dosis`;
            } else if (k.key === 'cuatro') {
                valNum = agg.cobertura_cuatro;
                valText = `${valNum}%`;
                subText = `${agg.dpt_4_dosis.toLocaleString('es-MX')} dosis`;
            } else if (k.key === 'pob') {
                valText = agg.pob_total.toLocaleString('es-MX');
                subText = `${agg.total_unidades} unidades médicas`;
            }
        } else {
            if (k.key === 'pob') {
                valText = agg.total_unidades.toLocaleString('es-MX');
                subText = 'unidades médicas';
            } else {
                valNum = agg[k.key] || 0;
                valText = valNum.toLocaleString('es-MX');
                subText = 'dosis aplicadas';
            }
        }
        
        // Semaforización exclusiva para coberturas de esquema básico
        let valColor = '#0f172a';
        if (esquema === 'basico' && k.key !== 'pob') {
            valColor = valNum >= 80 ? '#059669' : valNum >= 50 ? '#d97706' : '#dc2626';
        }

        const card = document.createElement('div');
        card.className = 'rda-kpi-card';
        card.innerHTML = `
            <div class="rda-icon-box" style="background: ${k.bg}; color: ${k.fg};">
                <span class="material-symbols-rounded">${k.icon}</span>
            </div>
            <div style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;">${k.label}</div>
            <div style="font-size: 36px; font-weight: 900; color: ${valColor}; letter-spacing: -0.04em; line-height: 1.1;">${valText}</div>
            <div style="font-size: 13px; font-weight: 700; color: #64748b; margin-top: 8px;">${subText}</div>
        `;
        container.appendChild(card);
    });
}

// Chart.js Recycler: In-Place Doughnut update
function renderDoughnut(agg, esquema) {
    const ctx = document.getElementById('chartDoughnut');
    if (!ctx) return;

    let labels = [];
    let data = [];
    let backgroundColors = [];

    if (esquema === 'basico') {
        labels = ['< 1 Año', '1 Año', '4 Años'];
        data = [agg.cobertura_menor1, agg.cobertura_uno, agg.cobertura_cuatro];
        backgroundColors = ['#0d9488', '#0284c7', '#7c3aed'];
    } else if (esquema === 'adultos') {
        labels = ['HepB', 'SR', 'VPH', 'Td', 'Tdpa'];
        data = [agg.adol_hb, agg.adol_sr, agg.adol_vph, agg.adol_td, agg.adol_tdpa];
        backgroundColors = ['#0d9488', '#0284c7', '#7c3aed', '#ea580c', '#db2777'];
    } else if (esquema === 'mayores') {
        labels = ['Neumo 13', 'Neumo 20', 'Td'];
        data = [agg.am_neumo13, agg.am_neumo20, agg.am_td];
        backgroundColors = ['#0d9488', '#0284c7', '#7c3aed'];
    } else if (esquema === 'embarazadas') {
        labels = ['Tdpa', 'VSR'];
        data = [agg.emb_tdpa, agg.emb_vsr];
        backgroundColors = ['#db2777', '#0d9488'];
    } else if (esquema === 'invernal') {
        labels = ['Influenza', 'COVID-19'];
        data = [agg.inv_influenza, agg.inv_covid];
        backgroundColors = ['#0284c7', '#7c3aed'];
    }

    if (_rdaCharts.d) {
        const chart = _rdaCharts.d;
        chart.data.labels = labels;
        chart.data.datasets[0].data = data;
        chart.data.datasets[0].backgroundColor = backgroundColors;
        chart.update();
    } else {
        _rdaCharts.d = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{ 
                    data: data, 
                    backgroundColor: backgroundColors, 
                    hoverOffset: 12,
                    borderWidth: 0,
                    borderRadius: 8
                }]
            },
            options: { 
                responsive: true, maintainAspectRatio: false, cutout: '75%', 
                animation: { duration: 800, easing: 'easeOutQuart' },
                plugins: { 
                    legend: { position: 'bottom', labels: { font: { size: 12, weight: '700' }, color: '#64748b', padding: 20, usePointStyle: true, pointStyle: 'circle' } },
                    tooltip: { backgroundColor: '#0f172a', titleFont: { size: 13 }, bodyFont: { size: 13 }, padding: 12, cornerRadius: 10 }
                }
            }
        });
    }
}

// Chart.js Recycler: In-Place Horizontal Bar chart update
function renderBarChart(fUnits, muniFilter, esquema) {
    const ctx = document.getElementById('chartBar');
    if (!ctx) return;

    const titleEl = document.getElementById('chartBarTitle');
    let labels = [];
    let d1 = [], d2 = [], d3 = [], d4 = [], d5 = [];
    const role = (typeof USER !== 'undefined' && USER?.rol) || 'UNIDAD';
    const maxMes = _rdaCache.maxMes || 12;

    let datasetConfigs = [];
    if (esquema === 'basico') {
        datasetConfigs = [
            { label: '< 1 Año', data: d1, backgroundColor: '#0d9488' },
            { label: '1 Año', data: d2, backgroundColor: '#0284c7' },
            { label: '4 Años', data: d3, backgroundColor: '#7c3aed' }
        ];
    } else if (esquema === 'adultos') {
        datasetConfigs = [
            { label: 'HepB', data: d1, backgroundColor: '#0d9488' },
            { label: 'SR', data: d2, backgroundColor: '#0284c7' },
            { label: 'VPH', data: d3, backgroundColor: '#7c3aed' },
            { label: 'Td', data: d4, backgroundColor: '#ea580c' },
            { label: 'Tdpa', data: d5, backgroundColor: '#db2777' }
        ];
    } else if (esquema === 'mayores') {
        datasetConfigs = [
            { label: 'Neumo 13', data: d1, backgroundColor: '#0d9488' },
            { label: 'Neumo 20', data: d2, backgroundColor: '#0284c7' },
            { label: 'Td Mayores', data: d3, backgroundColor: '#7c3aed' }
        ];
    } else if (esquema === 'embarazadas') {
        datasetConfigs = [
            { label: 'Tdpa', data: d1, backgroundColor: '#db2777' },
            { label: 'VSR', data: d2, backgroundColor: '#0d9488' }
        ];
    } else if (esquema === 'invernal') {
        datasetConfigs = [
            { label: 'Influenza', data: d1, backgroundColor: '#0284c7' },
            { label: 'COVID-19', data: d2, backgroundColor: '#7c3aed' }
        ];
    }

    if (!muniFilter && (role === 'ADMIN' || role === 'JURISDICCIONAL')) {
        if (titleEl) titleEl.textContent = 'Análisis por Municipio';
        const munis = [...new Set(_rdaCache.unidades.map(u => (u.municipio || '').toUpperCase().trim()))].filter(Boolean).sort();
        
        for (const m of munis) {
            labels.push(m);
            const muniUnits = _rdaCache.unidades.filter(u => (u.municipio || '').toUpperCase().trim() === m);
            
            let mAgg = {
                pob_menor_1: 0, pob_1_ano: 0, pob_4_anos: 0,
                bcg_dosis: 0, hepb_0_7_dosis: 0, hexa_3_dosis: 0, rota_2_dosis: 0, neumo_2_dosis: 0,
                hexa_ref_dosis: 0, neumo_ref_dosis: 0, srp_2_dosis: 0, dpt_4_dosis: 0,
                adol_hb: 0, adol_sr: 0, adol_vph: 0, adol_td: 0, adol_tdpa: 0,
                am_neumo13: 0, am_neumo20: 0, am_td: 0,
                emb_tdpa: 0, emb_vsr: 0,
                inv_influenza: 0, inv_covid: 0
            };

            for (const u of muniUnits) {
                mAgg.pob_menor_1 += u.pob_menor_1 || 0;
                mAgg.pob_1_ano += u.pob_1_ano || 0;
                mAgg.pob_4_anos += u.pob_4_anos || 0;

                mAgg.bcg_dosis += u.bcg_dosis || 0;
                mAgg.hepb_0_7_dosis += u.hepb_0_7_dosis || 0;
                mAgg.hexa_3_dosis += u.hexa_3_dosis || 0;
                mAgg.rota_2_dosis += u.rota_2_dosis || 0;
                mAgg.neumo_2_dosis += u.neumo_2_dosis || 0;

                mAgg.hexa_ref_dosis += u.hexa_ref_dosis || 0;
                mAgg.neumo_ref_dosis += u.neumo_ref_dosis || 0;
                mAgg.srp_2_dosis += u.srp_2_dosis || 0;
                mAgg.dpt_4_dosis += u.dpt_4_dosis || 0;

                mAgg.adol_hb += u.adol_hb || 0;
                mAgg.adol_sr += u.adol_sr || 0;
                mAgg.adol_vph += u.adol_vph || 0;
                mAgg.adol_td += u.adol_td || 0;
                mAgg.adol_tdpa += u.adol_tdpa || 0;

                mAgg.am_neumo13 += u.am_neumo13 || 0;
                mAgg.am_neumo20 += u.am_neumo20 || 0;
                mAgg.am_td += u.am_td || 0;

                mAgg.emb_tdpa += u.emb_tdpa || 0;
                mAgg.emb_vsr += u.emb_vsr || 0;

                mAgg.inv_influenza += u.inv_influenza || 0;
                mAgg.inv_covid += u.inv_covid || 0;
            }

            if (esquema === 'basico') {
                const factorM1 = (mAgg.pob_menor_1 * 0.0833) * maxMes;
                const factorUno = (mAgg.pob_1_ano * 0.0833) * maxMes;
                const factorCuatro = (mAgg.pob_4_anos * 0.0833) * maxMes;

                const dosisM1 = mAgg.bcg_dosis + mAgg.hepb_0_7_dosis + mAgg.hexa_3_dosis + mAgg.rota_2_dosis + mAgg.neumo_2_dosis;
                const dosisUno = mAgg.hexa_ref_dosis + mAgg.neumo_ref_dosis + mAgg.srp_2_dosis;
                const dosisCuatro = mAgg.dpt_4_dosis;

                d1.push(factorM1 > 0 ? Math.round((((dosisM1 / 4.0) / factorM1) * 100) * 10) / 10 : 0);
                d2.push(factorUno > 0 ? Math.round(((dosisUno / factorUno) * 100) * 10) / 10 : 0);
                d3.push(factorCuatro > 0 ? Math.round(((dosisCuatro / factorCuatro) * 100) * 10) / 10 : 0);
            } else if (esquema === 'adultos') {
                d1.push(mAgg.adol_hb); d2.push(mAgg.adol_sr); d3.push(mAgg.adol_vph); d4.push(mAgg.adol_td); d5.push(mAgg.adol_tdpa);
            } else if (esquema === 'mayores') {
                d1.push(mAgg.am_neumo13); d2.push(mAgg.am_neumo20); d3.push(mAgg.am_td);
            } else if (esquema === 'embarazadas') {
                d1.push(mAgg.emb_tdpa); d2.push(mAgg.emb_vsr);
            } else if (esquema === 'invernal') {
                d1.push(mAgg.inv_influenza); d2.push(mAgg.inv_covid);
            }
        }
    } else {
        if (titleEl) titleEl.textContent = 'Top 12 Unidades';
        const results = fUnits.map(u => {
            const res = { clues: u.clues, nombre: u.nombre };
            if (esquema === 'basico') {
                const factorM1 = (u.pob_menor_1 * 0.0833) * maxMes;
                const factorUno = (u.pob_1_ano * 0.0833) * maxMes;
                const factorCuatro = (u.pob_4_anos * 0.0833) * maxMes;

                const dosisM1 = (u.bcg_dosis||0) + (u.hepb_0_7_dosis||0) + (u.hexa_3_dosis||0) + (u.rota_2_dosis||0) + (u.neumo_2_dosis||0);
                const dosisUno = (u.hexa_ref_dosis||0) + (u.neumo_ref_dosis||0) + (u.srp_2_dosis||0);
                const dosisCuatro = u.dpt_4_dosis||0;

                res.v1 = factorM1 > 0 ? Math.round((((dosisM1 / 4.0) / factorM1) * 100) * 10) / 10 : 0;
                res.v2 = factorUno > 0 ? Math.round(((dosisUno / factorUno) * 100) * 10) / 10 : 0;
                res.v3 = factorCuatro > 0 ? Math.round(((dosisCuatro / factorCuatro) * 100) * 10) / 10 : 0;
                res.sortVal = res.v1;
            } else if (esquema === 'adultos') {
                res.v1 = u.adol_hb || 0; res.v2 = u.adol_sr || 0; res.v3 = u.adol_vph || 0; res.v4 = u.adol_td || 0; res.v5 = u.adol_tdpa || 0;
                res.sortVal = res.v1 + res.v2 + res.v3 + res.v4 + res.v5;
            } else if (esquema === 'mayores') {
                res.v1 = u.am_neumo13 || 0; res.v2 = u.am_neumo20 || 0; res.v3 = u.am_td || 0;
                res.sortVal = res.v1 + res.v2 + res.v3;
            } else if (esquema === 'embarazadas') {
                res.v1 = u.emb_tdpa || 0; res.v2 = u.emb_vsr || 0;
                res.sortVal = res.v1 + res.v2;
            } else if (esquema === 'invernal') {
                res.v1 = u.inv_influenza || 0; res.v2 = u.inv_covid || 0;
                res.sortVal = res.v1 + res.v2;
            }
            return res;
        }).sort((a, b) => b.sortVal - a.sortVal).slice(0, 12);

        for (const r of results) {
            labels.push((r.nombre || r.clues).substring(0, 20));
            d1.push(r.v1 || 0); d2.push(r.v2 || 0); d3.push(r.v3 || 0);
            if (r.v4 !== undefined) d4.push(r.v4);
            if (r.v5 !== undefined) d5.push(r.v5);
        }
    }

    const finalDatasets = datasetConfigs.map((cfg, idx) => ({
        label: cfg.label,
        data: cfg.data,
        backgroundColor: cfg.backgroundColor,
        borderRadius: 6,
        barThickness: 12
    }));

    if (_rdaCharts.b) {
        const chart = _rdaCharts.b;
        chart.data.labels = labels;
        chart.data.datasets = finalDatasets;
        chart.update();
    } else {
        _rdaCharts.b = new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets: finalDatasets },
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
}

// Renderización de la Tabla de Datos con Cabecera Dinámica y Columna "Meta" Condicional
function renderTable(fUnits, esquema) {
    const table = document.getElementById('rdaDetailTable');
    const tbody = document.getElementById('rdaDetailTbody');
    const countEl = document.getElementById('rdaTableCount');
    if (!tbody || !table) return;

    const maxMes = _rdaCache.maxMes || 12;

    // 1. Columnas específicas de la vacuna según esquema
    let vCols = [];
    if (esquema === 'basico') {
        vCols = [{ n: '< 1 Año', s: 'v1' }, { n: '1 Año', s: 'v2' }, { n: '4 Años', s: 'v3' }];
    } else if (esquema === 'adultos') {
        vCols = [
            { n: 'HepB', s: 'v1' }, { n: 'SR', s: 'v2' }, { n: 'VPH', s: 'v3' }, 
            { n: 'Td', s: 'v4' }, { n: 'Tdpa', s: 'v5' }
        ];
    } else if (esquema === 'mayores') {
        vCols = [{ n: 'Neumo 13', s: 'v1' }, { n: 'Neumo 20', s: 'v2' }, { n: 'Td Mayores', s: 'v3' }];
    } else if (esquema === 'embarazadas') {
        vCols = [{ n: 'Tdpa', s: 'v1' }, { n: 'VSR', s: 'v2' }];
    } else if (esquema === 'invernal') {
        vCols = [{ n: 'Influenza', s: 'v1' }, { n: 'COVID-19', s: 'v2' }];
    }

    // "Meta" sólo es visible para el esquema "basico"
    const showMeta = (esquema === 'basico');
    const headerColsHTML = `
        <tr style="background: #f8fafc;">
            <th style="padding: 16px 24px; text-align: left; font-size: 11px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid #f1f5f9; cursor: pointer;" data-sort="clues">CLUES ↕</th>
            <th style="padding: 16px 24px; text-align: left; font-size: 11px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid #f1f5f9; cursor: pointer;" data-sort="nombre">Nombre ↕</th>
            <th style="padding: 16px 24px; text-align: left; font-size: 11px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid #f1f5f9; cursor: pointer;" data-sort="municipio">Municipio ↕</th>
            ${vCols.map(c => `<th style="padding: 16px 24px; text-align: center; font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid #f1f5f9; cursor: pointer;" data-sort="${c.s}">${c.n} ↕</th>`).join('')}
            ${showMeta ? `<th style="padding: 16px 24px; text-align: center; font-size: 11px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid #f1f5f9; cursor: pointer;" data-sort="pob">Meta ↕</th>` : ''}
            <th style="padding: 16px 24px; text-align: center; font-size: 11px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid #f1f5f9; cursor: pointer;" data-sort="dosis">Total ↕</th>
        </tr>
    `;

    const thead = table.querySelector('thead');
    thead.innerHTML = headerColsHTML;

    thead.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (_rdaState.sortCol === col) _rdaState.sortAsc = !_rdaState.sortAsc;
            else { _rdaState.sortCol = col; _rdaState.sortAsc = false; }
            renderDashboard();
        });
    });

    // 2. Mapear filas
    const rows = fUnits.map(u => {
        const res = { 
            clues: u.clues, 
            nombre: u.nombre, 
            municipio: u.municipio, 
            pob: (u.pob_menor_1 || 0) + (u.pob_1_ano || 0) + (u.pob_4_anos || 0) 
        };

        if (esquema === 'basico') {
            const factorM1 = (u.pob_menor_1 * 0.0833) * maxMes;
            const factorUno = (u.pob_1_ano * 0.0833) * maxMes;
            const factorCuatro = (u.pob_4_anos * 0.0833) * maxMes;

            const dosisM1 = (u.bcg_dosis || 0) + (u.hepb_0_7_dosis || 0) + (u.hexa_3_dosis || 0) + (u.rota_2_dosis || 0) + (u.neumo_2_dosis || 0);
            const dosisUno = (u.hexa_ref_dosis || 0) + (u.neumo_ref_dosis || 0) + (u.srp_2_dosis || 0);
            const dosisCuatro = u.dpt_4_dosis || 0;

            res.v1 = factorM1 > 0 ? Math.round((((dosisM1 / 4.0) / factorM1) * 100) * 10) / 10 : 0;
            res.v2 = factorUno > 0 ? Math.round(((dosisUno / factorUno) * 100) * 10) / 10 : 0;
            res.v3 = factorCuatro > 0 ? Math.round(((dosisCuatro / factorCuatro) * 100) * 10) / 10 : 0;
            res.dosis = dosisM1 + dosisUno + dosisCuatro;
        } else if (esquema === 'adultos') {
            res.v1 = u.adol_hb || 0;
            res.v2 = u.adol_sr || 0;
            res.v3 = u.adol_vph || 0;
            res.v4 = u.adol_td || 0;
            res.v5 = u.adol_tdpa || 0;
            res.dosis = res.v1 + res.v2 + res.v3 + res.v4 + res.v5;
        } else if (esquema === 'mayores') {
            res.v1 = u.am_neumo13 || 0;
            res.v2 = u.am_neumo20 || 0;
            res.v3 = u.am_td || 0;
            res.dosis = res.v1 + res.v2 + res.v3;
        } else if (esquema === 'embarazadas') {
            res.v1 = u.emb_tdpa || 0;
            res.v2 = u.emb_vsr || 0;
            res.dosis = res.v1 + res.v2;
        } else if (esquema === 'invernal') {
            res.v1 = u.inv_influenza || 0;
            res.v2 = u.inv_covid || 0;
            res.dosis = res.v1 + res.v2;
        }
        return res;
    });

    if (_rdaState.sortCol) {
        const col = _rdaState.sortCol;
        rows.sort((a, b) => {
            const va = a[col] === undefined ? 0 : a[col];
            const vb = b[col] === undefined ? 0 : b[col];
            return typeof va === 'string' 
                ? (_rdaState.sortAsc ? va.localeCompare(vb) : vb.localeCompare(va)) 
                : (_rdaState.sortAsc ? va - vb : vb - va);
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
        ? `<tr><td colspan="${4 + vCols.length + (showMeta ? 1 : 0)}" style="padding:40px;text-align:center;color:#94a3b8;font-weight:600;">Sin datos</td></tr>`
        : rows.map(r => `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:16px 24px;font-size:11px;font-weight:700;color:#64748b;font-family:monospace">${r.clues}</td>
                <td style="padding:16px 24px;font-size:11px;font-weight:800;color:#0f172a">${r.nombre}</td>
                <td style="padding:16px 24px;font-size:11px;color:#64748b;font-weight:600;">${r.municipio}</td>
                ${vCols.map(c => `<td style="padding:8px 12px;text-align:center">${badge(r[c.s])}</td>`).join('')}
                ${showMeta ? `<td style="padding:16px 24px;text-align:center;font-size:11px;font-weight:800;color:#64748b">${r.pob.toLocaleString('es-MX')}</td>` : ''}
                <td style="padding:16px 24px;text-align:center;font-size:11px;font-weight:800;color:#0f172a">${r.dosis.toLocaleString('es-MX')}</td>
            </tr>
        `).join('');
}

// ══════════ EXPORT ══════════
function _tLabel() { return `Cierre_${MONTH_NAMES[_rdaCache.maxMes-1] || 'Final'}`; }
function _dateStr() { return new Date().toISOString().slice(0,10).replace(/-/g,''); }
function _safeName(n) { return (n||'').replace(/[^a-zA-Z0-9]/g,'_').substring(0,40); }

// Motor de exportación a PDF (Ultra-Safe Direct Render)
async function generarPDFRobusto(elementoOrigenId, nombreArchivo, devolverBlob = false) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log("[RDA PDF] Iniciando exportación nativa vectorial...");
            
            const jsPDF = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : window.jsPDF;
            if (!jsPDF) { throw new Error("La librería jsPDF no está cargada en el DOM."); }

            // 1. Obtener Metadatos y Configuración
            const esquemaSel = document.getElementById('rdaFilterEsquema');
            const esquemaTexto = esquemaSel ? esquemaSel.options[esquemaSel.selectedIndex].text : 'Análisis RDA';
            const muni = document.getElementById('rdaFilterMunicipio')?.value || 'JURISDICCIÓN SANITARIA 1';
            const maxMesLabel = MONTH_NAMES[_rdaCache.maxMes-1] || 'FINAL';
            
            // 2. Obtener imágenes base64 de las gráficas
            const imgAvanceBase64 = _rdaCharts.d ? _rdaCharts.d.toBase64Image() : '';
            const imgTopBase64 = _rdaCharts.b ? _rdaCharts.b.toBase64Image() : '';

            // 3. Extraer estructura y datos de la tabla real
            const tablaOriginal = document.querySelector('#rdaDetailTable');
            if (!tablaOriginal) return reject("Tabla de datos no encontrada.");

            const tableHeaders = Array.from(tablaOriginal.querySelectorAll('thead th'))
                .map(th => th.innerText.replace(/[↕\n\r]/g, '').trim());

            const tableRows = Array.from(tablaOriginal.querySelectorAll('tbody tr')).map(tr => {
                return Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
            });

            // 4. Inicializar jsPDF en formato Carta Horizontal (Landscape)
            // Dimensiones Carta: 11 x 8.5 in -> 279.4 x 215.9 mm
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'letter'
            });

            // 5. Configurar diseño visual del encabezado (Premium Aesthetic)
            const marginX = 15;
            let currentY = 15;

            // Franja superior de marca institucional
            doc.setFillColor(15, 23, 42); // Slate 900
            doc.rect(marginX, currentY, 249.4, 3, 'F');
            currentY += 8;

            // Título Principal
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(22);
            doc.setTextColor(15, 23, 42);
            doc.text("Indicadores RDA 2026", marginX, currentY);

            // Avance del Cierre
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(13, 148, 136); // Teal 600
            doc.text(`AVANCE AL CIERRE: ${maxMesLabel}`, 264.4, currentY, { align: 'right' });
            currentY += 5;

            // Subtítulo
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139); // Slate 500
            doc.text(`${esquemaTexto.toUpperCase()}  |  ${muni.toUpperCase()}`, marginX, currentY);

            // Subtítulo Secundario Derecha
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184); // Slate 400
            doc.text("JS1 QUERÉTARO - REPORTE DE GESTIÓN", 264.4, currentY, { align: 'right' });
            currentY += 8;

            // 6. Sección de Gráficas (Lado a lado con bordes suaves)
            const chartSectionHeight = 55;
            const cardWidthA = 80;
            const cardWidthB = 154.4;
            const gap = 15;

            // Tarjeta A (Gráfica de Avance)
            doc.setFillColor(248, 250, 252); // Slate 50
            doc.roundedRect(marginX, currentY, cardWidthA, chartSectionHeight, 4, 4, 'F');
            doc.setDrawColor(226, 232, 240); // Slate 200
            doc.roundedRect(marginX, currentY, cardWidthA, chartSectionHeight, 4, 4, 'D');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text("DISTRIBUCIÓN DE AVANCE", marginX + 5, currentY + 7);

            if (imgAvanceBase64) {
                // Centrado dinámico dentro de la tarjeta
                doc.addImage(imgAvanceBase64, 'PNG', marginX + 10, currentY + 11, 60, 40, undefined, 'FAST');
            }

            // Tarjeta B (Gráfica Top Unidades)
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(marginX + cardWidthA + gap, currentY, cardWidthB, chartSectionHeight, 4, 4, 'F');
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(marginX + cardWidthA + gap, currentY, cardWidthB, chartSectionHeight, 4, 4, 'D');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text("TOP UNIDADES / MUNICIPIOS DE LA JURISDICCIÓN", marginX + cardWidthA + gap + 5, currentY + 7);

            if (imgTopBase64) {
                doc.addImage(imgTopBase64, 'PNG', marginX + cardWidthA + gap + 10, currentY + 11, 134.4, 40, undefined, 'FAST');
            }

            currentY += chartSectionHeight + 8;

            // 7. Renderizar Tabla Vectorial Completa con jsPDF-autotable
            doc.autoTable({
                head: [tableHeaders],
                body: tableRows,
                startY: currentY,
                margin: { left: marginX, right: marginX },
                theme: 'grid',
                styles: {
                    fontSize: 8,
                    font: 'helvetica',
                    cellPadding: 3,
                    valign: 'middle'
                },
                headStyles: {
                    fillColor: [15, 23, 42],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    halign: 'center'
                },
                columnStyles: {
                    0: { halign: 'left', font: 'courier', fontStyle: 'bold', cellWidth: 25 },
                    1: { halign: 'left', fontStyle: 'bold', cellWidth: 55 },
                    2: { halign: 'left', cellWidth: 30 }
                },
                bodyStyles: {
                    textColor: [30, 41, 59]
                },
                didParseCell: function(data) {
                    // Semáforo Inteligente Nativo
                    if (data.section === 'body') {
                        // Alinear columnas numéricas al centro
                        if (data.column.index > 2) {
                            data.cell.styles.halign = 'center';
                        }
                        
                        const text = data.cell.text[0] || '';
                        
                        // Aplicar colores y fondos para cobertura pediátrica/indicadores de porcentaje
                        if (text.includes('%')) {
                            const val = parseFloat(text);
                            if (!isNaN(val)) {
                                if (val >= 80) {
                                    data.cell.styles.fillColor = [220, 252, 231]; // Green 100
                                    data.cell.styles.textColor = [22, 101, 52];    // Green 800
                                    data.cell.styles.fontStyle = 'bold';
                                } else if (val >= 50) {
                                    data.cell.styles.fillColor = [254, 243, 199]; // Amber 100
                                    data.cell.styles.textColor = [146, 64, 14];   // Amber 800
                                    data.cell.styles.fontStyle = 'bold';
                                } else {
                                    data.cell.styles.fillColor = [254, 226, 226]; // Red 100
                                    data.cell.styles.textColor = [153, 27, 27];   // Red 800
                                    data.cell.styles.fontStyle = 'bold';
                                }
                            }
                        }
                    }
                },
                didDrawPage: function(data) {
                    // Pie de página premium en todas las páginas
                    const pageCount = doc.internal.getNumberOfPages();
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(8);
                    doc.setTextColor(148, 163, 184); // Slate 400
                    
                    const stamp = `REPORTE GENERADO EL ${new Date().toLocaleString('es-MX')} — PLATAFORMA DE INDICADORES RDA JS1`;
                    doc.text(stamp, marginX, 208);
                    
                    const pag = `Página ${data.pageNumber} de ${pageCount}`;
                    doc.text(pag, 264.4, 208, { align: 'right' });
                }
            });

            // 8. Resolver Promesa con la salida correspondiente
            if (devolverBlob) {
                const blob = doc.output('blob');
                resolve(blob);
            } else {
                doc.save(nombreArchivo);
                resolve(true);
            }

        } catch (error) {
            console.error("[RDA PDF Error]", error);
            reject(error);
        }
    });
}

async function exportIndividualPDF() {
    const content = document.getElementById('rdaDashboardContent');
    if (!content) return;
    if (typeof showOverlay === 'function') showOverlay('Preparando reporte nativo...', 'Exportando');

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
    if (typeof JSZip === 'undefined') { 
        if (typeof showToast === 'function') showToast('JSZip no disponible', false, 'bad'); 
        return; 
    }

    const { unidades } = _rdaCache;
    if (!unidades) return;

    const muniSelect = document.getElementById('rdaFilterMunicipio');
    const uniSelect = document.getElementById('rdaFilterUnidad');
    if (!muniSelect || !uniSelect) return;

    const originalMuni = muniSelect.value || '';
    const originalUni = uniSelect.value || '';

    let targets = unidades;
    if (originalMuni) {
        targets = targets.filter(u => (u.municipio||'').toUpperCase().trim() === originalMuni.toUpperCase().trim());
    }

    if (targets.length > 50) {
        if (!confirm(`Vas a generar ${targets.length} reportes vectoriales nativos. El proceso se ejecutará de forma ultra-rápida. ¿Continuar?`)) return;
    }

    if (typeof showOverlay === 'function') showOverlay('Iniciando proceso masivo vectorial...', 'ZIP');

    // Desactivar temporalmente animaciones para mayor velocidad y sincronía
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
            if (typeof showOverlay === 'function') {
                showOverlay(`${pct}%: ${(u.nombre||u.clues).substring(0,25)}`, 'Generando reporte nativo...');
            }

            muniSelect.value = u.municipio ? u.municipio.toUpperCase() : '';
            if (typeof populateUnidadFilter === 'function') populateUnidadFilter();
            uniSelect.value = u.clues;
            
            if (typeof renderDashboard === 'function') renderDashboard();

            // Sincronización instantánea sin animaciones (100ms es suficiente gracias al motor vectorial nativo)
            await new Promise(resolve => setTimeout(resolve, 100));

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
window.loadAndRender = loadAndRender;
window.addEventListener('DOMContentLoaded', () => initRDADashboard());
