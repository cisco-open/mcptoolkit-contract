# Exit Codes

mcpcontract uses process exit codes to communicate outcome to shell scripts,
CI/CD pipelines, and other tooling. This page is the normative reference.

---

## Quick reference

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Error — bad arguments, file not found, parse failure, or (for `breaking`/`compare`) breaking changes found |
| `2` | Error — specifically signals a tool-level error distinct from a semantic result (see per-command table) |
| `3` | `split` only — split-config file not found |
| `4` | `split` only — one or more output files could not be written |

---

## Per-command table

### `dump`

| Code | Meaning |
|------|---------|
| `0` | Dump written successfully |
| `1` | Any error (server unreachable, auth failure, bad config, or OAuth callback listener failure) |

OAuth callback listener failures also use exit code `1`. In particular:

- The default loopback callback is `http://127.0.0.1:6274/oauth/callback`.
- If port `6274` is busy and you did not pass `--oauth-callback-port` or `--oauth-callback-url`, `dump` retries with a random local port up to 3 times.
- If all 3 random-port attempts fail, `dump` exits with code `1` and advises you to provide an explicit callback URI with `--oauth-callback-url`.

### `validate`

| Code | Meaning |
|------|---------|
| `0` | File is valid against the selected schema |
| `1` | File is invalid — one or more schema errors were found |
| `2` | Error — bad arguments, file not found, unrecognised schema type |

### `diff`

| Code | Meaning |
|------|---------|
| `0` | Diff written successfully |
| `2` | Error — missing `--from`/`--to`, file not found, parse error |

> `diff` does not use exit code `1`. Structural differences between two valid
> dumps are not treated as an error; use `breaking` to decide whether they are
> significant.

### `breaking`

| Code | Meaning |
|------|---------|
| `0` | No breaking changes detected (backward-compatible) |
| `1` | One or more breaking changes detected |
| `2` | Error — missing `--diff`, file not found, parse error, rules load failure |

This is the exit code contract used for CI/CD gating. `set -e` scripts should
only gate on `breaking`, not on `diff` or `changelog`.

### `compare`

Same contract as `breaking` (it runs the full `diff → breaking → changelog`
pipeline internally):

| Code | Meaning |
|------|---------|
| `0` | No breaking changes detected — or `--exit-zero` was passed |
| `1` | One or more breaking changes detected (suppressed by `--exit-zero`) |
| `2` | Error — never suppressed by `--exit-zero` |

### `split`

| Code | Meaning |
|------|---------|
| `0` | All output files written successfully |
| `1` | General error — bad arguments, input file not found or invalid |
| `2` | Output schema validation failed — one or more generated files are invalid |
| `3` | Split-config file not found |
| `4` | File write errors — some output files could not be written |

### `document`

| Code | Meaning |
|------|---------|
| `0` | Documentation rendered successfully |
| `1` | Any error — bad input, template not found, render failure |

### `convert`

| Code | Meaning |
|------|---------|
| `0` | Conversion succeeded |
| `1` | Any error — bad input, unsupported format, parse failure |

> `convert` is deprecated and will be removed in a future release.

### `completion`, `rules`, `agents`

All use `0` for success and `1` for any error.

---

## CI/CD usage

The typical CI/CD pipeline gates only on `breaking` (or `compare`):

```bash
# Dump both versions
mcpcontract dump --config prev.json --output prev.mcpdesc.json
mcpcontract dump --config next.json --output next.mcpdesc.json

# Gate on breaking changes — exits 0 (compatible) or 1 (breaking) or 2 (error)
mcpcontract breaking \
  --diff <(mcpcontract diff --from prev.mcpdesc.json --to next.mcpdesc.json) \
  --output analysis.json
```

Or in one step:

```bash
mcpcontract compare \
  --from prev.mcpdesc.json \
  --to   next.mcpdesc.json \
  --output changelog.md
# exits 0 (compatible), 1 (breaking), or 2 (error)
```

Use `--exit-zero` with `compare` if you want the changelog written even when
breaking changes are found, but still want to distinguish in a later step:

```bash
mcpcontract compare --from prev.json --to next.json \
  --output changelog.md --exit-zero
echo "Compare finished (always 0 with --exit-zero unless error)"
```

See [cicd/](../cicd/README.md) for full CI/CD workflow templates.
