/**
 * SIREVAQ Storage & Cache Module (Dexie.js / IndexedDB Wrapper)
 * Proporciona almacenamiento local ultra-rápido (0-5ms) para catálogos y datos de Supabase.
 */

(function () {
    class SirevaqStorageManager {
        constructor() {
            this.db = null;
            this.initDB();
        }

        initDB() {
            try {
                if (typeof Dexie !== 'undefined') {
                    this.db = new Dexie('SirevaqCacheDB');
                    this.db.version(1).stores({
                        catalogos: 'clave, data, updatedAt',
                        existencias: 'id, unidad, clave, data, updatedAt',
                        capacitaciones: 'id, fecha, updatedAt'
                    });
                    console.log('[SirevaqStorage] IndexedDB (Dexie) inicializado con éxito.');
                } else {
                    console.info('[SirevaqStorage] Operando en modo Fallback (sessionStorage).');
                }
            } catch (err) {
                console.error('[SirevaqStorage] Error al inicializar Dexie:', err);
            }
        }

        /**
         * Obtiene un elemento de la caché local con verificación de TTL
         * @param {string} clave 
         * @param {number} ttlMs - Tiempo de vida en milisegundos (Default: 15 minutos)
         */
        async getCache(clave, ttlMs = 15 * 60 * 1000) {
            try {
                if (this.db) {
                    const item = await this.db.catalogos.get(clave);
                    if (item && (Date.now() - item.updatedAt < ttlMs)) {
                        console.log(`[SirevaqStorage] Hit de Caché para '${clave}' (Dexie)`);
                        return item.data;
                    }
                } else {
                    const raw = sessionStorage.getItem(`sirevaq_cache_${clave}`);
                    if (raw) {
                        const parsed = JSON.parse(raw);
                        if (Date.now() - parsed.updatedAt < ttlMs) {
                            return parsed.data;
                        }
                    }
                }
            } catch (e) {
                console.warn('[SirevaqStorage] Falló lectura de caché:', e);
            }
            return null;
        }

        /**
         * Guarda un elemento en la caché local
         */
        async setCache(clave, data) {
            try {
                const payload = { clave, data, updatedAt: Date.now() };
                if (this.db) {
                    await this.db.catalogos.put(payload);
                } else {
                    sessionStorage.setItem(`sirevaq_cache_${clave}`, JSON.stringify(payload));
                }
            } catch (e) {
                console.warn('[SirevaqStorage] Falló escritura de caché:', e);
            }
        }

        /**
         * Invalida una clave o toda la caché
         */
        async invalidate(clave = null) {
            try {
                if (this.db) {
                    if (clave) {
                        await this.db.catalogos.delete(clave);
                    } else {
                        await this.db.catalogos.clear();
                    }
                }
                if (clave) {
                    sessionStorage.removeItem(`sirevaq_cache_${clave}`);
                } else {
                    Object.keys(sessionStorage).forEach(k => {
                        if (k.startsWith('sirevaq_cache_')) sessionStorage.removeItem(k);
                    });
                }
                console.log(`[SirevaqStorage] Caché invalidada: ${clave || 'TODAS'}`);
            } catch (e) {
                console.warn('[SirevaqStorage] Error al invalidar caché:', e);
            }
        }
    }

    window.SirevaqStorage = new SirevaqStorageManager();
})();
