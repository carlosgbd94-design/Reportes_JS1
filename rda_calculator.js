/**
 * rda_calculator.js — Motor de Cálculo RDA 2026 v6
 * Fórmulas federales + aplicaciones por grupo demográfico.
 */

// ══════════════════════════════════════════════════════════════
// DICCIONARIO COMPLETO DE VARIABLES SIS
// ══════════════════════════════════════════════════════════════
// Lista de variables SIS de Influenza: fuente única en influenza_module.js (window.INFLUENZA_SIS_MAPPING),
// que carga antes que este archivo. Se deriva aquí para no mantener una copia hardcodeada duplicada.
// (Nota: DICT_RDA.INFLUENZA se sobreescribe en tiempo real desde la tabla sis_variables_mapeo vía
// loadRdaMappingFromDatabase() — esto solo evita que el valor inicial/respaldo diverja del resto.)
if (!window.INFLUENZA_SIS_MAPPING) {
    console.error("[rda_calculator] window.INFLUENZA_SIS_MAPPING no está definido — revisa que influenza_module.js cargue antes que rda_calculator.js en index.html");
}
const INFLUENZA_SIS_VARS_RDA = window.INFLUENZA_SIS_MAPPING ? Object.values(window.INFLUENZA_SIS_MAPPING) : [];

const DEFAULT_DICT_2026 = {
    BCG:        ['VBC01', 'VBC02', 'BIO50', 'BIO03', 'VBC03'],
    HepB_0_7:   ['VAC06'],
    Hexa_3:     ['VAC69'],
    Rota_2:     ['VRV02'],
    Neumo_2:    ['VAC18', 'VCC02'],
    Hexa_Ref:   ['VAC70'],
    Neumo_Ref:  ['VAC19', 'VCC03'],
    SRP_2:      ['VTV01'],
    DPT_4:      ['VAC12'],

    Hexa_1:     ['VAC67'],
    Hexa_2:     ['VAC68'],
    Neumo_1:    ['VAC17'],
    Neumo_C1:   ['VCC01'],
    Neumo_C2:   ['VCC02'],
    Neumo_C3:   ['VCC03'],
    SRP_1:      ['VAC23'],
    VARICELA:   ['VAR02', 'VAR03'],
    HEPATITIS_A: ['VHA01', 'VHA02', 'BIO88'],

    ADOL_HB:   ['VHB01','VHB02','VHB03','VHB04','VHB05','VHB06'],
    ADOL_SR:   ['VDV01','VDV02','VDV03','VDV04','VDV05','VDV06'],
    ADOL_VPH:  ['VPH05','VPH06','VPH07','VPH08','VPH12','VPH13','VPH14'],
    ADOL_TD:   ['VAC39','VAC40','VAC47','VAC48','VTD01','VTD02','VAC55','VAC56',
                'VTD03','VTD19','VTD05','VTD21','VTD07','VTD23','VTD09','VTD25',
                'VTD11','VTD27','VTD14','VTD29','VTD31','VTD32','VTD34','VTD35',
                'VTD20','VTD22','VTD24','VTD26','VTD28','VTD30','VTD33','VTD36',
                'VTT01','VTT02','VTT04','VTT05','VTT07','VTT08','VTT10','VTT11'],
    ADOL_TDPA: ['VAC63'],

    AM_NEUMO13: ['VNC04'],
    AM_NEUMO20: ['VCC07'],
    AM_TD:      ['VTT03','VTT06','VTT09','VTT12', 'VAC43', 'VAC46', 'VAC51', 'VAC54', 'VTD13', 'VTD16', 'VAC59', 'VAC62'],

    EMB_TDPA: ['VAC63'],
    EMB_VSR:  ['VS001'],
 
    INFLUENZA: INFLUENZA_SIS_VARS_RDA,
    COVID: ['VCV38','VCV39','VCV40','VCV28','VCV16','VCV20','VCV21']
};

