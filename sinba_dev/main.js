// Initialize Supabase Client
const SUPABASE_URL = "https://utclfqjietlxzlorxhrs.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Y2xmcWppZXRseHpsb3J4aHJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTYyNTQsImV4cCI6MjA5MTkzMjI1NH0.EgDK7xkSZHZyUlGF5m2C7bZjrfkx1M8cBXzxIFedDa4";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let cellValues = {}; // Global state mapping "Sheet!Cell" -> value
let lotesCatalog = [];
let databaseUnits = []; // Loaded from units database table
let activeTab = "SINBA-SIS-06-P";
let templateBuffer = null; // Buffer storing original template Excel file

// DOM Elements
const selectMuni = document.getElementById("selectMuni");
const selectUnidad = document.getElementById("selectUnidad");
const inputCLUE = document.getElementById("inputCLUE");
const inputJurisdiccion = document.getElementById("inputJurisdiccion");
const selectMes = document.getElementById("selectMes");
const selectAnio = document.getElementById("selectAnio");
const inputResponsable = document.getElementById("inputResponsable");
const gridWrapper = document.getElementById("gridWrapper");
const validationList = document.getElementById("validationList");
const btnExport = document.getElementById("btnExport");
const loadingOverlay = document.getElementById("loadingOverlay");
const loadingText = document.getElementById("loadingText");
const templateStatus = document.getElementById("templateStatus");
const inputTemplateFile = document.getElementById("inputTemplateFile");

// Map rows in MOV-DE-BIOLÓGICO to database catalog biological names
const rowToBiologicalMap = {
  // Anverso
  13: "BCG", 14: "BCG", 15: "BCG", 16: "BCG", 17: "BCG",
  19: "HEPATITIS B", 20: "HEPATITIS B", 21: "HEPATITIS B", 22: "HEPATITIS B", 23: "HEPATITIS B",
  25: "HEXAVALENTE", 26: "HEXAVALENTE", 27: "HEXAVALENTE", 28: "HEXAVALENTE", 29: "HEXAVALENTE",
  31: "DPT", 32: "DPT", 33: "DPT", 34: "DPT", 35: "DPT",
  37: "ROTAVIRUS", 38: "ROTAVIRUS", 39: "ROTAVIRUS", 40: "ROTAVIRUS", 41: "ROTAVIRUS",
  43: "NEUMOCOCCICA 13", 44: "NEUMOCOCCICA 13", 45: "NEUMOCOCCICA 13", 46: "NEUMOCOCCICA 13", 47: "NEUMOCOCCICA 13",
  49: "NEUMOCOCCICA 20", 50: "NEUMOCOCCICA 20", 51: "NEUMOCOCCICA 20", 52: "NEUMOCOCCICA 20", 53: "NEUMOCOCCICA 20",
  55: "SRP", 56: "SRP", 57: "SRP", 58: "SRP", 59: "SRP",
  61: "INFLUENZA", 62: "INFLUENZA", 63: "INFLUENZA", 64: "INFLUENZA", 65: "INFLUENZA",
  // Reverso
  79: "SR", 80: "SR", 81: "SR", 82: "SR", 83: "SR",
  85: "VPH", 86: "VPH", 87: "VPH", 88: "VPH", 89: "VPH",
  91: "TD", 92: "TD", 93: "TD", 94: "TD", 95: "TD",
  97: "TDPA", 98: "TDPA", 99: "TDPA", 100: "TDPA", 101: "TDPA",
  103: "COVID-19", 104: "COVID-19", 105: "COVID-19",
  106: "COVID-19", 107: "COVID-19", 108: "COVID-19", 109: "COVID-19", 110: "COVID-19",
  112: "VARICELA", 113: "VARICELA", 114: "VARICELA", 115: "VARICELA", 116: "VARICELA",
  118: "HEPATITIS A", 119: "HEPATITIS A", 120: "HEPATITIS A", 121: "HEPATITIS A", 122: "HEPATITIS A",
  124: "VSR", 125: "VSR", 126: "VSR", 127: "VSR", 128: "VSR"
};

// Hardcoded formulas that we extracted from Excel to calculate final stocks and totals
const dynamicFormulas = {
  "MOV-DE-BIOLÓGICO": {}
};

