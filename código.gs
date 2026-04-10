const SHEET_SR_EXISTENCIA = "EXISTENCIA_BIOLOGICOS";
const SHEET_CONS = "CONSUMIBLES";
const SHEET_UNIDADES = "UNIDADES";
const SHEET_EDITLOG = "EDIT_LOG";
const SHEET_USERS = "USUARIOS";
const SHEET_BIO_PARAMS = "PARAM_BIOLOGICOS";
const SHEET_BIO_CAPTURE = "CAPTURA_BIOLOGICOS";
const SHEET_BIO_CATALOG = "CATALOGO_BIOLOGICOS";
const SHEET_BIO_CALENDAR = "CALENDARIO_PEDIDOS";
const PROP_CONS_OVERRIDE = "CAPTURA_EXTRA_CONSUMIBLES";
const SHEET_BIO_EXPORT_TEMPLATE = "MATRIZ_EXPORT_EJEMPLO";
const SHEET_EXISTENCIA_EXPORT_TEMPLATE = "MATRIZ_EXPORT_EXISTENCIA";
const SHEET_CONS_EXPORT_TEMPLATE = "EXPORT_CONSUMIBLES";
const SHEET_PINOL = "PINOL_SOLICITUDES";
const SHEET_REMINDER_LOG = "REMINDER_LOG";
const SHEET_NOTIFICATIONS = "NOTIFICACIONES";
const SHEET_LOTES_CAD = "LOTES_CAD";
const SHEET_EXISTENCIA_DETALLE = "EXISTENCIA_DETALLE";
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycby3en_qswj1PmE6o80nypsDM6Gw4kueRUimNSgMKJxzDojRFCsXBjFZngR9UpnkYL0n/exec";
const DRIVE_ROOT_FOLDER_ID = "1peAgAjdKkjAHJGMcHbdPLKiXlqIwUm_J";
const CACHE_TTL_USERS = 3600; // 1 hora
const CACHE_TTL_ASSETS = 21600; // 6 horas
const CACHE_TTL_UNITS = 3600; // 1 hora
const PASS_SALT = "JS1_SALT_2026_MX"; // Salt para haseo


/** ===== NOTIFICACIONES / CORREOS ===== **/
const EMAIL_RESUMEN_SEMANAL = [
  "municipioqrojs1@gmail.com",
  "vacunasjs1hc@gmail.com"
];

const EMAIL_ALERTAS_BY_MUNICIPIO = {
  "QUERETARO": ["municipioqrojs1@gmail.com"],
  "CORREGIDORA": ["vacunasjs1hc@gmail.com"],
  "HUIMILPAN": ["vacunasjs1hc@gmail.com"],
  "EL MARQUES": ["vacunasmarques@gmail.com"]
};

/** ===== LOGOS (Drive IDs) ===== **/
const ASSET_IDS = {
  logoA: "1wavwggjESRFKgW-eK9IMPuVt5XfU_sKU",
  logoB: "1JpoboFIERAwkcTOv8W1LsYaiatcD7sD2"
};

/** ===== WEB APP ===== **/
function doGet(e) {
  try {
    const mode = normalize_(e?.parameter?.mode || "");
    const token = normalize_(e?.parameter?.t || "");

    if (mode === "reset") {
      const tpl = HtmlService.createTemplateFromFile("reset");
      tpl.RESET_TOKEN = token;

      return tpl.evaluate()
        .setTitle("Restablecer contraseña - JS1 Reportes")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    if (mode === "biologicos") {
      const tpl = HtmlService.createTemplateFromFile("biologicos");

      tpl.LOGO_A = getAssetDataUrl_("logoA");
      tpl.LOGO_B = getAssetDataUrl_("logoB");
      tpl.PAGE_MODE = mode;
      tpl.RESET_TOKEN = token;
      tpl.WEB_APP_URL = WEB_APP_URL;

      return tpl.evaluate()
        .setTitle("Pedido de biológico - JS1 Reportes")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    const tpl = HtmlService.createTemplateFromFile("index");

    tpl.LOGO_A = getAssetDataUrl_("logoA");
    tpl.LOGO_B = getAssetDataUrl_("logoB");
    tpl.PAGE_MODE = mode;
    tpl.RESET_TOKEN = token;
    tpl.WEB_APP_URL = WEB_APP_URL;

    return tpl.evaluate()
      .setTitle("JS1 Reportes")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  } catch (err) {
    return HtmlService.createHtmlOutput(
      '<pre style="font-family:monospace;white-space:pre-wrap">' +
      'Error en doGet:\n' +
      String(err && err.stack ? err.stack : err) +
      '</pre>'
    );
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** ===== ASSETS: Data URL (base64) con Caché ===== **/
function getAssetDataUrl_(key) {
  const cacheKey = "ASSET_" + key;
  const cached = CacheService.getScriptCache().get(cacheKey);
  if (cached) return cached;

  const id = ASSET_IDS[key];
  if (!id) return "";

  try {
    const file = DriveApp.getFileById(id);
    const blob = file.getBlob();
    const mime = blob.getContentType() || "image/png";
    const b64 = Utilities.base64Encode(blob.getBytes());
    const dataUrl = `data:${mime};base64,${b64}`;
    
    // Almacenar en caché por 6 horas
    CacheService.getScriptCache().put(cacheKey, dataUrl, CACHE_TTL_ASSETS);
    return dataUrl;
  } catch (e) {
    Logger.log("Error cargando asset " + key + ": " + e.message);
    return "";
  }
}

/** ===== DISPATCH API ===== **/
function withLock_(fn) {
  return function(req) {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(12000);
    } catch(e) {
      return { ok: false, error: "Servidor procesando capturas simultáneas. Por favor reintenta en unos segundos." };
    }
    try {
      return fn(req);
    } finally {
      lock.releaseLock();
    }
  };
}

function api(req) {
  const action = String(req?.action || "").trim();

  switch (action) {
    case "login": return api_login(req);
    case "whoami": return api_whoami(req);
    case "unitStatus": return api_unitStatus(req);

    case "saveSR": return withLock_(api_saveSR)(req);
    case "saveConsumibles": return withLock_(api_saveConsumibles)(req);

    case "getTodayReports": return api_getTodayReports(req);
    case "updateSR": return api_updateSR(req);
    case "updateConsumibles": return api_updateConsumibles(req);

    case "adminCaptureOverview": return api_adminCaptureOverview(req);

    case "adminGetConsumiblesOverride": return api_adminGetConsumiblesOverride(req);
    case "adminSetConsumiblesOverride": return api_adminSetConsumiblesOverride(req);

    case "bioGetForm": return api_bioGetForm(req);
    case "saveBio": return withLock_(api_saveBio)(req);
    case "bioExportMatrix": return api_bioExportMatrix(req);
    case "srExportMatrix": return api_srExportMatrix(req);
    case "bioGetDatesForMonth": return api_bioGetDatesForMonth(req);

    case "export": return api_export(req);

    case "adminListUsers": return api_adminListUsers(req);
    case "adminCreateUser": return api_adminCreateUser(req);
    case "adminResetPassword": return api_adminResetPassword(req);
    case "adminSetActive": return api_adminSetActive(req);

    case "savePinol": return withLock_(api_savePinol)(req);
    case "listPinol": return api_listPinol(req);
    case "markPinolDelivered": return api_markPinolDelivered(req);
    case "sendNotification": return api_sendNotification(req);
    case "listMyNotifications": return api_listMyNotifications(req);
    case "markNotificationRead": return api_markNotificationRead(req);
    case "deleteNotification": return api_deleteNotification(req);
    case "confirmPinolReceipt": return api_confirmPinolReceipt(req);

    case "bioGetExportOptions": return api_bioGetExportOptions(req);

    case "changeMyPassword": return api_changeMyPassword(req);
    case "saveMyEmail": return api_saveMyEmail(req);

    case "requestPasswordReset": return api_requestPasswordReset(req);
    case "resetPasswordWithToken": return api_resetPasswordWithToken(req);

    case "historyMetrics": return api_historyMetrics(req);
    case "getEditLog": return api_getEditLog(req);
    case "unitCatalog": return api_unitCatalog(req);
    case "notificationUserCatalog": return api_notificationUserCatalog(req);
    case "uploadFile": return api_uploadFile(req);
    case "getLotesByMunicipio": return api_getLotesByMunicipio(req);
    case "saveLotes": return api_saveLotes(req);


    default:
      return { ok: false, error: "Acción inválida: " + action };
  }
}

function api_bioGetExportOptions(payload) {
  try {
    const u = authOrThrow_(payload?.token);

    if (u.rol !== "ADMIN" && u.rol !== "MUNICIPAL" && u.rol !== "JURISDICCIONAL") {
      return { ok:false, error:"Sin permisos para exportar biológicos." };
    }

    const municipios = getExportableMunicipios_(u);

    return {
      ok:true,
      data:{
        municipios,
        rol: u.rol,
        municipiosAllowed: u.municipiosAllowed || [],
        allSelectedByDefault: u.rol === "ADMIN"
      }
    };
  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

function api_uploadFile(payload) {
  try {
    const u = authOrThrow_(payload?.token);
    const base64 = payload?.base64;
    const filename = payload?.filename;
    const mimeType = payload?.mimeType;
    const category = payload?.category || "Otros reportes";

    if (!DRIVE_ROOT_FOLDER_ID || DRIVE_ROOT_FOLDER_ID === "1peAgAjdKkjAHJGMcHbdPLKiXlqIwUm_J") {
       // El ID ya está configurado.
    }

    if (!base64 || !filename) {
      throw new Error("Datos de archivo incompletos.");
    }

    // Determinar la unidad destino
    let finalClues = u.clues;
    let finalUnidad = u.unidad;

    if (u.rol === "MUNICIPAL") {
      if (payload.targetClues && payload.targetUnidad) {
        // VALIDACIÓN: Verificar que el MUNICIPAL tenga permiso sobre esta unidad
        const targetUnit = getUnitByClues_(payload.targetClues);
        if (!targetUnit || !canSeeMunicipio_(u, targetUnit.municipio)) {
          throw new Error("No tienes permisos para subir archivos a esta unidad.");
        }
        finalClues = payload.targetClues;
        finalUnidad = payload.targetUnidad;
      } else {
        throw new Error("El perfil MUNICIPAL debe especificar una unidad destino.");
      }
    }

    const rootFolder = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);
    
    // 1. Carpeta de la Unidad: [CLUES] - [Nombre Unidad]
    const unitFolderName = `${finalClues || "SIN_CLUES"} - ${finalUnidad || "SIN_NOMBRE"}`;
    const unitFolder = getOrCreateSubFolder_(rootFolder, unitFolderName);

    // 2. Carpeta de Categoría
    const catFolder = getOrCreateSubFolder_(unitFolder, category);

    // 3. Renombrar archivo para mejor identificación
    const now = new Date();
    const dateStr = Utilities.formatDate(now, "GMT-6", "yyyyMMdd-HHmm");
    const newName = `${finalClues || "SIN_CLUES"} - ${category} - ${dateStr} - ${filename}`;

    // 4. Guardar Archivo
    const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, newName);
    const file = catFolder.createFile(blob);

    return {
      ok: true,
      data: {
        id: file.getId(),
        url: file.getUrl(),
        name: file.getName()
      }
    };

  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

function getUnitByClues_(clues) {
  const units = getAllActiveUnits_();
  return units.find(x => x.clues === clues) || null;
}


function getOrCreateSubFolder_(parentFolder, folderName) {
  const folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(folderName);
}


/** ===== HELPERS ===== **/
const BIOLOGICOS_SIN_VALIDACION_OPERATIVA = [
  "INFLUENZA",
  "COVID-19",
  "COVID 19",
  "VPH",
  "HEPATITIS A",
  "VARICELA"
];

function isBioSinValidacionOperativa_(biologico) {
  const bioKey = normalizeTextKey_(biologico);
  return BIOLOGICOS_SIN_VALIDACION_OPERATIVA.includes(bioKey);
}

function isCaravanaUnit_(userOrClues) {
  const cluesRaw = typeof userOrClues === "string"
    ? userOrClues
    : (userOrClues?.clues || "");

  const clues = normalizeClues_(cluesRaw);
  return clues.startsWith("FAM") || clues.startsWith("UMME");
}

function getSheet_(name) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error(`No existe la hoja: ${name}`);
  return sh;
}

function ensureNotificationsSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SHEET_NOTIFICATIONS);

  const headers = [
    "id",
    "created_ts",
    "created_date",
    "from_usuario",
    "from_rol",
    "target_scope",
    "target_municipio",
    "target_clues",
    "target_usuario",
    "title",
    "message",
    "type",
    "status",
    "read_ts",
    "read_by",
    "meta_json"
  ];

  if (!sh) {
    sh = ss.insertSheet(SHEET_NOTIFICATIONS);
  }

  ensureHeader_(sh, headers);
  return sh;
}

function ensureLotesSheet_() {
  const sh = getSheet_(SHEET_LOTES_CAD);
  ensureHeader_(sh, ["id", "biologico", "lote", "caducidad"]);
  return sh;
}

function ensureExistenciaDetalleSheet_() {
  const sh = getSheet_(SHEET_EXISTENCIA_DETALLE);
  ensureHeader_(sh, [
    "id", "parent_id", "fecha", "clues", "biologico", 
    "lote", "caducidad", "fecha_recepcion", "cantidad_frascos"
  ]);
  return sh;
}

function isRoleOps_(rol) {
  const r = String(rol || "").trim().toUpperCase();
  return r === "ADMIN" || r === "MUNICIPAL" || r === "JURISDICCIONAL";
}


function normalizeNotifType_(v) {
  const x = String(v || "").trim().toUpperCase();
  if (["INFO", "SUCCESS", "WARN", "ERROR"].includes(x)) return x;
  return "INFO";
}

function normalizeNotifScope_(v) {
  const x = String(v || "").trim().toUpperCase();
  if (["ALL_MY_UNITS", "MUNICIPIO", "CLUES"].includes(x)) return x;
  throw new Error("target_scope inválido. Usa ALL_MY_UNITS, MUNICIPIO o CLUES.");
}

function userCanTargetMunicipio_(sender, municipio) {
  const muni = normalizeTextKey_(municipio);
  if (!muni) return false;

  if (["ADMIN", "JURISDICCIONAL"].includes(String(sender.rol || "").toUpperCase())) return true;


  const allowed = (sender.municipiosAllowed || []).map(normalizeTextKey_);
  return allowed.includes(muni);
}

function notificationTargetsUser_(notif, u) {
  const scope = String(notif.target_scope || "").toUpperCase();
  const userRol = String(u.rol || "").toUpperCase();
  const userMunicipio = normalizeTextKey_(u.municipio || "");
  const userClues = normalize_(u.clues || "");
  const userUsuario = normalize_(u.usuario || "");

  if (scope === "USUARIO") {
    return normalize_(notif.target_usuario) === userUsuario;
  }

  if (scope === "CLUES") {
    return normalize_(notif.target_clues) === userClues;
  }

  if (scope === "MUNICIPIO") {
    const matchMuni = normalizeTextKey_(notif.target_municipio) === userMunicipio;
    if (!matchMuni) return false;

    // RESTRICCIÓN: Notificaciones enviadas por JURISDICCIONAL a un MUNICIPIO
    // solo deben ser visibles para el rol MUNICIPAL (y ADMIN), no para UNIDAD.
    if (String(notif.from_rol || "").toUpperCase() === "JURISDICCIONAL") {
      return userRol === "MUNICIPAL" || userRol === "ADMIN";
    }

    return true;
  }

  if (scope === "ALL_MY_UNITS") {
    if (userRol !== "UNIDAD") return false;
    return normalizeTextKey_(notif.target_municipio) === userMunicipio;
  }

  return false;
}

function parseNotificationRow_(r, rowIndex) {
  return {
    row: rowIndex,
    id: normalize_(r[0]),
    created_ts: r[1] instanceof Date
      ? Utilities.formatDate(r[1], tz_(), "yyyy-MM-dd HH:mm:ss")
      : normalize_(r[1]),
    created_date: normalizeDateKey_(r[2]),
    from_usuario: normalize_(r[3]),
    from_rol: normalize_(r[4]),
    target_scope: normalize_(r[5]).toUpperCase(),
    target_municipio: fixUtf8Text_(normalize_(r[6])),
    target_clues: normalize_(r[7]),
    target_usuario: normalize_(r[8]),
    title: normalize_(r[9]),
    message: normalize_(r[10]),
    type: normalize_(r[11]).toUpperCase(),
    status: (normalize_(r[12]) || "UNREAD").toUpperCase(),
    read_ts: r[13] instanceof Date
      ? Utilities.formatDate(r[13], tz_(), "yyyy-MM-dd HH:mm:ss")
      : normalize_(r[13]),
    read_by: normalize_(r[14]),
    meta_json: normalize_(r[15])
  };
}

function fixUtf8Text_(v) {
  let s = String(v ?? "");
  if (!s) return s;

  s = s.trim();

  const fixes = {
    "QUERÃ‰TARO": "QUERÉTARO",
    "QUERETARO": "QUERÉTARO",
    "EL MARQUÃ‰S": "EL MARQUÉS",
    "EL MARQUES": "EL MARQUÉS",
    "BIOLÃ“GICO": "BIOLÓGICO",
    "BIOLÃ“GICOS": "BIOLÓGICOS",
    "JURISDICCIÃ“N": "JURISDICCIÓN",
    "EXPORTACIÃ“N": "EXPORTACIÓN",
    "PROGRAMACIÃ“N": "PROGRAMACIÓN",
    "VACUNACIÃ“N": "VACUNACIÓN",
    "MUNICIPIOS EXPORTADOS": "MUNICIPIOS EXPORTADOS"
  };

  if (fixes[s]) return fixes[s];

  return s
    .replace(/Ã /g, "Á")
    .replace(/Ã‰/g, "É")
    .replace(/Ã /g, "Í")
    .replace(/Ã“/g, "Ó")
    .replace(/Ãš/g, "Ú")
    .replace(/Ã‘/g, "Ñ")
    .replace(/Ã¡/g, "á")
    .replace(/Ã©/g, "é")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ãº/g, "ú")
    .replace(/Ã±/g, "ñ")
    .replace(/Â/g, "");
}

function formatSheetDate_(value, tz) {
  if (!value) return "";

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) {
    return Utilities.formatDate(value, tz || Session.getScriptTimeZone() || "America/Mexico_City", "yyyy-MM-dd");
  }

  const s = String(value).trim();

  // ya viene como yyyy-MM-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // viene como dd/MM/yyyy o d/M/yyyy
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  // último intento: parsear
  const d = new Date(s);
  if (!isNaN(d)) {
    return Utilities.formatDate(d, tz || Session.getScriptTimeZone() || "America/Mexico_City", "yyyy-MM-dd");
  }

  return s;
}

function normalizeTextKey_(v) {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function getPinolEmailsByMunicipio_(municipio) {
  const key = normalizeTextKey_(municipio);
  return EMAIL_ALERTAS_BY_MUNICIPIO[key] || [];
}

function getAlertEmailsByMunicipio_(municipio) {
  const key = normalizeTextKey_(municipio);

  if (EMAIL_ALERTAS_BY_MUNICIPIO[key] && EMAIL_ALERTAS_BY_MUNICIPIO[key].length) {
    return EMAIL_ALERTAS_BY_MUNICIPIO[key];
  }

  return EMAIL_RESUMEN_SEMANAL || [];
}

function getStrictMunicipioEmails_(municipio) {
  let key = normalizeTextKey_(municipio);

  // 🔥 Corrección inteligente
  if (key === "MARQUES") key = "EL MARQUES";

  if (EMAIL_ALERTAS_BY_MUNICIPIO[key] && EMAIL_ALERTAS_BY_MUNICIPIO[key].length) {
    return EMAIL_ALERTAS_BY_MUNICIPIO[key];
  }

  return [];
}

function normalizeDateKey_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, tz_(), "yyyy-MM-dd");
  }

  const s = String(v ?? "").trim();
  if (!s) return "";

  // Si ya viene como yyyy-MM-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Si viene como dd/MM/yyyy
  const m1 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;

  // Si viene como texto de fecha interpretable
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return Utilities.formatDate(d, tz_(), "yyyy-MM-dd");
  }

  return s;
}

