// proofkit.test.mjs — invariant tests. Offline: no network, no clock dependence.
//
// They cover the canonical form, the claim rules, the three verification
// verdicts, and — the load-bearing part — that the digest is reproducible by an
// INDEPENDENT implementation. A digest only one tool can reproduce is a
// signature, not a proof. The suite hashes the canonical bytes with node's own
// crypto in a second place and compares, and it verifies against a hand-written
// expected canonical string so the form cannot silently drift.

import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CLAIM_KINDS, CLAIM_KIND_IDS, FORBIDDEN_CLAIMS, INTEGRITY_NOT_TRUTH,
  SCOPE_NOT_UNIVERSAL, REPRODUCE_NOT_TRUST, CANONICAL_SPEC,
  canonicalLine, canonicalBytes, isValidKey, validateClaim, validateClaims, BOUNDARIES,
} from "../lib.mjs";
import {
  buildPack, verifyPack, verifyDigest, sha256Hex, packCanonicalBytes,
  renderPack, renderVerification, packToJSON, verificationToJSON, PROOF_PACK_FORMAT,
} from "../pack.mjs";
import { SAMPLE_SCOPE, SAMPLE_CLAIMS, SAMPLE_EVIDENCE } from "../fixtures.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else { fail++; failures.push(label); } };
const eq = (a, b, label) => { const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) pass++; else { fail++; failures.push(`${label}\n    expected: ${B}\n    actual:   ${A}`); } };
const includes = (hay, needle, label) => ok(String(hay).includes(needle), `${label} (looking for "${needle}")`);

// --- the honesty contract ----------------------------------------------------
eq(CLAIM_KINDS.length, 5, "five claim kinds");
for (const id of ["measured", "documented", "derived", "asserted", "not-claimed"]) {
  ok(CLAIM_KIND_IDS.includes(id), `claim kind "${id}" exists`);
}
ok(CLAIM_KINDS.some((c) => c.id === "asserted"), "there is an explicit 'asserted' kind for claims with no measurement");
includes(CLAIM_KINDS.find((c) => c.id === "asserted").meaning, "weakest", "the asserted kind is marked as the weakest");
includes(INTEGRITY_NOT_TRUTH, "INTEGRITY, not TRUTH", "the central non-claim is stated");
includes(INTEGRITY_NOT_TRUTH, "does NOT mean the claims are correct", "the non-claim says integrity is not truth");
includes(SCOPE_NOT_UNIVERSAL, "scoped", "the scope non-claim is stated");
includes(REPRODUCE_NOT_TRUST, "do not have to trust", "the reproduce-not-trust principle is stated");
ok(FORBIDDEN_CLAIMS.some((c) => /proves the claim is true/i.test(c)), "forbids claiming a digest proves truth");
ok(FORBIDDEN_CLAIMS.some((c) => /mathematically proven|cannot be wrong/i.test(c)), "forbids an absolute claim");
ok(FORBIDDEN_CLAIMS.some((c) => /the official/i.test(c)), "forbids claiming official status");

// --- the canonical form is fully specified -----------------------------------
eq(CANONICAL_SPEC.algorithm, "sha256", "the digest algorithm is sha256");
eq(CANONICAL_SPEC.encoding, "hex", "the digest encoding is hex");
includes(CANONICAL_SPEC.line, "{key}", "the canonical line names the key field");
includes(CANONICAL_SPEC.line, "{kind}", "the canonical line names the kind field");
includes(CANONICAL_SPEC.line, "{value}", "the canonical line names the value field");
includes(CANONICAL_SPEC.line, "{basis}", "the canonical line names the basis field");
ok(CANONICAL_SPEC.excludes.some((e) => /digest itself/i.test(e)), "the spec says the digest is not hashed into itself");
ok(CANONICAL_SPEC.excludes.some((e) => /evidence/i.test(e)), "the spec says evidence is referenced, not hashed");

// the exact canonical line for a known claim
eq(canonicalLine({ key: "a", kind: "measured", value: 1, basis: "b" }), "a|measured|1|b", "a canonical line joins fields with a pipe");
eq(canonicalLine({ key: "a", kind: "measured", value: null, basis: null }), "a|measured|null|null", "null value and basis are spelled 'null'");
eq(canonicalLine({ key: "a", kind: "documented", value: false, basis: "u" }), "a|documented|false|u", "a boolean value is spelled as JSON");
eq(canonicalLine({ key: "a", kind: "derived", value: undefined, basis: undefined }), "a|derived|null|null", "undefined is spelled 'null'");

