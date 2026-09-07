#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { decideAuditExit, decideAuditOutcome, formatAuditOutcome } from "./auditReport.mjs";

const result = spawnSync("npm", ["audit", "--omit=dev", "--json"], {
  encoding: "utf8",
  shell: false,
});
const strict = process.argv.includes("--strict");
const outcome = decideAuditOutcome(result.stdout ?? "");
console.log(formatAuditOutcome(outcome));
if (outcome.kind === "unavailable" && result.stderr) {
  // Keep the registry's own words in the log so a real outage is recognisable.
  console.log(result.stderr.trim().split("\n").slice(0, 4).join("\n"));
}
if (strict && outcome.kind === "unavailable") {
  console.error("audit:runtime --strict: refusing to release on an audit that did not run.");
}
process.exit(decideAuditExit(outcome, { strict }));
