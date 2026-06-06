const {
  APP_META,
  HYDRAULIC_FORMULAS,
  REPORT_CODE_OPTIONS,
  REPORT_SECTIONS,
  activeRows,
  calculatePreliminaryDesign,
  createBlankRecord,
  getPath,
  normaliseRecord,
  requiredFieldsMissing,
  safeFileStem,
  setPath,
  summarisePe
} = globalThis.SwaReportModel;

const editor = document.querySelector("#recordEditor");
const reportDocument = document.querySelector("#reportDocument");
const saveState = document.querySelector("#saveState");
const formulaChoice = document.querySelector("#hydraulicFormulaChoice");
const formulaSelection = document.querySelector("#selectedHydraulicFormulas");
const projectCopyName = document.querySelector("#projectCopyName");
const savedProjectCopies = document.querySelector("#savedProjectCopies");
const activeProjectCopy = document.querySelector("#activeProjectCopy");
const contentsSectionsEditor = document.querySelector("#contentsSectionsEditor");
const iwkReferenceField = document.querySelector("#iwkReferenceField");
const siteIntroductionFields = document.querySelector("#siteIntroductionFields");
const existingSchoolIntroField = document.querySelector("#existingSchoolIntroField");

const HYDRAULIC_SOURCE_LABELS = Object.freeze({
  excel: "Excel sheet formula",
  mits: "Computer software (MiTS)"
});

const REGISTRATION_PREFIX = "No. Pendaftaran LJM :";

const STANDARD_CRITERIA_BASIS =
  "Reka bentuk sistem pembetungan adalah berdasarkan kepada garis panduan Code of Practice for Design and Installation of Sewerage System: MS 1228: 1991 dan Malaysian Sewerage Industry Guidelines (MSIG) terbitan Suruhanjaya Perkhidmatan Air Negara (SPAN).";

const STANDARD_PE_BASIS =
  "Kiraan Penduduk Setara (PE) menggunakan Table 3-1: PE for Various Premises/Establishments MSIG Volume 1 Planning Principle & Tools 1st Edition Januari 2025";

const HISTORY_FIELDS = Object.freeze([
  "cover.client",
  "cover.certifierName",
  "cover.certifierRegistration",
  "cover.certifierRole",
  "cover.projectOwner",
  "cover.projectManager",
  "cover.designTeam"
]);

const CARD_DEFINITIONS = Object.freeze({
  criteria: Object.freeze({
    bodyId: "criteriaEditor",
    fields: Object.freeze([
      { key: "item", label: "Criterion" },
      { key: "value", label: "Value" },
      { key: "unit", label: "Unit / note" }
    ]),
    blank: Object.freeze({ item: "", value: "", unit: "" })
  }),
  appendices: Object.freeze({
    bodyId: "appendixEditor",
    fields: Object.freeze([
      { key: "letter", label: "Appendix letter" },
      { key: "title", label: "Appendix title" },
      { key: "reference", label: "Reference / note" }
    ]),
    blank: Object.freeze({ letter: "", title: "", reference: "" })
  })
});

const PE_BLANK_ROW = Object.freeze({
  premises: "",
  quantity: "",
  rate: "",
  subtotalOverride: ""
});

let record = loadRecord();
let entryHistory = loadHistory();
let projectLibrary = loadProjectLibrary();
let activeProjectId = loadActiveProjectId();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadRecord() {
  try {
    return normaliseRecord(JSON.parse(localStorage.getItem(APP_META.storageKey)));
  } catch {
    return createBlankRecord();
  }
}

function loadHistory() {
  try {
    const loaded = JSON.parse(localStorage.getItem(APP_META.historyKey)) || {};
    return Object.fromEntries(
      HISTORY_FIELDS.map((path) => [
        path,
        Array.isArray(loaded[path])
          ? loaded[path].filter((value) => typeof value === "string" && value.trim()).slice(0, 12)
          : []
      ])
    );
  } catch {
    return Object.fromEntries(HISTORY_FIELDS.map((path) => [path, []]));
  }
}

function loadProjectLibrary() {
  try {
    const loaded = JSON.parse(localStorage.getItem(APP_META.projectLibraryKey));
    if (!Array.isArray(loaded)) {
      return [];
    }
    return loaded
      .filter((item) => item && typeof item.id === "string" && typeof item.name === "string")
      .map((item) => ({
        id: item.id,
        name: item.name,
        record: normaliseRecord(item.record),
        updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : ""
      }));
  } catch {
    return [];
  }
}

function loadActiveProjectId() {
  const activeId = localStorage.getItem(APP_META.activeProjectKey) || "";
  return projectLibrary.some((project) => project.id === activeId) ? activeId : "";
}

function setActiveProjectId(id) {
  activeProjectId = id;
  if (id) {
    localStorage.setItem(APP_META.activeProjectKey, id);
  } else {
    localStorage.removeItem(APP_META.activeProjectKey);
  }
}

function saveProjectLibrary() {
  try {
    localStorage.setItem(APP_META.projectLibraryKey, JSON.stringify(projectLibrary));
    return true;
  } catch {
    noteSaved("Unable to save project copy: reduce logo file sizes");
    return false;
  }
}

function activeProject() {
  return projectLibrary.find((project) => project.id === activeProjectId);
}

function stripReportCodeSuffix(value) {
  return REPORT_CODE_OPTIONS.reduce((base, code) => {
    const suffix = ` - ${code}`;
    return base.toLowerCase().endsWith(suffix.toLowerCase())
      ? base.slice(0, -suffix.length).trim()
      : base;
  }, value.trim());
}

