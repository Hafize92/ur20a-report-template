import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import "../src/report-model.js";

const {
  APP_META,
  HYDRAULIC_FORMULAS,
  PE_PREMISES_OPTIONS,
  REPORT_CODE_OPTIONS,
  calculatePreliminaryDesign,
  createBlankRecord,
  normaliseRecord,
  requiredFieldsMissing,
  safeFileStem,
  summarisePe
} = globalThis.SwaReportModel;

test("a blank template retains formal UR20A report defaults", () => {
  const record = createBlankRecord();
  assert.equal(record.cover.reportCode, "UR20A");
  assert.equal(record.criteria.length, 5);
  assert.equal(record.appendices.length, 3);
  assert.equal(record.site.existingSystemStatus, "existing");
  assert.equal(record.site.introductionType, "new-school");
  assert.equal(record.site.lotNumber, "");
  assert.equal(record.narrative.introductionAdditional, "");
  assert.equal(record.design.peakFactorCoefficient, "3.4");
  assert.equal(record.cover.certifierName, "Ir. Dr. ZURAIDA BINTI ZAINI RIJAL");
  assert.equal(record.criteria[0].value, "210");
  assert.equal(record.criteria[1].value, "0.8");
  assert.equal(record.criteria[2].value, "4.0");
  assert.equal("revision" in record.control, false);
  assert.equal("status" in record.control, false);
  assert.equal(record.contentsSections.length, 9);
  assert.equal(record.contentsSections.find((section) => section.id === "5.0").enabled, "yes");
  assert.equal(record.contentsSections.find((section) => section.id === "6.0").enabled, "yes");
  assert.equal(record.hydraulic.formulaId, "");
  assert.equal(APP_META.appName, "IWK Report Template");
  assert.equal(APP_META.credit, "Hafize | Version 1.0.9");
  assert.equal(APP_META.authKey, "ur20a-report-template-auth-v1");
  assert.equal(record.peRows[0].premisesId, "");
  assert.equal(record.peRows[0].unit, "");
  assert.equal(record.existingPeEnabled, "no");
  assert.equal(record.existingPeRows[0].unit, "");
  assert.equal(record.includeExistingPeInTotal, "no");
  assert.deepEqual(PE_PREMISES_OPTIONS[0], {
    id: "residential-unit",
    premises: "Residential",
    rate: "4",
    unit: "residential unit"
  });
  assert.equal(
    PE_PREMISES_OPTIONS.find((option) => option.id === "school-day-student").unit,
    "student"
  );
  assert.equal(
    PE_PREMISES_OPTIONS.find((option) => option.id === "airport-employee").rate,
    "0.3"
  );
  assert.equal(
    PE_PREMISES_OPTIONS.find((option) => option.id === "others-100m2").unit,
    "100m2 gross area"
  );
  assert.deepEqual(REPORT_CODE_OPTIONS, [
    "UR20A",
    "SWA-P",
    "SWA-D",
    "SWA-C",
    "PDC1 Pelan Perancangan",
    "PDC2 Paip Retikulasi"
  ]);
});

test("missing standard report sections are restored while additional content is preserved", () => {
  const record = normaliseRecord({
    contentsSections: [
      { id: "1.0", number: "1.0", title: "PENGENALAN", enabled: "yes" },
      { id: "custom-10", number: "10.0", title: "CATATAN", enabled: "yes", content: "Nota" }
    ]
  });

  assert.equal(record.contentsSections.find((section) => section.id === "5.0").enabled, "yes");
  assert.equal(record.contentsSections.find((section) => section.id === "6.0").enabled, "yes");
  assert.equal(record.contentsSections.find((section) => section.id === "custom-10").content, "Nota");
  assert.equal(record.contentsSections.find((section) => section.id === "custom-10").number, "10.0");
});

test("contents sections are renumbered automatically after exclusions", () => {
  const record = normaliseRecord({
    contentsSections: [
      { id: "1.0", title: "PENGENALAN", enabled: "yes", number: "10.0" },
      { id: "2.0", title: "OBJEKTIF", enabled: "no", number: "2.0" },
      { id: "3.0", title: "KRITERIA REKABENTUK", enabled: "yes", number: "99.0" },
      { id: "custom-a", title: "SEKSYEN TAMBAHAN", enabled: "yes", number: "20.0" }
    ]
  });

  assert.equal(record.contentsSections.find((section) => section.id === "1.0").number, "1.0");
  assert.equal(record.contentsSections.find((section) => section.id === "2.0").number, "");
  assert.equal(record.contentsSections.find((section) => section.id === "3.0").number, "2.0");
  assert.equal(record.contentsSections.find((section) => section.id === "custom-a").number, "9.0");
});

