/**
 * 配置加载器 - 加载、合并、验证 .alphalintrc.json
 */
import { readFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

// 内置默认配置
const DEFAULT_CONFIG = {
  include: ['**/*'],
  exclude: ['node_modules', 'dist', 'build', 'vendor', '.git', 'coverage'],
  languages: {
    javascript: true,
    typescript: true,
    python: true,
    go: true,
  },
  rules: {
    'max-function-length': ['warning', { max: 50 }],
    'max-nesting-depth': ['warning', { max: 4 }],
    'no-unused-vars': ['warning', { ignorePattern: '^_' }],
    'no-console': 'warning',
    'no-any': 'warning',
  },
  format: 'terminal',
  overrides: [],
};

const VALID_SEVERITIES = new Set(['off', 'info', 'warning', 'error']);

/**
 * 解析规则配置项（支持字符串和元组两种格式）
 * "error" → { severity: "error", options: {} }
 * ["warning", { max: 40 }] → { severity: "warning", options: { max: 40 } }
 */
export function parseRuleConfig(value) {
  if (typeof value === 'string') {
    return { severity: value, options: {} };
  }
  if (Array.isArray(value) && value.length >= 1) {
    return {
      severity: value[0],
      options: value[1] || {},
    };
  }
  throw new Error(`Invalid rule config: ${JSON.stringify(value)}`);
}

/**
 * 验证配置对象
 */
function validateConfig(config, filePath) {
  const errors = [];

  // 验证 rules 中的 severity
  if (config.rules) {
    for (const [ruleId, value] of Object.entries(config.rules)) {
      try {
        const { severity } = parseRuleConfig(value);
        if (!VALID_SEVERITIES.has(severity)) {
          errors.push(`Rule "${ruleId}": invalid severity "${severity}". Must be one of: ${[...VALID_SEVERITIES].join(', ')}`);
        }
      } catch (e) {
        errors.push(`Rule "${ruleId}": ${e.message}`);
      }
    }
  }

  // 验证 format
  if (config.format && !['terminal', 'json', 'github'].includes(config.format)) {
    errors.push(`Invalid format "${config.format}". Must be one of: terminal, json, github`);
  }

  if (errors.length > 0) {
    const prefix = filePath ? `Config error in ${filePath}:\n` : 'Config error:\n';
    throw new Error(prefix + errors.map(e => `  - ${e}`).join('\n'));
  }
}

/**
 * 从指定目录向上查找 .alphalintrc.json
 */
async function findConfigFile(startDir) {
  let dir = resolve(startDir);
  const root = resolve('/');

  while (true) {
    const candidate = resolve(dir, '.alphalintrc.json');
    try {
      await access(candidate);
      return candidate;
    } catch {
      // not found, go up
    }

    const parent = dirname(dir);
    if (parent === dir || dir === root) break;
    dir = parent;
  }

  return null;
}

/**
 * 深度合并两个对象（right 覆盖 left）
 */
function deepMerge(left, right) {
  const result = { ...left };
  for (const [key, value] of Object.entries(right)) {
    if (value && typeof value === 'object' && !Array.isArray(value) &&
        result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * 将 rules 配置标准化为 { ruleId: { severity, options } } 格式
 */
export function normalizeRules(rules) {
  const normalized = {};
  for (const [ruleId, value] of Object.entries(rules)) {
    normalized[ruleId] = parseRuleConfig(value);
  }
  return normalized;
}

/**
 * 加载配置
 * @param {Object} options
 * @param {string} [options.configPath] - 显式指定配置文件路径
 * @param {string} [options.cwd] - 工作目录（用于查找配置文件）
 * @param {Object} [options.cliOverrides] - CLI 参数覆盖
 * @returns {Object} 最终配置
 */
export async function loadConfig({ configPath, cwd = process.cwd(), cliOverrides = {} } = {}) {
  let fileConfig = {};
  let resolvedConfigPath = null;

  if (configPath) {
    // 显式指定了配置文件
    resolvedConfigPath = resolve(cwd, configPath);
    try {
      const content = await readFile(resolvedConfigPath, 'utf-8');
      fileConfig = JSON.parse(content);
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error(`Config file not found: ${resolvedConfigPath}`);
      }
      if (err instanceof SyntaxError) {
        throw new Error(`Config file has invalid JSON: ${resolvedConfigPath}\n  ${err.message}`);
      }
      throw err;
    }
  } else {
    // 自动查找
    resolvedConfigPath = await findConfigFile(cwd);
    if (resolvedConfigPath) {
      try {
        const content = await readFile(resolvedConfigPath, 'utf-8');
        fileConfig = JSON.parse(content);
      } catch (err) {
        if (err instanceof SyntaxError) {
          throw new Error(`Config file has invalid JSON: ${resolvedConfigPath}\n  ${err.message}`);
        }
        throw err;
      }
    }
  }

  // 验证文件配置
  if (Object.keys(fileConfig).length > 0) {
    validateConfig(fileConfig, resolvedConfigPath);
  }

  // 合并：默认值 ← 文件配置 ← CLI 覆盖
  let merged = deepMerge(DEFAULT_CONFIG, fileConfig);
  if (Object.keys(cliOverrides).length > 0) {
    merged = deepMerge(merged, cliOverrides);
  }

  // 标准化 rules
  merged.normalizedRules = normalizeRules(merged.rules);

  // 冻结
  merged.configPath = resolvedConfigPath;
  return merged;
}

/**
 * 根据文件路径应用 overrides，返回该文件的最终规则配置
 */
export function getFileRuleConfigs(filePath, config) {
  const baseRules = { ...config.normalizedRules };

  if (!config.overrides || config.overrides.length === 0) {
    return baseRules;
  }

  for (const override of config.overrides) {
    if (matchesPatterns(filePath, override.files)) {
      if (override.rules) {
        const overrideNormalized = normalizeRules(override.rules);
        Object.assign(baseRules, overrideNormalized);
      }
    }
  }

  return baseRules;
}

/**
 * 简单的 glob 模式匹配（支持 ** 和 *）
 */
function matchesPatterns(filePath, patterns) {
  return patterns.some(pattern => {
    const regex = globToRegex(pattern);
    return regex.test(filePath);
  });
}

function globToRegex(pattern) {
  let regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // 转义特殊字符
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');
  return new RegExp(`^${regex}$|/${regex}$|^${regex}/|/${regex}/`);
}

/**
 * 生成 alphalint init 的默认配置文件内容
 */
export function generateDefaultConfig() {
  return JSON.stringify({
    include: ['**/*'],
    exclude: ['node_modules', 'dist', 'build', 'vendor', '.git', 'coverage'],
    rules: {
      'max-function-length': ['warning', { max: 50 }],
      'max-nesting-depth': ['warning', { max: 4 }],
      'no-unused-vars': ['warning', { ignorePattern: '^_' }],
      'no-console': 'warning',
      'no-any': 'warning',
    },
  }, null, 2) + '\n';
}

export { DEFAULT_CONFIG, findConfigFile, deepMerge };
