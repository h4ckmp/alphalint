/**
 * 性能基线验证 - CEO 要求 Phase 1 第一周必须跑出这些数字
 *
 * 目标：
 * - 冷启动（含 WASM 加载）: < 500ms
 * - 单文件分析（500行）: < 50ms
 * - 100 文件项目: < 5s
 * - 内存占用: < 200MB
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lintSource } from '../src/index.js';

function generateJSFile(lines) {
  const parts = ['function generated() {'];
  for (let i = 0; i < lines - 2; i++) {
    parts.push(`  const x${i} = ${i}; // line ${i}`);
  }
  parts.push('}');
  return parts.join('\n');
}

describe('performance baseline', () => {
  it('single file (500 lines) < 50ms', async () => {
    const source = generateJSFile(500);

    // 预热 WASM
    await lintSource('warmup.js', 'const x = 1;');

    const start = performance.now();
    await lintSource('test.js', source);
    const elapsed = performance.now() - start;

    console.log(`  Single file (500 lines): ${elapsed.toFixed(1)}ms`);
    assert.ok(elapsed < 50, `Expected < 50ms, got ${elapsed.toFixed(1)}ms`);
  });

  it('100 files batch < 5s', async () => {
    const source = generateJSFile(200);

    // 预热
    await lintSource('warmup.js', 'const x = 1;');

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      await lintSource(`file${i}.js`, source);
    }
    const elapsed = performance.now() - start;

    console.log(`  100 files (200 lines each): ${elapsed.toFixed(0)}ms`);
    assert.ok(elapsed < 5000, `Expected < 5000ms, got ${elapsed.toFixed(0)}ms`);
  });

  it('memory usage < 200MB', async () => {
    const memBefore = process.memoryUsage().heapUsed;
    const source = generateJSFile(500);

    for (let i = 0; i < 50; i++) {
      await lintSource(`mem-test-${i}.js`, source);
    }

    const memAfter = process.memoryUsage().heapUsed;
    const memDeltaMB = (memAfter - memBefore) / 1024 / 1024;
    const totalMB = memAfter / 1024 / 1024;

    console.log(`  Memory delta: ${memDeltaMB.toFixed(1)}MB, total heap: ${totalMB.toFixed(1)}MB`);
    assert.ok(totalMB < 200, `Expected < 200MB, got ${totalMB.toFixed(1)}MB`);
  });
});
