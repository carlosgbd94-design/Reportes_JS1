const { test, expect } = require('@playwright/test');
const { ENTRY_HTML } = require('./_entry');

// Misma cuenta de prueba MUNICIPAL (Corregidora + Huimilpan) usada en
// rls-municipal-2-municipios.spec.js. Configura .env (ver .env.example).
const EMAIL = process.env.SIREVAQ_TEST_MUNICIPAL_EMAIL;
const PASSWORD = process.env.SIREVAQ_TEST_MUNICIPAL_PASSWORD;

// CLUES reales con datos cargados de biologicos_existencia y consumibles.
const CLUES_CORREGIDORA = 'QTSSA000830';
const CLUES_HUIMILPAN = 'QTSSA001023';

// Fecha real donde AMBAS unidades tienen captura en las dos tablas.
const FECHA_CAPTURA = '2026-07-30';

async function login(page) {
  await page.goto('/' + ENTRY_HTML);
  await page.waitForFunction(() => window.supabase && typeof window.supabase.auth?.signInWithPassword === 'function');
  await page.locator('#usuario').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.locator('#btnLogin').click();
  await expect(page.locator('#rightColumn')).toBeVisible({ timeout: 15000 });
}

test.describe('Permisos RLS - biológicos y consumibles (perfil MUNICIPAL, 2 municipios)', () => {
  test.skip(
    !EMAIL || !PASSWORD,
    'Falta configurar SIREVAQ_TEST_MUNICIPAL_EMAIL y SIREVAQ_TEST_MUNICIPAL_PASSWORD en un archivo .env local (copia .env.example).'
  );

  test('lectura directa de biologicos_existencia funciona para AMBOS municipios', async ({ page }) => {
    await login(page);

    const resultado = await page.evaluate(async ({ cluesA, cluesB }) => {
      const [resA, resB] = await Promise.all([
        window.supabase.from('biologicos_existencia').select('clues, fecha').eq('clues', cluesA).limit(5),
        window.supabase.from('biologicos_existencia').select('clues, fecha').eq('clues', cluesB).limit(5)
      ]);
      return {
        corregidora: { count: resA.data?.length || 0, error: resA.error?.message || null },
        huimilpan: { count: resB.data?.length || 0, error: resB.error?.message || null }
      };
    }, { cluesA: CLUES_CORREGIDORA, cluesB: CLUES_HUIMILPAN });

    expect(resultado.corregidora.error).toBeNull();
    expect(resultado.corregidora.count).toBeGreaterThan(0);

    expect(resultado.huimilpan.error).toBeNull();
    expect(resultado.huimilpan.count).toBeGreaterThan(0);
  });

  test('lectura directa de consumibles funciona para AMBOS municipios', async ({ page }) => {
    await login(page);

    const resultado = await page.evaluate(async ({ cluesA, cluesB }) => {
      const [resA, resB] = await Promise.all([
        window.supabase.from('consumibles').select('clues, fecha').eq('clues', cluesA).limit(5),
        window.supabase.from('consumibles').select('clues, fecha').eq('clues', cluesB).limit(5)
      ]);
      return {
        corregidora: { count: resA.data?.length || 0, error: resA.error?.message || null },
        huimilpan: { count: resB.data?.length || 0, error: resB.error?.message || null }
      };
    }, { cluesA: CLUES_CORREGIDORA, cluesB: CLUES_HUIMILPAN });

    expect(resultado.corregidora.error).toBeNull();
    expect(resultado.corregidora.count).toBeGreaterThan(0);

    expect(resultado.huimilpan.error).toBeNull();
    expect(resultado.huimilpan.count).toBeGreaterThan(0);
  });

  test('las funciones de tablero (get_captures_*_bypass) siguen viendo AMBOS municipios tras quitarles SECURITY DEFINER', async ({ page }) => {
    await login(page);

    const resultado = await page.evaluate(async ({ fecha, cluesA, cluesB }) => {
      const [resBio, resCons] = await Promise.all([
        window.supabase.rpc('get_captures_sr_bypass', { p_fecha: fecha }),
        window.supabase.rpc('get_captures_cons_bypass', { p_fecha: fecha })
      ]);
      const cluesEnResultado = (data) => (data || []).map((r) => r.clues);
      return {
        bio: {
          error: resBio.error?.message || null,
          tieneCorregidora: cluesEnResultado(resBio.data).includes(cluesA),
          tieneHuimilpan: cluesEnResultado(resBio.data).includes(cluesB)
        },
        cons: {
          error: resCons.error?.message || null,
          tieneCorregidora: cluesEnResultado(resCons.data).includes(cluesA),
          tieneHuimilpan: cluesEnResultado(resCons.data).includes(cluesB)
        }
      };
    }, { fecha: FECHA_CAPTURA, cluesA: CLUES_CORREGIDORA, cluesB: CLUES_HUIMILPAN });

    expect(resultado.bio.error, 'get_captures_sr_bypass no debe fallar para un perfil MUNICIPAL valido').toBeNull();
    expect(resultado.bio.tieneCorregidora, 'get_captures_sr_bypass dejo de ver Corregidora').toBe(true);
    expect(resultado.bio.tieneHuimilpan, 'get_captures_sr_bypass dejo de ver Huimilpan').toBe(true);

    expect(resultado.cons.error, 'get_captures_cons_bypass no debe fallar para un perfil MUNICIPAL valido').toBeNull();
    expect(resultado.cons.tieneCorregidora, 'get_captures_cons_bypass dejo de ver Corregidora').toBe(true);
    expect(resultado.cons.tieneHuimilpan, 'get_captures_cons_bypass dejo de ver Huimilpan').toBe(true);
  });
});