// Initialize dynamic formulas for rows 13 to 128 in MOV-DE-BIOLÓGICO
for (let r = 13; r <= 128; r++) {
  if ([18, 24, 30, 36, 42, 48, 54, 60, 66, 84, 90, 96, 102, 111, 117, 123].includes(r)) {
    continue;
  }
  
  let factor = 1; 
  let applyCol = "H";
  let wasteCol = "K";
  
  // Refined factors according to exact spreadsheet math:
  if ([13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 31, 32, 33, 34, 35, 61, 62, 63, 64, 65, 79, 80, 81, 82, 83, 91, 92, 93, 94, 95].includes(r)) {
    factor = 10;
  } else if ([103, 104, 105].includes(r)) {
    factor = 5; // COVID Moderna (factor 5)
  } else if ([106, 107, 108, 109, 110].includes(r)) {
    factor = 6; // COVID Pfizer (factor 6)
  }
  
  // Row 19-23 and 103-108 use J and M columns in Excel for applied/wasted doses total
  if ([19, 20, 21, 22, 23, 103, 104, 105].includes(r)) {
    applyCol = "J";
    wasteCol = "M";
  }
  
  dynamicFormulas["MOV-DE-BIOLÓGICO"][`N${r}`] = {
    factor,
    applyCol,
    wasteCol,
    run: function(rNum) {
      const prev = parseFloat(cellValues[`MOV-DE-BIOLÓGICO!B${rNum}`] || 0);
      const rec = parseFloat(cellValues[`MOV-DE-BIOLÓGICO!E${rNum}`] || 0);
      let app = 0;
      let waste = 0;
      
      if (rNum in [19, 20, 21, 22, 23, 103, 104, 105]) {
        // Double dose inputs: total is already calculated in column J/M!
        app = parseFloat(cellValues[`MOV-DE-BIOLÓGICO!${applyCol}${rNum}`] || 0);
        waste = parseFloat(cellValues[`MOV-DE-BIOLÓGICO!${wasteCol}${rNum}`] || 0);
      } else {
        app = parseFloat(cellValues[`MOV-DE-BIOLÓGICO!${applyCol}${rNum}`] || 0);
        waste = parseFloat(cellValues[`MOV-DE-BIOLÓGICO!${wasteCol}${rNum}`] || 0);
      }
      
      const val = (((prev + rec) * factor) - (app + waste)) / factor;
      return val === 0 ? "" : val.toFixed(1).replace(".0", "");
    }
  };
}

// App Initialization
async function init() {
  try {
    showLoading("Conectando con Supabase y descargando catálogos de unidades...");
    
    // 1. Fetch real health units and municipalities from database units table
    const { data: units, error: errUnits } = await supabaseClient
      .from('unidades')
      .select('clues, unidad, municipio')
      .eq('activo', 'SI')
      .order('municipio')
      .order('unidad');
      
    if (errUnits) {
      console.error("Failed to load units from database:", errUnits);
      alert("Error al conectar con la base de datos de unidades.");
      return;
    }
    
    databaseUnits = units || [];
    console.log(`Loaded ${databaseUnits.length} units from database.`);
    
    // Extract unique municipalities
    const uniqueMunis = [...new Set(databaseUnits.map(u => u.municipio).filter(Boolean))].sort();
    uniqueMunis.forEach(muni => {
      const opt = document.createElement("option");
      opt.value = muni;
      opt.textContent = muni;
      selectMuni.appendChild(opt);
    });
    
    // 2. Fetch vaccine lots from Supabase lotes table
    const { data: lotes, error: errLotes } = await supabaseClient.from('lotes').select('biologico, lote, caducidad');
    if (errLotes) {
      console.warn("Error loading lots from database:", errLotes);
    } else {
      lotesCatalog = lotes || [];
      console.log(`Loaded ${lotesCatalog.length} vaccine lots from Supabase.`);
    }
    
    // 3. Try to fetch the Excel template dynamically
    tryTemplateFetch();
    
    // 4. Setup event listeners
    setupEventListeners();
    
    // Render initial grid
    switchTab("SINBA-SIS-06-P");
    
    hideLoading();
  } catch (err) {
    console.error("Initialization failed:", err);
    hideLoading();
  }
}