test("PE summary combines automatic line products with a rounding adjustment", () => {
  const record = createBlankRecord();
  record.peRows = [
    { premisesId: "school-day-student", quantity: "360" }
  ];
  record.peAdjustment = "8";

  const result = summarisePe(record);
  assert.equal(result.rows[0].subtotal, 72);
  assert.equal(result.rows[0].premises, "Schools / Educational Institutions - Day School / Institutions");
  assert.equal(result.rows[0].unit, "student");
  assert.equal(result.total, 80);
});

test("existing PE is calculated but only included in total when selected", () => {
  const record = createBlankRecord();
  record.peRows = [
    { premisesId: "school-day-student", quantity: "100" }
  ];
  record.existingPeEnabled = "yes";
  record.existingPeRows = [
    { premisesId: "school-day-student", quantity: "50" }
  ];

  const excluded = summarisePe(record);
  assert.equal(excluded.subtotal, 20);
  assert.equal(excluded.existingSubtotal, 10);
  assert.equal(excluded.includedExistingSubtotal, 0);
  assert.equal(excluded.total, 20);

  record.includeExistingPeInTotal = "yes";
  const included = summarisePe(record);
  assert.equal(included.includedExistingSubtotal, 10);
  assert.equal(included.total, 30);
});

test("PE subtotal is always calculated from quantity and selected MSIG rate", () => {
  const record = createBlankRecord();
  record.peRows = [
    { premisesId: "school-day-student", quantity: "12", rate: "9" }
  ];

  const result = summarisePe(record);
  assert.equal(result.rows[0].rate, "0.2");
  assert.ok(Math.abs(result.rows[0].subtotal - 2.4) < 0.000001);
});

test("preliminary design is calculated automatically from total PE and the fixed exponent", () => {
  const record = createBlankRecord();
  record.peRows = [
    { premisesId: "school-day-student", quantity: "360" }
  ];
  record.peAdjustment = "8";

  const result = calculatePreliminaryDesign(record);
  assert.equal(result.pe, 80);
  assert.equal(result.exponent, -0.11);
  assert.equal(result.populationThousands, 0.08);
  assert.ok(Math.abs(result.adwfLps - 0.1388888889) < 0.000001);
  assert.ok(Math.abs(result.peakFlowFactor - 4.4889) < 0.001);
  assert.ok(Math.abs(result.designPeakFlowLps - 0.6235) < 0.001);
});

test("import normalisation preserves expected fields and drops unrelated values", () => {
  const imported = normaliseRecord({
    control: { documentReference: "IWK/ABC" },
    cover: { projectTitle: "Projek A", reportCode: "SWA-C", extraField: "ignore" },
    criteria: [
      { item: "Jenis paip", value: "VC", unit: "" },
      { item: "Faktor aliran puncak (peak flow)", value: "lama", unit: "" }
    ],
    peRows: [{ premises: "Sekolah", quantity: 10, rate: 9 }],
    existingPeEnabled: "yes",
    existingPeRows: [{ premises: "Sekolah", quantity: 20, rate: 1, unit: "katil" }],
    includeExistingPeInTotal: "yes",
    unknown: "ignore"
  });

  assert.equal(imported.cover.projectTitle, "Projek A");
  assert.equal(imported.cover.reportCode, "SWA-C");
  assert.equal(imported.control.documentReference, "IWK/ABC");
  assert.equal("extraField" in imported.cover, false);
  assert.equal("unknown" in imported, false);
  assert.equal(imported.criteria.length, 1);
  assert.equal(imported.criteria[0].item, "Jenis paip");
  assert.equal(imported.peRows[0].quantity, "10");
  assert.equal(imported.peRows[0].premisesId, "school-day-student");
  assert.equal(imported.peRows[0].rate, "0.2");
  assert.equal(imported.peRows[0].unit, "student");
  assert.equal(imported.existingPeEnabled, "yes");
  assert.equal(imported.existingPeRows[0].unit, "student");
  assert.equal(imported.includeExistingPeInTotal, "yes");
  assert.equal(imported.design.peakFactorCoefficient, "3.4");
});