function normalizeClues_(v) {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function ensureHeader_(sh, headers) {
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    return;
  }
  const first = sh.getRange(1, 1, 1, headers.length).getValues()[0];
  const ok = headers.every((h, i) => String(first[i] ?? "").trim() === h);
  if (!ok) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function normalize_(v) { return String(v ?? "").trim(); }
function tz_() { return Session.getScriptTimeZone(); }
function todayStr_() { return Utilities.formatDate(new Date(), tz_(), "yyyy-MM-dd"); }
function dowMexico_() { return new Date().getDay(); } // 4 = jueves
function makeId_() { return Utilities.getUuid(); }

function dateToYmdMx_(d) {
  return Utilities.formatDate(d, tz_(), "yyyy-MM-dd");
}

function parseYmdAsMxDate_(ymd) {
  const s = String(ymd || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return new Date(s + "T12:00:00");
}

function getEasterSundayYmd_(year) {
  year = Number(year);
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDaysYmd_(ymd, delta) {
  const d = parseYmdAsMxDate_(ymd);
  if (!d) return "";
  d.setDate(d.getDate() + Number(delta || 0));
  return dateToYmdMx_(d);
}

function nthWeekdayOfMonthYmd_(year, month, weekday, nth) {
  const first = new Date(`${year}-${String(month).padStart(2, "0")}-01T12:00:00`);
  const firstDow = first.getDay();
  const offset = (weekday - firstDow + 7) % 7;
  const day = 1 + offset + (nth - 1) * 7;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getMexicoHolidayMap_(year) {
  const easter = getEasterSundayYmd_(year);

  return {
    [`${year}-01-01`]: "Año Nuevo",
    [nthWeekdayOfMonthYmd_(year, 2, 1, 1)]: "Constitución",
    [nthWeekdayOfMonthYmd_(year, 3, 1, 3)]: "Natalicio de Benito Juárez",
    [addDaysYmd_(easter, -3)]: "Jueves Santo",
    [addDaysYmd_(easter, -2)]: "Viernes Santo",
    [`${year}-05-01`]: "Día del Trabajo",
    [`${year}-05-05`]: "Batalla de Puebla",
    [`${year}-09-16`]: "Independencia de México",
    [nthWeekdayOfMonthYmd_(year, 11, 1, 3)]: "Revolución Mexicana",
    [`${year}-12-25`]: "Navidad"
  };
}

function getHolidayNameMx_(ymd) {
  const d = parseYmdAsMxDate_(ymd || todayStr_());
  if (!d) return "";
  const year = Number(Utilities.formatDate(d, tz_(), "yyyy"));
  const key = dateToYmdMx_(d);
  const map = getMexicoHolidayMap_(year);
  return map[key] || "";
}

function isWeekendMx_(ymd) {
  const d = parseYmdAsMxDate_(ymd || todayStr_());
  if (!d) return false;
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

function isHolidayMx_(ymd) {
  return !!getHolidayNameMx_(ymd || todayStr_());
}

function shouldSkipAutomatedAlerts_(ymd) {
  const key = ymd || todayStr_();
  return isWeekendMx_(key) || isHolidayMx_(key);
}

function requireNonEmpty_(label, v) {
  if (!normalize_(v)) throw new Error(`Campo obligatorio: ${label}`);
}

function requireNonNegNumber_(label, v) {
  if (v === "" || v === null || typeof v === "undefined") throw new Error(`Campo obligatorio: ${label}`);
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label} inválido (usa número >= 0).`);
  return n;
}

function nonNegNumberOrZero_(v) {
  if (v === "" || v === null || typeof v === "undefined") return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Valor inválido (usa número >= 0).`);
  return n;
}

/** ===== EMAIL ===== **/
function sanitizeEmailList_(toList) {
  const raw = Array.isArray(toList)
    ? toList
    : String(toList || "").split(",");

  return raw
    .map(x => String(x || "").trim())
    .filter(Boolean)
    .filter(x => x.includes("@"))
    .filter(x => !/@correo\.com$/i.test(x))
    .filter(x => !/@example\.com$/i.test(x))
    .filter((x, i, arr) => arr.indexOf(x) === i);
}

function sendEmail_(toList, subject, htmlBody) {
  const clean = sanitizeEmailList_(toList);
  if (!clean.length) {
    Logger.log("sendEmail_: envío omitido, lista vacía o inválida. Asunto: " + String(subject || ""));
    return;
  }

  GmailApp.sendEmail(
    clean.join(","),
    String(subject || ""),
    "Este correo requiere HTML.",
    { htmlBody: String(htmlBody || "") }
  );
}

function ensureReminderLogSheet_() {
  const sh = getSheet_(SHEET_REMINDER_LOG);
  ensureHeader_(sh, [
    "timestamp",
    "fecha",
    "bloque",
    "tipo_envio",
    "municipio",
    "clues",
    "unidad",
    "correo",
    "asunto"
  ]);
  return sh;
}

function wasReminderAlreadySent_(fecha, bloque, clues, tipoEnvio) {
  const sh = ensureReminderLogSheet_();
  const last = sh.getLastRow();
  if (last < 2) return false;

  const data = sh.getRange(2, 1, last - 1, 9).getValues();
  const fechaKey = normalizeDateKey_(fecha);
  const bloqueKey = normalizeTextKey_(bloque);
  const cluesKey = normalizeClues_(clues);
  const tipoKey = normalizeTextKey_(tipoEnvio);

  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    const rowFecha = normalizeDateKey_(r[1]);
    const rowBloque = normalizeTextKey_(r[2]);
    const rowTipo = normalizeTextKey_(r[3]);
    const rowClues = normalizeClues_(r[5]);

    if (rowFecha === fechaKey && rowBloque === bloqueKey && rowTipo === tipoKey && rowClues === cluesKey) {
      return true;
    }
  }

  return false;
}

function logReminderSent_(payload) {
  const sh = ensureReminderLogSheet_();
  sh.appendRow([
    new Date(),
    normalizeDateKey_(payload?.fecha || todayStr_()),
    normalize_(payload?.bloque),
    normalize_(payload?.tipo_envio),
    normalize_(payload?.municipio),
    normalize_(payload?.clues),
    normalize_(payload?.unidad),
    normalize_(payload?.correo),
    normalize_(payload?.asunto)
  ]);
}

function getCurrentReminderBlock_() {
  const now = new Date();
  const hh = now.getHours();
  const mm = now.getMinutes();

  if (hh === 11 && mm >= 50 && mm <= 59) return "1200";
  if (hh === 14 && mm >= 20 && mm <= 39) return "1430";
  if (hh === 23 && mm >= 50 && mm <= 59) return "2359";

  return `MANUAL_${hh}_${mm}`;
}

function buildInstitutionalEmailShell_(opts) {
  const title = escapeHtml_(opts?.title || "JS1 Reportes");
  const subtitle = escapeHtml_(opts?.subtitle || "");
  const body = String(opts?.body || "");
  const footer = escapeHtml_(opts?.footer || "Jurisdicción Sanitaria 1 · SESEQ");
  
  return `
    <div style="margin:0;padding:0;background-color:#F0F4F9;font-family: 'Outfit', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#F0F4F9;margin:0;padding:20px 0;">
        <tr>
          <td align="center">
            <div style="max-width:680px;margin:0 auto;padding:0 10px;">
              
              <!-- ✅ HEADER CARD -->
              <div style="border-radius:28px 28px 4px 4px;overflow:hidden;background:linear-gradient(135deg,#001B3D 0%,#003366 100%);box-shadow:0 8px 30px rgba(0,27,61,0.12);">
                <div style="padding:40px 32px 32px 32px;color:#ffffff;text-align:left;">
                  <div style="font-size:12px;font-weight:800;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;opacity:0.85;">JURISDICCIÓN SANITARIA 1</div>
                  <div style="font-size:32px;font-weight:900;line-height:1.1;margin-bottom:8px;letter-spacing:-0.5px;">${title}</div>
                  ${subtitle ? `<div style="font-size:15px;opacity:0.9;font-weight:500;">${subtitle}</div>` : ``}
                </div>
              </div>

              <!-- ✅ MAIN CONTENT CARD -->
              <div style="margin-top:4px;border-radius:4px 4px 28px 28px;background:#ffffff;box-shadow:0 12px 40px rgba(0,0,0,0.06);border:1px solid rgba(0,0,0,0.04);">
                <div style="padding:32px;text-align:left;color:#1A1C1E;font-size:16px;line-height:1.6;">
                  ${body}
                </div>

                <!-- ✅ FOOTER DIVIDER -->
                <div style="padding:0 32px 32px 32px;">
                  <div style="height:1px;background-color:#E1E2E5;margin-bottom:20px;"></div>
                  <div style="font-size:12px;color:#44474E;line-height:1.5;text-align:center;">
                    <strong style="font-size:13px;color:#001B3D;">${footer}</strong><br>
                    Correo generado automáticamente por el sistema de reportes institucional JS1.<br>
                    &copy; ${new Date().getFullYear()} Registro de Biológicos y Consumibles.
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function buildMetricBoxHtml_(label, value, tone) {
  const tones = {
    blue:  { bg:"#D3E3FD", tx:"#041E49", label:"#44474E" },
    green: { bg:"#C4EED0", tx:"#072711", label:"#44474E" },
    amber: { bg:"#FFE082", tx:"#2E2A00", label:"#44474E" },
    red:   { bg:"#F9DEDC", tx:"#410E0B", label:"#44474E" }
  };
  const t = tones[tone] || tones.blue;

  return `
    <div style="display:inline-block;vertical-align:top;width:45%;min-width:140px;margin:0 10px 10px 0;padding:16px;border-radius:16px;background-color:${t.bg};text-align:left;">
      <div style="font-size:11px;font-weight:800;color:${t.label};text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">${escapeHtml_(label)}</div>
      <div style="font-size:20px;font-weight:900;color:${t.tx};line-height:1.2;">${escapeHtml_(value)}</div>
    </div>
  `;
}

function renderInstitutionalUnitListHtml_(items, emptyText, ok) {
  if (!items || !items.length) {
    return `<div style="padding:10px 12px;border:1px dashed #cbd5e1;border-radius:12px;background:#f8fafc;color:#64748b;font-size:13px;">${escapeHtml_(emptyText || "Sin registros.")}</div>`;
  }

  return `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr>
          <th style="text-align:left;padding:10px;border-bottom:1px solid #e5edf8;color:#475569;">CLUES</th>
          <th style="text-align:left;padding:10px;border-bottom:1px solid #e5edf8;color:#475569;">Unidad</th>
          <th style="text-align:left;padding:10px;border-bottom:1px solid #e5edf8;color:#475569;">Detalle</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(x => `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #eef2f7;"><b>${escapeHtml_(x.clues || "")}</b></td>
            <td style="padding:10px;border-bottom:1px solid #eef2f7;">${escapeHtml_(x.unidad || "")}</td>
            <td style="padding:10px;border-bottom:1px solid #eef2f7;color:${ok ? "#166534" : "#b45309"};">
              ${ok
                ? `${escapeHtml_(x.capturado_por || "Capturado")}${String(x.editado || "").toUpperCase() === "SI" ? " · Editado" : ""}`
                : "Pendiente de captura"}
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function isValidEmail_(email) {
  const s = String(email || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function escapeHtml_(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getAllActiveUnits_() {
  const cacheKey = "ALL_ACTIVE_UNITS";
  const cached = CacheService.getScriptCache().get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {}
  }

  const sh = getSheet_(SHEET_UNIDADES);
  const last = sh.getLastRow();
  if (last < 2) return [];

  const data = sh.getRange(2, 1, last - 1, 5).getValues();
  const out = [];
  const seen = {};

  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    const municipio = fixUtf8Text_(normalize_(r[0]));
    const clues = normalizeClues_(r[1]);
    const unidad = normalize_(r[2]);
    const activo = (normalize_(r[3]) || "SI").toUpperCase();
    const orden_clues = Number(r[4] || 9999);

    if (!municipio || !clues || !unidad) continue;
    if (activo !== "SI") continue;
    if (seen[clues]) continue;

    seen[clues] = true;
    out.push({
      municipio,
      municipio_key: normalizeTextKey_(municipio),
      clues,
      unidad,
      orden_clues
    });
  }

  out.sort((a, b) =>
    String(a.municipio).localeCompare(String(b.municipio), "es") ||
    Number(a.orden_clues) - Number(b.orden_clues) ||
    String(a.unidad).localeCompare(String(b.unidad), "es")
  );

  try {
    CacheService.getScriptCache().put(cacheKey, JSON.stringify(out), CACHE_TTL_UNITS);
  } catch (e) {
    Logger.log("Error guardando unidades en caché: " + e.message);
  }

  return out;
}

function getUnitEmailsMap_() {
  const sh = ensureUsersSheet_();
  const last = sh.getLastRow();
  if (last < 2) return {};

  const data = sh.getRange(2, 1, last - 1, 11).getValues();
  const map = {};

  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    const rol = (normalize_(r[5]) || "UNIDAD").toUpperCase();
    const activo = (normalize_(r[6]) || "SI").toUpperCase();
    const email = normalize_(r[7]).toLowerCase();
    const clues = normalizeClues_(r[3]);

    if (rol !== "UNIDAD") continue;
    if (activo !== "SI") continue;
    if (!clues) continue;
    if (!isValidEmail_(email)) continue;

    if (!map[clues]) map[clues] = [];
    if (!map[clues].includes(email)) map[clues].push(email);
  }

  return map;
}

function buildCaptureStatusForDate_(fecha) {
  const fechaKey = normalizeDateKey_(fecha || todayStr_());
  const units = getAllActiveUnits_();
  const consStatus = getConsumiblesStatus_(fechaKey);
  const canCaptureConsumibles = !!(consStatus && consStatus.canCaptureConsumibles);
  const consRange = getConsumiblesOperationalRange_(fechaKey);
  const consMap = getCapturedMapByFechaRangeTipo_(
    consRange.fechaInicio,
    consRange.fechaFin,
    "CONS"
  );

  const bioWindow = getBioCaptureWindow_(parseYmdAsMxDate_(fechaKey));
  const bioFechaProgramada = bioWindow.fechaPedidoProgramada;
  const canCaptureBio = !!(fechaKey >= bioWindow.habilitarDesde && fechaKey <= bioWindow.habilitarHasta);
  const isBioWindowCloseDate = fechaKey === bioWindow.habilitarHasta;
  const bioMap = canCaptureBio || isBioWindowCloseDate
    ? getBioCapturedMapByFechaPedido_(bioFechaProgramada)
    : {};

  const byMunicipio = {};

  units.forEach(unit => {
    const muniKey = unit.municipio_key;

    if (!byMunicipio[muniKey]) {
      byMunicipio[muniKey] = {
        municipio: unit.municipio,
        units: [],
        bio_capturadas: [],
        bio_faltantes: [],
        cons_capturadas: [],
        cons_faltantes: []
      };
    }

    const bioCap = (canCaptureBio || isBioWindowCloseDate) ? bioMap[unit.clues] : null;
    const consCap = consMap[unit.clues] || null;

    const itemBase = {
      municipio: unit.municipio,
      clues: unit.clues,
      unidad: unit.unidad
    };

    byMunicipio[muniKey].units.push(itemBase);

    if (canCaptureBio || isBioWindowCloseDate) {
      if (bioCap && bioCap.hasSaved) {
        byMunicipio[muniKey].bio_capturadas.push({
          ...itemBase,
          capturado_por: bioCap.capturado_por || ""
        });
      } else {
        byMunicipio[muniKey].bio_faltantes.push(itemBase);
      }
    }

    if (consCap) {
      byMunicipio[muniKey].cons_capturadas.push({
        ...itemBase,
        capturado_por: consCap.capturado_por || "",
        editado: consCap.editado || "",
        fecha: consCap.fecha || ""
      });
    } else if (canCaptureConsumibles || fechaKey === consRange.fechaCorteResumen) {
      byMunicipio[muniKey].cons_faltantes.push(itemBase);
    }
  });

  return {
    fecha: fechaKey,
    isThursday: getDayOfWeekFromStr_(fechaKey) === 4,
    canCaptureConsumibles,
    consumiblesCaptureDate: canCaptureConsumibles
    ? (consStatus.consumiblesCaptureDate || fechaKey)
    : "",
    consumiblesReason: consStatus?.consumiblesReason || "",
    consumiblesManualOverride: !!consStatus?.consumiblesManualOverride,
    consumiblesHolidayOverride: !!consStatus?.consumiblesHolidayOverride,
    consumiblesRangeStart: consRange.fechaInicio,
    consumiblesRangeEnd: consRange.fechaFin,
    consumiblesSummaryCutoffDate: consRange.fechaCorteResumen,
    canCaptureBio,
    bioFechaProgramada,
    bioWindowStart: bioWindow.habilitarDesde,
    bioWindowEnd: bioWindow.habilitarHasta,
    isBioWindowCloseDate,
    byMunicipio
  };
}

function renderUnitListHtml_(items, emptyText) {
  if (!items || !items.length) {
    return `<p style="margin:6px 0 0 0;color:#374151;">${escapeHtml_(emptyText || "Sin registros.")}</p>`;
  }

  const lis = items.map(x => `
    <li style="margin:4px 0;">
      <b>${escapeHtml_(x.clues)}</b> — ${escapeHtml_(x.unidad)}
      ${x.capturado_por ? `<span style="color:#6b7280;">(capturó: ${escapeHtml_(x.capturado_por)})</span>` : ""}
      ${String(x.editado || "").toUpperCase() === "SI" ? ` <span style="color:#b45309;">[editado]</span>` : ""}
    </li>
  `).join("");

  return `<ul style="margin:8px 0 0 18px;padding:0;">${lis}</ul>`;
}

/** ===== AUTH ===== **/
function secret_() {
  const props = PropertiesService.getScriptProperties();
  let s = props.getProperty("AUTH_SECRET");
  if (!s) {
    s = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty("AUTH_SECRET", s);
  }
  return s;
}

function sign_(text) {
  const raw = Utilities.computeHmacSha256Signature(text, secret_());
  return Utilities.base64EncodeWebSafe(raw);
}

function makeToken_(usuario) {
  const ts = Date.now();
  const payload = `${usuario}|${ts}`;
  const sig = sign_(payload);
  return `${payload}|${sig}`;
}

function verifyToken_(token) {
  const t = normalize_(token);
  if (!t) return null;
  const parts = t.split("|");
  if (parts.length !== 3) return null;

  const [usuario, ts, sig] = parts;
  const payload = `${usuario}|${ts}`;
  if (sign_(payload) !== sig) return null;

  const ageMs = Date.now() - Number(ts);
  if (!Number.isFinite(ageMs) || ageMs > 7 * 24 * 60 * 60 * 1000) return null;

  return usuario;
}

/** ===== ROLES / PERMISOS ===== **/
function parseMunicipios_(s) {
  const raw = normalize_(s);
  if (!raw) return [];
  if (raw === "*" || raw.toUpperCase() === "ALL") return ["*"];
  return raw
    .split(",")
    .map(x => normalizeTextKey_(x))
    .filter(Boolean);
}

function canSeeMunicipio_(user, municipio) {
  if (!user) return false;
  if (user.rol === "ADMIN" || user.rol === "JURISDICCIONAL") return true;

  const allowed = Array.isArray(user.municipiosAllowed)
    ? user.municipiosAllowed.map(x => normalizeTextKey_(x)).filter(Boolean)
    : [];

  if (allowed.includes("*")) return true;

  const m = normalizeTextKey_(fixUtf8Text_(municipio));
  if (!m) return false;

  return allowed.includes(m);
}

/** ===== HASHING ===== **/
function hashPassword_(pass) {
  if (!pass) return "";
  const salted = pass + PASS_SALT;
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salted);
  let hash = "";
  for (let i = 0; i < digest.length; i++) {
    let byte = digest[i];
    if (byte < 0) byte += 256;
    let hex = byte.toString(16);
    if (hex.length === 1) hex = "0" + hex;
    hash += hex;
  }
  return hash;
}

function isHashed_(pass) {
  // Un hash SHA-256 en hexadecimal tiene 64 caracteres
  return /^[a-f0-9]{64}$/.test(pass);
}

/** ===== USERS SHEET ===== **/
function ensureUsersSheet_() {
  const sh = getSheet_(SHEET_USERS);
  ensureHeader_(sh, [
    "usuario","password","municipio","clues","unidad","rol","activo",
    "email","must_change","reset_token","reset_expires"
  ]);
  return sh;
}

function ensureLotesCadSheet_() {
  const sh = getSheet_(SHEET_LOTES_CAD);
  ensureHeader_(sh, [
    "biologico", "lote", "caducidad", "fecha_recepcion", "municipio"
  ]);
  return sh;
}

function ensureExistenciaDetalleSheet_() {
  const sh = getSheet_(SHEET_EXISTENCIA_DETALLE);
  ensureHeader_(sh, [
    "fecha", "clues", "unidad", "municipio", "biologico", "lote", "caducidad", "fecha_recepcion", "cantidad", "capturado_por"
  ]);
  return sh;
}

function getUser_(usuario) {
  const cacheKey = "USER_" + normalize_(usuario);
  const cached = CacheService.getScriptCache().get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {}
  }

  const sh = ensureUsersSheet_();
  const last = sh.getLastRow();
  if (last < 2) return null;

  const values = sh.getRange(2, 1, last - 1, 11).getValues();
  for (let i = 0; i < values.length; i++) {
    const r = values[i];
    if (normalize_(r[0]) === usuario) {
      const rol = (normalize_(r[5]) || "UNIDAD").toUpperCase();
      const municipioRaw = normalize_(r[2]);
      const activo = (normalize_(r[6]) || "SI").toUpperCase();

      const userObj = {
        row: i + 2,
        usuario: normalize_(r[0]),
        password: normalize_(r[1]),
        municipio: municipioRaw,
        municipiosAllowed: parseMunicipios_(municipioRaw),
        clues: normalize_(r[3]),
        unidad: normalize_(r[4]),
        rol,
        activo,
        email: normalize_(r[7]),
        must_change: normalize_(r[8]),
        reset_token: normalize_(r[9]),
        reset_expires: r[10]
      };

      try {
        CacheService.getScriptCache().put(cacheKey, JSON.stringify(userObj), CACHE_TTL_USERS);
      } catch (e) {}

      return userObj;
    }
  }
  return null;
}

function clearUserCache_(usuario) {
  try {
    CacheService.getScriptCache().remove("USER_" + normalize_(usuario));
  } catch (e) {}
}

function clearUnitsCache_() {
  try {
    CacheService.getScriptCache().remove("ALL_ACTIVE_UNITS");
  } catch (e) {}
}

function getUserByToken_(token) {
  const usuario = verifyToken_(token);
  if (!usuario) return null;
  const u = getUser_(usuario);
  if (!u) return null;
  if (u.activo !== "SI") return null;
  return u;
}

function authOrThrow_(token, roleOpt) {
  const u = getUserByToken_(token);
  if (!u) throw new Error("Sesión inválida. Inicia sesión de nuevo.");
  if (roleOpt && u.rol !== roleOpt) throw new Error("No autorizado (rol).");
  return u;
}

/** ===== util fecha: último jueves (<= hoy) ===== **/
function getConsumiblesManualOverride_() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(PROP_CONS_OVERRIDE) || "";

  if (!raw) {
    return {
      enabled: false,
      fecha: "",
      motivo: "",
      updated_by: "",
      updated_ts: ""
    };
  }

  try {
    const obj = JSON.parse(raw);
    return {
      enabled: String(obj?.enabled || "").toUpperCase() === "SI",
      fecha: normalizeDateKey_(obj?.fecha || ""),
      motivo: normalize_(obj?.motivo || ""),
      updated_by: normalize_(obj?.updated_by || ""),
      updated_ts: normalize_(obj?.updated_ts || "")
    };
  } catch (e) {
    return {
      enabled: false,
      fecha: "",
      motivo: "",
      updated_by: "",
      updated_ts: ""
    };
  }
}

function saveConsumiblesManualOverride_(cfg) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(PROP_CONS_OVERRIDE, JSON.stringify({
    enabled: cfg?.enabled ? "SI" : "NO",
    fecha: normalizeDateKey_(cfg?.fecha || ""),
    motivo: normalize_(cfg?.motivo || ""),
    updated_by: normalize_(cfg?.updated_by || ""),
    updated_ts: normalize_(cfg?.updated_ts || "")
  }));
}

function clearConsumiblesManualOverride_() {
  PropertiesService.getScriptProperties().deleteProperty(PROP_CONS_OVERRIDE);
}

function isAutoConsumiblesDate_(ymd) {
  const key = normalizeDateKey_(ymd || "");
  if (!key) return false;

  const dow = getDayOfWeekFromStr_(key);

  if (dow === 4 && !isHolidayMx_(key)) {
    return true;
  }

  if (dow === 3) {
    const jueves = addDaysYmd_(key, 1);
    return getDayOfWeekFromStr_(jueves) === 4 && isHolidayMx_(jueves);
  }

  return false;
}

function isManualConsumiblesDate_(ymd) {
  const key = normalizeDateKey_(ymd || "");
  const cfg = getConsumiblesManualOverride_();
  return !!(cfg.enabled && cfg.fecha && cfg.fecha === key);
}

function isValidConsumiblesDate_(ymd) {
  return isManualConsumiblesDate_(ymd) || isAutoConsumiblesDate_(ymd);
}

function getLastConsumiblesDateStr_(baseYmdOpt) {
  const base = normalizeDateKey_(baseYmdOpt || todayStr_()) || todayStr_();
  const cfg = getConsumiblesManualOverride_();

  if (cfg.enabled && cfg.fecha && cfg.fecha <= base) {
    return cfg.fecha;
  }

  let d = parseYmdAsMxDate_(base);
  while (d) {
    const key = dateToYmdMx_(d);
    if (isAutoConsumiblesDate_(key)) return key;
    d.setDate(d.getDate() - 1);
  }

  return base;
}

function lastThursdayStr_() {
  return getLastConsumiblesDateStr_(todayStr_());
}

function getConsumiblesStatus_(baseYmdOpt, cluesOpt) {
  const today = normalizeDateKey_(baseYmdOpt || todayStr_()) || todayStr_();
  const dow = getDayOfWeekFromStr_(today);
  const cfg = getConsumiblesManualOverride_();
  const cluesKey = normalizeClues_(cluesOpt || "");

  if (cfg.enabled && cfg.fecha === today) {
    return {
      today,
      lastThursday: getLastConsumiblesDateStr_(today),
      isThursday: dow === 4,
      canCaptureConsumibles: true,
      consumiblesCaptureDate: today,
      consumiblesReason: cfg.motivo || "Apertura extraordinaria manual",
      consumiblesManualOverride: true,
      consumiblesHolidayOverride: false
    };
  }

  if (dow === 4 && !isHolidayMx_(today)) {
    return {
      today,
      lastThursday: getLastConsumiblesDateStr_(today),
      isThursday: true,
      canCaptureConsumibles: true,
      consumiblesCaptureDate: today,
      consumiblesReason: "Jueves operativo",
      consumiblesManualOverride: false,
      consumiblesHolidayOverride: false
    };
  }

  if (dow === 3) {
    const jueves = addDaysYmd_(today, 1);

    if (getDayOfWeekFromStr_(jueves) === 4 && isHolidayMx_(jueves)) {
      return {
        today,
        lastThursday: getLastConsumiblesDateStr_(today),
        isThursday: false,
        canCaptureConsumibles: true,
        consumiblesCaptureDate: today,
        consumiblesReason: `Apertura anticipada por ${getHolidayNameMx_(jueves) || "día inhábil"}`,
        consumiblesManualOverride: false,
        consumiblesHolidayOverride: true
      };
    }
  }

  if (dow === 4 && isHolidayMx_(today)) {
    const miercoles = addDaysYmd_(today, -1);

    const huboVentanaAnticipada =
      getDayOfWeekFromStr_(miercoles) === 3 &&
      isAutoConsumiblesDate_(miercoles);

    if (huboVentanaAnticipada) {
      let huboCapturaMiercoles = false;

      if (cluesKey) {
        const shCons = getSheet_(SHEET_CONS);
        const row = findRowByFechaClues_(shCons, miercoles, cluesKey);
        huboCapturaMiercoles = !!row;
      } else {
        const consMapMiercoles = getCapturedMapByFechaRangeTipo_(
          miercoles,
          miercoles,
          "CONS"
        );
        huboCapturaMiercoles = !!Object.keys(consMapMiercoles || {}).length;
      }

      if (huboCapturaMiercoles) {
        return {
          today,
          lastThursday: getLastConsumiblesDateStr_(today),
          isThursday: true,
          canCaptureConsumibles: false,
          consumiblesCaptureDate: "",
          consumiblesReason: `La captura de consumibles ya quedó registrada el miércoles ${miercoles}.`,
          consumiblesManualOverride: false,
          consumiblesHolidayOverride: true
        };
      }

      return {
        today,
        lastThursday: getLastConsumiblesDateStr_(today),
        isThursday: true,
        canCaptureConsumibles: true,
        consumiblesCaptureDate: today,
        consumiblesReason: `Jueves habilitado porque no hubo captura válida el miércoles ${miercoles}.`,
        consumiblesManualOverride: false,
        consumiblesHolidayOverride: true
      };
    }
  }

  return {
    today,
    lastThursday: getLastConsumiblesDateStr_(today),
    isThursday: dow === 4,
    canCaptureConsumibles: false,
    consumiblesCaptureDate: "",
    consumiblesReason: (dow === 4 && isHolidayMx_(today))
      ? `Hoy es inhábil: ${getHolidayNameMx_(today)}`
      : "Disponible solo jueves o por apertura extraordinaria",
    consumiblesManualOverride: false,
    consumiblesHolidayOverride: false
  };
}

function getConsumiblesOperationalRange_(baseYmdOpt) {
  const base = normalizeDateKey_(baseYmdOpt || todayStr_()) || todayStr_();
  const dow = getDayOfWeekFromStr_(base);

  if (isManualConsumiblesDate_(base)) {
    return {
      fechaInicio: base,
      fechaFin: base,
      fechaCorteResumen: base
    };
  }

  // miércoles adelantado por jueves inhábil:
  // el corte municipal seguirá el jueves natural, pero la captura válida quedó en miércoles
  if (dow === 4 && isHolidayMx_(base)) {
    const miercoles = addDaysYmd_(base, -1);
    if (getDayOfWeekFromStr_(miercoles) === 3 && isAutoConsumiblesDate_(miercoles)) {
      return {
        fechaInicio: miercoles,
        fechaFin: base,
        fechaCorteResumen: base
      };
    }
  }

  if (isAutoConsumiblesDate_(base)) {
    return {
      fechaInicio: base,
      fechaFin: base,
      fechaCorteResumen: base
    };
  }

  const last = getLastConsumiblesDateStr_(base);
  return {
    fechaInicio: last,
    fechaFin: last,
    fechaCorteResumen: last
  };
}

function api_adminGetConsumiblesOverride(payload) {
  try {
    authOrThrow_(payload?.token, "ADMIN");
    return { ok:true, data:getConsumiblesManualOverride_() };
  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

function api_adminSetConsumiblesOverride(payload) {
  try {
    const u = authOrThrow_(payload?.token, "ADMIN");
    const enabled = String(payload?.enabled || "").toUpperCase() === "SI";

    if (!enabled) {
      clearConsumiblesManualOverride_();
      return { ok:true, message:"Apertura extraordinaria desactivada.", data:getConsumiblesManualOverride_() };
    }

    const fecha = normalizeDateKey_(payload?.fecha || "");
    const motivo = normalize_(payload?.motivo || "");

    if (!fecha) throw new Error("Debes indicar la fecha extraordinaria.");
    if (!motivo) throw new Error("Debes indicar el motivo.");

    saveConsumiblesManualOverride_({
      enabled: true,
      fecha,
      motivo,
      updated_by: u.usuario,
      updated_ts: Utilities.formatDate(new Date(), tz_(), "yyyy-MM-dd HH:mm:ss")
    });

    return { ok:true, message:"Apertura extraordinaria guardada.", data:getConsumiblesManualOverride_() };
  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

/** ===== HELPERS: buscar fila de reporte por fecha+clues ===== **/
function findRowByFechaClues_(sh, fecha, clues) {
  const last = sh.getLastRow();
  if (last < 2) return 0;

  const fechaKey = normalizeDateKey_(fecha);
  const cluesKey = normalizeClues_(clues);

  const data = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    const rowFecha = normalizeDateKey_(r[2]);
    const rowClues = normalizeClues_(r[4]);

    if (rowFecha === fechaKey && rowClues === cluesKey) {
      return i + 2;
    }
  }
  return 0;
}

function findRowByFechaCluesInRange_(sh, fechaInicio, fechaFin, clues){
  const data = sh.getDataRange().getValues();
  const idxFecha = 2;
  const idxClues = 4;

  for (let i = data.length - 1; i >= 1; i--){
    const f = normalizeDateKey_(data[i][idxFecha]);
    const c = normalize_(data[i][idxClues]);

    if (c === clues && f >= fechaInicio && f <= fechaFin){
      return i + 1;
    }
  }

  return null;
}

function toCsv_(rows) {
  const sep = ";";

  const esc = (v) => {
    if (v === null || v === undefined) return "";

    let s = String(v);
    s = fixUtf8Text_(s);
    s = s.replace(/"/g, '""');

    return `"${s}"`;
  };

  const csv = rows.map(r => r.map(esc).join(sep)).join("\n");
  return "sep=;\n" + csv;
}

function buildFilteredRowsByTipo_(user, tipo, fechaInicio, fechaFin, municipiosSeleccionados) {
  const t = (normalize_(tipo) || "SR").toUpperCase();
  const isCONS = t === "CONS";
  const sh = getSheet_(isCONS ? SHEET_CONS : SHEET_SR_EXISTENCIA);
  const data = sh.getDataRange().getValues();

  if (!data || !data.length) return [];

  const inicioKey = normalizeDateKey_(fechaInicio || todayStr_());
  const finKey = normalizeDateKey_(fechaFin || inicioKey);

  const municipiosKeys = Array.isArray(municipiosSeleccionados)
    ? municipiosSeleccionados.map(x => normalizeTextKey_(x)).filter(Boolean)
    : [];

  const out = [data[0]];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowFecha = normalizeDateKey_(row[2]);
    const municipio = row[3];
    const mk = normalizeTextKey_(municipio);

    if (!rowFecha) continue;
    if (rowFecha < inicioKey || rowFecha > finKey) continue;
    if (!canSeeMunicipio_(user, municipio)) continue;
    if (municipiosKeys.length && !municipiosKeys.includes(mk)) continue;

    out.push(row);
  }

  return out;
}

function ensureBioParamsSheet_() {
  const sh = getSheet_(SHEET_BIO_PARAMS);
  ensureHeader_(sh, [
    "municipio","clues","unidad","biologico",
    "max_dosis","min_dosis","promedio_frascos",
    "multiplo_pedido","orden_biologico","orden_clues","activo"
  ]);
  return sh;
}

function ensurePinolSheet_() {
  const sh = getSheet_(SHEET_PINOL);
  ensureHeader_(sh, [
    "id",
    "timestamp_solicitud",
    "fecha_solicitud",
    "municipio",
    "clues",
    "unidad",
    "existencia_actual_botellas",
    "solicitud_botellas",
    "observaciones",
    "capturado_por",
    "estatus",
    "fecha_entrega",
    "entregado_por",
    "timestamp_entrega"
  ]);
  return sh;
}

function ensureBioCaptureSheet_() {
  const sh = getSheet_(SHEET_BIO_CAPTURE);
  ensureHeader_(sh, [
    "id","timestamp","fecha_captura","fecha_pedido_programada",
    "municipio","clues","unidad","biologico",
    "max_dosis","min_dosis","promedio_frascos",
    "existencia_actual_frascos","pedido_frascos",
    "alerta_promedio","alerta_multiplo",
    "capturado_por","editado","editado_por","editado_ts"
  ]);
  return sh;
}

function ensureBioCatalogSheet_() {
  const sh = getSheet_(SHEET_BIO_CATALOG);
  ensureHeader_(sh, [
    "biologico","orden_biologico","multiplo_pedido","activo"
  ]);
  return sh;
}

function ensureBioCalendarSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SHEET_BIO_CALENDAR);

  const headers = [
    "anio_mes",
    "fecha_programada",
    "habilitar_desde",
    "habilitar_hasta",
    "motivo",
    "activo"
  ];

  if (!sh) {
    sh = ss.insertSheet(SHEET_BIO_CALENDAR);
  }

  ensureHeader_(sh, headers);
  return sh;
}

function moveToBusinessDayMx_(ymd, step) {
  let d = parseYmdAsMxDate_(ymd);
  if (!d) throw new Error("Fecha inválida: " + ymd);

  do {
    d.setDate(d.getDate() + step);
  } while (isWeekendMx_(dateToYmdMx_(d)) || isHolidayMx_(dateToYmdMx_(d)));

  return dateToYmdMx_(d);
}

function addBusinessDaysMx_(ymd, delta) {
  let out = normalizeDateKey_(ymd);
  if (!out) throw new Error("Fecha inválida: " + ymd);

  if (!delta) return out;

  const step = delta > 0 ? 1 : -1;
  let remaining = Math.abs(delta);

  while (remaining > 0) {
    out = moveToBusinessDayMx_(out, step);
    remaining--;
  }

  return out;
}

function getProgrammedPedidoDate_(baseDateOpt) {
  return getBioCaptureWindow_(baseDateOpt).fechaPedidoProgramada;
}

function getBioCaptureWindow_(baseDateOpt) {
  const baseRef = baseDateOpt ? new Date(baseDateOpt) : new Date();
  const anioMes = Utilities.formatDate(baseRef, tz_(), "yyyy-MM");

  // 1) Intentar override manual en CALENDARIO_PEDIDOS
  try {
    const sh = ensureBioCalendarSheet_();
    const last = sh.getLastRow();

    if (last >= 2) {
      const data = sh.getRange(2, 1, last - 1, 6).getValues();

      for (let i = 0; i < data.length; i++) {
        const row = data[i];

        const rowAnioMes = normalize_(row[0]);
        const fechaProgramada = normalizeDateKey_(row[1]);
        const habilitarDesde = normalizeDateKey_(row[2]);
        const habilitarHasta = normalizeDateKey_(row[3]);
        const motivo = normalize_(row[4]);
        const activo = (normalize_(row[5]) || "SI").toUpperCase();

        if (activo !== "SI") continue;
        if (rowAnioMes !== anioMes) continue;
        if (!fechaProgramada) continue;

        return {
          fechaPedidoProgramada: fechaProgramada,
          habilitarDesde: habilitarDesde || fechaProgramada,
          habilitarHasta: habilitarHasta || fechaProgramada,
          motivo: motivo || "Configuración manual en CALENDARIO_PEDIDOS",
          source: "CALENDAR"
        };
      }
    }
  } catch (e) {
    // Si la hoja aún no existe o falla algo, usamos modo automático.
  }

  // 2) Modo automático inteligente
  const base22 = new Date(baseRef.getFullYear(), baseRef.getMonth(), 22);
  let fechaProgramada = Utilities.formatDate(base22, tz_(), "yyyy-MM-dd");

  if (isWeekendMx_(fechaProgramada) || isHolidayMx_(fechaProgramada)) {
    fechaProgramada = moveToBusinessDayMx_(fechaProgramada, -1);
  }

  const habilitarDesde = addBusinessDaysMx_(fechaProgramada, -1);
  const habilitarHasta = addBusinessDaysMx_(fechaProgramada, 2);

  return {
    fechaPedidoProgramada: fechaProgramada,
    habilitarDesde,
    habilitarHasta,
    motivo: "Ventana automática operativa",
    source: "AUTO"
  };
}

function isWithinBioCaptureWindow_(ymd, windowInfo) {
  const key = normalizeDateKey_(ymd);
  if (!key || !windowInfo) return false;

  return key >= windowInfo.habilitarDesde && key <= windowInfo.habilitarHasta;
}

function getBioConfigForUnit_(clues) {
  const sh = ensureBioParamsSheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];

  const data = sh.getRange(2, 1, last - 1, 11).getValues();
  const cluesKey = normalizeClues_(clues);

  const out = [];
  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    const activo = (normalize_(r[10]) || "SI").toUpperCase();

    if (normalizeClues_(r[1]) !== cluesKey) continue;
    if (activo !== "SI") continue;

    out.push({
      municipio: normalize_(r[0]),
      clues: normalize_(r[1]),
      unidad: normalize_(r[2]),
      biologico: normalize_(r[3]),
      max_dosis: Number(r[4] || 0),
      min_dosis: Number(r[5] || 0),
      promedio_frascos: Number(r[6] || 0),
      multiplo_pedido: Number(r[7] || 1),
      orden_biologico: Number(r[8] || 9999),
      orden_clues: Number(r[9] || 9999)
    });
  }

  out.sort((a, b) =>
    Number(a.orden_biologico) - Number(b.orden_biologico) ||
    String(a.biologico).localeCompare(String(b.biologico), "es")
  );

  return out;
}

function getBioRowsByFechaPedido_(fechaPedido, clues) {
  const sh = ensureBioCaptureSheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];

  const fechaKey = normalizeDateKey_(fechaPedido);
  const cluesKey = normalizeClues_(clues);
  const data = sh.getRange(2, 1, last - 1, 19).getValues();

  const out = [];
  for (let i = 0; i < data.length; i++) {
    const r = data[i];

    if (normalizeDateKey_(r[3]) !== fechaKey) continue;
    if (normalizeClues_(r[5]) !== cluesKey) continue;

    const biologico = normalize_(r[7]);
    if (!biologico) continue;

    out.push({
      row: i + 2,
      biologico,
      existencia_actual_frascos: Number(r[11] || 0),
      pedido_frascos: Number(r[12] || 0),
      alerta_promedio: normalize_(r[13]),
      alerta_multiplo: normalize_(r[14]),
      capturado_por: normalize_(r[15])
    });
  }
  return out;
}

function validateBioItems_(configRows, items, opts) {
  if (!Array.isArray(configRows) || !configRows.length) {
    throw new Error("No hay configuración de biológicos para validar.");
  }

  const options = opts || {};
  const isCaravana = !!options.isCaravana;

  const errors = [];
  const warnings = [];
  const out = [];

  for (let i = 0; i < configRows.length; i++) {
    const cfg = configRows[i];

    const item = Array.isArray(items)
      ? items.find(x =>
          normalizeTextKey_(x?.biologico) === normalizeTextKey_(cfg.biologico)
        )
      : null;

    const existenciaRaw = !item || item.existencia_actual_frascos === "" || item.existencia_actual_frascos == null
      ? 0
      : item.existencia_actual_frascos;

    const pedidoRaw = !item || item.pedido_frascos === "" || item.pedido_frascos == null
      ? 0
      : item.pedido_frascos;

    const existencia = requireNonNegNumber_(`Existencia actual - ${cfg.biologico}`, existenciaRaw);
    const pedido = requireNonNegNumber_(`Pedido - ${cfg.biologico}`, pedidoRaw);

    if (!Number.isInteger(existencia) || !Number.isInteger(pedido)) {
      errors.push(`${cfg.biologico}: usa frascos enteros.`);
    }

    const multiplo = Number(cfg.multiplo_pedido || 1);
    const promedio = Number(cfg.promedio_frascos || 0);
    const totalDisponible = existencia + pedido;
    const faltantePromedio = Math.max(0, promedio - totalDisponible);

    const bioKey = normalizeTextKey_(cfg.biologico);
    const requiereMultiplo =
      ["HEXAVALENTE", "ROTAVIRUS", "NEUMO 13", "NEUMO 20", "SRP"].includes(bioKey);

    const sinValidacionOperativa = isBioSinValidacionOperativa_(cfg.biologico);

    const omitirAdvertenciaPorCaravana =
      isCaravana && bioKey === "BCG";

    if (!sinValidacionOperativa && requiereMultiplo && multiplo > 1 && pedido > 0 && (pedido % multiplo !== 0)) {
      errors.push(`${cfg.biologico}: el pedido debe ser múltiplo de ${multiplo}.`);
    }

    if (!sinValidacionOperativa && !omitirAdvertenciaPorCaravana && promedio > 0 && totalDisponible < promedio) {
      warnings.push(
        `${cfg.biologico}: la validación detectó que no estás solicitando biológico suficiente con base en el promedio. ` +
        `Existencia ${existencia} + pedido ${pedido} = ${totalDisponible}; ` +
        `promedio ${promedio}; faltan ${faltantePromedio} frascos para alcanzar el promedio.`
      );
    }

    out.push({
      biologico: cfg.biologico,
      max_dosis: cfg.max_dosis,
      min_dosis: cfg.min_dosis,
      promedio_frascos: cfg.promedio_frascos,
      multiplo_pedido: multiplo,
      existencia_actual_frascos: existencia,
      pedido_frascos: pedido,
      alerta_promedio: (!sinValidacionOperativa && !omitirAdvertenciaPorCaravana && promedio > 0 && totalDisponible < promedio) ? "SI" : "NO",
      alerta_multiplo: (!sinValidacionOperativa && requiereMultiplo && multiplo > 1 && pedido > 0 && (pedido % multiplo !== 0)) ? "SI" : "NO"
    });
  }

  return { errors, warnings, rows: out };
}

function buildBioExportXlsx_(user, fechaPedido, municipiosSeleccionadosOpt) {
  const shU = getSheet_(SHEET_UNIDADES);
  const shCat = getSheet_(SHEET_BIO_CATALOG);
  const shC = ensureBioCaptureSheet_();

  const uLast = shU.getLastRow();
  const catLast = shCat.getLastRow();
  const cLast = shC.getLastRow();

  const unidadesRows = uLast < 2 ? [] : shU.getRange(2, 1, uLast - 1, 5).getValues();
  const catalogoRows = catLast < 2 ? [] : shCat.getRange(2, 1, catLast - 1, 5).getValues();
  const caps = cLast < 2 ? [] : shC.getRange(2, 1, cLast - 1, 19).getValues();

  const municipiosSeleccionados = Array.isArray(municipiosSeleccionadosOpt)
    ? municipiosSeleccionadosOpt.map(x => normalizeTextKey_(x)).filter(Boolean)
    : [];

  function canExportMunicipio_(municipio) {
    const muniKey = normalizeTextKey_(municipio);

    if (!canSeeMunicipio_(user, municipio)) return false;
    if (!municipiosSeleccionados.length) return true;

    return municipiosSeleccionados.includes(muniKey);
  }

    const unitsMap = {};

  unidadesRows.forEach(r => {
    const municipio = fixUtf8Text_(normalize_(r[0]));
    const clues = normalizeClues_(r[1]);
    const unidad = normalize_(r[2]);
    const activo = (normalize_(r[3]) || "SI").toUpperCase();
    const orden_clues = Number(r[4] || 9999);

    if (!municipio || !clues || !unidad) return;
    if (activo !== "SI") return;
    if (!canExportMunicipio_(municipio)) return;

    if (!unitsMap[clues]) {
      unitsMap[clues] = {
        municipio,
        clues,
        unidad,
        orden_clues
      };
    }
  });

  const units = Object.keys(unitsMap).map(k => unitsMap[k]).sort((a, b) =>
    String(a.municipio).localeCompare(String(b.municipio), "es") ||
    Number(a.orden_clues) - Number(b.orden_clues) ||
    String(a.unidad).localeCompare(String(b.unidad), "es")
  );

  if (!units.length) {
    throw new Error("No hay unidades activas para exportar en los municipios seleccionados.");
  }

  const bios = catalogoRows
    .map(r => ({
      orden_biologico: Number(r[0] || 9999),
      biologico: normalize_(r[1]),
      total_ref: normalize_(r[2]),
      multiplo_pedido: Number(r[3] || 0),
      captura_activa: (normalize_(r[4]) || "SI").toUpperCase()
    }))
    .filter(x => x.biologico)
    .filter(x => x.captura_activa === "SI")
    .sort((a, b) =>
      Number(a.orden_biologico) - Number(b.orden_biologico) ||
      String(a.biologico).localeCompare(String(b.biologico), "es")
    );

  if (!bios.length) {
    throw new Error("No hay biológicos activos en CATALOGO_BIOLOGICOS.");
  }

  const capMap = {};
  const fechaKey = normalizeDateKey_(fechaPedido);

  caps.forEach(r => {
    const municipio = normalize_(r[4]);
    const clues = normalize_(r[5]);
    const biologico = normalize_(r[7]);

    if (!municipio || !clues || !biologico) return;
    if (!canExportMunicipio_(municipio)) return;
    const rowFechaPedido = normalizeDateKey_(r[3]);
    if (!rowFechaPedido || rowFechaPedido.substring(0, 7) !== fechaKey.substring(0, 7)) return;

    const key = normalizeClues_(clues) + "||" + normalizeTextKey_(biologico);
    capMap[key] = Number(r[12] || 0); // pedido_frascos
  });

  const totalCapturas = Object.values(capMap).reduce((acc, v) => acc + Number(v || 0), 0);

  if (totalCapturas === 0) {
    throw new Error("No existen registros de pedidos para la fecha seleccionada.");
  }

  const tpl = getSheet_(SHEET_BIO_EXPORT_TEMPLATE);
  const tempSs = SpreadsheetApp.create("TMP_BIO_EXPORT_" + new Date().getTime());
  const tempFile = DriveApp.getFileById(tempSs.getId());

  try {
    const sh = tpl.copyTo(tempSs).setName(SHEET_BIO_EXPORT_TEMPLATE);

    tempSs.getSheets().forEach(s => {
      if (s.getSheetId() !== sh.getSheetId()) {
        tempSs.deleteSheet(s);
      }
    });

    normalizeBioExportTemplateSheet_(sh, units.length, bios.length);
    fillBioExportTemplateSheet_(sh, fechaPedido, units, bios, capMap);

    SpreadsheetApp.flush();

    const tagMunicipios = municipiosSeleccionados.length ? municipiosSeleccionados.join("_") : "TODOS";
    const filename = `BIOLOGICOS_${fechaPedido}_${tagMunicipios}.xlsx`;
    const blob = exportSpreadsheetToXlsxBlob_(tempSs.getId(), filename);

    return { filename, blob };
  } finally {
    tempFile.setTrashed(true);
  }
}

function normalizeBioExportTemplateSheet_(sh, unitCount, bioCount) {
  const templateUnitCols = getTemplateUnitColumnCount_(sh);
  const templateBioRows = getTemplateBioRowCount_(sh);

  sh.getRange(1, 1, Math.max(sh.getMaxRows(), 5), Math.max(sh.getMaxColumns(), 5)).breakApart();

  if (unitCount > templateUnitCols) {
    const extraCols = unitCount - templateUnitCols;
    sh.insertColumnsBefore(templateUnitCols + 2, extraCols);

    const headerSource = sh.getRange(3, 2, 2, 1);
    const bodySource = sh.getRange(5, 2, Math.max(templateBioRows, 1), 1);

    for (let c = templateUnitCols + 2; c <= unitCount + 1; c++) {
      headerSource.copyTo(sh.getRange(3, c, 2, 1), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      bodySource.copyTo(
        sh.getRange(5, c, Math.max(templateBioRows, 1), 1),
        SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
        false
      );
      sh.setColumnWidth(c, sh.getColumnWidth(2));
    }
  } else if (unitCount < templateUnitCols) {
    sh.deleteColumns(unitCount + 2, templateUnitCols - unitCount);
  }

  const currentBioRows = getTemplateBioRowCount_(sh);

  if (bioCount > currentBioRows) {
    const extraRows = bioCount - currentBioRows;
    const sourceRow = 5 + Math.max(currentBioRows - 1, 0);
    const sourceHeight = sh.getRowHeight(sourceRow);

    sh.insertRowsAfter(4 + currentBioRows, extraRows);

    for (let i = 1; i <= extraRows; i++) {
      sh.getRange(sourceRow, 1, 1, sh.getLastColumn()).copyTo(
        sh.getRange(sourceRow + i, 1, 1, sh.getLastColumn()),
        SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
        false
      );
      sh.setRowHeight(sourceRow + i, sourceHeight);
    }
  } else if (bioCount < currentBioRows) {
    sh.deleteRows(5 + bioCount, currentBioRows - bioCount);
  }

  const lastCol = unitCount + 2;

  sh.getRange(1, 1, 1, lastCol).merge();
  sh.getRange(3, 1, 2, 1).merge();
  sh.getRange(3, lastCol, 2, 1).merge();
}

function getTemplateUnitColumnCount_(sh) {
  let col = 2;
  let count = 0;

  while (true) {
    const value = normalize_(sh.getRange(3, col).getValue());
    if (!value || value === "TOTAL") break;
    count++;
    col++;
  }

  return count;
}

function getTemplateBioRowCount_(sh) {
  let row = 5;
  let count = 0;

  while (true) {
    const value = normalize_(sh.getRange(row, 1).getValue());
    if (!value) break;
    count++;
    row++;
  }

  return count;
}

function fillBioExportTemplateSheet_(sh, fechaPedido, units, bios, capMap) {
  const lastCol = units.length + 2;
  const startRow = 5;
  const totalRows = bios.length;

  const municipiosTexto = Array.from(
    new Set(units.map(x => normalize_(x.municipio)).filter(Boolean))
  ).join(", ");

  sh.getRange("B2").clearContent().setValue(municipiosTexto || "TODOS LOS MUNICIPIOS PERMITIDOS");
  sh.getRange("D2").clearContent().setValue(fechaPedido);
  sh.getRange("D2").setNumberFormat("yyyy-mm-dd");

  sh.getRange(3, 2, 1, units.length).clearContent().setValues([
    units.map(u => `${u.clues} - ${u.unidad}`)
  ]);

  sh.getRange(4, 2, 1, units.length).clearContent().setValues([
    units.map(() => "PEDIDO")
  ]);

  sh.getRange(3, lastCol).clearContent().setValue("TOTAL");

  sh.getRange(startRow, 1, totalRows, 1).clearContent().setValues(
    bios.map(b => [b.biologico])
  );

  const matrix = bios.map(b => {
    return units.map(u => {
      const key = normalizeClues_(u.clues) + "||" + normalizeTextKey_(b.biologico);
      return Number(capMap[key] || 0);
    });
  });

  sh.getRange(startRow, 2, totalRows, units.length).clearContent().setValues(matrix);

    const totalValues = matrix.map(row => [
    row.reduce((acc, n) => acc + Number(n || 0), 0)
  ]);

  sh.getRange(startRow, lastCol, totalRows, 1).clearContent().setValues(totalValues);
}

/** ===== EXISTENCIA EXPORT (XLSX) ===== **/

function buildExistenciaExportXlsx_(user, fecha, municipiosSeleccionadosOpt) {
  const shU = getSheet_(SHEET_UNIDADES);
  const shSR = getSheet_(SHEET_SR_EXISTENCIA);
  const tpl = getSheet_(SHEET_EXISTENCIA_EXPORT_TEMPLATE);

  const uLast = shU.getLastRow();
  const srLast = shSR.getLastRow();

  const unidadesRows = uLast < 2 ? [] : shU.getRange(2, 1, uLast - 1, 5).getValues();
  const caps = srLast < 2 ? [] : shSR.getRange(2, 1, srLast - 1, 27).getValues();

  const fechaKey = normalizeDateKey_(fecha);
  const municipiosSeleccionados = Array.isArray(municipiosSeleccionadosOpt)
    ? municipiosSeleccionadosOpt.map(x => normalizeTextKey_(x)).filter(Boolean)
    : [];

  function canExportMunicipio_(municipio) {
    const muniKey = normalizeTextKey_(municipio);
    if (!canSeeMunicipio_(user, municipio)) return false;
    if (!municipiosSeleccionados.length) return true;
    return municipiosSeleccionados.includes(muniKey);
  }

  const unitsMap = {};
  unidadesRows.forEach(r => {
    const municipio = fixUtf8Text_(normalize_(r[0]));
    const clues = normalizeClues_(r[1]);
    const unidad = normalize_(r[2]);
    const activo = (normalize_(r[3]) || "SI").toUpperCase();
    const orden_clues = Number(r[4] || 9999);

    if (!municipio || !clues || !unidad) return;
    if (activo !== "SI") return;
    if (!canExportMunicipio_(municipio)) return;

    if (!unitsMap[clues]) {
      unitsMap[clues] = { municipio, clues, unidad, orden_clues };
    }
  });

  const units = Object.keys(unitsMap).map(k => unitsMap[k]).sort((a, b) =>
    String(a.municipio).localeCompare(String(b.municipio), "es") ||
    Number(a.orden_clues) - Number(b.orden_clues) ||
    String(a.unidad).localeCompare(String(b.unidad), "es")
  );

  if (!units.length) {
    throw new Error("No hay unidades activas para exportar en los municipios seleccionados.");
  }

  const srMap = {};
  caps.forEach(r => {
    const rowFecha = normalizeDateKey_(r[2]);
    const clues = normalize_(r[4]);
    if (rowFecha !== fechaKey) return;
    
    srMap[normalizeClues_(clues)] = {
      bcg: Number(r[6] || 0),
      hepatitis_b: Number(r[7] || 0),
      hexavalente: Number(r[8] || 0),
      dpt: Number(r[9] || 0),
      rotavirus: Number(r[10] || 0),
      neumococica_13: Number(r[11] || 0),
      neumococica_20: Number(r[12] || 0),
      srp: Number(r[13] || 0),
      sr: Number(r[14] || 0),
      vph: Number(r[15] || 0),
      varicela: Number(r[16] || 0),
      hepatitis_a: Number(r[17] || 0),
      td: Number(r[18] || 0),
      tdpa: Number(r[19] || 0),
      covid_19: Number(r[20] || 0),
      influenza: Number(r[21] || 0),
      vsr: Number(r[22] || 0)
    };
  });

  const tempSs = SpreadsheetApp.create("TMP_SR_EXPORT_" + new Date().getTime());
  const tempFile = DriveApp.getFileById(tempSs.getId());

  try {
    const sh = tpl.copyTo(tempSs).setName(SHEET_EXISTENCIA_EXPORT_TEMPLATE);
    tempSs.getSheets().forEach(s => {
      if (s.getSheetId() !== sh.getSheetId()) tempSs.deleteSheet(s);
    });

    const labels = getExistenciaLabelsFromTemplate_(sh);
    normalizeExistenciaExportTemplateSheet_(sh, units.length, labels.length);
    fillExistenciaExportTemplateSheet_(sh, fecha, units, labels, srMap);

    SpreadsheetApp.flush();
    const tagMunicipios = municipiosSeleccionados.length ? municipiosSeleccionados.join("_") : "TODOS";
    const filename = `MATRIZ_EXISTENCIA_${fecha}_${tagMunicipios}.xlsx`;
    const blob = exportSpreadsheetToXlsxBlob_(tempSs.getId(), filename);

    return { blob, filename };
  } finally {
    tempFile.setTrashed(true);
  }
}

function getExistenciaLabelsFromTemplate_(sh) {
  const labels = [];
  let row = 4;
  while (true) {
    const val = normalize_(sh.getRange(row, 1).getValue());
    if (!val) break;
    labels.push(val);
    row++;
  }
  return labels;
}

function normalizeExistenciaExportTemplateSheet_(sh, unitCount, labelCount) {
  const templateUnitCols = getTemplateUnitColumnCount_(sh);
  sh.getRange(1, 1, Math.max(sh.getMaxRows(), 5), Math.max(sh.getMaxColumns(), 5)).breakApart();

  if (unitCount > templateUnitCols) {
    const extraCols = unitCount - templateUnitCols;
    sh.insertColumnsBefore(templateUnitCols + 2, extraCols);
    
    // El encabezado está en fila 3, el cuerpo empieza en fila 4
    const headerSource = sh.getRange(3, 2, 1, 1);
    const bodySource = sh.getRange(4, 2, Math.max(labelCount, 1), 1);

    for (let c = templateUnitCols + 2; c <= unitCount + 1; c++) {
      headerSource.copyTo(sh.getRange(3, c), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      bodySource.copyTo(sh.getRange(4, c, Math.max(labelCount, 1), 1), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      sh.setColumnWidth(c, sh.getColumnWidth(2));
    }
  } else if (unitCount < templateUnitCols) {
    sh.deleteColumns(unitCount + 2, templateUnitCols - unitCount);
  }
  
  const lastCol = unitCount + 2;
  sh.getRange(1, 1, 1, lastCol).merge();
  sh.getRange(3, lastCol).clearContent().setValue("TOTAL");
}

function fillExistenciaExportTemplateSheet_(sh, fecha, units, labels, srMap) {
  const lastCol = units.length + 2;
  const startRow = 4;
  const totalRows = labels.length;

  const municipiosTexto = Array.from(new Set(units.map(x => normalize_(x.municipio)).filter(Boolean))).join(", ");
  
  // Limpiar y llenar metadatos
  sh.getRange("B2").clearContent().setValue(municipiosTexto || "TODOS LOS MUNICIPIOS PERMITIDOS");
  sh.getRange("D2").clearContent().setValue(fecha);
  sh.getRange("D2").setNumberFormat("yyyy-mm-dd");

  // Limpiar y llenar encabezados de unidades
  sh.getRange(3, 2, 1, units.length).clearContent().setValues([
    units.map(u => `${u.clues} - ${u.unidad}`)
  ]);

  // Mapeo refinado basado en captura de pantalla del usuario
  const internalKeysMap = {
    "BCG": "bcg",
    "HEPATITIS 10": "hepatitis_b",
    "HEPATITIS B": "hepatitis_b",
    "HEXAVALENTE": "hexavalente",
    "DPT": "dpt",
    "ROTAVIRUS": "rotavirus",
    "NEUMOCOCICA 13": "neumococica_13",
    "NEUMOCOCICA 20": "neumococica_20",
    "SRP (UNIDOSIS)": "srp",
    "SRP": "srp",
    "SR (MULTIDOSIS)": "sr",
    "SR": "sr",
    "VPH BIVALENTE": "vph",
    "VPH": "vph",
    "VARICELA": "varicela",
    "HEPATITIS A": "hepatitis_a",
    "TD": "td",
    "TDPA": "tdpa",
    "COVID 19": "covid_19",
    "INFLUENZA": "influenza",
    "VSR": "vsr"
  };

  const matrix = labels.map(label => {
    const cleanLabel = normalizeTextKey_(label).replace(/-/g, " ");
    const key = internalKeysMap[cleanLabel];
    
    return units.map(u => {
      const data = srMap[normalizeClues_(u.clues)];
      if (!data) return 0;
      return key ? Number(data[key] || 0) : 0;
    });
  });

  // Limpiar y llenar matriz de datos
  sh.getRange(startRow, 2, totalRows, units.length).clearContent().setValues(matrix);

  // Totales horizontales
  const totalValues = matrix.map(row => [
    row.reduce((acc, n) => acc + Number(n || 0), 0)
  ]);
  sh.getRange(startRow, lastCol, totalRows, 1).clearContent().setValues(totalValues);
}

function buildConsExportXlsx_(user, fechaInicio, fechaFin, municipiosSeleccionadosOpt) {
  const shU = getSheet_(SHEET_UNIDADES);
  const shC = getSheet_(SHEET_CONS);
  const tpl = getSheet_(SHEET_CONS_EXPORT_TEMPLATE);

  ensureHeader_(shC, [
    "id","timestamp","fecha","municipio","clues","unidad",
    "srp_dosis","sr_dosis",
    "jeringa_reconst_5ml_0605500438",
    "jeringa_aplic_05ml_0605502657",
    "aguja_0600403711",
    "capturado_por","editado","editado_por","editado_ts"
  ]);

  const uLast = shU.getLastRow();
  const cLast = shC.getLastRow();

  const unidadesRows = uLast < 2 ? [] : shU.getRange(2, 1, uLast - 1, 5).getValues();
  const caps = cLast < 2 ? [] : shC.getRange(2, 1, cLast - 1, 15).getValues();

  const municipiosSeleccionados = Array.isArray(municipiosSeleccionadosOpt)
    ? municipiosSeleccionadosOpt.map(x => normalizeTextKey_(x)).filter(Boolean)
    : [];

  const municipiosValidos = getExportableMunicipios_(user).map(x => normalizeTextKey_(x));

  for (let i = 0; i < municipiosSeleccionados.length; i++) {
    if (!municipiosValidos.includes(municipiosSeleccionados[i])) {
      throw new Error("Uno o más municipios seleccionados no están permitidos para este perfil.");
    }
  }

  function canExportMunicipio_(municipio) {
    const muniKey = normalizeTextKey_(municipio);

    if (!canSeeMunicipio_(user, municipio)) return false;
    if (!municipiosSeleccionados.length) return true;

    return municipiosSeleccionados.includes(muniKey);
  }

  const unitsMap = {};

  unidadesRows.forEach(r => {
    const municipio = fixUtf8Text_(normalize_(r[0]));
    const clues = normalizeClues_(r[1]);
    const unidad = normalize_(r[2]);
    const activo = (normalize_(r[3]) || "SI").toUpperCase();
    const orden_clues = Number(r[4] || 9999);

    if (!municipio || !clues || !unidad) return;
    if (activo !== "SI") return;
    if (!canExportMunicipio_(municipio)) return;

    if (!unitsMap[clues]) {
      unitsMap[clues] = {
        municipio,
        clues,
        unidad,
        orden_clues
      };
    }
  });

  const units = Object.keys(unitsMap).map(k => unitsMap[k]).sort((a, b) =>
    String(a.municipio).localeCompare(String(b.municipio), "es") ||
    Number(a.orden_clues) - Number(b.orden_clues) ||
    String(a.unidad).localeCompare(String(b.unidad), "es")
  );

  if (!units.length) {
    throw new Error("No hay unidades activas para exportar en los municipios seleccionados.");
  }

  const allowedClues = {};
  units.forEach(u => {
    allowedClues[normalizeClues_(u.clues)] = true;
  });

  const consMap = {};

  caps.forEach(r => {
    const fecha = normalizeDateKey_(r[2]);
    if (!fecha) return;
    if (fecha < fechaInicio || fecha > fechaFin) return;

    const clues = normalizeClues_(r[4]);
    if (!clues || !allowedClues[clues]) return;

    if (!consMap[clues]) {
      consMap[clues] = {
        srp_dosis: 0,
        sr_dosis: 0,
        j1: 0,
        j2: 0,
        aguja: 0
      };
    }

    consMap[clues].srp_dosis += Number(r[6] || 0);
    consMap[clues].sr_dosis += Number(r[7] || 0);
    consMap[clues].j1 += Number(r[8] || 0);
    consMap[clues].j2 += Number(r[9] || 0);
    consMap[clues].aguja += Number(r[10] || 0);
  });

  const totalCapturas = Object.values(consMap).reduce((acc, v) => {
    return acc + Number(v.srp_dosis || 0)
               + Number(v.sr_dosis || 0)
               + Number(v.j1 || 0)
               + Number(v.j2 || 0)
               + Number(v.aguja || 0);
  }, 0);

  if (totalCapturas === 0) {
    throw new Error("No existen registros de consumibles para el rango seleccionado.");
  }

  const tempSs = SpreadsheetApp.create("TMP_CONS_EXPORT_" + new Date().getTime());
  const tempFile = DriveApp.getFileById(tempSs.getId());

  try {
    const sh = tpl.copyTo(tempSs).setName(SHEET_CONS_EXPORT_TEMPLATE);

    tempSs.getSheets().forEach(s => {
      if (s.getSheetId() !== sh.getSheetId()) {
        tempSs.deleteSheet(s);
      }
    });

    normalizeConsExportTemplateSheet_(sh, units.length);
    fillConsExportTemplateSheet_(sh, fechaInicio, fechaFin, units, consMap, user);

    SpreadsheetApp.flush();

    const tagMunicipios = municipiosSeleccionados.length
      ? municipiosSeleccionados.join("_")
      : "TODOS";

    const filename = `CONSUMIBLES_${fechaInicio}${fechaFin !== fechaInicio ? "_a_" + fechaFin : ""}_${tagMunicipios}.xlsx`;
    const blob = exportSpreadsheetToXlsxBlob_(tempSs.getId(), filename);

    return { filename, blob };
  } finally {
    tempFile.setTrashed(true);
  }
}

function normalizeConsExportTemplateSheet_(sh, unitCount) {
  const templateUnitCols = getTemplateConsUnitColumnCount_(sh);

  sh.getRange(1, 1, Math.max(sh.getMaxRows(), 12), Math.max(sh.getMaxColumns(), 5)).breakApart();

  if (unitCount > templateUnitCols) {
    const extraCols = unitCount - templateUnitCols;
    sh.insertColumnsBefore(templateUnitCols + 2, extraCols);

    const headerSource = sh.getRange(3, 2, 1, 1);
    const bodySource = sh.getRange(4, 2, 5, 1);

    for (let c = templateUnitCols + 2; c <= unitCount + 1; c++) {
      headerSource.copyTo(sh.getRange(3, c, 1, 1), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      bodySource.copyTo(sh.getRange(4, c, 5, 1), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      sh.setColumnWidth(c, sh.getColumnWidth(2));
    }
  } else if (unitCount < templateUnitCols) {
    sh.deleteColumns(unitCount + 2, templateUnitCols - unitCount);
  }

  const lastCol = unitCount + 2;

  sh.getRange(1, 1, 1, lastCol).merge();
}

function getTemplateConsUnitColumnCount_(sh) {
  let col = 2;
  let count = 0;

  while (true) {
    const value = normalize_(sh.getRange(3, col).getValue());
    if (!value || value === "TOTAL") break;
    count++;
    col++;
  }

  return count;
}

function formatExportDateMx_(ymd) {
  const s = normalizeDateKey_(ymd);
  if (!s) return "";

  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(s || "");

  return `${m[3]}/${m[2]}/${m[1]}`;
}

function fillConsExportTemplateSheet_(sh, fechaInicio, fechaFin, units, consMap, user) {
  const lastCol = units.length + 2;

  const municipiosTexto = Array.from(
    new Set(units.map(x => fixUtf8Text_(normalize_(x.municipio))).filter(Boolean))
  ).join(", ");

  const fechaTexto = fechaInicio === fechaFin
    ? formatExportDateMx_(fechaInicio)
    : `${formatExportDateMx_(fechaInicio)} al ${formatExportDateMx_(fechaFin)}`;

  sh.getRange("B2").clearContent().setValue(municipiosTexto || "TODOS LOS MUNICIPIOS PERMITIDOS");
  sh.getRange("E2").clearContent().setValue(fechaTexto);

  const headers = units.map(u => {
    const clues = normalizeClues_(u.clues);
    const tieneDatos = consMap[clues] && (
      consMap[clues].srp_dosis ||
      consMap[clues].sr_dosis ||
      consMap[clues].j1 ||
      consMap[clues].j2 ||
      consMap[clues].aguja
    );

    return tieneDatos
      ? `${u.clues} - ${u.unidad}`
      : `${u.clues} - ${u.unidad} ⚠`;
  });

  sh.getRange(3, 2, 1, units.length).clearContent().setValues([headers]);
  sh.getRange(3, lastCol).clearContent().setValue("TOTAL");

  const cluesList = units.map(u => normalizeClues_(u.clues));

  const rowSrp = cluesList.map(clues => Number((consMap[clues] || {}).srp_dosis || 0));
  const rowSr = cluesList.map(clues => Number((consMap[clues] || {}).sr_dosis || 0));
  const rowJ1 = cluesList.map(clues => Number((consMap[clues] || {}).j1 || 0));
  const rowJ2 = cluesList.map(clues => Number((consMap[clues] || {}).j2 || 0));
  const rowAguja = cluesList.map(clues => Number((consMap[clues] || {}).aguja || 0));

  const matrix = [
    rowSrp,
    rowSr,
    rowJ1,
    rowJ2,
    rowAguja
  ];

  sh.getRange(4, 2, 5, units.length).clearContent().setValues(matrix);

  const totalValues = [
    [rowSrp.reduce((acc, n) => acc + Number(n || 0), 0)],
    [rowSr.reduce((acc, n) => acc + Number(n || 0), 0)],
    [rowJ1.reduce((acc, n) => acc + Number(n || 0), 0)],
    [rowJ2.reduce((acc, n) => acc + Number(n || 0), 0)],
    [rowAguja.reduce((acc, n) => acc + Number(n || 0), 0)]
  ];

  sh.getRange(4, lastCol, 5, 1).clearContent().setValues(totalValues);

  const usuario = normalize_(user?.usuario) || Session.getActiveUser().getEmail() || "Sistema";
  const perfil = normalize_(user?.rol) || "SIN PERFIL";
  const fechaGen = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");

  sh.getRange("A10").setValue(`Generado por: ${usuario}`);
  sh.getRange("A11").setValue(`Perfil: ${perfil}`);
  sh.getRange("A12").setValue(`Fecha generación: ${fechaGen}`);
}

function exportSpreadsheetToXlsxBlob_(spreadsheetId, filename) {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`;
  const resp = UrlFetchApp.fetch(url, {
    headers: {
      Authorization: "Bearer " + ScriptApp.getOAuthToken()
    },
    muteHttpExceptions: true
  });

  const code = resp.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error("No se pudo exportar la matriz XLSX. Código HTTP: " + code + " | " + resp.getContentText());
  }

  return resp.getBlob().setName(filename);
}

function columnToLetter_(col) {
  let temp = Number(col || 0);
  let letter = "";

  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod - 1) / 26);
  }

  return letter || "A";
}