function projectCopyNameWithReportCode(value) {
  const base = stripReportCodeSuffix(value || "");
  const reportCode = record.cover.reportCode.trim();
  return base && reportCode ? `${base} - ${reportCode}` : base;
}

function projectCopyFileStem() {
  const project = activeProject();
  return safeFileStem(
    projectCopyNameWithReportCode(
      projectCopyName.value.trim() ||
        (project ? project.name : "") ||
        record.cover.projectTitle.trim() ||
        "record"
    )
  );
}

function renderProjectLibrary() {
  const selected = savedProjectCopies.value || activeProjectId;
  savedProjectCopies.replaceChildren(new Option("Select a saved project", ""));
  projectLibrary.forEach((project) => {
    savedProjectCopies.append(new Option(project.name, project.id));
  });
  savedProjectCopies.value = projectLibrary.some((project) => project.id === selected)
    ? selected
    : "";
  const project = activeProject();
  activeProjectCopy.textContent = project
    ? `Active copy: ${project.name} (changes autosave into this copy)`
    : "Active copy: unsaved working draft";
}

function updateActiveProject() {
  const project = activeProject();
  if (!project) {
    return;
  }
  project.record = clone(record);
  project.updatedAt = new Date().toISOString();
  saveProjectLibrary();
}

function node(tag, className, text) {
  const output = document.createElement(tag);
  if (className) {
    output.className = className;
  }
  if (text !== undefined) {
    output.textContent = text;
  }
  return output;
}

function filled(value) {
  return typeof value === "string" && value.trim() !== "";
}

function displayValue(tag, value, placeholder, className = "") {
  const output = node(tag, className);
  if (filled(value)) {
    output.textContent = value;
  } else {
    output.textContent = `[${placeholder}]`;
    output.classList.add("pending-value");
  }
  return output;
}

function certifierRegistrationText() {
  const registration = record.cover.certifierRegistration.trim();
  if (!registration) {
    return "";
  }
  return /^No\.?\s*Pendaftaran\s+LJM\s*:/i.test(registration)
    ? registration
    : `${REGISTRATION_PREFIX} ${registration}`;
}

function paragraphValue(parent, value, placeholder) {
  if (!filled(value)) {
    parent.append(displayValue("p", value, placeholder));
    return;
  }
  const lines = value.split(/\r?\n/);
  const hasRomanList = lines.some((line) => /^\s*[ivxlcdm]+[.)]\s+/i.test(line));
  if (!hasRomanList) {
    parent.append(node("p", "", value));
    return;
  }

  let list = null;
  lines.forEach((line) => {
    const listItem = line.match(/^\s*[ivxlcdm]+[.)]\s+(.+)$/i);
    if (listItem) {
      if (!list) {
        list = node("ol", "report-subtext-list");
        parent.append(list);
      }
      list.append(node("li", "", listItem[1]));
      return;
    }
    list = null;
    if (line.trim()) {
      parent.append(node("p", "", line.trim()));
    }
  });
}

function formatAmount(value, maximumDigits = 2) {
  return Number(value).toLocaleString("en-MY", {
    minimumFractionDigits: Number.isInteger(Number(value)) ? 0 : Math.min(1, maximumDigits),
    maximumFractionDigits: maximumDigits
  });
}

function inputForRow(arrayName, index, field) {
  const label = node("label");
  label.append(field.label);
  const input = document.createElement("input");
  input.dataset.array = arrayName;
  input.dataset.index = String(index);
  input.dataset.key = field.key;
  input.type = field.type || "text";
  if (field.type === "number") {
    input.step = "any";
  }
  input.value = record[arrayName][index][field.key] || "";
  label.append(input);
  return label;
}

function removeButton(arrayName, index) {
  const remove = node("button", "row-remove", "Remove");
  remove.type = "button";
  remove.dataset.remove = arrayName;
  remove.dataset.index = String(index);
  return remove;
}

function renderCardEditors() {
  Object.entries(CARD_DEFINITIONS).forEach(([arrayName, definition]) => {
    const body = document.querySelector(`#${definition.bodyId}`);
    body.replaceChildren();
    record[arrayName].forEach((rowData, index) => {
      const card = node("section", "repeat-card");
      const grid = node("div", `repeat-grid ${arrayName}-grid`);
      definition.fields.forEach((field) => grid.append(inputForRow(arrayName, index, field)));
      card.append(grid, removeButton(arrayName, index));
      body.append(card);
    });
  });
}

function contentSectionField(index, key, label, tag = "input") {
  const wrapper = node("label");
  wrapper.append(label);
  const input = document.createElement(tag);
  input.dataset.contentSection = String(index);
  input.dataset.key = key;
  if (tag === "textarea") {
    input.rows = 3;
  }
  input.value = record.contentsSections[index][key] || "";
  wrapper.append(input);
  return wrapper;
}

function renderContentsSectionsEditor() {
  contentsSectionsEditor.replaceChildren();
  record.contentsSections.forEach((sectionData, index) => {
    const card = node("section", "repeat-card contents-section-card");
    const grid = node("div", "repeat-grid contents-section-grid");
    const include = node("label");
    include.append("Include in report");
    const select = document.createElement("select");
    select.dataset.contentSection = String(index);
    select.dataset.key = "enabled";
    select.append(new Option("Include", "yes"), new Option("Exclude", "no"));
    select.value = sectionData.enabled;
    include.append(select);
    grid.append(
      include,
      contentSectionField(index, "number", "Section no."),
      contentSectionField(index, "title", "Section title")
    );
    card.append(grid);
    if (!REPORT_SECTIONS.some(([number]) => number === sectionData.id)) {
      card.append(
        contentSectionField(
          index,
          "content",
          "Additional section text (supports lines beginning i. and ii.)",
          "textarea"
        )
      );
    }
    if (!REPORT_SECTIONS.some(([number]) => number === sectionData.id)) {
      const remove = node("button", "row-remove", "Remove section");
      remove.type = "button";
      remove.dataset.removeContentSection = String(index);
      card.append(remove);
    }
    contentsSectionsEditor.append(card);
  });
}