// Try to fetch the Excel template dynamically (works if served via server)
async function tryTemplateFetch() {
  if (window.location.protocol === "file:") {
    console.log("Running on file:// protocol. Skipping auto-fetch to prevent CORS warnings.");
    setTemplateStatus(false);
    return;
  }
  try {
    const response = await fetch("../SINBA-VER_26_2026 - copia.xlsx");
    if (response.ok) {
      templateBuffer = await response.arrayBuffer();
      setTemplateStatus(true, "Auto");
    } else {
      setTemplateStatus(false);
    }
  } catch (err) {
    setTemplateStatus(false);
  }
}

// Set Template load status visually
function setTemplateStatus(loaded, method = "Manual") {
  if (loaded) {
    templateStatus.textContent = `Plantilla: Lista (${method})`;
    templateStatus.className = "status-pill success";
  } else {
    templateStatus.textContent = "Plantilla: Cargar Archivo 📁";
    templateStatus.className = "status-pill danger";
  }
}

// Show/Hide Loading
function showLoading(text) {
  loadingText.textContent = text;
  loadingOverlay.style.display = "flex";
}

function hideLoading() {
  loadingOverlay.style.display = "none";
}

// Helper to format date input to MMM-YY (e.g. 1-2-26 -> FEB-26)
function formatToMmmAa(dateStr) {
  if (!dateStr || dateStr.trim() === "") return "";
  const cleaned = dateStr.trim().toUpperCase();
  if (/^[A-Z]{3}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }
  
  const parts = cleaned.split(/[-/.]/);
  let day, month, year;
  
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      year = parseInt(parts[0]);
      month = parseInt(parts[1]);
      day = parseInt(parts[2]);
    } else {
      // D-M-YY or DD-MM-YYYY
      day = parseInt(parts[0]);
      month = parseInt(parts[1]);
      year = parseInt(parts[2]);
      if (year < 100) {
        year += 2000;
      }
    }
  } else {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    day = d.getDate();
    month = d.getMonth() + 1;
    year = d.getFullYear();
  }
  
  const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  if (month < 1 || month > 12) return dateStr;
  
  const mStr = months[month - 1];
  const yStr = String(year).slice(-2);
  return `${mStr}-${yStr}`;
}

// Event Listeners Configuration
function setupEventListeners() {
  // Tabs click handler
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      switchTab(btn.dataset.tab);
    });
  });
  
  // Municipality selection filters units list
  selectMuni.addEventListener("change", () => {
    const muni = selectMuni.value;
    selectUnidad.innerHTML = '<option value="">Selecciona Unidad...</option>';
    selectUnidad.disabled = !muni;
    
    if (muni) {
      const filtered = databaseUnits.filter(u => u.municipio === muni);
      filtered.forEach(u => {
        const opt = document.createElement("option");
        opt.value = u.unidad;
        opt.textContent = u.unidad;
        opt.dataset.clue = u.clues;
        selectUnidad.appendChild(opt);
      });
    }
    
    inputCLUE.value = "";
    inputJurisdiccion.value = "";
    syncMetadataHeaders();
  });
  
  // Unit selection auto-fills clues and jurisdiction
  selectUnidad.addEventListener("change", () => {
    const opt = selectUnidad.selectedOptions[0];
    if (opt && opt.value) {
      inputCLUE.value = opt.dataset.clue;
      inputJurisdiccion.value = "JURISDICCIÓN SANITARIA 1, QUERÉTARO"; // Default
    } else {
      inputCLUE.value = "";
      inputJurisdiccion.value = "";
    }
    syncMetadataHeaders();
  });
  
  // Update header text boxes when month, year, or responsible edits
  selectMes.addEventListener("change", syncMetadataHeaders);
  selectAnio.addEventListener("change", syncMetadataHeaders);
  inputResponsable.addEventListener("input", syncMetadataHeaders);
  
  // Dynamic spreadsheet inputs listener (Delegated)
  gridWrapper.addEventListener("input", handleGridInput);
  gridWrapper.addEventListener("focusin", handleGridFocusIn);
  gridWrapper.addEventListener("focusout", handleGridFocusOut);
  
  // Template loader button click
  templateStatus.addEventListener("click", () => {
    inputTemplateFile.click();
  });
  
  // Template file selector listener
  inputTemplateFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    showLoading("Cargando plantilla...");
    const reader = new FileReader();
    reader.onload = function(evt) {
      templateBuffer = evt.target.result;
      setTemplateStatus(true, "Manual");
      hideLoading();
    };
    reader.onerror = function() {
      alert("Error al cargar la plantilla.");
      hideLoading();
    };
    reader.readAsArrayBuffer(file);
  });
  
  // Export button
  btnExport.addEventListener("click", exportWorkbook);
}

