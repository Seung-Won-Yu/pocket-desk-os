/**
 * Reading `npm audit --json` for the runtime gate.
 *
 * npm is retiring the endpoint `npm audit --omit=dev` calls, and it now
 * answers 500/503/400 or an HTML error page at random. A transport failure is
 * not a security result: the gate must not pass a real advisory, and must not
 * fail a build because a registry is down. So the two cases are told apart.
 */

/** Severities that fail the gate, matching `--audit-level=high`. */
export const BLOCKING_SEVERITIES = ["critical", "high"];

/**
 * @param {string} stdout raw stdout from `npm audit --json --omit=dev`
 * @returns {{ counts?: Record<string, number>, kind: "clean" | "unavailable" | "vulnerable", reason?: string }}
 */
export function decideAuditOutcome(stdout) {
  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    return {
      kind: "unavailable",
      reason: "npm audit returned no JSON (an error page, most likely)",
    };
  }
  const counts = report?.metadata?.vulnerabilities;
  if (!counts || typeof counts !== "object") {
    const reason =
      typeof report?.error === "string"
        ? report.error
        : typeof report?.error?.summary === "string"
          ? report.error.summary
          : "npm audit reported no vulnerability counts";
    return { kind: "unavailable", reason };
  }
  const blocking = BLOCKING_SEVERITIES.reduce(
    (total, severity) => total + (Number(counts[severity]) || 0),
    0,
  );
  return blocking > 0 ? { counts, kind: "vulnerable" } : { counts, kind: "clean" };
}

/** One line for the gate's output. */
export function formatAuditOutcome(outcome) {
  if (outcome.kind === "unavailable") {
    return `audit:runtime skipped — ${outcome.reason}. Runtime dependencies were NOT checked.`;
  }
  const counts = outcome.counts ?? {};
  const summary = ["critical", "high", "moderate", "low"]
    .map((severity) => `${severity} ${Number(counts[severity]) || 0}`)
    .join(", ");
  return outcome.kind === "clean"
    ? `audit:runtime clean — ${summary}`
    : `audit:runtime FAILED — ${summary}`;
}
