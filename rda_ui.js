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
        { label: 'Neumo 20', icon: 'elderly', bg: '#f0f9ff', fg: '#0284c7', key: 'am_neumo20' },
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
    // The RDA Dashboard now operates purely via the standardized 'activateOpsTab' / 'activateUnidadT    // Inyección de select con soporte completo para los 5 esquemas de vacunación (Apple Material Specification)
    // Inyección de select con soporte completo para los 5 esquemas de vacunación
    const leftGroup = document.getElementById('rdaFilterLeftGroup');
    if (leftGroup && !document.getElementById('rdaFilterEsquema')) {
        // Estilos dedicados para anular cualquier regla global e implementar un diseño Premium
        const style = document.createElement('style');
        style.innerHTML = `
            #rdaFilterEsquema {
                display: inline-block !important;
                width: 290px !important;
                height: 42px !important;
                padding: 0 40px 0 16px !important;
                border-radius: 12px !important;
                border: 1px solid #cbd5e1 !important;
                background-color: #ffffff !important;
                color: #0f172a !important;
                font-size: 13px !important;
                font-weight: 700 !important;
                outline: none !important;
                cursor: pointer !important;
                box-shadow: 0 2px 4px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02) !important;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
                -webkit-appearance: none !important;
                appearance: none !important;
                background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%23475569'%3e%3cpath fill-rule='evenodd' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' clip-rule='evenodd'/%3e%3c/svg%3e") !important;
                background-repeat: no-repeat !important;
                background-position: right 14px center !important;
                background-size: 18px !important;
            }
            #rdaFilterEsquema:hover {
                border-color: #94a3b8 !important;
                background-color: #f8fafc !important;
                box-shadow: 0 3px 6px rgba(15, 23, 42, 0.06) !important;
            }
            #rdaFilterEsquema:focus {
                border-color: #0ea5e9 !important;
                background-color: #ffffff !important;
                box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.12) !important;
            }
            #rdaViewToggleContainer {
                display: inline-flex !important;
                align-items: center !important;
                padding: 3px !important;
                box-sizing: border-box !important;
                height: 42px !important;
                margin-left: 12px !important;
                border-radius: 12px !important;
                border: 1px solid #cbd5e1 !important;
                background: #f1f5f9 !important;
                box-shadow: inset 0 1.5px 3px rgba(15, 23, 42, 0.05) !important;
                transition: all 0.25s ease !important;
            }
            #rdaViewToggleContainer:hover {
                border-color: #94a3b8 !important;
            }
            #rdaViewToggleContainer button {
                box-sizing: border-box !important;
                min-height: 0 !important;
                height: 34px !important;
                padding: 0 18px !important;
                border-radius: 9px !important;
                border: 1px solid transparent !important;
                font-family: inherit !important;
                font-size: 12px !important;
                font-weight: 700 !important;
                cursor: pointer !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
                margin: 0 !important;
            }
            #rdaViewToggleContainer button.active {
                background-color: #ffffff !important;
                color: #0f172a !important;
                border-color: rgba(15, 23, 42, 0.04) !important;
                box-shadow: 0 3px 8px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04) !important;
            }
            #rdaViewToggleContainer button.inactive {
                background: transparent !important;
                color: #64748b !important;
                box-shadow: none !important;
                border-color: transparent !important;
            }
            #rdaViewToggleContainer button.inactive:hover {
                color: #0f172a !important;
                background: rgba(15, 23, 42, 0.02) !important;
            }
            #rdaFilterMunicipio, #rdaFilterUnidad {
                display: inline-block;
                width: auto !important;
                min-width: 220px !important;
                max-width: 280px !important;
                height: 42px !important;
                padding: 0 40px 0 16px !important;
                border-radius: 12px !important;
                border: 1px solid #cbd5e1 !important;
                background-color: #ffffff !important;
                color: #0f172a !important;
                font-size: 13px !important;
                font-weight: 700 !important;
                outline: none !important;
                cursor: pointer !important;
                box-shadow: 0 2px 4px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02) !important;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
                -webkit-appearance: none !important;
                appearance: none !important;
                background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%23475569'%3e%3cpath fill-rule='evenodd' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' clip-rule='evenodd'/%3e%3c/svg%3e") !important;
                background-repeat: no-repeat !important;
                background-position: right 14px center !important;
                background-size: 18px !important;
            }
            #rdaFilterMunicipio:hover, #rdaFilterUnidad:hover {
                border-color: #94a3b8 !important;
                background-color: #f8fafc !important;
                box-shadow: 0 3px 6px rgba(15, 23, 42, 0.06) !important;
            }
            #rdaFilterMunicipio:focus, #rdaFilterUnidad:focus {
                border-color: #0ea5e9 !important;
                background-color: #ffffff !important;
                box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.12) !important;
            }
            #rdaTableContainer {
                overflow: auto !important;
                max-height: 540px !important;
                position: relative !important;
                border-radius: 0 0 24px 24px !important;
            }
            #rdaDetailTable thead tr th {
                position: sticky !important;
                top: 0 !important;
                z-index: 20 !important;
                background-color: #f8fafc !important;
                box-shadow: 0 1px 0 #e2e8f0 !important;
            }
            #rdaDetailTable th:nth-child(1),
            #rdaDetailTable td:nth-child(1) {
                position: sticky !important;
                left: 0 !important;
                z-index: 12 !important;
                background-color: #ffffff !important;
                width: 140px !important;
                min-width: 140px !important;
                max-width: 140px !important;
                box-shadow: 1px 0 0 #f1f5f9 !important;
            }
            #rdaDetailTable th:nth-child(2),
            #rdaDetailTable td:nth-child(2) {
                position: sticky !important;
                left: 140px !important;
                z-index: 12 !important;
                background-color: #ffffff !important;
                min-width: 200px !important;
                box-shadow: 2px 0 5px rgba(15, 23, 42, 0.04) !important;
            }
            #rdaDetailTable th:nth-child(1),
            #rdaDetailTable th:nth-child(2) {
                z-index: 22 !important;
                background-color: #f8fafc !important;
            }
            #rdaDetailTable tr:nth-child(even) td:nth-child(1),
            #rdaDetailTable tr:nth-child(even) td:nth-child(2) {
                background-color: #f8fafc !important;
            }
            #rdaDetailTable tr td[colspan] {
                position: sticky !important;
                left: 0 !important;
                z-index: 11 !important;
                background-color: #f8fafc !important;
            }
            #rdaDetailTable tbody tr:hover td {
                background-color: #f1f5f9 !important;
            }
            #rdaDetailTable tbody tr:hover td:nth-child(1),
            #rdaDetailTable tbody tr:hover td:nth-child(2) {
                background-color: #f1f5f9 !important;
            }
        `;
        document.head.appendChild(style);

        // Selector de Esquemas moderno y limpio
        const sel = document.createElement('select');
        sel.id = 'rdaFilterEsquema';
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

        leftGroup.appendChild(sel);
 
        // Segmented Control de vistas limpio y moderno
        const toggleWrapper = document.createElement('div');
        toggleWrapper.id = 'rdaViewToggleContainer';
        toggleWrapper.innerHTML = `
            <button id="btnViewEsquema" class="active">Por Esquema</button>
            <button id="btnViewBiologico" class="inactive" style="margin-left: 4px !important;">Por Biológico</button>
        `;
        const btnE = toggleWrapper.querySelector('#btnViewEsquema');
        const btnB = toggleWrapper.querySelector('#btnViewBiologico');
        
        btnE.addEventListener('click', () => {
            _rdaState.vistaBasico = 'esquema';
            btnE.className = 'active';
            btnB.className = 'inactive';
            renderDashboard();
        });
        btnB.addEventListener('click', () => {
            _rdaState.vistaBasico = 'biologico';
            btnB.className = 'active';
            btnE.className = 'inactive';
            renderDashboard();
        });

        leftGroup.appendChild(toggleWrapper);
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

    initRDAMobileDashboard();
}