const DEFAULT_DICT_2025 = {
    ...DEFAULT_DICT_2026,
    // 2025 exact XLSX keys:
    SRP_6:       ['VAC81'],
    NEUMO_23:    ['VNP01'],
    AM_NEUMO13:  ['VAC93', 'VAC94'],
    ADOL_SR:     ['VAC83'],
    VARICELA:    ['VAC36', 'VAR01', 'VAC38'],
    HEPATITIS_A: ['VAC87', 'BIO88'],
    ADOL_VPH:    ['VPH05','VPH06','VPH07','VPH08','VAC84','VAC85','VAC92','VPH09','VPH10','VPH11']
};
// Biológicos que NO existían en 2025
delete DEFAULT_DICT_2025.AM_NEUMO20;
delete DEFAULT_DICT_2025.EMB_VSR;
delete DEFAULT_DICT_2025.Neumo_C1;
delete DEFAULT_DICT_2025.Neumo_C2;
delete DEFAULT_DICT_2025.Neumo_C3;

let DICT_RDA_BY_YEAR = {
    2025: JSON.parse(JSON.stringify(DEFAULT_DICT_2025)),
    2026: JSON.parse(JSON.stringify(DEFAULT_DICT_2026))
};

let DICT_RDA = DICT_RDA_BY_YEAR[2026];

// Set rápido para filtrado en parser
let ALL_RDA_VARIABLES = Object.values(DICT_RDA).flat();
let ALL_RDA_SET = new Set(ALL_RDA_VARIABLES);

/**
 * Carga dinámicamente los mapeos desde Supabase para el año indicado.
 */
async function loadRdaMappingFromDatabase(anio = 2026) {
    const yr = parseInt(anio, 10) || 2026;
    try {
        if (window.supabase && typeof window.supabase.from === 'function') {
            const { data, error } = await window.supabase
                .from('sis_variables_mapeo')
                .select('*')
                .eq('anio', yr);

            if (!error && data && data.length > 0) {
                const baseDict = yr === 2025 ? JSON.parse(JSON.stringify(DEFAULT_DICT_2025)) : JSON.parse(JSON.stringify(DEFAULT_DICT_2026));
                data.forEach(row => {
                    const bioStr = String(row.biologico || '').toUpperCase();
                    if (!bioStr.startsWith('MOTHER_')) {
                        const targetKey = Object.keys(baseDict).find(k => k.toUpperCase() === bioStr);
                        if (targetKey && Array.isArray(row.variables)) {
                            baseDict[targetKey] = row.variables;
                        } else if (!targetKey && Array.isArray(row.variables)) {
                            baseDict[bioStr] = row.variables;
                        }
                    }
                });
                // AUTO-MIGRACIÓN: corregir claves obsoletas de versiones anteriores
                if (yr === 2025 && baseDict.NEUMO_23 && baseDict.NEUMO_23.includes('VNC04')) {
                    baseDict.NEUMO_23 = [...new Set(baseDict.NEUMO_23.map(k => k === 'VNC04' ? 'VNP01' : k))];
                }
                DICT_RDA_BY_YEAR[yr] = baseDict;
            }
        }
    } catch (e) {
        console.warn(`[loadRdaMappingFromDatabase] Error cargando mapeo para ${yr}:`, e);
    }
    
    // Actualizar DICT_RDA activo
    updateRdaDictionary(DICT_RDA_BY_YEAR[yr]);
    return DICT_RDA_BY_YEAR[yr];
}

/**
 * Actualiza dinámicamente el diccionario de variables del SIS (DICT_RDA)
 * y recalcula ALL_RDA_VARIABLES y ALL_RDA_SET.
 * IMPORTANTE: Reemplaza la referencia completa de DICT_RDA sin mutar el objeto
 * compartido del año anterior, preservando el aislamiento por año.
 */
