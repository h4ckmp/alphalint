/**
 * AlphaLint 端到端集成测试
 * 验证完整流程：CLI → 配置 → 文件发现 → 解析 → 规则执行 → 报告
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintFile, lintSource } from '../src/index.js';
import { discoverFiles } from '../src/file-discovery.js';

const exec = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, '../src/cli.js');
const FIXTURES = resolve(__dirname, 'fixtures');

/**
 * Helper: run alphalint CLI and capture output
 */
async function runCLI(args, options = {}) {
  try {
    const { stdout, stderr } = await exec('node', [CLI_PATH, ...args], {
      cwd: options.cwd || FIXTURES,
      timeout: 30000,
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (err) {
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      exitCode: err.code || 1,
    };
  }
}

// ─── Fixture: Clean Code ────────────────────────────────────────────

describe('integration: clean fixtures', () => {
  it('should report zero problems on clean code', async () => {
    const result = await runCLI(['check', resolve(FIXTURES, 'clean')]);
    assert.equal(result.exitCode, 0, `Expected exit 0, got ${result.exitCode}\nstderr: ${result.stderr}`);
    assert.ok(result.stdout.includes('No problems found'), `Expected "No problems found" in output:\n${result.stdout}`);
  });

  it('should report zero problems in JSON format', async () => {
    const result = await runCLI(['check', resolve(FIXTURES, 'clean'), '--format', 'json']);
    assert.equal(result.exitCode, 0);
    const report = JSON.parse(result.stdout);
    assert.equal(report.summary.totalProblems, 0);
    assert.equal(report.summary.errors, 0);
    assert.equal(report.summary.warnings, 0);
    assert.ok(report.summary.filesAnalyzed >= 3, `Expected >= 3 files, got ${report.summary.filesAnalyzed}`);
  });

  it('should discover all clean fixture files', async () => {
    const files = await discoverFiles([resolve(FIXTURES, 'clean')]);
    assert.ok(files.length >= 3, `Expected >= 3 files, got ${files.length}`);
    assert.ok(files.some(f => f.endsWith('utils.ts')));
    assert.ok(files.some(f => f.endsWith('types.ts')));
    assert.ok(files.some(f => f.endsWith('service.js')));
  });
});

// ─── Fixture: Problematic Code ──────────────────────────────────────

describe('integration: problematic fixtures', () => {
  it('should detect problems in problematic code', async () => {
    const result = await runCLI(['check', resolve(FIXTURES, 'problematic'), '--format', 'json']);
    const report = JSON.parse(result.stdout);
    assert.ok(report.summary.totalProblems > 0, 'Expected problems');
    assert.ok(report.summary.warnings > 0, 'Expected warnings');
  });

  it('should exit 1 when --max-warnings 0 on problematic code', async () => {
    const result = await runCLI(['check', resolve(FIXTURES, 'problematic'), '--max-warnings', '0']);
    assert.notEqual(result.exitCode, 0, 'Expected non-zero exit code with --max-warnings 0');
  });

  it('should detect no-any violations in bad-code.ts', async () => {
    const diagnostics = await lintFile(resolve(FIXTURES, 'problematic/bad-code.ts'));
    const anyViolations = diagnostics.filter(d => d.ruleId === 'no-any');
    assert.ok(anyViolations.length >= 2, `Expected >= 2 no-any violations, got ${anyViolations.length}`);
  });

  it('should detect no-console violations', async () => {
    const diagnostics = await lintFile(resolve(FIXTURES, 'problematic/console-heavy.js'));
    const consoleViolations = diagnostics.filter(d => d.ruleId === 'no-console');
    assert.ok(consoleViolations.length >= 5, `Expected >= 5 no-console violations, got ${consoleViolations.length}`);
  });

  it('should detect max-function-length violation', async () => {
    const diagnostics = await lintFile(resolve(FIXTURES, 'problematic/bad-code.ts'));
    const lengthViolations = diagnostics.filter(d => d.ruleId === 'max-function-length');
    assert.ok(lengthViolations.length >= 1, `Expected max-function-length violation, got ${lengthViolations.length}`);
  });

  it('should detect max-nesting-depth violation', async () => {
    const diagnostics = await lintFile(resolve(FIXTURES, 'problematic/bad-code.ts'));
    const nestingViolations = diagnostics.filter(d => d.ruleId === 'max-nesting-depth');
    assert.ok(nestingViolations.length >= 1, `Expected max-nesting-depth violation, got ${nestingViolations.length}`);
  });

  it('should report correct diagnostic structure', async () => {
    const diagnostics = await lintFile(resolve(FIXTURES, 'problematic/bad-code.ts'));
    assert.ok(diagnostics.length > 0);
    for (const d of diagnostics) {
      assert.ok(d.filePath, 'diagnostic must have filePath');
      assert.ok(typeof d.line === 'number' && d.line >= 1, 'diagnostic must have valid line');
      assert.ok(typeof d.column === 'number' && d.column >= 1, 'diagnostic must have valid column');
      assert.ok(['error', 'warning', 'info'].includes(d.severity), `invalid severity: ${d.severity}`);
      assert.ok(typeof d.message === 'string' && d.message.length > 0, 'diagnostic must have message');
      assert.ok(typeof d.ruleId === 'string', 'diagnostic must have ruleId');
    }
  });
});

// ─── Fixture: Mixed Code ────────────────────────────────────────────

describe('integration: mixed fixtures', () => {
  it('should detect some but not all files having problems', async () => {
    const result = await runCLI(['check', resolve(FIXTURES, 'mixed'), '--format', 'json']);
    const report = JSON.parse(result.stdout);
    assert.ok(report.summary.totalProblems > 0, 'Expected some problems');
    assert.ok(report.summary.filesAnalyzed >= 2, 'Expected >= 2 files analyzed');
    // Mixed code should have fewer problems than problematic code
    assert.ok(report.summary.totalProblems < 20, `Unexpectedly many problems: ${report.summary.totalProblems}`);
  });

  it('should detect no-any in mixed/app.ts but not no-any in clean functions', async () => {
    const diagnostics = await lintFile(resolve(FIXTURES, 'mixed/app.ts'));
    const anyViolations = diagnostics.filter(d => d.ruleId === 'no-any');
    assert.ok(anyViolations.length >= 1, 'Expected at least 1 no-any violation');
    // Verify the violation is on the parseConfig function, not the clean ones
    assert.ok(anyViolations.some(d => d.line >= 10), 'Expected no-any on parseConfig');
  });

  it('should detect console.log in debug function', async () => {
    const diagnostics = await lintFile(resolve(FIXTURES, 'mixed/app.ts'));
    const consoleViolations = diagnostics.filter(d => d.ruleId === 'no-console');
    assert.ok(consoleViolations.length >= 1, 'Expected at least 1 no-console violation');
  });
});

// ─── CLI Integration ────────────────────────────────────────────────

describe('integration: CLI commands', () => {
  it('alphalint --version should output version', async () => {
    const result = await runCLI(['--version']);
    assert.ok(result.stdout.includes('0.1.0'), `Expected version in output: ${result.stdout}`);
  });

  it('alphalint --help should output usage info', async () => {
    const result = await runCLI(['--help']);
    assert.ok(result.stdout.includes('Usage'), `Expected "Usage" in help output`);
    assert.ok(result.stdout.includes('check'));
    assert.ok(result.stdout.includes('init'));
    assert.ok(result.stdout.includes('list-rules'));
  });

  it('alphalint list-rules should list all 5 built-in rules', async () => {
    const result = await runCLI(['list-rules']);
    assert.ok(result.stdout.includes('max-function-length'));
    assert.ok(result.stdout.includes('max-nesting-depth'));
    assert.ok(result.stdout.includes('no-console'));
    assert.ok(result.stdout.includes('no-any'));
    assert.ok(result.stdout.includes('no-unused-vars'));
  });

  it('alphalint check with terminal format should produce human-readable output', async () => {
    const result = await runCLI(['check', resolve(FIXTURES, 'problematic')]);
    // Should have colored output with file paths, line numbers, rule ids
    assert.ok(result.stdout.includes('bad-code.ts') || result.stdout.includes('console-heavy.js'),
      `Expected file names in terminal output`);
  });

  it('alphalint check with github format should produce GitHub annotations', async () => {
    const result = await runCLI(['check', resolve(FIXTURES, 'problematic'), '--format', 'github']);
    // GitHub format uses ::warning:: or ::error:: prefix
    assert.ok(result.stdout.includes('::warning') || result.stdout.includes('::error'),
      `Expected GitHub annotation format`);
  });

  it('--max-warnings should exit 1 when exceeded', async () => {
    const result = await runCLI(['check', resolve(FIXTURES, 'mixed'), '--max-warnings', '0']);
    assert.notEqual(result.exitCode, 0, 'Expected non-zero exit when warnings exceed max');
  });

  it('implicit check command should work (no "check" keyword)', async () => {
    const result = await runCLI([resolve(FIXTURES, 'clean'), '--format', 'json']);
    assert.equal(result.exitCode, 0);
    const report = JSON.parse(result.stdout);
    assert.equal(report.summary.totalProblems, 0);
  });
});

// ─── Report Format Validation ───────────────────────────────────────

describe('integration: JSON report format', () => {
  it('should produce valid AlphaLint JSON report schema', async () => {
    const result = await runCLI(['check', resolve(FIXTURES, 'problematic'), '--format', 'json']);
    const report = JSON.parse(result.stdout);

    // Top-level fields
    assert.ok(report.version, 'report must have version');
    assert.ok(report.timestamp, 'report must have timestamp');
    assert.ok(report.summary, 'report must have summary');
    assert.ok(Array.isArray(report.results), 'report must have results array');

    // Summary fields
    assert.ok(typeof report.summary.filesAnalyzed === 'number');
    assert.ok(typeof report.summary.filesWithProblems === 'number');
    assert.ok(typeof report.summary.errors === 'number');
    assert.ok(typeof report.summary.warnings === 'number');
    assert.ok(typeof report.summary.totalProblems === 'number');
    assert.ok(typeof report.summary.durationMs === 'number');

    // Result entry structure
    for (const entry of report.results) {
      assert.ok(entry.filePath, 'result entry must have filePath');
      assert.ok(entry.language, 'result entry must have language');
      assert.ok(Array.isArray(entry.problems), 'result entry must have problems array');
      for (const p of entry.problems) {
        assert.ok(p.ruleId);
        assert.ok(p.severity);
        assert.ok(p.message);
        assert.ok(p.location);
        assert.ok(p.location.start);
        assert.ok(p.location.end);
      }
    }
  });
});

// ─── Dogfooding: Scan AlphaLint's Own Code ──────────────────────────

describe('integration: dogfooding (scan own code)', () => {
  const srcDir = resolve(__dirname, '../src');

  it('should successfully scan AlphaLint src/ without crashing', async () => {
    const result = await runCLI(['check', srcDir, '--format', 'json']);
    const report = JSON.parse(result.stdout);
    assert.ok(report.summary.filesAnalyzed >= 10, `Expected >= 10 files, got ${report.summary.filesAnalyzed}`);
  });

  it('should complete scan within reasonable time', async () => {
    const result = await runCLI(['check', srcDir, '--format', 'json']);
    const report = JSON.parse(result.stdout);
    assert.ok(report.summary.durationMs < 10000, `Scan took too long: ${report.summary.durationMs}ms`);
  });
});

// ─── Performance Benchmark ──────────────────────────────────────────

describe('integration: performance benchmark', () => {
  it('should scan 100 files within 5 seconds', async () => {
    // Generate 100 small TS files in a temp dir
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const tempDir = await mkdtemp(resolve(tmpdir(), 'alphalint-perf-'));

    try {
      // Create 100 TypeScript files with varied content
      const writePromises = [];
      for (let i = 0; i < 100; i++) {
        const content = `
function compute${i}(a: number, b: number): number {
  const result = a + b;
  return result * ${i + 1};
}

function helper${i}(items: string[]): string[] {
  return items.filter(item => item.length > 0).map(item => item.trim());
}

interface Config${i} {
  name: string;
  value: number;
  enabled: boolean;
}

export { compute${i}, helper${i} };
export type { Config${i} };
`;
        writePromises.push(writeFile(resolve(tempDir, `file${i}.ts`), content));
      }
      await Promise.all(writePromises);

      // Run the benchmark
      const startTime = Date.now();
      const result = await runCLI(['check', tempDir, '--format', 'json']);
      const elapsedMs = Date.now() - startTime;
      const report = JSON.parse(result.stdout);

      // Assertions
      assert.equal(report.summary.filesAnalyzed, 100, `Expected 100 files, got ${report.summary.filesAnalyzed}`);
      assert.ok(elapsedMs < 5000, `Performance target missed: ${elapsedMs}ms (target: <5000ms)`);

      // Log benchmark results for record
      console.log(`  📊 Performance benchmark results:`);
      console.log(`     Files: ${report.summary.filesAnalyzed}`);
      console.log(`     Engine time: ${report.summary.durationMs}ms`);
      console.log(`     Total (incl. startup): ${elapsedMs}ms`);
      console.log(`     Avg per file: ${(report.summary.durationMs / 100).toFixed(2)}ms`);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