function renderPeEditor() {
  const body = document.querySelector("#peEditor");
  body.replaceChildren();
  const fields = [
    { key: "premises" },
    { key: "quantity", type: "number" },
    { key: "rate", type: "number" },
    { key: "subtotalOverride", type: "number" }
  ];

  record.peRows.forEach((rowData, index) => {
    const row = node("tr");
    fields.forEach((field) => {
      const cell = node("td");
      const input = document.createElement("input");
      input.dataset.array = "peRows";
      input.dataset.index = String(index);
      input.dataset.key = field.key;
      input.type = field.type || "text";
      input.step = field.type === "number" ? "any" : "";
      input.value = rowData[field.key] || "";
      cell.append(input);
      row.append(cell);
    });
    const actionCell = node("td");
    actionCell.append(removeButton("peRows", index));
    row.append(actionCell);
    body.append(row);
  });
}

function storeHistoryEntry(path, value) {
  if (!HISTORY_FIELDS.includes(path) || !filled(value)) {
    return;
  }
  entryHistory[path] = [value.trim(), ...entryHistory[path].filter((item) => item !== value.trim())].slice(
    0,
    12
  );
  localStorage.setItem(APP_META.historyKey, JSON.stringify(entryHistory));
  renderHistoryChoices();
}

function renderHistoryChoices() {
  const datalistIds = {
    "cover.client": "history-client",
    "cover.certifierName": "history-certifierName",
    "cover.certifierRegistration": "history-certifierRegistration"
  };
  Object.entries(datalistIds).forEach(([path, id]) => {
    const list = document.querySelector(`#${id}`);
    list.replaceChildren();
    entryHistory[path].forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      list.append(option);
    });
  });

  editor.querySelectorAll("[data-history-pick]").forEach((picker) => {
    const current = picker.value;
    picker.replaceChildren(new Option("Select a saved entry", ""));
    entryHistory[picker.dataset.historyPick].forEach((value) => {
      picker.append(new Option(value.replace(/\s+/g, " ").slice(0, 90), value));
    });
    picker.value = current;
  });
}

function renderSelectedFormulas() {
  formulaSelection.replaceChildren();
  if (!record.hydraulic.formulaId) {
    formulaSelection.append(node("p", "field-note", "No hydraulic formula has been selected."));
    return;
  }
  const formula = HYDRAULIC_FORMULAS[record.hydraulic.formulaId];
  const item = node("div", "selected-method");
  item.append(node("strong", "", formula.label), node("span", "", formula.equation));
  const remove = node("button", "row-remove", "Remove");
  remove.type = "button";
  remove.dataset.removeFormula = formula.id;
  item.append(remove);
  formulaSelection.append(item);
}

function syncIwkReferenceField() {
  const input = iwkReferenceField.querySelector("input");
  const disabled = record.cover.reportCode === "UR20A";
  if (disabled) {
    record.control.documentReference = "";
    input.value = "";
  }
  input.disabled = disabled;
  input.placeholder = disabled ? "Not applicable for UR20A" : "e.g. IWK/001";
}

function syncSiteFields() {
  const existingSystemField = document.querySelector("#existingSystemNarrativeField");
  existingSystemField.hidden = record.site.existingSystemStatus === "new";
  existingSystemField.querySelector("textarea").disabled =
    record.site.existingSystemStatus === "new";

  const includeSiteSentence = record.site.introductionType !== "none";
  siteIntroductionFields.hidden = !includeSiteSentence;
  siteIntroductionFields.querySelectorAll("input").forEach((input) => {
    input.disabled = !includeSiteSentence;
  });
  existingSchoolIntroField.hidden = record.site.introductionType !== "additional-block";
  existingSchoolIntroField.querySelector("input").disabled =
    !includeSiteSentence || record.site.introductionType !== "additional-block";
}

function populateFields() {
  editor.querySelectorAll("[data-field]").forEach((input) => {
    input.value = getPath(record, input.dataset.field);
  });
  editor.querySelectorAll("[data-simple-field]").forEach((input) => {
    input.value = record[input.dataset.simpleField] || "";
  });
  editor.querySelectorAll("[data-hydraulic-field]").forEach((input) => {
    input.value = record.hydraulic[input.dataset.hydraulicField] || "";
  });
  editor.querySelectorAll("[data-site-field]").forEach((input) => {
    input.value = record.site[input.dataset.siteField] || "";
  });
  editor.querySelectorAll("[data-design-field]").forEach((input) => {
    input.value = record.design[input.dataset.designField] || "";
  });
  syncIwkReferenceField();
  syncSiteFields();
  formulaChoice.value = record.hydraulic.formulaId || "";
  renderHistoryChoices();
  renderCardEditors();
  renderContentsSectionsEditor();
  renderPeEditor();
  renderSelectedFormulas();
  renderProjectLibrary();
}