async function loadAndRender() {
    try { 
        showSkeletons(); 
        await fetchRDAData(); 
        populateFilters(); 
        populateMobileFilters();
        renderDashboard(); 
        renderMobileDashboard();
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
    // SOLUCIÓN DEFINITIVA: La tabla registros_sis tiene RLS (Row Level Security)
    // lo que bloqueaba las lecturas desde el cliente y devolvía un array vacío siempre.
    // He creado una función RPC 'get_rda_max_mes' en la base de datos (SECURITY DEFINER)
    // que puentea el bloqueo y calcula el mes máximo instantáneamente en el servidor.
    const yearInt = parseInt(curYear, 10);
    const maxAllowedMes = (yearInt === new Date().getFullYear()) ? (new Date().getMonth() + 1) : 12;

    const { data: maxMesRpc, error: mesError } = await window.supabase
        .rpc('get_rda_max_mes', { p_anio: yearInt });

    if (mesError) throw mesError;

    let maxMes = parseInt(maxMesRpc, 10);
    if (isNaN(maxMes) || maxMes < 1) maxMes = 1;
    if (maxMes > maxAllowedMes) maxMes = maxAllowedMes;

    // 2. Consultar el stored procedure de Supabase (pre-agregación en BD)
    const { data: indicators, error: indError } = await window.supabase
        .rpc('get_rda_indicators', { p_anio: yearInt, p_max_mes: maxMes });

    if (indError) throw indError;

    console.log(`[RDA] Loaded ${yearInt} pre-aggregated indicators: ${indicators.length} records. Max Mes: ${maxMes}`);

    let filteredIndicators = (indicators || []).map(u => {
        if (u.nombre) {
            const upper = u.nombre.toUpperCase().trim();
            if (upper.includes("FELIPE NUÑEZ LARA") || upper.includes("NIÑO Y LA MUJER") || upper === "HENM") {
                u.nombre = "HENM";
            }
        }
        if (u.unidad) {
            const upper = u.unidad.toUpperCase().trim();
            if (upper.includes("FELIPE NUÑEZ LARA") || upper.includes("NIÑO Y LA MUJER") || upper === "HENM") {
                u.unidad = "HENM";
            }
        }
        return u;
    });
    if (typeof USER !== 'undefined' && USER?.rol === 'CARAVANAS') {
        filteredIndicators = filteredIndicators.filter(u => {
            const name = (u.unidad || u.nombre || '').toUpperCase().trim();
            return name.startsWith('FAM') || name.startsWith('UMME');
        });
    }

    _rdaCache.unidades = filteredIndicators;
    _rdaCache.registros = filteredIndicators;
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
    const allowed = (typeof USER !== 'undefined' && Array.isArray(USER?.municipiosAllowed)) ? USER.municipiosAllowed : [];

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

    if (role === 'ADMIN' || role === 'JURISDICCIONAL' || role === 'CARAVANAS') {
        muniSel.disabled = false;
        if (uniSel) uniSel.disabled = false;
        muniSel.innerHTML = '<option value="">Todos los municipios</option>' +
            municipios.map(m => `<option value="${m}">${m}</option>`).join('');
        muniSel.value = '';
        populateUnidadFilter();
    } else if (role === 'MUNICIPAL') {
        if (uniSel) uniSel.disabled = false;
        
        municipios = municipios.filter(m => {
            // Strip accents for safe comparison with allowed array
            const mNorm = m.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
            return allowed.some(a => mNorm.includes(a) || a.includes(mNorm));
        });
        
        muniSel.innerHTML = municipios.map(m => `<option value="${m}">${m}</option>`).join('');
        
        if (municipios.length === 1) {
            muniSel.value = municipios[0];
            muniSel.disabled = true;
        } else {
            muniSel.disabled = false;
            if (municipios.length > 0) {
                muniSel.value = municipios[0];
            }
        }
        
        // Explicitly populate CLUES with the chosen municipality DOM value
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
        .sort((a, b) => (a.clues || '').localeCompare(b.clues || ''));

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

    const toggleContainer = document.getElementById('rdaViewToggleContainer');
    if (toggleContainer) {
        toggleContainer.style.display = (esquema === 'basico') ? 'flex' : 'none';
    }

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
        // Campos de dosis adicionales para biológicos individuales
        hexa_1_dosis: 0, hexa_2_dosis: 0, neumo_1_dosis: 0,
        neumo_c1_dosis: 0, neumo_c2_dosis: 0, neumo_c3_dosis: 0, srp_1_dosis: 0,
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

        // Nuevos campos agregados
        agg.hexa_1_dosis += u.hexa_1_dosis || 0;
        agg.hexa_2_dosis += u.hexa_2_dosis || 0;
        agg.neumo_1_dosis += u.neumo_1_dosis || 0;
        agg.neumo_c1_dosis += u.neumo_c1_dosis || 0;
        agg.neumo_c2_dosis += u.neumo_c2_dosis || 0;
        agg.neumo_c3_dosis += u.neumo_c3_dosis || 0;
        agg.srp_1_dosis += u.srp_1_dosis || 0;
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
    agg.cobertura_uno = factorUno > 0 ? Math.round((((sumaDosisUno / 3.0) / factorUno) * 100) * 10) / 10 : 0;
    agg.cobertura_cuatro = factorCuatro > 0 ? Math.round(((sumaDosisCuatro / factorCuatro) * 100) * 10) / 10 : 0;

    // Coberturas por Biológico individual (Fórmulas RDA Oficiales)
    agg.cobertura_bcg = factorMenor1 > 0 ? Math.round(((agg.bcg_dosis) / factorMenor1 * 100) * 10) / 10 : 0;
    agg.cobertura_hepb = factorMenor1 > 0 ? Math.round(((agg.hepb_0_7_dosis) / factorMenor1 * 100) * 10) / 10 : 0;
    agg.cobertura_rota = factorMenor1 > 0 ? Math.round(((agg.rota_2_dosis) / factorMenor1 * 100) * 10) / 10 : 0;
    agg.cobertura_hexa_m1 = factorMenor1 > 0 ? Math.round(((agg.hexa_1_dosis + agg.hexa_2_dosis + agg.hexa_3_dosis) / factorMenor1 * 100) * 10) / 10 : 0;
    agg.cobertura_hexa_uno = factorUno > 0 ? Math.round(((agg.hexa_ref_dosis) / factorUno * 100) * 10) / 10 : 0;
    agg.cobertura_neumo_m1 = factorMenor1 > 0 ? Math.round(((agg.neumo_1_dosis + agg.neumo_2_dosis + agg.neumo_c1_dosis + agg.neumo_c2_dosis) / factorMenor1 * 100) * 10) / 10 : 0;
    agg.cobertura_neumo_uno = factorUno > 0 ? Math.round(((agg.neumo_ref_dosis + agg.neumo_c3_dosis) / factorUno * 100) * 10) / 10 : 0;
    agg.cobertura_srp = factorUno > 0 ? Math.round(((agg.srp_1_dosis + agg.srp_2_dosis) / factorUno * 100) * 10) / 10 : 0;
    agg.cobertura_dpt = factorCuatro > 0 ? Math.round(((agg.dpt_4_dosis) / factorCuatro * 100) * 10) / 10 : 0;

    // Renderizar componentes
    const isSingleUnit = fUnits.length === 1;
    const grid = document.getElementById('rdaAnalysisGrid');
    const doughnutContainer = document.getElementById('chartDoughnutContainer');
    
    if (!isSingleUnit && grid && doughnutContainer) {
        doughnutContainer.style.display = 'none';
        grid.style.gridTemplateColumns = '1fr 1fr';
    } else if (grid && doughnutContainer) {
        doughnutContainer.style.display = 'flex';
        grid.style.gridTemplateColumns = '350px 1fr';
    }

    renderKPIs(agg, esquema);
    if (isSingleUnit) {
        renderDoughnut(agg, esquema);
    }
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
                <span class="material-symbols-rounded premium-anim-icon">${k.icon}</span>
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
    let centerValue = '';
    let centerLabel = '';

    if (esquema === 'basico') {
        if (_rdaState.vistaBasico === 'biologico') {
            labels = ['BCG', 'HepB', 'Rota', 'Hexa <1A', 'Hexa 1A', 'Neumo <1A', 'Neumo 1A', 'SRP', 'DPT'];
            data = [agg.cobertura_bcg, agg.cobertura_hepb, agg.cobertura_rota, agg.cobertura_hexa_m1, agg.cobertura_hexa_uno, agg.cobertura_neumo_m1, agg.cobertura_neumo_uno, agg.cobertura_srp, agg.cobertura_dpt];
            backgroundColors = ['#A5CBE3', '#E8B2B2', '#93BCCD', '#CDE69A', '#9ACD32', '#ACAFC8', '#3D405B', '#F3B7CA', '#F3E0AF'];
        } else {
            labels = ['< 1 Año', '1 Año', '4 Años'];
            data = [agg.cobertura_menor1, agg.cobertura_uno, agg.cobertura_cuatro];
            backgroundColors = ['#0d9488', '#0284c7', '#7c3aed'];
        }
        const validCovs = data.filter(d => d > 0);
        const avg = validCovs.length ? Math.round(validCovs.reduce((a,b)=>a+b,0) / validCovs.length) : 0;
        centerValue = avg + '%';
        centerLabel = 'Promedio';
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

    if (esquema !== 'basico') {
        const sum = data.reduce((a,b) => a + (b||0), 0);
        centerValue = sum.toLocaleString();
        centerLabel = 'Total Dosis';
    }

    if (!_rdaCharts.d) {
        _rdaCharts.d = echarts.init(ctx);
    }
    
    let eData = [];
    for(let i=0; i<data.length; i++) {
        eData.push({ value: data[i], name: labels[i], itemStyle: { color: backgroundColors[i] } });
    }

    _rdaCharts.d.setOption({
        animationDuration: 1000,
        animationEasing: 'cubicOut',
        title: {
            text: centerValue,
            subtext: centerLabel,
            left: 'center',
            top: '40%',
            textStyle: { fontSize: 32, fontWeight: 800, color: '#0f172a', fontFamily: 'Inter, sans-serif' },
            subtextStyle: { fontSize: 12, fontWeight: 600, color: '#64748b', fontFamily: 'Inter, sans-serif' },
            itemGap: 4
        },
        tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            textStyle: { color: '#fff' },
            borderWidth: 0,
            borderRadius: 10
        },
        legend: {
            bottom: 0,
            icon: 'circle',
            itemGap: 15,
            textStyle: { color: '#64748b', fontWeight: 'bold' }
        },
        series: [{
            type: 'pie',
            radius: ['60%', '80%'],
            center: ['50%', '45%'],
            avoidLabelOverlap: false,
            itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
            label: { show: false },
            data: eData
        }]
    }, true);
}

// Chart.js Recycler: In-Place Horizontal Bar / Combo chart update
function renderBarChart(fUnits, muniFilter, esquema) {
    const ctx = document.getElementById('chartBar');
    const ctxTotal = document.getElementById('chartBarTotal');
    const totalContainer = document.getElementById('chartBarTotalContainer');
    
    if (!ctx) return;

    const titleEl = document.getElementById('chartBarTitle');
    const role = (typeof USER !== 'undefined' && USER?.rol) || 'UNIDAD';
    const maxMes = _rdaCache.maxMes || 12;

    const isSingleUnit = fUnits.length === 1;

    let labels = [];
    let finalDatasets = [];
    let isHorizontal = !isSingleUnit;
    let titleText = '';

    // Lógica para Total Jurisdiccional (oculto por defecto)
    if (totalContainer) totalContainer.style.display = 'none';

    if (isSingleUnit) {
        const currentYear = new Date().getFullYear();
        titleText = `Avance Anual ${currentYear}`;
        const u = fUnits[0];

        if (esquema === 'basico') {
            if (_rdaState.vistaBasico === 'biologico') {
                labels = ['BCG', 'HepB', 'Rota', 'Hexa <1A', 'Hexa 1A', 'Neumo <1A', 'Neumo 1A', 'SRP', 'DPT'];
                const factorM1 = (u.pob_menor_1 * 0.0833) * maxMes;
                const factorUno = (u.pob_1_ano * 0.0833) * maxMes;
                const factorCuatro = (u.pob_4_anos * 0.0833) * maxMes;

                const appBCG = u.bcg_dosis || 0;
                const appHepB = u.hepb_0_7_dosis || 0;
                const appRota = u.rota_2_dosis || 0;
                const appHexaM1 = (u.hexa_1_dosis||0) + (u.hexa_2_dosis||0) + (u.hexa_3_dosis||0);
                const appHexa1A = u.hexa_ref_dosis || 0;
                const appNeumoM1 = (u.neumo_1_dosis||0) + (u.neumo_2_dosis||0) + (u.neumo_c1_dosis||0) + (u.neumo_c2_dosis||0);
                const appNeumo1A = (u.neumo_ref_dosis||0) + (u.neumo_c3_dosis||0);
                const appSRP = (u.srp_1_dosis||0) + (u.srp_2_dosis||0);
                const appDPT = u.dpt_4_dosis || 0;

                const covBCG = factorM1 > 0 ? Math.round((appBCG / factorM1 * 100) * 10) / 10 : 0;
                const covHepB = factorM1 > 0 ? Math.round((appHepB / factorM1 * 100) * 10) / 10 : 0;
                const covRota = factorM1 > 0 ? Math.round((appRota / factorM1 * 100) * 10) / 10 : 0;
                const covHexaM1 = factorM1 > 0 ? Math.round((appHexaM1 / factorM1 * 100) * 10) / 10 : 0;
                const covHexa1A = factorUno > 0 ? Math.round((appHexa1A / factorUno * 100) * 10) / 10 : 0;
                const covNeumoM1 = factorM1 > 0 ? Math.round((appNeumoM1 / factorM1 * 100) * 10) / 10 : 0;
                const covNeumo1A = factorUno > 0 ? Math.round((appNeumo1A / factorUno * 100) * 10) / 10 : 0;
                const covSRP = factorUno > 0 ? Math.round((appSRP / factorUno * 100) * 10) / 10 : 0;
                const covDPT = factorCuatro > 0 ? Math.round((appDPT / factorCuatro * 100) * 10) / 10 : 0;

                finalDatasets = [
                    {
                        type: 'bar',
                        label: 'Aplicaciones',
                        data: [appBCG, appHepB, appRota, appHexaM1, appHexa1A, appNeumoM1, appNeumo1A, appSRP, appDPT],
                        backgroundColor: '#e2e8f0',
                        borderRadius: 4,
                        barPercentage: 0.7,
                        categoryPercentage: 0.8,
                        yAxisID: 'y',
                        order: 1
                    },
                    {
                        type: 'bar',
                        label: 'Meta',
                        data: [
                            Math.round(factorM1), Math.round(factorM1), Math.round(factorM1),
                            Math.round(factorM1), Math.round(factorUno),
                            Math.round(factorM1), Math.round(factorUno),
                            Math.round(factorUno), Math.round(factorCuatro)
                        ],
                        backgroundColor: '#0f172a',
                        borderRadius: 4,
                        barPercentage: 0.7,
                        categoryPercentage: 0.8,
                        yAxisID: 'y',
                        order: 1
                    },
                    {
                        type: 'line',
                        label: 'Avance',
                        data: [covBCG, covHepB, covRota, covHexaM1, covHexa1A, covNeumoM1, covNeumo1A, covSRP, covDPT],
                        borderColor: '#94a3b8',
                        borderWidth: 4,
                        tension: 0.4,
                        fill: false,
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: '#94a3b8',
                        pointBorderWidth: 2,
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        yAxisID: 'y1',
                        order: 0
                    }
                ];
            } else {
                labels = ['< 1 Año', '1 Año', '4 Años'];
                const factorM1 = (u.pob_menor_1 * 0.0833) * maxMes;
                const factorUno = (u.pob_1_ano * 0.0833) * maxMes;
                const factorCuatro = (u.pob_4_anos * 0.0833) * maxMes;

                const dosisM1 = (u.bcg_dosis||0) + (u.hepb_0_7_dosis||0) + (u.hexa_3_dosis||0) + (u.rota_2_dosis||0) + (u.neumo_2_dosis||0);
                const dosisUno = (u.hexa_ref_dosis||0) + (u.neumo_ref_dosis||0) + (u.srp_2_dosis||0);
                const dosisCuatro = u.dpt_4_dosis||0;

                const covM1 = factorM1 > 0 ? Math.round((((dosisM1 / 4.0) / factorM1) * 100) * 10) / 10 : 0;
                const covUno = factorUno > 0 ? Math.round((((dosisUno / 3.0) / factorUno) * 100) * 10) / 10 : 0;
                const covCuatro = factorCuatro > 0 ? Math.round(((dosisCuatro / factorCuatro) * 100) * 10) / 10 : 0;

                finalDatasets = [
                    {
                        type: 'bar',
                        label: 'Aplicaciones',
                        data: [Math.round(dosisM1/4.0), Math.round(dosisUno/3.0), dosisCuatro],
                        backgroundColor: '#e2e8f0',
                        borderRadius: 4,
                        barPercentage: 0.7,
                        categoryPercentage: 0.8,
                        yAxisID: 'y',
                        order: 1
                    },
                    {
                        type: 'bar',
                        label: 'Meta',
                        data: [Math.round(factorM1), Math.round(factorUno), Math.round(factorCuatro)],
                        backgroundColor: '#0f172a',
                        borderRadius: 4,
                        barPercentage: 0.7,
                        categoryPercentage: 0.8,
                        yAxisID: 'y',
                        order: 1
                    },
                    {
                        type: 'line',
                        label: 'Avance',
                        data: [covM1, covUno, covCuatro],
                        borderColor: '#94a3b8',
                        borderWidth: 4,
                        tension: 0.4,
                        fill: false,
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: '#94a3b8',
                        pointBorderWidth: 2,
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        yAxisID: 'y1',
                        order: 0
                    }
                ];
            }
        } else {
            labels = [''];
            if (esquema === 'adultos') {
                finalDatasets = [
                    { type: 'bar', label: 'HepB', data: [u.adol_hb||0], backgroundColor: '#c43d3d', borderRadius: 6, barThickness: 40 },
                    { type: 'bar', label: 'SR', data: [u.adol_sr||0], backgroundColor: '#7b5ea7', borderRadius: 6, barThickness: 40 },
                    { type: 'bar', label: 'VPH', data: [u.adol_vph||0], backgroundColor: '#2a9d8f', borderRadius: 6, barThickness: 40 },
                    { type: 'bar', label: 'Td', data: [u.adol_td||0], backgroundColor: '#9e9e9e', borderRadius: 6, barThickness: 40 },
                    { type: 'bar', label: 'Tdpa', data: [u.adol_tdpa||0], backgroundColor: '#e76f51', borderRadius: 6, barThickness: 40 }
                ];
            } else if (esquema === 'mayores') {
                finalDatasets = [
                    { type: 'bar', label: 'Neumo 13', data: [u.am_neumo13||0], backgroundColor: '#3d405b', borderRadius: 6, barThickness: 40 },
                    { type: 'bar', label: 'Neumo 20', data: [u.am_neumo20||0], backgroundColor: '#3d405b', borderRadius: 6, barThickness: 40 },
                    { type: 'bar', label: 'Td', data: [u.am_td||0], backgroundColor: '#9e9e9e', borderRadius: 6, barThickness: 40 }
                ];
            } else if (esquema === 'embarazadas') {
                finalDatasets = [
                    { type: 'bar', label: 'Tdpa', data: [u.emb_tdpa||0], backgroundColor: '#e76f51', borderRadius: 6, barThickness: 40 },
                    { type: 'bar', label: 'VSR', data: [u.emb_vsr||0], backgroundColor: '#d8b4a0', borderRadius: 6, barThickness: 40 }
                ];
            } else if (esquema === 'invernal') {
                finalDatasets = [
                    { type: 'bar', label: 'Influenza', data: [u.inv_influenza||0], backgroundColor: '#f1bdad', borderRadius: 6, barThickness: 40 },
                    { type: 'bar', label: 'COVID-19', data: [u.inv_covid||0], backgroundColor: '#4a4a4a', borderRadius: 6, barThickness: 40 }
                ];
            }
        }
    } else {
        let d1 = [], d2 = [], d3 = [], d4 = [], d5 = [], d6 = [], d7 = [], d8 = [], d9 = [];
        let datasetConfigs = [];
        if (esquema === 'basico') {
            if (_rdaState.vistaBasico === 'biologico') {
                datasetConfigs = [
                    { label: 'BCG', data: d1, backgroundColor: '#A5CBE3' },
                    { label: 'HepB', data: d2, backgroundColor: '#E8B2B2' },
                    { label: 'Rota', data: d3, backgroundColor: '#93BCCD' },
                    { label: 'Hexa <1A', data: d4, backgroundColor: '#CDE69A' },
                    { label: 'Hexa 1A', data: d5, backgroundColor: '#9ACD32' },
                    { label: 'Neumo <1A', data: d6, backgroundColor: '#ACAFC8' },
                    { label: 'Neumo 1A', data: d7, backgroundColor: '#3D405B' },
                    { label: 'SRP', data: d8, backgroundColor: '#F3B7CA' },
                    { label: 'DPT', data: d9, backgroundColor: '#F3E0AF' }
                ];
            } else {
                datasetConfigs = [
                    { label: '< 1 Año', data: d1, backgroundColor: '#0d9488' },
                    { label: '1 Año', data: d2, backgroundColor: '#0284c7' },
                    { label: '4 Años', data: d3, backgroundColor: '#7c3aed' }
                ];
            }
        } else if (esquema === 'adultos') {
            datasetConfigs = [
                { label: 'HepB', data: d1, backgroundColor: '#c43d3d' },
                { label: 'SR', data: d2, backgroundColor: '#7b5ea7' },
                { label: 'VPH', data: d3, backgroundColor: '#2a9d8f' },
                { label: 'Td', data: d4, backgroundColor: '#9e9e9e' },
                { label: 'Tdpa', data: d5, backgroundColor: '#e76f51' }
            ];
        } else if (esquema === 'mayores') {
            datasetConfigs = [
                { label: 'Neumo 13', data: d1, backgroundColor: '#3d405b' },
                { label: 'Neumo 20', data: d2, backgroundColor: '#3d405b' },
                { label: 'Td Mayores', data: d3, backgroundColor: '#9e9e9e' }
            ];
        } else if (esquema === 'embarazadas') {
            datasetConfigs = [
                { label: 'Tdpa', data: d1, backgroundColor: '#e76f51' },
                { label: 'VSR', data: d2, backgroundColor: '#d8b4a0' }
            ];
        } else if (esquema === 'invernal') {
            datasetConfigs = [
                { label: 'Influenza', data: d1, backgroundColor: '#f1bdad' },
                { label: 'COVID-19', data: d2, backgroundColor: '#4a4a4a' }
            ];
        }

        if (!muniFilter && (role === 'ADMIN' || role === 'JURISDICCIONAL')) {
            titleText = 'Análisis por Municipio';
            const munis = [...new Set(_rdaCache.unidades.map(u => (u.municipio || '').toUpperCase().trim()))].filter(Boolean).sort();
            for (const m of munis) {
                labels.push(m);
                const muniUnits = _rdaCache.unidades.filter(u => (u.municipio || '').toUpperCase().trim() === m);
                let mAgg = {
                    pob_menor_1: 0, pob_1_ano: 0, pob_4_anos: 0, bcg_dosis: 0, hepb_0_7_dosis: 0, hexa_3_dosis: 0, rota_2_dosis: 0, neumo_2_dosis: 0,
                    hexa_ref_dosis: 0, neumo_ref_dosis: 0, srp_2_dosis: 0, dpt_4_dosis: 0, adol_hb: 0, adol_sr: 0, adol_vph: 0, adol_td: 0, adol_tdpa: 0,
                    am_neumo13: 0, am_neumo20: 0, am_td: 0, emb_tdpa: 0, emb_vsr: 0, inv_influenza: 0, inv_covid: 0,
                    hexa_1_dosis: 0, hexa_2_dosis: 0, neumo_1_dosis: 0, neumo_c1_dosis: 0, neumo_c2_dosis: 0, neumo_c3_dosis: 0, srp_1_dosis: 0
                };
                for (const u of muniUnits) {
                    mAgg.pob_menor_1 += u.pob_menor_1 || 0; mAgg.pob_1_ano += u.pob_1_ano || 0; mAgg.pob_4_anos += u.pob_4_anos || 0;
                    mAgg.bcg_dosis += u.bcg_dosis || 0; mAgg.hepb_0_7_dosis += u.hepb_0_7_dosis || 0; mAgg.hexa_3_dosis += u.hexa_3_dosis || 0; mAgg.rota_2_dosis += u.rota_2_dosis || 0; mAgg.neumo_2_dosis += u.neumo_2_dosis || 0;
                    mAgg.hexa_ref_dosis += u.hexa_ref_dosis || 0; mAgg.neumo_ref_dosis += u.neumo_ref_dosis || 0; mAgg.srp_2_dosis += u.srp_2_dosis || 0; mAgg.dpt_4_dosis += u.dpt_4_dosis || 0;
                    mAgg.adol_hb += u.adol_hb || 0; mAgg.adol_sr += u.adol_sr || 0; mAgg.adol_vph += u.adol_vph || 0; mAgg.adol_td += u.adol_td || 0; mAgg.adol_tdpa += u.adol_tdpa || 0;
                    mAgg.am_neumo13 += u.am_neumo13 || 0; mAgg.am_neumo20 += u.am_neumo20 || 0; mAgg.am_td += u.am_td || 0;
                    mAgg.emb_tdpa += u.emb_tdpa || 0; mAgg.emb_vsr += u.emb_vsr || 0; mAgg.inv_influenza += u.inv_influenza || 0; mAgg.inv_covid += u.inv_covid || 0;
                    mAgg.hexa_1_dosis += u.hexa_1_dosis || 0; mAgg.hexa_2_dosis += u.hexa_2_dosis || 0; mAgg.neumo_1_dosis += u.neumo_1_dosis || 0;
                    mAgg.neumo_c1_dosis += u.neumo_c1_dosis || 0; mAgg.neumo_c2_dosis += u.neumo_c2_dosis || 0; mAgg.neumo_c3_dosis += u.neumo_c3_dosis || 0; mAgg.srp_1_dosis += u.srp_1_dosis || 0;
                }
                if (esquema === 'basico') {
                    const factorM1 = (mAgg.pob_menor_1 * 0.0833) * maxMes; const factorUno = (mAgg.pob_1_ano * 0.0833) * maxMes; const factorCuatro = (mAgg.pob_4_anos * 0.0833) * maxMes;
                    if (_rdaState.vistaBasico === 'biologico') {
                        d1.push(factorM1 > 0 ? Math.round(((mAgg.bcg_dosis) / factorM1 * 100) * 10) / 10 : 0);
                        d2.push(factorM1 > 0 ? Math.round(((mAgg.hepb_0_7_dosis) / factorM1 * 100) * 10) / 10 : 0);
                        d3.push(factorM1 > 0 ? Math.round(((mAgg.rota_2_dosis) / factorM1 * 100) * 10) / 10 : 0);
                        d4.push(factorM1 > 0 ? Math.round(((mAgg.hexa_1_dosis + mAgg.hexa_2_dosis + mAgg.hexa_3_dosis) / factorM1 * 100) * 10) / 10 : 0);
                        d5.push(factorUno > 0 ? Math.round(((mAgg.hexa_ref_dosis) / factorUno * 100) * 10) / 10 : 0);
                        d6.push(factorM1 > 0 ? Math.round(((mAgg.neumo_1_dosis + mAgg.neumo_2_dosis + mAgg.neumo_c1_dosis + mAgg.neumo_c2_dosis) / factorM1 * 100) * 10) / 10 : 0);
                        d7.push(factorUno > 0 ? Math.round(((mAgg.neumo_ref_dosis + mAgg.neumo_c3_dosis) / factorUno * 100) * 10) / 10 : 0);
                        d8.push(factorUno > 0 ? Math.round(((mAgg.srp_1_dosis + mAgg.srp_2_dosis) / factorUno * 100) * 10) / 10 : 0);
                        d9.push(factorCuatro > 0 ? Math.round(((mAgg.dpt_4_dosis) / factorCuatro * 100) * 10) / 10 : 0);
                    } else {
                        const dosisM1 = mAgg.bcg_dosis + mAgg.hepb_0_7_dosis + mAgg.hexa_3_dosis + mAgg.rota_2_dosis + mAgg.neumo_2_dosis;
                        const dosisUno = mAgg.hexa_ref_dosis + mAgg.neumo_ref_dosis + mAgg.srp_2_dosis; const dosisCuatro = mAgg.dpt_4_dosis;
                        d1.push(factorM1 > 0 ? Math.round((((dosisM1 / 4.0) / factorM1) * 100) * 10) / 10 : 0);
                        d2.push(factorUno > 0 ? Math.round((((dosisUno / 3.0) / factorUno) * 100) * 10) / 10 : 0);
                        d3.push(factorCuatro > 0 ? Math.round(((dosisCuatro / factorCuatro) * 100) * 10) / 10 : 0);
                    }
                } else if (esquema === 'adultos') { d1.push(mAgg.adol_hb); d2.push(mAgg.adol_sr); d3.push(mAgg.adol_vph); d4.push(mAgg.adol_td); d5.push(mAgg.adol_tdpa);
                } else if (esquema === 'mayores') { d1.push(mAgg.am_neumo13); d2.push(mAgg.am_neumo20); d3.push(mAgg.am_td);
                } else if (esquema === 'embarazadas') { d1.push(mAgg.emb_tdpa); d2.push(mAgg.emb_vsr);
                } else if (esquema === 'invernal') { d1.push(mAgg.inv_influenza); d2.push(mAgg.inv_covid); }
            }
        } else {
            titleText = 'Top 10 Unidades';
            const results = fUnits.map(u => {
                const res = { clues: u.clues, nombre: u.nombre };
                if (esquema === 'basico') {
                    const factorM1 = (u.pob_menor_1 * 0.0833) * maxMes; const factorUno = (u.pob_1_ano * 0.0833) * maxMes; const factorCuatro = (u.pob_4_anos * 0.0833) * maxMes;
                    if (_rdaState.vistaBasico === 'biologico') {
                        res.v1 = factorM1 > 0 ? Math.round(((u.bcg_dosis) / factorM1 * 100) * 10) / 10 : 0;
                        res.v2 = factorM1 > 0 ? Math.round(((u.hepb_0_7_dosis) / factorM1 * 100) * 10) / 10 : 0;
                        res.v3 = factorM1 > 0 ? Math.round(((u.rota_2_dosis) / factorM1 * 100) * 10) / 10 : 0;
                        res.v4 = factorM1 > 0 ? Math.round(((u.hexa_1_dosis + u.hexa_2_dosis + u.hexa_3_dosis) / factorM1 * 100) * 10) / 10 : 0;
                        res.v5 = factorUno > 0 ? Math.round(((u.hexa_ref_dosis) / factorUno * 100) * 10) / 10 : 0;
                        res.v6 = factorM1 > 0 ? Math.round(((u.neumo_1_dosis + u.neumo_2_dosis + u.neumo_c1_dosis + u.neumo_c2_dosis) / factorM1 * 100) * 10) / 10 : 0;
                        res.v7 = factorUno > 0 ? Math.round(((u.neumo_ref_dosis + u.neumo_c3_dosis) / factorUno * 100) * 10) / 10 : 0;
                        res.v8 = factorUno > 0 ? Math.round(((u.srp_1_dosis + u.srp_2_dosis) / factorUno * 100) * 10) / 10 : 0;
                        res.v9 = factorCuatro > 0 ? Math.round(((u.dpt_4_dosis) / factorCuatro * 100) * 10) / 10 : 0;
                        res.sortVal = (res.v1 + res.v2 + res.v3 + res.v4 + res.v5 + res.v6 + res.v7 + res.v8 + res.v9) / 9.0;
                    } else {
                        const dosisM1 = (u.bcg_dosis||0) + (u.hepb_0_7_dosis||0) + (u.hexa_3_dosis||0) + (u.rota_2_dosis||0) + (u.neumo_2_dosis||0);
                        const dosisUno = (u.hexa_ref_dosis||0) + (u.neumo_ref_dosis||0) + (u.srp_2_dosis||0); const dosisCuatro = u.dpt_4_dosis||0;
                        res.v1 = factorM1 > 0 ? Math.round((((dosisM1 / 4.0) / factorM1) * 100) * 10) / 10 : 0;
                        res.v2 = factorUno > 0 ? Math.round((((dosisUno / 3.0) / factorUno) * 100) * 10) / 10 : 0;
                        res.v3 = factorCuatro > 0 ? Math.round(((dosisCuatro / factorCuatro) * 100) * 10) / 10 : 0;
                        res.sortVal = res.v1;
                    }
                } else if (esquema === 'adultos') { res.v1 = u.adol_hb || 0; res.v2 = u.adol_sr || 0; res.v3 = u.adol_vph || 0; res.v4 = u.adol_td || 0; res.v5 = u.adol_tdpa || 0; res.sortVal = res.v1 + res.v2 + res.v3 + res.v4 + res.v5;
                } else if (esquema === 'mayores') { res.v1 = u.am_neumo13 || 0; res.v2 = u.am_neumo20 || 0; res.v3 = u.am_td || 0; res.sortVal = res.v1 + res.v2 + res.v3;
                } else if (esquema === 'embarazadas') { res.v1 = u.emb_tdpa || 0; res.v2 = u.emb_vsr || 0; res.sortVal = res.v1 + res.v2;
                } else if (esquema === 'invernal') { res.v1 = u.inv_influenza || 0; res.v2 = u.inv_covid || 0; res.sortVal = res.v1 + res.v2; }
                return res;
            }).sort((a, b) => b.sortVal - a.sortVal).slice(0, 10);

            for (const r of results) {
                labels.push((r.nombre || r.clues).substring(0, 20));
                d1.push(r.v1 || 0); d2.push(r.v2 || 0); d3.push(r.v3 || 0);
                if (r.v4 !== undefined) d4.push(r.v4);
                if (r.v5 !== undefined) d5.push(r.v5);
                if (r.v6 !== undefined) d6.push(r.v6);
                if (r.v7 !== undefined) d7.push(r.v7);
                if (r.v8 !== undefined) d8.push(r.v8);
                if (r.v9 !== undefined) d9.push(r.v9);
            }
        }
        finalDatasets = datasetConfigs.map((cfg) => ({ label: cfg.label, data: cfg.data, backgroundColor: cfg.backgroundColor, borderRadius: 6, barThickness: 12 }));

        // Renderizar Total Jurisdiccional o Municipal (Suma de TODAS las unidades en fUnits)
        if (totalContainer && ctxTotal) {
            totalContainer.style.display = 'flex';
            const titleElTotal = document.getElementById('chartBarTotalTitle');
            if (titleElTotal) titleElTotal.textContent = muniFilter ? 'Avance Municipal Total' : 'Avance Jurisdiccional Total';
            
            let tAgg = {
                pob_menor_1: 0, pob_1_ano: 0, pob_4_anos: 0, bcg_dosis: 0, hepb_0_7_dosis: 0, hexa_3_dosis: 0, rota_2_dosis: 0, neumo_2_dosis: 0,
                hexa_ref_dosis: 0, neumo_ref_dosis: 0, srp_2_dosis: 0, dpt_4_dosis: 0, adol_hb: 0, adol_sr: 0, adol_vph: 0, adol_td: 0, adol_tdpa: 0,
                am_neumo13: 0, am_neumo20: 0, am_td: 0, emb_tdpa: 0, emb_vsr: 0, inv_influenza: 0, inv_covid: 0,
                hexa_1_dosis: 0, hexa_2_dosis: 0, neumo_1_dosis: 0, neumo_c1_dosis: 0, neumo_c2_dosis: 0, neumo_c3_dosis: 0, srp_1_dosis: 0
            };
            for (const u of fUnits) {
                tAgg.pob_menor_1 += u.pob_menor_1 || 0; tAgg.pob_1_ano += u.pob_1_ano || 0; tAgg.pob_4_anos += u.pob_4_anos || 0;
                tAgg.bcg_dosis += u.bcg_dosis || 0; tAgg.hepb_0_7_dosis += u.hepb_0_7_dosis || 0; tAgg.hexa_3_dosis += u.hexa_3_dosis || 0; tAgg.rota_2_dosis += u.rota_2_dosis || 0; tAgg.neumo_2_dosis += u.neumo_2_dosis || 0;
                tAgg.hexa_ref_dosis += u.hexa_ref_dosis || 0; tAgg.neumo_ref_dosis += u.neumo_ref_dosis || 0; tAgg.srp_2_dosis += u.srp_2_dosis || 0; tAgg.dpt_4_dosis += u.dpt_4_dosis || 0;
                tAgg.adol_hb += u.adol_hb || 0; tAgg.adol_sr += u.adol_sr || 0; tAgg.adol_vph += u.adol_vph || 0; tAgg.adol_td += u.adol_td || 0; tAgg.adol_tdpa += u.adol_tdpa || 0;
                tAgg.am_neumo13 += u.am_neumo13 || 0; tAgg.am_neumo20 += u.am_neumo20 || 0; tAgg.am_td += u.am_td || 0;
                tAgg.emb_tdpa += u.emb_tdpa || 0; tAgg.emb_vsr += u.emb_vsr || 0; tAgg.inv_influenza += u.inv_influenza || 0; tAgg.inv_covid += u.inv_covid || 0;
                tAgg.hexa_1_dosis += u.hexa_1_dosis || 0; tAgg.hexa_2_dosis += u.hexa_2_dosis || 0; tAgg.neumo_1_dosis += u.neumo_1_dosis || 0;
                tAgg.neumo_c1_dosis += u.neumo_c1_dosis || 0; tAgg.neumo_c2_dosis += u.neumo_c2_dosis || 0; tAgg.neumo_c3_dosis += u.neumo_c3_dosis || 0; tAgg.srp_1_dosis += u.srp_1_dosis || 0;
            }
            
            let tLabels = [];
            let tDatasets = [];
            let tOptions = {
                responsive: true, maintainAspectRatio: false,
                devicePixelRatio: 3,
                animation: { duration: 1000, easing: 'easeOutQuart' },
                plugins: { legend: { display: true, position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle' } }, tooltip: { backgroundColor: '#0f172a', padding: 12, cornerRadius: 10, mode: 'index', intersect: false } },
                scales: { x: { ticks: { color: '#0f172a', font: { size: 12, weight: '800' } }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: '#94a3b8', font: { size: 11, weight: '600' } }, grid: { color: '#f1f5f9', borderDash: [5,5] } } }
            };

            if (esquema === 'basico') {
                if (_rdaState.vistaBasico === 'biologico') {
                    tLabels = ['BCG', 'HepB', 'Rota', 'Hexa <1A', 'Hexa 1A', 'Neumo <1A', 'Neumo 1A', 'SRP', 'DPT'];
                    const factorM1 = (tAgg.pob_menor_1 * 0.0833) * maxMes;
                    const factorUno = (tAgg.pob_1_ano * 0.0833) * maxMes;
                    const factorCuatro = (tAgg.pob_4_anos * 0.0833) * maxMes;

                    const appBCG = tAgg.bcg_dosis || 0;
                    const appHepB = tAgg.hepb_0_7_dosis || 0;
                    const appRota = tAgg.rota_2_dosis || 0;
                    const appHexaM1 = (tAgg.hexa_1_dosis||0) + (tAgg.hexa_2_dosis||0) + (tAgg.hexa_3_dosis||0);
                    const appHexa1A = tAgg.hexa_ref_dosis || 0;
                    const appNeumoM1 = (tAgg.neumo_1_dosis||0) + (tAgg.neumo_2_dosis||0) + (tAgg.neumo_c1_dosis||0) + (tAgg.neumo_c2_dosis||0);
                    const appNeumo1A = (tAgg.neumo_ref_dosis||0) + (tAgg.neumo_c3_dosis||0);
                    const appSRP = (tAgg.srp_1_dosis||0) + (tAgg.srp_2_dosis||0);
                    const appDPT = tAgg.dpt_4_dosis || 0;

                    const covBCG = factorM1 > 0 ? Math.round((appBCG / factorM1 * 100) * 10) / 10 : 0;
                    const covHepB = factorM1 > 0 ? Math.round((appHepB / factorM1 * 100) * 10) / 10 : 0;
                    const covRota = factorM1 > 0 ? Math.round((appRota / factorM1 * 100) * 10) / 10 : 0;
                    const covHexaM1 = factorM1 > 0 ? Math.round((appHexaM1 / factorM1 * 100) * 10) / 10 : 0;
                    const covHexa1A = factorUno > 0 ? Math.round((appHexa1A / factorUno * 100) * 10) / 10 : 0;
                    const covNeumoM1 = factorM1 > 0 ? Math.round((appNeumoM1 / factorM1 * 100) * 10) / 10 : 0;
                    const covNeumo1A = factorUno > 0 ? Math.round((appNeumo1A / factorUno * 100) * 10) / 10 : 0;
                    const covSRP = factorUno > 0 ? Math.round((appSRP / factorUno * 100) * 10) / 10 : 0;
                    const covDPT = factorCuatro > 0 ? Math.round((appDPT / factorCuatro * 100) * 10) / 10 : 0;

                    tDatasets = [
                        {
                            type: 'bar',
                            label: 'Aplicaciones',
                            data: [appBCG, appHepB, appRota, appHexaM1, appHexa1A, appNeumoM1, appNeumo1A, appSRP, appDPT],
                            backgroundColor: '#e2e8f0',
                            borderRadius: 4,
                            barPercentage: 0.7,
                            categoryPercentage: 0.8,
                            yAxisID: 'y',
                            order: 1
                        },
                        {
                            type: 'bar',
                            label: 'Meta',
                            data: [
                                Math.round(factorM1), Math.round(factorM1), Math.round(factorM1),
                                Math.round(factorM1), Math.round(factorUno),
                                Math.round(factorM1), Math.round(factorUno),
                                Math.round(factorUno), Math.round(factorCuatro)
                            ],
                            backgroundColor: '#0f172a',
                            borderRadius: 4,
                            barPercentage: 0.7,
                            categoryPercentage: 0.8,
                            yAxisID: 'y',
                            order: 1
                        },
                        {
                            type: 'line',
                            label: 'Avance',
                            data: [covBCG, covHepB, covRota, covHexaM1, covHexa1A, covNeumoM1, covNeumo1A, covSRP, covDPT],
                            borderColor: '#94a3b8',
                            borderWidth: 4,
                            tension: 0.4,
                            fill: false,
                            pointBackgroundColor: '#ffffff',
                            pointBorderColor: '#94a3b8',
                            pointBorderWidth: 2,
                            pointRadius: 6,
                            pointHoverRadius: 8,
                            yAxisID: 'y1',
                            order: 0
                        }
                    ];
                } else {
                    tLabels = ['< 1 Año', '1 Año', '4 Años'];
                    const factorM1 = (tAgg.pob_menor_1 * 0.0833) * maxMes; const factorUno = (tAgg.pob_1_ano * 0.0833) * maxMes; const factorCuatro = (tAgg.pob_4_anos * 0.0833) * maxMes;
                    const dosisM1 = tAgg.bcg_dosis + tAgg.hepb_0_7_dosis + tAgg.hexa_3_dosis + tAgg.rota_2_dosis + tAgg.neumo_2_dosis;
                    const dosisUno = tAgg.hexa_ref_dosis + tAgg.neumo_ref_dosis + tAgg.srp_2_dosis; const dosisCuatro = tAgg.dpt_4_dosis;
                    let covM1 = factorM1 > 0 ? Math.round((((dosisM1 / 4.0) / factorM1) * 100) * 10) / 10 : 0;
                    let covUno = factorUno > 0 ? Math.round((((dosisUno / 3.0) / factorUno) * 100) * 10) / 10 : 0;
                    let covCuatro = factorCuatro > 0 ? Math.round(((dosisCuatro / factorCuatro) * 100) * 10) / 10 : 0;
                    
                    tDatasets = [
                        { type: 'bar', label: 'Aplicaciones', data: [Math.round(dosisM1/4.0), Math.round(dosisUno/3.0), dosisCuatro], backgroundColor: '#e2e8f0', borderRadius: 4, barPercentage: 0.7, categoryPercentage: 0.8, yAxisID: 'y', order: 1 },
                        { type: 'bar', label: 'Meta', data: [Math.round(factorM1), Math.round(factorUno), Math.round(factorCuatro)], backgroundColor: '#0f172a', borderRadius: 4, barPercentage: 0.7, categoryPercentage: 0.8, yAxisID: 'y', order: 1 },
                        { type: 'line', label: 'Avance', data: [covM1, covUno, covCuatro], borderColor: '#94a3b8', borderWidth: 4, tension: 0.4, fill: false, pointBackgroundColor: '#ffffff', pointBorderColor: '#94a3b8', pointBorderWidth: 2, pointRadius: 6, pointHoverRadius: 8, yAxisID: 'y1', order: 0 }
                    ];
                }
                tOptions.scales.y1 = { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#64748b', callback: v => v + '%' } };
            } else {
                tLabels = [''];
                if (esquema === 'adultos') {
                    tDatasets = [
                        { type: 'bar', label: 'HepB', data: [tAgg.adol_hb], backgroundColor: '#c43d3d', borderRadius: 6, barThickness: 40 },
                        { type: 'bar', label: 'SR', data: [tAgg.adol_sr], backgroundColor: '#7b5ea7', borderRadius: 6, barThickness: 40 },
                        { type: 'bar', label: 'VPH', data: [tAgg.adol_vph], backgroundColor: '#2a9d8f', borderRadius: 6, barThickness: 40 },
                        { type: 'bar', label: 'Td', data: [tAgg.adol_td], backgroundColor: '#9e9e9e', borderRadius: 6, barThickness: 40 },
                        { type: 'bar', label: 'Tdpa', data: [tAgg.adol_tdpa], backgroundColor: '#e76f51', borderRadius: 6, barThickness: 40 }
                    ];
                } else if (esquema === 'mayores') {
                    tDatasets = [
                        { type: 'bar', label: 'Neumo 13', data: [tAgg.am_neumo13], backgroundColor: '#3d405b', borderRadius: 6, barThickness: 40 },
                        { type: 'bar', label: 'Neumo 20', data: [tAgg.am_neumo20], backgroundColor: '#3d405b', borderRadius: 6, barThickness: 40 },
                        { type: 'bar', label: 'Td', data: [tAgg.am_td], backgroundColor: '#9e9e9e', borderRadius: 6, barThickness: 40 }
                    ];
                } else if (esquema === 'embarazadas') {
                    tDatasets = [
                        { type: 'bar', label: 'Tdpa', data: [tAgg.emb_tdpa], backgroundColor: '#e76f51', borderRadius: 6, barThickness: 40 },
                        { type: 'bar', label: 'VSR', data: [tAgg.emb_vsr], backgroundColor: '#d8b4a0', borderRadius: 6, barThickness: 40 }
                    ];
                } else if (esquema === 'invernal') {
                    tDatasets = [
                        { type: 'bar', label: 'Influenza', data: [tAgg.inv_influenza], backgroundColor: '#f1bdad', borderRadius: 6, barThickness: 40 },
                        { type: 'bar', label: 'COVID-19', data: [tAgg.inv_covid], backgroundColor: '#4a4a4a', borderRadius: 6, barThickness: 40 }
                    ];
                }
            }

            if (!_rdaCharts.total) _rdaCharts.total = echarts.init(ctxTotal);
            let eSeries = tDatasets.map(ds => {
                let series = { name: ds.label, type: ds.type || 'bar', data: ds.data };
                if (series.type === 'bar') {
                    series.itemStyle = { color: ds.backgroundColor, borderRadius: [4, 4, 0, 0] };
                    if (ds.yAxisID === 'y1') series.yAxisIndex = 1;
                } else if (series.type === 'line') {
                    series.color = ds.backgroundColor || ds.borderColor || '#94a3b8';
                    series.lineStyle = { color: ds.borderColor, width: ds.borderWidth || 3 };
                    series.itemStyle = { color: ds.pointBackgroundColor || ds.borderColor };
                    series.symbol = 'circle';
                    series.symbolSize = 8;
                    if (ds.yAxisID === 'y1') series.yAxisIndex = 1;
                }
                return series;
            });
            _rdaCharts.total.resize();
            _rdaCharts.total.setOption({
                animationDuration: 1000,
                animationEasing: 'cubicOut',
                tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(15, 23, 42, 0.9)', textStyle: { color: '#fff', fontFamily: 'Inter, sans-serif' }, borderWidth: 0, borderRadius: 12 },
                legend: { bottom: 0, icon: 'circle', textStyle: { fontFamily: 'Inter, sans-serif', color: '#64748b', fontWeight: 'bold' } },
                grid: { left: '2%', right: '2%', bottom: '15%', top: '15%', containLabel: true },
                xAxis: { type: 'category', data: tLabels, axisLabel: { color: '#0f172a', fontWeight: 'bold', fontFamily: 'Inter, sans-serif' }, axisLine: { lineStyle: { color: '#e2e8f0' } } },
                yAxis: [
                    { type: 'value', axisLabel: { color: '#94a3b8', fontFamily: 'Inter, sans-serif' }, splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } } },
                    { type: 'value', axisLabel: { color: '#64748b', formatter: '{value}%', fontFamily: 'Inter, sans-serif' }, splitLine: { show: false } }
                ],
                series: eSeries
            }, true);
        }
    }


    if (titleEl) titleEl.textContent = titleText;

    if (!_rdaCharts.b) _rdaCharts.b = echarts.init(ctx);

    let eSeries = finalDatasets.map(ds => {
        let series = { name: ds.label, type: ds.type || 'bar', data: ds.data };
        if (series.type === 'bar') {
            series.itemStyle = { color: ds.backgroundColor, borderRadius: isHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] };
            if (ds.yAxisID === 'y1') series.yAxisIndex = 1;
        } else if (series.type === 'line') {
            series.color = ds.backgroundColor || ds.borderColor || '#94a3b8';
            series.lineStyle = { color: ds.borderColor, width: ds.borderWidth || 3 };
            series.itemStyle = { color: ds.pointBackgroundColor || ds.borderColor };
            series.symbol = 'circle';
            series.symbolSize = 8;
            if (ds.yAxisID === 'y1') series.yAxisIndex = 1;
        }
        return series;
    });

    let eOptions = {
        animationDuration: 1000,
        animationEasing: 'cubicOut',
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(15, 23, 42, 0.9)', textStyle: { color: '#fff', fontFamily: 'Inter, sans-serif' }, borderWidth: 0, borderRadius: 12 },
        legend: { bottom: 0, icon: 'circle', show: isSingleUnit || isHorizontal, textStyle: { fontFamily: 'Inter, sans-serif', color: '#64748b', fontWeight: 'bold' } },
        grid: { left: '2%', right: '2%', bottom: '15%', top: '15%', containLabel: true },
        xAxis: isHorizontal ? { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } }, axisLabel: { fontFamily: 'Inter, sans-serif' } } : { type: 'category', data: labels, axisLabel: { color: '#0f172a', fontWeight: 'bold', fontFamily: 'Inter, sans-serif' }, axisLine: { lineStyle: { color: '#e2e8f0' } } },
        yAxis: isHorizontal ? { type: 'category', data: labels, axisLabel: { color: '#0f172a', fontWeight: 'bold', fontFamily: 'Inter, sans-serif' }, inverse: true, axisLine: { lineStyle: { color: '#e2e8f0' } } } : [
            { type: 'value', axisLabel: { color: '#94a3b8', fontFamily: 'Inter, sans-serif' }, splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } } },
            { type: 'value', axisLabel: { color: '#64748b', formatter: '{value}%', fontFamily: 'Inter, sans-serif' }, splitLine: { show: false } }
        ],
        series: eSeries
    };

    _rdaCharts.b.resize();
    _rdaCharts.b.setOption(eOptions, true);

    // Ensure ECharts resizes when window resizes
    if (!window._rdaEchartsResizeAttached) {
        window.addEventListener('resize', () => {
            if (_rdaCharts.b) _rdaCharts.b.resize();
            if (_rdaCharts.total) _rdaCharts.total.resize();
            if (_rdaCharts.d) _rdaCharts.d.resize();
        });
        window._rdaEchartsResizeAttached = true;
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
        if (_rdaState.vistaBasico === 'biologico') {
            vCols = [
                { n: 'BCG', s: 'v1' },
                { n: 'HepB', s: 'v2' },
                { n: 'Rota', s: 'v3' },
                { n: 'Hexa <1A', s: 'v4' },
                { n: 'Hexa 1A', s: 'v5' },
                { n: 'Neumo <1A', s: 'v6' },
                { n: 'Neumo 1A', s: 'v7' },
                { n: 'SRP', s: 'v8' },
                { n: 'DPT', s: 'v9' }
            ];
        } else {
            vCols = [{ n: '< 1 Año', s: 'v1' }, { n: '1 Año', s: 'v2' }, { n: '4 Años', s: 'v3' }];
        }
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

            if (_rdaState.vistaBasico === 'biologico') {
                res.v1 = factorM1 > 0 ? Math.round(((u.bcg_dosis) / factorM1 * 100) * 10) / 10 : 0;
                res.v2 = factorM1 > 0 ? Math.round(((u.hepb_0_7_dosis) / factorM1 * 100) * 10) / 10 : 0;
                res.v3 = factorM1 > 0 ? Math.round(((u.rota_2_dosis) / factorM1 * 100) * 10) / 10 : 0;
                res.v4 = factorM1 > 0 ? Math.round(((u.hexa_1_dosis + u.hexa_2_dosis + u.hexa_3_dosis) / factorM1 * 100) * 10) / 10 : 0;
                res.v5 = factorUno > 0 ? Math.round(((u.hexa_ref_dosis) / factorUno * 100) * 10) / 10 : 0;
                res.v6 = factorM1 > 0 ? Math.round(((u.neumo_1_dosis + u.neumo_2_dosis + u.neumo_c1_dosis + u.neumo_c2_dosis) / factorM1 * 100) * 10) / 10 : 0;
                res.v7 = factorUno > 0 ? Math.round(((u.neumo_ref_dosis + u.neumo_c3_dosis) / factorUno * 100) * 10) / 10 : 0;
                res.v8 = factorUno > 0 ? Math.round(((u.srp_1_dosis + u.srp_2_dosis) / factorUno * 100) * 10) / 10 : 0;
                res.v9 = factorCuatro > 0 ? Math.round(((u.dpt_4_dosis) / factorCuatro * 100) * 10) / 10 : 0;
                res.dosis = (u.bcg_dosis || 0) + (u.hepb_0_7_dosis || 0) + (u.hexa_1_dosis || 0) + (u.hexa_2_dosis || 0) + (u.hexa_3_dosis || 0) + (u.rota_2_dosis || 0) + (u.neumo_1_dosis || 0) + (u.neumo_2_dosis || 0) + (u.neumo_c1_dosis || 0) + (u.neumo_c2_dosis || 0) + (u.hexa_ref_dosis || 0) + (u.neumo_ref_dosis || 0) + (u.neumo_c3_dosis || 0) + (u.srp_1_dosis || 0) + (u.srp_2_dosis || 0) + (u.dpt_4_dosis || 0);
            } else {
                const dosisM1 = (u.bcg_dosis || 0) + (u.hepb_0_7_dosis || 0) + (u.hexa_3_dosis || 0) + (u.rota_2_dosis || 0) + (u.neumo_2_dosis || 0);
                const dosisUno = (u.hexa_ref_dosis || 0) + (u.neumo_ref_dosis || 0) + (u.srp_2_dosis || 0);
                const dosisCuatro = u.dpt_4_dosis || 0;

                res.v1 = factorM1 > 0 ? Math.round((((dosisM1 / 4.0) / factorM1) * 100) * 10) / 10 : 0;
                res.v2 = factorUno > 0 ? Math.round((((dosisUno / 3.0) / factorUno) * 100) * 10) / 10 : 0;
                res.v3 = factorCuatro > 0 ? Math.round(((dosisCuatro / factorCuatro) * 100) * 10) / 10 : 0;
                res.dosis = dosisM1 + dosisUno + dosisCuatro;
            }
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
    } else {
        rows.sort((a, b) => {
            const mCmp = (a.municipio || '').localeCompare(b.municipio || '');
            if (mCmp !== 0) return mCmp;
            return (a.clues || '').localeCompare(b.clues || '');
        });
    }

    if (countEl) countEl.textContent = `${rows.length} unidades`;
    
    const badge = (v, vName) => {
        if (esquema !== 'basico') {
            let bg = '#e2e8f0';
            let fg = '#0f172a';
            const nameMap = {
                'BCG': { bg: '#A5CBE3', fg: '#3A86B7' },
                'HepB': { bg: '#E8B2B2', fg: '#C43D3D' },
                'Hexavalente': { bg: '#CDE69A', fg: '#9ACD32' },
                'Rotavirus': { bg: '#93BCCD', fg: '#264653' },
                'Neumo 13': { bg: '#ACAFC8', fg: '#3D405B' },
                'Neumo 20': { bg: '#ACAFC8', fg: '#3D405B' },
                'SRP': { bg: '#F3B7CA', fg: '#B23A48' },
                'DPT': { bg: '#F3E0AF', fg: '#E9C46A' },
                'Influenza': { bg: '#F4CBBE', fg: '#C26750' },
                'VPH': { bg: '#A4E6DE', fg: '#2A9D8F' },
                'Td': { bg: '#C0C0C0', fg: '#5C5C5C' },
                'Td Mayores': { bg: '#C0C0C0', fg: '#5C5C5C' },
                'Tdpa': { bg: '#F3B9AB', fg: '#E76F51' },
                'SR': { bg: '#C1B3D5', fg: '#7B5EA7' },
                'Varicela': { bg: '#BEE4DC', fg: '#8ED1C2' },
                'VSR': { bg: '#EBD8CD', fg: '#A66B50' },
                'COVID-19': { bg: '#BCBCBC', fg: '#4A4A4A' },
                'HepA': { bg: '#DBDBDB', fg: '#BDBDBD' }
            };
            if (vName && nameMap[vName]) {
                bg = nameMap[vName].bg;
                fg = nameMap[vName].fg;
            }
            return `<span style="display:inline-block;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:800;background:${bg};color:${fg}">${v.toLocaleString('es-MX')}</span>`;
        }
        const bg = v >= 80 ? '#dcfce7' : v >= 50 ? '#fef3c7' : '#fee2e2';
        const fg = v >= 80 ? '#166534' : v >= 50 ? '#92400e' : '#991b1b';
        return `<span style="display:inline-block;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:800;background:${bg};color:${fg}">${v}%</span>`;
    };

    let html = '';
    let currentMuni = null;
    const totalCols = 4 + vCols.length + (showMeta ? 1 : 0);

    rows.forEach(r => {
        const muni = (r.municipio || 'Sin Municipio').toUpperCase();
        if (!_rdaState.sortCol && muni !== currentMuni && fUnits.length > 1) {
            html += `<tr><td colspan="${totalCols}" style="padding:12px 24px; background-color:#f8fafc; font-size:12px; font-weight:800; color:#334155; text-transform:uppercase; letter-spacing:0.05em; border-bottom:2px solid #e2e8f0; border-top:2px solid #e2e8f0;">${muni}</td></tr>`;
            currentMuni = muni;
        }
        html += `
        <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:16px 24px;font-size:11px;font-weight:700;color:#64748b;">${r.clues}</td>
            <td style="padding:16px 24px;font-size:11px;font-weight:800;color:#0f172a">${r.nombre}</td>
            <td style="padding:16px 24px;font-size:11px;color:#64748b;font-weight:600;">${r.municipio}</td>
            ${vCols.map(c => `<td style="padding:8px 12px;text-align:center">${badge(r[c.s], c.n)}</td>`).join('')}
            ${showMeta ? `<td style="padding:16px 24px;text-align:center;font-size:11px;font-weight:800;color:#64748b">${r.pob.toLocaleString('es-MX')}</td>` : ''}
            <td style="padding:16px 24px;text-align:center;font-size:11px;font-weight:800;color:#0f172a">${r.dosis.toLocaleString('es-MX')}</td>
        </tr>`;
    });

    tbody.innerHTML = rows.length === 0
        ? `<tr><td colspan="${totalCols}" style="padding:40px;text-align:center;color:#94a3b8;font-weight:600;">Sin datos</td></tr>`
        : html;
}

