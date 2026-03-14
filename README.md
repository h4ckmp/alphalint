# AlphaLint

Fast, multi-language code linter powered by tree-sitter. Unified rule engine for JS/TS/Python/Go.

## Install

```bash
npm install -g alphalint
```

## Quick Start

```bash
alphalint init            # Generate .alphalintrc.json
alphalint src/            # Lint your code
alphalint src/ --format json  # JSON report for CI
```

## Built-in Rules

| Rule | Languages | Description |
|------|-----------|-------------|
| `max-function-length` | JS/TS/Py/Go | Functions exceeding N lines (default: 50) |
| `max-nesting-depth` | JS/TS/Py/Go | Nesting depth exceeding N levels (default: 4) |
| `no-console` | JS/TS | `console.*` calls in production code |
| `no-any` | TS | Usage of `any` type |
| `no-unused-vars` | JS/TS | Declared but unused variables |

## Configuration

`.alphalintrc.json`:
```json
{
  "rules": {
    "max-function-length": ["warning", { "max": 40 }],
    "no-console": ["error", { "allow": ["warn", "error"] }],
    "no-any": "off"
  }
}
```

## CI Integration (GitHub Actions)

```yaml
- run: npx alphalint src/ --format github
```

## Performance

100 files in ~50ms via tree-sitter WASM — no native bindings needed.

## License

MIT
