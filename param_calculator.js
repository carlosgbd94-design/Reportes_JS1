/**
 * param_calculator.js — Calculadora Paramétrica de Biológicos
 * Gestión inteligente, paginación de alto rendimiento e interfaz de edición en vivo.
 */

let _calculatedParams = [];
let _filteredParams = [];
let _paramCalcCurrentPage = 1;
let _paramCalcPageSize = 25;

// Cantidad de dosis estándar por frasco para cada biológico
const DEFAULT_DOSES_PER_BOTTLE = {
    "BCG": 10,
    "HEPATITIS B": 1,
    "HEXAVALENTE": 1,
    "DPT": 1,
    "ROTAVIRUS": 1,
    "NEUMOCÓCICA 13": 1,
    "NEUMOCOCICA 13": 1,
    "NEUMOCÓCICA 20": 1,
    "NEUMOCOCICA 20": 1,
    "SRP": 1,
    "SR": 10,
    "VPH": 1,
    "VARICELA": 1,
    "HEPATITIS A": 1,
    "TD": 10,
    "TDPA": 1,
    "TDPa": 1,
    "COVID-19": 6,
    "INFLUENZA": 10,
    "VSR": 1
};

// Cuadro de confirmación custom premium que sustituye a confirm() de navegador
window.showConfirmDialog = function(title, message) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('genericConfirmOverlay');
        const titleEl = document.getElementById('genericConfirmTitle');
        const msgEl = document.getElementById('genericConfirmMessage');
        const btnAccept = document.getElementById('btnGenericConfirmAccept');
        const btnCancel = document.getElementById('btnGenericConfirmCancel');

        if (!overlay || !titleEl || !msgEl || !btnAccept || !btnCancel) {
            // Fallback de seguridad si no está en el DOM
            resolve(confirm(message));
            return;
        }

        titleEl.textContent = title;
        msgEl.textContent = message;
        overlay.style.display = 'flex';

        const cleanup = (val) => {
            overlay.style.display = 'none';
            btnAccept.onclick = null;
            btnCancel.onclick = null;
            resolve(val);
        };

        btnAccept.onclick = () => cleanup(true);
        btnCancel.onclick = () => cleanup(false);
    });
};

