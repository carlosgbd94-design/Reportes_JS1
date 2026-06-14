import { describe, it, expect, beforeEach } from 'vitest';

// Importar el script. Vitest con jsdom expondrá el objeto 'window' globalmente
import '../rda_calculator.js';

describe('RDA2026Calculator', () => {
    let calculator;

    beforeEach(() => {
        calculator = window.RDA2026Calculator;
    });

    it('debe definir la clase en window', () => {
        expect(calculator).toBeDefined();
    });

    it('debe calcular el factor poblacional correctamente', () => {
        // Fórmula: (Poblacion × 0.0833) × Meses
        const factor = calculator.factorPoblacional(100, 2);
        // (100 * 0.0833) * 2 = 8.33 * 2 = 16.66
        expect(factor).toBeCloseTo(16.66);
    });

    it('debe calcular la cobertura de BCG correctamente', () => {
        const registros = [
            { mes: 1, variable_sis: 'VBC01', valor: 5 },
            { mes: 2, variable_sis: 'BIO50', valor: 3 },
            { mes: 3, variable_sis: 'VBC01', valor: 10 } // este registro excede el mes de corte 2
        ];
        
        // pobMenor1 = 100, meses = 2
        // Factor = 16.66
        // Total dosis válidas = 5 + 3 = 8
        // Cobertura = (8 / 16.66) * 100 = 48.019... redondeado a 1 decimal -> 48.0
        const cob = calculator.coberturaBiolBCG(registros, 100, 2);
        expect(cob).toBe(48.0);
    });
});
