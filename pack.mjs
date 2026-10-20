// pack.mjs — build, digest and verify proof packs. Pure and offline.
//
// Nothing here contacts the network or spawns a process. Hashing is local
// (node:crypto). A pack built here is a self-contained artifact: a reader can
// recompute the digest with any sha256 tool and compare.
//
// The three operations:
//
//   buildPack(...)   → a pack: claims + evidence + canonical bytes + digest
//   verifyPack(...)  → does the digest match the claims? (integrity, not truth)
//   describePack(...) → a human rendering that keeps claim / basis / evidence apart

import { createHash } from "node:crypto";
import {
  CANONICAL_SPEC,
  canonicalBytes,
  validateClaims,
  INTEGRITY_NOT_TRUTH,
  SCOPE_NOT_UNIVERSAL,
  REPRODUCE_NOT_TRUST,
  BOUNDARIES,
} from "./lib.mjs";

/** sha256 of a UTF-8 string, lowercase hex. */
export function sha256Hex(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export const PROOF_PACK_FORMAT = "pi-proof-pack/1";

/**
 * Build a proof pack.
 *
 *   buildPack({
 *     scope: { endpoint, tool, version, measuredAt },
 *     claims: [ { key, kind, value, basis } ],
 *     evidence: { [claimKey]: <anything, e.g. a command or a URL> },
 *     label: "optional human label",
 *   })
 *
 * The pack refuses to build if the claims are malformed, because an ambiguous
 * canonical form makes the digest meaningless. `buildPack` either returns a valid
 * pack or throws with the exact errors.
 */
export function buildPack({ scope, claims, evidence = {}, label = null } = {}) {
  const check = validateClaims(claims);
  if (!check.valid) {
    const err = new Error(`refusing to build an invalid pack:\n  - ${check.errors.join("\n  - ")}`);
    err.errors = check.errors;
    throw err;
  }
  if (check.duplicates.length) {
    const err = new Error(`refusing to build a pack with duplicate claim keys: ${check.duplicates.join(", ")}`);
    err.errors = [`duplicate keys: ${check.duplicates.join(", ")}`];
    throw err;
  }

  const canonical = canonicalBytes(claims);
  const digest = sha256Hex(canonical);

  return {
    format: PROOF_PACK_FORMAT,
    label,
    scope: normalizeScope(scope),
    claims: claims.map((c) => ({
      key: c.key,
      kind: c.kind,
      value: c.value ?? null,
      basis: c.basis ?? null,
    })),
    evidence: pickEvidence(claims, evidence),
    canonical: {
      spec: CANONICAL_SPEC,
      bytes: canonical,
      byteLength: Buffer.byteLength(canonical, "utf8"),
      lineCount: claims.length,
    },
    digest: {
      algorithm: CANONICAL_SPEC.algorithm,
      encoding: CANONICAL_SPEC.encoding,
      sha256: digest,
    },
    // Always carried, never omitted.
    disclaimer: [INTEGRITY_NOT_TRUTH, SCOPE_NOT_UNIVERSAL, REPRODUCE_NOT_TRUST],
    boundaries: BOUNDARIES,
  };
}

function normalizeScope(scope = {}) {
  return {
    endpoint: scope.endpoint ?? null,
    tool: scope.tool ?? null,
    version: scope.version ?? null,
    measuredAt: scope.measuredAt ?? null,
  };
}

/** Evidence is attached only for claims that exist; unknown keys are dropped. */
function pickEvidence(claims, evidence) {
  const out = {};
  for (const c of claims) {
    if (evidence && Object.prototype.hasOwnProperty.call(evidence, c.key)) {
      out[c.key] = evidence[c.key];
    }
  }
  return out;
}

/**
 * Verify a pack's INTEGRITY.
 *
 * Recomputes the canonical bytes from the pack's claims and compares the digest.
 * Returns one of three verdicts, kept strictly apart:
 *
 *   intact   — the recomputed digest matches the recorded one
 *   tampered — it does not; the pack was altered after the digest was taken
 *   invalid  — the pack is malformed, so NO conclusion is drawn either way
 *
 * Crucially, `intact` says nothing about whether the claims are true. The result
 * always carries that disclaimer.
 */
export function verifyPack(pack) {
  const base = {
    format: pack?.format ?? null,
    label: pack?.label ?? null,
    scope: pack?.scope ?? null,
    integrityNotTruth: INTEGRITY_NOT_TRUTH,
    disclaimer: [INTEGRITY_NOT_TRUTH, SCOPE_NOT_UNIVERSAL, REPRODUCE_NOT_TRUST],
  };

  if (!pack || typeof pack !== "object") {
    return { ...base, verdict: "invalid", reason: "not an object", recomputed: null, recorded: null };
  }
  if (pack.format !== PROOF_PACK_FORMAT) {
    return { ...base, verdict: "invalid", reason: `unknown format: ${JSON.stringify(pack.format)}`, recomputed: null, recorded: pack?.digest?.sha256 ?? null };
  }
  if (!Array.isArray(pack.claims)) {
    return { ...base, verdict: "invalid", reason: "claims is not an array", recomputed: null, recorded: pack?.digest?.sha256 ?? null };
  }

  // Re-validate the claims: a pack whose claims are ambiguous cannot be digested
  // reproducibly, so it is invalid rather than tampered.
  const check = validateClaims(pack.claims);
  if (!check.valid) {
    return { ...base, verdict: "invalid", reason: `malformed claims: ${check.errors.join("; ")}`, recomputed: null, recorded: pack?.digest?.sha256 ?? null };
  }

  const recomputed = sha256Hex(canonicalBytes(pack.claims));
  const recorded = pack?.digest?.sha256 ?? null;

  if (typeof recorded !== "string" || !/^[0-9a-f]{64}$/.test(recorded)) {
    return { ...base, verdict: "invalid", reason: `recorded digest is not 64 hex chars: ${JSON.stringify(recorded)}`, recomputed, recorded };
  }

  return {
    ...base,
    verdict: recomputed === recorded ? "intact" : "tampered",
    reason: recomputed === recorded
      ? "the recomputed digest matches the recorded one: the claims are exactly the bytes that were hashed"
      : "the recomputed digest does NOT match the recorded one: the pack was altered after the digest was taken",
    recomputed,
    recorded,
  };
}

/** Verify a pack given only its claims and a claimed digest (the rawest form). */
export function verifyDigest(claimedSha256, claims) {
  const check = validateClaims(claims);
  if (!check.valid) return { verdict: "invalid", reason: `malformed claims: ${check.errors.join("; ")}`, recomputed: null, recorded: claimedSha256 ?? null, integrityNotTruth: INTEGRITY_NOT_TRUTH };
  const recomputed = sha256Hex(canonicalBytes(claims));
  const intact = typeof claimedSha256 === "string" && recomputed === claimedSha256;
  return {
    verdict: intact ? "intact" : "tampered",
    reason: intact
      ? "the recomputed digest matches the claimed one"
      : "the recomputed digest does NOT match the claimed one",
    recomputed,
    recorded: claimedSha256 ?? null,
    integrityNotTruth: INTEGRITY_NOT_TRUTH,
  };
}

/** The canonical bytes for a pack, so a reader can hash them by hand. */
export function packCanonicalBytes(pack) {
  if (!Array.isArray(pack?.claims)) throw new Error("pack has no claims");
  return canonicalBytes(pack.claims);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export function renderPack(pack) {
  const L = [];
  L.push(`=== PROOF PACK${pack.label ? ` — ${pack.label}` : ""} ===`);
  L.push("");
  L.push(`  format:     ${pack.format}`);
  L.push(`  scope:      endpoint=${pack.scope.endpoint ?? "(none)"} tool=${pack.scope.tool ?? "(none)"} version=${pack.scope.version ?? "(none)"} measured=${pack.scope.measuredAt ?? "(none)"}`);
  L.push(`  digest:     ${pack.digest.algorithm}:${pack.digest.sha256}`);
  L.push(`  canonical:  ${pack.canonical.lineCount} line(s), ${pack.canonical.byteLength} byte(s)`);
  L.push("");
  L.push("  CLAIMS (key | kind | value | basis):");
  for (const c of pack.claims) {
    L.push(`    [${c.kind.padEnd(10)}] ${c.key}`);
    L.push(`        value: ${String(c.value)}`);
    L.push(`        basis: ${c.basis === null ? "(none stated)" : String(c.basis)}`);
  }
  L.push("");
  L.push("  EVIDENCE:");
  const keys = Object.keys(pack.evidence);
  if (keys.length === 0) {
    L.push("    (none attached)");
  } else {
    for (const k of keys) {
      L.push(`    ${k}: ${typeof pack.evidence[k] === "string" ? pack.evidence[k] : JSON.stringify(pack.evidence[k])}`);
    }
  }
  L.push("");
  L.push("  CANONICAL BYTES (hash these to reproduce the digest):");
  L.push("    ---8<---");
  for (const line of pack.canonical.bytes.split("\n")) L.push(`    ${line}`);
  L.push("    ---8<---");
  L.push("");
  L.push("  -- DISCLAIMER --");
  for (const d of pack.disclaimer) L.push(`  - ${d}`);
  return L.join("\n");
}

export function renderVerification(result) {
  const L = [];
  L.push("=== PROOF PACK VERIFICATION (integrity only — INTEGRITY only, not truth) ===");
  L.push("");
  const mark = result.verdict === "intact" ? "INTACT  " : result.verdict === "tampered" ? "TAMPERED" : "INVALID ";
  L.push(`  [${mark}] ${result.label ?? "(unlabelled pack)"}`);
  if (result.scope) {
    L.push(`  scope:      endpoint=${result.scope.endpoint ?? "(none)"} tool=${result.scope.tool ?? "(none)"} version=${result.scope.version ?? "(none)"}`);
  }
  L.push(`  recorded:   ${result.recorded ?? "(none)"}`);
  L.push(`  recomputed: ${result.recomputed ?? "(none)"}`);
  L.push("");
  L.push(`  ${result.reason}`);
  L.push("");
  L.push("  -- WHAT THIS MEANS --");
  L.push(`  ${INTEGRITY_NOT_TRUTH}`);
  L.push("");
  L.push("  -- VERDICTS --");
  L.push("  - intact:   the recomputed digest matches; the bytes are UNALTERED");
  L.push("  - tampered: the digests differ; the pack was altered after hashing");
  L.push("  - invalid:  the pack is malformed; NO conclusion is drawn either way");
  return L.join("\n");
}

export function packToJSON(pack) {
  return JSON.stringify({ tool: "pi-proofkit", mode: "pack", pack }, null, 2);
}

export function verificationToJSON(result) {
  return JSON.stringify({ tool: "pi-proofkit", mode: "verify", result }, null, 2);
}

export { canonicalBytes, CANONICAL_SPEC };