// Switching active sheet grid
function switchTab(tabName) {
  activeTab = tabName;
  gridWrapper.innerHTML = GRIDS_TEMPLATES[tabName] || '<p style="padding: 20px;">No template found.</p>';
  restoreGridValues(tabName);
  recalculateSheetTotals(tabName);
}

// Restore saved cell values from global state into inputs/cells
function restoreGridValues(sheetName) {
  const table = gridWrapper.querySelector(`.excel-table[data-sheet="${sheetName}"]`);
  if (!table) return;
  
  table.querySelectorAll(".excel-input").forEach(input => {
    const r = input.dataset.r;
    const c = input.dataset.c;
    const cellLetter = XLSX.utils.encode_col(c - 1);
    const key = `${sheetName}!${cellLetter}${r}`;
    
    if (cellValues[key] !== undefined) {
      input.value = cellValues[key];
    }
  });
  
  table.querySelectorAll("td[data-sheet]").forEach(td => {
    const r = td.dataset.r;
    const c = td.dataset.c;
    const cellLetter = XLSX.utils.encode_col(c - 1);
    const key = `${sheetName}!${cellLetter}${r}`;
    
    if (cellValues[key] !== undefined) {
      td.textContent = cellValues[key];
    }
  });
}

// Sync metadata controls to corresponding Excel grid cells
function syncMetadataHeaders() {
  const muni = selectMuni.value || "";
  const unitName = selectUnidad.value || "";
  const clue = inputCLUE.value || "";
  const juris = inputJurisdiccion.value || "";
  const mes = selectMes.value || "";
  const anio = selectAnio.value || "";
  const resp = inputResponsable.value || "";
  
  // Map values to Excel cell keys across all sheets
  cellValues["SINBA-SIS-06-P!A6"] = unitName;
  cellValues["SINBA-SIS-06-P!B6"] = clue;
  cellValues["SINBA-SIS-06-P!D6"] = juris;
  cellValues["SINBA-SIS-06-P!H6"] = muni;
  cellValues["SINBA-SIS-06-P!L6"] = resp;
  cellValues["SINBA-SIS-06-P!W3"] = mes;
  cellValues["SINBA-SIS-06-P!V3"] = anio;
  
  cellValues["MOV-DE-BIOLÓGICO!N5"] = mes;
  cellValues["MOV-DE-BIOLÓGICO!N7"] = unitName;
  cellValues["MOV-DE-BIOLÓGICO!D8"] = resp;
  cellValues["MOV-DE-BIOLÓGICO!I7"] = anio;
  
  cellValues["SIS-SS-CE-H-2026!F3"] = unitName;
  cellValues["SIS-SS-CE-H-2026!Y3"] = clue;
  cellValues["SIS-SS-CE-H-2026!K4"] = resp;
  cellValues["SIS-SS-CE-H-2026!Y4"] = mes;
  cellValues["SIS-SS-CE-H-2026!AG4"] = anio;
  
  cellValues["SIS-SS-IE Mensual!J6"] = resp;
  cellValues["SIS-SS-IE Mensual!J7"] = unitName;
  cellValues["SIS-SS-IE Mensual!J8"] = mes;
  
  const visibleTable = gridWrapper.querySelector(".excel-table");
  if (visibleTable) {
    restoreGridValues(activeTab);
  }
}

