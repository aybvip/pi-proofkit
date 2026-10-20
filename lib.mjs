// lib.mjs — the proof-pack model, as pure data and pure rules.
//
// The problem this repository solves:
//
//   A measurement is only useful to someone else if they can CHECK it without
//   trusting the person who took it. A bare number in a README cannot be checked.
//   A signed number requires trusting a signer. Neither is a proof.
//
// The approach here:
//
//   A "proof pack" is a small, self-contained bundle of:
//     - the CLAIMS, each with a value;
//     - the EVIDENCE each claim rests on;
//     - the CANONICAL BYTES the digest is computed over — fully specified, so the
//       digest can be recomputed BY HAND, by anyone, with any sha256 tool;
//     - the DIGEST over those bytes, so any later edit is detectable.
//
// What a passing verification means — and this is the whole honesty contract:
//
//   PASS means "these bytes are exactly the bytes that were hashed". That is all.
//   It does NOT mean the claims are true, well-founded, or complete. It means the
//   bundle was not altered since the digest was taken.
//
//   A reader who wants to go further than "unaltered" must inspect the EVIDENCE
//   and the STATED BASIS of each claim. This library makes that possible by
//   keeping the three things apart: claim, basis, evidence.

// ---------------------------------------------------------------------------
// 1. Claim kinds and the forbidden claims
// ---------------------------------------------------------------------------

export const CLAIM_KINDS = [
  { id: "measured", meaning: "observed by a command against a recorded endpoint and version; the command is part of the evidence" },
  { id: "documented", meaning: "stated by an official source cited by URL" },
  { id: "derived", meaning: "computed from measured values by a rule that is written down" },
  { id: "asserted", meaning: "stated by the pack author with no measurement behind it — carried for completeness, and visibly the weakest kind" },
  { id: "not-claimed", meaning: "explicitly out of scope; no assertion is made" },
];

/** Phrases a proof pack produced by this library must never assert. */
export const FORBIDDEN_CLAIMS = [
  "proves the claim is true",
  "cryptographically guaranteed true",
  "this proves correctness",
  "mathematically proven",
  "cannot be wrong",
  "trustlessly verified as true",
  "Pi approved",
  "we are first",
  "the official",
];

/** The single most important non-claim. Attached to every verification result. */
export const INTEGRITY_NOT_TRUTH =
  "A digest proves INTEGRITY, not TRUTH. A passing verification means the bytes are unaltered since the digest was taken. It does NOT mean the claims are correct, well-founded, or complete. To judge a claim you must read its basis and its evidence.";

/** The second: a pack is scoped, never universal. */
export const SCOPE_NOT_UNIVERSAL =
  "A proof pack is scoped to the endpoint, tool, version and date it records. A pack that verifies here says nothing about another endpoint, another version, or another time.";

/** The third: reproducibility beats trust. */
export const REPRODUCE_NOT_TRUST =
  "The point of a pack is that you do not have to trust its author. Every basis field names how the value was obtained, so you can obtain it yourself and compare. A pack you cannot reproduce is a claim you cannot check.";

// ---------------------------------------------------------------------------
// 2. The canonical form — the bytes the digest is over
// ---------------------------------------------------------------------------
//
// This is the crux. If the canonical form is not fully specified, a digest is
// unverifiable in practice: only the original tool can reproduce it, which makes
// it a signature, not a proof. So the form is written here, as a string, and a
// reimplementation is included in docs/CANONICAL-FORM.md.

export const CANONICAL_SPEC = {
  algorithm: "sha256",
  encoding: "hex",
  /**
   * The canonical byte string. Deliberately simple and unambiguous:
   *   - one line per claim, in pack order;
   *   - fields joined by "|";
   *   - lines joined by "\n";
   *   - NO trailing newline;
   *   - all values as their JSON scalar spelling via String().
   *
   * The line shape is: {key}|{kind}|{value}|{basis}
   * where a null basis is written as the literal "null".
   */
  line: "{key}|{kind}|{value}|{basis}",
  lines: "claims joined by '\\n', in pack order, no trailing newline",
  spec: "sha256 over the UTF-8 bytes of `lines`; digest rendered as lowercase hex",
  excludes: [
    "the digest itself (obviously — it is what is being computed)",
    "the label and any human-facing metadata",
    "the evidence blob (evidence is REFERENCED by basis, not hashed into the digest, so evidence can be large and can be a URL or a command)",
  ],
};

