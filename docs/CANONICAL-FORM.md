# Canonical form

This is the byte-level specification of what the digest is computed over. It is
written so that a reader can **reimplement it in any language** and get the same
digest — which is the difference between a proof and a signature.

## Definition

```
algorithm:  sha256
encoding:   hex (lowercase)
input:      the UTF-8 bytes of the canonical string
```

### The canonical string

- **One line per claim**, in **pack order**.
- Each line is:

  ```
  {key}|{kind}|{value}|{basis}
  ```

- Fields are joined by a single `|` (U+007C).
- Lines are joined by a single `\n` (U+000A).
- **No trailing newline.**
- A `null` or `undefined` value or basis is written as the literal four characters
  `null`.
- Every other value is written as its `String()` spelling (for JSON scalars:
  numbers, booleans and strings in their JSON form).
- Claim keys are validated first, so a key never contains a `|` or a newline.
- Claim values and bases are validated first, so they never contain a `|` or a
  newline either.

### Worked example

Two claims:

```json
[
  { "key": "k1", "kind": "measured", "value": "v1", "basis": "b1" },
  { "key": "k2", "kind": "derived",  "value": 2,    "basis": "b2" }
]
```

Canonical string (note: no trailing newline):

```
k1|measured|v1|b1
k2|derived|2|b2
```

The digest is `sha256` of the UTF-8 bytes of exactly that string.

## Reimplementing it

### JavaScript

```js
import { createHash } from "node:crypto";

const lines = claims.map((c) => {
  const value = c.value === null || c.value === undefined ? "null" : String(c.value);
  const basis = c.basis === null || c.basis === undefined ? "null" : String(c.basis);
  return [c.key, c.kind, value, basis].join("|");
});
const canonical = lines.join("\n");
const digest = createHash("sha256").update(canonical, "utf8").digest("hex");
```

### Python

```python
import hashlib

def canonical(claims):
    lines = []
    for c in claims:
        value = "null" if c.get("value") is None else str(c["value"])
        basis = "null" if c.get("basis") is None else str(c["basis"])
        lines.append("|".join([c["key"], c["kind"], value, basis]))
    return "\n".join(lines)

digest = hashlib.sha256(canonical(claims).encode("utf-8")).hexdigest()
```

### Shell (hash a file of canonical bytes)

```bash
# write the canonical bytes to a file, then:
sha256sum canonical.txt          # Linux/macOS
certutil -hashfile canonical.txt SHA256   # Windows
```

## Pitfalls, stated so they are not discovered the hard way

1. **UTF-8, not UTF-16.** On Windows, write the file as UTF-8 **without a BOM**.
   A BOM changes the first bytes and therefore the digest.
2. **No trailing newline.** Many editors add one on save. It changes the digest.
   This is why the CLI prints the canonical bytes to stdout with no added newline
   when you pipe them.
3. **Line order is significant.** Reordering claims changes the digest; the test
   suite asserts this.
4. **`String()` spelling.** `true` is `true`, `1` is `1`, `"1"` is `1` as well —
   a string `"1"` and a number `1` produce the **same** canonical line. If that
   distinction matters for your claims, encode it in the key or the basis. This
   is a stated limitation, not an accident.

## Verified

The example pack's canonical bytes hash, **under PowerShell's own SHA256**, to
exactly the digest the pack records. See [`VERIFICATION.md`](VERIFICATION.md) §3.
