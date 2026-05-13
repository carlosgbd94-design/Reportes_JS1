/**
 * rda_calculator.js
 * Motor de cálculo RDA 2026 — Fórmulas federales de coberturas de vacunación.
 * Soporta cálculo por unidad individual, por municipio (agregado) y global.
 */

const DICT_RDA = {
    BCG:        ['VBC01', 'VBC02', 'BIO50'],
    HepB_0_7:   ['VAC06'],
    Hexa_3:     ['VAC69'],
    Rota_2:     ['VRV02'],
    Neumo_2:    ['VAC18', 'VCC02'],   // 13 y 20 valentes
    Hexa_Ref:   ['VAC70'],
    Neumo_Ref:  ['VAC19', 'VCC03'],
    SRP_2:      ['VTV01'],            // Ignorar VAC23 para el promedio
    DPT_4:      ['VAC12']
};

// Todas las variables que el cálculo necesita (para filtrado eficiente)
const ALL_RDA_VARIABLES = Object.values(DICT_RDA).flat();

class RDA2026Calculator {

    /**
     * Suma dosis de un grupo de variables dentro de un array de registros.
     * @param {Array} registros — [{variable_sis, valor, mes, clues}, ...]
     * @param {Array} varList — Array de variable_sis a sumar
     * @param {Number} maxMes — Mes tope (inclusive)
     * @returns {Number}
     */
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

    /**
     * Factor poblacional federal: (Poblacion * 0.0833) * Meses_Transcurridos
     */
    static factorPoblacional(poblacion, meses) {
        if (!poblacion || poblacion <= 0) return 1; // Evitar /0
        return (poblacion * 0.0833) * meses;
    }

    /**
     * Cobertura < 1 Año (Federal)
     * ((Suma(BCG + HepB + Hexa3 + Rota2 + Neumo2) / 4) / factor) * 100
     */
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

    /**
     * Cobertura 1 Año (Federal)
     * ((Suma(HexaRef + NeumoRef + SRP2) / 3) / factor) * 100
     */
    static cobertura1Ano(registros, pob1Ano, meses) {
        const factor = this.factorPoblacional(pob1Ano, meses);
        const total = this.sumVariables(registros, DICT_RDA.Hexa_Ref, meses)
                    + this.sumVariables(registros, DICT_RDA.Neumo_Ref, meses)
                    + this.sumVariables(registros, DICT_RDA.SRP_2, meses);
        const cob = ((total / 3) / factor) * 100;
        return isFinite(cob) ? Math.round(cob * 10) / 10 : 0;
    }

    /**
     * Cobertura 4 Años (Federal)
     * (DPT4 / factor) * 100
     */
    static cobertura4Anos(registros, pob4Anos, meses) {
        const factor = this.factorPoblacional(pob4Anos, meses);
        const total = this.sumVariables(registros, DICT_RDA.DPT_4, meses);
        const cob = (total / factor) * 100;
        return isFinite(cob) ? Math.round(cob * 10) / 10 : 0;
    }

    /**
     * Calcula las 3 coberturas para un conjunto de registros y poblaciones.
     * @returns {{ menor1: Number, uno: Number, cuatro: Number }}
     */
    static calcular(registros, pobMenor1, pob1Ano, pob4Anos, meses) {
        return {
            menor1: this.coberturaMenor1(registros, pobMenor1, meses),
            uno:    this.cobertura1Ano(registros, pob1Ano, meses),
            cuatro: this.cobertura4Anos(registros, pob4Anos, meses)
        };
    }

    /**
     * Cálculo por UNIDAD individual.
     * @param {Object} unidad — { clues, pob_menor_1, pob_1_ano, pob_4_anos, nombre, municipio }
     * @param {Array} todosRegistros — Todos los registros cargados
     * @param {Number} meses — Meses transcurridos
     */
    static calcularPorUnidad(unidad, todosRegistros, meses) {
        const regs = todosRegistros.filter(r => r.clues === unidad.clues);
        return {
            clues: unidad.clues,
            nombre: unidad.nombre || unidad.clues,
            municipio: unidad.municipio || '',
            poblacion: {
                menor1: unidad.pob_menor_1 || 0,
                uno: unidad.pob_1_ano || 0,
                cuatro: unidad.pob_4_anos || 0
            },
            coberturas: this.calcular(
                regs,
                unidad.pob_menor_1 || 0,
                unidad.pob_1_ano || 0,
                unidad.pob_4_anos || 0,
                meses
            )
        };
    }

    /**
     * Cálculo por MUNICIPIO (agrega poblaciones y dosis de todas las unidades del municipio).
     * @param {String} municipio — Nombre del municipio
     * @param {Array} unidades — Todas las unidades
     * @param {Array} todosRegistros — Todos los registros
     * @param {Number} meses
     */
    static calcularPorMunicipio(municipio, unidades, todosRegistros, meses) {
        const unidadesMuni = unidades.filter(u =>
            (u.municipio || '').toUpperCase().trim() === municipio.toUpperCase().trim()
        );
        const cluesList = unidadesMuni.map(u => u.clues);
        const regsMuni = todosRegistros.filter(r => cluesList.includes(r.clues));

        // Sumar poblaciones del municipio
        let pobMenor1 = 0, pob1Ano = 0, pob4Anos = 0;
        for (const u of unidadesMuni) {
            pobMenor1 += (u.pob_menor_1 || 0);
            pob1Ano   += (u.pob_1_ano || 0);
            pob4Anos  += (u.pob_4_anos || 0);
        }

        return {
            municipio: municipio,
            totalUnidades: unidadesMuni.length,
            poblacion: { menor1: pobMenor1, uno: pob1Ano, cuatro: pob4Anos },
            coberturas: this.calcular(regsMuni, pobMenor1, pob1Ano, pob4Anos, meses),
            unidades: unidadesMuni
        };
    }

    /**
     * Cálculo GLOBAL (todas las unidades visibles).
     */
    static calcularGlobal(unidades, todosRegistros, meses) {
        let pobMenor1 = 0, pob1Ano = 0, pob4Anos = 0;
        for (const u of unidades) {
            pobMenor1 += (u.pob_menor_1 || 0);
            pob1Ano   += (u.pob_1_ano || 0);
            pob4Anos  += (u.pob_4_anos || 0);
        }
        return {
            totalUnidades: unidades.length,
            poblacion: { menor1: pobMenor1, uno: pob1Ano, cuatro: pob4Anos },
            coberturas: this.calcular(todosRegistros, pobMenor1, pob1Ano, pob4Anos, meses)
        };
    }

    /**
     * Retorna meses transcurridos según el trimestre.
     * T1=3, T2=6, T3=9, T4=12
     */
    static mesesPorTrimestre(trimestre) {
        return Math.min(Math.max(trimestre, 1), 4) * 3;
    }
}

window.RDA2026Calculator = RDA2026Calculator;
window.DICT_RDA = DICT_RDA;
window.ALL_RDA_VARIABLES = ALL_RDA_VARIABLES;
