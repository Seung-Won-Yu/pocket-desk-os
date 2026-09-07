import { describe, expect, it } from "vitest";
// The runtime-audit gate's decision, kept pure so it can be tested without a registry.
// @ts-expect-error -- a plain .mjs build script, deliberately untyped
import * as auditReport from "../../scripts/auditReport.mjs";

const { decideAuditExit, decideAuditOutcome, formatAuditOutcome } = auditReport;

const report = (vulnerabilities: Record<string, number>) =>
  JSON.stringify({ metadata: { vulnerabilities } });

describe("decideAuditOutcome", () => {
  it("passes a report with nothing high or critical", () => {
    const outcome = decideAuditOutcome(
      report({ critical: 0, high: 0, moderate: 2, low: 5, info: 0, total: 7 }),
    );
    expect(outcome.kind).toBe("clean");
    expect(formatAuditOutcome(outcome)).toContain("clean");
  });

  it("fails on a high or a critical advisory", () => {
    expect(decideAuditOutcome(report({ critical: 0, high: 1 })).kind).toBe("vulnerable");
    expect(decideAuditOutcome(report({ critical: 2, high: 0 })).kind).toBe("vulnerable");
    expect(formatAuditOutcome(decideAuditOutcome(report({ high: 1 })))).toContain("FAILED");
  });

  it("calls a registry outage unavailable, not clean", () => {
    const html = decideAuditOutcome("<!doctype html><html>500</html>");
    expect(html.kind).toBe("unavailable");
    expect(formatAuditOutcome(html)).toContain("NOT checked");
    const jsonError = decideAuditOutcome(JSON.stringify({ error: "Internal Server Error" }));
    expect(jsonError).toMatchObject({ kind: "unavailable", reason: "Internal Server Error" });
    expect(decideAuditOutcome("").kind).toBe("unavailable");
  });
});

describe("decideAuditExit", () => {
  it("passes a clean audit and fails a real advisory, strict or not", () => {
    expect(decideAuditExit({ kind: "clean" })).toBe(0);
    expect(decideAuditExit({ kind: "clean" }, { strict: true })).toBe(0);
    expect(decideAuditExit({ kind: "vulnerable" })).toBe(1);
    expect(decideAuditExit({ kind: "vulnerable" }, { strict: true })).toBe(1);
  });

  it("lets an outage through the everyday gate and stops it at a release", () => {
    // A registry outage is not a security result, so it must not fail every
    // commit — but a version must never be tagged on an audit that never ran.
    expect(decideAuditExit({ kind: "unavailable" })).toBe(0);
    expect(decideAuditExit({ kind: "unavailable" }, { strict: false })).toBe(0);
    expect(decideAuditExit({ kind: "unavailable" }, { strict: true })).toBe(1);
  });
});
