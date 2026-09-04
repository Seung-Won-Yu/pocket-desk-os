#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { decideAuditOutcome, formatAuditOutcome } from "./auditReport.mjs";

const result = spawnSync("npm", ["audit", "--omit=dev", "--json"], {
  encoding: "utf8",
  shell: false,
});
const outcome = decideAuditOutcome(result.stdout ?? "");
console.log(formatAuditOutcome(outcome));
if (outcome.kind === "vulnerable") process.exit(1);
if (outcome.kind === "unavailable" && result.stderr) {
  // Keep the registry's own words in the log so a real outage is recognisable.
  console.log(result.stderr.trim().split("\n").slice(0, 4).join("\n"));
}