// Grid Input Handler
function handleGridInput(e) {
  const input = e.target;
  if (!input.classList.contains("excel-input")) return;
  
  const r = input.dataset.r;
  const c = input.dataset.c;
  const sheet = input.dataset.sheet;
  const cellLetter = XLSX.utils.encode_col(c - 1);
  const key = `${sheet}!${cellLetter}${r}`;
  
  cellValues[key] = input.value;
  
  if (sheet === "SINBA-SIS-06-P") {
    if (r >= 11 && c >= 4 && c <= 24) {
      calculateRowTotalSINBA(r);
    }
  } else if (sheet === "MOV-DE-BIOLÓGICO") {
    // Check if the modified cell is a double-dose input for applied/wasted doses
    if ([19, 20, 21, 22, 23, 103, 104, 105].includes(parseInt(r))) {
      if ([8, 9].includes(parseInt(c))) {
        calculateDosesSum(r, "H", "I", "J");
      } else if ([11, 12].includes(parseInt(c))) {
        calculateDosesSum(r, "K", "L", "M");
      }
    }
    recalculateInventoryRow(r);
  } else if (sheet === "SIS-SS-IE Mensual") {
    calculateInfluenzaRow(r);
  }
}

// Format Caducidad values on focus out (blur)
function handleGridFocusOut(e) {
  const input = e.target;
  if (input.dataset.autocomplete === "caducidad") {
    const formatted = formatToMmmAa(input.value);
    input.value = formatted;
    
    const r = input.dataset.r;
    const c = input.dataset.c;
    const sheet = input.dataset.sheet;
    const cellLetter = XLSX.utils.encode_col(c - 1);
    cellValues[`${sheet}!${cellLetter}${r}`] = formatted;
    
    validateInventoryLotes();
  }
}

// Calculate sum of two columns (e.g. J19 = (((H19/2)+I19)) or simply summing the inputs)
// Since J is total applied doses, and Excel formula is =(((H19/2)+I19)) or similar, let's replicate the math!
function calculateDosesSum(rowNum, col1, col2, targetCol) {
  const val1 = parseFloat(cellValues[`MOV-DE-BIOLÓGICO!${col1}${rowNum}`] || 0);
  const val2 = parseFloat(cellValues[`MOV-DE-BIOLÓGICO!${col2}${rowNum}`] || 0);
  
  // Replicate exact formula: (((H19/2)+I19))
  // The first dose is divided by 2? Let's check: yes, formula is =(((H19/2)+(I19)))
  const total = (val1 / 2) + val2;
  
  const targetKey = `MOV-DE-BIOLÓGICO!${targetCol}${rowNum}`;
  cellValues[targetKey] = total === 0 ? "" : String(total);
  
  const targetCell = gridWrapper.querySelector(`td[data-cell-id="${targetKey}"]`);
  if (targetCell) {
    targetCell.textContent = cellValues[targetKey];
  }
}

// Calculate total for a row in SINBA-SIS-06-P
function calculateRowTotalSINBA(rowNum) {
  let sum = 0;
  for (let c = 4; c <= 21; c++) {
    const colLetter = XLSX.utils.encode_col(c - 1);
    const val = parseFloat(cellValues[`SINBA-SIS-06-P!${colLetter}${rowNum}`] || 0);
    sum += val;
  }
  
  const totalKey = `SINBA-SIS-06-P!Y${rowNum}`;
  cellValues[totalKey] = sum === 0 ? "" : String(sum);
  
  const totalCell = gridWrapper.querySelector(`td[data-cell-id="${totalKey}"]`);
  if (totalCell) totalCell.textContent = cellValues[totalKey];
  
  propagateDependencies(totalKey);
  propagateDependencies(`SINBA-SIS-06-P!V${rowNum}`);
  propagateDependencies(`SINBA-SIS-06-P!W${rowNum}`);
  propagateDependencies(`SINBA-SIS-06-P!X${rowNum}`);
}

// Propagate dependencies from SINBA to SIS-SS-CE-H-2026
function propagateDependencies(sourceKey) {
  const targets = GRID_DEPENDENCIES[sourceKey];
  if (!targets) return;
  
  targets.forEach(targetKey => {
    const val = cellValues[sourceKey];
    cellValues[targetKey] = val === "0" || val === "" ? " " : val;
    
    const targetCell = gridWrapper.querySelector(`td[data-cell-id="${targetKey}"]`);
    if (targetCell) {
      targetCell.textContent = cellValues[targetKey];
    }
  });
}

