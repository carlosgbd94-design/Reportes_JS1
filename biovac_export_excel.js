// ============================================================================
// BioVac — Exportador a Excel, 100% fiel a "MoViMiEnTo De BiOlOgICo 2026.xlsx"
//
// Estrategia: la plantilla real (biovac_plantilla.xlsx) tiene un número FIJO
// de renglones por bloque, pero el motor permite un número VARIABLE de lotes
// por mes -- por eso no se puede solo "llenar celdas" del archivo original.
//
// En su lugar: se capturan del propio archivo (una sola vez, antes de tocar
// nada) los estilos de celda reales (fuente, bordes, formato de número) y el
// bloque de encabezado institucional completo (12 filas, con sus fusiones),
// se limpia todo lo que hay debajo del encabezado, y se reconstruye fila por
// fila con el número exacto de lotes de cada bloque -- aplicando esos
// mismos estilos y fusiones capturados, y las MISMAS fórmulas que usa el
// Excel original (unidosis / multidosis / dosis fraccionada), no valores
// fijos. Los logos, márgenes y orientación de página vienen intactos del
// archivo real (nunca se tocan).
// ============================================================================

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('exceljs'));
  } else {
    root.BiovacExportExcel = factory(root.ExcelJS);
  }
})(typeof self !== 'undefined' ? self : this, function (ExcelJS) {
  'use strict';

  const MESES_ABREV = { 1: 'ENE', 2: 'FEB', 3: 'MAR', 4: 'ABR', 5: 'MAY', 6: 'JUN', 7: 'JUL', 8: 'AGO', 9: 'SEP', 10: 'OCT', 11: 'NOV', 12: 'DIC' };
  const MESES_NOMBRE = { 1: 'ENERO', 2: 'FEBRERO', 3: 'MARZO', 4: 'ABRIL', 5: 'MAYO', 6: 'JUNIO', 7: 'JULIO', 8: 'AGOSTO', 9: 'SEPTIEMBRE', 10: 'OCTUBRE', 11: 'NOVIEMBRE', 12: 'DICIEMBRE' };

  // Filas/columnas fijas del encabezado institucional (idénticas en Anverso
  // y Reverso -- 12 filas), verificadas contra el archivo real.
  const HEADER_FILAS = 12;
  const CELDAS_DINAMICAS_HEADER = [
    { filaRel: 5, col: 'O', campo: 'mesNombre' },
    { filaRel: 7, col: 'C', campo: 'dia' },
    { filaRel: 7, col: 'F', campo: 'mesNombre' },
    { filaRel: 7, col: 'I', campo: 'anio' },
    { filaRel: 7, col: 'O', campo: 'municipio' },
    { filaRel: 8, col: 'D', campo: 'responsable' }
  ];

  // Filas de la plantilla usadas como fuente de estilos (bloque BCG, siempre
  // el primero de Anverso en toda hoja mensual de la plantilla real).
  const FILA_ESTILO_NORMAL = 13;
  const FILA_ESTILO_ARF = 16;
  const FILA_ESTILO_TOTAL = 18;

  function colLetra(n) { return String.fromCharCode(64 + n); }

  function clonarEstiloCelda(cell) {
    return JSON.parse(JSON.stringify(cell.style || {}));
  }

  function capturarBloqueFilas(ws, filaInicio, numFilas) {
    const filas = [];
    for (let r = 0; r < numFilas; r++) {
      const fila = ws.getRow(filaInicio + r);
      const celdas = [];
      for (let c = 1; c <= 17; c++) {
        const cell = fila.getCell(c);
        celdas.push({ col: c, value: cell.value, style: clonarEstiloCelda(cell) });
      }
      filas.push(celdas);
    }
    const merges = ws.model.merges
      .map((rango) => {
        const m = rango.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
        if (!m) return null;
        return { c1: m[1], r1: Number(m[2]), c2: m[3], r2: Number(m[4]) };
      })
      .filter((m) => m && m.r1 >= filaInicio && m.r2 < filaInicio + numFilas);
    return { filas, merges, filaInicio };
  }

  function escribirBloqueCapturado(ws, filaDestino, capturado, overrides) {
    capturado.filas.forEach((celdas, i) => {
      const filaDestinoAbs = filaDestino + i;
      const row = ws.getRow(filaDestinoAbs);
      celdas.forEach(({ col, value, style }) => {
        const cell = row.getCell(col);
        cell.value = value;
        cell.style = JSON.parse(JSON.stringify(style));
      });
      row.commit && row.commit();
    });
    capturado.merges.forEach((m) => {
      const offset = filaDestino - capturado.filaInicio;
      try {
        ws.mergeCells(`${m.c1}${m.r1 + offset}:${m.c2}${m.r2 + offset}`);
      } catch (e) { /* rango ya fusionado, ignorar */ }
    });
    if (overrides) {
      overrides.forEach(({ filaRel, col, valor }) => {
        ws.getCell(`${col}${filaDestino + filaRel - 1}`).value = valor;
      });
    }
  }

  function aplicarOverridesHeader(ws, filaBase, datos) {
    CELDAS_DINAMICAS_HEADER.forEach(({ filaRel, col, campo }) => {
      ws.getCell(`${col}${filaBase + filaRel - 1}`).value = datos[campo];
    });
  }

  // ---------------------------------------------------------------------
  // Fórmulas -- idénticas a las del Excel real (ver biovac_engine.sql).
  // ---------------------------------------------------------------------

  function formulaExistenciaFinal(fila, presentacion, dosis, reglaEspecial) {
    if (reglaEspecial === 'SPLIT_DOSE') {
      return `IFERROR(IF((((B${fila}+E${fila})*${dosis})-(J${fila}+M${fila}))/${dosis}=0," ",(((B${fila}+E${fila})*${dosis})-(J${fila}+M${fila}))/${dosis})," ")`;
    }
    if (presentacion === 'UNIDOSIS') {
      return `IF(((B${fila}+E${fila})-(H${fila}+K${fila}))=0," ",((B${fila}+E${fila})-(H${fila}+K${fila})))`;
    }
    return `IF((((B${fila}+E${fila})*${dosis})-(H${fila}+K${fila}))/${dosis}=0," ",(((B${fila}+E${fila})*${dosis})-(H${fila}+K${fila}))/${dosis})`;
  }

  function formulaTotal(col1, col2, filaIni, filaFin, filaTotal) {
    return `IF(SUM(${col1}${filaIni}:${col2}${filaFin})=0," ",SUM(${col1}${filaIni}:${col2}${filaFin}))`;
  }

  // ---------------------------------------------------------------------
  // Escribir un bloque de biológico completo (nombre + normales + A.R.F. + Total)
  // ---------------------------------------------------------------------

  function renglonVacio() {
    return { numeroLote: '', caducidad: null, existenciaAnterior: '', recibido: '', aplicadasA: '', aplicadasB: '', desechadasA: '', desechadasB: '', observaciones: null, dosisPorFrasco: null };
  }

  function escribirDatosRenglon(ws, fila, r, split) {
    const row = ws.getRow(fila);
    row.getCell(2).value = r.existenciaAnterior === '' ? null : r.existenciaAnterior;
    row.getCell(3).value = r.numeroLote || null;
    row.getCell(4).value = r.caducidad || null;
    row.getCell(5).value = r.recibido === '' ? null : r.recibido;
    row.getCell(6).value = r.numeroLote || null;
    row.getCell(7).value = r.caducidad || null;
    row.getCell(8).value = r.aplicadasA === '' ? null : r.aplicadasA;
    if (split) row.getCell(9).value = r.aplicadasB === '' ? null : r.aplicadasB;
    row.getCell(11).value = r.desechadasA === '' ? null : r.desechadasA;
    if (split) row.getCell(12).value = r.desechadasB === '' ? null : r.desechadasB;
    row.getCell(15).value = r.numeroLote || null;
    row.getCell(16).value = r.caducidad || null;
  }

  // Escribe un bloque completo, que puede combinar VARIOS biológicos bajo
  // un solo renglón "Total" compartido (caso real: COVID-19 MODERNA y
  // COVID-19 PFIZER comparten un único Total y una sola sección A.R.F.,
  // aunque cada uno tenga su propia presentación/dosis por renglón).
  function escribirBloqueCompuesto(ws, filaInicio, biosConRenglones, estilos) {
    let fila = filaInicio;
    const inicioBloque = fila;
    const arfCombinado = [];

    for (const { bio, normales, arf } of biosConRenglones) {
      const split = bio.regla_especial === 'SPLIT_DOSE';
      const listaNormal = normales.length > 0 ? normales : [renglonVacio()];
      const inicioNormalBio = fila;
      for (let i = 0; i < listaNormal.length; i++) {
        aplicarEstiloFila(ws, fila, estilos.normal, split);
        if (i === 0) ws.getCell(`A${fila}`).value = { richText: [{ text: bio.nombre_excel }] };
        escribirDatosRenglon(ws, fila, listaNormal[i], split);
        const dosis = listaNormal[i].dosisPorFrasco || bio.dosis_por_frasco || 1;
        escribirFormulasFila(ws, fila, bio, dosis, split);
        fila++;
      }
      ws.mergeCells(`A${inicioNormalBio}:A${fila - 1}`);
      arf.forEach((r) => arfCombinado.push({ bio, renglon: r }));
    }

    const inicioArf = fila;
    const listaArf = arfCombinado.length > 0 ? arfCombinado : [{ bio: biosConRenglones[0].bio, renglon: renglonVacio() }];
    for (let i = 0; i < listaArf.length; i++) {
      const { bio, renglon } = listaArf[i];
      const split = bio.regla_especial === 'SPLIT_DOSE';
      aplicarEstiloFila(ws, fila, estilos.arf, split);
      if (i === 0) ws.getCell(`A${fila}`).value = { richText: [{ text: 'A.R.F.\nEn dictamen o canje', font: { bold: true, color: { argb: 'FFFF0000' } } }] };
      escribirDatosRenglon(ws, fila, renglon, split);
      const dosis = renglon.dosisPorFrasco || bio.dosis_por_frasco || 1;
      escribirFormulasFila(ws, fila, bio, dosis, split);
      fila++;
    }
    const finArf = fila - 1;
    ws.mergeCells(`A${inicioArf}:A${finArf}`);
    ws.mergeCells(`Q${inicioBloque}:Q${finArf}`);

    const todasLasFilas = biosConRenglones.flatMap((b) => [...b.normales, ...b.arf]);
    const observaciones = todasLasFilas.map((r) => r.observaciones).find((o) => o);
    if (observaciones) ws.getCell(`Q${inicioBloque}`).value = observaciones;

    const filaTotal = fila;
    aplicarEstiloFilaTotal(ws, filaTotal, estilos.total);
    ws.getCell(`A${filaTotal}`).value = 'Total';
    ws.getCell(`B${filaTotal}`).value = { formula: formulaTotal('B', 'B', inicioBloque, finArf, filaTotal) };
    ws.getCell(`E${filaTotal}`).value = { formula: formulaTotal('E', 'E', inicioBloque, finArf, filaTotal) };
    ws.getCell(`H${filaTotal}`).value = { formula: formulaTotal('H', 'J', inicioBloque, finArf, filaTotal) };
    ws.getCell(`K${filaTotal}`).value = { formula: formulaTotal('K', 'M', inicioBloque, finArf, filaTotal) };
    ws.getCell(`N${filaTotal}`).value = { formula: formulaTotal('N', 'N', inicioBloque, finArf, filaTotal) };
    ws.mergeCells(`C${filaTotal}:D${filaTotal}`);
    ws.mergeCells(`F${filaTotal}:G${filaTotal}`);
    ws.mergeCells(`H${filaTotal}:J${filaTotal}`);
    ws.mergeCells(`K${filaTotal}:M${filaTotal}`);
    ws.mergeCells(`O${filaTotal}:P${filaTotal}`);

    return filaTotal + 1;
  }

  function escribirFormulasFila(ws, fila, bio, dosis, split) {
    if (split) {
      ws.getCell(`J${fila}`).value = { formula: `(((H${fila}/2)+(I${fila})))` };
      ws.getCell(`M${fila}`).value = { formula: `(((K${fila}/2)+(L${fila})))` };
    }
    ws.getCell(`N${fila}`).value = { formula: formulaExistenciaFinal(fila, bio.presentacion, dosis, bio.regla_especial) };
    ws.getCell(`O${fila}`).value = { formula: `IF(F${fila}=0," ",F${fila})` };
    ws.getCell(`P${fila}`).value = { formula: `IF(G${fila}=0," ",G${fila})` };
  }

  function aplicarEstiloFila(ws, fila, plantillaFila, split) {
    const row = ws.getRow(fila);
    plantillaFila.forEach(({ col, style }) => { row.getCell(col).style = JSON.parse(JSON.stringify(style)); });
    if (!split) {
      ws.mergeCells(`H${fila}:J${fila}`);
      ws.mergeCells(`K${fila}:M${fila}`);
    }
  }

  function aplicarEstiloFilaTotal(ws, fila, plantillaFila) {
    const row = ws.getRow(fila);
    plantillaFila.forEach(({ col, style }) => { row.getCell(col).style = JSON.parse(JSON.stringify(style)); });
  }

  // ---------------------------------------------------------------------
  // Orquestación principal
  // ---------------------------------------------------------------------

  async function construirWorkbook({ db, unidad, movimiento, plantillaBuffer }) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(plantillaBuffer);
    const hojaOrigen = MESES_ABREV[movimiento.mes];
    const ws = wb.getWorksheet(hojaOrigen);
    if (!ws) throw new Error('La plantilla no tiene la hoja ' + hojaOrigen);

    // Los logos están anclados a filas fijas de la plantilla (2 para
    // Anverso, 2 para Reverso). El encabezado de Anverso nunca se mueve,
    // pero el bloque de Reverso se reconstruye en una fila distinta según
    // cuántos renglones tenga Anverso ese mes -- sin esto, los logos del
    // Reverso quedarían "flotando" en su posición original de plantilla.
    // tl.col/row (y br.col/row) son las posiciones FRACCIONARIAS reales
    // (columna+fracción, fila+fracción) -- no solo nativeCol/nativeRow
    // (enteros). Guardarlas completas es lo que permite reubicar el logo
    // en su fila nueva sin perder su desfase exacto dentro de la celda; si
    // se reconstruye solo con col/row enteros (sin la fracción), addImage
    // ancla el logo pegado a la esquina de la celda y queda "desfazado"
    // frente al original.
    const imagenesReverso = ws.getImages()
      .filter((img) => img.range.tl.nativeRow >= HEADER_FILAS)
      .map((img) => ({
        imageId: img.imageId,
        filaAnclaOriginal: img.range.tl.nativeRow, // 0-index, entero, solo para calcular el delta
        tlCol: img.range.tl.col, tlRow: img.range.tl.row,
        brCol: img.range.br.col, brRow: img.range.br.row
      }));
    ws._media = ws._media.filter((m) => !(m.type === 'image' && m.range.tl.nativeRow >= HEADER_FILAS));

    const headerCapturado = capturarBloqueFilas(ws, 1, HEADER_FILAS);
    const estiloNormal = capturarBloqueFilas(ws, FILA_ESTILO_NORMAL, 1).filas[0];
    const estiloArf = capturarBloqueFilas(ws, FILA_ESTILO_ARF, 1).filas[0];
    const estiloTotal = capturarBloqueFilas(ws, FILA_ESTILO_TOTAL, 1).filas[0];
    const estilos = { normal: estiloNormal, arf: estiloArf, total: estiloTotal };

    const [{ data: bloques }, { data: biologicos }] = await Promise.all([
      db.from('biovac_bloques_catalogo').select('*').order('pagina').order('orden'),
      db.from('biovac_catalogo_biologicos').select('*').order('orden_en_bloque')
    ]);
    const { data: renglonesDb } = await db.from('biovac_renglones')
      .select(`categoria, existencia_anterior_frascos, recibido_frascos, aplicadas_a, aplicadas_b, desechadas_a, desechadas_b, observaciones,
        biovac_lotes ( numero_lote, caducidad, dosis_por_frasco_override, biologico_id )`)
      .eq('movimiento_id', movimiento.id);

    const fechaRef = new Date(Date.UTC(movimiento.anio, movimiento.mes - 1, 1));
    const bioVigente = (b) => {
      const desde = new Date(b.vigente_desde + 'T00:00:00Z');
      const hasta = b.vigente_hasta ? new Date(b.vigente_hasta + 'T00:00:00Z') : null;
      return fechaRef >= desde && (!hasta || fechaRef <= hasta);
    };

    const datosHeader = {
      mesNombre: MESES_NOMBRE[movimiento.mes], dia: movimiento.fecha_corte ? Number(movimiento.fecha_corte.slice(8, 10)) : '',
      anio: movimiento.anio, municipio: unidad.municipio, responsable: movimiento.responsable_elaboracion || ''
    };

    // limpiar todo debajo del encabezado -- primero desfusionar explícitamente
    // (spliceRows no siempre libera el registro interno de celdas combinadas)
    ws.model.merges.slice().forEach((rango) => {
      const m = rango.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
      if (m && Number(m[2]) > HEADER_FILAS) {
        try { ws.unMergeCells(rango); } catch (e) { /* ignorar */ }
      }
    });
    // ws.spliceRows no limpia de forma confiable rangos grandes (deja
    // valores fantasma de filas ya "eliminadas" -- verificado). Se limpia
    // celda por celda en su lugar.
    for (let r = HEADER_FILAS + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      for (let c = 1; c <= 17; c++) row.getCell(c).value = null;
    }
    aplicarOverridesHeader(ws, 1, datosHeader);

    let fila = HEADER_FILAS + 1;
    let paginaActual = 'ANVERSO';

    for (const bloque of bloques) {
      const biosDelBloque = biologicos.filter((b) => b.bloque_id === bloque.id && bioVigente(b)).sort((a, b) => a.orden_en_bloque - b.orden_en_bloque);
      if (biosDelBloque.length === 0) continue;

      if (bloque.pagina !== paginaActual) {
        ws.getRow(fila - 1).addPageBreak();
        escribirBloqueCapturado(ws, fila, headerCapturado, null);
        ws.getCell(`A${fila}`).value = 'Reverso';
        aplicarOverridesHeader(ws, fila, datosHeader);
        imagenesReverso.forEach((img) => {
          const nuevaFilaTl = fila - 1; // 0-index, misma fila que "Reverso"
          const delta = nuevaFilaTl - img.filaAnclaOriginal;
          ws.addImage(img.imageId, {
            tl: { col: img.tlCol, row: img.tlRow + delta },
            br: { col: img.brCol, row: img.brRow + delta }
          });
        });
        fila += HEADER_FILAS;
        paginaActual = 'REVERSO';
      }

      const biosConRenglones = biosDelBloque.map((bio) => {
        const renglonesBio = renglonesDb.filter((r) => r.biovac_lotes.biologico_id === bio.id);
        return {
          bio,
          // El formulario real imprime ARF y Canje juntos bajo una sola
          // sección "A.R.F. En dictamen o canje" (aunque internamente son
          // categorías distintas -- ver biovac_ui.js).
          normales: renglonesBio.filter((r) => r.categoria === 'NORMAL').map((r) => mapRenglon(r)),
          arf: renglonesBio.filter((r) => r.categoria !== 'NORMAL').map((r) => mapRenglon(r))
        };
      }).filter((b) => b.normales.length > 0 || b.arf.length > 0);
      if (biosConRenglones.length === 0) continue;

      fila = escribirBloqueCompuesto(ws, fila, biosConRenglones, estilos);
    }

    // ws.spliceRows() no limpia de forma confiable rangos grandes (mismo
    // problema ya documentado al limpiar debajo del encabezado): deja
    // bordes/relleno (ej. el rosa de A.R.F.) de las filas "extra" que trae
    // la plantilla más allá de lo que este mes realmente necesitó. Se
    // limpia celda por celda -- valor Y estilo -- en su lugar.
    const filaFinalPlantilla = ws.rowCount;
    ws.model.merges.slice().forEach((rango) => {
      const m = rango.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
      if (m && Number(m[2]) >= fila) {
        try { ws.unMergeCells(rango); } catch (e) { /* ignorar */ }
      }
    });
    for (let r = fila; r <= filaFinalPlantilla; r++) {
      const row = ws.getRow(r);
      for (let c = 1; c <= 17; c++) {
        const cell = row.getCell(c);
        cell.value = null;
        cell.style = {};
      }
    }

    wb.eachSheet((hoja) => { if (hoja.name !== hojaOrigen) wb.removeWorksheet(hoja.id); });
    ws.name = `${MESES_ABREV[movimiento.mes]} ${unidad.nombre}`.slice(0, 31);

    return wb;
  }

  function mapRenglon(r) {
    return {
      numeroLote: r.biovac_lotes.numero_lote, caducidad: r.biovac_lotes.caducidad,
      dosisPorFrasco: r.biovac_lotes.dosis_por_frasco_override,
      existenciaAnterior: Number(r.existencia_anterior_frascos), recibido: Number(r.recibido_frascos),
      aplicadasA: Number(r.aplicadas_a), aplicadasB: Number(r.aplicadas_b),
      desechadasA: Number(r.desechadas_a), desechadasB: Number(r.desechadas_b),
      observaciones: r.observaciones
    };
  }

  async function exportarExcel({ db, unidad, movimiento, plantillaBuffer }) {
    const wb = await construirWorkbook({ db, unidad, movimiento, plantillaBuffer });
    return wb.xlsx.writeBuffer();
  }

  return { exportarExcel, construirWorkbook };
});