function noteSaved(message = "Saved in this browser profile") {
  saveState.textContent = `${message} - ${new Date().toLocaleTimeString("en-MY", {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

function saveAndRender(message) {
  try {
    localStorage.setItem(APP_META.storageKey, JSON.stringify(record));
    updateActiveProject();
    noteSaved(message);
  } catch {
    noteSaved("Unable to save: reduce logo file sizes");
  }
  renderReport();
}

function reportTable(headers, className = "") {
  const table = node("table", `report-table ${className}`.trim());
  const head = node("thead");
  const row = node("tr");
  headers.forEach((heading) => row.append(node("th", "", heading)));
  head.append(row);
  const body = node("tbody");
  table.append(head, body);
  return { table, body };
}

function reportCell(row, value, placeholder = "") {
  const cell = node("td");
  if (filled(value)) {
    cell.textContent = value;
  } else if (placeholder) {
    cell.textContent = `[${placeholder}]`;
    cell.className = "pending-cell";
  }
  row.append(cell);
  return cell;
}

function createReportSection(number, title) {
  const section = node("section", "report-section");
  section.append(node("h2", "", `${number} ${title}`));
  return section;
}

function createConfiguredSection(config, number, title) {
  return createReportSection(config?.number || number, config?.title || title);
}

function logoForParty(key, label) {
  if (filled(record.logos[key])) {
    const image = document.createElement("img");
    image.className = "party-logo";
    image.alt = `Logo ${label}`;
    image.src = record.logos[key];
    return image;
  }
  return node("div", "logo-placeholder pending-value", `[Logo ${label}]`);
}

function renderCover() {
  const page = node("section", "print-page cover-page");
  page.append(displayValue("h2", record.cover.projectTitle, "Tajuk projek", "project-title"));
  const client = node("p", "client-line");
  client.append("UNTUK TETUAN: ", displayValue("span", record.cover.client, "Nama tetuan"));
  page.append(client);

  const reportTitle = node("div", "report-title-block");
  reportTitle.append(
    displayValue("div", record.cover.reportTitle, "Tajuk laporan"),
    displayValue("div", record.cover.reportCode, "Kod laporan")
  );
  if (record.cover.reportCode !== "UR20A" && filled(record.control.documentReference)) {
    reportTitle.append(
      node(
        "div",
        "cover-document-reference",
        `RUJUKAN IWK: ${record.control.documentReference}`
      )
    );
  }
  if (filled(record.control.submissionNumber)) {
    reportTitle.append(node("div", "cover-submission", `SUBMISSION KE-${record.control.submissionNumber}`));
  }
  page.append(reportTitle);

  const stakeholders = node("div", "stakeholders");
  [
    ["projectOwner", "PEMILIK PROJEK", record.cover.projectOwner],
    ["projectManager", "PENGURUS PROJEK", record.cover.projectManager],
    ["designTeam", "PASUKAN REKABENTUK", record.cover.designTeam]
  ].forEach(([key, label, value]) => {
    const block = node("section");
    block.append(node("h3", "", `${label}:`), logoForParty(key, label), displayValue("p", value, "Nama dan alamat"));
    stakeholders.append(block);
  });
  page.append(stakeholders);

  const certification = node("div", "certification");
  certification.append(
    displayValue(
      "p",
      record.cover.certificationStatement,
      "Pernyataan pengesahan jurutera"
    ),
    node("div", "signature-line")
  );
  const certifier = node("div", "certifier");
  certifier.append(
    displayValue("strong", record.cover.certifierName, "Nama jurutera pengesah"),
    displayValue("div", certifierRegistrationText(), `${REGISTRATION_PREFIX} [nombor]`),
    displayValue("div", record.cover.certifierRole, "Jawatan / pejabat")
  );
  certification.append(certifier);
  page.append(certification);

  const coverControl = node("div", "cover-control");
  coverControl.append(displayValue("p", record.control.reportDate, "Tarikh laporan", "cover-date"));
  page.append(coverControl);
  return page;
}

function renderContents() {
  const page = node("section", "print-page contents-page");
  page.append(node("h2", "", "ISI KANDUNGAN"));
  const list = node("ol", "contents-list");
  record.contentsSections.filter((section) => section.enabled === "yes").forEach(({ number, title }) => {
    const item = node("li");
    item.append(node("span", "", number), node("span", "", title));
    list.append(item);
  });
  page.append(list);
  return page;
}

function renderCriteria(body, config) {
  const section = createConfiguredSection(config, "3.0", "KRITERIA REKABENTUK");
  section.append(node("p", "", STANDARD_CRITERIA_BASIS));
  activeRows(record.criteria, ["item", "value", "unit"])
    .filter((criterion) => !/faktor aliran puncak/i.test(criterion.item))
    .forEach((criterion) => {
    const sentence = node("p", "criterion-sentence");
    sentence.append(
      `${criterion.item || "[Kriteria]"} yang digunakan dalam reka bentuk ini ialah `,
      displayValue("span", criterion.value, "nilai")
    );
    if (filled(criterion.unit)) {
      sentence.append(` ${criterion.unit}`);
    }
    sentence.append(".");
    section.append(sentence);
  });
  const peakFlow = node("p", "criterion-sentence formula-inline");
  peakFlow.append(
    "Faktor aliran puncak (peak flow) yang digunakan ialah ",
    displayValue("span", record.design.peakFactorCoefficient, "3.4"),
    " x P"
  );
  peakFlow.append(node("sup", "", "-0.11"), ", dengan P ialah PE dalam unit ribu.");
  section.append(peakFlow);
  body.append(section);
}

function renderPe(body, config) {
  const summary = summarisePe(record);
  const section = createConfiguredSection(config, "4.0", "PENGIRAAN PENDUDUK SETARA (PE)");
  section.append(node("p", "", STANDARD_PE_BASIS));
  const table = reportTable(["Jenis Premis", "Kuantiti", "PE / Unit", "Sub Jumlah PE"]);

  if (!summary.rows.length) {
    const blank = node("tr");
    const cell = node("td", "pending-cell", "[Masukkan baris pengiraan PE]");
    cell.colSpan = 4;
    blank.append(cell);
    table.body.append(blank);
  } else {
    summary.rows.forEach((entry) => {
      const row = node("tr");
      reportCell(row, entry.premises, "Premis");
      reportCell(row, entry.quantity);
      reportCell(row, entry.rate);
      reportCell(row, entry.subtotal === null ? "" : formatAmount(entry.subtotal), "PE");
      table.body.append(row);
    });
  }
  if (summary.showAdjustment) {
    const adjustment = node("tr");
    const label = node("td", "", "Penggenapan / pelarasan terkawal");
    label.colSpan = 3;
    adjustment.append(label);
    reportCell(adjustment, formatAmount(summary.adjustment));
    table.body.append(adjustment);
  }
  const total = node("tr", "pe-total");
  const totalLabel = node("td", "", "JUMLAH PE");
  totalLabel.colSpan = 3;
  total.append(totalLabel);
  reportCell(total, summary.hasCalculatedValue ? formatAmount(summary.total) : "", "Jumlah PE");
  table.body.append(total);
  section.append(table.table);
  body.append(section);
}

function mathGroup(...parts) {
  const group = node("span", "math-group");
  group.append(...parts);
  return group;
}

function mathFraction(numerator, denominator) {
  const fraction = node("span", "math-fraction");
  const top = node("span", "math-numerator");
  const bottom = node("span", "math-denominator");
  top.append(numerator);
  bottom.append(denominator);
  fraction.append(top, bottom);
  return fraction;
}

function mathRoot(...parts) {
  const root = node("span", "math-root");
  const radicand = node("span", "math-radicand");
  radicand.append(...parts);
  root.append(node("span", "math-root-symbol", "√"), radicand);
  return root;
}

function mathRow(...parts) {
  const row = node("div", "math-row");
  row.append(...parts);
  return row;
}

function calculationStep(label) {
  const step = node("div", "calculation-step");
  step.append(node("p", "calculation-label", label));
  return step;
}

function renderPreliminary(body, config) {
  const section = createConfiguredSection(config, "7.0", "PENGIRAAN REKABENTUK AWALAN");
  const calculation = calculatePreliminaryDesign(record);
  const calculated = calculation.designPeakFlowLps !== null;

  const pe = calculationStep("a) Equivalent Population (PE)");
  pe.append(
    mathRow(
      "PE = ",
      displayValue("span", calculated ? formatAmount(calculation.pe) : "", "total PE"),
      " PE"
    )
  );
  section.append(pe);

  const adwf = calculationStep("b) Average Dry Weather Flow (ADWF)");
  adwf.append(mathRow("ADWF = ", mathFraction("PE x 0.15 x 1000", "24 x 60 x 60")));
  if (calculated) {
    adwf.append(
      mathRow(
        "= ",
        mathFraction(`${formatAmount(calculation.pe)} x 0.15 x 1000`, "24 x 60 x 60")
      ),
      mathRow("= ", node("strong", "math-result", `${formatAmount(calculation.adwfLps, 3)} L/s`))
    );
  } else {
    adwf.append(mathRow("= ", displayValue("span", "", "calculated ADWF"), " L/s"));
  }
  section.append(adwf);

  const pff = calculationStep("c) Peak Flow Factor (PFF)");
  pff.append(
    mathRow(
      "PFF = ",
      displayValue("span", record.design.peakFactorCoefficient, "3.4"),
      " x P",
      node("sup", "", "-0.11")
    )
  );
  if (calculated) {
    pff.append(
      mathRow(
        `= ${formatAmount(calculation.coefficient)} x (${formatAmount(
          calculation.populationThousands,
          3
        )})`,
        node("sup", "", "-0.11")
      ),
      mathRow("= ", node("strong", "math-result", formatAmount(calculation.peakFlowFactor, 3)))
    );
  } else {
    pff.append(mathRow("= ", displayValue("span", "", "calculated PFF")));
  }
  section.append(pff);

  const designFlow = calculationStep("d) Design Peak Flow (Qrequired)");
  designFlow.append(mathRow("Qrequired = ADWF x PFF"));
  if (calculated) {
    designFlow.append(
      mathRow(
        `= ${formatAmount(calculation.adwfLps, 3)} x ${formatAmount(
          calculation.peakFlowFactor,
          3
        )}`
      ),
      mathRow(
        "= ",
        node("strong", "math-result", `${formatAmount(calculation.designPeakFlowLps, 3)} L/s`)
      )
    );
  } else {
    designFlow.append(mathRow("= ", displayValue("span", "", "calculated design peak flow"), " L/s"));
  }
  section.append(designFlow);
  body.append(section);
}

function hydraulicSourceSentence() {
  if (!record.hydraulic.calculationSource) {
    return "[Pilih output pengiraan hidraulik: Excel sheet formula atau perisian komputer (MiTS).]";
  }
  return `Perincian kiraan hidraulik disediakan menggunakan ${HYDRAULIC_SOURCE_LABELS[record.hydraulic.calculationSource]}.`;
}

function hydraulicBasisSentence() {
  if (!record.hydraulic.calculationSource) {
    return "[Pilih kaedah lampiran kiraan: Excel sheet formula atau Computer software (MiTS).]";
  }
  return `Rujuk lembaran lampiran kiraan yang disertakan secara ${HYDRAULIC_SOURCE_LABELS[record.hydraulic.calculationSource]}.`;
}

function renderHydraulic(body, config) {
  const section = createConfiguredSection(config, "8.0", "FORMULA HIDRAULIK");
  section.append(node("p", "hydraulic-source", hydraulicBasisSentence()));

  const formula = HYDRAULIC_FORMULAS[record.hydraulic.formulaId];
  const formulaStatement = node("p");
  if (formula) {
    formulaStatement.textContent =
      `Reka bentuk pembetungan projek ini menggunakan formula ${formula.label} seperti di bawah.`;
  } else {
    formulaStatement.className = "pending-value";
    formulaStatement.textContent = "[Pilih satu formula hidraulik.]";
  }
  section.append(formulaStatement);
  body.append(section);
  if (formula) {
    body.append(renderFormulaDetail(formula));
  }
}

function renderAppendixSummary(body, config) {
  const section = createConfiguredSection(config, "9.0", "LAMPIRAN");
  activeRows(record.appendices, ["letter", "title", "reference"]).forEach((entry) => {
    const paragraph = node("p", "appendix-line");
    paragraph.append(
      node("span", "appendix-line-label", `LAMPIRAN ${entry.letter || "[huruf]"}`)
    );
    const title = node("span", "appendix-line-title", entry.title || "[tajuk lampiran]");
    if (filled(entry.reference)) {
      title.append(` - ${entry.reference}`);
    }
    paragraph.append(title);
    section.append(paragraph);
  });
  body.append(section);
}

function siteValue(value, placeholder) {
  return displayValue("span", value, placeholder);
}

function renderSiteIntroductionSentence(parent) {
  if (record.site.introductionType === "none") {
    return;
  }
  const paragraph = node("p");
  if (record.site.introductionType === "additional-block") {
    paragraph.append(
      "Tapak cadangan projek ini terletak di atas sebahagian ",
      siteValue(record.site.lotNumber, "Lot"),
      ", Daerah ",
      siteValue(record.site.district, "Daerah"),
      ", Mukim ",
      siteValue(record.site.mukim, "Mukim"),
      ", ",
      siteValue(record.site.state, "Negeri"),
      " di dalam kawasan ",
      siteValue(record.site.existingSchoolName, "Nama sekolah"),
      " sedia ada dengan keluasan lot ialah ",
      siteValue(record.site.lotArea, "Keluasan lot"),
      "."
    );
  } else {
    paragraph.append(
      "Tapak cadangan projek ini terletak di atas ",
      siteValue(record.site.lotNumber, "Lot"),
      ", Daerah ",
      siteValue(record.site.district, "Daerah"),
      ", Mukim ",
      siteValue(record.site.mukim, "Mukim"),
      ", ",
      siteValue(record.site.state, "Negeri"),
      " dengan keluasan lot ialah ",
      siteValue(record.site.lotArea, "Keluasan lot"),
      "."
    );
  }
  parent.append(paragraph);
}

function renderIntroduction(body, config) {
  const introduction = createConfiguredSection(config, "1.0", "PENGENALAN");
  const projectTitle = record.cover.projectTitle.trim() || "[Project Title]";
  const client = record.cover.client.trim() || "[Client / tetuan]";
  const paragraph = node("p");
  paragraph.append(
    "Cawangan Kejuruteraan Awam Dan Struktur Ibu Pejabat JKR Malaysia telah dilantik sebagai pereka bentuk secara konvensional dalaman bagi mereka bentuk sistem pembetungan bagi projek ",
    node("strong", "", projectTitle),
    " untuk Tetuan ",
    node("strong", "", client),
    "."
  );
  introduction.append(paragraph);
  renderSiteIntroductionSentence(introduction);
  if (filled(record.narrative.introductionAdditional)) {
    paragraphValue(introduction, record.narrative.introductionAdditional, "Masukkan ayat tambahan.");
  }
  body.append(introduction);
}

function renderObjective(body, config) {
  const objective = createConfiguredSection(config, "2.0", "OBJEKTIF");
  paragraphValue(objective, record.narrative.objective, "Masukkan objektif laporan.");
  body.append(objective);
}

function renderExistingSystem(body, config) {
  const history = createConfiguredSection(
    config,
    "5.0",
    "SEJARAH TAPAK DAN SISTEM KUMBAHAN SEDIA ADA"
  );
  if (record.site.existingSystemStatus === "new") {
    history.append(
      node(
        "p",
        "",
        "Tapak projek merupakan tapak baharu dan tidak mempunyai sistem kumbahan sedia ada."
      )
    );
  } else {
    paragraphValue(history, record.narrative.existingSystem, "Masukkan keterangan sistem sedia ada.");
  }
  body.append(history);
}

function renderProposal(body, config) {
  const proposal = createConfiguredSection(config, "6.0", "CADANGAN SISTEM RAWATAN KUMBAHAN PROJEK");
  paragraphValue(proposal, record.narrative.proposal, "Masukkan cadangan sistem rawatan.");
  body.append(proposal);
}

function renderAdditionalSection(body, config) {
  const section = createConfiguredSection(config, config.number || "[NO.]", config.title || "[TAJUK]");
  paragraphValue(section, config.content, "Masukkan kandungan seksyen tambahan.");
  body.append(section);
}

function renderBody() {
  const body = node("section", "print-page body-page");
  record.contentsSections
    .filter((section) => section.enabled === "yes")
    .forEach((config) => {
      if (config.id === "1.0") {
        renderIntroduction(body, config);
      } else if (config.id === "2.0") {
        renderObjective(body, config);
      } else if (config.id === "3.0") {
        renderCriteria(body, config);
      } else if (config.id === "4.0") {
        renderPe(body, config);
      } else if (config.id === "5.0") {
        renderExistingSystem(body, config);
      } else if (config.id === "6.0") {
        renderProposal(body, config);
      } else if (config.id === "7.0") {
        renderPreliminary(body, config);
      } else if (config.id === "8.0") {
        renderHydraulic(body, config);
      } else if (config.id === "9.0") {
        renderAppendixSummary(body, config);
      } else {
        renderAdditionalSection(body, config);
      }
    });
  return body;
}

function renderFormulaDetail(formula) {
  const detail = node("section", "formula-detail");
  detail.append(node("p", "sheet-kicker", "HYDRAULIC FORMULA DETAIL"), node("h3", "formula-title", formula.label));
  detail.append(renderFormulaEquation(formula));
  detail.append(node("h4", "", "Definition of variables"));
  const variables = node("div", "formula-variables");
  formula.variables.forEach(([symbol, meaning]) => {
    const definition = node("p");
    definition.append(node("strong", "", symbol), ` = ${meaning}`);
    variables.append(definition);
  });
  detail.append(variables);
  detail.append(node("h4", "", "Asas dan aplikasi"));
  detail.append(node("p", "", formula.basis), node("p", "", formula.coefficient));
  detail.append(node("p", "", hydraulicSourceSentence()));
  return detail;
}

function renderFormulaEquation(formula) {
  const expression = node("div", "formula-equation");
  if (formula.id === "hazen-williams") {
    expression.append(mathRow("V = 0.849 C R", node("sup", "", "0.63"), " S", node("sup", "", "0.54")));
  } else if (formula.id === "manning") {
    expression.append(
      mathRow(
        "V = ",
        mathFraction(
          mathGroup("R", node("sup", "", "2/3"), " S", node("sup", "", "1/2")),
          "n"
        )
      )
    );
  } else {
    expression.append(
      mathRow(
        "V = -2",
        mathRoot("2 g D S"),
        " log",
        node("sub", "", "10"),
        " [ ",
        mathFraction(mathGroup("k", node("sub", "", "s")), "3.7 D"),
        " + ",
        mathFraction("2.51 ν", mathGroup("D ", mathRoot("2 g D S"))),
        " ]"
      )
    );
  }
  return expression;
}

function renderAppendixPages() {
  if (!record.contentsSections.some((section) => section.id === "9.0" && section.enabled === "yes")) {
    return [];
  }
  return activeRows(record.appendices, ["letter", "title", "reference"]).map((entry) => {
    const page = node("section", "print-page appendix-page");
    page.append(
      node("p", "appendix-page-label", `LAMPIRAN ${entry.letter || "[HURUF]"}`),
      displayValue("h2", entry.title, "Tajuk lampiran")
    );
    if (filled(entry.reference)) {
      page.append(node("p", "appendix-page-reference", entry.reference));
    }
    return page;
  });
}

function renderReport() {
  reportDocument.replaceChildren(
    renderCover(),
    renderContents(),
    renderBody(),
    ...renderAppendixPages()
  );
}

async function storeLogo(key, file) {
  if (!file) {
    return;
  }
  if (file.size > 700000) {
    window.alert("Please use a logo image smaller than 700 KB so the browser record remains portable.");
    return;
  }
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", reject);
    reader.readAsDataURL(file);
  });
  record.logos[key] = dataUrl;
  saveAndRender("Logo saved in this browser profile");
}

editor.addEventListener("input", (event) => {
  const target = event.target;
  if (target.dataset.field) {
    setPath(record, target.dataset.field, target.value);
    if (target.dataset.field === "cover.reportCode") {
      syncIwkReferenceField();
    }
  } else if (target.dataset.simpleField) {
    record[target.dataset.simpleField] = target.value;
  } else if (target.dataset.hydraulicField) {
    record.hydraulic[target.dataset.hydraulicField] = target.value;
  } else if (target.dataset.siteField) {
    record.site[target.dataset.siteField] = target.value;
    syncSiteFields();
  } else if (target.dataset.designField) {
    record.design[target.dataset.designField] = target.value;
  } else if (target.dataset.array) {
    record[target.dataset.array][Number(target.dataset.index)][target.dataset.key] = target.value;
  } else if (target.dataset.contentSection !== undefined) {
    record.contentsSections[Number(target.dataset.contentSection)][target.dataset.key] = target.value;
  } else {
    return;
  }
  saveAndRender();
});

editor.addEventListener("change", async (event) => {
  const target = event.target;
  if (target.dataset.field) {
    storeHistoryEntry(target.dataset.field, target.value);
  }
  if (target.dataset.historyPick && filled(target.value)) {
    setPath(record, target.dataset.historyPick, target.value);
    const field = editor.querySelector(`[data-field="${target.dataset.historyPick}"]`);
    field.value = target.value;
    saveAndRender("Saved entry applied");
  }
  if (target.dataset.logo) {
    await storeLogo(target.dataset.logo, target.files[0]);
    target.value = "";
  }
});

editor.addEventListener("click", (event) => {
  const add = event.target.closest("[data-add]");
  if (add) {
    const arrayName = add.dataset.add;
    const blank = arrayName === "peRows" ? PE_BLANK_ROW : CARD_DEFINITIONS[arrayName].blank;
    record[arrayName].push(clone(blank));
    renderCardEditors();
    renderPeEditor();
    saveAndRender();
    return;
  }
  const remove = event.target.closest("[data-remove]");
  if (remove) {
    const arrayName = remove.dataset.remove;
    record[arrayName].splice(Number(remove.dataset.index), 1);
    if (!record[arrayName].length) {
      const blank = arrayName === "peRows" ? PE_BLANK_ROW : CARD_DEFINITIONS[arrayName].blank;
      record[arrayName].push(clone(blank));
    }
    renderCardEditors();
    renderPeEditor();
    saveAndRender();
    return;
  }
  const clearLogo = event.target.closest("[data-clear-logo]");
  if (clearLogo) {
    record.logos[clearLogo.dataset.clearLogo] = "";
    saveAndRender("Logo cleared");
  }
});

document.querySelector("#addContentsSection").addEventListener("click", () => {
  record.contentsSections.push({
    id: `custom-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    number: "",
    title: "",
    enabled: "yes",
    content: ""
  });
  renderContentsSectionsEditor();
  saveAndRender("Additional report section added");
});

