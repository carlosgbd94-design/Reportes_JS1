import sys
with open('main.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_block = """    if (!res || !res.ok) {
      showToast((res && res.error) ? res.error : "No se pudo obtener datos para el reporte", false);
      return;
    }

    await generateProfessionalXLSX(tipo, res.data, fIni, fFin, municipios);
    showToast("El reporte se generó correctamente");"""

new_block = """    if (!res || !res.ok) {
      showToast((res && res.error) ? res.error : "No se pudo obtener datos para el reporte", false);
      return;
    }

    const splitCheckbox = $("exportSplitByMunicipio");
    if (splitCheckbox && splitCheckbox.checked && typeof JSZip !== 'undefined') {
      let targetMuns = municipios && municipios.length > 0 ? municipios : [];
      if (targetMuns.length === 0) {
        targetMuns = Array.from(new Set(res.data.map(d => d.municipio || (d.unidades && d.unidades.municipio)).filter(Boolean)));
      }
      if (targetMuns.length === 0 && USER && USER.municipio) {
        targetMuns = String(USER.municipio).split(",").map(m => m.trim());
      }
      
      if (targetMuns.length > 0) {
        const zip = new JSZip();
        for (const mun of targetMuns) {
          const mData = res.data.filter(d => (d.municipio === mun) || (d.unidades && d.unidades.municipio === mun));
          if (mData.length > 0) {
             const result = await generateProfessionalXLSX(tipo, mData, fIni, fFin, [mun], true);
             if (result && result.buffer) {
               zip.file(result.fileName, result.buffer);
             }
          }
        }
        const zipContent = await zip.generateAsync({ type: "blob" });
        const url = window.URL.createObjectURL(zipContent);
        const a = document.createElement("a");
        a.href = url;
        const todayStr = new Date().toISOString().split('T')[0];
        a.download = `Reportes_${tipo}_${todayStr}.zip`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        await generateProfessionalXLSX(tipo, res.data, fIni, fFin, municipios);
      }
    } else {
      await generateProfessionalXLSX(tipo, res.data, fIni, fFin, municipios);
    }
    showToast("El reporte se generó correctamente");"""

if old_block in content:
    content = content.replace(old_block, new_block)
    with open('main.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed btnDoExport correctly.")
else:
    print("Could not find btnDoExport block!")