test("UR20A disables IWK reference while other controlled report codes preserve it", () => {
  const ur20a = normaliseRecord({
    control: { documentReference: "IWK/SHOULD-CLEAR" },
    cover: { reportCode: "UR20A" }
  });
  const pdc = normaliseRecord({
    control: { documentReference: "IWK/PDC/01", submissionNumber: "2" },
    cover: { reportCode: "PDC1 Pelan Perancangan" }
  });

  assert.equal(ur20a.control.documentReference, "");
  assert.equal(pdc.control.documentReference, "IWK/PDC/01");
  assert.equal(pdc.control.submissionNumber, "2");
});

test("export filenames preserve project-copy wording while removing invalid Windows characters", () => {
  assert.equal(safeFileStem("Sekolah Demo - UR20A"), "Sekolah Demo - UR20A");
  assert.equal(safeFileStem(" Sekolah: Demo / UR20A? "), "Sekolah- Demo - UR20A-");
  assert.equal(safeFileStem(""), "record");
});

test("print readiness reports missing manually controlled core fields", () => {
  const missing = requiredFieldsMissing(createBlankRecord());
  assert.ok(missing.includes("Tajuk projek"));
  assert.ok(missing.includes("Cadangan sistem rawatan"));
  assert.ok(missing.includes("Output pengiraan hidraulik"));
  assert.ok(missing.includes("Formula hidraulik"));
  assert.equal(missing.includes("Pengenalan"), false);
});

test("excluded report sections do not require their section-specific inputs", () => {
  const record = createBlankRecord();
  record.contentsSections = record.contentsSections.map((section) =>
    ["2.0", "5.0", "6.0", "8.0"].includes(section.id) ? { ...section, enabled: "no" } : section
  );

  const missing = requiredFieldsMissing(record);
  assert.equal(missing.includes("Objektif"), false);
  assert.equal(missing.includes("Sejarah tapak dan sistem sedia ada"), false);
  assert.equal(missing.includes("Cadangan sistem rawatan"), false);
  assert.equal(missing.includes("Output pengiraan hidraulik"), false);
  assert.equal(missing.includes("Formula hidraulik"), false);
});

test("template credit is labelled screen-only and suppressed in print styling", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  const printCss = css.slice(css.indexOf("@media print"));

  assert.match(html, /Hafize \| Version 1\.0\.9/);
  assert.match(html, /template-credit screen-only/);
  assert.equal(
    html.includes("is visible in the template interface only and will not be printed in the PDF"),
    false
  );
  assert.match(printCss, /\.screen-only\s*\{[\s\S]*?display:\s*none\s*!important/);
});

test("print layout protects headings and paragraphs from orphaned page breaks", async () => {
  const css = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  const printCss = css.slice(css.indexOf("@media print"));

  assert.match(printCss, /\.report-section\s*\{[\s\S]*?break-inside:\s*avoid-page/);
  assert.match(printCss, /\.report-section h2,[\s\S]*?break-after:\s*avoid/);
  assert.match(printCss, /\.report-section p,[\s\S]*?break-inside:\s*avoid-page/);
});

test("browser scripts remain compatible with static web hosting under a nested route", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const modelPosition = html.indexOf('<script src="./src/report-model.js?v=1.0.9"></script>');
  const appPosition = html.indexOf('<script src="./src/app.js?v=1.0.9"></script>');

  assert.equal(html.includes('type="module"'), false);
  assert.match(html, /<link rel="stylesheet" href="\.\/src\/styles\.css\?v=1\.0\.9">/);
  assert.ok(modelPosition >= 0);
  assert.ok(appPosition > modelPosition);
});

