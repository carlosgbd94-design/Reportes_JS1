/**
 * rda_parser.js
 * Parser de CSV concentrado SIS — Smart Upsert por MES.
 * Al subir un CSV, detecta los meses incluidos, borra registros previos
 * de esos meses, y luego inserta los nuevos datos.
 *
 * v2: Auto-detección de tipo de CSV (Productividad SIS vs Población).
 */

class RDAParser {
    // Tipo de CSV detectado: 'SIS' | 'POBLACION' | null
    static detectedType = null;

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
                    if (this.detectedType === 'POBLACION') {
                        this.processPoblacionData(this.pendingData);
                    } else {
                        this.processData(this.pendingData);
                    }
                    this.pendingData = null;
                    this.detectedType = null;
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

    /** Busca una columna que contenga alguno de los patrones dados */
    static _findColByPatterns(row, patterns) {
        for (const k of Object.keys(row)) {
            const norm = this._normalizeKey(k);
            if (patterns.some(p => norm.includes(p))) return k;
        }
        return null;
    }

    /**
     * Detecta el tipo de CSV basado en los encabezados.
     * @param {string[]} fields — nombres de columna del CSV
     * @returns {'SIS'|'POBLACION'|null}
     */
    static detectCSVType(fields) {
        const nf = fields.map(f => this._normalizeKey(f));

        const hasClues    = nf.includes("CLUES");
        const hasVariable = nf.includes("VARIABLE");
        const hasValor    = nf.includes("VALOR");
        const hasMes      = nf.includes("MES");
        const hasAnio     = nf.includes("ANO") || nf.includes("ANIO");

        // SIS: tiene las 5 columnas canónicas
        if (hasClues && hasVariable && hasValor && hasMes && hasAnio) return 'SIS';

        // POBLACION: tiene CLUES + al menos una columna de población
        const POB_PATTERNS = ['POB_MENOR', 'MENOR_1', 'MENORES', 'POB_1', '1_ANO', 'POB_4', '4_ANO', 'CUATRO'];
        const hasPobCol = nf.some(f => POB_PATTERNS.some(p => f.includes(p)));
        if (hasClues && hasPobCol) return 'POBLACION';

        return null;
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

        // Reset tipo badge
        const badge = document.getElementById('csvTypeBadge');
        if (badge) badge.style.display = 'none';

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (!results.data || results.data.length === 0) {
                    this._showSchemaError("El archivo CSV está vacío.");
                    return;
                }
                
                // Auto-detectar tipo de CSV
                const fields = results.meta.fields || [];
                this.detectedType = this.detectCSVType(fields);

                if (!this.detectedType) {
                    this._showSchemaError(
                        "Formato no reconocido. El CSV debe ser de tipo Productividad SIS (CLUES, VARIABLE, VALOR, MES, ANO) " +
                        "o de Población (CLUES + columnas de población como POB_MENOR_1, POB_1_ANO, POB_4_ANOS)."
                    );
                    return;
                }

                // Actualizar UI según tipo detectado
                this._updateModalForType(this.detectedType);

                if (this.detectedType === 'SIS') {
                    this.validateAndPreviewData(results.data);
                } else if (this.detectedType === 'POBLACION') {
                    this.validateAndPreviewPoblacion(results.data);
                }
            },
            error: (error) => {
                this._showSchemaError("Error al leer el archivo CSV.");
                console.error("[RDA Parser]", error);
            }
        });
    }

    /** Actualiza el título y badge del modal según tipo detectado */
    static _updateModalForType(type) {
        const titleEl = document.querySelector('#modalUploadCSV h3');
        const subtitleEl = document.querySelector('#modalUploadCSV h3 + p');
        const badge = document.getElementById('csvTypeBadge');
        const monthsWarning = document.getElementById('csvMonthsWarning');

        if (type === 'SIS') {
            if (titleEl) titleEl.textContent = 'Carga de Reporte SIS';
            if (subtitleEl) subtitleEl.textContent = 'Productividad mensual — formato .csv';
            if (badge) { badge.textContent = '📊 PRODUCTIVIDAD SIS'; badge.className = 'inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 mt-2'; badge.style.display = 'inline-flex'; }
        } else if (type === 'POBLACION') {
            if (titleEl) titleEl.textContent = 'Carga de Población';
            if (subtitleEl) subtitleEl.textContent = 'Actualización masiva de datos demográficos';
            if (badge) { badge.textContent = '👥 POBLACIÓN'; badge.className = 'inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 mt-2'; badge.style.display = 'inline-flex'; }
            if (monthsWarning) monthsWarning.style.display = 'none';
        }
    }

    static _showSchemaError(msg) {
        const errorDiv = document.getElementById('csvSchemaError');
        const errorText = document.getElementById('csvSchemaErrorText');
        errorText.textContent = msg;
        errorDiv.style.display = 'flex';
        document.getElementById('csvValidCount').textContent = '0';
        document.getElementById('csvIgnoredCount').textContent = '0';
    }

    // =========================================================================
    // SIS FLOW (original, sin cambios funcionales)
    // =========================================================================

    static validateAndPreviewData(data) {
        let validos = 0;
        let ignorados = 0;
        const mesesEnCSV = new Set();
        
        // Registrar detalles de los registros ignorados
        const reasonCounts = {
            missing: { label: "Falta algún campo requerido (CLUES, Variable, Valor, Mes, Año)", count: 0, examples: [] },
            inventory: { label: "Variables de inventario excluidas (VOI, VOF, VBC5)", count: 0, examples: [] }
        };

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNum = i + 2; // Fila 1 es el header, la primera fila de datos es la 2
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
                reasonCounts.missing.count++;
                if (reasonCounts.missing.examples.length < 5) {
                    reasonCounts.missing.examples.push(`[Fila ${rowNum}] CLUES: ${clues || 'nulo'}, Var: ${variable || 'nulo'}, Valor: ${valorRaw || 'nulo'}`);
                }
                continue;
            }

            const varUpper = variable.toUpperCase();
            if (varUpper.startsWith('VOI') || varUpper.startsWith('VOF') || varUpper.startsWith('VBC5')) {
                ignorados++;
                reasonCounts.inventory.count++;
                if (reasonCounts.inventory.examples.length < 5) {
                    reasonCounts.inventory.examples.push(`[Fila ${rowNum}] Var: ${variable} (${clues})`);
                }
                continue;
            }

            validos++;
            mesesEnCSV.add(mes);
        }

        document.getElementById('csvValidCount').textContent = validos.toLocaleString();
        document.getElementById('csvIgnoredCount').textContent = ignorados.toLocaleString();

        // Mostrar / Ocultar área de detalles ignorados
        const detailsArea = document.getElementById('csvIgnoredDetailsArea');
        const detailsList = document.getElementById('csvIgnoredDetailsList');
        
        if (detailsList) {
            detailsList.innerHTML = '';
            if (ignorados > 0) {
                let html = '';
                if (reasonCounts.missing.count > 0) {
                    html += `
                        <div class="py-1">
                            <span class="font-bold text-slate-800">${reasonCounts.missing.count} registros</span> - ${reasonCounts.missing.label}
                            <ul style="margin: 4px 0 0 16px; padding: 0;" class="text-slate-500 list-disc">
                                ${reasonCounts.missing.examples.map(ex => `<li>${ex}</li>`).join('')}
                                ${reasonCounts.missing.count > 5 ? `<li>... y ${reasonCounts.missing.count - 5} más</li>` : ''}
                            </ul>
                        </div>
                    `;
                }
                if (reasonCounts.inventory.count > 0) {
                    html += `
                        <div class="py-1">
                            <span class="font-bold text-slate-800">${reasonCounts.inventory.count} registros</span> - ${reasonCounts.inventory.label}
                            <ul style="margin: 4px 0 0 16px; padding: 0;" class="text-slate-500 list-disc">
                                ${reasonCounts.inventory.examples.map(ex => `<li>${ex}</li>`).join('')}
                                ${reasonCounts.inventory.count > 5 ? `<li>... y ${reasonCounts.inventory.count - 5} más</li>` : ''}
                            </ul>
                        </div>
                    `;
                }
                detailsList.innerHTML = html;
                detailsArea.style.display = 'block';
            } else {
                detailsArea.style.display = 'none';
            }
        }

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

    static chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    static async rpcUpsert(unidades, registros, meses) {
        const total = registros.length;
        try {
            // 1. Sincronizar unidades médicas (en lotes de 100)
            if (typeof showOverlay === 'function') {
                showOverlay("Sincronizando catálogo de unidades médicas...", "Sincronizando");
            }
            const unitChunks = this.chunkArray(unidades, 100);
            for (let i = 0; i < unitChunks.length; i++) {
                const { error: unitErr } = await window.supabase
                    .from('unidades_medicas')
                    .upsert(unitChunks[i], { onConflict: 'clues', ignoreDuplicates: true });
                if (unitErr) throw new Error(`Error al registrar unidades médicas: ${unitErr.message}`);
            }

            // 2. Limpiar registros previos de los meses en el CSV
            if (typeof showOverlay === 'function') {
                showOverlay("Limpiando registros de meses previos para evitar duplicados...", "Sincronizando");
            }
            const { error: delErr } = await window.supabase
                .from('registros_sis')
                .delete()
                .in('mes', meses);
            if (delErr) throw new Error(`Error al limpiar base de datos: ${delErr.message}`);

            // 3. Insertar nuevos registros en lotes de 5000
            const batchSize = 5000;
            const recordChunks = this.chunkArray(registros, batchSize);
            const totalBatches = recordChunks.length;

            for (let i = 0; i < totalBatches; i++) {
                const start = i * batchSize + 1;
                const end = Math.min((i + 1) * batchSize, total);
                
                if (typeof showOverlay === 'function') {
                    showOverlay(
                        `Enviando lote ${i + 1} de ${totalBatches} (${start.toLocaleString('es-MX')} a ${end.toLocaleString('es-MX')} de ${total.toLocaleString('es-MX')} registros)...`,
                        "Sincronizando"
                    );
                }

                const { error: insErr } = await window.supabase
                    .from('registros_sis')
                    .insert(recordChunks[i]);
                
                if (insErr) throw new Error(`Error en lote ${i + 1}: ${insErr.message}`);
            }

            if (typeof hideOverlay === 'function') hideOverlay();
            
            console.log(`[RDA Parser] ✅ Carga masiva completada: ${total} registros insertados en ${totalBatches} lotes.`);
            if (typeof showToast === 'function') showToast(`${total.toLocaleString('es-MX')} registros actualizados correctamente`, true, 'good');

            // Refrescar el dashboard si está abierto
            if (typeof window.refreshRDADashboard === 'function') {
                window.refreshRDADashboard();
            }

        } catch (err) {
            console.error('[RDA Parser] ❌ Error en carga masiva:', err);
            if (typeof hideOverlay === 'function') hideOverlay();
            if (typeof showToast === 'function') showToast(err.message || 'Error inesperado al subir datos', false, 'bad');
        }
    }

    // =========================================================================
    // POBLACIÓN FLOW (nuevo)
    // =========================================================================

    /** Valida y muestra preview del CSV de población */
    static validateAndPreviewPoblacion(data) {
        const POB_MENOR_PATTERNS = ['POB_MENOR', 'MENOR_1', 'MENORES'];
        const POB_1_PATTERNS     = ['POB_1_ANO', 'POB_1ANO', '1_ANO', 'UN_ANO', 'DE_1_ANO'];
        const POB_4_PATTERNS     = ['POB_4_ANO', 'POB_4ANO', '4_ANO', 'CUATRO', 'DE_4_ANO'];

        let validos = 0;
        let ignorados = 0;

        // Encontrar las columnas reales en el CSV usando la primera fila
        const sampleRow = data[0];
        const colMenor = this._findColByPatterns(sampleRow, POB_MENOR_PATTERNS);
        const col1     = this._findColByPatterns(sampleRow, POB_1_PATTERNS);
        const col4     = this._findColByPatterns(sampleRow, POB_4_PATTERNS);

        if (!colMenor && !col1 && !col4) {
            this._showSchemaError("No se encontraron columnas de población (POB_MENOR_1, POB_1_ANO, POB_4_ANOS).");
            return;
        }

        const reasonCounts = {
            noClues: { label: "Falta el campo CLUES", count: 0, examples: [] },
            noPop: { label: "Faltan valores numéricos de población (menor 1, 1 año, 4 años)", count: 0, examples: [] }
        };

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNum = i + 2;
            const clues = this._getCol(row, 'CLUES');
            if (!clues) { 
                ignorados++; 
                reasonCounts.noClues.count++;
                if (reasonCounts.noClues.examples.length < 5) {
                    reasonCounts.noClues.examples.push(`[Fila ${rowNum}] Sin CLUES`);
                }
                continue; 
            }

            const pMenor = colMenor ? parseInt(row[colMenor], 10) : NaN;
            const p1     = col1     ? parseInt(row[col1], 10)     : NaN;
            const p4     = col4     ? parseInt(row[col4], 10)     : NaN;

            // Al menos un valor de población debe ser numérico
            if (isNaN(pMenor) && isNaN(p1) && isNaN(p4)) { 
                ignorados++; 
                reasonCounts.noPop.count++;
                if (reasonCounts.noPop.examples.length < 5) {
                    reasonCounts.noPop.examples.push(`[Fila ${rowNum}] CLUES: ${clues}`);
                }
                continue; 
            }

            validos++;
        }

        // Actualizar contadores — reusar los mismos IDs del modal
        document.getElementById('csvValidCount').textContent = validos.toLocaleString();
        document.getElementById('csvIgnoredCount').textContent = ignorados.toLocaleString();

        // Mostrar / Ocultar área de detalles ignorados
        const detailsArea = document.getElementById('csvIgnoredDetailsArea');
        const detailsList = document.getElementById('csvIgnoredDetailsList');
        
        if (detailsList) {
            detailsList.innerHTML = '';
            if (ignorados > 0) {
                let html = '';
                if (reasonCounts.noClues.count > 0) {
                    html += `
                        <div class="py-1">
                            <span class="font-bold text-slate-800">${reasonCounts.noClues.count} registros</span> - ${reasonCounts.noClues.label}
                            <ul style="margin: 4px 0 0 16px; padding: 0;" class="text-slate-500 list-disc">
                                ${reasonCounts.noClues.examples.map(ex => `<li>${ex}</li>`).join('')}
                            </ul>
                        </div>
                    `;
                }
                if (reasonCounts.noPop.count > 0) {
                    html += `
                        <div class="py-1">
                            <span class="font-bold text-slate-800">${reasonCounts.noPop.count} registros</span> - ${reasonCounts.noPop.label}
                            <ul style="margin: 4px 0 0 16px; padding: 0;" class="text-slate-500 list-disc">
                                ${reasonCounts.noPop.examples.map(ex => `<li>${ex}</li>`).join('')}
                                ${reasonCounts.noPop.count > 5 ? `<li>... y ${reasonCounts.noPop.count - 5} más</li>` : ''}
                            </ul>
                        </div>
                    `;
                }
                detailsList.innerHTML = html;
                detailsArea.style.display = 'block';
            } else {
                detailsArea.style.display = 'none';
            }
        }

        if (validos > 0) {
            this.pendingData = data;
            // Guardar las columnas detectadas para el procesamiento posterior
            this._pobCols = { colMenor, col1, col4 };
            document.getElementById('btnConfirmUploadCSV').classList.remove('opacity-50', 'pointer-events-none');

            // Mostrar aviso de población en lugar de aviso de meses
            const warn = document.getElementById('csvMonthsWarning');
            if (warn) {
                const h5 = warn.querySelector('h5');
                const p = warn.querySelector('p');
                if (h5) h5.textContent = 'Actualización de Población';
                if (p) p.innerHTML = `Se actualizarán los datos demográficos de <strong>${validos}</strong> unidades médicas. ` +
                    `Columnas detectadas: ${[colMenor, col1, col4].filter(Boolean).join(', ')}.`;
                warn.style.display = 'block';
            }
        } else {
            this._showSchemaError("No se encontraron registros válidos de población.");
        }
    }

    /** Procesa y envía datos de población al RPC */
    static async processPoblacionData(data) {
        if (typeof showOverlay === 'function') showOverlay("Actualizando población...", "Procesando");

        const { colMenor, col1, col4 } = this._pobCols || {};
        const payload = [];

        for (const row of data) {
            const clues = this._getCol(row, 'CLUES');
            if (!clues) continue;

            const pMenor = colMenor ? parseInt(row[colMenor], 10) : NaN;
            const p1     = col1     ? parseInt(row[col1], 10)     : NaN;
            const p4     = col4     ? parseInt(row[col4], 10)     : NaN;

            if (isNaN(pMenor) && isNaN(p1) && isNaN(p4)) continue;

            payload.push({
                clues,
                pob_menor_1: isNaN(pMenor) ? 0 : pMenor,
                pob_1_ano:   isNaN(p1)     ? 0 : p1,
                pob_4_anos:  isNaN(p4)     ? 0 : p4
            });
        }

        console.log(`[RDA Parser] 👥 Enviando ${payload.length} registros de población...`);

        try {
            const { data: result, error } = await window.supabase.rpc('upsert_poblacion_data', {
                p_data: payload
            });

            if (typeof hideOverlay === 'function') hideOverlay();

            if (error) {
                console.error('[RDA Parser] ❌ Error en upsert_poblacion_data:', error);
                if (typeof showToast === 'function') showToast(`Error: ${error.message}`, false, 'bad');
                return;
            }

            const updated = result?.registros_actualizados ?? 0;
            const total   = result?.total_enviados ?? payload.length;
            console.log(`[RDA Parser] ✅ Población actualizada: ${updated}/${total} registros`);
            if (typeof showToast === 'function') showToast(`Población actualizada: ${updated} unidades`, true, 'good');

        } catch (err) {
            console.error('[RDA Parser] ❌ Error fatal en processPoblacionData:', err);
            if (typeof hideOverlay === 'function') hideOverlay();
            if (typeof showToast === 'function') showToast(err.message || 'Error inesperado', false, 'bad');
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
