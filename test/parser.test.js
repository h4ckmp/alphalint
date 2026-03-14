import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse, detectLanguage } from '../src/parsers/index.js';

describe('detectLanguage', () => {
  it('detects JavaScript files', () => {
    assert.equal(detectLanguage('foo.js'), 'javascript');
    assert.equal(detectLanguage('bar.mjs'), 'javascript');
    assert.equal(detectLanguage('baz.jsx'), 'javascript');
  });

  it('detects TypeScript files', () => {
    assert.equal(detectLanguage('foo.ts'), 'typescript');
    assert.equal(detectLanguage('bar.tsx'), 'tsx');
  });

  it('detects Python files', () => {
    assert.equal(detectLanguage('foo.py'), 'python');
  });

  it('detects Go files', () => {
    assert.equal(detectLanguage('foo.go'), 'go');
  });

  it('returns null for unknown extensions', () => {
    assert.equal(detectLanguage('foo.rb'), null);
    assert.equal(detectLanguage('foo.rs'), null);
  });
});

describe('parse', () => {
  it('parses JavaScript code', async () => {
    const { tree, lang } = await parse('test.js', 'const x = 1;');
    assert.equal(lang, 'javascript');
    assert.ok(tree.rootNode);
    assert.equal(tree.rootNode.type, 'program');
  });

  it('parses TypeScript code', async () => {
    const { tree, lang } = await parse('test.ts', 'const x: number = 1;');
    assert.equal(lang, 'typescript');
    assert.ok(tree.rootNode);
  });

  it('parses Python code', async () => {
    const { tree, lang } = await parse('test.py', 'x = 1\nprint(x)');
    assert.equal(lang, 'python');
    assert.ok(tree.rootNode);
  });

  it('parses Go code', async () => {
    const { tree, lang } = await parse('test.go', 'package main\nfunc main() {}');
    assert.equal(lang, 'go');
    assert.ok(tree.rootNode);
  });

  it('handles syntax errors gracefully (fault-tolerant)', async () => {
    const { tree } = await parse('test.js', 'const x = ;');
    assert.ok(tree.rootNode);
    assert.ok(tree.rootNode.hasError);
  });
});
