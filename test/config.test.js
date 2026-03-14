import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig, parseRuleConfig, normalizeRules, deepMerge, generateDefaultConfig, getFileRuleConfigs } from '../src/config.js';

const TEST_DIR = join(import.meta.dirname, '_tmp_config_test');

describe('parseRuleConfig', () => {
  it('should parse string format', () => {
    const result = parseRuleConfig('error');
    assert.deepEqual(result, { severity: 'error', options: {} });
  });

  it('should parse tuple format', () => {
    const result = parseRuleConfig(['warning', { max: 40 }]);
    assert.deepEqual(result, { severity: 'warning', options: { max: 40 } });
  });

  it('should parse tuple without options', () => {
    const result = parseRuleConfig(['error']);
    assert.deepEqual(result, { severity: 'error', options: {} });
  });

  it('should throw on invalid format', () => {
    assert.throws(() => parseRuleConfig(42), /Invalid rule config/);
  });
});

describe('normalizeRules', () => {
  it('should normalize mixed rule configs', () => {
    const result = normalizeRules({
      'no-console': 'error',
      'max-function-length': ['warning', { max: 50 }],
    });
    assert.deepEqual(result, {
      'no-console': { severity: 'error', options: {} },
      'max-function-length': { severity: 'warning', options: { max: 50 } },
    });
  });
});

describe('deepMerge', () => {
  it('should merge nested objects', () => {
    const result = deepMerge(
      { a: 1, b: { c: 2, d: 3 } },
      { b: { c: 10 }, e: 5 }
    );
    assert.deepEqual(result, { a: 1, b: { c: 10, d: 3 }, e: 5 });
  });

  it('should replace arrays', () => {
    const result = deepMerge({ a: [1, 2] }, { a: [3] });
    assert.deepEqual(result, { a: [3] });
  });
});

describe('loadConfig', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('should return defaults when no config file exists', async () => {
    const config = await loadConfig({ cwd: TEST_DIR });
    assert.equal(config.configPath, null);
    assert.deepEqual(config.include, ['**/*']);
    assert.ok(config.normalizedRules['no-console']);
  });

  it('should load config from file', async () => {
    await writeFile(join(TEST_DIR, '.alphalintrc.json'), JSON.stringify({
      rules: { 'no-console': 'off' },
    }));
    const config = await loadConfig({ cwd: TEST_DIR });
    assert.equal(config.normalizedRules['no-console'].severity, 'off');
  });

  it('should apply CLI overrides', async () => {
    const config = await loadConfig({
      cwd: TEST_DIR,
      cliOverrides: { format: 'json' },
    });
    assert.equal(config.format, 'json');
  });

  it('should throw on invalid JSON', async () => {
    await writeFile(join(TEST_DIR, '.alphalintrc.json'), '{bad json}');
    await assert.rejects(
      () => loadConfig({ cwd: TEST_DIR }),
      /invalid JSON/
    );
  });

  it('should throw on invalid severity', async () => {
    await writeFile(join(TEST_DIR, '.alphalintrc.json'), JSON.stringify({
      rules: { 'no-console': 'fatal' },
    }));
    await assert.rejects(
      () => loadConfig({ cwd: TEST_DIR }),
      /invalid severity/
    );
  });

  it('should throw when explicit config path not found', async () => {
    await assert.rejects(
      () => loadConfig({ configPath: '/nonexistent/.alphalintrc.json', cwd: TEST_DIR }),
      /not found/
    );
  });
});

describe('getFileRuleConfigs', () => {
  it('should apply overrides for matching files', () => {
    const config = {
      normalizedRules: {
        'no-console': { severity: 'error', options: {} },
      },
      overrides: [{
        files: ['**/*.test.js'],
        rules: { 'no-console': 'off' },
      }],
    };
    const result = getFileRuleConfigs('src/foo.test.js', config);
    assert.equal(result['no-console'].severity, 'off');
  });

  it('should not apply overrides for non-matching files', () => {
    const config = {
      normalizedRules: {
        'no-console': { severity: 'error', options: {} },
      },
      overrides: [{
        files: ['**/*.test.js'],
        rules: { 'no-console': 'off' },
      }],
    };
    const result = getFileRuleConfigs('src/foo.js', config);
    assert.equal(result['no-console'].severity, 'error');
  });
});

describe('generateDefaultConfig', () => {
  it('should produce valid JSON', () => {
    const content = generateDefaultConfig();
    const parsed = JSON.parse(content);
    assert.ok(parsed.rules);
    assert.ok(parsed.include);
    assert.ok(parsed.exclude);
  });
});
