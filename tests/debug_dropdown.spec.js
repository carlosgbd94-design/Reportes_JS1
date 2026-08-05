const { test, expect } = require('@playwright/test');
const { ENTRY_HTML } = require('./_entry');

test('Debug Campaign Dropdown Visibility', async ({ page }) => {
  await page.goto('/' + ENTRY_HTML);

  // Evaluar un script para mockear el estado de la aplicación e inicializar el panel
  const debugInfo = await page.evaluate(async () => {
    // 1. Mockear usuario y estado global
    window.USER = { rol: 'UNIDAD', usuario: 'test_unidad', municipio: 'Querétaro', clues: 'TESTCLUES1' };
    window.AppState = window.AppState || {};
    window.AppState.rol = 'UNIDAD';
    
    // Mockear Supabase para evitar llamadas reales a la base de datos
    window.supabase = {
      from: () => ({
        select: () => ({
          order: () => Promise.resolve({ data: [
            { id: 1, nombre: 'Campaña Influenza 2025-2026', activo: true, fecha_inicio: '2025-10-03', fecha_fin: '2026-04-25' }
          ], error: null })
        })
      })
    };

    // 2. Mostrar el panel de Influenza de captura de Unidad
    const panelCAP = document.getElementById('panelCAP');
    if (panelCAP) panelCAP.style.display = 'block';

    const secUnitCaptura = document.getElementById('secUnitCaptura');
    if (secUnitCaptura) secUnitCaptura.style.display = 'flex';

    // 3. Inicializar el flujo de Influenza
    if (typeof window.initInfluenzaCaptureFlow === 'function') {
      await window.initInfluenzaCaptureFlow();
    }

    // 4. Obtener información de visibilidad del DOM
    const select = document.getElementById('influenza_campana');
    
    return {
      selectExists: !!select,
      selectDisplay: select ? select.style.display : null,
      computedSelectDisplay: select ? getComputedStyle(select).display : null
    };
  });

  console.log('DEBUG INFO FROM BROWSER:', JSON.stringify(debugInfo, null, 2));

  // Verificar que el select nativo existe y no esté oculto
  expect(debugInfo.selectExists).toBe(true);
  expect(debugInfo.computedSelectDisplay).not.toBe('none');
});