function updateRdaDictionary(newMapping) {
    if (!newMapping || typeof newMapping !== 'object') return;
    // Reemplazar el contenido del objeto activo limpiando claves huérfanas
    const keysToRemove = Object.keys(DICT_RDA).filter(k => !(k in newMapping));
    keysToRemove.forEach(k => delete DICT_RDA[k]);
    for (const key in newMapping) {
        if (Array.isArray(newMapping[key])) {
            DICT_RDA[key] = newMapping[key];
        }
    }
    // Reconstruir variables auxiliares
    ALL_RDA_VARIABLES = Object.values(DICT_RDA).flat();
    ALL_RDA_SET = new Set(ALL_RDA_VARIABLES);

    // Sincronizar en window
    window.ALL_RDA_VARIABLES = ALL_RDA_VARIABLES;
    window.ALL_RDA_SET = ALL_RDA_SET;
    window.DICT_RDA = DICT_RDA;
    window.DICT_RDA_BY_YEAR = DICT_RDA_BY_YEAR;
}

window.updateRdaDictionary = updateRdaDictionary;
window.loadRdaMappingFromDatabase = loadRdaMappingFromDatabase;
window.DEFAULT_DICT_2025 = DEFAULT_DICT_2025;
window.DEFAULT_DICT_2026 = DEFAULT_DICT_2026;
window.DICT_RDA_BY_YEAR = DICT_RDA_BY_YEAR;

// ══════════════════════════════════════════════════════════════
// CLASE PRINCIPAL
// ══════════════════════════════════════════════════════════════
class RDA2026Calculator {

    /** Suma dosis de variables dentro de registros hasta maxMes */
    static sumVariables(registros, varList, maxMes) {
        if (!Array.isArray(varList) || varList.length === 0) return 0;
        let sum = 0;
        for (let i = 0; i < registros.length; i++) {
            const r = registros[i];
            if (r.mes <= maxMes && varList.includes(r.variable_sis)) {
                sum += (r.valor || 0);
            }
        }
        return sum;
    }

    /** Factor poblacional federal: (Poblacion × 0.0833) × Meses */
    static factorPoblacional(poblacion, meses) {
        if (!poblacion || poblacion <= 0 || !meses || meses <= 0) return 1;
        return (poblacion * 0.0833) * meses;
    }

    // ── COBERTURAS RDA (Fórmula Federal) ──

    // ── COBERTURAS POR BIOLÓGICO (Fórmulas Oficiales RDA) ──
    static coberturaBiolBCG(registros, pobMenor1, meses) {
        const factor = this.factorPoblacional(pobMenor1, meses);
        const total = this.sumVariables(registros, DICT_RDA.BCG, meses);
        const cob = (total / factor) * 100;
        return isFinite(cob) ? Math.round(cob * 10) / 10 : 0;
    }

    static coberturaBiolHepB(registros, pobMenor1, meses) {
        const factor = this.factorPoblacional(pobMenor1, meses);
        const total = this.sumVariables(registros, DICT_RDA.HepB_0_7, meses);
        const cob = (total / factor) * 100;
        return isFinite(cob) ? Math.round(cob * 10) / 10 : 0;
    }

    static coberturaBiolRota(registros, pobMenor1, meses) {
        const factor = this.factorPoblacional(pobMenor1, meses);
        const total = this.sumVariables(registros, DICT_RDA.Rota_2, meses);
        const cob = (total / factor) * 100;
        return isFinite(cob) ? Math.round(cob * 10) / 10 : 0;
    }

    static coberturaBiolHexaMenor1(registros, pobMenor1, meses) {
        const factor = this.factorPoblacional(pobMenor1, meses);
        const total = this.sumVariables(registros, [...DICT_RDA.Hexa_1, ...DICT_RDA.Hexa_2, ...DICT_RDA.Hexa_3], meses);
        const cob = (total / factor) * 100;
        return isFinite(cob) ? Math.round(cob * 10) / 10 : 0;
    }

    static coberturaBiolHexa1Ano(registros, pob1Ano, meses) {
        const factor = this.factorPoblacional(pob1Ano, meses);
        const total = this.sumVariables(registros, DICT_RDA.Hexa_Ref, meses);
        const cob = (total / factor) * 100;
        return isFinite(cob) ? Math.round(cob * 10) / 10 : 0;
    }