window.runBioParamCalculation = async function() {
    const anio = document.getElementById('paramCalcAnio').value;
    const bufferPercent = parseFloat(document.getElementById('paramCalcBuffer').value) || 0;

    if (typeof showOverlay === 'function') {
        showOverlay("Consultando productividad SIS...", "Calculadora de Parámetros");
    }

    try {
        // 1. Extraer los meses activos y datos históricos agregados para evitar el límite de 1000 registros y optimizar velocidad
        const yearInt = parseInt(anio, 10);
        const { data: dbMonths, error: errMonths } = await window.supabase
            .rpc('get_registros_sis_active_months', { p_anio: yearInt });
        
        if (errMonths) throw errMonths;

        let aggregatedData = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data: chunk, error: errAgg } = await window.supabase
                .rpc('get_registros_sis_aggregated', { p_anio: yearInt })
                .range(from, from + step - 1);
            
            if (errAgg) throw errAgg;
            
            if (chunk && chunk.length > 0) {
                aggregatedData = aggregatedData.concat(chunk);
                from += step;
                if (chunk.length < step) {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
        }

        // 2. Cargar unidades de salud activas
        const { data: units, error: errUnits } = await window.supabase
            .from('unidades')
            .select('clues, unidad, municipio')
            .eq('activo', 'SI');
            
        if (errUnits) throw errUnits;

        // 3. Cargar parámetros existentes para conservar múltiplos configurados y estado activo/inactivo
        const { data: existingParams, error: errParams } = await window.supabase
            .from('biologicos_params')
            .select('*');
            
        if (errParams) throw errParams;

        const paramMap = {};
        if (existingParams) {
            existingParams.forEach(p => {
                paramMap[`${p.clues}|${p.biologico}`] = p;
            });
        }

        // Mapeo unificado completo de variables de aplicación SIS por vacuna
        const bioMapping = {
            "BCG": ['VBC01', 'VBC02', 'BIO50', 'BIO03', 'VBC03'],
            "HEPATITIS B": ['VAC06', 'VHB01', 'VHB02', 'VHB03', 'VHB04', 'VHB05', 'VHB06'],
            "HEXAVALENTE": ['VAC67', 'VAC68', 'VAC69', 'VAC70', 'VHX01', 'VHX02', 'VHX03', 'VHX04'],
            "DPT": ['VAC12', 'VAC13'],
            "ROTAVIRUS": ['VRV01', 'VRV02', 'VRV03', 'VRV04'],
            "NEUMOCÓCICA 13": ['VAC17', 'VAC18', 'VAC19', 'VNC01', 'VNC02', 'VNC03', 'VNC04'],
            "NEUMOCOCICA 13": ['VAC17', 'VAC18', 'VAC19', 'VNC01', 'VNC02', 'VNC03', 'VNC04'],
            "NEUMOCÓCICA 20": ['VCC01', 'VCC02', 'VCC03', 'VCC04', 'VCC05', 'VCC06', 'VCC07'],
            "NEUMOCOCICA 20": ['VCC01', 'VCC02', 'VCC03', 'VCC04', 'VCC05', 'VCC06', 'VCC07'],
            "SRP": ['VAC23', 'VTV01', 'VTV02', 'VTV03'],
            "SR": ['VAC82', 'VAC91', 'VDV01', 'VDV02', 'VDV03', 'VDV04', 'VDV05', 'VDV06'],
            "VPH": ['VPH05', 'VPH06', 'VPH07', 'VPH08', 'VPH12', 'VPH13', 'VPH14'],
            "VARICELA": ['VAR02', 'VAR03'],
            "HEPATITIS A": ['VHA01', 'VHA02', 'BIO88'],
            "TD": ['VAC39', 'VAC40', 'VAC47', 'VAC48', 'VTD01', 'VTD02', 'VAC55', 'VAC56', 'VTT01', 'VTT02', 'VTT03', 'VTT04', 'VTT05', 'VTT06', 'VTT07', 'VTT08', 'VTT09', 'VTT10', 'VTT11', 'VTT12'],
            "TDPA": ['VAC63', 'VDP01'],
            "TDPa": ['VAC63', 'VDP01'],
            "VSR": ['VS001'],
            "COVID-19": ['VCV38', 'VCV39', 'VCV40', 'VCV28', 'VCV16', 'VCV20', 'VCV21'],
            "INFLUENZA": [
                'BIE01','BIE28','BIE29','BIE30','BIE31','BIE04','BIE32','BIE33',
                'BIE34','BIE35','BIE36','BIE37','BIE38','BIE39','BIE40','BIO96',
                'BIO97','BIE09','BIE10','BIE41','BIE12','BIE13','BIE42','BIE15',
                'BIE16','BIE43','BIE18','BIE19','BIE44','BIE48','BIE49','BIE50',
                'BIE24','BIE25','BIE46','BIE51','BIE52','BIE53','BIE54','BIE55',
                'BIE56','BIE57','BIE58','BIE59','BIE60','BIE61'
            ]
        };

        // 4. Detección automática e inteligente de los meses transcurridos (evita promediar meses sin información)
        const activeMonths = (dbMonths || []).map(r => r.mes);
        const numMonths = Math.max(1, activeMonths.length);
        const localMonthNames = typeof MONTH_NAMES !== 'undefined' ? MONTH_NAMES : ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        const monthsList = activeMonths.sort((a,b)=>a-b).map(m => localMonthNames[m-1] || m).join(', ');

        const results = [];
        const regMap = {};
        if (aggregatedData) {
            aggregatedData.forEach(r => {
                const k = `${r.clues}|${r.variable_sis}`;
                regMap[k] = (regMap[k] || 0) + (r.total_valor || 0);
            });
        }

        const biosList = window.BIOS_LIST || Object.keys(bioMapping);

        for (const u of units) {
            for (const bio of biosList) {
                const vars = bioMapping[bio] || [];
                let totalDoses = 0;
                vars.forEach(v => {
                    totalDoses += regMap[`${u.clues}|${v}`] || 0;
                });

                // Promedio dinámico real basado en los meses reales cargados
                const avgDoses = totalDoses / numMonths;
                const minDoses = Math.round(avgDoses);
                // Margen de demanda (colchón protector) aplicado
                const maxDoses = Math.round(avgDoses * 1.5 * (1 + bufferPercent / 100));

                const paramKey = `${u.clues}|${bio}`;
                const existing = paramMap[paramKey];
                
                // Múltiplo de dosis por frasco dinámico por vacuna
                const defaultMultiplo = DEFAULT_DOSES_PER_BOTTLE[bio.toUpperCase()] || 1;
                const multiplo = existing ? (existing.multiplo || defaultMultiplo) : defaultMultiplo;
                
                // Cálculo dinámico de promedio_frascos según el múltiplo de dosis
                const promedioFrascos = Math.ceil(avgDoses / multiplo);

                results.push({
                    clues: u.clues,
                    unidad: u.unidad || 'Unidad Desconocida',
                    municipio: u.municipio || '*',
                    biologico: bio,
                    min_dosis: minDoses,
                    max_dosis: maxDoses,
                    promedio_frascos: promedioFrascos,
                    multiplo: multiplo,
                    activo: existing ? existing.activo : 'SI'
                });
            }
        }

        _calculatedParams = results;

        // Renderizar estadísticas de cálculo

        document.getElementById('paramCalcUnitsCount').textContent = units.length;
        document.getElementById('paramCalcBiosCount').textContent = biosList.length;
        document.getElementById('paramCalcMonths').textContent = `${numMonths} (${monthsList || 'Ninguno'})`;
        document.getElementById('paramCalcBufferVal').textContent = bufferPercent;

        // Mostrar elementos de la vista previa interactiva
        document.getElementById('paramCalcSummary').style.display = 'block';
        document.getElementById('paramCalcFilterRow').style.display = 'flex';
        document.getElementById('paramCalcTable').style.display = 'table';
        document.getElementById('paramCalcEmpty').style.display = 'none';
        document.getElementById('paramCalcPagination').style.display = 'flex';
        document.getElementById('paramCalcFooter').style.display = 'flex';

        // Población de los filtros dinámicos
        populateParamCalcFilters();

        _paramCalcCurrentPage = 1;
        filterParamCalcTable(true);

        if (typeof showToast === 'function') {
            showToast(`Cálculo finalizado para ${units.length} unidades`, true, 'good');
        }

    } catch (e) {
        console.error("Error al calcular parámetros:", e);

        if (typeof showToast === 'function') {
            showToast("Error al calcular parámetros: " + e.message, false, 'bad');
        }
    } finally {
        if (typeof hideOverlay === 'function') {
            hideOverlay();
        }
    }
};