/** One canonical line for a claim. Fully specified, so it can be reimplemented. */
export function canonicalLine(claim) {
  const value = claim.value === null || claim.value === undefined ? "null" : String(claim.value);
  const basis = claim.basis === null || claim.basis === undefined ? "null" : String(claim.basis);
  return [claim.key, claim.kind, value, basis].join("|");
}

/** The canonical byte string for a set of claims. */
export function canonicalBytes(claims) {
  return claims.map(canonicalLine).join("\n");
}

// ---------------------------------------------------------------------------
// 3. Claim validation — a pack is well-formed or it is refused
// ---------------------------------------------------------------------------

export const CLAIM_KIND_IDS = CLAIM_KINDS.map((c) => c.id);

/** A claim key must be a non-empty string of safe characters. */
export function isValidKey(key) {
  return typeof key === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(key);
}

/**
 * Validate one claim. Returns { valid, errors[] }.
 * The rules exist so two different packs with the same claims always produce the
 * same canonical bytes — an ambiguous form makes a digest meaningless.
 */
export function validateClaim(claim) {
  const errors = [];
  if (!isValidKey(claim?.key)) errors.push(`invalid key: ${JSON.stringify(claim?.key)}`);
  if (!CLAIM_KIND_IDS.includes(claim?.kind)) errors.push(`invalid kind: ${JSON.stringify(claim?.kind)} (claim ${claim?.key})`);
  // A "measured" claim without a basis is a claim with no stated provenance.
  if (claim?.kind === "measured" && (claim?.basis === null || claim?.basis === undefined || claim?.basis === "")) {
    errors.push(`measured claim "${claim?.key}" has no basis — a measurement must say how it was obtained`);
  }
  // A value containing a pipe or newline would make the canonical line ambiguous.
  const v = claim?.value === null || claim?.value === undefined ? "null" : String(claim?.value);
  if (/[|\n]/.test(v)) errors.push(`claim "${claim?.key}" value contains a pipe or newline, which would make the canonical form ambiguous`);
  const b = claim?.basis === null || claim?.basis === undefined ? "null" : String(claim?.basis);
  if (/[|\n]/.test(b)) errors.push(`claim "${claim?.key}" basis contains a pipe or newline, which would make the canonical form ambiguous`);
  return { valid: errors.length === 0, errors };
}

/** Validate a whole pack's claims. Returns { valid, errors[], duplicates[] }. */
export function validateClaims(claims) {
  const errors = [];
  const seen = new Set();
  const duplicates = [];
  if (!Array.isArray(claims)) return { valid: false, errors: ["claims is not an array"], duplicates: [] };
  if (claims.length === 0) errors.push("a pack must carry at least one claim");
  for (const c of claims) {
    const r = validateClaim(c);
    errors.push(...r.errors);
    if (isValidKey(c?.key)) {
      if (seen.has(c.key)) duplicates.push(c.key);
      seen.add(c.key);
    }
  }
  return { valid: errors.length === 0 && duplicates.length === 0, duplicates, errors };
}

// ---------------------------------------------------------------------------
// 4. Boundaries
// ---------------------------------------------------------------------------

export const BOUNDARIES = [
  "A passing verification proves the bytes are UNALTERED, not that the claims are TRUE.",
  "It does not claim a claim's value is complete, or that no other claim exists.",
  "It does not claim a pack holds at another endpoint, version or time; every pack is scoped.",
  "It does not authenticate the author; a digest is not a signature and names no authority.",
  "It does not hash the evidence, only its basis. Evidence can therefore be a URL or a command; its CONTENT is not covered by the digest.",
  "It does not make a claim checkable by itself; a reader must still read the basis and evidence.",
  "It does not claim Pi Network has reviewed, adopted or endorsed it.",
];