    static coberturaBiolNeumoMenor1(registros, pobMenor1, meses) {
        const factor = this.factorPoblacional(pobMenor1, meses);
        // Neumo_C1/C2 sólo existen en 2026 (Neumocócica 20v); fallback a [] en 2025
        const total = this.sumVariables(registros, [
            ...(DICT_RDA.Neumo_1  || []),
            ...(DICT_RDA.Neumo_2  || []),
            ...(DICT_RDA.Neumo_C1 || []),
            ...(DICT_RDA.Neumo_C2 || [])
        ], meses);
        const cob = (total / factor) * 100;
        return isFinite(cob) ? Math.round(cob * 10) / 10 : 0;
    }

    static coberturaBiolNeumo1Ano(registros, pob1Ano, meses) {
        const factor = this.factorPoblacional(pob1Ano, meses);
        // Neumo_C3 sólo existe en 2026; fallback a [] en 2025
        const total = this.sumVariables(registros, [
            ...(DICT_RDA.Neumo_Ref || []),
            ...(DICT_RDA.Neumo_C3  || [])
        ], meses);
        const cob = (total / factor) * 100;
        return isFinite(cob) ? Math.round(cob * 10) / 10 : 0;
    }

    static coberturaBiolSRP(registros, pob1Ano, meses) {
        const factor = this.factorPoblacional(pob1Ano, meses);
        const total = this.sumVariables(registros, [...DICT_RDA.SRP_1, ...DICT_RDA.SRP_2], meses);
        const cob = (total / factor) * 100;
        return isFinite(cob) ? Math.round(cob * 10) / 10 : 0;
    }

    static coberturaBiolDPT(registros, pob4Anos, meses) {
        const factor = this.factorPoblacional(pob4Anos, meses);
        const total = this.sumVariables(registros, DICT_RDA.DPT_4, meses);
        const cob = (total / factor) * 100;
        return isFinite(cob) ? Math.round(cob * 10) / 10 : 0;
    }

    static coberturaMenor1(registros, pobMenor1, meses) {
        const factor = this.factorPoblacional(pobMenor1, meses);
        const total = this.sumVariables(registros, DICT_RDA.BCG, meses)
                    + this.sumVariables(registros, DICT_RDA.HepB_0_7, meses)
                    + this.sumVariables(registros, DICT_RDA.Hexa_3, meses)
                    + this.sumVariables(registros, DICT_RDA.Rota_2, meses)
                    + this.sumVariables(registros, DICT_RDA.Neumo_2, meses);
        const cob = ((total / 4) / factor) * 100;
        return isFinite(cob) ? Math.round(cob * 10) / 10 : 0;
    }

    static cobertura1Ano(registros, pob1Ano, meses) {
        const factor = this.factorPoblacional(pob1Ano, meses);
        const total = this.sumVariables(registros, DICT_RDA.Hexa_Ref, meses)
                    + this.sumVariables(registros, DICT_RDA.Neumo_Ref, meses)
                    + this.sumVariables(registros, DICT_RDA.SRP_2, meses);
        // Dividir el total entre 3 según las especificaciones del esquema
        const cob = ((total / 3) / factor) * 100;
        return isFinite(cob) ? Math.round(cob * 10) / 10 : 0;
    }

    static cobertura4Anos(registros, pob4Anos, meses) {
        const factor = this.factorPoblacional(pob4Anos, meses);
        const total = this.sumVariables(registros, DICT_RDA.DPT_4, meses);
        const cob = (total / factor) * 100;
        return isFinite(cob) ? Math.round(cob * 10) / 10 : 0;
    }

    // ── APLICACIONES POR GRUPO (Sin fórmula, solo sumas) ──

