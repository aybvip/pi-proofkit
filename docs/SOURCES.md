# Sources

Every claim in this repository is one of: **documented** (an official URL says
so), **measured** (a command here or in a named sibling repository reproduced it),
or **not-claimed**.

## Official documentation

| Source | Used for |
|---|---|
| [NIST FIPS 180-4, Secure Hash Standard](https://csrc.nist.gov/pubs/fips/180-4/upd1/final) | the definition of SHA-256, the digest this library uses |
| [RFC 4648 §3](https://www.rfc-editor.org/rfc/rfc4648#section-3) | the hex encoding of a digest |
| [The Unicode Standard, Chapter 3](https://www.unicode.org/versions/latest/) | UTF-8 byte semantics, which the canonical form depends on |
| [RFC 3339](https://www.rfc-editor.org/rfc/rfc3339) | the date format recorded in a pack's `measuredAt` (recorded as a string; the digest does not vouch for the instant) |

The digest algorithm is used exactly as NIST defines it. Where this repository
departs from a common *convention* — for example by hashing a canonical string
with **no trailing newline** — the departure is **stated explicitly** in
[`CANONICAL-FORM.md`](CANONICAL-FORM.md), because a digest is meaningless unless
its input bytes are unambiguous.

## Measured facts

The `--example` pack packages facts that were measured on **2026-10-19** against
`https://rpc.testnet.minepi.com` (node `28.0.1`, protocol `28`). They are recorded
in sibling repositories; the pack records them **with their basis**, and the
commands to reproduce each are named in the pack's evidence:

| Claim | Value | Reproduce with |
|---|---|---|
| `network.passphrase` | `Pi Testnet` | `pi-api-contract-registry` `--conformance` (C-NET-1) |
| `node.version` | `28.0.1` | `pi-api-contract-registry` `--conformance` (C-VER-1) |
| `protocol.version` | `28` | `pi-api-contract-registry` `--conformance` (C-NET-1) |
| `events.pageCap` | `100` | `pi-api-contract-registry` `--conformance` (C-EVT-1) |
| `ledger.retentionWindow` | `120960` | `pi-api-contract-registry` `--conformance` (C-HEALTH-1), and `pi-soroban-events` |
| `ledger.retentionDays` | `7` | arithmetic on the measured window (derived) |
| `endLedger.exclusive` | `true` | the `endLedger` measurement in `pi-soroban-events` |
| `mainnet.sorobanRpc.reachable` | `false` | a plain GET to `rpc.mainnet.minepi.com`; observed HTTP 503 |

The `--example` pack does **not** re-measure these values. It packages them with
their basis so a reader can follow the basis and measure them again. A pack that
re-measured live would be a different tool; keeping this one offline is what makes
the digest a pure function of the claims.

## Verified digest

The example pack's canonical bytes hash, under **PowerShell's own SHA256**, to
`1e94219c8f934921edfdab37ed06f4b2874fe5830d86d67d7d702c8385a04876` — the exact
digest the pack records. See [`VERIFICATION.md`](VERIFICATION.md) §3. This is the
one figure in the repository that is checked by an **independent implementation**.

## Repositories this one builds on

| Repository | Role |
|---|---|
| [`pi-event-integrity`](https://github.com/aybvip/pi-event-integrity) | first used a canonical-form SHA-256 digest to make a coverage record replayable; this library **generalizes** that mechanism to any claim set and specifies the form for outside reimplementation |
| [`pi-api-contract-registry`](https://github.com/aybvip/pi-api-contract-registry) | records the measured RPC values the example pack packages, and the live checks named in its evidence |
| [`pi-chaos-lab`](https://github.com/aybvip/pi-chaos-lab) | records what happens when a request is wrong; a client that mis-handles those shapes will mis-read a verification result too |

## Nothing third-party, nothing unofficial

No unofficial mirror, fork, blog post, or scraped page is used as a source. If a
claim cannot be traced to an official URL or a command in this repository family,
it is not made.

## Not claimed

This repository does **not** claim to be an authoritative reference, and does
**not** claim that Pi Network has reviewed, adopted or endorsed it. Adoption is
`not-claimed`.
