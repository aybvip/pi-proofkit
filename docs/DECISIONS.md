# Decisions

Each decision records what was chosen, why, and — where something was declined —
why it was declined.

## D1 — Separate the three things a claim bundle usually conflates

**Decision.** A pack carries **claims**, **evidence**, and **canonical bytes +
digest** as three distinct parts, and the rendering keeps them apart.

**Why.** A bare number cannot be checked; a bare blob cannot be read. Keeping the
claim (what is asserted), the basis/evidence (how it was obtained), and the
canonical bytes (what was hashed) separate is what makes a pack both *readable*
and *checkable*. Merging them would produce a document that looks authoritative
and cannot be independently verified.

## D2 — A digest proves integrity, not truth — and the result always says so

**Decision.** Every pack and every verification result carries the sentence *"A
digest proves INTEGRITY, not TRUTH"*. The phrases *"proves the claim is true"* and
*"mathematically proven"* are **forbidden claims**.

**Why.** This is the failure mode most likely to harm a reader: treating a green
"verified" as a statement about correctness. A hash says the bytes are unaltered.
Saying so plainly, on every result, is the difference between a useful tool and a
misleading one.

## D3 — The canonical form is fully specified, and reimplementable

**Decision.** The canonical line format is documented as a string
(`{key}|{kind}|{value}|{basis}`), with join rules, the no-trailing-newline rule,
and the `null` spelling — alongside reference implementations in JavaScript,
Python and shell.

**Why.** A digest only the producing tool can reproduce is a **signature**, not a
proof. Specifying the form is what lets anyone recompute the digest with `sha256sum`,
`certutil`, or ten lines of Python. This is verified in
[`VERIFICATION.md`](VERIFICATION.md) §3 against PowerShell's own SHA256.

## D4 — The pack refuses to build on ambiguous input

**Decision.** `buildPack()` validates every claim and **throws** on a malformed or
ambiguous pack — an invalid key, an unknown kind, a value or basis containing the
field separator `|` or a newline, a duplicate key.

**Why.** An ambiguous canonical form makes the digest meaningless: two different
packs could produce the same bytes, or the same pack could produce two different
digests depending on the encoder. There is deliberately no "build anyway" path.

## D5 — Evidence is referenced, not hashed; the basis IS hashed

**Decision.** The digest covers each claim's **key, kind, value and basis**. The
**evidence** blob is not hashed.

**Why.** Four reasons: evidence may be a URL or a command whose formatting is
irrelevant; evidence may be large; hashing it would imply the digest vouches for
the evidence's *content*, which it cannot; and the basis already states
provenance, which is the part that belongs in the commitment. The consequence is
asserted explicitly in the tests: changing a **basis** yields `tampered`, changing
**evidence** alone yields `intact`.

## D6 — A `measured` claim must carry a basis

**Decision.** A claim of kind `measured` with no basis is rejected at build time.

**Why.** A measurement that does not say how it was obtained cannot be
reproduced; it is a number with no trail. Refusing it keeps the pack's `measured`
kind meaningful — a reader can rely on the fact that every `measured` claim in a
valid pack names how it was measured.

## D7 — Five claim kinds, with `asserted` as a visible weakest kind

**Decision.** Kinds are `measured`, `documented`, `derived`, `asserted`,
`not-claimed`. `asserted` exists so a pack author has somewhere honest to put a
belief that has no measurement behind it, instead of smuggling it in as `measured`.

**Why.** Forbidding unbacked claims entirely would push authors to relabel them.
Providing an explicitly weakest kind, rendered in plain sight, is more honest than
pretending such claims never occur.

## D8 — Three verification verdicts, and `invalid` is its own

**Decision.** `verifyPack()` returns `intact`, `tampered`, or `invalid`. Exit `0`,
`1`, `2` respectively.

**Why.** A malformed pack cannot be digested reproducibly, so it is *uncheckable* —
neither intact nor tampered. Collapsing `invalid` into `tampered` would report an
alteration never observed; collapsing it into `intact` would pass a pack that was
never checked. Keeping three verdicts lets a reader trust a `tampered` as a real
finding.

## D9 — No signing, no certificate, no authority

**Decision.** Packs are not signed and no certificate is issued. A request to sign
test evidence was considered earlier in this project family and **declined**.

**Why.** Signing asserts the identity of a signer as an authority. This project is
not an authority over Pi's data and names none; a signature would imply an
endorsement that does not exist. A **reproducible digest** is stronger than a
signature from a party with no standing, because a reader does not have to trust
anyone at all — they recompute it.

## D10 — The suite pins the digest of a fixed claim set

**Decision.** The test suite computes the digest of a one-claim set and compares it
to `sha256("a|measured|1|b")` computed independently, and compares the canonical
bytes of a two-claim set to a **hand-written** string.

**Why.** A silent change to the canonical form would invalidate every previously
published pack while all internal tests still agreeing with each other. Pinning
the form to a hand-written expectation makes such a change fail loudly.
