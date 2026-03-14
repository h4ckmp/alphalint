/**
 * AlphaLint - 跨语言智能代码静态分析工具
 * 入口模块：注册内置规则，导出核心 API
 */
import { RuleRegistry } from './rules/registry.js';
import { parse, parseFile, detectLanguage, getRuleLang } from './parsers/index.js';
import { runRules } from './engine.js';
import { readFile } from 'node:fs/promises';

// 内置规则
import maxFunctionLength from './rules/universal/max-function-length.js';
import maxNestingDepth from './rules/universal/max-nesting-depth.js';
import noConsole from './rules/javascript/no-console.js';
import noAny from './rules/javascript/no-any.js';
import noUnusedVars from './rules/javascript/no-unused-vars.js';

// 创建全局规则注册表并注册内置规则
const registry = new RuleRegistry();
registry.register(maxFunctionLength);
registry.register(maxNestingDepth);
registry.register(noConsole);
registry.register(noAny);
registry.register(noUnusedVars);

/**
 * 分析单个文件
 * @param {string} filePath - 文件路径
 * @param {Object} ruleConfigs - 规则配置
 * @returns {Array} diagnostics
 */
export async function lintFile(filePath, ruleConfigs = {}) {
  const source = await readFile(filePath, 'utf-8');
  return lintSource(filePath, source, ruleConfigs);
}

/**
 * 分析源代码字符串
 * @param {string} filePath - 虚拟文件路径（用于语言检测）
 * @param {string} source - 源代码
 * @param {Object} ruleConfigs - 规则配置
 * @returns {Array} diagnostics
 */
export async function lintSource(filePath, source, ruleConfigs = {}) {
  const lang = detectLanguage(filePath);
  if (!lang) return [];

  const { tree } = await parse(filePath, source);
  // tsx → typescript for rule matching, so tsx files get TypeScript rules
  const ruleLang = getRuleLang(lang);
  const rules = registry.getRulesForLang(ruleLang);

  // 过滤掉配置为 'off' 的规则
  const activeRules = rules.filter(r => {
    const config = ruleConfigs[r.meta.id];
    return config?.severity !== 'off';
  });

  return runRules({ tree, lang: ruleLang, source, filePath, rules: activeRules, ruleConfigs });
}

export { registry, parse, parseFile, detectLanguage, runRules, RuleRegistry };