function populateParamCalcFilters() {
    const filterBio = document.getElementById('paramCalcFilterBio');
    const filterMuni = document.getElementById('paramCalcFilterMuni');
    if (!filterBio || !filterMuni) return;

    const uniqueBios = [...new Set(_calculatedParams.map(p => p.biologico))].sort();
    filterBio.innerHTML = '<option value="">Todos los Biológicos</option>' + 
        uniqueBios.map(b => `<option value="${b}">${b}</option>`).join('');

    const uniqueMunis = [...new Set(_calculatedParams.map(p => p.municipio))].sort();
    filterMuni.innerHTML = '<option value="">Todos los Municipios</option>' + 
        uniqueMunis.map(m => `<option value="${m}">${m}</option>`).join('');
}

window.filterParamCalcTable = function(resetPage = false) {
    const searchVal = (document.getElementById('paramCalcFilter').value || '').toLowerCase().trim();
    const filterBio = document.getElementById('paramCalcFilterBio').value;
    const filterMuni = document.getElementById('paramCalcFilterMuni').value;

    _filteredParams = _calculatedParams.filter(p => {
        const matchesSearch = !searchVal || 
            p.clues.toLowerCase().includes(searchVal) ||
            p.unidad.toLowerCase().includes(searchVal) ||
            p.municipio.toLowerCase().includes(searchVal);
        
        const matchesBio = !filterBio || p.biologico === filterBio;
        const matchesMuni = !filterMuni || p.municipio === filterMuni;

        return matchesSearch && matchesBio && matchesMuni;
    });

    if (resetPage) {
        _paramCalcCurrentPage = 1;
    }
    renderParamCalcTable();
};

