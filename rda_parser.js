/**
 * rda_parser.js
 * Parser de CSV concentrado SIS — Smart Upsert por MES.
 * Al subir un CSV, detecta los meses incluidos, borra registros previos
 * de esos meses, y luego inserta los nuevos datos.
 */

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
        let skippedInventory = 0;

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

            // Solo excluir variables de inventario (no son aplicaciones)
            if (varUpper.startsWith('VOI') || varUpper.startsWith('VOF') || varUpper.startsWith('VBC5')) {
                skippedInventory++;
                continue;
            }

            // ⚠️ NO filtrar por ALL_RDA_SET — guardar TODAS las variables de aplicaciones.
            // El calculator selecciona las que necesita. Así no perdemos datos si
            // se agregan nuevas variables al diccionario en el futuro.

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

        console.log(`[RDA Parser] CSV procesado: ${data.length} filas → ${cleanData.length} registros válidos (${skippedInventory} inventario excluido)`);
        console.log(`[RDA Parser] CLUES únicas: ${Object.keys(uniqueUnits).length} | Meses: ${[...mesesEnCSV].sort().join(', ')}`);

        if (cleanData.length === 0) {
            if (typeof hideOverlay === 'function') hideOverlay();
            if (typeof showToast === 'function') showToast('No se encontraron datos válidos', false, 'warn');
            return;
        }

        const mesesArray = [...mesesEnCSV].sort((a, b) => a - b);
        const mesesStr = mesesArray.join(', ');

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

        // 4. Bulk Insert — batches pequeños para evitar truncamiento
        await this.bulkInsert(cleanData);
    }

    static async bulkInsert(cleanData) {
        if (typeof showOverlay === 'function') showOverlay(`Subiendo ${cleanData.length} registros...`, "Guardando");

        try {
            // Batches de 200 para evitar timeouts y errores de Supabase
            const BATCH_SIZE = 200;
            let success = 0;
            let errors = 0;
            const totalBatches = Math.ceil(cleanData.length / BATCH_SIZE);

            for (let i = 0; i < cleanData.length; i += BATCH_SIZE) {
                const batch = cleanData.slice(i, i + BATCH_SIZE);
                const batchNum = Math.floor(i / BATCH_SIZE) + 1;
                const pct = Math.round(((i + batch.length) / cleanData.length) * 100);
                if (typeof showOverlay === 'function') {
                    showOverlay(`Subiendo registros... ${pct}% (lote ${batchNum}/${totalBatches})`, "Guardando en BD");
                }

                const { error } = await window.supabase
                    .from('registros_sis')
                    .insert(batch);

                if (error) {
                    errors++;
                    console.error(`[RDA Parser] ❌ Error lote ${batchNum}/${totalBatches}:`, error.message);
                    console.error(`[RDA Parser] Muestra del lote fallido:`, batch.slice(0, 2));
                    // NO detener — continuar con siguientes lotes para maximizar datos cargados
                    continue;
                }
                success += batch.length;
            }

            if (typeof hideOverlay === 'function') hideOverlay();
            
            if (errors > 0) {
                const msg = `${success} registros cargados (${errors} lotes con error)`;
                console.warn(`[RDA Parser] ⚠️ ${msg}`);
                if (typeof showToast === 'function') showToast(msg, false, 'warn');
            } else {
                console.log(`[RDA Parser] ✅ ${success} registros cargados correctamente`);
                if (typeof showToast === 'function') showToast(`${success} registros actualizados correctamente`, true, 'good');
            }

            // Refrescar el dashboard si está abierto
            if (typeof window.refreshRDADashboard === 'function') {
                window.refreshRDADashboard();
            }

        } catch (error) {
            console.error("[RDA Parser] Error fatal:", error);
            if (typeof hideOverlay === 'function') hideOverlay();
            if (typeof showToast === 'function') showToast(error.message, false, 'bad');
        }
    }
}

window.addEventListener('DOMContentLoaded', () => RDAParser.init());