// the exact canonical bytes for a two-claim set, hand-written
const twoClaims = [
  { key: "k1", kind: "measured", value: "v1", basis: "b1" },
  { key: "k2", kind: "derived", value: 2, basis: "b2" },
];
eq(canonicalBytes(twoClaims), "k1|measured|v1|b1\nk2|derived|2|b2", "canonical bytes join lines with \\n and no trailing newline");

// --- key and claim validation ------------------------------------------------
ok(isValidKey("a"), "a single letter is a valid key");
ok(isValidKey("network.passphrase"), "a dotted key is valid");
ok(isValidKey("a-b_c.1"), "dots, dashes and underscores are valid");
ok(!isValidKey(""), "an empty key is invalid");
ok(!isValidKey("1 leading space"), "a key with a space is invalid");
ok(!isValidKey("a|b"), "a key with a pipe is invalid");
ok(!isValidKey(null), "a null key is invalid");

eq(validateClaim({ key: "a", kind: "measured", value: 1, basis: "b" }).valid, true, "a well-formed measured claim is valid");
eq(validateClaim({ key: "a", kind: "nonsense", value: 1, basis: "b" }).valid, false, "an unknown kind is invalid");
eq(validateClaim({ key: "a", kind: "measured", value: 1 }).valid, false, "a measured claim with NO basis is invalid");
eq(validateClaim({ key: "a", kind: "asserted", value: 1 }).valid, true, "an asserted claim may omit a basis (it has no measurement)");
eq(validateClaim({ key: "a", kind: "measured", value: "x|y", basis: "b" }).valid, false, "a value with a pipe is invalid (ambiguous form)");
eq(validateClaim({ key: "a", kind: "measured", value: 1, basis: "x\ny" }).valid, false, "a basis with a newline is invalid (ambiguous form)");

eq(validateClaims([]).valid, false, "a pack with no claims is invalid");
eq(validateClaims(twoClaims).valid, true, "a well-formed claim set is valid");
{
  const dup = [twoClaims[0], twoClaims[0]];
  const r = validateClaims(dup);
  eq(r.valid, false, "duplicate keys make a claim set invalid");
  eq(r.duplicates, ["k1"], "duplicate keys are reported");
}
eq(validateClaims("not an array").valid, false, "a non-array claim set is invalid");

// --- building a pack ---------------------------------------------------------
{
  const pack = buildPack({ scope: SAMPLE_SCOPE, claims: SAMPLE_CLAIMS, evidence: SAMPLE_EVIDENCE, label: "x" });
  eq(pack.format, PROOF_PACK_FORMAT, "the pack carries the format version");
  eq(pack.claims.length, SAMPLE_CLAIMS.length, "the pack carries every claim");
  eq(pack.digest.algorithm, "sha256", "the pack digest is sha256");
  ok(/^[0-9a-f]{64}$/.test(pack.digest.sha256), "the pack digest is 64 hex chars");
  eq(pack.canonical.lineCount, SAMPLE_CLAIMS.length, "the canonical line count matches the claim count");
  eq(pack.canonical.byteLength, Buffer.byteLength(pack.canonical.bytes, "utf8"), "the canonical byte length is the true UTF-8 length");
  eq(pack.disclaimer.length, 3, "the pack carries the three disclaimers");
  ok(pack.boundaries.length >= 6, "the pack carries the boundaries");
}
{
  // building with malformed claims THROWS, with the errors attached
  let threw = null;
  try { buildPack({ scope: SAMPLE_SCOPE, claims: [{ key: "a", kind: "measured", value: 1 }] }); } catch (e) { threw = e; }
  ok(threw !== null, "building an invalid pack throws");
  ok(Array.isArray(threw.errors) && threw.errors.length >= 1, "the thrown error carries the validation errors");
}
{
  let threw = null;
  try { buildPack({ scope: SAMPLE_SCOPE, claims: [twoClaims[0], twoClaims[0]] }); } catch (e) { threw = e; }
  ok(threw !== null, "building a pack with duplicate keys throws");
}