function renderParamCalcTable() {
    const tbody = document.getElementById('paramCalcTbody');
    if (!tbody) return;

    const totalCount = _filteredParams.length;
    const totalPages = Math.ceil(totalCount / _paramCalcPageSize) || 1;

    if (_paramCalcCurrentPage > totalPages) _paramCalcCurrentPage = totalPages;
    if (_paramCalcCurrentPage < 1) _paramCalcCurrentPage = 1;

    const startIdx = (_paramCalcCurrentPage - 1) * _paramCalcPageSize;
    const endIdx = Math.min(startIdx + _paramCalcPageSize, totalCount);

    const sliceToRender = _filteredParams.slice(startIdx, endIdx);
    const escapeFn = typeof escapeHtml === 'function' ? escapeHtml : (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    tbody.innerHTML = sliceToRender.map(p => {
        // Encontrar índice absoluto en la base original
        const masterIdx = _calculatedParams.findIndex(item => item.clues === p.clues && item.biologico === p.biologico);
        return `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 text-[11px] font-bold text-slate-700 sticky left-0 bg-white z-10 border-b border-outline-variant/20">
                    <div class="flex flex-col">
                        <span class="text-primary font-black">${escapeFn(p.unidad)}</span>
                        <span class="text-[9px] text-slate-400 font-mono">${escapeFn(p.clues)} (${escapeFn(p.municipio)})</span>
                    </div>
                </td>
                <td class="px-4 py-3 text-[11px] font-black text-slate-600 border-b border-outline-variant/20">${escapeFn(p.biologico)}</td>
                <td class="px-4 py-3 text-center border-b border-outline-variant/20">
                    <input type="number" min="0" 
                      class="w-16 h-8 text-center rounded-lg border border-slate-200 text-xs font-bold text-slate-700 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 outline-none" 
                      value="${p.min_dosis}" 
                      oninput="window.updateCalculatedParam(${masterIdx}, 'min_dosis', this.value)">
                </td>
                <td class="px-4 py-3 text-center border-b border-outline-variant/20">
                    <input type="number" min="0" 
                      class="w-16 h-8 text-center rounded-lg border border-slate-200 text-xs font-bold text-slate-700 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 outline-none" 
                      value="${p.max_dosis}" 
                      oninput="window.updateCalculatedParam(${masterIdx}, 'max_dosis', this.value)">
                </td>
                <td class="px-4 py-3 text-center border-b border-outline-variant/20">
                    <div class="flex flex-col items-center justify-center gap-0.5">
                        <input type="number" min="0" 
                          class="w-16 h-8 text-center rounded-lg border border-slate-200 text-xs font-bold text-slate-700 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 outline-none" 
                          value="${p.promedio_frascos}" 
                          oninput="window.updateCalculatedParam(${masterIdx}, 'promedio_frascos', this.value)">
                        <span class="text-[9px] text-slate-400 font-bold">Frasco de ${p.multiplo} dos.</span>
                    </div>
                </td>
                <td class="px-4 py-3 text-center border-b border-outline-variant/20">
                    <button type="button" onclick="window.toggleCalculatedParam(${masterIdx})" 
                      class="px-2.5 py-1 rounded-full text-[9px] font-black uppercase cursor-pointer border-none transition-all duration-200 active:scale-95 ${p.activo === 'SI' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 focus:ring-2 focus:ring-emerald-500/30' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 focus:ring-2 focus:ring-slate-500/30'}">
                        ${p.activo === 'SI' ? 'ACTIVO' : 'INACTIVO'}
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    document.getElementById('paramCalcPageStart').textContent = totalCount === 0 ? 0 : startIdx + 1;
    document.getElementById('paramCalcPageEnd').textContent = endIdx;
    document.getElementById('paramCalcTotalCount').textContent = totalCount;
    document.getElementById('paramCalcCurrentPage').textContent = _paramCalcCurrentPage;
    document.getElementById('paramCalcTotalPages').textContent = totalPages;

    document.getElementById('btnParamCalcPrev').disabled = _paramCalcCurrentPage <= 1;
    document.getElementById('btnParamCalcNext').disabled = _paramCalcCurrentPage >= totalPages;
}

window.changeParamCalcPage = function(direction) {
    const totalPages = Math.ceil(_filteredParams.length / _paramCalcPageSize) || 1;
    let newPage = _paramCalcCurrentPage + direction;
    if (newPage >= 1 && newPage <= totalPages) {
        _paramCalcCurrentPage = newPage;
        renderParamCalcTable();
    }
};

window.updateParamCalcPageSize = function(size) {
    _paramCalcPageSize = parseInt(size) || 25;
    _paramCalcCurrentPage = 1;
    renderParamCalcTable();
};

window.updateCalculatedParam = function(index, field, val) {
    if (index >= 0 && index < _calculatedParams.length) {
        if (field === 'activo') {
            _calculatedParams[index].activo = val;
        } else {
            _calculatedParams[index][field] = parseFloat(val) || 0;
        }

        const clues = _calculatedParams[index].clues;
        const bio = _calculatedParams[index].biologico;
        const filteredItem = _filteredParams.find(p => p.clues === clues && p.biologico === bio);
        if (filteredItem) {
            filteredItem[field] = _calculatedParams[index][field];
        }
    }
};

window.toggleCalculatedParam = function(index) {
    if (index >= 0 && index < _calculatedParams.length) {
        const item = _calculatedParams[index];
        item.activo = item.activo === 'SI' ? 'NO' : 'SI';

        const filteredItem = _filteredParams.find(p => p.clues === item.clues && p.biologico === item.biologico);
        if (filteredItem) {
            filteredItem.activo = item.activo;
        }

        renderParamCalcTable();
    }
};

window.saveCalculatedBioParams = async function() {
    if (!_calculatedParams.length) {
        if (typeof showToast === 'function') showToast("No hay parámetros calculados para guardar", false, "warn");
        return;
    }

    const confirmSave = await window.showConfirmDialog(
        "Confirmar Guardado",
        `¿Estás seguro de guardar los parámetros para ${_calculatedParams.length} combinaciones de unidad-biológico? Esto sobrescribirá los valores existentes en biologicos_params.`
    );
    if (!confirmSave) return;

    if (typeof showOverlay === 'function') {
        showOverlay("Guardando en base de datos...", "Guardar Parámetros");
    }

    try {
        const { data: existing, error: errExist } = await window.supabase
            .from('biologicos_params')
            .select('id, clues, biologico');

        if (errExist) throw errExist;

        const existingMap = {};
        if (existing) {
            existing.forEach(p => {
                existingMap[`${p.clues}|${p.biologico}`] = p.id;
            });
        }

        const allRecords = _calculatedParams.map(p => {
            const key = `${p.clues}|${p.biologico}`;
            const id = existingMap[key];
            const record = {
                clues: p.clues,
                biologico: p.biologico,
                activo: p.activo,
                unidad: p.unidad,
                municipio: p.municipio,
                min_dosis: p.min_dosis,
                max_dosis: p.max_dosis,
                promedio_frascos: p.promedio_frascos,
                multiplo: p.multiplo
            };
            if (id) {
                record.id = id;
            }
            return record;
        });

        const batchSize = 100;
        let successCount = 0;

        for (let i = 0; i < allRecords.length; i += batchSize) {
            const batch = allRecords.slice(i, i + batchSize);
            const { error: upsertErr } = await window.supabase
                .from('biologicos_params')
                .upsert(batch, { onConflict: 'clues,biologico' });

            if (upsertErr) throw upsertErr;
            successCount += batch.length;
        }

        if (typeof showToast === 'function') {
            showToast(`¡Se guardaron ${successCount} parámetros con éxito!`, true, 'good');
        }

    } catch (e) {
        console.error("Error al guardar parámetros:", e);
        if (typeof showToast === 'function') {
            showToast("Error al guardar en base de datos: " + e.message, false, 'bad');
        }
    } finally {
        if (typeof hideOverlay === 'function') {
            hideOverlay();
        }
    }
};

/**
 * --- ADMINISTRACIÓN DE ESQUEMAS Y TEMPORADAS ---
 */

let _catalogParams = []; // Almacena temporalmente el catálogo biologicos_catalogo

window.switchParamTab = function(tab) {
    const calcTab = document.getElementById('tabParamCalc');
    const schemesTab = document.getElementById('tabParamSchemes');
    const calcContent = document.getElementById('paramCalcTabContent');
    const schemesContent = document.getElementById('paramSchemesTabContent');

    if (!calcTab || !schemesTab || !calcContent || !schemesContent) return;

    if (tab === 'calc') {
        calcTab.classList.add('active');
        schemesTab.classList.remove('active');
        
        calcContent.style.display = 'block';
        schemesContent.style.display = 'none';
    } else {
        schemesTab.classList.add('active');
        calcTab.classList.remove('active');

        calcContent.style.display = 'none';
        schemesContent.style.display = 'block';

        // Cargar datos del catálogo al cambiar a la pestaña de esquemas
        window.loadBioCatalogSchemes();
    }

    if (typeof syncTabGroupIndicator === 'function') {
        syncTabGroupIndicator('#paramCalcTabContainer');
    }
};

window.loadBioCatalogSchemes = async function() {
    if (typeof showOverlay === 'function') {
        showOverlay("Cargando catálogo de biológicos...", "Esquemas y Catálogo");
    }

    try {
        const { data, error } = await window.supabase
            .from('biologicos_catalogo')
            .select('*')
            .order('orden_biologico');

        if (error) throw error;

        _catalogParams = data || [];
        renderBioCatalogSchemes();

    } catch (e) {
        console.error("Error al cargar catálogo de biológicos:", e);
        if (typeof showToast === 'function') {
            showToast("Error al cargar catálogo: " + e.message, false, 'bad');
        }
    } finally {
        if (typeof hideOverlay === 'function') {
            hideOverlay();
        }
    }
};

function renderBioCatalogSchemes() {
    const tbody = document.getElementById('paramSchemesTbody');
    if (!tbody) return;

    const escapeFn = typeof escapeHtml === 'function' ? escapeHtml : (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // "Captura Activa" is removed from the catalog UI to avoid conflict with unit-specific configuration
    tbody.innerHTML = _catalogParams.map((item, index) => {
        return `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 text-[11px] font-mono font-bold text-center text-slate-500 border-b border-outline-variant/20">${item.orden_biologico}</td>
                <td class="px-4 py-3 text-[11px] font-black text-primary border-b border-outline-variant/20">${escapeFn(item.biologico)}</td>
                <td class="px-4 py-3 text-[11px] font-medium text-slate-600 border-b border-outline-variant/20">${escapeFn(item.total_ref)}</td>
                <td class="px-4 py-3 text-center border-b border-outline-variant/20">
                    <input type="number" min="1" 
                      class="w-16 h-8 text-center rounded-lg border border-slate-200 text-xs font-bold text-slate-700 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 outline-none" 
                      value="${item.multiplo_pedido || 1}" 
                      onchange="window.updateCatalogItem(${index}, 'multiplo_pedido', this.value)">
                </td>
                <td class="px-4 py-3 text-center border-b border-outline-variant/20">
                    <select onchange="window.updateCatalogItem(${index}, 'tipo_esquema', this.value)"
                      class="h-8 px-2 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-700 bg-white focus:border-primary/50 focus:ring-1 focus:ring-primary/30 outline-none w-full max-w-[200px]">
                        <option value="PERMANENTE" ${item.tipo_esquema === 'PERMANENTE' ? 'selected' : ''}>Esquema Permanente</option>
                        <option value="CAMPAÑA" ${item.tipo_esquema === 'CAMPAÑA' ? 'selected' : ''}>Campaña Extraordinaria</option>
                        <option value="TEMPORADA" ${item.tipo_esquema === 'TEMPORADA' ? 'selected' : ''}>Temporada Estacional</option>
                    </select>
                </td>
            </tr>
        `;
    }).join('');
}

window.updateCatalogItem = function(index, field, value) {
    if (index >= 0 && index < _catalogParams.length) {
        if (field === 'multiplo_pedido') {
            _catalogParams[index][field] = parseInt(value) || 1;
        } else {
            _catalogParams[index][field] = value;
        }
    }
};

window.saveBioCatalogSchemes = async function() {
    if (!_catalogParams.length) {
        if (typeof showToast === 'function') showToast("No hay registros en el catálogo para guardar", false, "warn");
        return;
    }

    const confirmSave = await window.showConfirmDialog(
        "Confirmar Guardado de Catálogo",
        "¿Estás seguro de guardar los cambios en el catálogo de biológicos? Esto afectará los múltiplos de pedido y la temporalidad de la captura de forma global e inmediata."
    );
    if (!confirmSave) return;

    if (typeof showOverlay === 'function') {
        showOverlay("Guardando catálogo en Supabase...", "Guardar Catálogo");
    }

    try {
        const batchSize = 50;
        let successCount = 0;

        for (let i = 0; i < _catalogParams.length; i += batchSize) {
            const batch = _catalogParams.slice(i, i + batchSize);
            const { error } = await window.supabase
                .from('biologicos_catalogo')
                .upsert(batch, { onConflict: 'orden_biologico' });

            if (error) throw error;
            successCount += batch.length;
        }

        // Forzar actualización inmediata de la caché de esquemas local si estamos en la misma ventana
        window.BIO_SCHEMES = {};
        _catalogParams.forEach(item => {
            const normalized = String(item.biologico || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
            window.BIO_SCHEMES[normalized] = item.tipo_esquema;
        });

        if (typeof showToast === 'function') {
            showToast(`¡Se guardaron ${successCount} registros del catálogo con éxito!`, true, 'good');
        }

    } catch (e) {
        console.error("Error al guardar catálogo de biológicos:", e);
        if (typeof showToast === 'function') {
            showToast("Error al guardar: " + e.message, false, 'bad');
        }
    } finally {
        if (typeof hideOverlay === 'function') {
            hideOverlay();
        }
    }
};

window.switchBulkUnitTab = function(btn) {
    const container = document.getElementById('unitBulkTabContainer');
    if (!container) return;
    container.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (typeof syncTabGroupIndicator === 'function') {
        syncTabGroupIndicator('#unitBulkTabContainer');
    }
};

window.switchBulkBioTab = function(btn) {
    const container = document.getElementById('bioBulkTabContainer');
    if (!container) return;
    container.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (typeof syncTabGroupIndicator === 'function') {
        syncTabGroupIndicator('#bioBulkTabContainer');
    }
};
