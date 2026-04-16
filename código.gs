/**
 * JS1 REPORTES - MICRO-SCRIPT BRIDGE (DRIVE GATEWAY)
 * Este script solo se encarga de recibir archivos en Base64 y guardarlos en Drive.
 * La lógica de datos ahora reside en Supabase.
 */

const DRIVE_ROOT_FOLDER_ID = "1peAgAjdKkjAHJGMcHbdPLKiXlqIwUm_J";

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    if (action === "uploadfile") {
      const result = api_uploadFile(payload);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Acción no soportada en el Bridge." }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function api_uploadFile(payload) {
  try {
    const base64 = payload.base64;
    const filename = payload.filename;
    const mimeType = payload.mimeType;
    const category = payload.category || "Otros reportes";
    const clues = payload.clues || "SIN_CLUES";
    const unidad = payload.unidad || "SIN_NOMBRE";

    if (!base64 || !filename) throw new Error("Datos de archivo incompletos.");

    const rootFolder = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);
    
    // 1. Carpeta de la Unidad: [CLUES] - [Nombre Unidad]
    const unitFolderName = `${clues} - ${unidad}`;
    const unitFolder = getOrCreateSubFolder_(rootFolder, unitFolderName);

    // 2. Carpeta de Categoría
    const catFolder = getOrCreateSubFolder_(unitFolder, category);

    // 3. Renombrar archivo
    const now = new Date();
    const dateStr = Utilities.formatDate(now, "GMT-6", "yyyyMMdd-HHmm");
    const newName = `${clues} - ${category} - ${dateStr} - ${filename}`;

    // 4. Guardar Archivo
    const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, newName);
    const file = catFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return {
      ok: true,
      data: {
        id: file.getId(),
        url: file.getUrl(),
        name: file.getName()
      }
    };

  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function getOrCreateSubFolder_(parentFolder, folderName) {
  const folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(folderName);
}
