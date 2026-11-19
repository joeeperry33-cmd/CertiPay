import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildEcprXml } from "./ecpr";
import { buildCertifiedPayroll } from "./certified";
import { sampleData } from "../store/sample";
import { addDays } from "../dates";

const week = "2026-11-16";
const XSD = join(__dirname, "../../../test/fixtures/ecpr-v2-reconstructed.xsd");

function hasXmllint() {
  try {
    execFileSync("xmllint", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function validate(xml: string) {
  const dir = mkdtempSync(join(tmpdir(), "ecpr-"));
  const file = join(dir, "payroll.xml");
  writeFileSync(file, xml);
  execFileSync("xmllint", ["--noout", "--schema", XSD, file], { stdio: "pipe" });
}

function sample() {
  const data = sampleData(week);
  return {
    data,
    input: {
      report: buildCertifiedPayroll(data, "p1", week),
      classifications: data.classifications,
      taxIds: { e1: { ssn: "123-45-1234" }, e2: { itin: "912785678" } },
      checkNumbers: { e1: "1001", e2: "1002" },
    },
  };
}

describe("DIR eCPR V2 XML", () => {
  it("builds a file with no problems from complete sample data", () => {
    const { xml, errors } = buildEcprXml(sample().input);
    expect(errors).toEqual([]);
    expect(xml).toContain('<CPR:eCPR xmlns:CPR="https://www.dir.ca.gov/Public-Works/CPR/eCPR-v2.xsd">');
    expect(xml).toContain("<CPR:version>2.0</CPR:version>");
    expect(xml).toContain("<CPR:forWeekEnding>2026-11-22</CPR:forWeekEnding>");
    expect(xml).toContain("<CPR:statementOfNP>false</CPR:statementOfNP>");
    expect(xml).toContain("<CPR:ssn>123451234</CPR:ssn>");
    expect(xml).toContain("<CPR:itin>912785678</CPR:itin>");
  });

  it.runIf(hasXmllint())("validates against the V2 schema structure", () => {
    expect(() => validate(buildEcprXml(sample().input).xml)).not.toThrow();
  });

  it("reports hours per day and totals that add up", () => {
    const { xml } = buildEcprXml(sample().input);
    const maria = xml.slice(xml.indexOf("<CPR:firstName>Maria"), xml.indexOf("</CPR:employee>"));
    expect(maria.match(/<CPR:day id="\d">/g)).toHaveLength(7);
    expect(maria).toContain('<CPR:day id="5">\n');
    expect(maria).toMatch(/<CPR:date>2026-11-20<\/CPR:date>\s*<CPR:straightTime>8.00<\/CPR:straightTime>\s*<CPR:overtime>2.00</);
    expect(maria).toContain("<CPR:totHrsStraightTime>40.00</CPR:totHrsStraightTime>");
    expect(maria).toContain("<CPR:totHrsOvertime>2.00</CPR:totHrsOvertime>");
  });

  it("uses base rate plus all fringe for total rates", () => {
    const { xml } = buildEcprXml(sample().input);
    // Laborer: 38.50 + fringe 23.13 = 61.63; OT 57.75 + 23.13 = 80.88
    expect(xml).toContain("<CPR:totalHrlyPayRateStraightTime>61.63</CPR:totalHrlyPayRateStraightTime>");
    expect(xml).toContain("<CPR:totalHrlyPayRateOvertime>80.88</CPR:totalHrlyPayRateOvertime>");
    expect(xml).toContain("<CPR:paidToEmployee>true</CPR:paidToEmployee>");
    expect(xml).toContain("<CPR:paidToBenefitPlan>true</CPR:paidToBenefitPlan>"); // training fund
  });

  it("puts union dues in dues and totals deductions", () => {
    const { input } = sample();
    const { xml } = buildEcprXml(input);
    const maria = input.report.rows[0].check!;
    expect(xml).toContain("<CPR:dues>25.00</CPR:dues>");
    expect(xml).toContain(`<CPR:totalDeductions>${(maria.totalDeductions / 100).toFixed(2)}</CPR:totalDeductions>`);
    expect(xml).toContain(
      `<CPR:FICA>${((maria.socialSecurity + maria.medicare) / 100).toFixed(2)}</CPR:FICA>`,
    );
  });

  it("lists what is missing instead of producing a bad file", () => {
    const { input } = sample();
    const { errors } = buildEcprXml({ ...input, taxIds: {}, checkNumbers: { e1: "1001" } });
    expect(errors).toEqual([
      "Maria Lopez: enter the full 9-digit SSN or ITIN.",
      "James Carter: enter the full 9-digit SSN or ITIN.",
      "James Carter: enter a check number (or CASH), up to 20 characters.",
    ]);
  });

  it.runIf(hasXmllint())("writes a statement of non-performance for a week with no work", () => {
    const { data, input } = sample();
    const extra = {
      ...data,
      entries: [...data.entries, { id: "x", employeeId: "e1", projectId: "p1", classificationId: "c1", date: addDays(week, 14), hours: 800 }],
    };
    const report = buildCertifiedPayroll(extra, "p1", addDays(week, 7));
    const { xml, errors } = buildEcprXml({ ...input, report });
    expect(errors).toEqual([]);
    expect(xml).toContain("<CPR:statementOfNP>true</CPR:statementOfNP>");
    expect(xml).not.toContain("<CPR:employee>");
    validate(xml);
  });

  it("escapes special characters", () => {
    const { input } = sample();
    const report = { ...input.report, company: { ...input.report.company, name: "Smith & Sons <West>" } };
    expect(buildEcprXml({ ...input, report }).xml).toContain("Smith &amp; Sons &lt;West&gt;");
  });
});