contentsSectionsEditor.addEventListener("click", (event) => {
  const remove = event.target.closest("[data-remove-content-section]");
  if (!remove) {
    return;
  }
  record.contentsSections.splice(Number(remove.dataset.removeContentSection), 1);
  renderContentsSectionsEditor();
  saveAndRender("Report section removed");
});

formulaChoice.addEventListener("change", () => {
  const formulaId = formulaChoice.value;
  if (!formulaId || !HYDRAULIC_FORMULAS[formulaId]) {
    record.hydraulic.formulaId = "";
    formulaChoice.value = "";
    renderSelectedFormulas();
    saveAndRender("Formula cleared");
    return;
  }
  record.hydraulic.formulaId = formulaId;
  renderSelectedFormulas();
  saveAndRender("Formula selected");
});

formulaSelection.addEventListener("click", (event) => {
  const remove = event.target.closest("[data-remove-formula]");
  if (!remove) {
    return;
  }
  if (record.hydraulic.formulaId === remove.dataset.removeFormula) {
    record.hydraulic.formulaId = "";
  }
  formulaChoice.value = record.hydraulic.formulaId || "";
  renderSelectedFormulas();
  saveAndRender("Formula removed");
});

document.querySelector("#newRecord").addEventListener("click", () => {
  if (!window.confirm("Start a blank UR20A working draft? Saved project copies will not be changed.")) {
    return;
  }
  setActiveProjectId("");
  record = createBlankRecord();
  projectCopyName.value = "";
  populateFields();
  saveAndRender("Blank working draft created");
});

