/**
 * rda_parser.js
 * Parser de CSV concentrado SIS — Smart Upsert por MES.
 * Al subir un CSV, detecta los meses incluidos, borra registros previos
 * de esos meses, y luego inserta los nuevos datos.
 */

class RDAParser {
    static init() {
        const fileInput = document.getElementById('rdaCsvInput');
        const btnConfirm = document.getElementById('btnConfirmUploadCSV');

        if (fileInput) {
            fileInput.addEventListener('change', () => {
                if (!fileInput.files.length) return;
                const file = fileInput.files[0];
                this.parseCSVAndPreview(file);
            });
        }

        if (btnConfirm) {
            btnConfirm.addEventListener('click', () => {
                if (this.pendingData) {
                    document.getElementById('modalUploadCSV').classList.remove('show');
                    this.processData(this.pendingData);
                    this.pendingData = null;
                }
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

    static parseCSVAndPreview(file) {
        document.getElementById('csvSchemaError').style.display = 'none';
        
        // Show basic file info
        document.getElementById('csvDropZone').style.display = 'none';
        document.getElementById('csvPreviewArea').style.display = 'flex';
        document.getElementById('csvFileName').textContent = file.name;
        document.getElementById('csvFileSize').textContent = (file.size / 1024).toFixed(2) + ' KB';
        document.getElementById('btnConfirmUploadCSV').classList.add('opacity-50', 'pointer-events-none');
        document.getElementById('csvValidCount').textContent = '...';
        document.getElementById('csvIgnoredCount').textContent = '...';
        document.getElementById('csvMonthsWarning').style.display = 'none';

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (!results.data || results.data.length === 0) {
                    this._showSchemaError("El archivo CSV está vacío.");
                    return;
                }
                
                // Validate Schema headers
                const fields = results.meta.fields || [];
                const normalizedFields = fields.map(f => this._normalizeKey(f));
                
                const hasClues = normalizedFields.includes("CLUES");
                const hasVariable = normalizedFields.includes("VARIABLE");
                const hasValor = normalizedFields.includes("VALOR");
                const hasMes = normalizedFields.includes("MES");
                const hasAnio = normalizedFields.includes("ANO") || normalizedFields.includes("ANIO");

                if (!hasClues || !hasVariable || !hasValor || !hasMes || !hasAnio) {
                    this._showSchemaError("Faltan columnas requeridas. El CSV debe contener: CLUES, VARIABLE, VALOR, MES, y ANO/ANIO.");
                    return;
                }

                this.validateAndPreviewData(results.data);
            },
            error: (error) => {
                this._showSchemaError("Error al leer el archivo CSV.");
                console.error("[RDA Parser]", error);
            }
        });
    }

    static _showSchemaError(msg) {
        const errorDiv = document.getElementById('csvSchemaError');
        const errorText = document.getElementById('csvSchemaErrorText');
        errorText.textContent = msg;
        errorDiv.style.display = 'flex';
        document.getElementById('csvValidCount').textContent = '0';
        document.getElementById('csvIgnoredCount').textContent = '0';
    }

    static validateAndPreviewData(data) {
        let validos = 0;
        let ignorados = 0;
        const mesesEnCSV = new Set();

        for (const row of data) {
            const clues    = this._getCol(row, 'CLUES');
            const variable = this._getCol(row, 'VARIABLE');
            const valorRaw = this._getCol(row, 'VALOR');
            const mesRaw   = this._getCol(row, 'MES');
            const anioRaw  = this._getCol(row, 'ANO') || this._getCol(row, 'ANIO');

            const valor = parseInt(valorRaw, 10);
            const mes   = parseInt(mesRaw, 10);
            const anio  = parseInt(anioRaw, 10);

            if (!clues || !variable || isNaN(valor) || isNaN(mes) || isNaN(anio)) {
                ignorados++;
                continue;
            }

            const varUpper = variable.toUpperCase();
            if (varUpper.startsWith('VOI') || varUpper.startsWith('VOF') || varUpper.startsWith('VBC5')) {
                ignorados++;
                continue;
            }

            validos++;
            mesesEnCSV.add(mes);
        }

        document.getElementById('csvValidCount').textContent = validos.toLocaleString();
        document.getElementById('csvIgnoredCount').textContent = ignorados.toLocaleString();

        if (validos > 0) {
            this.pendingData = data; // Guardar para confirmación
            document.getElementById('btnConfirmUploadCSV').classList.remove('opacity-50', 'pointer-events-none');
            
            const mesesArray = [...mesesEnCSV].sort((a, b) => a - b);
            if (mesesArray.length > 0) {
                document.getElementById('csvMonthsList').textContent = mesesArray.join(', ');
                document.getElementById('csvMonthsWarning').style.display = 'block';
            }
        } else {
            this._showSchemaError("No se encontraron registros válidos para subir (todos fueron ignorados).");
        }
    }

    static async processData(data) {
        if (typeof showOverlay === 'function') showOverlay("Procesando datos...", "Analizando");

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

        const mesesArray = [...mesesEnCSV].sort((a, b) => a - b);
        console.log(`[RDA Parser] CSV procesado: ${data.length} filas → ${cleanData.length} registros válidos (${skippedInventory} inventario excluido)`);
        console.log(`[RDA Parser] CLUES únicas: ${Object.keys(uniqueUnits).length} | Meses: ${mesesArray.join(', ')}`);

        if (cleanData.length === 0) {
            if (typeof hideOverlay === 'function') hideOverlay();
            if (typeof showToast === 'function') showToast('No se encontraron datos válidos', false, 'warn');
            return;
        }

        // 2. Llamada RPC atómica — Una sola transacción: upsert unidades + borrado + inserción masiva.
        //    Si se pierde la conexión a la mitad, Postgres hace rollback automático y la BD
        //    queda íntegra. Se reemplaza el antiguo sistema de múltiples peticiones secuenciales.
        await this.rpcUpsert(Object.values(uniqueUnits), cleanData, mesesArray);
    }

    static async rpcUpsert(unidades, registros, meses) {
        const total = registros.length;
        if (typeof showOverlay === 'function') {
            showOverlay(`Enviando ${total.toLocaleString()} registros a la base de datos...`, "Sincronizando");
        }

        try {
            const { data: result, error } = await window.supabase.rpc('upsert_registros_sis', {
                p_unidades: unidades,
                p_registros: registros,
                p_meses: meses
            });

            if (typeof hideOverlay === 'function') hideOverlay();

            if (error) {
                console.error('[RDA Parser] ❌ Error en RPC upsert:', error);
                if (typeof showToast === 'function') showToast(`Error al sincronizar: ${error.message}`, false, 'bad');
                return;
            }

            if (result && result.ok === false) {
                console.error('[RDA Parser] ❌ Error en la función SQL:', result.error);
                if (typeof showToast === 'function') showToast(`Error en base de datos: ${result.error}`, false, 'bad');
                return;
            }

            const ins = result?.registros_insertados ?? total;
            const del = result?.registros_eliminados ?? 0;
            console.log(`[RDA Parser] ✅ RPC completado: ${ins} insertados, ${del} eliminados (meses anteriores), ${result?.unidades_nuevas ?? 0} unidades nuevas`);
            if (typeof showToast === 'function') showToast(`${ins.toLocaleString()} registros actualizados correctamente`, true, 'good');

            // Refrescar el dashboard si está abierto
            if (typeof window.refreshRDADashboard === 'function') {
                window.refreshRDADashboard();
            }

        } catch (err) {
            console.error('[RDA Parser] ❌ Error fatal en rpcUpsert:', err);
            if (typeof hideOverlay === 'function') hideOverlay();
            if (typeof showToast === 'function') showToast(err.message || 'Error inesperado al subir datos', false, 'bad');
        }
    }
}

window.addEventListener('DOMContentLoaded', () => RDAParser.init());

window.handleCsvDrop = function(event) {
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        const file = event.dataTransfer.files[0];
        document.getElementById('rdaCsvInput').files = event.dataTransfer.files;
        RDAParser.parseCSVAndPreview(file);
    }
};