// evidence is attached only for claims that exist
{
  const pack = buildPack({ scope: SAMPLE_SCOPE, claims: twoClaims, evidence: { k1: "e1", nope: "e2" } });
  eq(Object.keys(pack.evidence), ["k1"], "evidence is attached only for existing claims");
  eq(pack.evidence.nope, undefined, "evidence for an unknown key is dropped");
}

// --- the digest is reproducible by an INDEPENDENT implementation -------------
{
  const pack = buildPack({ scope: SAMPLE_SCOPE, claims: SAMPLE_CLAIMS, evidence: SAMPLE_EVIDENCE });
  const independent = createHash("sha256").update(pack.canonical.bytes, "utf8").digest("hex");
  eq(independent, pack.digest.sha256, "an independent sha256 of the canonical bytes matches the pack digest");
  eq(sha256Hex(pack.canonical.bytes), pack.digest.sha256, "the library's own sha256 matches");
  eq(packCanonicalBytes(pack), pack.canonical.bytes, "the exported canonical bytes equal the pack's canonical bytes");
}

// a KNOWN digest, pinned: guard against a silent change to the canonical form
{
  const fixed = [{ key: "a", kind: "measured", value: 1, basis: "b" }];
  // sha256 of the exact string "a|measured|1|b"
  const expected = createHash("sha256").update("a|measured|1|b", "utf8").digest("hex");
  eq(sha256Hex(canonicalBytes(fixed)), expected, "the digest of a one-claim pack is exactly sha256('a|measured|1|b')");
  ok(/^[0-9a-f]{64}$/.test(expected), "the pinned digest is well-formed");
}

// --- the three verification verdicts -----------------------------------------
{
  const pack = buildPack({ scope: SAMPLE_SCOPE, claims: SAMPLE_CLAIMS, evidence: SAMPLE_EVIDENCE, label: "ok" });
  const r = verifyPack(pack);
  eq(r.verdict, "intact", "a freshly built pack verifies intact");
  eq(r.recomputed, r.recorded, "intact: recomputed equals recorded");
  eq(r.integrityNotTruth, INTEGRITY_NOT_TRUTH, "the verification carries the integrity-not-truth disclaimer");
  ok(Array.isArray(r.disclaimer) && r.disclaimer.length === 3, "the verification carries the three disclaimers");
}
{
  // tampER: change a value after the digest was taken
  const pack = buildPack({ scope: SAMPLE_SCOPE, claims: SAMPLE_CLAIMS, evidence: SAMPLE_EVIDENCE });
  pack.claims[0].value = "changed";
  const r = verifyPack(pack);
  eq(r.verdict, "tampered", "a pack altered after hashing verifies tampered");
  ok(r.recomputed !== r.recorded, "tampered: recomputed differs from recorded");
  includes(r.reason, "does NOT match", "tampered: the reason says it does not match");
}
{
  // changing the BASIS alone must also be caught — the basis is in the digest
  const pack = buildPack({ scope: SAMPLE_SCOPE, claims: SAMPLE_CLAIMS, evidence: SAMPLE_EVIDENCE });
  pack.claims[0].basis = "a different provenance";
  eq(verifyPack(pack).verdict, "tampered", "changing a BASIS alone is caught (the basis is inside the digest)");
}
{
  // changing the EVIDENCE alone must NOT be caught — evidence is referenced, not hashed
  const pack = buildPack({ scope: SAMPLE_SCOPE, claims: SAMPLE_CLAIMS, evidence: SAMPLE_EVIDENCE });
  pack.evidence["node.version"] = "a totally different evidence string";
  eq(verifyPack(pack).verdict, "intact", "changing evidence alone is NOT caught (evidence is outside the digest, by spec)");
}
{
  // reordering claims changes the digest
  const pack = buildPack({ scope: SAMPLE_SCOPE, claims: SAMPLE_CLAIMS, evidence: SAMPLE_EVIDENCE });
  const reordered = { ...pack, claims: [...pack.claims].reverse() };
  eq(verifyPack(reordered).verdict, "tampered", "reordering claims changes the digest (order is significant)");
}
{
  // invalid: unknown format
  eq(verifyPack({ format: "something-else", claims: [] }).verdict, "invalid", "an unknown format is invalid");
  eq(verifyPack(null).verdict, "invalid", "a null pack is invalid");
  eq(verifyPack({ format: PROOF_PACK_FORMAT, claims: "nope" }).verdict, "invalid", "a non-array claims field is invalid");
  eq(verifyPack({ format: PROOF_PACK_FORMAT, claims: [{ key: "a", kind: "measured", value: 1 }] }).verdict, "invalid", "a pack with a basis-less measured claim is invalid");
  eq(verifyPack({ format: PROOF_PACK_FORMAT, claims: [{ key: "a", kind: "measured", value: 1, basis: "b" }] }).verdict, "invalid", "a pack with no recorded digest is invalid");
  eq(verifyPack({ format: PROOF_PACK_FORMAT, claims: [{ key: "a", kind: "measured", value: 1, basis: "b" }], digest: { sha256: "xyz" } }).verdict, "invalid", "a malformed recorded digest is invalid");
}
// an invalid verdict must never look like a pass or a fail
{
  const r = verifyPack({ format: "nope", claims: [] });
  ok(r.verdict === "invalid", "invalid is its own verdict");
  ok(r.verdict !== "intact" && r.verdict !== "tampered", "invalid is neither intact nor tampered");
}

