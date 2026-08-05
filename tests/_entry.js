// Permite correr la MISMA suite de pruebas contra index.html (produccion) o
// contra otra copia (ej. index.bundled-test.html) sin duplicar ningun test.
// Uso: SIREVAQ_TEST_ENTRY=index.bundled-test.html npx playwright test
const ENTRY_HTML = process.env.SIREVAQ_TEST_ENTRY || 'index.html';
module.exports = { ENTRY_HTML };
