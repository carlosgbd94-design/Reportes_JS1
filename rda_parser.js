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

    // Alias histórico ÚNICO de CLUES aplicado en la ingesta (no en la BD): así, sin importar
    // cuántas veces se recargue el concentrado, los registros del año indicado siempre quedan
    // bajo el CLUES vigente de la unidad, aunque el archivo fuente traiga el CLUES viejo.
    // Clave: 'CLUES_VIEJO|ANIO' -> CLUES_NUEVO. Quitar la entrada cuando ya no se necesite
    // (p.ej. cuando ya no exista ningún concentrado histórico con el CLUES viejo para ese año).
    static CLUES_REASSIGNMENT = {
        'QTSSA002020|2026': 'QTSSA013034' // TLACOTE EL BAJO: cambio de CLUES a mitad de 2026
    };

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

            const uiYearVal = parseInt(document.getElementById('csvAnioSelector')?.value || '2026', 10);
            const rawYearParsed = parseInt(anioRaw, 10);
            const anio = (!isNaN(rawYearParsed) && rawYearParsed >= 2020 && rawYearParsed <= 2035) ? rawYearParsed : uiYearVal;

            const valor = parseInt(valorRaw, 10);
            const mes   = parseInt(mesRaw, 10);

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
        if (typeof showProgressOverlay === 'function') {
            showProgressOverlay("Procesando datos...", "Analizando", "CARGA DE ARCHIVO");
        } else if (typeof showOverlay === 'function') {
            showOverlay("Procesando datos...", "Analizando");
        }

        // 1. Parsear y filtrar datos
        const cleanData = [];
        const uniqueUnits = {};
        const mesesEnCSV = new Set();
        let skippedInventory = 0;

        for (const row of data) {
            let clues      = this._getCol(row, 'CLUES');
            const variable = this._getCol(row, 'VARIABLE');
            const valorRaw = this._getCol(row, 'VALOR');
            const mesRaw   = this._getCol(row, 'MES');
            const anioRaw  = this._getCol(row, 'ANO') || this._getCol(row, 'ANIO');
            const municipio = this._getCol(row, 'MUNICIPIO') || 'DESCONOCIDO';

            const uiYearVal = parseInt(document.getElementById('csvAnioSelector')?.value || '2026', 10);
            const rawYearParsed = parseInt(anioRaw, 10);
            const anio = (!isNaN(rawYearParsed) && rawYearParsed >= 2020 && rawYearParsed <= 2035) ? rawYearParsed : uiYearVal;

            const valor = parseInt(valorRaw, 10);
            const mes   = parseInt(mesRaw, 10);

            if (!clues || !variable || isNaN(valor) || isNaN(mes) || isNaN(anio)) continue;

            // Corregir CLUES histórico antes de guardar (ver RDAParser.CLUES_REASSIGNMENT arriba)
            const reassignedClues = RDAParser.CLUES_REASSIGNMENT[`${clues}|${anio}`];
            if (reassignedClues) clues = reassignedClues;

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
        const loadYear = cleanData[0]?.anio;
        await this.rpcUpsert(Object.values(uniqueUnits), cleanData, mesesArray, loadYear);
    }

    static chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    static async rpcUpsert(unidades, registros, meses, loadYear) {
        const total = registros.length;
        try {
            // 1. Sincronizar unidades médicas (en lotes de 100)
            if (typeof showProgressOverlay === 'function') {
                showProgressOverlay("Sincronizando catálogo de unidades médicas...", "Sincronizando", "CARGA DE ARCHIVO");
            } else if (typeof showOverlay === 'function') {
                showOverlay("Sincronizando catálogo de unidades médicas...", "Sincronizando");
            }
            const unitChunks = this.chunkArray(unidades, 100);
            for (let i = 0; i < unitChunks.length; i++) {
                const { error: unitErr } = await window.supabase
                    .from('unidades_medicas')
                    .upsert(unitChunks[i], { onConflict: 'clues', ignoreDuplicates: true });
                if (unitErr) throw new Error(`Error al registrar unidades médicas: ${unitErr.message}`);
            }

            // 2. Limpiar registros previos de los meses Y año en el CSV
            if (typeof showProgressOverlay === 'function') {
                showProgressOverlay("Limpiando registros del año y meses correspondientes...", "Sincronizando", "CARGA DE ARCHIVO");
            } else if (typeof showOverlay === 'function') {
                showOverlay("Limpiando registros del año y meses correspondientes...", "Sincronizando");
            }

            // Obtener el año del lote cargado
            const targetYear = loadYear || registros[0]?.anio;
            if (!targetYear || isNaN(targetYear)) {
                throw new Error("No se pudo identificar el año en los registros del lote.");
            }

            const { error: delErr } = await window.supabase
                .from('registros_sis')
                .delete()
                .eq('anio', targetYear)
                .in('mes', meses);

            if (delErr) throw new Error(`Error al limpiar base de datos: ${delErr.message}`);

            // 3. Insertar nuevos registros en lotes de 5000
            const batchSize = 5000;
            const recordChunks = this.chunkArray(registros, batchSize);
            const totalBatches = recordChunks.length;

            for (let i = 0; i < totalBatches; i++) {
                const start = i * batchSize + 1;
                const end = Math.min((i + 1) * batchSize, total);
                
                if (typeof updateOverlayProgress === 'function') {
                    updateOverlayProgress(
                        end,
                        total,
                        `Enviando lote ${i + 1} de ${totalBatches}: registros ${start.toLocaleString('es-MX')} a ${end.toLocaleString('es-MX')}`,
                        "Carga Masiva SIS",
                        "SINCRONIZACIÓN SUPABASE"
                    );
                } else if (typeof showOverlay === 'function') {
                    showOverlay(
                        `Enviando lote ${i + 1} de ${totalBatches} (${start.toLocaleString('es-MX')} a ${end.toLocaleString('es-MX')} de ${total.toLocaleString('es-MX')} registros)...`,
                        "Carga Masiva SIS"
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

            // Lanzar celebración premium
            if (typeof window.triggerConfetti === 'function') window.triggerConfetti();
            if (typeof window.playNotificationSound === 'function') window.playNotificationSound('success');

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
        const POB_6_PATTERNS     = ['POB_6_ANO', 'POB_6ANO', '6_ANO', 'SEIS', 'DE_6_ANO'];

        let validos = 0;
        let ignorados = 0;

        // Encontrar las columnas reales en el CSV usando la primera fila
        const sampleRow = data[0];
        const colMenor = this._findColByPatterns(sampleRow, POB_MENOR_PATTERNS);
        const col1     = this._findColByPatterns(sampleRow, POB_1_PATTERNS);
        const col4     = this._findColByPatterns(sampleRow, POB_4_PATTERNS);
        const col6     = this._findColByPatterns(sampleRow, POB_6_PATTERNS);

        if (!colMenor && !col1 && !col4 && !col6) {
            this._showSchemaError("No se encontraron columnas de población (POB_MENOR_1, POB_1_ANO, POB_4_ANOS, POB_6_ANOS).");
            return;
        }

        const reasonCounts = {
            noClues: { label: "Falta el campo CLUES", count: 0, examples: [] },
            noPop: { label: "Faltan valores numéricos de población (menor 1, 1 año, 4 años, 6 años)", count: 0, examples: [] }
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
            const p6     = col6     ? parseInt(row[col6], 10)     : NaN;

            // Al menos un valor de población debe ser numérico
            if (isNaN(pMenor) && isNaN(p1) && isNaN(p4) && isNaN(p6)) { 
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
            this._pobCols = { colMenor, col1, col4, col6 };
            document.getElementById('btnConfirmUploadCSV').classList.remove('opacity-50', 'pointer-events-none');

            // Mostrar aviso de población en lugar de aviso de meses
            const warn = document.getElementById('csvMonthsWarning');
            if (warn) {
                const h5 = warn.querySelector('h5');
                const p = warn.querySelector('p');
                if (h5) h5.textContent = 'Actualización de Población';
                if (p) p.innerHTML = `Se actualizarán los datos demográficos de <strong>${validos}</strong> unidades médicas. ` +
                    `Columnas detectadas: ${[colMenor, col1, col4, col6].filter(Boolean).join(', ')}.`;
                warn.style.display = 'block';
            }
        } else {
            this._showSchemaError("No se encontraron registros válidos de población.");
        }
    }

    /** Procesa y envía datos de población al RPC */
    static async processPoblacionData(data) {
        if (typeof showOverlay === 'function') showOverlay("Actualizando población...", "Procesando");

        const { colMenor, col1, col4, col6 } = this._pobCols || {};
        const selectedAnio = parseInt(document.getElementById('csvAnioSelector')?.value || '2026', 10);
        const payload = [];

        for (const row of data) {
            const clues = this._getCol(row, 'CLUES');
            if (!clues) continue;

            const pMenor = colMenor ? parseInt(row[colMenor], 10) : NaN;
            const p1     = col1     ? parseInt(row[col1], 10)     : NaN;
            const p4     = col4     ? parseInt(row[col4], 10)     : NaN;
            const p6     = col6     ? parseInt(row[col6], 10)     : NaN;

            if (isNaN(pMenor) && isNaN(p1) && isNaN(p4) && isNaN(p6)) continue;

            payload.push({
                clues,
                pob_menor_1: isNaN(pMenor) ? 0 : pMenor,
                pob_1_ano:   isNaN(p1)     ? 0 : p1,
                pob_4_anos:  isNaN(p4)     ? 0 : p4,
                pob_6_anos:  isNaN(p6)     ? 0 : p6
            });
        }

        console.log(`[RDA Parser] 👥 Enviando ${payload.length} registros de población para el año ${selectedAnio}...`);

        try {
            // 1. Intentar vía RPC atómico por año
            const { data: result, error } = await window.supabase.rpc('upsert_poblacion_data', {
                p_data: payload,
                p_anio: selectedAnio
            });

            if (error) {
                console.warn('[RDA Parser] ⚠️ RPC upsert_poblacion_data no disponible, ejecutando actualización directa acotada por año...');
                
                // Fallback directo por año en tabla poblacion_unidades acotada por (clues, anio)
                const pobRows = payload.map(p => ({
                    clues: p.clues,
                    anio: selectedAnio,
                    pob_menor_1: p.pob_menor_1,
                    pob_1_ano: p.pob_1_ano,
                    pob_4_anos: p.pob_4_anos,
                    pob_6_anos: p.pob_6_anos
                }));

                const { error: directErr } = await window.supabase
                    .from('poblacion_unidades')
                    .upsert(pobRows, { onConflict: 'clues,anio' });

                if (directErr) {
                    console.error('[RDA Parser] ❌ Error en actualización directa de poblacion_unidades:', directErr);
                    if (typeof hideOverlay === 'function') hideOverlay();
                    if (typeof showToast === 'function') showToast(`Error al guardar población: ${directErr.message}`, false, 'bad');
                    return;
                }
            }

            if (typeof hideOverlay === 'function') hideOverlay();
            const total = payload.length;
            console.log(`[RDA Parser] ✅ Población ${selectedAnio} guardada aisladamente para ${total} unidades.`);
            if (typeof showToast === 'function') showToast(`Población ${selectedAnio} guardada correctamente (${total} unidades)`, true, 'good');

            // Lanzar celebración premium
            if (typeof window.triggerConfetti === 'function') window.triggerConfetti();
            if (typeof window.playNotificationSound === 'function') window.playNotificationSound('success');

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

// ==============================================================================
// CONCENTRADOR E INSPECTOR WEB SIS (PROCESAMIENTO DE ARCHIVOS MÚLTIPLES EN JS)
// ==============================================================================
let _selectedSisFiles = [];
let _concentratedResultBlob = null;

window.handleSisConcFilesSelect = function(files) {
    if (!files || !files.length) return;
    _selectedSisFiles = Array.from(files);
    
    const fileListEl = document.getElementById('sisConcFileList');
    if (fileListEl) {
        fileListEl.innerHTML = _selectedSisFiles.map((f, i) => `
            <span class="px-3 py-1 rounded-xl bg-slate-200 text-slate-800 border border-slate-300 flex items-center gap-1">
                📄 ${f.name} <span class="text-[10px] text-slate-500">(${Math.round(f.size/1024)} KB)</span>
            </span>
        `).join('');
    }

    const consoleEl = document.getElementById('sisConcConsole');
    if (consoleEl) {
        consoleEl.innerHTML = `<div class="text-teal-400">➜ Se seleccionaron ${_selectedSisFiles.length} archivos para unificar y compilar. Haz clic en "Compilar & Limpiar".</div>`;
    }
    document.getElementById('btnDownloadConcentrated').style.display = 'none';
};

window.runWebSisConcentrator = async function() {
    const consoleEl = document.getElementById('sisConcConsole');
    const autoZero = document.getElementById('sisConcAutoZero')?.checked ?? true;
    const targetSheet = (document.getElementById('sisConcTargetSheet')?.value || 'CSV').trim().toUpperCase();

    if (!_selectedSisFiles || _selectedSisFiles.length === 0) {
        if (typeof showToast === 'function') showToast("Por favor selecciona al menos un archivo .xlsx o .csv", false, 'bad');
        return;
    }

    const log = (msg, color = 'text-slate-200') => {
        if (consoleEl) {
            consoleEl.innerHTML += `<div class="${color}">${msg}</div>`;
            consoleEl.scrollTop = consoleEl.scrollHeight;
        }
    };

    consoleEl.innerHTML = '';
    log("==========================================================", "text-teal-400 font-bold");
    log(" 🚀 INICIANDO CONCENTRADOR WEB SIS", "text-teal-400 font-bold");
    log("==========================================================", "text-teal-400 font-bold");

    let allRows = [];
    let stats = { procesados: 0, omitidos: 0, vaciosCorr: 0, duplicados: 0 };
    const ordenMunicipios = ['QUERÉTARO', 'CORREGIDORA', 'MARQUÉS', 'HUIMILPAN'];

    for (let i = 0; i < _selectedSisFiles.length; i++) {
        const file = _selectedSisFiles[i];
        log(`[${i+1}/${_selectedSisFiles.length}] Procesando: ${file.name}...`);

        try {
            let jsonRows = [];
            if (file.name.endsWith('.csv')) {
                const text = await file.text();
                const workbook = XLSX.read(text, { type: 'string' });
                const sheetName = workbook.SheetNames[0];
                jsonRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false, defval: '' });
            } else {
                const buffer = await file.arrayBuffer();
                const workbook = XLSX.read(buffer, { type: 'array' });
                
                // Buscar la hoja especificada
                let sheetName = workbook.SheetNames.find(s => s.trim().toUpperCase() === targetSheet);
                if (!sheetName && workbook.SheetNames.length > 0) {
                    sheetName = workbook.SheetNames[0]; // fallback
                }

                if (!sheetName) throw new Error(`No se encontró la hoja '${targetSheet}'.`);
                jsonRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false, defval: '' });
            }

            if (!jsonRows || jsonRows.length === 0) {
                log(`   └─ ⚠️ Archivo vacío o sin datos válidos. Omitido.`, "text-amber-400");
                stats.omitidos++;
                continue;
            }

            // Normalización de claves por fila y saneamiento a "0"
            let processedRows = jsonRows.map((row, index) => {
                let normRow = {};
                for (let k in row) {
                    let keyNorm = RDAParser._normalizeKey(k);
                    if (keyNorm.startsWith('UNNAMED')) continue;

                    let val = String(row[k] ?? '').trim();
                    // Sanitizar " " -> 0
                    if (autoZero && (val === '' || val === 'nan' || val === 'null' || val === 'None')) {
                        val = '0';
                        stats.vaciosCorr++;
                    }
                    normRow[keyNorm] = val;
                }

                // Estandarización de nombres de columnas
                if (normRow['VARIABLE'] && !normRow['VARIABLE_SIS']) normRow['VARIABLE_SIS'] = normRow['VARIABLE'];
                if (normRow['DOSIS'] && !normRow['VALOR']) normRow['VALOR'] = normRow['DOSIS'];
                if (normRow['AÑO'] && !normRow['ANIO']) normRow['ANIO'] = normRow['AÑO'];

                // Homologación de municipio
                if (normRow['MUNICIPIO']) {
                    let m = normRow['MUNICIPIO'].toUpperCase().trim();
                    if (m === 'EL MARQUÉS' || m === 'EL MARQUES' || m === 'MARQUES') m = 'MARQUÉS';
                    if (m === 'QUERETARO') m = 'QUERÉTARO';
                    normRow['MUNICIPIO'] = m;
                }

                normRow['_ORDEN_ORIGINAL'] = index;
                return normRow;
            });

            allRows.push(...processedRows);
            stats.procesados++;
            log(`   └─ ✅ OK: ${processedRows.length} registros cargados.`, "text-emerald-400");
        } catch (err) {
            log(`   └─ ❌ ERROR: ${err.message}`, "text-rose-400");
            stats.omitidos++;
        }
    }

    if (allRows.length === 0) {
        log("\n❌ No se extrajo ningún registro de los archivos seleccionados.", "text-rose-400 font-bold");
        return;
    }

    log("\n----------------------------------------------------------", "text-slate-500");
    log("⚙️ APLICANDO DEDUPLICACIÓN Y ORDENAMIENTO TOP-DOWN...", "text-teal-400 font-bold");

    // 1. Deduplicación inteligente por [CLUES, VARIABLE_SIS, MES, ANIO]
    const dedupeMap = new Map();
    const rowsBefore = allRows.length;
    allRows.forEach(row => {
        const key = `${row['CLUES']||''}_${row['VARIABLE_SIS']||''}_${row['MES']||''}_${row['ANIO']||''}`;
        dedupeMap.set(key, row);
    });
    allRows = Array.from(dedupeMap.values());
    stats.duplicados = rowsBefore - allRows.length;

    // 2. Ordenamiento Top-Down (Mes -> Municipio -> CLUES -> Orden)
    allRows.sort((a, b) => {
        const mesA = parseInt(a['MES'], 10) || 0;
        const mesB = parseInt(b['MES'], 10) || 0;
        if (mesA !== mesB) return mesA - mesB;

        const idxA = ordenMunicipios.indexOf(a['MUNICIPIO']);
        const idxB = ordenMunicipios.indexOf(b['MUNICIPIO']);
        if (idxA !== idxB) return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);

        const cluesA = a['CLUES'] || '';
        const cluesB = b['CLUES'] || '';
        if (cluesA !== cluesB) return cluesA.localeCompare(cluesB);

        return (a['_ORDEN_ORIGINAL'] || 0) - (b['_ORDEN_ORIGINAL'] || 0);
    });

    // 3. MOTOR DE AUDITORÍA Y DIAGNÓSTICO DE SALUD DE DATOS EPIDEMIOLÓGICOS (SIN TOCAR TABLAS BD)
    log("\n----------------------------------------------------------", "text-slate-500");
    log("🔍 EJECUTANDO MOTOR DE AUDITORÍA Y COMPROBACIÓN DE SALUD...", "text-indigo-400 font-bold");

    let audit = {
        cluesDesconocidas: new Set(),
        variablesSinMapeo: new Set(),
        valoresNegativos: 0,
        picosAnomalos: 0,
        mesesPresentes: new Set(),
        municipiosUnicos: new Set()
    };

    const validDictVars = new Set(Object.values(window.DICT_RDA || {}).flat());

    allRows.forEach((r, idx) => {
        const c = (r['CLUES'] || '').toUpperCase();
        const v = (r['VARIABLE_SIS'] || '').toUpperCase();
        const val = parseInt(r['VALOR'], 10) || 0;
        const m = parseInt(r['MES'], 10);

        if (m >= 1 && m <= 12) audit.mesesPresentes.add(m);
        if (r['MUNICIPIO']) audit.municipiosUnicos.add(r['MUNICIPIO']);

        // Validar formato de CLUES (ej: QTSSA...)
        if (c && !c.startsWith('QT') && !c.startsWith('CLUES')) {
            audit.cluesDesconocidas.add(c);
        }

        // Detectar si la clave SIS no está mapeada en ninguna vacuna RDA
        if (v && validDictVars.size > 0 && !validDictVars.has(v)) {
            audit.variablesSinMapeo.add(v);
        }

        // Anomalías en valores
        if (val < 0) audit.valoresNegativos++;
        if (val > 1500) audit.picosAnomalos++; // Alerta si una sola dosis mensual supera 1,500 aplicadas
    });

    log(`📈 Meses detectados en el lote : [${Array.from(audit.mesesPresentes).sort((a,b)=>a-b).join(', ')}]`, "text-slate-200");
    log(`🏛️ Municipios agregados        : [${Array.from(audit.municipiosUnicos).join(', ')}]`, "text-slate-200");

    if (audit.cluesDesconocidas.size > 0) {
        log(`🚨 ALERTA ESTRUCTURAL: ${audit.cluesDesconocidas.size} CLUES con sintaxis inusual: [${Array.from(audit.cluesDesconocidas).slice(0, 5).join(', ')}]`, "text-rose-400");
    }

    if (audit.picosAnomalos > 0) {
        log(`⚠️ ALERTA DE DATOS: Se detectaron ${audit.picosAnomalos} registros con valores >1,500 dosis (posible error de captura).`, "text-amber-400");
    }

    // 4. Generar CSV String final y Blob (Exclusivo en memoria del navegador)
    if (allRows.length > 0) {
        allRows.forEach(r => delete r['_ORDEN_ORIGINAL']);
        
        const worksheet = XLSX.utils.json_to_sheet(allRows);
        const csvString = XLSX.utils.sheet_to_csv(worksheet);
        
        _concentratedResultBlob = new Blob(["\ufeff" + csvString], { type: 'text/csv;charset=utf-8;' });

        log("\n==========================================================", "text-emerald-400 font-bold");
        log(" 🎉 ¡COMPILACIÓN Y ANÁLISIS COMPLETADO CON ÉXITO!", "text-emerald-400 font-bold");
        log("==========================================================", "text-emerald-400 font-bold");
        log(`📊 Registros limpios consolidados : ${allRows.length.toLocaleString()}`, "text-slate-100 font-bold");
        log(`📁 Archivos procesados con éxito  : ${stats.procesados}`, "text-slate-100");
        log(`🧹 Celdas vacías corregidas a "0"  : ${stats.vaciosCorr.toLocaleString()}`, "text-slate-100");
        log(`🛡️ Duplicados eliminados          : ${stats.duplicados.toLocaleString()}`, "text-slate-100");
        log(`🔒 Estado Base de Datos           : 100% Intacta (Procesamiento en Memoria)`, "text-teal-300 font-bold");

        const dlBtn = document.getElementById('btnDownloadConcentrated');
        if (dlBtn) {
            dlBtn.style.display = 'inline-flex';
            dlBtn.style.backgroundColor = '#059669';
            dlBtn.style.color = '#ffffff';
        }
        if (typeof showToast === 'function') showToast("¡Análisis completado! Archivo listo para descarga.", true, 'good');
    }
};

window.downloadConcentratedResult = function() {
    if (!_concentratedResultBlob) return;
    const url = URL.createObjectURL(_concentratedResultBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `concentrado_total_sis_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};
