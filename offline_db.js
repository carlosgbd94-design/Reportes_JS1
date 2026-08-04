/**
 * offline_db.js — SIREVAQ Offline Engine & Synchronization Manager
 * Permite la captura continua sin conexión a internet usando IndexedDB.
 * Sincroniza automáticamente con Supabase al recuperar la red.
 */

(function (window) {
  'use strict';

  const DB_NAME = 'SIREVAQ_Offline_DB';
  const DB_VERSION = 1;
  const STORE_PENDING = 'pending_sync_queue';

  let dbPromise = null;

  // ── 1. Inicialización de IndexedDB ─────────────────────────────────────────
  function initDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        console.warn('[OfflineDB] IndexedDB no está soportado en este navegador.');
        return resolve(null);
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_PENDING)) {
          const store = db.createObjectStore(STORE_PENDING, { keyPath: 'id', autoIncrement: true });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('actionType', 'actionType', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = (event) => {
        console.error('[OfflineDB] Error al abrir IndexedDB:', event.target.error);
        reject(event.target.error);
      };
    });

    return dbPromise;
  }

  // ── 2. Guardar Captura Localmente ───────────────────────────────────────────
  async function saveOfflineRecord(actionType, payload, meta = {}) {
    try {
      const db = await initDB();
      if (!db) return false;

      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PENDING, 'readwrite');
        const store = tx.objectStore(STORE_PENDING);

        const record = {
          actionType: actionType, // ej: 'UPSERT_INFLUENZA_CAPTURA', 'UPSERT_EXISTENCIA'
          payload: payload,
          meta: meta,
          timestamp: new Date().toISOString(),
          attempts: 0
        };

        const req = store.add(record);
        req.onsuccess = () => {
          console.log(`[OfflineDB] Registro guardado en cola local (${actionType}):`, record);
          updateSyncBadge();
          resolve(true);
        };
        req.onerror = (e) => {
          console.error('[OfflineDB] Error al guardar en cola local:', e.target.error);
          reject(e.target.error);
        };
      });
    } catch (err) {
      console.error('[OfflineDB] Excepción en saveOfflineRecord:', err);
      return false;
    }
  }

  // ── 3. Obtener Total de Registros Pendientes ────────────────────────────────
  async function getPendingCount() {
    try {
      const db = await initDB();
      if (!db) return 0;

      return new Promise((resolve) => {
        const tx = db.transaction(STORE_PENDING, 'readonly');
        const store = tx.objectStore(STORE_PENDING);
        const req = store.count();
        req.onsuccess = () => resolve(req.result || 0);
        req.onerror = () => resolve(0);
      });
    } catch {
      return 0;
    }
  }

  // ── 4. Procesar y Sincronizar Cola con Supabase ────────────────────────────
  async function syncQueue(supabaseClient, syncHandlers = {}) {
    if (!navigator.onLine) {
      console.log('[OfflineDB] Dispositivo sin conexión. Sincronización omitida.');
      return;
    }

    try {
      const db = await initDB();
      if (!db) return;

      const records = await new Promise((resolve) => {
        const tx = db.transaction(STORE_PENDING, 'readonly');
        const store = tx.objectStore(STORE_PENDING);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });

      if (records.length === 0) {
        updateSyncBadge(0);
        return;
      }

      console.log(`[OfflineDB] Iniciando sincronización de ${records.length} registros...`);
      showSyncToast(`Sincronizando ${records.length} captura(s) pendiente(s)...`, 'info');

      let successCount = 0;

      for (const record of records) {
        try {
          let synced = false;

          if (syncHandlers[record.actionType]) {
            synced = await syncHandlers[record.actionType](record.payload, supabaseClient);
          } else {
            synced = await defaultSyncHandler(record, supabaseClient);
          }

          if (synced) {
            await deleteRecord(record.id);
            successCount++;
          } else {
            console.warn(`[OfflineDB] No se pudo sincronizar registro ID ${record.id}`);
          }
        } catch (itemErr) {
          console.error(`[OfflineDB] Error sincronizando ítem ${record.id}:`, itemErr);
        }
      }

      const remaining = await getPendingCount();
      updateSyncBadge(remaining);

      if (successCount > 0) {
        showSyncToast(`🟢 ${successCount} captura(s) sincronizada(s) con éxito en la nube.`, 'success');
      }
    } catch (err) {
      console.error('[OfflineDB] Error durante syncQueue:', err);
    }
  }

  async function defaultSyncHandler(record, supabaseClient) {
    if (!supabaseClient) return false;

    const { actionType, payload } = record;

    if (actionType === 'UPSERT_INFLUENZA_CAPTURA') {
      const { data, error } = await supabaseClient
        .from('influenza_capturas')
        .upsert(payload, { onConflict: 'clues,fecha' });
      if (error) {
        console.error('[OfflineDB Sync Error]', error);
        return false;
      }
      return true;
    }

    if (actionType === 'UPSERT_EXISTENCIA') {
      // NOTA: ningún flujo de captura llama hoy a saveOfflineRecord('UPSERT_EXISTENCIA', ...) —
      // el guardado online real de SR/existencia (performSaveSR en main.js) hace un
      // borrado+inserción dual contra 'biologicos_existencia' Y 'existencia_detalle', comparando
      // contra el reporte anterior para detectar desabasto; esa lógica no se puede replicar aquí
      // sin conexión. 'biologicos_existencia' no tiene restricción única en (clues, fecha) —solo
      // PK en 'id'— por eso aquí se replica el mismo patrón borrado+inserción que usa el guardado
      // online, en vez de un upsert que fallaría por falta de esa restricción.
      if (payload && payload.clues && payload.fecha) {
        await supabaseClient
          .from('biologicos_existencia')
          .delete()
          .eq('clues', payload.clues)
          .eq('fecha', payload.fecha);
      }
      const { data, error } = await supabaseClient
        .from('biologicos_existencia')
        .insert(payload);
      if (error) {
        console.error('[OfflineDB Sync Error]', error);
        return false;
      }
      return true;
    }

    return false;
  }

  async function deleteRecord(id) {
    const db = await initDB();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_PENDING, 'readwrite');
      const store = tx.objectStore(STORE_PENDING);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  }

  // ── 5. Componente Visual (Píldora / Insignia de Estado) ─────────────────────
  async function updateSyncBadge(overrideCount = null) {
    const count = overrideCount !== null ? overrideCount : await getPendingCount();
    let badgeContainer = document.getElementById('offline-sync-badge');

    if (!badgeContainer) {
      badgeContainer = document.createElement('div');
      badgeContainer.id = 'offline-sync-badge';
      badgeContainer.className = 'fixed bottom-4 left-4 z-[9999] transition-all duration-300 transform scale-100';
      document.body.appendChild(badgeContainer);
    }

    if (count > 0) {
      badgeContainer.innerHTML = `
        <div class="flex items-center gap-2 bg-amber-900/90 text-amber-100 border border-amber-500/30 px-3.5 py-2 rounded-xl shadow-xl backdrop-blur-md text-xs font-semibold animate-pulse">
          <span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
          <span class="material-symbols-rounded text-base text-amber-400">cloud_off</span>
          <span>${count} captura(s) guardada(s) localmente</span>
          ${navigator.onLine ? '<button id="btn-force-sync" class="ml-1 px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/40 text-amber-200 rounded-lg text-[10px] font-bold uppercase transition">Sincronizar</button>' : ''}
        </div>
      `;
      badgeContainer.style.display = 'block';

      const syncBtn = document.getElementById('btn-force-sync');
      if (syncBtn) {
        syncBtn.onclick = () => {
          if (window.supabaseClient) {
            syncQueue(window.supabaseClient);
          }
        };
      }
    } else {
      badgeContainer.style.display = 'none';
    }
  }

  function showSyncToast(message, type = 'info') {
    if (window.showToast) {
      window.showToast(message, type);
    } else {
      console.log(`[Toast ${type}] ${message}`);
    }
  }

  // ── 6. Event Listeners Automáticos ─────────────────────────────────────────
  window.addEventListener('online', () => {
    console.log('[OfflineDB] Conexión recuperada.');
    updateSyncBadge();
    showSyncToast('🟢 Conexión a internet reestablecida.', 'success');
    if (window.supabaseClient) {
      syncQueue(window.supabaseClient);
    }
  });

  window.addEventListener('offline', () => {
    console.log('[OfflineDB] Modo offline detectado.');
    showSyncToast('🟡 Modo sin conexión activado. Las capturas se guardarán en tu dispositivo.', 'warning');
    updateSyncBadge();
  });

  document.addEventListener('DOMContentLoaded', () => {
    updateSyncBadge();
  });

  // Exportar API Global
  window.OfflineDB = {
    initDB,
    saveOfflineRecord,
    getPendingCount,
    syncQueue,
    updateSyncBadge
  };

})(window);