// ══════════ EXPORT ══════════
function _tLabel() { return `Cierre_${MONTH_NAMES[_rdaCache.maxMes-1] || 'Final'}`; }
function _dateStr() { return new Date().toISOString().slice(0,10).replace(/-/g,''); }
function _safeName(n) { return (n||'').replace(/[^a-zA-Z0-9]/g,'_').substring(0,40); }

// Motor de exportación a PDF (Premium Vectorial - Direct Render)
async function generarPDFRobusto(elementoOrigenId, nombreArchivo, devolverBlob = false) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log("[RDA PDF] Iniciando exportación nativa vectorial premium con patrón corporativo...");
            
            const jsPDF = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : window.jsPDF;
            if (!jsPDF) { throw new Error("La librería jsPDF no está cargada en el DOM."); }

            // 1. Obtener Metadatos y Configuración
            const esquemaSel = document.getElementById('rdaFilterEsquema');
            const esquemaTexto = esquemaSel ? esquemaSel.options[esquemaSel.selectedIndex].text : 'Análisis RDA';
            const muni = document.getElementById('rdaFilterMunicipio')?.value || 'JURISDICCIÓN SANITARIA 1';
            const maxMesLabel = MONTH_NAMES[_rdaCache.maxMes-1] || 'FINAL';
            
            // 2. Extraer estructura y datos de la tabla real
            const tablaOriginal = document.querySelector('#rdaDetailTable');
            if (!tablaOriginal) return reject("Tabla de datos no encontrada.");

            const tableHeaders = Array.from(tablaOriginal.querySelectorAll('thead th'))
                .map(th => th.innerText.replace(/[↕\n\r]/g, '').trim());

            const tableRowsRaw = Array.from(tablaOriginal.querySelectorAll('tbody tr')).map(tr => {
                return Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
            });

            // Lógica Universal: Agrupar por Unidad y Municipio
            const colsLen = tableHeaders.length - 3;
            tableHeaders.splice(0, 3);
            
            const isSingleUnit = tableRowsRaw.length === 1;

            // 3. Obtener imágenes base64 de las gráficas
            let imgChart1Base64 = '';
            let titleChart1 = '';
            let titleChart2 = '';
            
            const isMuniFilter = muni && muni !== 'JURISDICCIÓN SANITARIA 1' && muni.trim() !== '';

            if (isSingleUnit) {
                const currentYear = new Date().getFullYear();
                imgChart1Base64 = _rdaCharts.d ? _rdaCharts.d.getDataURL({ type: 'png', backgroundColor: '#fff', pixelRatio: 2 }) : '';
                titleChart1 = "DISTRIBUCIÓN DE AVANCE";
                titleChart2 = `AVANCE ANUAL ${currentYear}`;
            } else {
                imgChart1Base64 = _rdaCharts.total ? _rdaCharts.total.getDataURL({ type: 'png', backgroundColor: '#fff', pixelRatio: 2 }) : '';
                titleChart1 = isMuniFilter ? "AVANCE MUNICIPAL TOTAL" : "AVANCE JURISDICCIONAL TOTAL";
                titleChart2 = isMuniFilter ? "TOP UNIDADES DEL MUNICIPIO" : "TOP 10 UNIDADES";
            }
            const imgTopBase64 = _rdaCharts.b ? _rdaCharts.b.getDataURL({ type: 'png', backgroundColor: '#fff', pixelRatio: 2 }) : '';
            
            const tablesGrouped = [];
            let currentBody = [];
            let currentGroupName = '';
            
            tableRowsRaw.forEach(row => {
                if (row.length === 1) {
                    if (currentBody.length > 0) {
                        tablesGrouped.push({ muni: currentGroupName, rows: currentBody });
                        currentBody = [];
                    }
                    currentGroupName = row[0];
                    return;
                }

                const unitClues = row[0] || '';
                const unitName = row[1] || '';
                
                if (!isSingleUnit) {
                    currentBody.push([{
                        content: `UNIDAD: ${unitName.toUpperCase()}   |   CLUES: ${unitClues}`,
                        colSpan: colsLen,
                        styles: { fillColor: [248, 250, 252], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'left' }
                    }]);
                }
                
                currentBody.push(row.slice(3));
            });
            if (currentBody.length > 0) {
                tablesGrouped.push({ muni: currentGroupName, rows: currentBody });
            }

            // Helper para cargar imágenes Base64
            const loadImgBase64 = (url) => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.crossOrigin = 'Anonymous';
                    img.src = url;
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        resolve({ data: canvas.toDataURL('image/png'), ratio: img.width / img.height });
                    };
                    img.onerror = () => resolve(null);
                });
            };
            
            const [logoData, watermarkData] = await Promise.all([
                loadImgBase64('https://raw.githubusercontent.com/carlosgbd94-design/Logos/refs/heads/main/Seseq_vertical_2025.png'),
                loadImgBase64('https://raw.githubusercontent.com/carlosgbd94-design/Logos/refs/heads/main/logo_nuevo.png')
            ]);

            // 4. Inicializar jsPDF en formato Carta Horizontal
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
            
            // ==========================================
            // PATRÓN: MOSAICO LIMPIO (BACKGROUND)
            // ==========================================
            doc.setFillColor(255, 255, 255);
            doc.rect(0, 0, 279.4, 215.9, 'F');
            
            if (watermarkData) {
                doc.setGState(new doc.GState({opacity: 0.02}));
                const tileSize = 35;
                const tileH = tileSize / watermarkData.ratio;
                for(let x = -10; x < 290; x += tileSize) {
                    for(let y = -10; y < 230; y += tileH) {
                        doc.addImage(watermarkData.data, 'PNG', x, y, tileSize, tileH, undefined, 'FAST');
                    }
                }
                doc.setGState(new doc.GState({opacity: 1.0}));
            }
            
            // 5. Encabezado
            const marginX = 15;
            let currentY = 0;

            doc.setFillColor(15, 23, 42); // Slate 900
            doc.rect(0, 0, 279.4, 6, 'F');
            doc.setFillColor(13, 148, 136); // Teal 600
            doc.rect(0, 6, 279.4, 1.5, 'F');
            
            currentY = 18;
            let textStartX = marginX;
            if (logoData) {
                const logoH = 26;
                const logoW = logoH * logoData.ratio;
                doc.addImage(logoData.data, 'PNG', marginX, currentY, logoW, logoH, undefined, 'FAST');
                textStartX = marginX + logoW + 8;
            }
            
            let headerTitle = isSingleUnit ? tableRowsRaw[0][1] : "Indicadores Analíticos RDA";
            let headerSubtitle = isSingleUnit ? `${tableRowsRaw[0][0]}  |  ${tableRowsRaw[0][2].toUpperCase()}  |  ${esquemaTexto.toUpperCase()}` : `${esquemaTexto.toUpperCase()}  |  ${muni.toUpperCase()}`;

            if (isSingleUnit) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.setTextColor(13, 148, 136); // Teal 600
                doc.text("INDICADORES ANALÍTICOS RDA", textStartX, currentY + 2);
                
                doc.setFont('helvetica', 'bold');
                let titleSize = headerTitle.length > 35 ? 16 : 24;
                doc.setFontSize(titleSize);
                doc.setTextColor(15, 23, 42);
                doc.text(headerTitle.substring(0, 65), textStartX, currentY + 11);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(100, 116, 139);
                doc.text(headerSubtitle, textStartX, currentY + 18);
            } else {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(26);
                doc.setTextColor(15, 23, 42);
                doc.text(headerTitle, textStartX, currentY + 8);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(100, 116, 139);
                doc.text(headerSubtitle, textStartX, currentY + 15);
            }

            // Avance del Cierre (Derecha)
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(210, currentY, 54, 20, 4, 4, 'FD');
            doc.setFillColor(13, 148, 136); // Badge accent
            doc.roundedRect(210, currentY, 54, 6, 4, 4, 'F');
            
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(255, 255, 255);
            doc.text("AVANCE AL CIERRE", 237, currentY + 4, { align: 'center' });
            
            doc.setFontSize(16);
            doc.setTextColor(15, 23, 42);
            doc.text(`${maxMesLabel.toUpperCase()}`, 237, currentY + 15, { align: 'center' });
            
            currentY = 48;

            // ==========================================
            // CÁLCULO DE KPIS GERENCIALES
            // ==========================================
            let totalDosis = 0;
            let totalMeta = 0;
            let numPorcentajes = 0;
            let sumaPorcentajes = 0;
            
            Array.from(tablaOriginal.querySelectorAll('tbody tr')).forEach(tr => {
                const tds = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
                tds.forEach(cText => {
                    if (cText.includes('%')) {
                        const val = parseFloat(cText.replace('%', ''));
                        if (!isNaN(val)) { sumaPorcentajes += val; numPorcentajes++; }
                    }
                });
                
                const dText = String(tds[tds.length - 1]).replace(/,/g, '');
                const dVal = parseInt(dText, 10);
                if (!isNaN(dVal)) totalDosis += dVal;
                
                if (_rdaState.esquema === 'basico' && tds.length > 5) {
                    const mText = String(tds[tds.length - 2]).replace(/,/g, '');
                    const mVal = parseInt(mText, 10);
                    if (!isNaN(mVal)) totalMeta += mVal;
                }
            });
            
            const kpiPromedio = numPorcentajes > 0 ? (sumaPorcentajes / numPorcentajes).toFixed(1) + '%' : 'N/A';
            const kpiDosis = totalDosis.toLocaleString('es-MX');
            
            let kpiPob = '';
            let kpiPobLabel = '';
            if (_rdaState.esquema === 'basico') {
                kpiPobLabel = 'POBLACIÓN META';
                kpiPob = totalMeta.toLocaleString('es-MX');
            } else {
                kpiPobLabel = tableRowsRaw.length === 1 ? 'REPORTES ENCONTRADOS' : 'UNIDADES ANALIZADAS';
                kpiPob = tableRowsRaw.length.toString();
            }

            const kpiWidth = 80;
            const kpiGap = (279.4 - (marginX * 2) - (kpiWidth * 3)) / 2;
            
            const drawModernKpiCard = (x, y, w, h, label, value, mainColor, accentColor) => {
                // Solid Background with Modern Look
                doc.setFillColor(mainColor[0], mainColor[1], mainColor[2]);
                doc.roundedRect(x, y, w, h, 3, 3, 'F');
                
                // Barra sutil inferior en lugar de círculo
                doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
                doc.roundedRect(x, y + h - 2, w, 2, 0, 0, 'F');
                
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7);
                doc.setTextColor(255, 255, 255); 
                doc.text(label, x + 8, y + 8);
                
                doc.setFontSize(18);
                doc.setTextColor(255, 255, 255); 
                doc.text(value, x + 8, y + 17);
            };
            
            // Colores vibrantes y originales
            drawModernKpiCard(marginX, currentY, kpiWidth, 22, kpiPobLabel, kpiPob, [15, 23, 42], [30, 41, 59]); // Dark Slate
            drawModernKpiCard(marginX + kpiWidth + kpiGap, currentY, kpiWidth, 22, "TOTAL DOSIS APLICADAS", kpiDosis, [13, 148, 136], [17, 94, 89]); // Emerald/Teal
            drawModernKpiCard(marginX + (kpiWidth * 2) + (kpiGap * 2), currentY, kpiWidth, 22, "COBERTURA GLOBAL PROM.", kpiPromedio, [99, 102, 241], [79, 70, 229]); // Indigo

            currentY += 28;

            // ==========================================
            // SECCIÓN DE GRÁFICAS
            // ==========================================
            const chartSectionHeight = 110;
            const cardWidth = 117.2;
            const gap = 15;

            // Tarjeta A (Gráfica 1)
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(marginX, currentY, cardWidth, chartSectionHeight, 4, 4, 'FD');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            doc.text(titleChart1, marginX + 6, currentY + 8);
            if (imgChart1Base64) {
                doc.addImage(imgChart1Base64, 'PNG', marginX + 10, currentY + 12, cardWidth - 20, chartSectionHeight - 20, undefined, 'FAST');
            }

            // Tarjeta B (Gráfica 2)
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(marginX + cardWidth + gap, currentY, cardWidth, chartSectionHeight, 4, 4, 'FD');
            doc.text(titleChart2, marginX + cardWidth + gap + 6, currentY + 8);
            if (imgTopBase64) {
                doc.addImage(imgTopBase64, 'PNG', marginX + cardWidth + gap + 10, currentY + 12, cardWidth - 20, chartSectionHeight - 20, undefined, 'FAST');
            }

            currentY += chartSectionHeight + 8;

            if (!isSingleUnit) {
                doc.addPage();
                currentY = 20;
            }

            // ==========================================
            // TABLA VECTORIAL PREMIUM (Badges Nativos)
            // ==========================================
            tablesGrouped.forEach((grp, idx) => {
                if (!isSingleUnit && grp.muni) {
                    if (currentY > 180) {
                        doc.addPage();
                        currentY = 20;
                    }
                    doc.setFillColor(241, 245, 249);
                    doc.rect(marginX, currentY, 249.4, 8, 'F');
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(10);
                    doc.setTextColor(51, 65, 85);
                    doc.text(`MUNICIPIO: ${grp.muni.toUpperCase()}`, marginX + 124.7, currentY + 5.5, { align: 'center' });
                    currentY += 8;
                }

                doc.autoTable({
                    head: [tableHeaders],
                    body: grp.rows,
                startY: currentY,
                margin: { left: marginX, right: marginX },
                theme: 'plain', 
                styles: {
                    fontSize: 8,
                    font: 'helvetica',
                    cellPadding: 5,
                    valign: 'middle',
                    lineColor: [241, 245, 249], 
                    lineWidth: { bottom: 0.5 },
                    halign: 'center'
                },
                headStyles: {
                    fillColor: [248, 250, 252],
                    textColor: [100, 116, 139],
                    fontStyle: 'bold',
                    halign: 'center',
                    lineWidth: { bottom: 1, top: 1 }
                },
                bodyStyles: { fillColor: [255, 255, 255] },
                willDrawCell: function(data) {
                    if (data.section === 'body') {
                        // Respetar fila de encabezado que agrupa la unidad
                        if (data.row.raw.length === 1 && data.row.raw[0].colSpan) return;

                        doc.setFillColor(255, 255, 255);
                        doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                        
                        // Todas las columnas restantes son numéricas
                        const isBadgeCol = !(data.column.index === data.table.columns.length - 1 || (_rdaState.esquema === 'basico' && data.column.index === data.table.columns.length - 2));
                        if (isBadgeCol && data.cell.text[0] && data.cell.text[0].includes('%')) {
                            data.cell.customText = data.cell.text[0]; // Salvamos el texto
                            data.cell.text = []; // BORRAMOS el texto nativo
                        }
                    }
                },
                didDrawCell: function(data) {
                    if (data.section === 'body') {
                        if (data.row.raw.length === 1 && data.row.raw[0].colSpan) return;
                        
                        const text = data.cell.customText;
                        if (!text) return; // Si no hay customText, es una columna normal (Meta/Total)

                        let bg = [241, 245, 249]; 
                        let fg = [71, 85, 105];
                        const val = parseFloat(text.replace('%', ''));
                        if (!isNaN(val)) {
                            if (val >= 80) { bg = [220, 252, 231]; fg = [22, 101, 52]; }
                            else if (val >= 50) { bg = [254, 243, 199]; fg = [146, 64, 14]; }
                            else { bg = [254, 226, 226]; fg = [153, 27, 27]; }
                        }
                        
                        const textWidth = doc.getTextWidth(text);
                        const badgeWidth = textWidth + 6;
                        const badgeHeight = 5;
                        const cx = data.cell.x + (data.cell.width / 2);
                        const cy = data.cell.y + (data.cell.height / 2);
                        
                        doc.setFillColor(bg[0], bg[1], bg[2]);
                        doc.roundedRect(cx - badgeWidth/2, cy - badgeHeight/2, badgeWidth, badgeHeight, 1.5, 1.5, 'F');
                        
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(8);
                        doc.setTextColor(fg[0], fg[1], fg[2]);
                        doc.text(text, cx, cy, { align: 'center', baseline: 'middle' });
                    }
                },
                didDrawPage: function(data) {
                    if (((!isSingleUnit && data.pageNumber >= 1) || (isSingleUnit && data.pageNumber > 1)) && watermarkData) {
                        doc.setGState(new doc.GState({opacity: 0.02}));
                        const tileSize = 35;
                        const tileH = tileSize / watermarkData.ratio;
                        for(let x = -10; x < 290; x += tileSize) {
                            for(let y = -10; y < 230; y += tileH) {
                                doc.addImage(watermarkData.data, 'PNG', x, y, tileSize, tileH, undefined, 'FAST');
                            }
                        }
                        doc.setGState(new doc.GState({opacity: 1.0}));
                    }
                }
            });
            
            currentY = doc.lastAutoTable.finalY + 10;
        });

            // Loop through all pages to add the dynamic page number and footer stamp (Two-Pass Pattern)
            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.setTextColor(148, 163, 184);
                
                const stamp = `REPORTE GENERADO EL ${new Date().toLocaleString('es-MX')} — INTELIGENCIA OPERATIVA JS1`;
                doc.text(stamp, marginX, 208);
                
                const pag = `Página ${i} de ${totalPages}`;
                doc.text(pag, 264.4, 208, { align: 'right' });
            }

            if (devolverBlob) {
                resolve(doc.output('blob'));
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
window.resetRDAEsquemaToBasico = () => {
    _rdaState.esquema = 'basico';
    const sel = document.getElementById('rdaFilterEsquema');
    if (sel) sel.value = 'basico';
    document.querySelectorAll('.rda-scheme-btn').forEach(b => {
        if (b.dataset.scheme === 'basico') b.classList.add('active');
        else b.classList.remove('active');
    });
};
window.loadAndRender = loadAndRender;
window.addEventListener('DOMContentLoaded', () => initRDADashboard());

// 📱 MOBILE SPECIFIC LOGIC
function initRDAMobileDashboard() {
    document.querySelectorAll('.rda-scheme-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.rda-scheme-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            _rdaState.esquema = e.target.dataset.scheme;
            renderMobileDashboard();
            // Sync with desktop scheme so states are matched
            const desktopScheme = document.getElementById('rdaFilterEsquema');
            if (desktopScheme) desktopScheme.value = _rdaState.esquema;
        });
    });

    document.getElementById('rdaMobileMuni')?.addEventListener('change', () => {
        populateMobileFilters();
        renderMobileDashboard();
    });
    document.getElementById('rdaMobileUnidad')?.addEventListener('change', () => renderMobileDashboard());
}

