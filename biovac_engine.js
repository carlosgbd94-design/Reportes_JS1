// ============================================================================
// BioVac — Motor de reglas, espejo en JS de biovac_calc_existencia_final()
// (supabase/biovac_engine.sql). Uso: preview instantáneo en la UI antes de
// guardar. El valor que realmente queda guardado siempre lo calcula el
// trigger en la base de datos -- este módulo nunca es la fuente de verdad.
// ============================================================================

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BiovacEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function calcExistenciaFinal(p) {
    const presentacion = p.presentacion;
    const dosisPorFrasco = p.dosisPorFrascoOverride != null ? p.dosisPorFrascoOverride : p.dosisPorFrasco;
    const reglaEspecial = p.reglaEspecial;
    const anterior = Number(p.existenciaAnterior) || 0;
    const recibido = Number(p.recibido) || 0;
    const aplicadasA = Number(p.aplicadasA) || 0;
    const aplicadasB = Number(p.aplicadasB) || 0;
    const desechadasA = Number(p.desechadasA) || 0;
    const desechadasB = Number(p.desechadasB) || 0;

    let aplicadas, desechadas;
    if (reglaEspecial === 'SPLIT_DOSE') {
      aplicadas = aplicadasA / 2 + aplicadasB;
      desechadas = desechadasA / 2 + desechadasB;
    } else {
      aplicadas = aplicadasA + aplicadasB;
      desechadas = desechadasA + desechadasB;
    }

    if (presentacion === 'UNIDOSIS') {
      return (anterior + recibido) - (aplicadas + desechadas);
    }
    const dosis = dosisPorFrasco || 1;
    return ((anterior + recibido) * dosis - (aplicadas + desechadas)) / dosis;
  }

  return { calcExistenciaFinal };
});
