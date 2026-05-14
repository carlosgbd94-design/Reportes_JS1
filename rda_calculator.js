/**
 * rda_calculator.js — Motor de Cálculo RDA 2026 v6
 * Fórmulas federales + aplicaciones por grupo demográfico.
 */

// ══════════════════════════════════════════════════════════════
// DICCIONARIO COMPLETO DE VARIABLES SIS
// ══════════════════════════════════════════════════════════════
const DICT_RDA = {
    // ── ESQUEMA BÁSICO 0-8 AÑOS (Fórmula Federal RDA) ──
    BCG:        ['VBC01', 'VBC02', 'BIO50'],
    HepB_0_7:   ['VAC06'],
    Hexa_3:     ['VAC69'],
    Rota_2:     ['VRV02'],
    Neumo_2:    ['VAC18', 'VCC02'],
    Hexa_Ref:   ['VAC70'],
    Neumo_Ref:  ['VAC19', 'VCC03'],
    SRP_2:      ['VTV01'],
    DPT_4:      ['VAC12'],

    // ── ADOLESCENTES Y ADULTOS (Solo aplicaciones) ──
    ADOL_HB:  ['VHB01','VHB02','VHB03','VHB04','VHB05','VHB06'],
    ADOL_SR:  ['VDV01','VDV02','VDV03','VDV04','VDV05','VDV06'],
    ADOL_VPH: ['VPH05','VPH06','VPH07','VPH08','VPH12','VPH13','VPH14'],
    ADOL_TD:  ['VAC39','VAC40','VAC47','VAC48','VTD01','VTD02','VAC55','VAC56',
               'VTT01','VTT02','VTT04','VTT05','VTT07','VTT08','VTT10','VTT11'],

    // ── ADULTOS MAYORES (Solo aplicaciones) ──
    AM_NEUMO13: ['VNC04'],
    AM_NEUMO20: ['VCC07'],
    AM_TD:      ['VTT03','VTT06','VTT09','VTT12'],

    // ── EMBARAZADAS (Solo aplicaciones) ──
    EMB_TDPA: ['VAC63'],
    EMB_VSR:  ['VS001'],

    // ── TEMPORADA INVERNAL (Solo aplicaciones) ──
    INFLUENZA: [
        'BIE01','BIE28','BIE29','BIE30','BIE31','BIE04','BIE32','BIE33',
        'BIE34','BIE35','BIE36','BIE37','BIE38','BIE39','BIE40','BIO96',
        'BIO97','BIE09','BIE10','BIE41','BIE12','BIE13','BIE42','BIE15',
        'BIE16','BIE43','BIE18','BIE19','BIE44','BIE48','BIE49','BIE50',
        'BIE24','BIE25','BIE46','BIE51','BIE52','BIE53','BIE54','BIE55',
        'BIE56','BIE57','BIE58','BIE59','BIE60','BIE61'
    ],
    COVID: ['VCV38','VCV39','VCV40','VCV28','VCV16','VCV20','VCV21']
};

// Set rápido para filtrado en parser
const ALL_RDA_VARIABLES = Object.values(DICT_RDA).flat();
const ALL_RDA_SET = new Set(ALL_RDA_VARIABLES);

// ══════════════════════════════════════════════════════════════
// CLASE PRINCIPAL
// ══════════════════════════════════════════════════════════════
class RDA2026Calculator {

    /** Suma dosis de variables dentro de registros hasta maxMes */
    static sumVariables(registros, varList, maxMes) {
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
            hb:  this.sumVariables(registros, DICT_RDA.ADOL_HB, maxMes),
            sr:  this.sumVariables(registros, DICT_RDA.ADOL_SR, maxMes),
            vph: this.sumVariables(registros, DICT_RDA.ADOL_VPH, maxMes),
            td:  this.sumVariables(registros, DICT_RDA.ADOL_TD, maxMes)
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
        const dosisMenor1 = this.sumVariables(regs, [...DICT_RDA.BCG,...DICT_RDA.HepB_0_7,...DICT_RDA.Hexa_3,...DICT_RDA.Rota_2,...DICT_RDA.Neumo_2], meses);
        const dosisUno    = this.sumVariables(regs, [...DICT_RDA.Hexa_Ref,...DICT_RDA.Neumo_Ref,...DICT_RDA.SRP_2], meses);
        const dosisCuatro = this.sumVariables(regs, DICT_RDA.DPT_4, meses);

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
        const dosisMenor1 = this.sumVariables(regsMuni, [...DICT_RDA.BCG,...DICT_RDA.HepB_0_7,...DICT_RDA.Hexa_3,...DICT_RDA.Rota_2,...DICT_RDA.Neumo_2], meses);
        const dosisUno    = this.sumVariables(regsMuni, [...DICT_RDA.Hexa_Ref,...DICT_RDA.Neumo_Ref,...DICT_RDA.SRP_2], meses);
        const dosisCuatro = this.sumVariables(regsMuni, DICT_RDA.DPT_4, meses);

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
        const dosisMenor1 = this.sumVariables(todosRegistros, [...DICT_RDA.BCG,...DICT_RDA.HepB_0_7,...DICT_RDA.Hexa_3,...DICT_RDA.Rota_2,...DICT_RDA.Neumo_2], meses);
        const dosisUno    = this.sumVariables(todosRegistros, [...DICT_RDA.Hexa_Ref,...DICT_RDA.Neumo_Ref,...DICT_RDA.SRP_2], meses);
        const dosisCuatro = this.sumVariables(todosRegistros, DICT_RDA.DPT_4, meses);

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