// Recalculate Existencia Final for a row in MOV-DE-BIOLÓGICO
function recalculateInventoryRow(rowNum) {
  const formula = dynamicFormulas["MOV-DE-BIOLÓGICO"][`N${rowNum}`];
  if (!formula) return;
  
  const finalVal = formula.run(rowNum);
  const finalKey = `MOV-DE-BIOLÓGICO!N${rowNum}`;
  cellValues[finalKey] = finalVal;
  
  const targetCell = gridWrapper.querySelector(`td[data-cell-id="${finalKey}"]`);
  if (targetCell) {
    targetCell.textContent = finalVal;
  }
  
  updateMovementTotals();
  validateInventoryLotes();
}

// Update total sums in MOV-DE-BIOLÓGICO
function updateMovementTotals() {
  const totalRows = [18, 24, 30, 36, 42, 48, 54, 60, 66, 84, 90, 96, 102, 111, 117, 123];
  
  totalRows.forEach(totRow => {
    let startRow = totRow - 5;
    if (totRow === 18) startRow = 13;
    else if (totRow === 24) startRow = 19;
    else if (totRow === 30) startRow = 25;
    else if (totRow === 36) startRow = 31;
    else if (totRow === 42) startRow = 37;
    else if (totRow === 48) startRow = 43;
    else if (totRow === 54) startRow = 49;
    else if (totRow === 60) startRow = 55;
    else if (totRow === 66) startRow = 61;
    else if (totRow === 84) startRow = 79;
    else if (totRow === 90) startRow = 85;
    else if (totRow === 96) startRow = 91;
    else if (totRow === 102) startRow = 97;
    else if (totRow === 111) startRow = 103;
    else if (totRow === 117) startRow = 112;
    else if (totRow === 123) startRow = 118;
    
    let sumN = 0;
    for (let r = startRow; r < totRow; r++) {
      const val = parseFloat(cellValues[`MOV-DE-BIOLÓGICO!N${r}`] || 0);
      sumN += val;
    }
    
    const totalKey = `MOV-DE-BIOLÓGICO!N${totRow}`;
    cellValues[totalKey] = sumN === 0 ? " " : String(sumN);
    
    const targetCell = gridWrapper.querySelector(`td[data-cell-id="${totalKey}"]`);
    if (targetCell) {
      targetCell.textContent = cellValues[totalKey];
    }
  });
}

// Calculate influenza row weekly total
function calculateInfluenzaRow(rowNum) {
  let sum = 0;
  for (let c = 8; c <= 12; c++) {
    const colLetter = XLSX.utils.encode_col(c - 1);
    const val = parseFloat(cellValues[`SIS-SS-IE Mensual!${colLetter}${rowNum}`] || 0);
    sum += val;
  }
  
  const totalKey = `SIS-SS-IE Mensual!G${rowNum}`;
  cellValues[totalKey] = sum === 0 ? "" : String(sum);
  
  const targetCell = gridWrapper.querySelector(`td[data-cell-id="${totalKey}"]`);
  if (targetCell) {
    targetCell.textContent = cellValues[totalKey];
  }
}

// Run all calculations for active sheet
function recalculateSheetTotals(sheetName) {
  if (sheetName === "SINBA-SIS-06-P") {
    for (let r = 11; r <= 125; r++) {
      calculateRowTotalSINBA(r);
    }
  } else if (sheetName === "MOV-DE-BIOLÓGICO") {
    for (let r = 13; r <= 128; r++) {
      recalculateInventoryRow(r);
    }
    updateMovementTotals();
  } else if (sheetName === "SIS-SS-IE Mensual") {
    for (let r = 11; r <= 94; r++) {
      calculateInfluenzaRow(r);
    }
  }
}

// Auto-complete system for Vaccine Lots in MOV-DE-BIOLÓGICO
let activeAutocompleteDropdown = null;