function getExportableMunicipios_(user) {
  const fuentes = [];

  // 1) PARAM_BIOLOGICOS
  try {
    const shBio = ensureBioParamsSheet_();
    const lastBio = shBio.getLastRow();
    if (lastBio >= 2) {
      const dataBio = shBio.getRange(2, 1, lastBio - 1, 11).getValues();
      for (let i = 0; i < dataBio.length; i++) {
        const municipio = normalize_(dataBio[i][0]);
        const activo = (normalize_(dataBio[i][10]) || "SI").toUpperCase();
        if (!municipio) continue;
        if (activo !== "SI") continue;
        fuentes.push(municipio);
      }
    }
  } catch (e) {}

  // 2) UNIDADES
  try {
    const shUni = getSheet_(SHEET_UNIDADES);
    const lastUni = shUni.getLastRow();
    if (lastUni >= 2) {
      const dataUni = shUni.getRange(2, 1, lastUni - 1, 5).getValues();
      for (let i = 0; i < dataUni.length; i++) {
        const municipio = normalize_(dataUni[i][0]);
        const activo = (normalize_(dataUni[i][3]) || "SI").toUpperCase();
        if (!municipio) continue;
        if (activo !== "SI") continue;
        fuentes.push(municipio);
      }
    }
  } catch (e) {}

  const seen = {};
  const out = [];

  for (let i = 0; i < fuentes.length; i++) {
    const municipio = normalize_(fuentes[i]);
    const key = normalizeTextKey_(municipio);

    if (!municipio) continue;
    if (!canSeeMunicipio_(user, municipio)) continue;
    if (seen[key]) continue;

    seen[key] = true;
    out.push(fixUtf8Text_(municipio));
  }

  out.sort((a, b) => String(a).localeCompare(String(b), "es"));
  return out;
}

