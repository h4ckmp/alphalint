# AlphaLint

Fast, multi-language code linter powered by tree-sitter. Analyze TypeScript, JavaScript, Python, and Go with a unified rule engine.

## Install

```bash
npm install -g alphalint
```

## Quick Start

```bash
# 1. Initialize config (optional)
alphalint init

# 2. Lint your code
alphalint src/

# 3. Get JSON report for CI
alphalint src/ --format json
```

## Built-in Rules

| Rule | Languages | Description |
|------|-----------|-------------|
| `max-function-length` | JS/TS/Py/Go | Functions exceeding N lines (default: 50) |
| `max-nesting-depth` | JS/TS/Py/Go | Nesting depth exceeding N levels (default: 4) |
| `no-console` | JS/TS | console.log/warn/error calls in production code |
| `no-any` | TS | Usage of `any` type |
| `no-unused-vars` | JS/TS | Declared but unused variables |

## Configuration

Create `.alphalintrc.json`:

```json
{
  "exclude": ["node_modules", "dist"],
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

100 files in ~50ms via tree-sitter WASM — no native bindings required.

## License

MIT