window.closeRdaMobile = function() {
    if (AppState.rol === "UNIDAD") {
        if (typeof activateUnidadTab === 'function') activateUnidadTab('CAPTURE');
    } else {
        if (typeof activateOpsTab === 'function') activateOpsTab('CAPTURE');
    }
};

function populateMobileFilters() {
    const { unidades } = _rdaCache;
    const muniSel = document.getElementById('rdaMobileMuni');
    const uniSel = document.getElementById('rdaMobileUnidad');
    if (!muniSel || !unidades) return;

    const role = String((typeof USER !== 'undefined' && USER?.rol) || 'UNIDAD').toUpperCase();
    const allowed = (typeof USER !== 'undefined' && Array.isArray(USER?.municipiosAllowed)) ? USER.municipiosAllowed : [];

    let municipios = [...new Set(unidades.map(u => (u.municipio || '').toUpperCase().trim()))].filter(Boolean).sort();

    if (role === 'ADMIN' || role === 'JURISDICCIONAL' || role === 'CARAVANAS') {
        muniSel.disabled = false;
        if (muniSel.options.length <= 1) {
            muniSel.innerHTML = '<option value="">Todos los municipios</option>' + municipios.map(m => `<option value="${m}">${m}</option>`).join('');
            muniSel.value = '';
        }
    } else if (role === 'MUNICIPAL') {
        municipios = municipios.filter(m => {
            const mNorm = m.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
            return allowed.some(a => mNorm.includes(a) || a.includes(mNorm));
        });
        if (muniSel.options.length <= 1) {
            muniSel.innerHTML = municipios.map(m => `<option value="${m}">${m}</option>`).join('');
            muniSel.value = municipios.length > 0 ? municipios[0] : '';
            muniSel.disabled = municipios.length <= 1;
        }
    } else if (role === 'UNIDAD') {
        const userClues = (typeof USER !== 'undefined' && USER?.clues) || '';
        const matchUnit = unidades.find(u => u.clues === userClues);
        if (matchUnit) {
            muniSel.innerHTML = `<option value="${(matchUnit.municipio || '').toUpperCase().trim()}">${matchUnit.municipio}</option>`;
            muniSel.value = (matchUnit.municipio || '').toUpperCase().trim();
            if (uniSel) {
                uniSel.innerHTML = `<option value="${matchUnit.clues}">${matchUnit.nombre || matchUnit.clues}</option>`;
                uniSel.value = matchUnit.clues;
            }
        }
        muniSel.disabled = true;
        if (uniSel) uniSel.disabled = true;
        return;
    }

    const muni = muniSel.value || '';
    if (role !== 'UNIDAD' && uniSel) {
        if (!muni) {
            uniSel.innerHTML = '<option value="">Todas las unidades</option>';
            uniSel.disabled = true;
        } else {
            uniSel.disabled = false;
            const units = unidades.filter(u => (u.municipio || '').toUpperCase().trim() === muni.toUpperCase().trim())
                                  .sort((a, b) => (a.clues || '').localeCompare(b.clues || ''));
            const currUni = uniSel.value;
            uniSel.innerHTML = '<option value="">Todas las unidades</option>' + units.map(u => `<option value="${u.clues}">${u.nombre || u.clues}</option>`).join('');
            uniSel.value = currUni || '';
        }
    }
}