function handleGridFocusIn(e) {
  const input = e.target;
  if (!input.dataset.autocomplete) return;
  
  closeAutocomplete();
  
  const r = input.dataset.r;
  const c = parseInt(input.dataset.c);
  const sheet = input.dataset.sheet;
  
  const bioName = rowToBiologicalMap[r];
  if (!bioName) return;
  
  const filteredLots = lotesCatalog.filter(l => l.biologico.toUpperCase().includes(bioName));
  if (filteredLots.length === 0) return;
  
  const dropdown = document.createElement("div");
  dropdown.className = "autocomplete-dropdown";
  
  const rect = input.getBoundingClientRect();
  dropdown.style.left = `${rect.left + window.scrollX}px`;
  dropdown.style.top = `${rect.bottom + window.scrollY}px`;
  
  filteredLots.forEach(lot => {
    const item = document.createElement("div");
    item.className = "autocomplete-item";
    
    const expDate = new Date(lot.caducidad);
    const today = new Date();
    const threeMonthsDiff = 3 * 30 * 24 * 60 * 60 * 1000;
    
    let statusClass = "ok";
    let statusLabel = "Vigente";
    
    if (expDate < today) {
      statusClass = "expired";
      statusLabel = "Caducado";
    } else if ((expDate - today) < threeMonthsDiff) {
      statusClass = "warn";
      statusLabel = "Por Caducar";
    }
    
    // Format caducidad output to show MMM-AA
    const displayCad = formatToMmmAa(lot.caducidad);
    
    item.innerHTML = `
      <div>
        <div class="lot-name">${lot.lote}</div>
        <div class="lot-expiry">Cad: ${displayCad}</div>
      </div>
      <span class="lot-badge ${statusClass}">${statusLabel}</span>
    `;
    
    item.addEventListener("mousedown", (evt) => {
      evt.preventDefault();
      
      input.value = lot.lote;
      const lotLetter = XLSX.utils.encode_col(c - 1);
      cellValues[`${sheet}!${lotLetter}${r}`] = lot.lote;
      
      const expiryCol = c + 1;
      const expiryLetter = XLSX.utils.encode_col(expiryCol - 1);
      const expiryInput = gridWrapper.querySelector(`.excel-input[data-sheet="${sheet}"][data-r="${r}"][data-c="${expiryCol}"]`);
      if (expiryInput) {
        expiryInput.value = displayCad;
        cellValues[`${sheet}!${expiryLetter}${r}`] = displayCad;
      }
      
      closeAutocomplete();
      validateInventoryLotes();
    });
    
    dropdown.appendChild(item);
  });
  
  document.body.appendChild(dropdown);
  activeAutocompleteDropdown = dropdown;
  
  input.addEventListener("input", filterAutocompleteItems);
  input.addEventListener("focusout", () => {
    setTimeout(closeAutocomplete, 200);
  });
}

function filterAutocompleteItems(e) {
  if (!activeAutocompleteDropdown) return;
  const text = e.target.value.toUpperCase();
  
  const items = activeAutocompleteDropdown.querySelectorAll(".autocomplete-item");
  items.forEach(item => {
    const lotName = item.querySelector(".lot-name").textContent.toUpperCase();
    if (lotName.includes(text)) {
      item.style.display = "flex";
    } else {
      item.style.display = "none";
    }
  });
}

// Close Autocomplete dropdown
function closeAutocomplete() {
  if (activeAutocompleteDropdown) {
    activeAutocompleteDropdown.remove();
    activeAutocompleteDropdown = null;
  }
}