/** ===== API: LOGIN / WHOAMI ===== **/
function api_login(payload) {
  try {
    const usuario = normalize_(payload?.usuario);
    const password = normalize_(payload?.password);
    requireNonEmpty_("Usuario", usuario);
    requireNonEmpty_("Contraseña", password);

    const u = getUser_(usuario);
    if (!u || u.activo !== "SI") return { ok:false, error:"Usuario no existe o está inactivo." };

    const inputHash = hashPassword_(password);
    let authOk = false;

    // Caso 1: Ya está haseada
    if (isHashed_(u.password)) {
      authOk = (u.password === inputHash);
    } 
    // Caso 2: Migración (está en texto plano)
    else {
      authOk = (u.password === password);
      if (authOk) {
        // MIGRACIÓN: Hasear la contraseña ahora que sabemos que es correcta
        const sh = ensureUsersSheet_();
        sh.getRange(u.row, 2).setValue(inputHash);
        clearUserCache_(u.usuario);
      }
    }

    if (!authOk) {
      clearUserCache_(u.usuario); // Limpiar caché ante fallo para permitir recuperación manual si el admin cambió el Sheet
      return { ok:false, error:"Contraseña incorrecta." };
    }

    return {
      ok:true,
      data:{
        token: makeToken_(u.usuario),
        mustChange: String(u.must_change || "").toUpperCase() === "SI",
        user: {
          usuario: u.usuario,
          municipio: u.municipio,
          municipiosAllowed: u.municipiosAllowed,
          clues: u.clues,
          unidad: u.unidad,
          rol: u.rol,
          email: u.email || ""
        }
      }
    };
  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

function api_whoami(payload) {
  const u = getUserByToken_(payload?.token);
  if (!u) return { ok:false, error:"Sin sesión." };
  return {
    ok:true,
    data:{
      usuario: u.usuario,
      municipio: u.municipio,
      municipiosAllowed: u.municipiosAllowed,
      clues: u.clues,
      unidad: u.unidad,
      rol: u.rol,
      email: u.email || "",
      mustChange: String(u.must_change || "").toUpperCase() === "SI",
      fechaPedidoProgramada: getProgrammedPedidoDate_()
    }
  };
}

/** ===== STATUS ===== **/
function getStartOfYearYmd_(baseYmdOpt) {
  const base = normalizeDateKey_(baseYmdOpt || todayStr_()) || todayStr_();
  return `${base.slice(0, 4)}-01-01`;
}

function getMonthKeysInRange_(fromYmd, toYmd) {
  const start = parseYmdAsMxDate_(fromYmd);
  const end = parseYmdAsMxDate_(toYmd);

  if (!start || !end) return [];

  start.setDate(1);
  end.setDate(1);

  const out = [];
  const seen = {};

  while (start <= end) {
    const key = Utilities.formatDate(start, tz_(), "yyyy-MM");
    if (!seen[key]) {
      seen[key] = true;
      out.push(key);
    }
    start.setMonth(start.getMonth() + 1, 1);
  }

  return out;
}

function getOperationalComplianceSnapshot_(user, fromYmdOpt, toYmdOpt) {
  const toYmd = normalizeDateKey_(toYmdOpt || todayStr_()) || todayStr_();
  const fromYmd = normalizeDateKey_(fromYmdOpt || getStartOfYearYmd_(toYmd)) || getStartOfYearYmd_(toYmd);

  const units = getVisibleUnits_(user);
  if (!units.length) {
    return {
      fromYmd,
      toYmd,
      rows: [],
      summary: {
        visible_units: 0,
        cons_expected_total: 0,
        cons_done_total: 0,
        bio_expected_total: 0,
        bio_done_total: 0,
        expected_total: 0,
        completed_total: 0,
        compliance_pct: 0
      }
    };
  }

  const visibleUnitsMap = {};
  units.forEach(u => {
    visibleUnitsMap[u.clues] = {
      municipio: fixUtf8Text_(u.municipio),
      clues: u.clues,
      unidad: u.unidad
    };
  });

  const consExpectedDates = getDateRangeDays_(fromYmd, toYmd).filter(d => isValidConsumiblesDate_(d));
  const consExpectedSet = {};
  consExpectedDates.forEach(d => {
    consExpectedSet[d] = true;
  });

  const monthKeys = getMonthKeysInRange_(fromYmd, toYmd);
  const bioPeriods = [];
  const bioPeriodSeen = {};

  monthKeys.forEach(ym => {
    const baseDate = new Date(`${ym}-01T00:00:00`);
    const win = getBioCaptureWindow_(baseDate);

    const fechaPedidoProgramada = normalizeDateKey_(win.fechaPedidoProgramada);
    const habilitarHasta = normalizeDateKey_(win.habilitarHasta);

    if (!fechaPedidoProgramada || !habilitarHasta) return;
    if (habilitarHasta < fromYmd || habilitarHasta > toYmd) return;
    if (bioPeriodSeen[fechaPedidoProgramada]) return;

    bioPeriodSeen[fechaPedidoProgramada] = true;
    bioPeriods.push({
      fechaPedidoProgramada,
      habilitarHasta
    });
  });

  const consSh = getSheet_(SHEET_CONS);
  const consLast = consSh.getLastRow();
  const consData = consLast >= 2 ? consSh.getRange(2, 1, consLast - 1, 15).getValues() : [];

  const bioSh = ensureBioCaptureSheet_();
  const bioLast = bioSh.getLastRow();
  const bioData = bioLast >= 2 ? bioSh.getRange(2, 1, bioLast - 1, 19).getValues() : [];

  const consDoneByUnit = {};
  consData.forEach(r => {
    const fecha = normalizeDateKey_(r[2]);
    const clues = normalizeClues_(r[4]);

    if (!fecha || !clues) return;
    if (!visibleUnitsMap[clues]) return;
    if (!consExpectedSet[fecha]) return;

    if (!consDoneByUnit[clues]) consDoneByUnit[clues] = {};
    consDoneByUnit[clues][fecha] = true;
  });

  const bioExpectedSet = {};
  bioPeriods.forEach(p => {
    bioExpectedSet[p.fechaPedidoProgramada] = true;
  });

  const bioDoneByUnit = {};
  bioData.forEach(r => {
    const fechaPedido = normalizeDateKey_(r[3]);
    const clues = normalizeClues_(r[5]);
    const biologico = normalize_(r[7]);

    if (!fechaPedido || !clues || !biologico) return;
    if (!visibleUnitsMap[clues]) return;
    if (!bioExpectedSet[fechaPedido]) return;

    if (!bioDoneByUnit[clues]) bioDoneByUnit[clues] = {};
    bioDoneByUnit[clues][fechaPedido] = true;
  });

  const rows = units.map(u => {
    const consDone = Object.keys(consDoneByUnit[u.clues] || {}).length;
    const bioDone = Object.keys(bioDoneByUnit[u.clues] || {}).length;

    const consExpected = consExpectedDates.length;
    const bioExpected = bioPeriods.length;

    const completed = consDone + bioDone;
    const expected = consExpected + bioExpected;
    const compliancePct = expected ? Math.round((completed / expected) * 100) : 0;

    return {
      municipio: fixUtf8Text_(u.municipio),
      clues: u.clues,
      unidad: u.unidad,
      cons_esperados: consExpected,
      cons_capturados: consDone,
      bio_esperados: bioExpected,
      bio_capturados: bioDone,
      total_esperado: expected,
      total_capturado: completed,
      cumplimiento_operativo: compliancePct
    };
  }).sort((a, b) =>
    b.cumplimiento_operativo - a.cumplimiento_operativo ||
    String(a.municipio).localeCompare(String(b.municipio), "es") ||
    String(a.unidad).localeCompare(String(b.unidad), "es")
  );

  const summary = rows.reduce((acc, row) => {
    acc.cons_expected_total += Number(row.cons_esperados || 0);
    acc.cons_done_total += Number(row.cons_capturados || 0);
    acc.bio_expected_total += Number(row.bio_esperados || 0);
    acc.bio_done_total += Number(row.bio_capturados || 0);
    acc.expected_total += Number(row.total_esperado || 0);
    acc.completed_total += Number(row.total_capturado || 0);
    return acc;
  }, {
    visible_units: units.length,
    cons_expected_total: 0,
    cons_done_total: 0,
    bio_expected_total: 0,
    bio_done_total: 0,
    expected_total: 0,
    completed_total: 0,
    compliance_pct: 0
  });

  summary.compliance_pct = summary.expected_total
    ? Math.round((summary.completed_total / summary.expected_total) * 100)
    : 0;

  return {
    fromYmd,
    toYmd,
    rows,
    summary
  };
}

function api_unitStatus(payload) {
  try {
    const u = authOrThrow_(payload?.token);
    const cons = getConsumiblesStatus_(todayStr_(), u.clues);
    const compliance = getOperationalComplianceSnapshot_(
      u,
      getStartOfYearYmd_(cons.today),
      cons.today
    );

    return {
      ok:true,
      data:{
        lastThursday: cons.lastThursday,
        isThursday: cons.isThursday,
        today: cons.today,
        canCaptureConsumibles: cons.canCaptureConsumibles,
        consumiblesCaptureDate: cons.consumiblesCaptureDate,
        consumiblesReason: cons.consumiblesReason,
        consumiblesManualOverride: cons.consumiblesManualOverride,
        consumiblesHolidayOverride: cons.consumiblesHolidayOverride,

        compliance_range_start: compliance.fromYmd,
        compliance_range_end: compliance.toYmd,
        compliance_pct: compliance.summary.compliance_pct,
        compliance_expected_total: compliance.summary.expected_total,
        compliance_completed_total: compliance.summary.completed_total,
        compliance_cons_expected_total: compliance.summary.cons_expected_total,
        compliance_cons_done_total: compliance.summary.cons_done_total,
        compliance_bio_expected_total: compliance.summary.bio_expected_total,
        compliance_bio_done_total: compliance.summary.bio_done_total
      }
    };
  } catch(e) {
    return { ok:false, error:String(e.message || e) };
  }
}

function api_savePinol(payload) {
  try {
    const u = authOrThrow_(payload?.token);

    if (u.rol !== "UNIDAD") {
      return { ok:false, error:"Solo el perfil UNIDAD puede solicitar pinol." };
    }

    const nombre = normalize_(payload?.nombre);
    requireNonEmpty_("Nombre", nombre);

    const existencia = requireNonNegNumber_("Existencia actual de pinol", payload?.existencia_actual_botellas);
    const solicitud = requireNonNegNumber_("Solicitud de botellas de pinol", payload?.solicitud_botellas);
    const observaciones = normalize_(payload?.observaciones);

    const sh = ensurePinolSheet_();

    sh.appendRow([
      makeId_(),
      new Date(),
      todayStr_(),
      u.municipio,
      u.clues,
      u.unidad,
      existencia,
      solicitud,
      observaciones,
      nombre,
      "PENDIENTE",
      "",
      "",
      ""
    ]);

    const toList = getPinolEmailsByMunicipio_(u.municipio);

    if (toList.length) {
      const subject = `Solicitud de pinol | ${u.municipio} | ${u.unidad}`;

      const alertaExistencia = Number(existencia) <= 1
        ? `
      <div style="margin:0 0 16px 0;padding:16px;border-radius:16px;background-color:#F9DEDC;color:#410E0B;font-size:14px;font-weight:800;border:1px solid rgba(179,38,30,0.1);">
        ALERTA: Existencia baja reportada (${Number(existencia)} botella(s)). Se requiere surtimiento urgente.
      </div>
    `
        : `
      <div style="margin:0 0 16px 0;padding:16px;border-radius:16px;background-color:#C4EED0;color:#072711;font-size:14px;font-weight:800;border:1px solid rgba(0,0,0,0.04);">
        Confirmación: Solicitud registrada correctamente en el sistema.
      </div>
    `;

      const body = `
        <p style="margin:0 0 10px 0;font-size:14px;color:#334155;">
          Se recibió una <b>nueva solicitud de pinol</b> a través del sistema <b>JS1 Reportes</b>.
        </p>

        ${alertaExistencia}

        <div style="margin:0 0 14px 0;">
          ${buildMetricBoxHtml_("Fecha", todayStr_(), "blue")}
          ${buildMetricBoxHtml_("Existencia actual", `${Number(existencia)} botella(s)`, Number(existencia) <= 1 ? "red" : "green")}
          ${buildMetricBoxHtml_("Solicitud", `${Number(solicitud)} botella(s)`, "amber")}
          ${buildMetricBoxHtml_("Estatus", "PENDIENTE", "red")}
        </div>

        <div style="border:1px solid #e5edf8;border-radius:16px;padding:16px;background:#f8fbff;margin-top:6px;">
          <div style="font-size:15px;font-weight:800;color:#0f172a;margin-bottom:10px;">
            Datos de la unidad solicitante
          </div>

          <div style="font-size:14px;line-height:1.75;color:#0f172a;">
            <b>Municipio:</b> ${escapeHtml_(u.municipio)}<br>
            <b>CLUES:</b> ${escapeHtml_(u.clues)}<br>
            <b>Unidad:</b> ${escapeHtml_(u.unidad)}<br>
            <b>Solicitó:</b> ${escapeHtml_(nombre)}
          </div>
        </div>

        <div style="margin-top:14px;border:1px solid #e5edf8;border-radius:16px;padding:16px;background:#ffffff;">
          <div style="font-size:15px;font-weight:800;color:#0f172a;margin-bottom:10px;">
            Observaciones
          </div>
          <div style="font-size:14px;line-height:1.7;color:#334155;white-space:pre-wrap;">
            ${escapeHtml_(observaciones || "Sin observaciones.")}
          </div>
        </div>

        <div style="margin-top:14px;padding:14px 16px;border-radius:16px;background:#eff6ff;border:1px solid #bfdbfe;">
          <div style="font-size:14px;font-weight:800;color:#1d4ed8;margin-bottom:6px;">
            Seguimiento sugerido
          </div>
          <div style="font-size:13px;line-height:1.65;color:#1e3a8a;">
            Revisar disponibilidad del insumo, programar surtimiento y actualizar el estatus de la solicitud una vez entregada.
          </div>
        </div>
      `;

      const html = buildInstitutionalEmailShell_({
        title: "Solicitud de pinol",
        subtitle: `Nueva solicitud recibida · ${escapeHtml_(u.municipio)}`,
        body,
        footer: "Jurisdicción Sanitaria 1 · SESEQ · Control operativo de insumos"
      });

      sendEmail_(toList, subject, html);
    }

    return { ok:true, message:"Solicitud de pinol guardada." };

  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

function getPinolReceiptIndex_() {
  const sh = ensureNotificationsSheet_();
  const last = sh.getLastRow();
  const out = {};

  if (last < 2) return out;

  const data = sh.getRange(2, 1, last - 1, 16).getValues();

  for (let i = 0; i < data.length; i++) {
    const item = parseNotificationRow_(data[i], i + 2);

    let meta = {};
    try {
      meta = item.meta_json ? JSON.parse(item.meta_json) : {};
    } catch (_) {
      meta = {};
    }

    const source = String(meta.source || "").toUpperCase();
    const event = String(meta.event || "").toUpperCase();
    const pinolId = normalize_(meta.pinol_id);

    if (!pinolId || source !== "PINOL") continue;

    if (event === "PINOL_ENTREGADO" && String(meta.confirmed_by_unit || "").toUpperCase() === "SI") {
      out[pinolId] = {
        recibido: true,
        confirmado_ts: normalize_(meta.confirmed_ts || item.read_ts || item.created_ts || ""),
        confirmado_por: normalize_(meta.confirmed_usuario || item.read_by || ""),
        confirmado_clues: normalize_(meta.confirmed_clues || ""),
        confirmado_unidad: normalize_(meta.confirmed_unidad || "")
      };
      continue;
    }

    if (event === "PINOL_RECIBIDO_CONFIRMADO") {
      out[pinolId] = {
        recibido: true,
        confirmado_ts: normalize_(meta.confirmed_ts || item.created_ts || ""),
        confirmado_por: normalize_(meta.confirmed_usuario || item.from_usuario || ""),
        confirmado_clues: normalize_(meta.confirmed_clues || ""),
        confirmado_unidad: normalize_(meta.confirmed_unidad || "")
      };
    }
  }

  return out;
}

function api_listPinol(payload) {
  try {
    const u = authOrThrow_(payload?.token);

    if (u.rol !== "ADMIN" && u.rol !== "MUNICIPAL") {
      return { ok:false, error:"Sin permisos para ver solicitudes de pinol." };
    }

    const sh = ensurePinolSheet_();
    const last = sh.getLastRow();

    if (last < 2) {
      return { ok:true, data: [] };
    }

    const receiptIndex = getPinolReceiptIndex_();
    const data = sh.getRange(2, 1, last - 1, 14).getValues();

    const out = [];

    for (let i = 0; i < data.length; i++) {
      const r = data[i];

      const id = normalize_(r[0]);
      const municipioRaw = fixUtf8Text_(normalize_(r[3]));
      const clues = normalize_(r[4]);
      const unidad = normalize_(r[5]);

      if (!municipioRaw || !clues || !unidad) continue;
      if (!canSeeMunicipio_(u, municipioRaw)) continue;

      const estatusBase = (normalize_(r[10]) || "PENDIENTE").toUpperCase();
      const receiptMeta = receiptIndex[id] || null;
      const recibido = !!(receiptMeta && receiptMeta.recibido);

      let estatusVisual = estatusBase;
      if (estatusBase === "ENTREGADO" && recibido) {
        estatusVisual = "RECIBIDO";
      }

      out.push({
        row: i + 2,
        id: id,
        timestamp_solicitud: r[1] instanceof Date
          ? Utilities.formatDate(r[1], tz_(), "yyyy-MM-dd HH:mm:ss")
          : normalize_(r[1]),
        fecha_solicitud: normalizeDateKey_(r[2]),
        municipio: municipioRaw,
        clues: clues,
        unidad: unidad,
        existencia_actual_botellas: Number(r[6] || 0),
        solicitud_botellas: Number(r[7] || 0),
        observaciones: normalize_(r[8]),
        capturado_por: normalize_(r[9]),
        estatus: estatusBase,
        estatus_visual: estatusVisual,
        recibido: recibido,
        fecha_entrega: normalizeDateKey_(r[11]),
        entregado_por: normalize_(r[12]),
        timestamp_entrega: r[13] instanceof Date
          ? Utilities.formatDate(r[13], tz_(), "yyyy-MM-dd HH:mm:ss")
          : normalize_(r[13]),
        fecha_recibido: receiptMeta ? normalize_(receiptMeta.confirmado_ts || "") : "",
        recibido_por: receiptMeta ? normalize_(receiptMeta.confirmado_por || "") : "",
        recibido_clues: receiptMeta ? normalize_(receiptMeta.confirmado_clues || "") : "",
        recibido_unidad: receiptMeta ? normalize_(receiptMeta.confirmado_unidad || "") : ""
      });
    }

    out.sort((a, b) => {
      const ea = String(a.estatus_visual || a.estatus || "PENDIENTE").toUpperCase();
      const eb = String(b.estatus_visual || b.estatus || "PENDIENTE").toUpperCase();

      const order = {
        "PENDIENTE": 1,
        "ENTREGADO": 2,
        "RECIBIDO": 3
      };

      const oa = order[ea] || 99;
      const ob = order[eb] || 99;

      if (oa !== ob) return oa - ob;

      return String(b.fecha_solicitud || "").localeCompare(String(a.fecha_solicitud || ""), "es");
    });

    return { ok:true, data: out };

  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

function api_markPinolDelivered(payload) {
  try {
    const u = authOrThrow_(payload?.token);

    if (u.rol !== "ADMIN" && u.rol !== "MUNICIPAL" && u.rol !== "JURISDICCIONAL") {
      return { ok:false, error:"Sin permisos para actualizar solicitudes de pinol." };
    }

    const id = normalize_(payload?.id);
    const comentarioNotif = normalize_(payload?.comentario_notificacion);
    requireNonEmpty_("id", id);

    const sh = ensurePinolSheet_();
    const last = sh.getLastRow();

    if (last < 2) {
      return { ok:false, error:"No hay solicitudes registradas." };
    }

    const data = sh.getRange(2, 1, last - 1, 14).getValues();

    for (let i = 0; i < data.length; i++) {
      const row = i + 2;
      const rid = normalize_(data[i][0]);

      if (rid !== id) continue;

      const fecha = normalizeDateKey_(data[i][2]);
      const municipio = fixUtf8Text_(normalize_(data[i][3]));
      const clues = normalize_(data[i][4]);
      const unidad = normalize_(data[i][5]);
      const existencia = Number(data[i][6] || 0);
      const solicitud = Number(data[i][7] || 0);
      const observaciones = normalize_(data[i][8]);
      const nombreSolicita = normalize_(data[i][9]);
      const estatusActual = normalize_(data[i][10]).toUpperCase();

      if (!userCanTargetMunicipio_(u, municipio)) {
        return { ok:false, error:"No autorizado para actualizar esa solicitud." };
      }

      if (estatusActual === "ENTREGADO") {
        return { ok:false, error:"La solicitud ya estaba marcada como entregada." };
      }

      sh.getRange(row, 11).setValue("ENTREGADO");
      sh.getRange(row, 12).setValue(todayStr_());
      sh.getRange(row, 13).setValue(u.usuario);
      sh.getRange(row, 14).setValue(new Date());

      const shNotif = ensureNotificationsSheet_();

      const comentarioFinal = comentarioNotif
        ? `\n\nComentario:\n${comentarioNotif}`
        : "";

      const detalleBase =
        `Tu solicitud de pinol ya fue marcada como ENTREGADA.` +
        `\n\nFecha de solicitud: ${fecha || "—"}` +
        `\nUnidad: ${unidad || "—"}` +
        `\nCLUES: ${clues || "—"}` +
        `\nSolicitó: ${nombreSolicita || "—"}` +
        `\nExistencia reportada: ${existencia} botella(s)` +
        `\nSolicitud: ${solicitud} botella(s)`;

      const detalleObs = observaciones
        ? `\nObservaciones de la solicitud:\n${observaciones}`
        : "";

      shNotif.appendRow([
        makeId_(),
        new Date(),
        todayStr_(),
        normalize_(u.usuario),
        String(u.rol || "").toUpperCase(),
        "CLUES",
        municipio,
        clues,
        "",
        "Pedido de pinol entregado",
        detalleBase + detalleObs + comentarioFinal,
        "SUCCESS",
        "UNREAD",
        "",
        "",
        JSON.stringify({
          source: "PINOL",
          event: "PINOL_ENTREGADO",
          pinol_id: id,
          municipio: municipio,
          clues: clues,
          unidad: unidad
        })
      ]);

      return {
        ok:true,
        message:"Solicitud marcada como entregada y notificación enviada."
      };
    }

    return { ok:false, error:"Solicitud no encontrada." };

  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

function api_sendNotification(payload) {
  try {
    const sender = authOrThrow_(payload?.token);

    if (!isRoleOps_(sender.rol)) {
      return { ok:false, error:"Solo ADMIN, JURISDICCIONAL o MUNICIPAL pueden enviar notificaciones." };
    }

    const target_scope = normalizeNotifScope_(payload?.target_scope);
    
    // RESTRICCIÓN JURISDICCIONAL: Solo niveles MUNICIPIO o ALL_MY_UNITS
    if (sender.rol === "JURISDICCIONAL") {
      if (target_scope !== "MUNICIPIO" && target_scope !== "ALL_MY_UNITS") {
        return { ok:false, error:"Como perfil JURISDICCIONAL, solo puedes enviar notificaciones a nivel de MUNICIPIO." };
      }
    }

    // RESTRICCIÓN MUNICIPAL: Solo sus CLUES o MUNICIPIOS asignados
    if (sender.rol === "MUNICIPAL") {
      if (target_scope === "CLUES") {
        const targetUnit = getUnitByClues_(payload?.target_clues);
        if (!targetUnit || !userCanTargetMunicipio_(sender, targetUnit.municipio)) {
          return { ok:false, error:"No tienes permisos para enviar notificaciones a esta unidad." };
        }
      }
    }

    const target_municipio = fixUtf8Text_(normalize_(payload?.target_municipio));
    const target_clues = normalize_(payload?.target_clues);
    const target_usuario = "";
    const title = normalize_(payload?.title);
    const message = normalize_(payload?.message);
    const type = normalizeNotifType_(payload?.type);
    const meta_json = JSON.stringify(payload?.meta || {});

    requireNonEmpty_("title", title);
    requireNonEmpty_("message", message);

    if (target_scope === "ALL_MY_UNITS" || target_scope === "MUNICIPIO") {
      requireNonEmpty_("target_municipio", target_municipio);
      if (!userCanTargetMunicipio_(sender, target_municipio)) {
        return { ok:false, error:"No autorizado para enviar a ese municipio." };
      }
    }

    if (target_scope === "CLUES") {
      requireNonEmpty_("target_municipio", target_municipio);
      requireNonEmpty_("target_clues", target_clues);

      if (!userCanTargetMunicipio_(sender, target_municipio)) {
        return { ok:false, error:"No autorizado para enviar a ese municipio." };
      }
    }

    const sh = ensureNotificationsSheet_();

    sh.appendRow([
      makeId_(),
      new Date(),
      todayStr_(),
      normalize_(sender.usuario),
      String(sender.rol || "").toUpperCase(),
      target_scope,
      target_municipio,
      target_clues,
      target_usuario,
      title,
      message,
      type,
      "UNREAD",
      "",
      "",
      meta_json
    ]);

    return { ok:true, message:"Notificación enviada." };

  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

function api_listMyNotifications(payload) {
  try {
    const u = authOrThrow_(payload?.token);
    const onlyUnread = String(payload?.only_unread || "").trim().toUpperCase() === "SI";

    const sh = ensureNotificationsSheet_();
    const last = sh.getLastRow();

    if (last < 2) {
      return {
        ok:true,
        data:{
          items: [],
          unread: 0
        }
      };
    }

    const data = sh.getRange(2, 1, last - 1, 16).getValues();
    const out = [];

    for (let i = 0; i < data.length; i++) {
      const item = parseNotificationRow_(data[i], i + 2);
      if (!notificationTargetsUser_(item, u)) continue;
      if (onlyUnread && item.status === "READ") continue;
      out.push(item);
    }

    out.sort((a, b) => String(b.created_ts || "").localeCompare(String(a.created_ts || ""), "es"));

    const unread = out.filter(x => String(x.status || "").toUpperCase() !== "READ").length;

    return {
      ok:true,
      data:{
        items: out,
        unread
      }
    };

  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

function api_markNotificationRead(payload) {
  try {
    const u = authOrThrow_(payload?.token);
    const id = normalize_(payload?.id);

    requireNonEmpty_("id", id);

    const sh = ensureNotificationsSheet_();
    const last = sh.getLastRow();
    if (last < 2) return { ok:false, error:"No hay notificaciones." };

    const data = sh.getRange(2, 1, last - 1, 16).getValues();

    for (let i = 0; i < data.length; i++) {
      const row = i + 2;
      const item = parseNotificationRow_(data[i], row);

      if (item.id !== id) continue;
      if (!notificationTargetsUser_(item, u)) {
        return { ok:false, error:"No autorizado para esa notificación." };
      }

      if (item.status === "READ") {
        return { ok:true, message:"La notificación ya estaba marcada como leída." };
      }

      sh.getRange(row, 13).setValue("READ");
      sh.getRange(row, 14).setValue(new Date());
      sh.getRange(row, 15).setValue(normalize_(u.usuario));

      return { ok:true, message:"Notificación marcada como leída." };
    }

    return { ok:false, error:"Notificación no encontrada." };

  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

function api_deleteNotification(payload) {
  try {
    const u = authOrThrow_(payload?.token);
    const id = normalize_(payload?.id);

    requireNonEmpty_("id", id);

    const sh = ensureNotificationsSheet_();
    const last = sh.getLastRow();
    if (last < 2) return { ok:false, error:"No hay notificaciones." };

    const data = sh.getRange(2, 1, last - 1, 16).getValues();

    for (let i = 0; i < data.length; i++) {
      const row = i + 2;
      const item = parseNotificationRow_(data[i], row);

      if (item.id !== id) continue;

      if (!notificationTargetsUser_(item, u) && String(u.rol || "").toUpperCase() !== "ADMIN") {
        return { ok:false, error:"No autorizado para eliminar esa notificación." };
      }

      sh.deleteRow(row);

      return { ok:true, message:"Notificación eliminada correctamente." };
    }

    return { ok:false, error:"Notificación no encontrada." };

  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

function api_confirmPinolReceipt(payload) {
  try {
    const u = authOrThrow_(payload?.token);

    if (String(u.rol || "").toUpperCase() !== "UNIDAD") {
      return { ok:false, error:"Solo el perfil UNIDAD puede confirmar la recepción." };
    }

    const notificationId = normalize_(payload?.notification_id);
    requireNonEmpty_("notification_id", notificationId);

    const sh = ensureNotificationsSheet_();
    const last = sh.getLastRow();
    if (last < 2) return { ok:false, error:"No hay notificaciones." };

    const data = sh.getRange(2, 1, last - 1, 16).getValues();

    for (let i = 0; i < data.length; i++) {
      const row = i + 2;
      const item = parseNotificationRow_(data[i], row);

      if (item.id !== notificationId) continue;

      if (!notificationTargetsUser_(item, u)) {
        return { ok:false, error:"No autorizado para esa notificación." };
      }

      let meta = {};
      try {
        meta = item.meta_json ? JSON.parse(item.meta_json) : {};
      } catch (_) {
        meta = {};
      }

      const source = String(meta.source || "").toUpperCase();
      const event = String(meta.event || "").toUpperCase();

      if (source !== "PINOL" || event !== "PINOL_ENTREGADO") {
        return { ok:false, error:"La notificación no corresponde a una entrega de pinol." };
      }

      if (String(meta.confirmed_by_unit || "").toUpperCase() === "SI") {
        return { ok:true, message:"La recepción ya había sido confirmada." };
      }

      const municipioNotif = fixUtf8Text_(normalize_(meta.municipio || item.target_municipio || u.municipio || ""));
      const cluesNotif = normalizeClues_(meta.clues || item.target_clues || u.clues || "");
      const unidadNotif = normalize_(meta.unidad || u.unidad || "");

      meta.confirmed_by_unit = "SI";
      meta.confirmed_ts = Utilities.formatDate(new Date(), tz_(), "yyyy-MM-dd HH:mm:ss");
      meta.confirmed_usuario = normalize_(u.usuario);
      meta.confirmed_clues = normalizeClues_(u.clues);
      meta.confirmed_unidad = normalize_(u.unidad);

      sh.getRange(row, 16).setValue(JSON.stringify(meta));
      sh.getRange(row, 13).setValue("READ");
      sh.getRange(row, 14).setValue(new Date());
      sh.getRange(row, 15).setValue(normalize_(u.usuario));

      const ackTitle = "Pinol recibido";
      const ackMessage =
        `La unidad confirmó la recepción del pinol.` +
        `\n\nMunicipio: ${municipioNotif || "—"}` +
        `\nUnidad: ${unidadNotif || "—"}` +
        `\nCLUES: ${cluesNotif || "—"}` +
        `\nConfirmó: ${normalize_(u.usuario) || "—"}`;

      const shUsers = ensureUsersSheet_();
      const lastUsers = shUsers.getLastRow();

      if (lastUsers >= 2) {
        const users = shUsers.getRange(2, 1, lastUsers - 1, 11).getValues();

        for (let j = 0; j < users.length; j++) {
          const ur = users[j];

          const targetUsuario = normalize_(ur[0]);
          const targetMunicipio = fixUtf8Text_(normalize_(ur[1]));
          const targetRol = String(normalize_(ur[5]) || "").toUpperCase();
          const targetActivo = String(normalize_(ur[6]) || "SI").toUpperCase();

          if (!targetUsuario) continue;
          if (targetActivo !== "SI") continue;

          const esAdmin = targetRol === "ADMIN";
          const esMunicipalDelMismoMunicipio =
            targetRol === "MUNICIPAL" &&
            normalizeTextKey_(targetMunicipio) === normalizeTextKey_(municipioNotif);

          if (!esAdmin && !esMunicipalDelMismoMunicipio) continue;

          sh.appendRow([
            makeId_(),
            new Date(),
            todayStr_(),
            normalize_(u.usuario),
            String(u.rol || "").toUpperCase(),
            "USUARIO",
            municipioNotif,
            cluesNotif,
            targetUsuario,
            ackTitle,
            ackMessage,
            "SUCCESS",
            "UNREAD",
            "",
            "",
            JSON.stringify({
              source: "PINOL",
              event: "PINOL_RECIBIDO_CONFIRMADO",
              pinol_id: normalize_(meta.pinol_id),
              municipio: municipioNotif,
              clues: cluesNotif,
              unidad: unidadNotif,
              confirmed_by_unit: "SI",
              confirmed_ts: meta.confirmed_ts,
              confirmed_usuario: normalize_(u.usuario),
              confirmed_clues: normalizeClues_(u.clues),
              confirmed_unidad: normalize_(u.unidad),
              audience: esAdmin ? "ADMIN" : "MUNICIPAL",
              target_usuario: targetUsuario
            })
          ]);
        }
      }

      return { ok:true, message:"Recepción confirmada correctamente." };
    }

    return { ok:false, error:"Notificación no encontrada." };

  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

/** ===== SAVE: EXISTENCIA DE BIOLÓGICOS ===== **/
function api_saveSR(payload) {
  try {
    const u = authOrThrow_(payload?.token);

    const fecha = normalize_(payload?.fecha) || todayStr_();
    const nombre = normalize_(payload?.nombre);
    requireNonEmpty_("Nombre", nombre);

    const items = payload?.items || []; // Array de { biologico, lote, caducidad, cantidad }
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("No hay elementos para guardar en la existencia.");
    }

    const shDetalle = ensureExistenciaDetalleSheet_();
    const shSummary = getSheet_(SHEET_SR_EXISTENCIA);

    ensureHeader_(shSummary, [
      "id","timestamp","fecha","municipio","clues","unidad",
      "bcg","hepatitis_b","hexavalente","dpt","rotavirus",
      "neumococica_13","neumococica_20","srp","sr","vph",
      "varicela","hepatitis_a","td","tdpa","covid_19","influenza","vsr",
      "capturado_por","editado","editado_por","editado_ts"
    ]);

    // Verificar si ya existe captura de hoy para esta unidad en el resumen
    const existingRow = findRowByFechaClues_(shSummary, fecha, u.clues);
    if (existingRow) {
      return { ok: false, error: `Ya existe una captura de existencia para hoy (${fecha}). Usa "Editar".` };
    }

    // 1. Guardar a DETALLE y agregar totales
    const totals = {
      bcg: 0, hepatitis_b: 0, hexavalente: 0, dpt: 0, rotavirus: 0,
      neumococica_13: 0, neumococica_20: 0, srp: 0, sr: 0, vph: 0,
      varicela: 0, hepatitis_a: 0, td: 0, tdpa: 0, covid_19: 0, influenza: 0, vsr: 0
    };

    const mapping = {
      "BCG": "bcg",
      "HEPATITIS B": "hepatitis_b", "HEPATITIS 10": "hepatitis_b",
      "HEXAVALENTE": "hexavalente",
      "DPT": "dpt",
      "ROTAVIRUS": "rotavirus",
      "NEUMOCOCICA 13": "neumococica_13",
      "NEUMOCOCICA 20": "neumococica_20",
      "SRP": "srp", "SRP (UNIDOSIS)": "srp",
      "SR": "sr", "SR (MULTIDOSIS)": "sr",
      "VPH": "vph", "VPH BIVALENTE": "vph",
      "VARICELA": "varicela",
      "HEPATITIS A": "hepatitis_a",
      "TD": "td",
      "TDPA": "tdpa",
      "COVID 19": "covid_19", "COVID-19": "covid_19",
      "INFLUENZA": "influenza",
      "VSR": "vsr"
    };

    const detailedRows = [];
    items.forEach(it => {
      const bio = normalize_(it.biologico).toUpperCase();
      const cant = Number(it.cantidad || 0);
      const lote = normalize_(it.lote).toUpperCase();
      const cad = normalize_(it.caducidad).toUpperCase();
      const recepcion = normalize_(it.fecha_recepcion || "");

      detailedRows.push([
        fecha, u.clues, u.unidad, u.municipio, bio, lote, cad, recepcion, cant, nombre
      ]);

      const key = mapping[bio];
      if (key) {
        totals[key] += cant;
      }
    });

    if (detailedRows.length > 0) {
      shDetalle.getRange(shDetalle.getLastRow() + 1, 1, detailedRows.length, 10).setValues(detailedRows);
    }

    // 2. Guardar a RESUMEN (Legacy)
    shSummary.appendRow([
      makeId_(), new Date(), fecha, u.municipio, u.clues, u.unidad,
      totals.bcg, totals.hepatitis_b, totals.hexavalente, totals.dpt, totals.rotavirus,
      totals.neumococica_13, totals.neumococica_20, totals.srp, totals.sr, totals.vph,
      totals.varicela, totals.hepatitis_a, totals.td, totals.tdpa, totals.covid_19, totals.influenza, totals.vsr,
      nombre, "", "", ""
    ]);

    return { ok: true, message: "Existencia de biológicos guardada correctamente." };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

/** ===== SAVE: CONSUMIBLES ===== **/
function api_saveConsumibles(payload) {
  try {
    const u = authOrThrow_(payload?.token);

    const consStatus = getConsumiblesStatus_(todayStr_(), u.clues);

  if (!consStatus.canCaptureConsumibles) {
    return { ok:false, error:`Este reporte de consumibles no está habilitado hoy. ${consStatus.consumiblesReason}` };
  }

    const fecha = consStatus.consumiblesCaptureDate || todayStr_();
    const nombre = normalize_(payload?.nombre);
    requireNonEmpty_("Nombre", nombre);

    const srp_dosis = requireNonNegNumber_("Existencia SRP (dosis)", payload?.srp_dosis);
    const sr_dosis = requireNonNegNumber_("Existencia SR (dosis)", payload?.sr_dosis);
    const j1 = requireNonNegNumber_("Jeringa reconst 5ml (060.550.0438)", payload?.jeringa_reconst_5ml_0605500438);
    const j2 = requireNonNegNumber_("Jeringa aplic 0.5ml (060.550.2657)", payload?.jeringa_aplic_05ml_0605502657);

    // ✅ REGLA: Aguja = Jeringa reconst 5ml
    const aguja = j1;

    const sh = getSheet_(SHEET_CONS);
    ensureHeader_(sh, [
      "id","timestamp","fecha","municipio","clues","unidad",
      "srp_dosis","sr_dosis",
      "jeringa_reconst_5ml_0605500438",
      "jeringa_aplic_05ml_0605502657",
      "aguja_0600403711",
      "capturado_por","editado","editado_por","editado_ts"
    ]);

    const row = findRowByFechaClues_(sh, fecha, u.clues);
    if (row) {
      return { ok:false, error:`Ya existe un reporte de consumibles para hoy (${fecha}) en esa unidad. Usa "Editar".` };
    }

    sh.appendRow([makeId_(), new Date(), fecha, u.municipio, u.clues, u.unidad, srp_dosis, sr_dosis, j1, j2, aguja, nombre, "", "", ""]);

    return { ok:true, message:"Reporte de consumibles guardado (jueves)." };
  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

/** ===== CONSULTA CAPTURAS DE HOY ===== **/
function api_getEditLog(payload){
  try {
    const u = authOrThrow_(payload?.token);

    if (u.rol !== "ADMIN" && u.rol !== "MUNICIPAL" && u.rol !== "JURISDICCIONAL") {
      return { ok:false, error:"Sin permisos." };
    }

    const fechaFiltro = normalizeDateKey_(payload?.fecha || "");
    const tipoFiltro = normalize_(payload?.tipo || "TODOS").toUpperCase();

    const out = [];

    // ===== EXISTENCIA DE BIOLÓGICOS =====
    if (tipoFiltro === "TODOS" || tipoFiltro === "SR") {
      const shSR = getSheet_(SHEET_SR_EXISTENCIA);
      ensureHeader_(shSR, [
        "id","timestamp","fecha","municipio","clues","unidad",
        "bcg","hepatitis_b","hexavalente","dpt","rotavirus",
        "neumococica_13","neumococica_20","srp","sr","vph",
        "varicela","hepatitis_a","td","tdpa","covid_19","influenza","vsr",
        "capturado_por","editado","editado_por","editado_ts"
      ]);

      const lastSR = shSR.getLastRow();
      if (lastSR >= 2) {
        const dataSR = shSR.getRange(2, 1, lastSR - 1, 27).getValues();

        for (let i = 0; i < dataSR.length; i++) {
          const r = dataSR[i];

          const fechaReporte = normalizeDateKey_(r[2]);
          const municipio = fixUtf8Text_(normalize_(r[3]));
          const clues = normalize_(r[4]);
          const unidad = normalize_(r[5]);
          const editado = normalize_(r[24]).toUpperCase();
          const editadoPor = normalize_(r[25]);
          const editadoTs = r[26] instanceof Date
            ? Utilities.formatDate(r[26], tz_(), "yyyy-MM-dd HH:mm:ss")
            : normalize_(r[26]);

          if (editado !== "SI") continue;
          if (!canSeeMunicipio_(u, municipio)) continue;
          if (fechaFiltro && fechaReporte !== fechaFiltro) continue;

          out.push({
            fecha_reporte: fechaReporte,
            tipo: "SR",
            municipio,
            clues,
            unidad,
            editado_por: editadoPor,
            editado_ts: editadoTs,
            detalle: "Edición de existencia de biológicos"
          });
        }
      }
    }

    // ===== CONSUMIBLES =====
    if (tipoFiltro === "TODOS" || tipoFiltro === "CONS") {
      const shCO = getSheet_(SHEET_CONS);
      ensureHeader_(shCO, [
        "id","timestamp","fecha","municipio","clues","unidad",
        "srp_dosis","sr_dosis",
        "jeringa_reconst_5ml_0605500438",
        "jeringa_aplic_05ml_0605502657",
        "aguja_0600403711",
        "capturado_por","editado","editado_por","editado_ts"
      ]);

      const lastCO = shCO.getLastRow();
      if (lastCO >= 2) {
        const dataCO = shCO.getRange(2, 1, lastCO - 1, 15).getValues();

        for (let i = 0; i < dataCO.length; i++) {
          const r = dataCO[i];

          const fechaReporte = normalizeDateKey_(r[2]);
          const municipio = fixUtf8Text_(normalize_(r[3]));
          const clues = normalize_(r[4]);
          const unidad = normalize_(r[5]);
          const editado = normalize_(r[12]).toUpperCase();
          const editadoPor = normalize_(r[13]);
          const editadoTs = r[14] instanceof Date
            ? Utilities.formatDate(r[14], tz_(), "yyyy-MM-dd HH:mm:ss")
            : normalize_(r[14]);

          if (editado !== "SI") continue;
          if (!canSeeMunicipio_(u, municipio)) continue;
          if (fechaFiltro && fechaReporte !== fechaFiltro) continue;

          out.push({
            fecha_reporte: fechaReporte,
            tipo: "CONS",
            municipio,
            clues,
            unidad,
            editado_por: editadoPor,
            editado_ts: editadoTs,
            detalle: "Edición de reporte de consumibles"
          });
        }
      }
    }

    out.sort((a, b) =>
      String(b.editado_ts || "").localeCompare(String(a.editado_ts || ""), "es")
    );

    return { ok:true, data: out };

  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}
/** ===== UPDATE EXISTENCIA DE BIOLÓGICOS ===== **/
function api_updateSR(payload) {
  try {
    const u = authOrThrow_(payload?.token);

    const fecha = normalize_(payload?.fecha) || todayStr_();
    const nombre = normalize_(payload?.nombre);
    requireNonEmpty_("Nombre", nombre);

    const items = payload?.items || [];
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("No hay elementos para actualizar.");
    }

    const shDetalle = ensureExistenciaDetalleSheet_();
    const shSummary = getSheet_(SHEET_SR_EXISTENCIA);

    const summaryRow = findRowByFechaClues_(shSummary, fecha, u.clues);
    if (!summaryRow) {
      throw new Error(`No se encontró la captura de existencia para editar (${fecha}).`);
    }

    // 1. Eliminar detalles previos de esta unidad/fecha
    deleteDetailedRows_(shDetalle, fecha, u.clues);

    // 2. Guardar nuevos detalles y agregar totales
    const totals = {
      bcg: 0, hepatitis_b: 0, hexavalente: 0, dpt: 0, rotavirus: 0,
      neumococica_13: 0, neumococica_20: 0, srp: 0, sr: 0, vph: 0,
      varicela: 0, hepatitis_a: 0, td: 0, tdpa: 0, covid_19: 0, influenza: 0, vsr: 0
    };

    const mapping = {
      "BCG": "bcg",
      "HEPATITIS B": "hepatitis_b", "HEPATITIS 10": "hepatitis_b",
      "HEXAVALENTE": "hexavalente",
      "DPT": "dpt",
      "ROTAVIRUS": "rotavirus",
      "NEUMOCOCICA 13": "neumococica_13",
      "NEUMOCOCICA 20": "neumococica_20",
      "SRP": "srp", "SRP (UNIDOSIS)": "srp",
      "SR": "sr", "SR (MULTIDOSIS)": "sr",
      "VPH": "vph", "VPH BIVALENTE": "vph",
      "VARICELA": "varicela",
      "HEPATITIS A": "hepatitis_a",
      "TD": "td",
      "TDPA": "tdpa",
      "COVID 19": "covid_19", "COVID-19": "covid_19",
      "INFLUENZA": "influenza",
      "VSR": "vsr"
    };

    const detailedRows = [];
    items.forEach(it => {
      const bio = normalize_(it.biologico).toUpperCase();
      const cant = Number(it.cantidad || 0);
      const lote = normalize_(it.lote).toUpperCase();
      const cad = normalize_(it.caducidad).toUpperCase();
      const recepcion = normalize_(it.fecha_recepcion || "");

      detailedRows.push([
        fecha, u.clues, u.unidad, u.municipio, bio, lote, cad, recepcion, cant, nombre
      ]);

      const key = mapping[bio];
      if (key) totals[key] += cant;
    });

    if (detailedRows.length > 0) {
      shDetalle.getRange(shDetalle.getLastRow() + 1, 1, detailedRows.length, 10).setValues(detailedRows);
    }

    // 3. Actualizar RESUMEN (Legacy)
    const bioValues = [[
      totals.bcg, totals.hepatitis_b, totals.hexavalente, totals.dpt, totals.rotavirus,
      totals.neumococica_13, totals.neumococica_20, totals.srp, totals.sr, totals.vph,
      totals.varicela, totals.hepatitis_a, totals.td, totals.tdpa, totals.covid_19, totals.influenza, totals.vsr,
      nombre, "SI", u.usuario, new Date()
    ]];
    shSummary.getRange(summaryRow, 7, 1, 21).setValues(bioValues);

    return { ok: true, message: "Existencia de biológicos actualizada correctamente." };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

/** Helper para eliminar filas de detalle **/
function deleteDetailedRows_(sh, fecha, clues) {
  const last = sh.getLastRow();
  if (last < 2) return;
  const data = sh.getRange(2, 1, last - 1, 2).getValues();
  const fKey = normalizeDateKey_(fecha);
  const cKey = normalizeClues_(clues);

  for (let i = data.length - 1; i >= 0; i--) {
    if (normalizeDateKey_(data[i][0]) === fKey && normalizeClues_(data[i][1]) === cKey) {
      sh.deleteRow(i + 2);
    }
  }
}

/** ===== UPDATE CONSUMIBLES ===== **/
function api_updateConsumibles(payload) {
  try {
    const u = authOrThrow_(payload?.token);

    const consStatus = getConsumiblesStatus_(todayStr_(), u.clues);

    if (!consStatus.canCaptureConsumibles) {
      return { ok:false, error:`Los consumibles no están habilitados hoy. ${consStatus.consumiblesReason}` };
    }

    const fecha = consStatus.consumiblesCaptureDate || todayStr_();
    const nombre = normalize_(payload?.nombre);
    requireNonEmpty_("Nombre", nombre);

    const srp_dosis = requireNonNegNumber_("Existencia SRP (dosis)", payload?.srp_dosis);
    const sr_dosis = requireNonNegNumber_("Existencia SR (dosis)", payload?.sr_dosis);
    const j1 = requireNonNegNumber_("Jeringa reconst 5ml (060.550.0438)", payload?.jeringa_reconst_5ml_0605500438);
    const j2 = requireNonNegNumber_("Jeringa aplic 0.5ml (060.550.2657)", payload?.jeringa_aplic_05ml_0605502657);
    const aguja = j1 + j2;

    const sh = getSheet_(SHEET_CONS);
    ensureHeader_(sh, [
      "id","timestamp","fecha","municipio","clues","unidad",
      "srp_dosis","sr_dosis",
      "jeringa_reconst_5ml_0605500438",
      "jeringa_aplic_05ml_0605502657",
      "aguja_0600403711",
      "capturado_por","editado","editado_por","editado_ts"
    ]);

    const row = findRowByFechaClues_(sh, fecha, u.clues);
    if (!row) {
      return { ok:false, error:`No se encontró captura de consumibles para editar (${fecha}).` };
    }

    // ✅ BATCH UPDATE: Agrupar valores de consumibles (columnas 7 a 15)
    const consValues = [[
      srp_dosis, sr_dosis, j1, j2, aguja, 
      nombre, "SI", u.usuario, new Date()
    ]];
    sh.getRange(row, 7, 1, 9).setValues(consValues);

    return { ok:true, message:"Consumibles actualizado correctamente." };
  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

function api_bioGetForm(payload) {
  try {
    const u = authOrThrow_(payload?.token);

    if (u.rol !== "UNIDAD") {
      return { ok:false, error:"Solo el perfil UNIDAD captura biológicos." };
    }

    const today = todayStr_();
    const bioWindow = getBioCaptureWindow_();
    const fechaPedidoProgramada = bioWindow.fechaPedidoProgramada;
    const configRows = getBioConfigForUnit_(u.clues);
    const savedRows = getBioRowsByFechaPedido_(fechaPedidoProgramada, u.clues);

    const savedMap = {};
    savedRows.forEach(x => {
      savedMap[normalizeTextKey_(x.biologico)] = x;
    });

    const hasSavedBio = savedRows.some(x => normalize_(x && x.biologico));

    const dToday = new Date(today + "T00:00:00");
    const dProg = new Date(fechaPedidoProgramada + "T00:00:00");
    const diffDays = Math.round((dToday.getTime() - dProg.getTime()) / 86400000);

    const isCaptureDay = today === fechaPedidoProgramada;
    const canCapture = isWithinBioCaptureWindow_(today, bioWindow);

    let captureWindowStatus = "OPEN";
    if (today < bioWindow.habilitarDesde) captureWindowStatus = "EARLY";
    if (today > bioWindow.habilitarHasta) captureWindowStatus = "LATE";

    return {
      ok:true,
      data:{
        today,
        fechaPedidoProgramada,
        captureWindowStart: bioWindow.habilitarDesde,
        captureWindowEnd: bioWindow.habilitarHasta,
        captureWindowReason: bioWindow.motivo || "",
        isCaptureDay,
        canCapture,
        hasSavedBio,
        captureWindowStatus,
        diffDays,
        rows: configRows.map(r => {
          const s = savedMap[normalizeTextKey_(r.biologico)] || {};
          return {
            biologico: r.biologico,
            max_dosis: r.max_dosis,
            min_dosis: r.min_dosis,
            promedio_frascos: r.promedio_frascos,
            multiplo_pedido: r.multiplo_pedido,
            existencia_actual_frascos: s.existencia_actual_frascos ?? "",
            pedido_frascos: s.pedido_frascos ?? ""
          };
        })
      }
    };
  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

function api_saveBio(payload) {
  try {
    const u = authOrThrow_(payload?.token);

    if (u.rol !== "UNIDAD") {
      return { ok:false, error:"Solo el perfil UNIDAD captura biológicos." };
    }

    const nombre = normalize_(payload?.nombre);
    requireNonEmpty_("Nombre", nombre);

    const bioWindow = getBioCaptureWindow_();
    const fechaPedidoProgramada = bioWindow.fechaPedidoProgramada;
    const today = todayStr_();

    if (!isWithinBioCaptureWindow_(today, bioWindow)) {
      return {
        ok:false,
        error:`La captura de pedido biológico está habilitada del ${bioWindow.habilitarDesde} al ${bioWindow.habilitarHasta}. Fecha objetivo: ${fechaPedidoProgramada}.`
      };
    }

    const configRows = getBioConfigForUnit_(u.clues);
    if (!configRows.length) {
      return { ok:false, error:"No hay configuración en PARAM_BIOLOGICOS para esta unidad." };
    }

    const checked = validateBioItems_(configRows, payload?.items || [], {
      isCaravana: isCaravanaUnit_(u)
    });

    if (checked.errors.length) {
      return { ok:false, error: checked.errors.join(" | ") };
    }

    const sh = ensureBioCaptureSheet_();
    const existentes = getBioRowsByFechaPedido_(fechaPedidoProgramada, u.clues);
    const existentesMap = {};

    existentes.forEach(x => {
      const bioKey = normalizeTextKey_(x && x.biologico);
      if (!bioKey) return;
      if (!x || !x.row) return;
      existentesMap[bioKey] = x;
    });

    let updatedCount = 0;
    let insertedCount = 0;

    const newRows = [];
    checked.rows.forEach(item => {
      const ya = existentesMap[normalizeTextKey_(item.biologico)];

      if (ya && ya.row) {
        // Optimización: actualización en lote de datos y metadatos (columnas 9 a 19)
        sh.getRange(ya.row, 9, 1, 11).setValues([[
          item.max_dosis,
          item.min_dosis,
          item.promedio_frascos,
          item.existencia_actual_frascos,
          item.pedido_frascos,
          item.alerta_promedio,
          item.alerta_multiplo,
          nombre,
          "SI",
          u.usuario,
          new Date()
        ]]);
        updatedCount++;
      } else {
        // Recolectar para inserción en lote
        newRows.push([
          makeId_(),
          new Date(),
          todayStr_(),
          fechaPedidoProgramada,
          u.municipio,
          u.clues,
          u.unidad,
          item.biologico,
          item.max_dosis,
          item.min_dosis,
          item.promedio_frascos,
          item.existencia_actual_frascos,
          item.pedido_frascos,
          item.alerta_promedio,
          item.alerta_multiplo,
          nombre,
          "",
          "",
          ""
        ]);
        insertedCount++;
      }
    });

    if (newRows.length > 0) {
      sh.getRange(sh.getLastRow() + 1, 1, newRows.length, 19).setValues(newRows);
    }

    return {
      ok:true,
      message:"Pedido biológico guardado/actualizado.",
      warnings: checked.warnings,
      insertedCount,
      updatedCount,
      fecha_pedido_programada: fechaPedidoProgramada
    };

  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

function api_bioExportMatrix(payload) {
  try {
    const u = authOrThrow_(payload?.token);

    if (u.rol !== "ADMIN" && u.rol !== "MUNICIPAL" && u.rol !== "JURISDICCIONAL") {
      return { ok:false, error:"Sin permisos para exportar matriz de biológicos." };
    }

    const fechaPedido = normalize_(payload?.fechaPedido) || getProgrammedPedidoDate_();
    const municipios = Array.isArray(payload?.municipios) ? payload.municipios : [];

    const municipiosValidos = getExportableMunicipios_(u).map(x => normalizeTextKey_(x));
    const municipiosSolicitados = municipios.map(x => normalizeTextKey_(x)).filter(Boolean);

    for (let i = 0; i < municipiosSolicitados.length; i++) {
      if (!municipiosValidos.includes(municipiosSolicitados[i])) {
        return { ok:false, error:"Uno o más municipios seleccionados no están permitidos para este perfil." };
      }
    }

    const separarPorMunicipio = String(payload?.separarPorMunicipio || "NO").toUpperCase() === "SI";

    if (separarPorMunicipio && u.rol === "ADMIN") {
      const outZip = buildBioExportZipByMunicipio_(u, fechaPedido, municipios);
      const b64Zip = Utilities.base64Encode(outZip.blob.getBytes());

      return {
        ok:true,
        data:{
          filename: outZip.filename,
          b64: b64Zip,
          mimeType: "application/zip",
          fechaPedido
        }
      };
    }

    const out = buildBioExportXlsx_(u, fechaPedido, municipios);
    const b64 = Utilities.base64Encode(out.blob.getBytes());

    return {
      ok:true,
      data:{
        filename: out.filename,
        b64,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fechaPedido
      }
    };
  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

function api_srExportMatrix(payload) {
  try {
    const u = authOrThrow_(payload?.token);

    if (u.rol !== "ADMIN" && u.rol !== "MUNICIPAL" && u.rol !== "JURISDICCIONAL") {
      return { ok:false, error:"Sin permisos para exportar matriz de existencias." };
    }

    const fecha = normalizeDateKey_(payload?.fecha || todayStr_());
    const municipios = Array.isArray(payload?.municipios) ? payload.municipios : [];

    const municipiosValidos = getExportableMunicipios_(u).map(x => normalizeTextKey_(x));
    const municipiosSolicitados = municipios.map(x => normalizeTextKey_(x)).filter(Boolean);

    for (let i = 0; i < municipiosSolicitados.length; i++) {
      if (!municipiosValidos.includes(municipiosSolicitados[i])) {
        return { ok:false, error:"Uno o más municipios seleccionados no están permitidos para este perfil." };
      }
    }

    const out = buildExistenciaExportXlsx_(u, fecha, municipios);
    const b64 = Utilities.base64Encode(out.blob.getBytes());

    return {
      ok:true,
      data:{
        filename: out.filename,
        b64,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fecha
      }
    };
  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

function api_bioGetDatesForMonth(payload) {
  try {
    const u = authOrThrow_(payload?.token);
    if (!["ADMIN", "MUNICIPAL", "JURISDICCIONAL"].includes(u.rol)) {
      return { ok:false, error:"Sin permisos para listar fechas." };
    }

    const month = normalize_(payload?.month);
    const year = normalize_(payload?.year);
    if (!month || !year) throw new Error("Mes y año requeridos.");

    const prefix = `${year}-${month}`;
    const sh = ensureBioCaptureSheet_();
    const last = sh.getLastRow();
    if (last < 2) return { ok:true, data:[] };

    const rows = sh.getRange(2, 4, last - 1, 1).getValues();
    const uniqueDates = {};

    rows.forEach(r => {
      const d = normalizeDateKey_(r[0]);
      if (d && d.startsWith(prefix)) {
        uniqueDates[d] = true;
      }
    });

    const out = Object.keys(uniqueDates).sort().reverse();
    return { ok:true, data: out };
  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

function api_changeMyPassword(payload) {
  try {
    const u = authOrThrow_(payload?.token);
    const sh = ensureUsersSheet_();

    const currentPassword = normalize_(payload?.currentPassword);
    const newPassword = normalize_(payload?.newPassword);
    const confirmPassword = normalize_(payload?.confirmPassword);

    requireNonEmpty_("Contraseña actual", currentPassword);
    requireNonEmpty_("Nueva contraseña", newPassword);
    requireNonEmpty_("Confirmación de nueva contraseña", confirmPassword);

    // Verificar contraseña actual (soporta haseada o plano para migración)
    const currentHash = hashPassword_(currentPassword);
    const storedPass = u.password;
    let authOk = isHashed_(storedPass) ? (storedPass === currentHash) : (storedPass === currentPassword);

    if (!authOk) {
      return { ok:false, error:"La contraseña actual no es correcta." };
    }

    if (newPassword !== confirmPassword) {
      return { ok:false, error:"La nueva contraseña y su confirmación no coinciden." };
    }

    if (newPassword.length < 6) {
      return { ok:false, error:"La nueva contraseña debe tener al menos 6 caracteres." };
    }

    if (newPassword === currentPassword) {
      return { ok:false, error:"La nueva contraseña debe ser distinta a la actual." };
    }

    const newHash = hashPassword_(newPassword);
    sh.getRange(u.row, 2).setValue(newHash); // password haseada
    sh.getRange(u.row, 9).setValue("NO");     // must_change
    sh.getRange(u.row, 10).setValue("");      // reset_token
    sh.getRange(u.row, 11).setValue("");      // reset_expires

    clearUserCache_(u.usuario);

    return { ok:true, message:"Contraseña actualizada correctamente y protegida." };
  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

function api_saveMyEmail(payload) {
  try {
    const u = authOrThrow_(payload?.token);
    const sh = ensureUsersSheet_();

    const email = normalize_(payload?.email).toLowerCase();
    requireNonEmpty_("Correo electrónico", email);

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      return { ok:false, error:"Correo electrónico inválido." };
    }

    sh.getRange(u.row, 8).setValue(email); // email

    return { ok:true, message:"Correo guardado correctamente." };
  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

/** ===== EXPORT ===== **/
function api_export(payload) {
  try {
    const u = authOrThrow_(payload?.token);

    if (u.rol !== "ADMIN" && u.rol !== "MUNICIPAL" && u.rol !== "JURISDICCIONAL") {
      return { ok:false, error:"Sin permisos para exportar." };
    }

    const tipo = (normalize_(payload?.tipo) || "SR").toUpperCase();
    let fechaInicio = normalizeDateKey_(payload?.fechaInicio || todayStr_());
    let fechaFin = normalizeDateKey_(payload?.fechaFin || fechaInicio);

    if (!["SR", "CONS"].includes(tipo)) {
      return { ok:false, error:"Tipo de exportación inválido. Usa SR o CONS." };
    }

    if (tipo === "CONS") {
      const fechaBase = normalizeDateKey_(
        payload?.fecha ||
        payload?.fechaFin ||
        payload?.fechaInicio ||
        lastThursdayStr_()
      );

      const rango = getConsumiblesOperationalRange_(fechaBase);

      if (!payload?.fechaInicio && !payload?.fechaFin) {
        fechaInicio = rango.fechaInicio;
        fechaFin = rango.fechaFin;
      } else {
        fechaInicio = normalizeDateKey_(payload?.fechaInicio);
        fechaFin = normalizeDateKey_(payload?.fechaFin || payload?.fechaInicio);
      }

      if (!isValidConsumiblesDate_(fechaBase) && fechaBase !== rango.fechaCorteResumen) {
        return { ok:false, error:"La fecha seleccionada no corresponde a una fecha válida de consumibles." };
      }

      if (fechaInicio > fechaFin) {
        return { ok:false, error:"La fecha inicial no puede ser mayor que la fecha final." };
      }

      const municipios = Array.isArray(payload?.municipios) ? payload.municipios : [];
      const separarPorMunicipio = String(payload?.separarPorMunicipio || "NO").toUpperCase() === "SI";

      if (separarPorMunicipio && u.rol === "ADMIN") {
        const outZip = buildConsExportZipByMunicipio_(u, fechaInicio, fechaFin, municipios);
        const b64Zip = Utilities.base64Encode(outZip.blob.getBytes());

        return {
          ok:true,
          data:{
            filename: outZip.filename,
            b64: b64Zip,
            mimeType: "application/zip",
            tipo,
            fechaInicio,
            fechaFin
          }
        };
      }

      const out = buildConsExportXlsx_(u, fechaInicio, fechaFin, municipios);
      const b64 = Utilities.base64Encode(out.blob.getBytes());

      return {
        ok:true,
        data:{
          filename: out.filename,
          b64,
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          tipo,
          fechaInicio,
          fechaFin
        }
      };
    }

    if (fechaInicio > fechaFin) {
      return { ok:false, error:"La fecha inicial no puede ser mayor que la fecha final." };
    }

    const municipios = Array.isArray(payload?.municipios) ? payload.municipios : [];
    const separarPorMunicipio = String(payload?.separarPorMunicipio || "NO").toUpperCase() === "SI";

    if (separarPorMunicipio && u.rol === "ADMIN") {
      const outZip = buildSRExportZipByMunicipio_(u, tipo, fechaInicio, fechaFin, municipios);
      const b64Zip = Utilities.base64Encode(outZip.blob.getBytes());

      return {
        ok:true,
        data:{
          filename: outZip.filename,
          b64: b64Zip,
          mimeType: "application/zip",
          tipo,
          fechaInicio,
          fechaFin
        }
      };
    }

    if (tipo === "SR") {
      const out = buildExistenciaExportXlsx_(u, fechaFin, municipios);
      const b64 = Utilities.base64Encode(out.blob.getBytes());

      return {
        ok:true,
        data:{
          filename: out.filename,
          b64,
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          tipo,
          fechaInicio,
          fechaFin
        }
      };
    }

    const rows = buildFilteredRowsByTipo_(u, tipo, fechaInicio, fechaFin, municipios);
    const csv = toCsv_(rows);

    const tagMunicipios = municipios.length
      ? municipios.map(x => normalizeTextKey_(x)).join("_")
      : "TODOS";

    const filename = `CONSUMIBLES_${fechaInicio}${fechaFin !== fechaInicio ? "_a_" + fechaFin : ""}_${tagMunicipios}.csv`;

    const csvUtf8 = "\uFEFF" + csv;
    const b64 = Utilities.base64Encode(
      Utilities.newBlob(csvUtf8, "text/csv;charset=utf-8", filename).getBytes()
    );

    return {
      ok:true,
      data:{
        filename,
        b64,
        tipo,
        fechaInicio,
        fechaFin,
        mimeType: "text/csv;charset=utf-8"
      }
    };

  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

/** ===== BATCH MANAGEMENT ===== **/
function api_getLotesByMunicipio(payload) {
  try {
    const u = authOrThrow_(payload?.token);
    const sh = ensureLotesCadSheet_();
    const last = sh.getLastRow();
    if (last < 2) return { ok: true, data: [] };

    const data = sh.getRange(2, 1, last - 1, 5).getDisplayValues();
    const out = [];

    for (let i = 0; i < data.length; i++) {
      const r = data[i];
      const biologico = normalize_(r[0]);
      const lote = normalize_(r[1]);
      const caducidad = normalize_(r[2]); // Aquí ya vendrá MAR-27 literal si se usó displayValues
      const fecha_recepcion = normalize_(r[3]);
      const municipioLote = normalizeTextKey_(r[4]);

      // Filtrar por municipio: o es global ("*") o coincide con el municipio del usuario
      // MEJORA LOGÍSTICA SENIOR: Admin y Jurisdiccional ven TODO para supervisión global.
      const isPrivileged = u.rol === "ADMIN" || u.rol === "JURISDICCIONAL";
      if (!isPrivileged && municipioLote !== "*" && municipioLote !== normalizeTextKey_(u.municipio)) {
        continue;
      }

      out.push({
        biologico,
        lote,
        caducidad,
        fecha_recepcion,
        municipio: r[4]
      });
    }

    return { ok: true, data: out };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

function api_saveLotes(payload) {
  try {
    const u = authOrThrow_(payload?.token);
    if (u.rol !== "ADMIN" && u.rol !== "JURISDICCIONAL") {
      throw new Error("No autorizado para gestionar lotes.");
    }

    const items = payload?.lotes || [];
    if (!Array.isArray(items)) throw new Error("Datos de lotes inválidos.");

    const sh = ensureLotesCadSheet_();
    sh.clearContents(); // Warning: This clears everything and rewrites.
    sh.appendRow(["biologico", "lote", "caducidad", "fecha_recepcion", "municipio"]);

    const rows = items.map(x => [
      normalize_(x.biologico),
      normalize_(x.lote).toUpperCase(),
      "'" + normalize_(x.caducidad).toUpperCase(), // Forzar texto plano para evitar auto-date de Sheets
      normalize_(x.fecha_recepcion),
      normalize_(x.municipio) || "*"
    ]);

    if (rows.length > 0) {
      sh.getRange(2, 1, rows.length, 5).setValues(rows);
    }

    return { ok: true, message: "Lotes actualizados correctamente." };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

/** ===== ADMIN ===== **/
function api_adminListUsers(payload) {
  try {
    authOrThrow_(payload?.token, "ADMIN");
    const sh = ensureUsersSheet_();
    const last = sh.getLastRow();
    if (last < 2) return { ok:true, data: [] };

    const values = sh.getRange(2, 1, last - 1, 11).getValues();
    const out = values.map(r => ({
      usuario: normalize_(r[0]),
      password: normalize_(r[1]) ? "********" : "",
      municipio: normalize_(r[2]),
      clues: normalize_(r[3]),
      unidad: normalize_(r[4]),
      rol: (normalize_(r[5]) || "UNIDAD").toUpperCase(),
      activo: (normalize_(r[6]) || "SI").toUpperCase(),
      email: normalize_(r[7]),
      must_change: normalize_(r[8])
    }));

    return { ok:true, data: out };
  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

function api_adminCreateUser(payload) {
  try {
    authOrThrow_(payload?.token, "ADMIN");
    const sh = ensureUsersSheet_();

    const usuario = normalize_(payload?.usuario);
    const password = normalize_(payload?.password);
    const municipio = normalize_(payload?.municipio);
    const clues = normalize_(payload?.clues);
    const unidad = normalize_(payload?.unidad);
    const rol = (normalize_(payload?.rol) || "UNIDAD").toUpperCase();
    const activo = (normalize_(payload?.activo) || "SI").toUpperCase();

    requireNonEmpty_("usuario", usuario);
    requireNonEmpty_("password", password);
    requireNonEmpty_("rol", rol);

    if (!["ADMIN","JURISDICCIONAL","MUNICIPAL","UNIDAD"].includes(rol)) {
      throw new Error("rol inválido. Usa ADMIN, JURISDICCIONAL, MUNICIPAL o UNIDAD.");
    }


    if (rol === "MUNICIPAL") requireNonEmpty_("municipio", municipio);

    if (rol === "UNIDAD") {
      requireNonEmpty_("municipio", municipio);
      requireNonEmpty_("clues", clues);
      requireNonEmpty_("unidad", unidad);
    }

    const existing = getUser_(usuario);
    if (existing) throw new Error("Ese usuario ya existe.");

    const muniFinal = (rol === "ADMIN") ? (municipio || "*") : municipio;

    sh.appendRow([
      usuario,
      hashPassword_(password),
      muniFinal,
      clues,
      unidad,
      rol,
      activo,
      "",   // email
      "SI", // must_change
      "",   // reset_token
      ""    // reset_expires
    ]);

    clearUserCache_(usuario);

    return { ok:true, message:"Usuario creado y contraseña protegida." };

  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

function api_adminResetPassword(payload) {
  try {
    authOrThrow_(payload?.token, "ADMIN");
    const sh = ensureUsersSheet_();

    const usuario = normalize_(payload?.usuario);
    const newPassword = normalize_(payload?.newPassword);

    requireNonEmpty_("usuario", usuario);
    requireNonEmpty_("newPassword", newPassword);

    const u = getUser_(usuario);
    if (!u) throw new Error("Usuario no encontrado.");

    sh.getRange(u.row, 2).setValue(hashPassword_(newPassword)); // password haseada
    sh.getRange(u.row, 9).setValue("SI");                       // must_change
    sh.getRange(u.row, 10).setValue("");                        // reset_token
    sh.getRange(u.row, 11).setValue("");                        // reset_expires

    clearUserCache_(u.usuario);

    return { ok:true, message:"Contraseña actualizada y protegida. El usuario deberá cambiarla al iniciar sesión." };
  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}
function api_adminSetActive(payload) {
  try {
    authOrThrow_(payload?.token, "ADMIN");
    const sh = ensureUsersSheet_();

    const usuario = normalize_(payload?.usuario);
    const activo = (normalize_(payload?.activo) || "").toUpperCase();

    requireNonEmpty_("usuario", usuario);
    if (!["SI","NO"].includes(activo)) throw new Error("activo inválido (SI/NO).");

    const u = getUser_(usuario);
    if (!u) throw new Error("Usuario no encontrado.");

    sh.getRange(u.row, 7).setValue(activo);
    clearUserCache_(u.usuario);
    return { ok:true, message:"Estatus actualizado en base y caché." };
  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

/** ===== RESUMEN DE CAPTURA PARA ADMIN / MUNICIPAL ===== */

function getVisibleUnits_(user) {
  const sh = getSheet_(SHEET_UNIDADES);
  const last = sh.getLastRow();
  if (last < 2) return [];

  const data = sh.getRange(2, 1, last - 1, 5).getValues();
  const out = [];
  const seen = {};
  const userRol = String(user?.rol || "").trim().toUpperCase();
  const userClues = normalizeClues_(user?.clues || "");

  for (let i = 0; i < data.length; i++) {
    const r = data[i];

    const municipio = normalizeTextKey_(r[0]);
    const clues = normalizeClues_(r[1]);
    const unidad = normalize_(r[2]);
    const activo = (normalize_(r[3]) || "SI").toUpperCase();
    const orden_clues = Number(r[4] || 9999);

    if (!municipio || !clues || !unidad) continue;
    if (activo !== "SI") continue;

    if (userRol === "UNIDAD") {
      if (!userClues || clues !== userClues) continue;
    } else {
      if (!canSeeMunicipio_(user, municipio)) continue;
    }

    if (seen[clues]) continue;

    seen[clues] = true;
    out.push({ municipio, clues, unidad, orden_clues });
  }

  out.sort((a, b) =>
    String(a.municipio).localeCompare(String(b.municipio), "es") ||
    Number(a.orden_clues) - Number(b.orden_clues) ||
    String(a.unidad).localeCompare(String(b.unidad), "es")
  );

  return out;
}

function getDayOfWeekFromStr_(yyyyMMdd) {
  const s = normalize_(yyyyMMdd);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return -1;

  const parts = s.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]) - 1;
  const d = Number(parts[2]);

  const dt = new Date(y, m, d);
  return dt.getDay(); // 0=domingo ... 4=jueves
}

function getCapturedMapByFechaTipo_(fecha, tipo) {
  const t = (normalize_(tipo) || "SR").toUpperCase();
  const fechaKey = normalizeDateKey_(fecha);

  const isCONS = (t === "CONS");
  const sh = getSheet_(isCONS ? SHEET_CONS : SHEET_SR_EXISTENCIA);

  if (isCONS) {
    ensureHeader_(sh, [
      "id","timestamp","fecha","municipio","clues","unidad",
      "srp_dosis","sr_dosis",
      "jeringa_reconst_5ml_0605500438",
      "jeringa_aplic_05ml_0605502657",
      "aguja_0600403711",
      "capturado_por","editado","editado_por","editado_ts"
    ]);
  } else {
    ensureHeader_(sh, [
      "id","timestamp","fecha","municipio","clues","unidad",
      "bcg","hepatitis_b","hexavalente","dpt","rotavirus",
      "neumococica_13","neumococica_20","srp","sr","vph",
      "varicela","hepatitis_a","td","tdpa","covid_19","influenza","vsr",
      "capturado_por","editado","editado_por","editado_ts"
    ]);
  }

  const last = sh.getLastRow();
  if (last < 2) return {};

  const data = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  const map = {};

  for (let i = 0; i < data.length; i++) {
    const r = data[i];

    const fechaRow = normalizeDateKey_(r[2]);
    const municipio = normalizeTextKey_(r[3]);
    const clues = normalizeClues_(r[4]);
    const unidad = normalize_(r[5]);

    const capturado_por = isCONS ? normalize_(r[11]) : normalize_(r[23]);
    const editado = isCONS ? normalize_(r[12]) : normalize_(r[24]);

    if (fechaRow !== fechaKey) continue;
    if (!clues) continue;

    map[clues] = {
      municipio,
      clues,
      unidad,
      capturado_por,
      editado
    };
  }

  return map;
}

function getCapturedMapByFechaRangeTipo_(fechaInicio, fechaFin, tipo) {
  const t = (normalize_(tipo) || "SR").toUpperCase();
  const isCONS = (t === "CONS");
  const sh = getSheet_(isCONS ? SHEET_CONS : SHEET_SR_EXISTENCIA);
  const last = sh.getLastRow();

  if (last < 2) return {};

  const data = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  const ini = normalizeDateKey_(fechaInicio);
  const fin = normalizeDateKey_(fechaFin);
  const map = {};

  for (let i = 0; i < data.length; i++) {
    const r = data[i];

    const fechaRow = normalizeDateKey_(r[2]);
    if (!fechaRow || fechaRow < ini || fechaRow > fin) continue;

    const clues = normalizeClues_(r[4]);
    if (!clues) continue;

    const capturado_por = isCONS ? normalize_(r[11]) : normalize_(r[23]);
    const editado = isCONS ? normalize_(r[12]) : normalize_(r[24]);

    map[clues] = {
      municipio: normalizeTextKey_(r[3]),
      clues,
      unidad: normalize_(r[5]),
      capturado_por,
      editado,
      fecha: fechaRow
    };
  }

  return map;
}

function getBioCapturedMapByFechaPedido_(fechaPedido) {
  const fechaKey = normalizeDateKey_(fechaPedido);
  const sh = ensureBioCaptureSheet_();
  const last = sh.getLastRow();

  if (last < 2 || !fechaKey) return {};

  const data = sh.getRange(2, 1, last - 1, 19).getValues();
  const map = {};

  for (let i = 0; i < data.length; i++) {
    const r = data[i];

    if (normalizeDateKey_(r[3]) !== fechaKey) continue;

    const clues = normalizeClues_(r[5]);
    const unidad = normalize_(r[6]);
    const biologico = normalize_(r[7]);
    const capturado_por = normalize_(r[15]);

    if (!clues || !biologico) continue;

    if (!map[clues]) {
      map[clues] = {
        clues,
        unidad,
        capturado_por,
        hasSaved: true
      };
    }
  }

  return map;
}

function api_adminCaptureOverview(payload) {
  try {
    const u = authOrThrow_(payload?.token);

    if (u.rol !== "ADMIN" && u.rol !== "MUNICIPAL" && u.rol !== "JURISDICCIONAL") {
      return { ok:false, error:"Sin permisos para ver resumen de captura." };
    }


    const fecha = normalizeDateKey_(payload?.fecha || todayStr_());
    const tipo = String(payload?.tipo || "SR").trim().toUpperCase();

    if (!["SR", "CONS"].includes(tipo)) {
      return { ok:false, error:"Tipo inválido. Usa SR o CONS." };
    }

    const visibles = getVisibleUnits_(u);

    let capturadasMap = {};
    let fechaRespuesta = fecha;
    let esJueves = getDayOfWeekFromStr_(fecha) === 4;
    let mensaje = "";

    if (tipo === "CONS") {
      const consRange = getConsumiblesOperationalRange_(fecha);
      const consStatus = getConsumiblesStatus_(fecha);

      const esFechaConsultaConsumibles =
        !!(consStatus && consStatus.canCaptureConsumibles) ||
        fecha === consRange.fechaCorteResumen ||
        fecha === consRange.fechaInicio ||
        fecha === consRange.fechaFin;

      if (!esFechaConsultaConsumibles) {
        return {
          ok:true,
          data:{
            fecha,
            tipo,
            es_jueves: esJueves,
            total_unidades: visibles.length,
            total_capturadas: 0,
            total_faltantes: visibles.length,
            capturadas: [],
            faltantes: visibles.map(x => ({
              municipio: x.municipio,
              clues: x.clues,
              unidad: x.unidad
            })),
            mensaje: "La consulta de consumibles solo aplica para fechas válidas de consumibles."
          }
        };
      }

      const mapExacta = getCapturedMapByFechaTipo_(fecha, "CONS");
      const mapRango = getCapturedMapByFechaRangeTipo_(
        consRange.fechaInicio,
        consRange.fechaFin,
        "CONS"
      );

      capturadasMap = Object.assign({}, mapRango, mapExacta);

      fechaRespuesta = fecha;
      esJueves = getDayOfWeekFromStr_(fechaRespuesta) === 4;

      if (Object.keys(mapExacta || {}).length > 0) {
        mensaje = `Consulta cargada: Consumibles del ${fecha}`;
      } else if (consRange.fechaInicio !== consRange.fechaFin) {
        mensaje = `Consulta cargada: Consumibles del ${consRange.fechaInicio} al ${consRange.fechaFin}`;
      } else {
        mensaje = `Consulta cargada: Consumibles del ${consRange.fechaInicio}`;
      }
    } else {
      capturadasMap = getCapturedMapByFechaTipo_(fecha, tipo);
      fechaRespuesta = fecha;
      esJueves = getDayOfWeekFromStr_(fechaRespuesta) === 4;
    }

    const capturadas = [];
    const faltantes = [];

    visibles.forEach(item => {
      const cap = capturadasMap[normalizeClues_(item.clues)];

      if (cap) {
        capturadas.push({
          municipio: item.municipio,
          clues: item.clues,
          unidad: item.unidad,
          capturado_por: cap.capturado_por || "",
          editado: cap.editado || "",
          fecha: cap.fecha || fechaRespuesta
        });
      } else {
        faltantes.push({
          municipio: item.municipio,
          clues: item.clues,
          unidad: item.unidad
        });
      }
    });

    capturadas.sort((a, b) =>
      String(a.municipio).localeCompare(String(b.municipio), "es") ||
      String(a.unidad).localeCompare(String(b.unidad), "es")
    );

    faltantes.sort((a, b) =>
      String(a.municipio).localeCompare(String(b.municipio), "es") ||
      String(a.unidad).localeCompare(String(b.unidad), "es")
    );

    return {
      ok:true,
      data:{
        fecha: fechaRespuesta,
        tipo,
        es_jueves: esJueves,
        total_unidades: visibles.length,
        total_capturadas: capturadas.length,
        total_faltantes: faltantes.length,
        capturadas,
        faltantes,
        mensaje
      }
    };
  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

function baseWebAppUrl_() {
  return WEB_APP_URL;
}

function makeResetToken_() {
  return Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
}

function isResetTokenExpired_(expiresValue) {
  if (!expiresValue) return true;

  let d = expiresValue;
  if (!(d instanceof Date)) {
    d = new Date(expiresValue);
  }

  if (isNaN(d.getTime())) return true;

  return d.getTime() < Date.now();
}

function getUserByResetToken_(token) {
  const sh = ensureUsersSheet_();
  const last = sh.getLastRow();
  if (last < 2) return null;

  const values = sh.getRange(2, 1, last - 1, 11).getValues();

  for (let i = 0; i < values.length; i++) {
    const r = values[i];
    const resetToken = normalize_(r[9]);
    const resetExpires = r[10];

    if (resetToken && resetToken === normalize_(token)) {
      return {
        row: i + 2,
        usuario: normalize_(r[0]),
        password: normalize_(r[1]),
        municipio: normalize_(r[2]),
        clues: normalize_(r[3]),
        unidad: normalize_(r[4]),
        rol: (normalize_(r[5]) || "UNIDAD").toUpperCase(),
        activo: (normalize_(r[6]) || "SI").toUpperCase(),
        email: normalize_(r[7]),
        must_change: normalize_(r[8]),
        reset_token: resetToken,
        reset_expires: resetExpires
      };
    }
  }

  return null;
}

function api_requestPasswordReset(payload) {
  try {
    const usuario = normalize_(payload?.usuario);
    requireNonEmpty_("Usuario", usuario);

    const u = getUser_(usuario);
    if (!u || u.activo !== "SI") {
      return { ok:false, error:"Usuario no encontrado o inactivo." };
    }

    if (!u.email) {
      return { ok:false, error:"El usuario no tiene correo registrado. Primero debe capturarlo dentro del sistema." };
    }

    const sh = ensureUsersSheet_();
    const token = makeResetToken_();
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 min

    sh.getRange(u.row, 10).setValue(token);   // reset_token
    sh.getRange(u.row, 11).setValue(expires); // reset_expires

    const url = `${baseWebAppUrl_()}?mode=reset&t=${encodeURIComponent(token)}`;

    const subject = "Recuperación de contraseña - JS1 Reportes";
    const body = `
      <p style="margin:0 0 16px 0;color:#1A1C1E;">Hola <b>${u.usuario}</b>,</p>
      <p style="margin:0 0 16px 0;color:#44474E;">Se solicitó restablecer la contraseña de tu cuenta en el sistema de reportes <b>JS1</b>.</p>
      
      <div style="margin:24px 0; text-align:center;">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:52px;v-text-anchor:middle;width:240px;" arcsize="54%" stroke="f" fillcolor="#001B3D">
          <w:anchorlock/>
          <center style="color:#ffffff;font-family:sans-serif;font-size:16px;font-weight:bold;">Restablecer contraseña</center>
        </v:roundrect>
        <![endif]-->
        <a href="${url}" style="background-color:#001B3D;border-radius:28px;color:#ffffff;display:inline-block;font-family:sans-serif;font-size:16px;font-weight:900;line-height:52px;text-align:center;text-decoration:none;width:240px;-webkit-text-size-adjust:none;mso-hide:all;box-shadow:0 12px 24px rgba(0,27,61,0.2);">
          Restablecer contraseña
        </a>
      </div>

      <div style="padding:16px;border-radius:12px;background:#F0F4F9;border:1px solid rgba(0,0,0,0.06);margin-top:20px;">
        <div style="font-size:11px;color:#44474E;font-weight:800;text-transform:uppercase;margin-bottom:8px;">O copia este enlace:</div>
        <div style="font-size:13px;word-break:break-all;color:#001B3D;">${url}</div>
      </div>
      
      <p style="margin:20px 0 0 0;font-size:13px;color:#44474E;">Este enlace expirará en <b>30 minutos</b> por seguridad. Si tú no solicitaste este cambio, puedes ignorar este mensaje.</p>
    `;

    const html = buildInstitutionalEmailShell_({
      title: "Recuperación de cuenta",
      subtitle: "Acceso seguro al sistema de reportes",
      body,
      footer: "Jurisdicción Sanitaria 1 · SESEQ · Seguridad informática"
    });

    sendEmail_(u.email, subject, html);

    return { ok:true, message:"Se envió un correo de recuperación." };
  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

function api_resetPasswordWithToken(payload) {
  try {
    const token = normalize_(payload?.token);
    const newPassword = normalize_(payload?.newPassword);
    const confirmPassword = normalize_(payload?.confirmPassword);

    requireNonEmpty_("Token", token);
    requireNonEmpty_("Nueva contraseña", newPassword);
    requireNonEmpty_("Confirmación de nueva contraseña", confirmPassword);

    if (newPassword !== confirmPassword) {
      return { ok:false, error:"La nueva contraseña y la confirmación no coinciden." };
    }

    if (newPassword.length < 6) {
      return { ok:false, error:"La nueva contraseña debe tener al menos 6 caracteres." };
    }

    const u = getUserByResetToken_(token);
    if (!u) {
      return { ok:false, error:"El enlace de recuperación no es válido." };
    }

    if (u.activo !== "SI") {
      return { ok:false, error:"La cuenta está inactiva." };
    }

    if (isResetTokenExpired_(u.reset_expires)) {
      return { ok:false, error:"El enlace de recuperación ya expiró." };
    }

    const sh = ensureUsersSheet_();

    sh.getRange(u.row, 2).setValue(hashPassword_(newPassword)); // password haseada
    sh.getRange(u.row, 9).setValue("NO");                        // must_change
    sh.getRange(u.row, 10).setValue("");                         // reset_token
    sh.getRange(u.row, 11).setValue("");                        // reset_expires

    clearUserCache_(u.usuario);

    return { ok:true, message:"Contraseña restablecida correctamente." };
  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

function sendPendingUnitReminders_() {
  const today = todayStr_();

  if (shouldSkipAutomatedAlerts_(today)) {
    Logger.log("sendPendingUnitReminders_: omitido por fin de semana o festivo MX: " + today);
    return;
  }

  const status = buildCaptureStatusForDate_(today);
  const emailMap = getUnitEmailsMap_();
  const bloque = getCurrentReminderBlock_();

  if (!status.canCaptureBio && !status.canCaptureConsumibles) {
    Logger.log("sendPendingUnitReminders_: sin ventana activa de biológico ni consumibles.");
    return;
  }

  Object.keys(status.byMunicipio).forEach(muniKey => {
    const group = status.byMunicipio[muniKey];

    group.units.forEach(unit => {
      const emails = emailMap[unit.clues] || [];
      if (!emails.length) return;

      const faltaBIO = status.canCaptureBio && !group.bio_capturadas.some(x => x.clues === unit.clues);
      const faltaCONS = status.canCaptureConsumibles && !group.cons_capturadas.some(x => x.clues === unit.clues);

      if (!faltaBIO && !faltaCONS) return;

      if (wasReminderAlreadySent_(status.fecha, bloque, unit.clues, "RECORDATORIO_UNIDAD")) {
        return;
      }

      const pendientes = [];
      if (faltaBIO) pendientes.push("Pedido de biológico");
      if (faltaCONS) pendientes.push("Consumibles");

      const subject = `Recordatorio de captura pendiente — ${unit.clues} ${unit.unidad}`;
      const appUrl = baseWebAppUrl_();

      const body = `
        <p style="margin:0 0 10px 0;font-size:14px;color:#334155;">
          Esta es una notificación automática del sistema <b>JS1 Reportes</b>.
        </p>

        <div style="margin:0 0 12px 0;">
          ${buildMetricBoxHtml_("Fecha", status.fecha, "blue")}
          ${buildMetricBoxHtml_("Pendiente", pendientes.join(" y "), "amber")}
        </div>

        <div style="border:1px solid #e5edf8;border-radius:14px;padding:14px;background:#f8fbff;margin-top:6px;">
          <div style="font-size:14px;line-height:1.6;color:#0f172a;">
            <b>Municipio:</b> ${escapeHtml_(unit.municipio)}<br>
            <b>CLUES:</b> ${escapeHtml_(unit.clues)}<br>
            <b>Unidad:</b> ${escapeHtml_(unit.unidad)}
          </div>
        </div>

        ${
          faltaBIO
            ? `
            <div style="margin-top:14px;padding:12px 14px;border-radius:14px;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;font-size:14px;font-weight:700;">
              <b>Pedido de biológico:</b> disponible del ${status.bioWindowStart} al ${status.bioWindowEnd}. Fecha programada: ${status.bioFechaProgramada}.
            </div>
            `
            : ""
        }

        ${
          faltaCONS
            ? `
            <div style="margin-top:14px;padding:12px 14px;border-radius:14px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:14px;font-weight:700;">
              <b>Consumibles:</b> la captura corresponde al día operativo ${status.consumiblesCaptureDate}.
            </div>
            `
            : ""
        }

        <div style="margin-top:16px;">
          <a href="${appUrl}" style="
            display:inline-block;
            background:#2563eb;
            color:#ffffff;
            text-decoration:none;
            padding:12px 18px;
            border-radius:12px;
            font-size:14px;
            font-weight:800;
            box-shadow:0 8px 18px rgba(37,99,235,.22);
          ">
            Abrir JS1 Reportes
          </a>
        </div>

        <div style="margin-top:10px;font-size:12px;color:#64748b;word-break:break-all;">
          Si el botón no abre directamente, copia este enlace en tu navegador:<br>
          ${appUrl}
        </div>
      `;

      const html = buildInstitutionalEmailShell_({
        title: "Recordatorio de captura",
        subtitle: "Seguimiento automático por unidad",
        body,
        footer: "Jurisdicción Sanitaria 1 · SESEQ · Recordatorio operativo"
      });

      sendEmail_(emails, subject, html);

      logReminderSent_({
        fecha: status.fecha,
        bloque,
        tipo_envio: "RECORDATORIO_UNIDAD",
        municipio: unit.municipio,
        clues: unit.clues,
        unidad: unit.unidad,
        correo: emails.join(","),
        asunto: subject
      });
    });
  });
}

function sendDailyMunicipioSummary_() {
  const today = todayStr_();

  const status = buildCaptureStatusForDate_(today);
  const bloque = getCurrentReminderBlock_();

  const consumiblesCutoffHoy = today === status.consumiblesSummaryCutoffDate;
  const debeEnviarResumen =
    consumiblesCutoffHoy ||
    status.isBioWindowCloseDate;

  if (shouldSkipAutomatedAlerts_(today) && !consumiblesCutoffHoy) {
    Logger.log("sendDailyMunicipioSummary_: omitido por fin de semana o festivo MX: " + today);
    return;
  }

  if (!debeEnviarResumen) {
    Logger.log("sendDailyMunicipioSummary_: hoy no corresponde resumen municipal.");
    return;
  }

  Object.keys(status.byMunicipio).forEach(muniKey => {
    const group = status.byMunicipio[muniKey];
    const toList = getStrictMunicipioEmails_(group.municipio);

    if (!toList || !toList.length) {
      Logger.log("Sin correo configurado para municipio: " + group.municipio);
      return;
    }

    if (wasReminderAlreadySent_(status.fecha, bloque, `MUNI_${muniKey}`, "RESUMEN_MUNICIPIO")) {
      return;
    }

    const totalUnits = group.units.length;
    const cumplimientoBIO = status.canCaptureBio || status.isBioWindowCloseDate
      ? (totalUnits ? Math.round((group.bio_capturadas.length / totalUnits) * 100) : 0)
      : null;

    const cumplimientoCONS = status.canCaptureConsumibles
      ? (totalUnits ? Math.round((group.cons_capturadas.length / totalUnits) * 100) : 0)
      : null;

    const appUrl = baseWebAppUrl_();

    const body = `
      <div style="margin-bottom:12px;">
        ${buildMetricBoxHtml_("Municipio", group.municipio, "blue")}
        ${buildMetricBoxHtml_("Total de unidades", totalUnits, "blue")}
        ${
          (status.canCaptureBio || status.isBioWindowCloseDate)
            ? buildMetricBoxHtml_("Cumplimiento biológico", `${cumplimientoBIO}%`, cumplimientoBIO >= 90 ? "green" : (cumplimientoBIO >= 70 ? "amber" : "red"))
            : ""
        }
        ${
          (today === status.consumiblesSummaryCutoffDate)
            ? buildMetricBoxHtml_("Cumplimiento consumibles", `${cumplimientoCONS}%`, cumplimientoCONS >= 90 ? "green" : (cumplimientoCONS >= 70 ? "amber" : "red"))
            : ""
        }
      </div>

      ${
        (status.canCaptureBio || status.isBioWindowCloseDate)
          ? `
          <div style="border:1px solid #dbe7f5;border-radius:16px;padding:16px;background:#ffffff;margin:12px 0;">
            <div style="font-size:18px;font-weight:800;color:#0f172a;margin-bottom:10px;">Pedido de biológico</div>
            <div style="font-size:14px;color:#475569;margin-bottom:12px;">
              <b>Fecha programada:</b> ${status.bioFechaProgramada} &nbsp;&nbsp; | &nbsp;&nbsp;
              <b>Ventana:</b> ${status.bioWindowStart} al ${status.bioWindowEnd}
            </div>
            <div style="font-size:14px;color:#475569;margin-bottom:12px;">
              <b>Capturaron:</b> ${group.bio_capturadas.length} &nbsp;&nbsp; | &nbsp;&nbsp;
              <b>No capturaron:</b> ${group.bio_faltantes.length}
            </div>

            <div style="margin-top:8px;">
              <div style="font-size:13px;font-weight:800;color:#166534;margin-bottom:8px;">Unidades que capturaron</div>
              ${renderInstitutionalUnitListHtml_(group.bio_capturadas, "Ninguna unidad capturó pedido de biológico.", true)}
            </div>

            <div style="margin-top:16px;">
              <div style="font-size:13px;font-weight:800;color:#b45309;margin-bottom:8px;">Unidades pendientes</div>
              ${renderInstitutionalUnitListHtml_(group.bio_faltantes, "No hay pendientes de pedido de biológico.", false)}
            </div>
          </div>
          `
          : ""
      }

      ${
        (today === status.consumiblesSummaryCutoffDate)
          ? `
          <div style="border:1px solid #dbe7f5;border-radius:16px;padding:16px;background:#ffffff;margin:12px 0;">
            <div style="font-size:18px;font-weight:800;color:#0f172a;margin-bottom:10px;">Consumibles</div>
            <div style="font-size:14px;color:#475569;margin-bottom:12px;">
              <b>Rango considerado:</b> ${status.consumiblesRangeStart}${status.consumiblesRangeStart !== status.consumiblesRangeEnd ? ` al ${status.consumiblesRangeEnd}` : ""}<br>
              <b>Capturaron:</b> ${group.cons_capturadas.length} &nbsp;&nbsp; | &nbsp;&nbsp;
              <b>No capturaron:</b> ${group.cons_faltantes.length}
            </div>

            <div style="margin-top:8px;">
              <div style="font-size:13px;font-weight:800;color:#166534;margin-bottom:8px;">Unidades que capturaron</div>
              ${renderInstitutionalUnitListHtml_(group.cons_capturadas, "Ninguna unidad capturó consumibles.", true)}
            </div>

            <div style="margin-top:16px;">
              <div style="font-size:13px;font-weight:800;color:#b45309;margin-bottom:8px;">Unidades pendientes</div>
              ${renderInstitutionalUnitListHtml_(group.cons_faltantes, "No hay pendientes de consumibles.", false)}
            </div>
          </div>
          `
          : ""
      }

      <div style="margin-top:18px;">
        <a href="${appUrl}" style="
          display:inline-block;
          background:#0e3f86;
          color:#ffffff;
          text-decoration:none;
          padding:12px 18px;
          border-radius:12px;
          font-size:14px;
          font-weight:800;
          box-shadow:0 8px 18px rgba(14,63,134,.24);
        ">
          Entrar a la plataforma
        </a>
      </div>

      <div style="margin-top:10px;font-size:12px;color:#64748b;word-break:break-all;">
        Enlace directo de la plataforma:<br>
        ${appUrl}
      </div>
    `;

    let motivoResumen = "";
    if ((today === status.consumiblesSummaryCutoffDate) && status.isBioWindowCloseDate) {
      motivoResumen = "Consumibles + cierre de ventana de pedido biológico";
    } else if (today === status.consumiblesSummaryCutoffDate) {
      motivoResumen = "Cierre operativo de consumibles";
    } else if (status.isBioWindowCloseDate) {
      motivoResumen = "Cierre de ventana de pedido biológico";
    }

    const subject = `Resumen de captura — ${group.municipio} — ${status.fecha}`;
    const html = buildInstitutionalEmailShell_({
      title: "Resumen de captura",
      subtitle: `${motivoResumen} · ${group.municipio}`,
      body,
      footer: "Jurisdicción Sanitaria 1 · SESEQ · Resumen operativo"
    });

    sendEmail_(toList, subject, html);

    logReminderSent_({
      fecha: status.fecha,
      bloque,
      tipo_envio: "RESUMEN_MUNICIPIO",
      municipio: group.municipio,
      clues: `MUNI_${muniKey}`,
      unidad: "RESUMEN MUNICIPAL",
      correo: toList.join(","),
      asunto: subject
    });
  });
}

function installReportMailTriggers_() {
  const functionsToReset = [
    "sendPendingUnitReminders_",
    "sendDailyMunicipioSummary_"
  ];

  const triggers = ScriptApp.getProjectTriggers();

  triggers.forEach(t => {
    const fn = t.getHandlerFunction();
    if (functionsToReset.includes(fn)) {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Recordatorio 12:00 p.m.
  ScriptApp.newTrigger("sendPendingUnitReminders_")
    .timeBased()
    .everyDays(1)
    .atHour(12)
    .nearMinute(0)
    .create();

  // Recordatorio 2:30 p.m.
  ScriptApp.newTrigger("sendPendingUnitReminders_")
    .timeBased()
    .everyDays(1)
    .atHour(14)
    .nearMinute(30)
    .create();

  // Resumen 11:59 p.m.
  ScriptApp.newTrigger("sendDailyMunicipioSummary_")
    .timeBased()
    .everyDays(1)
    .atHour(23)
    .nearMinute(59)
    .create();
}

function getMonthRangeKeys_(fromYmd, toYmd) {
  const out = [];
  const seen = {};

  let cursor = parseYmdAsMxDate_(fromYmd);
  const end = parseYmdAsMxDate_(toYmd);

  if (!cursor || !end) return out;

  cursor = new Date(cursor.getFullYear(), cursor.getMonth(), 1);

  while (cursor <= end) {
    const key = Utilities.formatDate(cursor, tz_(), "yyyy-MM");
    if (!seen[key]) {
      seen[key] = true;
      out.push(key);
    }
    cursor.setMonth(cursor.getMonth() + 1, 1);
  }

  return out;
}

function getOperationalPeriodsInRange_(fromYmd, toYmd) {
  const consExpectedDates = getDateRangeDays_(fromYmd, toYmd).filter(d => isValidConsumiblesDate_(d));

  const bioPeriods = [];
  const monthKeys = getMonthRangeKeys_(fromYmd, toYmd);
  const seenBio = {};

  monthKeys.forEach(ym => {
    const baseDate = new Date(`${ym}-01T00:00:00`);
    const win = getBioCaptureWindow_(baseDate);

    const fechaPedidoProgramada = normalizeDateKey_(win.fechaPedidoProgramada);
    const habilitarHasta = normalizeDateKey_(win.habilitarHasta);

    if (!fechaPedidoProgramada || !habilitarHasta) return;
    if (habilitarHasta < fromYmd || habilitarHasta > toYmd) return;
    if (seenBio[fechaPedidoProgramada]) return;

    seenBio[fechaPedidoProgramada] = true;
    bioPeriods.push({
      fechaPedidoProgramada,
      habilitarHasta
    });
  });

  return {
    consExpectedDates,
    bioPeriods
  };
}

function getDateRangeDays_(fromYmd, toYmd) {
  const out = [];
  const start = new Date(fromYmd + "T00:00:00");
  const end = new Date(toYmd + "T00:00:00");

  while (start <= end) {
    out.push(Utilities.formatDate(start, tz_(), "yyyy-MM-dd"));
    start.setDate(start.getDate() + 1);
  }
  return out;
}

function getThursdayCountInRange_(fromYmd, toYmd) {
  return getDateRangeDays_(fromYmd, toYmd).filter(d => getDayOfWeekFromStr_(d) === 4).length;
}

function getHistoryMetricsByVisibleUnits_(user, fromYmd, toYmd) {
  const units = getVisibleUnits_(user);
  const consSh = getSheet_(SHEET_CONS);
  const bioSh = ensureBioCaptureSheet_();

  Logger.log("Unidades visibles para métricas: " + units.length);

  const consLast = consSh.getLastRow();
  const bioLast = bioSh.getLastRow();

  const consData = consLast >= 2 ? consSh.getRange(2, 1, consLast - 1, 15).getValues() : [];
  const bioData = bioLast >= 2 ? bioSh.getRange(2, 1, bioLast - 1, 19).getValues() : [];

  const periods = getOperationalPeriodsInRange_(fromYmd, toYmd);
  const consExpectedDates = periods.consExpectedDates || [];
  const bioPeriods = periods.bioPeriods || [];

  const consExpectedSet = {};
  consExpectedDates.forEach(d => {
    consExpectedSet[d] = true;
  });

  const bioExpectedSet = {};
  bioPeriods.forEach(p => {
    bioExpectedSet[p.fechaPedidoProgramada] = true;
  });

  const consMap = {};
  const bioMap = {};
  const lastCONSMap = {};
  const lastBIOMap = {};

  consData.forEach(r => {
    const fecha = normalizeDateKey_(r[2]);
    const clues = normalizeClues_(r[4]);

    if (!fecha || !clues) return;
    if (!consExpectedSet[fecha]) return;

    consMap[`${clues}||${fecha}`] = true;

    if (!lastCONSMap[clues] || fecha > lastCONSMap[clues]) {
      lastCONSMap[clues] = fecha;
    }
  });

  bioData.forEach(r => {
    const fechaPedido = normalizeDateKey_(r[3]);
    const clues = normalizeClues_(r[5]);
    const biologico = normalize_(r[7]);

    if (!fechaPedido || !clues || !biologico) return;
    if (!bioExpectedSet[fechaPedido]) return;

    bioMap[`${clues}||${fechaPedido}`] = true;

    if (!lastBIOMap[clues] || fechaPedido > lastBIOMap[clues]) {
      lastBIOMap[clues] = fechaPedido;
    }
  });

  Logger.log("Rows métricas calculadas: " + units.length);

  return units.map(u => {
    let consCapturas = 0;
    let bioCapturas = 0;

    for (let i = 0; i < consExpectedDates.length; i++) {
      const d = consExpectedDates[i];
      if (consMap[`${u.clues}||${d}`]) consCapturas++;
    }

    for (let i = 0; i < bioPeriods.length; i++) {
      const p = bioPeriods[i];
      if (bioMap[`${u.clues}||${p.fechaPedidoProgramada}`]) bioCapturas++;
    }

    const consEsperados = consExpectedDates.length;
    const bioEsperados = bioPeriods.length;

    const consFaltas = Math.max(0, consEsperados - consCapturas);
    const bioFaltas = Math.max(0, bioEsperados - bioCapturas);

    const consPct = consEsperados ? Math.round((consCapturas / consEsperados) * 100) : 0;
    const bioPct = bioEsperados ? Math.round((bioCapturas / bioEsperados) * 100) : 0;

    const totalEsperado = consEsperados + bioEsperados;
    const totalCapturado = consCapturas + bioCapturas;
    const totalFaltas = Math.max(0, totalEsperado - totalCapturado);
    const cumplimientoOperativo = totalEsperado ? Math.round((totalCapturado / totalEsperado) * 100) : 0;

    return {
      municipio: fixUtf8Text_(u.municipio),
      clues: u.clues,
      unidad: u.unidad,

      bio_capturas: bioCapturas,
      bio_faltas: bioFaltas,
      bio_cumplimiento: bioPct,

      cons_capturas: consCapturas,
      cons_faltas: consFaltas,
      cons_cumplimiento: consPct,

      total_esperado: totalEsperado,
      total_capturado: totalCapturado,
      total_faltas: totalFaltas,
      cumplimiento_operativo: cumplimientoOperativo,

      ultima_bio: lastBIOMap[u.clues] || "",
      ultima_cons: lastCONSMap[u.clues] || ""
    };
  }).sort((a, b) =>
    b.cumplimiento_operativo - a.cumplimiento_operativo ||
    b.bio_cumplimiento - a.bio_cumplimiento ||
    b.cons_cumplimiento - a.cons_cumplimiento ||
    String(a.municipio).localeCompare(String(b.municipio), "es") ||
    String(a.unidad).localeCompare(String(b.unidad), "es")
  );
}

function api_getTodayReports(payload) {
  try {
    const u = authOrThrow_(payload?.token);

    if (u.rol !== "UNIDAD") {
      return {
        ok: true,
        data: {
          sr: null,
          cons: null
        }
      };
    }

    const fecha = normalizeDateKey_(payload?.fecha || todayStr_());

    // ===== EXISTENCIA DE BIOLÓGICOS =====
    const shSR = getSheet_(SHEET_SR_EXISTENCIA);
    ensureHeader_(shSR, [
      "id","timestamp","fecha","municipio","clues","unidad",
      "bcg","hepatitis_b","hexavalente","dpt","rotavirus",
      "neumococica_13","neumococica_20","srp","sr","vph",
      "varicela","hepatitis_a","td","tdpa","covid_19","influenza","vsr",
      "capturado_por","editado","editado_por","editado_ts"
    ]);

    let srData = null;
    const rowSR = findRowByFechaClues_(shSR, fecha, u.clues);
    if (rowSR) {
      const r = shSR.getRange(rowSR, 1, 1, 27).getValues()[0];
      srData = {
        id: normalize_(r[0]),
        timestamp: r[1] instanceof Date
          ? Utilities.formatDate(r[1], tz_(), "yyyy-MM-dd HH:mm:ss")
          : normalize_(r[1]),
        fecha: normalizeDateKey_(r[2]),
        municipio: fixUtf8Text_(normalize_(r[3])),
        clues: normalize_(r[4]),
        unidad: normalize_(r[5]),
        bcg: Number(r[6] || 0),
        hepatitis_b: Number(r[7] || 0),
        hexavalente: Number(r[8] || 0),
        dpt: Number(r[9] || 0),
        rotavirus: Number(r[10] || 0),
        neumococica_13: Number(r[11] || 0),
        neumococica_20: Number(r[12] || 0),
        srp: Number(r[13] || 0),
        sr: Number(r[14] || 0),
        vph: Number(r[15] || 0),
        varicela: Number(r[16] || 0),
        hepatitis_a: Number(r[17] || 0),
        td: Number(r[18] || 0),
        tdpa: Number(r[19] || 0),
        covid_19: Number(r[20] || 0),
        influenza: Number(r[21] || 0),
        vsr: Number(r[22] || 0),
        capturado_por: normalize_(r[23]),
        nombre_responsable: normalize_(r[23]),
        editado: (normalize_(r[24]) || "").toUpperCase(),
        editado_por: normalize_(r[25]),
        editado_ts: r[26] instanceof Date
          ? Utilities.formatDate(r[26], tz_(), "yyyy-MM-dd HH:mm:ss")
          : normalize_(r[26]),
        items: [] // Detalle por lotes
      };

      // FECTH DETALLE
      const shDet = ensureExistenciaDetalleSheet_();
      const lastDet = shDet.getLastRow();
      if (lastDet >= 2) {
        const detData = shDet.getRange(2, 1, lastDet - 1, 10).getValues();
        const fKey = normalizeDateKey_(fecha);
        const cKey = normalizeClues_(u.clues);
        srData.items = detData
          .filter(row => normalizeDateKey_(row[0]) === fKey && normalizeClues_(row[1]) === cKey)
          .map(row => ({
            biologico: normalize_(row[4]),
            lote: normalize_(row[5]),
            caducidad: normalize_(row[6]),
            fecha_recepcion: normalize_(row[7]),
            cantidad: Number(row[8] || 0)
          }));
      }
    }

    // ===== CONSUMIBLES =====
    const shCONS = getSheet_(SHEET_CONS);
    ensureHeader_(shCONS, [
      "id","timestamp","fecha","municipio","clues","unidad",
      "srp_dosis","sr_dosis",
      "jeringa_reconst_5ml_0605500438",
      "jeringa_aplic_05ml_0605502657",
      "aguja_0600403711",
      "capturado_por","editado","editado_por","editado_ts"
    ]);

let consData = null;

const rangoCons = getConsumiblesOperationalRange_(fecha);

const rowCONS = findRowByFechaCluesInRange_(
  shCONS,
  rangoCons.fechaInicio,
  rangoCons.fechaFin,
  u.clues
);

if (rowCONS) {
      const r = shCONS.getRange(rowCONS, 1, 1, 15).getValues()[0];
      consData = {
        id: normalize_(r[0]),
        timestamp: r[1] instanceof Date
          ? Utilities.formatDate(r[1], tz_(), "yyyy-MM-dd HH:mm:ss")
          : normalize_(r[1]),
        fecha: normalizeDateKey_(r[2]),
        municipio: fixUtf8Text_(normalize_(r[3])),
        clues: normalize_(r[4]),
        unidad: normalize_(r[5]),
        srp_dosis: Number(r[6] || 0),
        sr_dosis: Number(r[7] || 0),
        jeringa_reconst_5ml_0605500438: Number(r[8] || 0),
        jeringa_aplic_05ml_0605502657: Number(r[9] || 0),
        aguja_0600403711: Number(r[10] || 0),
        capturado_por: normalize_(r[11]),
        editado: (normalize_(r[12]) || "").toUpperCase(),
        editado_por: normalize_(r[13]),
        editado_ts: r[14] instanceof Date
          ? Utilities.formatDate(r[14], tz_(), "yyyy-MM-dd HH:mm:ss")
          : normalize_(r[14])
      };
    }

    return {
      ok: true,
      data: {
        fecha,
        sr: srData,
        cons: consData
      }
    };

  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

function api_historyMetrics(payload) {
  try {
    const u = authOrThrow_(payload?.token);

    if (u.rol !== "ADMIN" && u.rol !== "MUNICIPAL" && u.rol !== "JURISDICCIONAL") {
      return { ok:false, error:"Sin permisos para consultar métricas históricas." };
    }


    const toYmd = normalizeDateKey_(payload?.fechaFin || todayStr_());
    const fromYmd = normalizeDateKey_(payload?.fechaInicio || toYmd);

    if (!fromYmd || !toYmd) {
      return { ok:false, error:"Fechas inválidas." };
    }

    if (fromYmd > toYmd) {
      return { ok:false, error:"La fecha inicial no puede ser mayor que la final." };
    }

    Logger.log("api_historyMetrics INICIO");
    Logger.log("fechaInicio: " + fromYmd);
    Logger.log("fechaFin: " + toYmd);
    Logger.log("usuario: " + u.usuario);

    const rows = getHistoryMetricsByVisibleUnits_(u, fromYmd, toYmd);

    Logger.log("rows metrics: " + rows.length);

    return {
      ok:true,
      data:{
        fechaInicio: fromYmd,
        fechaFin: toYmd,
        rows
      }
    };
  } catch (e) {
    Logger.log("ERROR api_historyMetrics: " + String(e && e.stack ? e.stack : e));
    return { ok:false, error:String(e.message || e) };
  }
}

function api_unitCatalog(payload) {
  try {
    const u = authOrThrow_(payload?.token);

    if (u.rol !== "ADMIN" && u.rol !== "MUNICIPAL" && u.rol !== "JURISDICCIONAL") {
      return { ok:false, error:"Sin permisos para consultar catálogo de unidades." };
    }


    const sh = getSheet_(SHEET_UNIDADES);
    const last = sh.getLastRow();
    if (last < 2) return { ok:true, data: [] };

    const data = sh.getRange(2, 1, last - 1, 5).getValues();
    const out = [];
    const seen = {};

    for (let i = 0; i < data.length; i++) {
      const r = data[i];

      const municipio = fixUtf8Text_(normalize_(r[0]));
      const clues = normalizeClues_(r[1]);
      const unidad = normalize_(r[2]);
      const activo = (normalize_(r[3]) || "SI").toUpperCase();
      const orden_clues = Number(r[4] || 9999);

      if (!municipio || !clues || !unidad) continue;
      if (activo !== "SI") continue;
      if (!canSeeMunicipio_(u, municipio)) continue;

      const key = clues + "||" + normalizeTextKey_(unidad);
      if (seen[key]) continue;
      seen[key] = true;

      out.push({
        municipio,
        clues,
        unidad,
        orden_clues
      });
    }

    out.sort((a, b) =>
      String(a.municipio).localeCompare(String(b.municipio), "es") ||
      Number(a.orden_clues) - Number(b.orden_clues) ||
      String(a.unidad).localeCompare(String(b.unidad), "es")
    );

    return { ok:true, data: out };
  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

function api_notificationUserCatalog(payload) {
  try {
    const u = authOrThrow_(payload?.token);

    if (u.rol !== "ADMIN" && u.rol !== "MUNICIPAL" && u.rol !== "JURISDICCIONAL") {
      return { ok:false, error:"Sin permisos para consultar usuarios." };
    }


    const sh = ensureUsersSheet_();
    const last = sh.getLastRow();
    if (last < 2) return { ok:true, data: [] };

    const data = sh.getRange(2, 1, last - 1, 11).getValues();
    const out = [];
    const seen = {};

    for (let i = 0; i < data.length; i++) {
      const r = data[i];

      const usuario = normalize_(r[0]);
      const municipio = fixUtf8Text_(normalize_(r[2]));
      const clues = normalizeClues_(r[3]);
      const unidad = normalize_(r[4]);
      const rol = (normalize_(r[5]) || "UNIDAD").toUpperCase();
      const activo = (normalize_(r[6]) || "SI").toUpperCase();

      if (!usuario) continue;
      if (activo !== "SI") continue;

      if (rol === "ADMIN") {
        if (u.rol !== "ADMIN") continue;
      } else {
        if (!municipio) continue;
        if (!canSeeMunicipio_(u, municipio)) continue;
      }

      const key = `${usuario}||${rol}||${municipio}||${clues}`;
      if (seen[key]) continue;
      seen[key] = true;

      out.push({
        usuario,
        municipio,
        clues,
        unidad,
        rol
      });
    }

    out.sort((a, b) =>
      String(a.municipio || "").localeCompare(String(b.municipio || ""), "es") ||
      String(a.rol || "").localeCompare(String(b.rol || ""), "es") ||
      String(a.unidad || "").localeCompare(String(b.unidad || ""), "es") ||
      String(a.usuario || "").localeCompare(String(b.usuario || ""), "es")
    );

    return { ok:true, data: out };
  } catch (e) {
    return { ok:false, error:String(e.message || e) };
  }
}

// CÓDIGO.gs

function doPost(e) {
  // 1. Recibir los datos enviados desde Vercel
  const payloadData = JSON.parse(e.postData.contents);
  
  // 2. Mandar los datos a tu función api() central
  const resultado = api(payloadData);
  
  // 3. Devolver la respuesta a Vercel en formato JSON
  return ContentService.createTextOutput(JSON.stringify(resultado))
    .setMimeType(ContentService.MimeType.JSON);
}
