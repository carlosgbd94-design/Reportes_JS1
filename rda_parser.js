/**
 * rda_parser.js
 * Parser de CSV concentrado SIS — Smart Upsert por MES.
 * Al subir un CSV, detecta los meses incluidos, borra registros previos
 * de esos meses, y luego inserta los nuevos datos.
 */

const ALLOWED_BIO = ['BIO50'];

class RDAParser {
    static init() {
        const fileInput = document.getElementById('rdaCsvInput');
        const uploadBtn = document.getElementById('btnUploadRdaCsv');

        if (fileInput && uploadBtn) {
            uploadBtn.addEventListener('click', () => fileInput.click());

            fileInput.addEventListener('change', () => {
                if (!fileInput.files.length) return;
                const file = fileInput.files[0];
                this.parseCSV(file);
                fileInput.value = '';
            });
        }
    }

    /** Normaliza un nombre de columna (quita tildes, espacios, mayúsculas) */
    static _normalizeKey(str) {
        return String(str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    }

    /** Busca una columna en un row de CSV de forma resiliente */
    static _getCol(row, keyName) {
        const search = this._normalizeKey(keyName);
        const key = Object.keys(row).find(k => this._normalizeKey(k) === search);
        return key ? (row[key] || '').toString().trim() : null;
    }

    static parseCSV(file) {
        if (typeof showOverlay === 'function') showOverlay("Leyendo archivo CSV...", "Procesando");

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.errors.length > 0) {
                    console.warn("[RDA Parser] Warnings:", results.errors);
                }
                if (!results.data || results.data.length === 0) {
                    if (typeof hideOverlay === 'function') hideOverlay();
                    if (typeof showToast === 'function') showToast('El archivo CSV está vacío', false, 'bad');
                    return;
                }
                this.processData(results.data);
            },
            error: (error) => {
                if (typeof hideOverlay === 'function') hideOverlay();
                if (typeof showToast === 'function') showToast('Error al leer CSV', false, 'bad');
                console.error("[RDA Parser]", error);
            }
        });
    }

    static async processData(data) {
        if (typeof showOverlay === 'function') showOverlay("Procesando datos...", "Limpiando");

        // 1. Parsear y filtrar datos
        const cleanData = [];
        const uniqueUnits = {};
        const mesesEnCSV = new Set();

        for (const row of data) {
            const clues    = this._getCol(row, 'CLUES');
            const variable = this._getCol(row, 'VARIABLE');
            const valorRaw = this._getCol(row, 'VALOR');
            const mesRaw   = this._getCol(row, 'MES');
            const anioRaw  = this._getCol(row, 'ANO') || this._getCol(row, 'ANIO');
            const municipio = this._getCol(row, 'MUNICIPIO') || 'DESCONOCIDO';

            const valor = parseInt(valorRaw, 10);
            const mes   = parseInt(mesRaw, 10);
            const anio  = parseInt(anioRaw, 10);

            if (!clues || !variable || isNaN(valor) || isNaN(mes) || isNaN(anio)) continue;

            const varUpper = variable.toUpperCase();

            // Filtrado: excluir VOI, VOF, VBC5, BIE/BIO sin impacto
            if (varUpper.startsWith('VOI') || varUpper.startsWith('VOF') || varUpper.startsWith('VBC5')) continue;
            if ((varUpper.startsWith('BIE') || varUpper.startsWith('BIO')) && !ALLOWED_BIO.includes(varUpper)) continue;

            cleanData.push({
                clues: clues,
                variable_sis: varUpper,
                valor: valor,
                mes: mes,
                anio: anio
            });

            mesesEnCSV.add(mes);

            // Recolectar unidades únicas para auto-upsert
            if (!uniqueUnits[clues]) {
                uniqueUnits[clues] = {
                    clues: clues,
                    nombre: `UNIDAD ${clues}`,
                    municipio: municipio.toUpperCase()
                };
            }
        }

        if (cleanData.length === 0) {
            if (typeof hideOverlay === 'function') hideOverlay();
            if (typeof showToast === 'function') showToast('No se encontraron datos válidos', false, 'warn');
            return;
        }

        const mesesArray = [...mesesEnCSV].sort((a, b) => a - b);
        const mesesStr = mesesArray.join(', ');
        console.log(`[RDA Parser] ${cleanData.length} registros válidos. Meses detectados: ${mesesStr}`);

        // 2. Auto-upsert de unidades médicas (evitar FK errors)
        const unitsToUpsert = Object.values(uniqueUnits);
        if (unitsToUpsert.length > 0) {
            if (typeof showOverlay === 'function') showOverlay(`Sincronizando ${unitsToUpsert.length} unidades...`, "Catálogo");
            const { error: unitError } = await window.supabase
                .from('unidades_medicas')
                .upsert(unitsToUpsert, { onConflict: 'clues', ignoreDuplicates: true });

            if (unitError) {
                console.warn("[RDA Parser] Error al sync unidades (continuando):", unitError);
            }
        }

        // 3. Smart Delete: borrar registros existentes de los meses que vienen en el CSV
        if (typeof showOverlay === 'function') showOverlay(`Limpiando meses existentes: ${mesesStr}...`, "Sincronizando");

        for (const mes of mesesArray) {
            const { error: delError } = await window.supabase
                .from('registros_sis')
                .delete()
                .eq('mes', mes);

            if (delError) {
                console.error(`[RDA Parser] Error al borrar mes ${mes}:`, delError);
                if (typeof hideOverlay === 'function') hideOverlay();
                if (typeof showToast === 'function') showToast(`Error al limpiar mes ${mes}`, false, 'bad');
                return;
            }
        }

        // 4. Bulk Insert
        await this.bulkInsert(cleanData);
    }

    static async bulkInsert(cleanData) {
        if (typeof showOverlay === 'function') showOverlay(`Subiendo ${cleanData.length} registros...`, "Guardando");

        try {
            const BATCH_SIZE = 500;
            let success = 0;

            for (let i = 0; i < cleanData.length; i += BATCH_SIZE) {
                const batch = cleanData.slice(i, i + BATCH_SIZE);
                const pct = Math.round(((i + batch.length) / cleanData.length) * 100);
                if (typeof showOverlay === 'function') showOverlay(`Subiendo registros... ${pct}%`, "Guardando en BD");

                const { error } = await window.supabase
                    .from('registros_sis')
                    .insert(batch);

                if (error) {
                    console.error("[RDA Parser] Batch error:", error);
                    throw new Error(`Error en inserción: ${error.message}`);
                }
                success += batch.length;
            }

            if (typeof hideOverlay === 'function') hideOverlay();
            if (typeof showToast === 'function') showToast(`${success} registros actualizados correctamente`, true, 'good');

            // Refrescar el dashboard si está abierto
            if (typeof window.refreshRDADashboard === 'function') {
                window.refreshRDADashboard();
            }

        } catch (error) {
            if (typeof hideOverlay === 'function') hideOverlay();
            if (typeof showToast === 'function') showToast(error.message, false, 'bad');
        }
    }
}

window.addEventListener('DOMContentLoaded', () => RDAParser.init());
