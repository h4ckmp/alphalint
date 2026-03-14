import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lintSource } from '../src/index.js';

// ============================================================
// max-function-length
// ============================================================
describe('max-function-length', () => {
  it('reports functions exceeding max lines', async () => {
    // 生成一个 12 行的函数
    const body = Array(10).fill('  const x = 1;').join('\n');
    const source = `function longFunc() {\n${body}\n}`;
    const diagnostics = await lintSource('test.js', source, {
      'max-function-length': { options: { max: 5 } },
    });

    const hits = diagnostics.filter(d => d.ruleId === 'max-function-length');
    assert.equal(hits.length, 1);
    assert.ok(hits[0].message.includes('longFunc'));
    assert.ok(hits[0].message.includes('12'));
  });

  it('does not report short functions', async () => {
    const source = 'function short() {\n  return 1;\n}';
    const diagnostics = await lintSource('test.js', source, {
      'max-function-length': { options: { max: 50 } },
    });
    const hits = diagnostics.filter(d => d.ruleId === 'max-function-length');
    assert.equal(hits.length, 0);
  });

  it('works with arrow functions', async () => {
    const body = Array(10).fill('  const x = 1;').join('\n');
    const source = `const fn = () => {\n${body}\n};`;
    const diagnostics = await lintSource('test.js', source, {
      'max-function-length': { options: { max: 5 } },
    });
    const hits = diagnostics.filter(d => d.ruleId === 'max-function-length');
    assert.equal(hits.length, 1);
  });

  it('works with Python functions', async () => {
    const body = Array(10).fill('    x = 1').join('\n');
    const source = `def long_func():\n${body}`;
    const diagnostics = await lintSource('test.py', source, {
      'max-function-length': { options: { max: 5 } },
    });
    const hits = diagnostics.filter(d => d.ruleId === 'max-function-length');
    assert.equal(hits.length, 1);
    assert.ok(hits[0].message.includes('long_func'));
  });

  it('works with Go functions', async () => {
    const body = Array(10).fill('\tx := 1').join('\n');
    const source = `package main\n\nfunc longFunc() {\n${body}\n}`;
    const diagnostics = await lintSource('test.go', source, {
      'max-function-length': { options: { max: 5 } },
    });
    const hits = diagnostics.filter(d => d.ruleId === 'max-function-length');
    assert.equal(hits.length, 1);
  });
});

// ============================================================
// max-nesting-depth
// ============================================================
describe('max-nesting-depth', () => {
  it('reports deeply nested code', async () => {
    const source = `
function handle(req) {
  if (req.body) {
    for (const item of req.body.items) {
      if (item.active) {
        try {
          if (item.value > 0) {
            console.log("deep");
          }
        } catch(e) {}
      }
    }
  }
}`;
    const diagnostics = await lintSource('test.js', source, {
      'max-nesting-depth': { options: { max: 4 } },
    });
    const hits = diagnostics.filter(d => d.ruleId === 'max-nesting-depth');
    assert.ok(hits.length >= 1, 'Should report at least one nesting violation');
    assert.ok(hits[0].message.includes('5'));
  });

  it('does not report acceptable nesting', async () => {
    const source = `
function handle(req) {
  if (req.body) {
    for (const item of req.body.items) {
      console.log(item);
    }
  }
}`;
    const diagnostics = await lintSource('test.js', source, {
      'max-nesting-depth': { options: { max: 4 } },
    });
    const hits = diagnostics.filter(d => d.ruleId === 'max-nesting-depth');
    assert.equal(hits.length, 0);
  });

  it('works with Python nested blocks', async () => {
    const source = `
def handle():
    if True:
        for x in range(10):
            if x > 0:
                while True:
                    if x > 5:
                        pass
`;
    const diagnostics = await lintSource('test.py', source, {
      'max-nesting-depth': { options: { max: 4 } },
    });
    const hits = diagnostics.filter(d => d.ruleId === 'max-nesting-depth');
    assert.ok(hits.length >= 1);
  });
});

// ============================================================
// no-console
// ============================================================
describe('no-console', () => {
  it('reports console.log calls', async () => {
    const source = 'console.log("hello");';
    const diagnostics = await lintSource('test.js', source);
    const hits = diagnostics.filter(d => d.ruleId === 'no-console');
    assert.equal(hits.length, 1);
    assert.ok(hits[0].message.includes('console.log'));
  });

  it('reports multiple console methods', async () => {
    const source = `
console.log("a");
console.warn("b");
console.error("c");
console.debug("d");
`;
    const diagnostics = await lintSource('test.js', source);
    const hits = diagnostics.filter(d => d.ruleId === 'no-console');
    assert.equal(hits.length, 4);
  });

  it('allows configured methods', async () => {
    const source = `
console.log("debug");
console.error("important");
`;
    const diagnostics = await lintSource('test.js', source, {
      'no-console': { options: { allow: ['error'] } },
    });
    const hits = diagnostics.filter(d => d.ruleId === 'no-console');
    assert.equal(hits.length, 1);
    assert.ok(hits[0].message.includes('console.log'));
  });

  it('does not report non-console member calls', async () => {
    const source = 'logger.log("hello");';
    const diagnostics = await lintSource('test.js', source);
    const hits = diagnostics.filter(d => d.ruleId === 'no-console');
    assert.equal(hits.length, 0);
  });

  it('does not fire on Python files', async () => {
    const source = 'print("hello")';
    const diagnostics = await lintSource('test.py', source);
    const hits = diagnostics.filter(d => d.ruleId === 'no-console');
    assert.equal(hits.length, 0);
  });
});