// --- verifyDigest (the rawest form) ------------------------------------------
{
  const hex = sha256Hex(canonicalBytes(twoClaims));
  eq(verifyDigest(hex, twoClaims).verdict, "intact", "verifyDigest accepts the correct digest");
  eq(verifyDigest("0".repeat(64), twoClaims).verdict, "tampered", "verifyDigest rejects a wrong digest");
  eq(verifyDigest(null, twoClaims).verdict, "tampered", "verifyDigest rejects a missing digest");
  eq(verifyDigest("x", "not-an-array").verdict, "invalid", "verifyDigest marks a malformed claim set invalid");
  eq(verifyDigest(hex, twoClaims).integrityNotTruth, INTEGRITY_NOT_TRUTH, "verifyDigest carries the disclaimer");
}

// --- rendering ---------------------------------------------------------------
{
  const pack = buildPack({ scope: SAMPLE_SCOPE, claims: SAMPLE_CLAIMS, evidence: SAMPLE_EVIDENCE, label: "render-me" });
  const t = renderPack(pack);
  includes(t, "PROOF PACK", "the pack rendering has a title");
  includes(t, "render-me", "the pack rendering shows the label");
  includes(t, "CLAIMS", "the pack rendering shows the claims section");
  includes(t, "EVIDENCE", "the pack rendering shows the evidence section");
  includes(t, "CANONICAL BYTES", "the pack rendering shows the canonical bytes section");
  includes(t, "network.passphrase", "the pack rendering lists a known claim");
  includes(t, pack.digest.sha256, "the pack rendering shows the digest");
  includes(t, INTEGRITY_NOT_TRUTH, "the pack rendering carries the disclaimer");
}
{
  const pack = buildPack({ scope: SAMPLE_SCOPE, claims: SAMPLE_CLAIMS, evidence: SAMPLE_EVIDENCE });
  const t = renderVerification(verifyPack(pack));
  includes(t, "INTEGRITY only", "the verification rendering says it is integrity only");
  includes(t, "INTACT", "the verification rendering marks intact");
  includes(t, INTEGRITY_NOT_TRUTH, "the verification rendering carries the disclaimer");
  const tampered = { ...pack, claims: [{ ...pack.claims[0], value: "x" }] };
  includes(renderVerification(verifyPack(tampered)), "TAMPERED", "the verification rendering marks tampered");
}

// --- JSON --------------------------------------------------------------------
{
  const pack = buildPack({ scope: SAMPLE_SCOPE, claims: SAMPLE_CLAIMS, evidence: SAMPLE_EVIDENCE });
  const j = JSON.parse(packToJSON(pack));
  eq(j.tool, "pi-proofkit", "JSON names the tool");
  eq(j.mode, "pack", "JSON names the mode");
  eq(j.pack.format, PROOF_PACK_FORMAT, "JSON carries the format");
  eq(j.pack.claims.length, SAMPLE_CLAIMS.length, "JSON carries every claim");
  eq(j.pack.digest.sha256, pack.digest.sha256, "JSON carries the digest");
  ok(Array.isArray(j.pack.disclaimer) && j.pack.disclaimer.length === 3, "JSON carries the disclaimers");
}
{
  const pack = buildPack({ scope: SAMPLE_SCOPE, claims: SAMPLE_CLAIMS, evidence: SAMPLE_EVIDENCE });
  const j = JSON.parse(verificationToJSON(verifyPack(pack)));
  eq(j.mode, "verify", "the verification JSON names its mode");
  eq(j.result.verdict, "intact", "the verification JSON carries the verdict");
  eq(j.result.integrityNotTruth, INTEGRITY_NOT_TRUTH, "the verification JSON carries the disclaimer");
}

