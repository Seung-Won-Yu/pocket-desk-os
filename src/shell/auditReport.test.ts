import { describe, expect, it } from "vitest";
// The runtime-audit gate's decision, kept pure so it can be tested without a registry.
// @ts-expect-error -- a plain .mjs build script, deliberately untyped
import { decideAuditOutcome, formatAuditOutcome } from "../../scripts/auditReport.mjs";

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