// Validate Lot Expirations and show in sidebar panel
function validateInventoryLotes() {
  validationList.innerHTML = "";
  let warnings = [];
  
  for (let r = 13; r <= 128; r++) {
    if ([18, 24, 30, 36, 42, 48, 54, 60, 66, 84, 90, 96, 102, 111, 117, 123].includes(r)) {
      continue;
    }
    
    const bio = rowToBiologicalMap[r];
    const prevLote = cellValues[`MOV-DE-BIOLÓGICO!C${r}`];
    const prevCad = cellValues[`MOV-DE-BIOLÓGICO!D${r}`];
    const recLote = cellValues[`MOV-DE-BIOLÓGICO!F${r}`];
    const recCad = cellValues[`MOV-DE-BIOLÓGICO!G${r}`];
    const finalStock = parseFloat(cellValues[`MOV-DE-BIOLÓGICO!N${r}`] || 0);
    
    if (finalStock < 0) {
      warnings.push({
        type: "danger",
        msg: `Existencia negativa en ${bio} (Renglon ${r}): ${finalStock} frascos.`
      });
    }
    
    [ {lote: prevLote, cad: prevCad, label: "Exist. Ant." }, { lote: recLote, cad: recCad, label: "Recibido" } ].forEach(item => {
      if (item.lote && item.cad) {
        // Parse date for checks
        const cleanCad = formatToMmmAa(item.cad);
        // Look up corresponding lot catalog to match expiration date safely
        const matchedCatalog = lotesCatalog.find(l => l.lote.toUpperCase() === item.lote.toUpperCase());
        const dateToCheck = matchedCatalog ? new Date(matchedCatalog.caducidad) : new Date(item.cad);
        const today = new Date();
        const threeMonthsDiff = 3 * 30 * 24 * 60 * 60 * 1000;
        
        if (!isNaN(dateToCheck.getTime())) {
          if (dateToCheck < today) {
            warnings.push({
              type: "danger",
              msg: `Lote CADUCADO (${item.lote}) de ${bio} en ${item.label} (Cad: ${cleanCad}).`
            });
          } else if ((dateToCheck - today) < threeMonthsDiff) {
            warnings.push({
              type: "warn",
              msg: `Lote por caducar (${item.lote}) de ${bio} en ${item.label} (Cad: ${cleanCad}).`
            });
          }
        }
      }
    });
  }
  
  if (warnings.length === 0) {
    validationList.innerHTML = `<div class="status-pill success" style="width: 100%; justify-content: center;">Todo Correcto (Sin Errores)</div>`;
  } else {
    warnings.forEach(w => {
      const card = document.createElement("div");
      card.className = `status-pill ${w.type === "danger" ? "danger" : ""}`;
      card.style.fontSize = "11px";
      card.style.borderRadius = "6px";
      card.style.padding = "8px 12px";
      card.style.lineHeight = "1.4";
      card.style.width = "100%";
      card.style.display = "block";
      card.textContent = w.msg;
      validationList.appendChild(card);
    });
  }
}

// Export filled template Excel file
async function exportWorkbook() {
  if (!templateBuffer) {
    alert("Por favor carga el archivo de plantilla original (SINBA-VER_26_2026 - copia.xlsx) primero haciendo clic en el botón de estado 'Plantilla: Cargar Archivo' en el encabezado.");
    inputTemplateFile.click();
    return;
  }
  
  try {
    showLoading("Preparando archivo de exportación...");
    
    // Read the Excel workbook using SheetJS from memory buffer
    const workbook = XLSX.read(templateBuffer, { type: "array" });
    
    // Fill edited cell values into their respective sheets and cells
    for (const key in cellValues) {
      const parts = key.split("!");
      const sheetName = parts[0];
      const cellRef = parts[1];
      
      const worksheet = workbook.Sheets[sheetName];
      if (worksheet) {
        if (!worksheet[cellRef]) {
          worksheet[cellRef] = { t: "s", v: "" };
        }
        
        const rawVal = cellValues[key];
        
        if (!isNaN(rawVal) && rawVal.trim() !== "") {
          worksheet[cellRef].t = "n";
          worksheet[cellRef].v = parseFloat(rawVal);
        } else {
          worksheet[cellRef].t = "s";
          worksheet[cellRef].v = rawVal;
        }
      }
    }
    
    // Write out the modified Excel workbook
    const outBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    
    // Trigger download in browser
    const blob = new Blob([outBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    
    const finalClues = inputCLUE.value || "SINBA";
    const finalMes = selectMes.value || "REPORTE";
    a.download = `SINBA_${finalClues}_${finalMes}_2026.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    hideLoading();
  } catch (err) {
    console.error("Export failed:", err);
    alert("Error al exportar archivo: " + err.message);
    hideLoading();
  }
}

// Load Application
window.addEventListener("DOMContentLoaded", init);