function renderMobileDashboard() {
    const rdaMob = document.getElementById("rdaMobileDashboard");
    if (!rdaMob) return;

    const { unidades, maxMes } = _rdaCache;
    if (!unidades || !unidades.length) return;

    const muniFilter = document.getElementById('rdaMobileMuni')?.value || '';
    const uniFilter = document.getElementById('rdaMobileUnidad')?.value || '';
    const esquema = _rdaState.esquema || 'basico';
    const kpiList = SCHEME_KPIS[esquema] || SCHEME_KPIS['basico'];

    let fUnits = unidades;
    if (muniFilter) fUnits = fUnits.filter(u => (u.municipio || '').toUpperCase().trim() === muniFilter.toUpperCase().trim());
    if (uniFilter) fUnits = fUnits.filter(u => u.clues === uniFilter);

    const countEl = document.getElementById('rdaMobileCount');
    if (countEl) countEl.innerText = fUnits.length;

    // === Aggregate data exactly like renderDashboard ===
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

    // Coberturas (same formula as desktop)
    const factorMenor1 = (agg.pob_menor_1 * 0.0833) * maxMes;
    const factorUno = (agg.pob_1_ano * 0.0833) * maxMes;
    const factorCuatro = (agg.pob_4_anos * 0.0833) * maxMes;
    const sumaDosisMenor1 = agg.bcg_dosis + agg.hepb_0_7_dosis + agg.hexa_3_dosis + agg.rota_2_dosis + agg.neumo_2_dosis;
    const sumaDosisUno = agg.hexa_ref_dosis + agg.neumo_ref_dosis + agg.srp_2_dosis;
    const sumaDosisCuatro = agg.dpt_4_dosis;
    agg.cobertura_menor1 = factorMenor1 > 0 ? Math.round((((sumaDosisMenor1 / 4.0) / factorMenor1) * 100) * 10) / 10 : 0;
    agg.cobertura_uno = factorUno > 0 ? Math.round((((sumaDosisUno / 3.0) / factorUno) * 100) * 10) / 10 : 0;
    agg.cobertura_cuatro = factorCuatro > 0 ? Math.round(((sumaDosisCuatro / factorCuatro) * 100) * 10) / 10 : 0;

    // === Render KPI Cards ===
    const kpiGrid = document.getElementById('rdaMobileKpiGrid');
    if (kpiGrid) {
        let kpiHtml = '';
        kpiList.forEach(k => {
            let valText = '';
            let subText = '';
            let valNum = 0;

            if (esquema === 'basico') {
                if (k.key === 'menor1') {
                    valNum = agg.cobertura_menor1;
                    valText = `${valNum}%`;
                    subText = `${sumaDosisMenor1.toLocaleString('es-MX')} dosis`;
                } else if (k.key === 'uno') {
                    valNum = agg.cobertura_uno;
                    valText = `${valNum}%`;
                    subText = `${sumaDosisUno.toLocaleString('es-MX')} dosis`;
                } else if (k.key === 'cuatro') {
                    valNum = agg.cobertura_cuatro;
                    valText = `${valNum}%`;
                    subText = `${agg.dpt_4_dosis.toLocaleString('es-MX')} dosis`;
                } else if (k.key === 'pob') {
                    valText = agg.pob_total.toLocaleString('es-MX');
                    subText = `${agg.total_unidades} unidades`;
                }
            } else {
                valNum = agg[k.key] || 0;
                valText = valNum.toLocaleString('es-MX');
                subText = 'dosis aplicadas';
            }

            let valColor = '#0f172a';
            if (esquema === 'basico' && k.key !== 'pob') {
                valColor = valNum >= 80 ? '#059669' : valNum >= 50 ? '#d97706' : '#dc2626';
            }

            kpiHtml += `
                <div class="rda-kpi-mobile-card" style="border-left: 3px solid ${k.fg};">
                    <div class="kpi-icon" style="background: ${k.bg}; color: ${k.fg};">
                        <span class="material-symbols-rounded premium-anim-icon">${k.icon}</span>
                    </div>
                    <div class="kpi-label">${k.label}</div>
                    <div class="kpi-value" style="color: ${valColor};">${valText}</div>
                    <div class="kpi-meta">${subText}</div>
                </div>
            `;
        });
        kpiGrid.innerHTML = kpiHtml;
    }

    // === Render Unit List ===
    const listEl = document.getElementById('rdaMobileList');
    if (listEl) {
        let listHtml = '';
        fUnits.forEach(u => {
            // Show the main KPI value per unit (first non-pob KPI)
            const mainKpi = kpiList.find(k => k.key !== 'pob') || kpiList[0];
            let mainVal = 0;
            if (esquema === 'basico') {
                if (mainKpi.key === 'menor1') {
                    const uDosis = (u.bcg_dosis||0) + (u.hepb_0_7_dosis||0) + (u.hexa_3_dosis||0) + (u.rota_2_dosis||0) + (u.neumo_2_dosis||0);
                    mainVal = uDosis;
                } else if (mainKpi.key === 'uno') {
                    mainVal = (u.hexa_ref_dosis||0) + (u.neumo_ref_dosis||0) + (u.srp_2_dosis||0);
                } else if (mainKpi.key === 'cuatro') {
                    mainVal = u.dpt_4_dosis || 0;
                }
            } else {
                mainVal = Number(u[mainKpi.key]) || 0;
            }

            listHtml += `
                <div class="rda-unit-mobile-card">
                    <div class="unit-header">
                        <div>
                            <div class="unit-title">${u.nombre || u.clues}</div>
                            <div class="unit-clues">${u.clues}</div>
                        </div>
                        <div class="unit-doses">${mainVal.toLocaleString('es-MX')}</div>
                    </div>
                    <div class="unit-metrics">
                        <div class="metric-item">
                            <span class="metric-label">${mainKpi.label}</span>
                            <span class="metric-value text-slate-700">${mainVal.toLocaleString('es-MX')} dosis</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Municipio</span>
                            <span class="metric-value text-slate-700 truncate">${u.municipio || '-'}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        listEl.innerHTML = listHtml;
    }
}