    static aplicacionesAdolescentes(registros, maxMes) {
        return {
            hb:   this.sumVariables(registros, DICT_RDA.ADOL_HB, maxMes),
            sr:   this.sumVariables(registros, DICT_RDA.ADOL_SR, maxMes),
            vph:  this.sumVariables(registros, DICT_RDA.ADOL_VPH, maxMes),
            td:   this.sumVariables(registros, DICT_RDA.ADOL_TD, maxMes),
            tdpa: this.sumVariables(registros, DICT_RDA.ADOL_TDPA, maxMes)
        };
    }

    static aplicacionesMayores(registros, maxMes) {
        return {
            neumo13: this.sumVariables(registros, DICT_RDA.AM_NEUMO13, maxMes),
            neumo20: this.sumVariables(registros, DICT_RDA.AM_NEUMO20, maxMes),
            td:      this.sumVariables(registros, DICT_RDA.AM_TD, maxMes)
        };
    }

    static aplicacionesEmbarazadas(registros, maxMes) {
        return {
            tdpa: this.sumVariables(registros, DICT_RDA.EMB_TDPA, maxMes),
            vsr:  this.sumVariables(registros, DICT_RDA.EMB_VSR, maxMes)
        };
    }

    static aplicacionesInvernal(registros, maxMes) {
        return {
            influenza: this.sumVariables(registros, DICT_RDA.INFLUENZA, maxMes),
            covid:     this.sumVariables(registros, DICT_RDA.COVID, maxMes)
        };
    }

    // ── CÁLCULO INTEGRAL POR UNIDAD ──

    static calcularPorUnidad(unidad, todosRegistros, meses) {
        const regs = todosRegistros.filter(r => r.clues === unidad.clues);
        const pM1 = unidad.pob_menor_1 || 0;
        const p1A = unidad.pob_1_ano || 0;
        const p4A = unidad.pob_4_anos || 0;

        // Dosis totals for each age group (raw sums used by table)
        const dosisMenor1 = this.sumVariables(regs, [
            ...(DICT_RDA.BCG       || []),
            ...(DICT_RDA.HepB_0_7  || []),
            ...(DICT_RDA.Hexa_3    || []),
            ...(DICT_RDA.Rota_2    || []),
            ...(DICT_RDA.Neumo_2   || [])
        ], meses);
        const dosisUno    = this.sumVariables(regs, [
            ...(DICT_RDA.Hexa_Ref  || []),
            ...(DICT_RDA.Neumo_Ref || []),
            ...(DICT_RDA.SRP_2     || [])
        ], meses);
        const dosisCuatro = this.sumVariables(regs, DICT_RDA.DPT_4 || [], meses);

        return {
            clues: unidad.clues,
            nombre: unidad.nombre || unidad.clues,
            municipio: unidad.municipio || '',
            poblacion: { menor1: pM1, uno: p1A, cuatro: p4A },
            coberturas: {
                menor1: this.coberturaMenor1(regs, pM1, meses),
                uno:    this.cobertura1Ano(regs, p1A, meses),
                cuatro: this.cobertura4Anos(regs, p4A, meses)
            },
            dosis: {
                menor1: dosisMenor1,
                uno:    dosisUno,
                cuatro: dosisCuatro
            },
            adolescentes: this.aplicacionesAdolescentes(regs, meses),
            mayores:      this.aplicacionesMayores(regs, meses),
            embarazadas:  this.aplicacionesEmbarazadas(regs, meses),
            invernal:     this.aplicacionesInvernal(regs, meses)
        };
    }

    // ── CÁLCULO POR MUNICIPIO ──