document.querySelector("#saveProjectCopy").addEventListener("click", () => {
  const name = projectCopyNameWithReportCode(
    projectCopyName.value.trim() || record.cover.projectTitle.trim()
  );
  if (!name) {
    window.alert("Insert a project copy name or Project title before saving a project copy.");
    return;
  }
  const project = {
    id: `project-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name,
    record: clone(record),
    updatedAt: new Date().toISOString()
  };
  projectLibrary.unshift(project);
  setActiveProjectId(project.id);
  if (saveProjectLibrary()) {
    projectCopyName.value = "";
    renderProjectLibrary();
    noteSaved("New project copy saved");
  }
});

document.querySelector("#openProjectCopy").addEventListener("click", () => {
  const project = projectLibrary.find((item) => item.id === savedProjectCopies.value);
  if (!project) {
    window.alert("Select a saved project copy to open.");
    return;
  }
  setActiveProjectId(project.id);
  record = normaliseRecord(clone(project.record));
  populateFields();
  saveAndRender("Saved project opened");
});

document.querySelector("#deleteProjectCopy").addEventListener("click", () => {
  const project = projectLibrary.find((item) => item.id === savedProjectCopies.value);
  if (!project) {
    window.alert("Select a saved project copy to delete.");
    return;
  }
  if (!window.confirm(`Delete the saved project copy "${project.name}" from this browser profile?`)) {
    return;
  }
  projectLibrary = projectLibrary.filter((item) => item.id !== project.id);
  if (activeProjectId === project.id) {
    setActiveProjectId("");
  }
  saveProjectLibrary();
  renderProjectLibrary();
  noteSaved("Saved project copy deleted");
});

document.querySelector("#exportRecord").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = `${projectCopyFileStem()}.json`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
  noteSaved("Record exported");
});

document.querySelector("#importRecord").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) {
    return;
  }
  try {
    setActiveProjectId("");
    record = normaliseRecord(JSON.parse(await file.text()));
    projectCopyName.value = file.name.replace(/\.json$/i, "");
    populateFields();
    saveAndRender("Record imported as an unsaved working draft");
  } catch {
    window.alert("The selected file is not a valid UR20A template record.");
  } finally {
    event.target.value = "";
  }
});

document.querySelector("#printReport").addEventListener("click", () => {
  const missing = requiredFieldsMissing(record);
  if (
    missing.length &&
    !window.confirm(
      `This record still has ${missing.length} blank core field(s): ${missing.join(
        ", "
      )}. Continue to the print dialog for a draft PDF?`
    )
  ) {
    return;
  }
  renderReport();
  const originalTitle = document.title;
  document.title = projectCopyFileStem();
  try {
    window.print();
  } finally {
    document.title = originalTitle;
  }
});

populateFields();
renderReport();