// ============================================================
// no-any
// ============================================================
describe('no-any', () => {
  it('reports any type annotation', async () => {
    const source = 'const x: any = 1;';
    const diagnostics = await lintSource('test.ts', source);
    const hits = diagnostics.filter(d => d.ruleId === 'no-any');
    assert.equal(hits.length, 1);
    assert.ok(hits[0].message.includes('any'));
  });

  it('reports any in function parameters', async () => {
    const source = 'function foo(x: any) {}';
    const diagnostics = await lintSource('test.ts', source);
    const hits = diagnostics.filter(d => d.ruleId === 'no-any');
    assert.equal(hits.length, 1);
  });

  it('does not report specific types', async () => {
    const source = 'const x: number = 1;\nconst y: string = "hello";';
    const diagnostics = await lintSource('test.ts', source);
    const hits = diagnostics.filter(d => d.ruleId === 'no-any');
    assert.equal(hits.length, 0);
  });

  it('does not fire on .js files', async () => {
    const source = 'const x = 1;';
    const diagnostics = await lintSource('test.js', source);
    const hits = diagnostics.filter(d => d.ruleId === 'no-any');
    assert.equal(hits.length, 0);
  });
});

// ============================================================
// no-unused-vars
// ============================================================
describe('no-unused-vars', () => {
  it('reports unused variables', async () => {
    const source = `
const unused = 1;
const used = 2;
console.log(used);
`;
    const diagnostics = await lintSource('test.js', source);
    const hits = diagnostics.filter(d => d.ruleId === 'no-unused-vars');
    assert.equal(hits.length, 1);
    assert.ok(hits[0].message.includes('unused'));
  });

  it('does not report used variables', async () => {
    const source = `
const x = 1;
const y = x + 2;
console.log(y);
`;
    const diagnostics = await lintSource('test.js', source);
    const hits = diagnostics.filter(d => d.ruleId === 'no-unused-vars');
    assert.equal(hits.length, 0);
  });

  it('ignores variables matching ignorePattern', async () => {
    const source = `
const _unused = 1;
const used = 2;
console.log(used);
`;
    const diagnostics = await lintSource('test.js', source);
    const hits = diagnostics.filter(d => d.ruleId === 'no-unused-vars');
    assert.equal(hits.length, 0);
  });

  it('reports multiple unused variables', async () => {
    const source = `
const a = 1;
const b = 2;
const c = 3;
`;
    const diagnostics = await lintSource('test.js', source);
    const hits = diagnostics.filter(d => d.ruleId === 'no-unused-vars');
    assert.equal(hits.length, 3);
  });
});

// ============================================================
// Engine integration
// ============================================================
describe('engine integration', () => {
  it('returns diagnostics with correct structure', async () => {
    const source = 'console.log("test");';
    const diagnostics = await lintSource('test.js', source);
    const d = diagnostics.find(d => d.ruleId === 'no-console');
    assert.ok(d);
    assert.equal(typeof d.line, 'number');
    assert.equal(typeof d.column, 'number');
    assert.equal(typeof d.severity, 'string');
    assert.equal(typeof d.message, 'string');
    assert.equal(typeof d.ruleId, 'string');
    assert.equal(d.filePath, 'test.js');
  });

  it('can disable rules via config', async () => {
    const source = 'console.log("test");';
    const diagnostics = await lintSource('test.js', source, {
      'no-console': { severity: 'off' },
    });
    const hits = diagnostics.filter(d => d.ruleId === 'no-console');
    assert.equal(hits.length, 0);
  });

  it('respects severity override', async () => {
    const source = 'console.log("test");';
    const diagnostics = await lintSource('test.js', source, {
      'no-console': { severity: 'error' },
    });
    const d = diagnostics.find(d => d.ruleId === 'no-console');
    assert.equal(d.severity, 'error');
  });

  it('returns empty array for unsupported file types', async () => {
    const diagnostics = await lintSource('test.rb', 'puts "hello"');
    assert.equal(diagnostics.length, 0);
  });

  it('applies TypeScript rules to .tsx files', async () => {
    const source = 'const x: any = 1;\nconsole.log(x);';
    const diagnostics = await lintSource('test.tsx', source);
    const noAny = diagnostics.filter(d => d.ruleId === 'no-any');
    const noConsole = diagnostics.filter(d => d.ruleId === 'no-console');
    assert.equal(noAny.length, 1, 'no-any should fire on .tsx files');
    assert.equal(noConsole.length, 1, 'no-console should fire on .tsx files');
  });

  it('parses TSX JSX syntax correctly', async () => {
    const source = 'const App = () => <div>hello</div>;';
    const diagnostics = await lintSource('test.tsx', source);
    // Should not crash, should detect unused var
    const unused = diagnostics.filter(d => d.ruleId === 'no-unused-vars');
    assert.equal(unused.length, 1);
  });
});
