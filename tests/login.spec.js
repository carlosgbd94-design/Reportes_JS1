const { test, expect } = require('@playwright/test');

test.describe('SIREVAQ Login Flow', () => {
  test('debería mostrar la pantalla de login al cargar la página', async ({ page }) => {
    // Navegar a la página principal
    await page.goto('/index.html');

    // Verificar que el título sea correcto
    await expect(page).toHaveTitle(/SIREVAQ/);

    // Verificar que el contenedor de login esté visible (no oculto)
    const loginWrapper = page.locator('#loginWrapper');
    await expect(loginWrapper).toBeVisible();

    // Verificar la presencia de los campos de usuario y contraseña
    const usernameInput = page.locator('#usuario');
    const passwordInput = page.locator('#password');
    await expect(usernameInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Intentar iniciar sesión sin datos (debería mostrar validaciones si existen, o simplemente no avanzar)
    const loginButton = page.locator('#btnLogin');
    await loginButton.click();

    // Como es Vanilla JS y depende de Supabase, podemos verificar que 
    // el estado de carga o las notificaciones reaccionen.
  });
});
