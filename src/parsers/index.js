/**
 * AST 解析层 - 基于 web-tree-sitter 的统一解析接口
 */
import Parser from 'web-tree-sitter';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 语言检测：扩展名 → 语言标识
const EXTENSION_MAP = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.py': 'python',
  '.go': 'go',
};

// 规则语言映射：内部语言标识 → 规则适用语言列表
// tsx 文件共享 typescript + javascript 的规则
const RULE_LANG_MAP = {
  javascript: 'javascript',
  typescript: 'typescript',
  tsx: 'typescript',
  python: 'python',
  go: 'go',
};

// WASM 文件路径映射
const WASM_MAP = {
  javascript: 'tree-sitter-javascript.wasm',
  typescript: 'tree-sitter-typescript.wasm',
  tsx: 'tree-sitter-tsx.wasm',
  python: 'tree-sitter-python.wasm',
  go: 'tree-sitter-go.wasm',
};

let parserInitialized = false;
const languageCache = new Map();

/**
 * 初始化 tree-sitter WASM runtime
 */
async function ensureInit() {
  if (parserInitialized) return;
  const wasmPath = resolve(__dirname, '../../node_modules/web-tree-sitter/tree-sitter.wasm');
  await Parser.init({
    locateFile: () => wasmPath,
  });
  parserInitialized = true;
}

/**
 * 加载指定语言的 grammar（懒加载 + 缓存）
 */
async function loadLanguage(lang) {
  if (languageCache.has(lang)) return languageCache.get(lang);

  const wasmFile = WASM_MAP[lang];
  if (!wasmFile) throw new Error(`Unsupported language: ${lang}`);

  const wasmPath = resolve(__dirname, '../../node_modules/tree-sitter-wasms/out', wasmFile);
  const language = await Parser.Language.load(wasmPath);
  languageCache.set(lang, language);
  return language;
}

/**
 * 从文件扩展名检测语言
 */
export function detectLanguage(filePath) {
  const ext = filePath.slice(filePath.lastIndexOf('.'));
  return EXTENSION_MAP[ext] || null;
}

/**
 * 解析源代码文件，返回 { tree, lang, parser }
 * @param {string} filePath - 文件路径
 * @param {string} source - 源代码文本
 * @returns {{ tree: Tree, lang: string }}
 */
export async function parse(filePath, source) {
  const lang = detectLanguage(filePath);
  if (!lang) throw new Error(`Cannot detect language for: ${filePath}`);

  await ensureInit();
  const language = await loadLanguage(lang);

  const parser = new Parser();
  parser.setLanguage(language);
  const tree = parser.parse(source);

  return { tree, lang };
}

/**
 * 解析文件（自动读取内容）
 */
export async function parseFile(filePath) {
  const source = await readFile(filePath, 'utf-8');
  const result = await parse(filePath, source);
  return { ...result, source };
}

/**
 * 获取已加载的语言对象（用于 tree-sitter query）
 */
export async function getLanguage(lang) {
  await ensureInit();
  return loadLanguage(lang);
}

/**
 * 获取规则适用的语言标识（tsx → typescript，其余不变）
 */
export function getRuleLang(lang) {
  return RULE_LANG_MAP[lang] || lang;
}

export { Parser };