// --- the example pack (the shipped fixture) ----------------------------------
{
  const pack = buildPack({ scope: SAMPLE_SCOPE, claims: SAMPLE_CLAIMS, evidence: SAMPLE_EVIDENCE, label: "example" });
  eq(verifyPack(pack).verdict, "intact", "the shipped example pack verifies intact");
  // every measured claim in the fixture must carry a basis
  for (const c of SAMPLE_CLAIMS) {
    if (c.kind === "measured") ok(typeof c.basis === "string" && c.basis.length > 0, `fixture claim ${c.key}: a measured claim carries a basis`);
  }
  ok(SAMPLE_CLAIMS.some((c) => c.kind === "derived"), "the fixture includes a derived claim");
  ok(SAMPLE_CLAIMS.some((c) => c.kind === "measured"), "the fixture includes a measured claim");
}

// --- documents and links -----------------------------------------------------
const docs = [
  "README.md", "llms.txt", "docs/INDEX.md", "docs/PROOF-PACKS.md", "docs/CANONICAL-FORM.md",
  "docs/VERIFICATION.md", "docs/DECISIONS.md", "docs/SOURCES.md", "docs/BOUNDARIES.md",
];
for (const d of docs) {
  try { readFileSync(join(root, d), "utf8"); pass++; } catch { fail++; failures.push(`missing doc: ${d}`); }
}

const mdFiles = [];
(function walk(dir) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === ".git" || ent.name === "node_modules") continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) walk(full);
    else if (/\.(md|txt)$/.test(ent.name)) mdFiles.push(full);
  }
})(root);
let broken = 0;
for (const f of mdFiles) {
  const t = readFileSync(f, "utf8");
  for (const m of t.matchAll(/\]\((?!https?:|#)([^)]+)\)/g)) {
    const rel = m[1].split("#")[0];
    if (!rel) continue;
    try { readFileSync(join(dirname(f), rel), "utf8"); } catch { broken++; failures.push(`broken link in ${f}: ${rel}`); }
  }
}
ok(broken === 0, `no broken relative links (found ${broken})`);

// --- the repository's own prose asserts no forbidden claim -------------------
for (const f of mdFiles) {
  const text = readFileSync(f, "utf8");
  for (const claim of FORBIDDEN_CLAIMS) {
    const re = new RegExp(claim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    for (const line of text.split(/\r?\n/)) {
      if (!re.test(line)) continue;
      const negated = /\b(not|never|does not|doesn't|isn't|is not|no|nor|forbidden|cannot|can't|must not)\b/i.test(line);
      const quoted = /forbidden|FORBIDDEN|must not|quoted|quote|avoid/i.test(line);
      if (negated || quoted) continue;
      fail++;
      failures.push(`forbidden claim asserted in ${f}: "${claim}"\n    line: ${line.trim().slice(0, 120)}`);
    }
  }
}

// --- purity: no network, no process, in the engine and the library -----------
for (const f of ["lib.mjs", "pack.mjs"]) {
  const src = readFileSync(join(root, f), "utf8");
  ok(!/\bfetch\s*\(/.test(src), `${f} performs no network call`);
  ok(!/child_process|execSync|spawnSync|new Function\s*\(/.test(src), `${f} executes nothing`);
}
{
  const src = readFileSync(join(root, "lib.mjs"), "utf8");
  const imports = [...src.matchAll(/^\s*import\s+.+$/gm)].map((m) => m[0].trim());
  eq(imports, [], "lib.mjs imports nothing");
}
// the CLI must not sign or submit anything
{
  const src = readFileSync(join(root, "proofkit-cli.mjs"), "utf8");
  ok(!/signTransaction|submitTransaction|sendTransaction/.test(src), "the CLI never signs or submits");
}

if (fail) {
  console.error(`\n${fail} FAILURE(S):`);
  for (const f of failures) console.error("  - " + f);
  process.exitCode = 1;
}
console.log(`\npi-proofkit — invariant tests\n  pass: ${pass}\n  fail: ${fail}`);
