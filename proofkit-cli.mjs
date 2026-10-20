// proofkit-cli.mjs — the CLI. Read-only. It never contacts a network and never
// spawns a process; every operation is local hashing over data you supply.
//
//   node proofkit-cli.mjs --example                 build and show the example pack
//   node proofkit-cli.mjs --example --json          the example pack as JSON
//   node proofkit-cli.mjs --build <file.json>       build a pack from a claims file
//   node proofkit-cli.mjs --verify <pack.json>      verify a pack's INTEGRITY
//   node proofkit-cli.mjs --canonical <file.json>   print the canonical bytes only
//   node proofkit-cli.mjs --hash <file>             sha256 of any file, for by-hand checking
//   node proofkit-cli.mjs --boundaries              every non-claim
//   node proofkit-cli.mjs --help
//
// A "claims file" is JSON: { scope, claims:[{key,kind,value,basis}], evidence, label }.
//
// Exit codes for --verify: 0 intact, 1 tampered, 2 invalid (no conclusion).

import { readFileSync } from "node:fs";
import { buildPack, verifyPack, renderPack, renderVerification, packToJSON, verificationToJSON, packCanonicalBytes, sha256Hex, PROOF_PACK_FORMAT } from "./pack.mjs";
import { BOUNDARIES, INTEGRITY_NOT_TRUTH, SCOPE_NOT_UNIVERSAL, REPRODUCE_NOT_TRUST, CLAIM_KINDS, CANONICAL_SPEC } from "./lib.mjs";
import { SAMPLE_SCOPE, SAMPLE_CLAIMS, SAMPLE_EVIDENCE } from "./fixtures.mjs";

const args = process.argv.slice(2);
const has = (k) => args.includes(k);
const after = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] ?? null : null);

function examplePack() {
  return buildPack({
    scope: SAMPLE_SCOPE,
    claims: SAMPLE_CLAIMS,
    evidence: SAMPLE_EVIDENCE,
    label: "example: measured Soroban RPC facts, 2026-10-19",
  });
}

function readJSON(path) {
  const raw = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function usage() {
  console.log(
    [
      "pi-proofkit — portable proof packs with offline verification",
      "",
      "  node proofkit-cli.mjs --example                 build and show the example pack",
      "  node proofkit-cli.mjs --example --json          the example pack as JSON",
      "  node proofkit-cli.mjs --build <claims.json>     build a pack from a claims file",
      "  node proofkit-cli.mjs --verify <pack.json>      verify a pack's integrity",
      "  node proofkit-cli.mjs --canonical <claims.json> print the canonical bytes only",
      "  node proofkit-cli.mjs --hash <file>             sha256 of any file",
      "  node proofkit-cli.mjs --boundaries              every non-claim",
      "",
      "Exit codes for --verify:",
      "  0  intact   — the recomputed digest matches the recorded one",
      "  1  tampered — the digests differ; the pack was altered",
      "  2  invalid  — the pack is malformed; NO conclusion is drawn",
      "",
      "A digest proves INTEGRITY, not TRUTH.",
      `  ${INTEGRITY_NOT_TRUTH}`,
    ].join("\n")
  );
}

if (args.length === 0 || has("--help") || has("-h")) usage();
else if (has("--boundaries")) {
  console.log("=== PI PROOFKIT — boundaries ===");
  console.log("");
  for (const b of BOUNDARIES) console.log(`  - ${b}`);
  console.log("");
  console.log(`  digest:    ${CANONICAL_SPEC.algorithm}:${CANONICAL_SPEC.encoding} over "${CANONICAL_SPEC.line}" lines joined by \\n`);
  console.log(`  ${INTEGRITY_NOT_TRUTH}`);
  console.log(`  ${SCOPE_NOT_UNIVERSAL}`);
  console.log(`  ${REPRODUCE_NOT_TRUST}`);
} else if (has("--hash")) {
  const f = after("--hash");
  if (!f) { console.error("--hash needs a file"); process.exitCode = 2; }
  else {
    const bytes = readFileSync(f);
    const hex = sha256Hex(bytes.toString("utf8"));
    console.log(`${hex}  ${f}`);
  }
} else if (has("--canonical")) {
  const f = after("--canonical");
  if (!f) { console.error("--canonical needs a file"); process.exitCode = 2; }
  else {
    const spec = readJSON(f);
    const bytes = packCanonicalBytes({ claims: spec.claims });
    process.stdout.write(bytes + "\n");
  }
} else if (has("--build")) {
  const f = after("--build");
  if (!f) { console.error("--build needs a file"); process.exitCode = 2; }
  else {
    const spec = readJSON(f);
    try {
      const pack = buildPack({
        scope: spec.scope,
        claims: spec.claims,
        evidence: spec.evidence ?? {},
        label: spec.label ?? null,
      });
      console.log(has("--json") ? packToJSON(pack) : renderPack(pack));
    } catch (e) {
      console.error(`ERROR: ${e.message}`);
      process.exitCode = 2;
    }
  }
} else if (has("--verify")) {
  const f = after("--verify");
  if (!f) { console.error("--verify needs a file"); process.exitCode = 2; }
  else {
    let pack;
    try {
      pack = readJSON(f);
    } catch (e) {
      console.error(`ERROR: cannot read the pack: ${e.message}`);
      process.exitCode = 2;
    }
    if (pack) {
      const result = verifyPack(pack);
      console.log(has("--json") ? verificationToJSON(result) : renderVerification(result));
      if (result.verdict === "invalid") process.exitCode = 2;
      else if (result.verdict === "tampered") process.exitCode = 1;
      else process.exitCode = 0;
    }
  }
} else if (has("--example")) {
  const pack = examplePack();
  console.log(has("--json") ? packToJSON(pack) : renderPack(pack));
} else usage();
