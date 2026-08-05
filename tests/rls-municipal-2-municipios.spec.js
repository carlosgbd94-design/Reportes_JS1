const { test, expect } = require('@playwright/test');
const { ENTRY_HTML } = require('./_entry');

// Cuenta de prueba MUNICIPAL asignada a Corregidora + Huimilpan.
// Configura estos valores en un archivo ".env" local (ver .env.example) -
// Claude nunca escribe ni lee ese archivo, solo lo llena la persona dueña de la cuenta.
const EMAIL = process.env.SIREVAQ_TEST_MUNICIPAL_EMAIL;
const PASSWORD = process.env.SIREVAQ_TEST_MUNICIPAL_PASSWORD;

// CLUES reales con datos de registros_sis cargados en 2026: una unidad de
// Corregidora y una de Huimilpan. Sirven para confirmar que el perfil
// MUNICIPAL con 2 municipios lee AMBOS, no solo uno (el bug original).
const CLUES_CORREGIDORA = 'QTSSA000830';
const CLUES_HUIMILPAN = 'QTSSA000970';

test.describe('Permisos RLS - perfil MUNICIPAL con 2 municipios (Corregidora + Huimilpan)', () => {
  test.skip(
    !EMAIL || !PASSWORD,
    'Falta configurar SIREVAQ_TEST_MUNICIPAL_EMAIL y SIREVAQ_TEST_MUNICIPAL_PASSWORD en un archivo .env local (copia .env.example).'
  );

  test('el perfil municipal puede leer registros_sis de AMBOS municipios asignados', async ({ page }) => {
    await page.goto('/' + ENTRY_HTML);

    // Espera a que la libreria de Supabase (cargada con <script defer>) este lista,
    // igual que pasaria naturalmente mientras una persona real escribe su correo/contraseña.
    await page.waitForFunction(() => window.supabase && typeof window.supabase.auth?.signInWithPassword === 'function');

    await page.locator('#usuario').fill(EMAIL);
    await page.locator('#password').fill(PASSWORD);
    await page.locator('#btnLogin').click();

    // El dashboard solo se muestra tras un login exitoso contra Supabase real.
    await expect(page.locator('#rightColumn')).toBeVisible({ timeout: 15000 });

    const userInfo = await page.evaluate(() => ({
      rol: window.USER?.rol,
      municipio: window.USER?.municipio
    }));
    expect(userInfo.rol, 'La cuenta configurada debe tener rol MUNICIPAL').toBe('MUNICIPAL');

    const resultado = await page.evaluate(async ({ cluesA, cluesB }) => {
      const [resA, resB] = await Promise.all([
        window.supabase.from('registros_sis').select('variable_sis, valor').eq('clues', cluesA).eq('anio', 2026).limit(5),
        window.supabase.from('registros_sis').select('variable_sis, valor').eq('clues', cluesB).eq('anio', 2026).limit(5)
      ]);
      return {
        corregidora: { count: resA.data?.length || 0, error: resA.error?.message || null },
        huimilpan: { count: resB.data?.length || 0, error: resB.error?.message || null }
      };
    }, { cluesA: CLUES_CORREGIDORA, cluesB: CLUES_HUIMILPAN });

    expect(resultado.corregidora.error).toBeNull();
    expect(resultado.corregidora.count, 'Sin lectura de Corregidora: volvio a romperse el permiso de RLS').toBeGreaterThan(0);

    expect(resultado.huimilpan.error).toBeNull();
    expect(resultado.huimilpan.count, 'Sin lectura de Huimilpan: volvio a romperse el permiso de RLS').toBeGreaterThan(0);
  });
});