test("changelog records the current MSIG PE update and retained password gate", async () => {
  const changelog = await readFile(new URL("../CHANGELOG.md", import.meta.url), "utf8");

  assert.match(changelog, /## 1\.0\.9 - 2026-06-17/);
  assert.match(changelog, /MSIG Vol 1 Planning Principle and Tools\.pdf/);
  assert.match(changelog, /Table 3-1: PE for Various Premises\/Establishments/);
  assert.match(changelog, /default password `pendksi1`/);
  assert.match(changelog, /Removed the Word export button/);
});

test("MSIG hydraulic choices are restricted to the three permitted formula options", () => {
  assert.deepEqual(Object.keys(HYDRAULIC_FORMULAS), [
    "colebrook",
    "hazen-williams",
    "manning"
  ]);
  const imported = normaliseRecord({
    hydraulic: {
      calculationSource: "mits",
      formulaIds: ["manning", "not-allowed", "colebrook", "manning"],
      sourceReference: "old file reference",
      notes: "old notes"
    }
  });
  assert.equal(imported.hydraulic.calculationSource, "mits");
  assert.equal(imported.hydraulic.formulaId, "manning");
  assert.equal("formulaIds" in imported.hydraulic, false);
  assert.equal("sourceReference" in imported.hydraulic, false);
  assert.equal("notes" in imported.hydraulic, false);
  assert.match(HYDRAULIC_FORMULAS.colebrook.equation, /√\(2 g D S\)/);
  assert.match(HYDRAULIC_FORMULAS.colebrook.basis, /MSIG Volume III menyatakan/);
});

test("revised form provides project-copy storage and hydraulic controls", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  const pemilikLogo = await readFile(new URL("../assets/pemilik.png", import.meta.url));
  const jkrLogo = await readFile(new URL("../assets/jkr.png", import.meta.url));

  assert.match(html, /IWK Report Template \| Printable A4 Report Builder/);
  assert.match(html, /<h1>IWK <span>Report Template<\/span><\/h1>/);
  assert.match(html, /class="auth-locked"/);
  assert.match(html, /id="passwordGate"/);
  assert.match(html, /id="appPassword"/);
  assert.equal(html.includes("UR20A <span>Report Template</span>"), false);
  assert.equal(html.includes("<details open>"), false);
  assert.equal(html.includes("Hydraulic sewer schedule"), false);
  assert.equal(html.includes('data-field="narrative.introduction"'), false);
  assert.equal(html.includes('data-field="narrative.criteriaBasis"'), false);
  assert.equal(html.includes('data-simple-field="peBasis"'), false);
  assert.equal(html.includes('data-field="narrative.hydraulicBasis"'), false);
  assert.equal(html.includes('data-field="control.revision"'), false);
  assert.equal(html.includes('data-field="control.status"'), false);
  assert.equal(html.includes('id="addHydraulicFormula"'), false);
  assert.equal(html.includes("Add selected formula"), false);
  assert.equal(html.includes("Output file / appendix reference"), false);
  assert.equal(html.includes("Hydraulic notes"), false);
  assert.equal(html.includes('data-hydraulic-field="sourceReference"'), false);
  assert.equal(html.includes('data-hydraulic-field="notes"'), false);
  assert.equal(html.includes("preliminaryEditor"), false);
  assert.equal(
    html.includes("Insert the prepared attachment immediately behind this separator page."),
    false
  );
  assert.match(html, /Computer software \(MiTS\)/);
  assert.match(html, /Colebrook-White/);
  assert.match(html, /Hazen-Williams/);
  assert.match(html, /Manning/);
  assert.match(html, /Select formula/);
  assert.match(html, /Select one formula only/);
  assert.match(html, /data-site-field="introductionType"/);
  assert.match(html, /data-site-field="lotNumber"/);
  assert.match(html, /data-site-field="district"/);
  assert.match(html, /data-site-field="mukim"/);
  assert.match(html, /data-site-field="existingSchoolName"/);
  assert.match(html, /data-field="narrative.introductionAdditional"/);
  assert.match(html, /Ir\. Dr\. ZURAIDA BINTI ZAINI RIJAL/);
  assert.match(html, /placeholder="CF11003"/);
  assert.equal(html.includes("Logo pemilik projek"), false);
  assert.equal(html.includes("Logo pengurus projek"), false);
  assert.equal(html.includes("Logo pasukan rekabentuk"), false);
  assert.equal(html.includes("data-logo"), false);
  assert.equal(html.includes("data-clear-logo"), false);
  assert.ok(pemilikLogo.length > 1000);
  assert.ok(jkrLogo.length > 1000);
  assert.match(html, /Saved project copies in this browser/);
  assert.match(html, /Multiple users can use the same web link/);
  assert.equal(html.includes("Inputs autosave only on this PC"), false);
  assert.match(html, /id="saveProjectCopy"/);
  assert.match(html, /id="openProjectCopy"/);
  assert.match(html, /data-site-field="existingSystemStatus"/);
  assert.match(html, /data-design-field="peakFactorCoefficient"/);
  assert.match(html, /id="contentsSectionsEditor"/);
  assert.match(html, /id="existingPeEditor"/);
  assert.match(html, /data-add="existingPeRows"/);
  assert.match(html, /data-simple-field="existingPeEnabled"/);
  assert.match(html, /data-simple-field="includeExistingPeInTotal"/);
  assert.match(html, /id="existingPeFields"/);
  assert.equal(html.includes('id="exportWord"'), false);
  assert.equal(html.includes("Manual subtotal"), false);
  assert.equal(html.includes("MSIG unit"), false);
  assert.equal(html.includes('id="msigPeUnits"'), false);
  assert.equal(html.includes('data-field="contentsSections.number"'), false);
  assert.match(html, /Rujukan IWK/);
  assert.match(html, /Submission ke-/);
  assert.match(html, /PDC2 Paip Retikulasi/);
  assert.match(app, /Reka bentuk sistem pembetungan adalah berdasarkan kepada garis panduan/);
  assert.match(app, /Kiraan Penduduk Setara \(PE\) menggunakan Table 3-1/);
  assert.match(app, /Rujuk lembaran lampiran kiraan yang disertakan secara/);
  assert.match(app, /REGISTRATION_PREFIX = "No\. Pendaftaran LJM :"/);
  assert.match(app, /HARDCODED_LOGOS/);
  assert.match(app, /projectOwner:\s*"\.\/assets\/pemilik\.png"/);
  assert.match(app, /projectManager:\s*"\.\/assets\/jkr\.png"/);
  assert.match(app, /designTeam:\s*"\.\/assets\/jkr\.png"/);
  assert.equal(app.includes("FileReader"), false);
  assert.equal(app.includes("storeLogo"), false);
  assert.match(app, /syncContentSectionNumbers/);
  assert.match(app, /contentSectionNumberField/);
  assert.match(app, /paginateRenderedBody/);
  assert.match(app, /createBodyPage/);
  assert.match(app, /pageFooter/);
  assert.match(app, /body-page-draft/);
  assert.equal(app.includes("Muka Surat"), false);
  assert.match(app, /String\(pageNumber\)/);
  assert.match(app, /clearAppendixPageNumbers/);
  assert.match(app, /page\.removeAttribute\("data-page-number"\)/);
  assert.match(app, /paginationReady/);
  assert.match(app, /await renderReport\(\)/);
  assert.match(app, /updateContentsPageNumbers/);
  assert.match(app, /contents-page-number/);
  assert.match(app, /dataReportSectionId|reportSectionId/);
  assert.match(app, /installDetailsFooterControls/);
  assert.match(app, /data-close-details/);
  assert.match(app, /Start a blank IWK working draft/);
  assert.match(app, /valid IWK template record/);
  assert.match(app, /projectCopyNameWithReportCode/);
  assert.match(app, /APP_PASSWORD = "pendksi1"/);
  assert.match(app, /installPasswordGate/);
  assert.match(app, /sessionStorage\.setItem\(APP_META\.authKey, "unlocked"\)/);
  assert.match(app, /PE_PREMISES_OPTIONS/);
  assert.match(app, /Select MSIG premise/);
  assert.match(app, /peRateLabel/);
  assert.match(app, /existingPeEnabled/);
  assert.match(app, /existingFields\.hidden/);
  assert.match(app, /existingRows/);
  assert.match(app, /PE sedia ada diambil kira/);
  assert.equal(app.includes("exportWordDocument"), false);
  assert.equal(app.includes("application/msword"), false);
  assert.equal(app.includes(".doc`"), false);
  assert.equal(app.includes("inlineReportImages"), false);
  assert.match(app, /formulaChoice\.addEventListener\("change"/);
  assert.match(app, /Tapak cadangan projek ini terletak di atas/);
  assert.match(app, /sebahagian/);
  assert.match(app, /Asas dan aplikasi/);
  assert.match(app, /Perincian kiraan hidraulik disediakan menggunakan/);
  assert.equal(app.includes("Asas kerja: MSIG Volume III"), false);
  assert.equal(app.includes("sqrt"), false);
  assert.match(app, /mathRoot/);
  assert.match(app, /Reka bentuk pembetungan projek ini menggunakan formula/);
  assert.equal(
    app.includes("Perincian setiap formula disertakan sebagai helaian berasingan dalam PDF ini."),
    false
  );
  assert.equal(
    app.includes("Setiap lampiran berikut mempunyai muka pemisah tersendiri di dalam laporan ini."),
    false
  );
  assert.equal(app.includes("Working reference: Malaysian Sewerage Industry Guidelines"), false);
  assert.equal(app.includes("Calculation output reference"), false);
  assert.equal(app.includes("renderAppendixSummaryPage"), false);
  assert.match(app, /renderHydraulic\(body, config\);[\s\S]*?renderAppendixSummary\(body, config\);/);
  assert.equal(app.includes("renderFormulaPages"), false);
  assert.match(app, /body\.append\(renderFormulaDetail\(formula\)\)/);
  assert.match(app, /mathFraction/);
  assert.match(app, /calculationStep/);
  assert.match(app, /node\("sup", "", "-0\.11"\)/);
  assert.match(app, /mathFraction\(mathGroup\("k", node\("sub", "", "s"\)\), "3\.7 D"\)/);
  assert.match(app, /node\("strong", "", projectTitle\)/);
  assert.match(app, /node\("strong", "", client\)/);
  assert.match(app, /link\.download = `\$\{projectCopyFileStem\(\)\}\.json`/);
  assert.match(app, /document\.title = projectCopyFileStem\(\)/);
  assert.match(css, /\.appendix-line\s*\{[\s\S]*?grid-template-columns:\s*30mm 1fr/);
  assert.match(css, /\.formula-equation\s*\{[\s\S]*?justify-content:\s*center/);
  assert.match(css, /\.math-fraction\s*\{[\s\S]*?flex-direction:\s*column/);
  assert.match(css, /\.math-root\s*\{/);
  assert.equal(css.includes("background: #eef0f0"), false);
  assert.match(css, /\.certification p\s*\{[\s\S]*?color:\s*#426b8a/);
  assert.match(css, /\.signature-line\s*\{[\s\S]*?margin:\s*8mm auto 2\.5mm/);
  assert.match(css, /\.report-subtext-list\s*\{/);
  assert.match(css, /\.header-actions \.file-action\s*\{[\s\S]*?margin-top:\s*0/);
  assert.match(css, /\.contents-list-heading\s*\{/);
  assert.match(css, /\.contents-page-number\s*\{[\s\S]*?text-align:\s*right/);
  assert.match(css, /\.auto-section-number\s*\{/);
  assert.match(css, /\.details-bottom-actions\s*\{/);
  assert.match(css, /\.details-close-button\s*\{/);
  assert.match(css, /body\.auth-locked \.app-header,[\s\S]*?body\.auth-locked \.studio\s*\{[\s\S]*?display:\s*none/);
  assert.match(css, /\.password-gate\s*\{/);
  assert.match(css, /\.pe-table-title\s*\{/);
  assert.match(css, /\.pe-subtotal td\s*\{/);
  assert.match(css, /\.readonly-cell\s*\{/);
  assert.match(css, /\.print-page\s*\{[\s\S]*?height:\s*297mm/);
  assert.match(css, /@page\s*\{[\s\S]*?margin:\s*0/);
  assert.match(css, /@media print[\s\S]*?\.print-page\s*\{[\s\S]*?width:\s*210mm[\s\S]*?height:\s*297mm/);
  assert.match(css, /\.body-page-draft\s*\{[\s\S]*?visibility:\s*hidden/);
  assert.match(css, /\.page-footer\s*\{[\s\S]*?position:\s*absolute/);
  assert.match(css, /\.page-content\s*\{/);
  assert.equal(css.includes(".logo-input-row"), false);
  assert.equal(css.includes(".logo-placeholder"), false);
  assert.equal(css.includes(".report-document::before"), false);
  assert.equal(css.includes("outline-offset: -7mm"), false);
});
