import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { discoverFiles, parseIgnoreFile } from '../src/file-discovery.js';

const TEST_DIR = join(import.meta.dirname, '_tmp_discovery_test');

describe('parseIgnoreFile', () => {
  it('should ignore matching files', () => {
    const isIgnored = parseIgnoreFile('*.log\nbuild/');
    assert.ok(isIgnored('debug.log'));
    assert.ok(isIgnored('build/output.js'));
    assert.ok(!isIgnored('src/index.js'));
  });

  it('should handle comments and empty lines', () => {
    const isIgnored = parseIgnoreFile('# comment\n\n*.tmp');
    assert.ok(isIgnored('test.tmp'));
    assert.ok(!isIgnored('test.js'));
  });

  it('should handle negation', () => {
    const isIgnored = parseIgnoreFile('*.js\n!important.js');
    assert.ok(isIgnored('foo.js'));
    assert.ok(!isIgnored('important.js'));
  });

  it('should return false for empty content', () => {
    const isIgnored = parseIgnoreFile('');
    assert.ok(!isIgnored('anything'));
  });
});

describe('discoverFiles', () => {
  beforeEach(async () => {
    await mkdir(join(TEST_DIR, 'src'), { recursive: true });
    await mkdir(join(TEST_DIR, 'node_modules', 'dep'), { recursive: true });
    await mkdir(join(TEST_DIR, 'dist'), { recursive: true });
    // Create test files
    await writeFile(join(TEST_DIR, 'src', 'index.ts'), 'const x = 1;');
    await writeFile(join(TEST_DIR, 'src', 'utils.js'), 'function foo() {}');
    await writeFile(join(TEST_DIR, 'src', 'style.css'), 'body {}');
    await writeFile(join(TEST_DIR, 'node_modules', 'dep', 'index.js'), 'module.exports = {};');
    await writeFile(join(TEST_DIR, 'dist', 'bundle.js'), 'var x=1;');
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('should find supported files in a directory', async () => {
    const files = await discoverFiles(['.'], { cwd: TEST_DIR });
    const names = files.map(f => f.split('/').slice(-2).join('/'));
    assert.ok(names.some(n => n === 'src/index.ts'));
    assert.ok(names.some(n => n === 'src/utils.js'));
  });

  it('should exclude node_modules and dist by default', async () => {
    const files = await discoverFiles(['.'], { cwd: TEST_DIR });
    assert.ok(!files.some(f => f.includes('node_modules')));
    assert.ok(!files.some(f => f.includes('dist')));
  });

  it('should skip unsupported extensions', async () => {
    const files = await discoverFiles(['.'], { cwd: TEST_DIR });
    assert.ok(!files.some(f => f.endsWith('.css')));
  });

  it('should handle direct file paths', async () => {
    const files = await discoverFiles(['src/index.ts'], { cwd: TEST_DIR });
    assert.equal(files.length, 1);
    assert.ok(files[0].endsWith('index.ts'));
  });

  it('should respect .gitignore', async () => {
    await writeFile(join(TEST_DIR, '.gitignore'), 'src/utils.js');
    const files = await discoverFiles(['.'], { cwd: TEST_DIR });
    assert.ok(!files.some(f => f.endsWith('utils.js')));
    assert.ok(files.some(f => f.endsWith('index.ts')));
  });

  it('should respect .alphalintignore', async () => {
    await writeFile(join(TEST_DIR, '.alphalintignore'), '*.ts');
    const files = await discoverFiles(['.'], { cwd: TEST_DIR });
    assert.ok(!files.some(f => f.endsWith('.ts')));
    assert.ok(files.some(f => f.endsWith('.js')));
  });

  it('should respect language config', async () => {
    const files = await discoverFiles(['.'], {
      cwd: TEST_DIR,
      languages: { javascript: true, typescript: false },
    });
    assert.ok(!files.some(f => f.endsWith('.ts')));
    assert.ok(files.some(f => f.endsWith('.js')));
  });

  it('should return empty array for nonexistent paths', async () => {
    const files = await discoverFiles(['nonexistent/'], { cwd: TEST_DIR });
    assert.equal(files.length, 0);
  });

  it('should return sorted results', async () => {
    const files = await discoverFiles(['.'], { cwd: TEST_DIR });
    const sorted = [...files].sort();
    assert.deepEqual(files, sorted);
  });
});