    static calcularPorMunicipio(municipio, unidades, todosRegistros, meses) {
        const uMuni = unidades.filter(u =>
            (u.municipio || '').toUpperCase().trim() === municipio.toUpperCase().trim()
        );
        const cluesSet = new Set(uMuni.map(u => u.clues));
        const regsMuni = todosRegistros.filter(r => cluesSet.has(r.clues));

        let pM1 = 0, p1A = 0, p4A = 0;
        for (const u of uMuni) {
            pM1 += (u.pob_menor_1 || 0);
            p1A += (u.pob_1_ano || 0);
            p4A += (u.pob_4_anos || 0);
        }

        // Dosis totals for municipality
        const dosisMenor1 = this.sumVariables(regsMuni, [
            ...(DICT_RDA.BCG       || []),
            ...(DICT_RDA.HepB_0_7  || []),
            ...(DICT_RDA.Hexa_3    || []),
            ...(DICT_RDA.Rota_2    || []),
            ...(DICT_RDA.Neumo_2   || [])
        ], meses);
        const dosisUno    = this.sumVariables(regsMuni, [
            ...(DICT_RDA.Hexa_Ref  || []),
            ...(DICT_RDA.Neumo_Ref || []),
            ...(DICT_RDA.SRP_2     || [])
        ], meses);
        const dosisCuatro = this.sumVariables(regsMuni, DICT_RDA.DPT_4 || [], meses);

        return {
            municipio, totalUnidades: uMuni.length,
            poblacion: { menor1: pM1, uno: p1A, cuatro: p4A },
            coberturas: {
                menor1: this.coberturaMenor1(regsMuni, pM1, meses),
                uno:    this.cobertura1Ano(regsMuni, p1A, meses),
                cuatro: this.cobertura4Anos(regsMuni, p4A, meses)
            },
            dosis: {
                menor1: dosisMenor1,
                uno:    dosisUno,
                cuatro: dosisCuatro
            },
            adolescentes: this.aplicacionesAdolescentes(regsMuni, meses),
            mayores:      this.aplicacionesMayores(regsMuni, meses),
            embarazadas:  this.aplicacionesEmbarazadas(regsMuni, meses),
            invernal:     this.aplicacionesInvernal(regsMuni, meses)
        };
    }

    // ── CÁLCULO GLOBAL ──

    static calcularGlobal(unidades, todosRegistros, meses) {
        let pM1 = 0, p1A = 0, p4A = 0;
        for (const u of unidades) {
            pM1 += (u.pob_menor_1 || 0);
            p1A += (u.pob_1_ano || 0);
            p4A += (u.pob_4_anos || 0);
        }
        // Dosis totals for global
        const dosisMenor1 = this.sumVariables(todosRegistros, [
            ...(DICT_RDA.BCG       || []),
            ...(DICT_RDA.HepB_0_7  || []),
            ...(DICT_RDA.Hexa_3    || []),
            ...(DICT_RDA.Rota_2    || []),
            ...(DICT_RDA.Neumo_2   || [])
        ], meses);
        const dosisUno    = this.sumVariables(todosRegistros, [
            ...(DICT_RDA.Hexa_Ref  || []),
            ...(DICT_RDA.Neumo_Ref || []),
            ...(DICT_RDA.SRP_2     || [])
        ], meses);
        const dosisCuatro = this.sumVariables(todosRegistros, DICT_RDA.DPT_4 || [], meses);

        return {
            totalUnidades: unidades.length,
            poblacion: { menor1: pM1, uno: p1A, cuatro: p4A },
            coberturas: {
                menor1: this.coberturaMenor1(todosRegistros, pM1, meses),
                uno:    this.cobertura1Ano(todosRegistros, p1A, meses),
                cuatro: this.cobertura4Anos(todosRegistros, p4A, meses)
            },
            dosis: {
                menor1: dosisMenor1,
                uno:    dosisUno,
                cuatro: dosisCuatro
            },
            adolescentes: this.aplicacionesAdolescentes(todosRegistros, meses),
            mayores:      this.aplicacionesMayores(todosRegistros, meses),
            embarazadas:  this.aplicacionesEmbarazadas(todosRegistros, meses),
            invernal:     this.aplicacionesInvernal(todosRegistros, meses)
        };
    }
}

window.RDA2026Calculator = RDA2026Calculator;
window.DICT_RDA = DICT_RDA;
window.ALL_RDA_VARIABLES = ALL_RDA_VARIABLES;
window.ALL_RDA_SET = ALL_RDA_SET;
