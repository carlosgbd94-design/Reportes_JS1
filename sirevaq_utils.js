/**
 * SIREVAQ Utilities & Modal Manager
 * Proporciona soporte para modales <dialog> nativos de HTML5, debounce para búsquedas
 * y exportador mediante SheetJS.
 */

(function () {
    class SirevaqUtilsManager {
        /**
         * Función Debounce para limitar frecuencia de ejecución en inputs
         */
        debounce(func, wait = 250) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

        /**
         * Renderizado paginado / eficiente mediante DocumentFragment
         */
        renderChunked(container, items, renderRowFn, chunkSize = 30) {
            if (!container) return;
            container.innerHTML = '';
            let index = 0;

            function processNextChunk() {
                const fragment = document.createDocumentFragment();
                const limit = Math.min(index + chunkSize, items.length);

                for (; index < limit; index++) {
                    const rowEl = renderRowFn(items[index], index);
                    if (rowEl) fragment.appendChild(rowEl);
                }

                container.appendChild(fragment);

                if (index < items.length) {
                    requestAnimationFrame(processNextChunk);
                }
            }

            processNextChunk();
        }

        /**
         * Exportación masiva de tablas a Excel verdaderos (.xlsx) con SheetJS
         */
        exportToExcel(dataArray, filename = 'Reporte_SIREVAQ.xlsx', sheetName = 'Datos') {
            try {
                if (typeof XLSX === 'undefined') {
                    console.error('[SirevaqUtils] SheetJS (XLSX) no está disponible.');
                    alert('La librería SheetJS no está cargada en la página.');
                    return;
                }
                const worksheet = XLSX.utils.json_to_sheet(dataArray);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
                XLSX.writeFile(workbook, filename);
                console.log(`[SirevaqUtils] Excel generado exitosamente: ${filename}`);
            } catch (err) {
                console.error('[SirevaqUtils] Error al exportar a Excel:', err);
            }
        }
    }

    class SirevaqModalManager {
        constructor() {
            this.initListeners();
        }

        initListeners() {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    // Cerrar el diálogo nativo activo si existiera
                    const activeDialog = document.querySelector('dialog[open]');
                    if (activeDialog) {
                        this.close(activeDialog.id);
                    }
                }
            });
        }

        /**
         * Abre modal de forma retrocompatible (Soporta <dialog> nativo y <div> tradicionales)
         */
        open(modalId) {
            const el = document.getElementById(modalId);
            if (!el) {
                console.warn(`[SirevaqModal] No se encontró el modal con ID: ${modalId}`);
                return;
            }

            if (el.tagName.toLowerCase() === 'dialog') {
                if (typeof el.showModal === 'function') {
                    el.showModal();
                } else {
                    el.setAttribute('open', '');
                }
            } else {
                el.style.display = 'flex';
            }
            document.body.style.overflow = 'hidden';
        }

        /**
         * Cierra modal de forma retrocompatible
         */
        close(modalId) {
            const el = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
            if (!el) return;

            if (el.tagName && el.tagName.toLowerCase() === 'dialog') {
                if (typeof el.close === 'function') {
                    el.close();
                } else {
                    el.removeAttribute('open');
                }
            } else {
                el.style.display = 'none';
            }

            // Restablecer scroll del body si no hay otros modales abiertos
            const hasOtherModals = document.querySelector('dialog[open], .overlay[style*="display: flex"]');
            if (!hasOtherModals) {
                document.body.style.overflow = '';
            }
        }
    }

    window.sirevaqUtils = new SirevaqUtilsManager();
    window.SirevaqModal = new SirevaqModalManager();

    // Fachadas retrocompatibles para mantener 100% funcionando el código existente
    window.openSirevaqModal = (id) => window.SirevaqModal.open(id);
    window.closeSirevaqModal = (id) => window.SirevaqModal.close(id);
})();
