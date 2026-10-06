// Run once before final benchmark. Further revisions require a new holdout version.
import fs from "node:fs";
import { hash, readJson } from "./w3-p4-eval.mjs";
const root = new URL("../", import.meta.url),
  destination = new URL("docs/ai/eval-final/freeze-manifest.json", root);
if (fs.existsSync(destination))
  throw Error("Holdout is already frozen; do not overwrite its manifest.");
const paths = [
  "docs/ai/eval-final/cases.final.json",
  "docs/ai/eval-dev/cases.dev.json",
  "docs/ai/eval-dev/rules.json",
  "scripts/w3-p4-eval.mjs",
];
const manifest = {
  version: "W3-P4-initial-1",
  frozenAt: new Date().toISOString(),
  developmentCount: readJson(paths[1]).cases.length,
  finalCount: readJson(paths[0]).cases.length,
  labelAuthority: "ENGINEERING_EXPECTATION_UNCONFIRMED_BY_DOMAIN_EXPERT",
  blindExternalEvaluation: false,
  notice:
    "Initial synthetic holdout authored by developer, not an independent domain benchmark. Do not tune after final execution.",
  hashes: Object.fromEntries(
    paths.map((p) => [p, hash(fs.readFileSync(new URL(p, root)))]),
  ),
};
fs.writeFileSync(destination, JSON.stringify(manifest, null, 2) + "\n");
console.log("Frozen W3-P4 dev/rules/evaluator and final holdout hashes.");
