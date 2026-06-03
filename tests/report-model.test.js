import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import "../src/report-model.js";

const {
  APP_META,
  HYDRAULIC_FORMULAS,
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
  assert.equal(record.design.peakFactorCoefficient, "3.4");
  assert.equal(record.contentsSections.length, 9);
  assert.equal(record.contentsSections.find((section) => section.id === "5.0").enabled, "yes");
  assert.equal(record.contentsSections.find((section) => section.id === "6.0").enabled, "yes");
  assert.deepEqual(record.hydraulic.formulaIds, []);
  assert.equal(APP_META.credit, "Hafize | Version 1.0.0");
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
});

test("PE summary combines automatic line products with a rounding adjustment", () => {
  const record = createBlankRecord();
  record.peRows = [
    { premises: "Blok baharu", quantity: "360", rate: "0.2", subtotalOverride: "" }
  ];
  record.peAdjustment = "8";

  const result = summarisePe(record);
  assert.equal(result.rows[0].subtotal, 72);
  assert.equal(result.total, 80);
});

test("an explicitly entered subtotal is retained as the controlled manual value", () => {
  const record = createBlankRecord();
  record.peRows = [
    { premises: "Kegunaan khas", quantity: "12", rate: "2", subtotalOverride: "31" }
  ];

  const result = summarisePe(record);
  assert.equal(result.rows[0].subtotal, 31);
  assert.equal(result.rows[0].manuallyOverridden, true);
});

test("preliminary design is calculated automatically from total PE and the fixed exponent", () => {
  const record = createBlankRecord();
  record.peRows = [
    { premises: "Blok baharu", quantity: "360", rate: "0.2", subtotalOverride: "" }
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
    peRows: [{ premises: "Bangunan", quantity: 10, rate: 0.2 }],
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

  assert.match(html, /Hafize \| Version 1\.0\.0/);
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
  const modelPosition = html.indexOf('<script src="./src/report-model.js"></script>');
  const appPosition = html.indexOf('<script src="./src/app.js"></script>');

  assert.equal(html.includes('type="module"'), false);
  assert.ok(modelPosition >= 0);
  assert.ok(appPosition > modelPosition);
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
      formulaIds: ["manning", "not-allowed", "colebrook", "manning"]
    }
  });
  assert.equal(imported.hydraulic.calculationSource, "mits");
  assert.deepEqual(imported.hydraulic.formulaIds, ["manning", "colebrook"]);
});

test("revised form provides project-copy storage and hydraulic controls", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

  assert.equal(html.includes("Hydraulic sewer schedule"), false);
  assert.equal(html.includes('data-field="narrative.introduction"'), false);
  assert.equal(html.includes('data-field="narrative.criteriaBasis"'), false);
  assert.equal(html.includes('data-simple-field="peBasis"'), false);
  assert.equal(html.includes('data-field="narrative.hydraulicBasis"'), false);
  assert.equal(html.includes("preliminaryEditor"), false);
  assert.equal(
    html.includes("Insert the prepared attachment immediately behind this separator page."),
    false
  );
  assert.match(html, /Computer software \(MiTS\)/);
  assert.match(html, /Colebrook-White/);
  assert.match(html, /Hazen-Williams/);
  assert.match(html, /Manning/);
  assert.match(html, /Logo pemilik projek/);
  assert.match(html, /Saved project copies in this browser/);
  assert.match(html, /Multiple users can use the same web link/);
  assert.equal(html.includes("Inputs autosave only on this PC"), false);
  assert.match(html, /id="saveProjectCopy"/);
  assert.match(html, /id="openProjectCopy"/);
  assert.match(html, /data-site-field="existingSystemStatus"/);
  assert.match(html, /data-design-field="peakFactorCoefficient"/);
  assert.match(html, /id="contentsSectionsEditor"/);
  assert.match(html, /Rujukan IWK/);
  assert.match(html, /Submission ke-/);
  assert.match(html, /PDC2 Paip Retikulasi/);
  assert.match(app, /Reka bentuk sistem pembetungan adalah berdasarkan kepada garis panduan/);
  assert.match(app, /Kiraan Penduduk Setara \(PE\) menggunakan Table 3-1/);
  assert.match(app, /Rujuk lembaran lampiran kiraan yang disertakan secara/);
  assert.equal(app.includes("Asas kerja: MSIG Volume III"), false);
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
  assert.equal(app.includes("renderAppendixSummaryPage"), false);
  assert.match(app, /renderHydraulic\(body, config\);[\s\S]*?renderAppendixSummary\(body, config\);/);
  assert.equal(app.includes("renderFormulaPages"), false);
  assert.match(app, /body\.append\(renderFormulaDetail\(HYDRAULIC_FORMULAS\[id\]\)\)/);
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
  assert.match(css, /\.certification p\s*\{[\s\S]*?color:\s*#426b8a/);
  assert.match(css, /\.signature-line\s*\{[\s\S]*?margin:\s*8mm auto 2\.5mm/);
  assert.match(css, /\.report-subtext-list\s*\{/);
  assert.match(css, /\.header-actions \.file-action\s*\{[\s\S]*?margin-top:\s*0/);
  assert.equal(css.includes(".report-document::before"), false);
  assert.equal(css.includes("outline-offset: -7mm"), false);
});
