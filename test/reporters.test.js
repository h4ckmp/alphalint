import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatTerminal } from '../src/reporters/terminal.js';
import { formatJSON } from '../src/reporters/json.js';
import { formatGitHub } from '../src/reporters/github.js';

const SAMPLE_DIAGNOSTICS = [
  {
    filePath: 'src/index.js',
    line: 10,
    column: 5,
    endLine: 10,
    endColumn: 20,
    severity: 'warning',
    message: '生产代码中不应有 console.log',
    ruleId: 'no-console',
  },
  {
    filePath: 'src/index.js',
    line: 3,
    column: 1,
    endLine: 50,
    endColumn: 1,
    severity: 'warning',
    message: '函数 "handleRequest" 有 47 行，超过上限 40 行',
    ruleId: 'max-function-length',
  },
  {
    filePath: 'src/types.ts',
    line: 5,
    column: 10,
    endLine: 5,
    endColumn: 13,
    severity: 'error',
    message: '避免使用 any 类型',
    ruleId: 'no-any',
  },
];

const META = { filesAnalyzed: 10, durationMs: 350 };

describe('Terminal Reporter', () => {
  it('should output file-grouped results', () => {
    const output = formatTerminal(SAMPLE_DIAGNOSTICS, META);
    assert.ok(output.includes('src/index.js'));
    assert.ok(output.includes('src/types.ts'));
    assert.ok(output.includes('no-console'));
    assert.ok(output.includes('no-any'));
  });

  it('should show summary with counts', () => {
    const output = formatTerminal(SAMPLE_DIAGNOSTICS, META);
    assert.ok(output.includes('1 error'));
    assert.ok(output.includes('2 warnings'));
    assert.ok(output.includes('10 files'));
  });

  it('should show success message when no problems', () => {
    const output = formatTerminal([], { filesAnalyzed: 5, durationMs: 100 });
    assert.ok(output.includes('No problems found'));
    assert.ok(output.includes('5 files'));
  });

  it('should sort problems by line number within a file', () => {
    const output = formatTerminal(SAMPLE_DIAGNOSTICS, META);
    const indexJsSection = output.split('src/types.ts')[0];
    const line3Pos = indexJsSection.indexOf('3:1');
    const line10Pos = indexJsSection.indexOf('10:5');
    assert.ok(line3Pos < line10Pos, 'line 3 should appear before line 10');
  });
});

describe('JSON Reporter', () => {
  it('should produce valid JSON', () => {
    const output = formatJSON(SAMPLE_DIAGNOSTICS, META);
    const parsed = JSON.parse(output);
    assert.ok(parsed.version);
    assert.ok(parsed.timestamp);
    assert.ok(parsed.summary);
    assert.ok(parsed.results);
  });

  it('should have correct summary counts', () => {
    const parsed = JSON.parse(formatJSON(SAMPLE_DIAGNOSTICS, META));
    assert.equal(parsed.summary.errors, 1);
    assert.equal(parsed.summary.warnings, 2);
    assert.equal(parsed.summary.totalProblems, 3);
    assert.equal(parsed.summary.filesAnalyzed, 10);
    assert.equal(parsed.summary.filesWithProblems, 2);
  });

  it('should group results by file', () => {
    const parsed = JSON.parse(formatJSON(SAMPLE_DIAGNOSTICS, META));
    assert.equal(parsed.results.length, 2);
    const indexFile = parsed.results.find(r => r.filePath === 'src/index.js');
    assert.equal(indexFile.problems.length, 2);
  });

  it('should include location data', () => {
    const parsed = JSON.parse(formatJSON(SAMPLE_DIAGNOSTICS, META));
    const typesFile = parsed.results.find(r => r.filePath === 'src/types.ts');
    assert.deepEqual(typesFile.problems[0].location.start, { line: 5, column: 10 });
  });

  it('should handle empty diagnostics', () => {
    const parsed = JSON.parse(formatJSON([], META));
    assert.equal(parsed.summary.totalProblems, 0);
    assert.equal(parsed.results.length, 0);
  });
});

describe('GitHub Reporter', () => {
  it('should output workflow commands', () => {
    const output = formatGitHub(SAMPLE_DIAGNOSTICS);
    assert.ok(output.includes('::warning '));
    assert.ok(output.includes('::error '));
  });

  it('should format error level correctly', () => {
    const output = formatGitHub(SAMPLE_DIAGNOSTICS);
    assert.ok(output.includes('::error file=src/types.ts,line=5,col=10,title=no-any::'));
  });

  it('should format warning level correctly', () => {
    const output = formatGitHub(SAMPLE_DIAGNOSTICS);
    assert.ok(output.includes('::warning file=src/index.js'));
  });

  it('should return empty string for no diagnostics', () => {
    assert.equal(formatGitHub([]), '');
  });

  it('should escape special characters', () => {
    const diagnostics = [{
      filePath: 'test.js',
      line: 1,
      column: 1,
      severity: 'warning',
      message: 'line1\nline2',
      ruleId: 'test',
    }];
    const output = formatGitHub(diagnostics);
    assert.ok(output.includes('%0A'));
    assert.ok(!output.includes('\n\n')); // should not have raw newline in message
  });
});
