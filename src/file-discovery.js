/**
 * 文件发现模块 - 递归扫描目标路径，尊重 .gitignore 和 .alphalintignore
 * 零依赖实现
 */
import { readdir, readFile, stat, access } from 'node:fs/promises';
import { resolve, relative, join, extname, dirname } from 'node:path';

// 支持的文件扩展名
const SUPPORTED_EXTENSIONS = new Set([
  '.js', '.jsx', '.mjs', '.cjs',
  '.ts', '.tsx',
  '.py',
  '.go',
]);

/**
 * 解析 gitignore 格式的忽略文件
 * @param {string} content - 忽略文件内容
 * @returns {Function} 匹配函数 (relativePath) => boolean
 */
function parseIgnoreFile(content) {
  const patterns = content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));

  if (patterns.length === 0) return () => false;

  const matchers = patterns.map(pattern => {
    const negate = pattern.startsWith('!');
    if (negate) pattern = pattern.slice(1);

    // 将 gitignore 模式转为正则表达式
    let regex = patternToRegex(pattern);
    return { regex, negate };
  });

  return (filePath) => {
    let ignored = false;
    for (const { regex, negate } of matchers) {
      if (regex.test(filePath)) {
        ignored = !negate;
      }
    }
    return ignored;
  };
}

/**
 * gitignore 模式转正则
 */
function patternToRegex(pattern) {
  // 去除末尾斜杠（表示仅匹配目录，我们简化处理）
  const dirOnly = pattern.endsWith('/');
  if (dirOnly) pattern = pattern.slice(0, -1);

  // 如果模式不含斜杠，匹配任意层级
  const hasSlash = pattern.includes('/');

  let regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // 转义特殊字符
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');

  if (hasSlash) {
    // 含斜杠：相对于根目录匹配
    if (pattern.startsWith('/')) {
      regex = regex.slice(2); // 去掉前导 \/
    }
    return new RegExp(`^${regex}($|/)`);
  } else {
    // 不含斜杠：匹配任意层级中的该名称
    return new RegExp(`(^|/)${regex}($|/)`);
  }
}

/**
 * 加载忽略规则（.gitignore + .alphalintignore）
 */
async function loadIgnoreRules(rootDir) {
  const matchers = [];

  for (const ignoreFile of ['.gitignore', '.alphalintignore']) {
    const filePath = join(rootDir, ignoreFile);
    try {
      const content = await readFile(filePath, 'utf-8');
      matchers.push(parseIgnoreFile(content));
    } catch {
      // 文件不存在，跳过
    }
  }

  return (relativePath) => matchers.some(m => m(relativePath));
}

/**
 * 默认排除列表
 */
const DEFAULT_EXCLUDES = new Set([
  'node_modules', 'dist', 'build', 'vendor', '.git',
  'coverage', '__pycache__', '.next', '.nuxt', '.output',
]);

/**
 * 检查文件扩展名是否受语言配置支持
 */
function isLanguageEnabled(ext, languages) {
  if (!languages) return true;

  const langMap = {
    '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
    '.ts': 'typescript', '.tsx': 'typescript',
    '.py': 'python',
    '.go': 'go',
  };

  const lang = langMap[ext];
  return lang ? languages[lang] !== false : false;
}

/**
 * 递归发现文件
 * @param {string[]} paths - 目标路径（文件或目录）
 * @param {Object} config - 配置对象
 * @returns {Promise<string[]>} 文件路径列表
 */
export async function discoverFiles(paths, config = {}) {
  const exclude = new Set(config.exclude || DEFAULT_EXCLUDES);
  const languages = config.languages;
  const files = [];

  // 确定根目录（用于加载 ignore 文件）
  const rootDir = config.cwd || process.cwd();
  const isIgnored = await loadIgnoreRules(rootDir);

  for (const targetPath of paths) {
    const absPath = resolve(rootDir, targetPath);

    try {
      const stats = await stat(absPath);

      if (stats.isFile()) {
        // 直接指定的文件，只检查扩展名
        const ext = extname(absPath);
        if (SUPPORTED_EXTENSIONS.has(ext) && isLanguageEnabled(ext, languages)) {
          files.push(absPath);
        }
      } else if (stats.isDirectory()) {
        // 递归扫描目录
        await walkDir(absPath, rootDir, files, exclude, isIgnored, languages);
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        // 路径不存在，静默跳过（CLI 层会处理错误提示）
        continue;
      }
      throw err;
    }
  }

  // 去重并排序
  return [...new Set(files)].sort();
}

/**
 * 递归遍历目录
 */
async function walkDir(dir, rootDir, files, exclude, isIgnored, languages) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // 无权限等，跳过
  }

  for (const entry of entries) {
    const name = entry.name;

    // 跳过默认排除目录和隐藏文件/目录（以 . 开头，除了当前/父目录）
    if (exclude.has(name)) continue;
    if (name.startsWith('.') && name !== '.' && name !== '..') continue;

    const fullPath = join(dir, name);
    const relPath = relative(rootDir, fullPath);

    // 检查 ignore 规则
    if (isIgnored(relPath)) continue;

    if (entry.isDirectory()) {
      await walkDir(fullPath, rootDir, files, exclude, isIgnored, languages);
    } else if (entry.isFile()) {
      const ext = extname(name);
      if (SUPPORTED_EXTENSIONS.has(ext) && isLanguageEnabled(ext, languages)) {
        files.push(fullPath);
      }
    }
  }
}

export { parseIgnoreFile, SUPPORTED_EXTENSIONS, loadIgnoreRules };
