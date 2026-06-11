(() => {
const APP_META = Object.freeze({
  appName: "IWK Report Template",
  documentName: "Laporan Kejuruteraan Sistem Pembetungan",
  credit: "Hafize | Version 1.0.4",
  storageKey: "swa-c-report-template-draft-v1",
  historyKey: "swa-c-report-template-history-v1",
  projectLibraryKey: "ur20a-report-template-project-library-v1",
  activeProjectKey: "ur20a-report-template-active-project-v1"
});

const REPORT_SECTIONS = Object.freeze([
  ["1.0", "PENGENALAN"],
  ["2.0", "OBJEKTIF"],
  ["3.0", "KRITERIA REKABENTUK"],
  ["4.0", "PENGIRAAN PENDUDUK SETARA (PE)"],
  ["5.0", "SEJARAH TAPAK DAN SISTEM KUMBAHAN SEDIA ADA"],
  ["6.0", "CADANGAN SISTEM RAWATAN KUMBAHAN PROJEK"],
  ["7.0", "PENGIRAAN REKABENTUK AWALAN"],
  ["8.0", "FORMULA HIDRAULIK"],
  ["9.0", "LAMPIRAN"]
]);

const REPORT_CODE_OPTIONS = Object.freeze([
  "UR20A",
  "SWA-P",
  "SWA-D",
  "SWA-C",
  "PDC1 Pelan Perancangan",
  "PDC2 Paip Retikulasi"
]);

const defaultContentsSections = REPORT_SECTIONS.map(([number, title]) => ({
  id: number,
  number,
  title,
  enabled: "yes",
  content: ""
}));

const defaultCriteria = [
  ["Aliran purata air harian per kapita", "210", "liter/hari"],
  ["Halaju aliran minimum", "0.8", "m/s"],
  ["Halaju aliran maksimum", "4.0", "m/s"],
  ["Jarak lurang maksimum", "", "m"],
  ["Jenis dan diameter paip", "", ""]
];

const defaultAppendices = [
  ["A", "Pelan Susunatur Sistem Pembetungan", ""],
  ["B", "Kiraan Hidraulik Pembetungan", ""],
  ["C", "Surat / Keputusan Pihak Berkuasa", ""]
];

const HYDRAULIC_FORMULAS = Object.freeze({
  colebrook: Object.freeze({
    id: "colebrook",
    label: "Colebrook-White",
    equation:
      "V = -2 √(2 g D S) log10 [ ks / (3.7 D) + 2.51 ν / (D √(2 g D S)) ]",
    variables: Object.freeze([
      ["V", "flow velocity (m/s)"],
      ["g", "gravitational acceleration (m/s2)"],
      ["D", "internal pipe diameter (m)"],
      ["S", "hydraulic gradient"],
      ["ks", "equivalent pipe roughness (m)"],
      ["ν", "kinematic viscosity of fluid (m2/s)"]
    ]),
    basis:
      "MSIG Volume III menyatakan bahawa persamaan Colebrook-White dianggap memberikan keputusan yang paling tepat untuk reka bentuk hidraulik.",
    coefficient:
      "Nilai ks hendaklah dipilih berdasarkan bahan paip dan keadaan paip yang disahkan untuk reka bentuk."
  }),
  "hazen-williams": Object.freeze({
    id: "hazen-williams",
    label: "Hazen-Williams",
    equation: "V = 0.849 C R^0.63 S^0.54",
    variables: Object.freeze([
      ["V", "flow velocity (m/s)"],
      ["C", "Hazen-Williams coefficient"],
      ["R", "hydraulic radius (m)"],
      ["S", "hydraulic gradient"]
    ]),
    basis:
      "MSIG Volume III membenarkan persamaan Hazen-Williams sebagai formula hidraulik alternatif yang lebih mudah digunakan.",
    coefficient:
      "Nilai C hendaklah dipilih berdasarkan jenis paip yang disahkan dan disemak sebelum penyerahan."
  }),
  manning: Object.freeze({
    id: "manning",
    label: "Manning",
    equation: "V = (1 / n) R^(2/3) S^(1/2)",
    variables: Object.freeze([
      ["V", "flow velocity (m/s)"],
      ["n", "Manning roughness coefficient"],
      ["R", "hydraulic radius (m)"],
      ["S", "hydraulic gradient"]
    ]),
    basis:
      "MSIG Volume III membenarkan persamaan Manning sebagai formula hidraulik alternatif yang lebih mudah digunakan.",
    coefficient:
      "Nilai n hendaklah dipilih berdasarkan bahan paip dan keadaan paip yang disahkan untuk reka bentuk."
  })
});

function text(value) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function safeFileStem(value) {
  return (
    text(value || "record")
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/[. ]+$/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 120)
      .trim() || "record"
  );
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function numeric(value) {
  if (text(value).trim() === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function createBlankRecord() {
  return {
    control: {
      reportDate: "",
      documentReference: "",
      submissionNumber: ""
    },
    cover: {
      projectTitle: "",
      client: "",
      reportTitle: "LAPORAN KEJURUTERAAN SISTEM PEMBETUNGAN",
      reportCode: "UR20A",
      certificationStatement:
        "SAYA DENGAN INI MENGESAHKAN BAHAWA REKABENTUK INI TELAH DILAKSANAKAN MENGIKUT AMALAN KEJURUTERAAN TERBAIK DAN SAYA MENGAMBIL SEPENUHNYA TANGGUNGJAWAB KE ATAS REKABENTUK TERSEBUT DAN PELAKSANAAN YANG TERATUR.",
      certifierName: "Ir. Dr. ZURAIDA BINTI ZAINI RIJAL",
      certifierRegistration: "",
      certifierRole: "",
      projectOwner: "",
      projectManager: "",
      designTeam: ""
    },
    logos: {
      projectOwner: "",
      projectManager: "",
      designTeam: ""
    },
    narrative: {
      introduction: "",
      introductionAdditional: "",
      objective: "",
      criteriaBasis: "",
      existingSystem: "",
      proposal: "",
      hydraulicBasis: ""
    },
    site: {
      existingSystemStatus: "existing",
      introductionType: "new-school",
      lotNumber: "",
      district: "",
      mukim: "",
      state: "",
      lotArea: "",
      existingSchoolName: ""
    },
    design: {
      peakFactorCoefficient: "3.4"
    },
    criteria: defaultCriteria.map(([item, value, unit]) => ({ item, value, unit })),
    peBasis: "",
    peRows: [{ premises: "", quantity: "", rate: "", subtotalOverride: "" }],
    peAdjustment: "",
    contentsSections: defaultContentsSections.map((section) => ({ ...section })),
    hydraulic: {
      calculationSource: "",
      formulaId: ""
    },
    appendices: defaultAppendices.map(([letter, title, reference]) => ({
      letter,
      title,
      reference
    }))
  };
}

function normaliseRows(rows, defaults, keys) {
  const candidates = Array.isArray(rows) && rows.length ? rows : defaults;
  return candidates.map((row) => {
    const safeRow = plainObject(row);
    return Object.fromEntries(keys.map((key) => [key, text(safeRow[key])]));
  });
}

function normaliseContentsSections(rows) {
  const candidates = Array.isArray(rows) ? rows : [];
  const standardIds = new Set(defaultContentsSections.map((section) => section.id));
  const normaliseSection = (row, index, fallback = {}) => {
    const safeRow = plainObject(row);
    return {
      id: text(safeRow.id) || text(fallback.id) || `custom-${index + 1}`,
      number: text(safeRow.number ?? fallback.number),
      title: text(safeRow.title ?? fallback.title),
      enabled: text(safeRow.enabled) === "no" ? "no" : "yes",
      content: text(safeRow.content)
    };
  };
  const byId = new Map(candidates.map((row) => [text(plainObject(row).id), row]));
  const standardSections = defaultContentsSections.map((fallback, index) =>
    normaliseSection(byId.get(fallback.id) ?? fallback, index, fallback)
  );
  const additionalSections = candidates
    .filter((row) => !standardIds.has(text(plainObject(row).id)))
    .map((row, index) => normaliseSection(row, index + standardSections.length));
  let runningNumber = 1;
  return [...standardSections, ...additionalSections].map((section) => {
    if (section.enabled === "no") {
      return { ...section, number: "" };
    }
    return { ...section, number: `${runningNumber++}.0` };
  });
}

function normaliseRecord(value) {
  const defaults = createBlankRecord();
  const incoming = plainObject(value);
  const control = plainObject(incoming.control);
  const cover = plainObject(incoming.cover);
  const logos = plainObject(incoming.logos);
  const narrative = plainObject(incoming.narrative);
  const site = plainObject(incoming.site);
  const design = plainObject(incoming.design);
  const hydraulic = plainObject(incoming.hydraulic);
  const normalisedCover = Object.fromEntries(
    Object.keys(defaults.cover).map((key) => [key, text(cover[key] ?? defaults.cover[key])])
  );
  if (!REPORT_CODE_OPTIONS.includes(normalisedCover.reportCode)) {
    normalisedCover.reportCode = defaults.cover.reportCode;
  }
  const normalisedControl = Object.fromEntries(
    Object.keys(defaults.control).map((key) => [key, text(control[key] ?? defaults.control[key])])
  );
  if (normalisedCover.reportCode === "UR20A") {
    normalisedControl.documentReference = "";
  }
  const formulaCandidates = [
    text(hydraulic.formulaId),
    ...(Array.isArray(hydraulic.formulaIds) ? hydraulic.formulaIds.map(text) : [])
  ];
  const validFormulaId = formulaCandidates.find((id) => Boolean(HYDRAULIC_FORMULAS[id])) || "";
  const normalisedSite = Object.fromEntries(
    Object.keys(defaults.site).map((key) => [key, text(site[key] ?? defaults.site[key])])
  );
  normalisedSite.existingSystemStatus = ["existing", "new"].includes(
    text(site.existingSystemStatus)
  )
    ? text(site.existingSystemStatus)
    : defaults.site.existingSystemStatus;
  normalisedSite.introductionType = ["new-school", "additional-block", "none"].includes(
    text(site.introductionType)
  )
    ? text(site.introductionType)
    : defaults.site.introductionType;

  return {
    control: normalisedControl,
    cover: normalisedCover,
    logos: Object.fromEntries(
      Object.keys(defaults.logos).map((key) => [key, text(logos[key] ?? defaults.logos[key])])
    ),
    narrative: Object.fromEntries(
      Object.keys(defaults.narrative).map((key) => [
        key,
        text(narrative[key] ?? defaults.narrative[key])
      ])
    ),
    site: normalisedSite,
    design: {
      peakFactorCoefficient: text(
        design.peakFactorCoefficient ?? defaults.design.peakFactorCoefficient
      )
    },
    criteria: normaliseRows(incoming.criteria, defaults.criteria, ["item", "value", "unit"]).filter(
      (criterion) => !/faktor aliran puncak/i.test(criterion.item)
    ),
    peBasis: text(incoming.peBasis),
    peRows: normaliseRows(incoming.peRows, defaults.peRows, [
      "premises",
      "quantity",
      "rate",
      "subtotalOverride"
    ]),
    peAdjustment: text(incoming.peAdjustment),
    contentsSections: normaliseContentsSections(incoming.contentsSections),
    hydraulic: {
      calculationSource: ["excel", "mits"].includes(text(hydraulic.calculationSource))
        ? text(hydraulic.calculationSource)
        : "",
      formulaId: validFormulaId
    },
    appendices: normaliseRows(incoming.appendices, defaults.appendices, [
      "letter",
      "title",
      "reference"
    ])
  };
}

function setPath(record, path, value) {
  const [group, key] = path.split(".");
  if (!record[group] || !(key in record[group])) {
    return;
  }
  record[group][key] = text(value);
}

function getPath(record, path) {
  const [group, key] = path.split(".");
  return text(record[group]?.[key]);
}

function summarisePe(value) {
  const record = normaliseRecord(value);
  const rows = record.peRows
    .map((row) => {
      const quantity = numeric(row.quantity);
      const rate = numeric(row.rate);
      const override = numeric(row.subtotalOverride);
      const subtotal = override ?? (quantity !== null && rate !== null ? quantity * rate : null);
      return { ...row, subtotal, manuallyOverridden: override !== null };
    })
    .filter(
      (row) =>
        row.premises.trim() || row.quantity.trim() || row.rate.trim() || row.subtotal !== null
    );
  const subtotal = rows.reduce((sum, row) => sum + (row.subtotal ?? 0), 0);
  const adjustment = numeric(record.peAdjustment);

  return {
    rows,
    subtotal,
    adjustment: adjustment ?? 0,
    showAdjustment: adjustment !== null,
    total: subtotal + (adjustment ?? 0),
    hasCalculatedValue: rows.some((row) => row.subtotal !== null) || adjustment !== null
  };
}

function calculatePreliminaryDesign(value) {
  const record = normaliseRecord(value);
  const pe = summarisePe(record);
  const coefficient = numeric(record.design.peakFactorCoefficient);
  const exponent = -0.11;
  const flowRateM3PerPeDay = 0.15;

  if (!pe.hasCalculatedValue || pe.total <= 0 || coefficient === null) {
    return {
      pe: pe.total,
      coefficient,
      exponent,
      flowRateM3PerPeDay,
      populationThousands: null,
      adwfLps: null,
      peakFlowFactor: null,
      designPeakFlowLps: null
    };
  }

  const populationThousands = pe.total / 1000;
  const adwfLps = (pe.total * flowRateM3PerPeDay * 1000) / (24 * 60 * 60);
  const peakFlowFactor = coefficient * Math.pow(populationThousands, exponent);

  return {
    pe: pe.total,
    coefficient,
    exponent,
    flowRateM3PerPeDay,
    populationThousands,
    adwfLps,
    peakFlowFactor,
    designPeakFlowLps: adwfLps * peakFlowFactor
  };
}

function activeRows(rows, keys) {
  return rows.filter((row) => keys.some((key) => text(row[key]).trim()));
}

function requiredFieldsMissing(value) {
  const record = normaliseRecord(value);
  const included = (id) =>
    record.contentsSections.some((section) => section.id === id && section.enabled === "yes");
  const required = [
    ["control.reportDate", "Tarikh laporan"],
    ["cover.projectTitle", "Tajuk projek"],
    ["cover.client", "Tetuan / pelanggan"]
  ];
  if (included("2.0")) {
    required.push(["narrative.objective", "Objektif"]);
  }
  if (included("6.0")) {
    required.push(["narrative.proposal", "Cadangan sistem rawatan"]);
  }

  const missing = required
    .filter(([path]) => !getPath(record, path).trim())
    .map(([, label]) => label);
  if (included("8.0")) {
    if (!record.hydraulic.calculationSource) {
      missing.push("Output pengiraan hidraulik");
    }
    if (!record.hydraulic.formulaId) {
      missing.push("Formula hidraulik");
    }
  }
  if (
    included("5.0") &&
    record.site.existingSystemStatus === "existing" &&
    !record.narrative.existingSystem.trim()
  ) {
    missing.push("Sejarah tapak dan sistem sedia ada");
  }
  return missing;
}

globalThis.SwaReportModel = Object.freeze({
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
});
})();
