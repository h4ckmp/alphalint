/**
 * 规则执行引擎 - visitor 模式遍历 AST，执行规则，收集诊断
 */
import { getLanguage } from './parsers/index.js';

/**
 * 深度优先遍历 AST，对匹配 nodeTypes 的节点调用 callback
 */
function visitNodes(rootNode, nodeTypes, callback) {
  const typeSet = new Set(nodeTypes);
  const cursor = rootNode.walk();
  let reachedRoot = false;

  while (!reachedRoot) {
    const node = cursor.currentNode;
    if (typeSet.has(node.type)) {
      callback(node);
    }

    if (cursor.gotoFirstChild()) continue;
    if (cursor.gotoNextSibling()) continue;

    while (true) {
      if (!cursor.gotoParent()) {
        reachedRoot = true;
        break;
      }
      if (cursor.gotoNextSibling()) break;
    }
  }
}

/**
 * 创建规则的执行上下文
 */
function createContext({ filePath, source, lang, ast, ruleConfig, language }) {
  const diagnostics = [];
  const severity = ruleConfig?.severity || 'warning';
  const options = ruleConfig?.options || {};

  return {
    filePath,
    source,
    lang,
    ast,
    severity,
    options,

    /**
     * 遍历 AST 中匹配指定节点类型的所有节点
     */
    visit(nodeTypes, callback) {
      visitNodes(ast, nodeTypes, callback);
    },

    /**
     * 执行 tree-sitter query
     */
    query(pattern) {
      if (!language) return [];
      const query = language.query(pattern);
      return query.matches(ast);
    },

    /**
     * 报告一个诊断问题
     */
    report({ node, message, severity: overrideSeverity }) {
      diagnostics.push({
        filePath,
        line: node.startPosition.row + 1,
        column: node.startPosition.column + 1,
        endLine: node.endPosition.row + 1,
        endColumn: node.endPosition.column + 1,
        severity: overrideSeverity || severity,
        message,
      });
    },

    getDiagnostics() {
      return diagnostics;
    },
  };
}

/**
 * 对单个文件执行所有适用规则
 * @param {{ tree, lang, source }} parseResult - 解析结果
 * @param {string} filePath - 文件路径
 * @param {Array} rules - 适用的规则列表
 * @param {Object} ruleConfigs - 规则配置 { ruleId: { severity, options } }
 * @returns {Array} diagnostics
 */
export async function runRules({ tree, lang, source, filePath, rules, ruleConfigs = {} }) {
  const allDiagnostics = [];
  let language;

  try {
    language = await getLanguage(lang);
  } catch {
    // language query support not available, continue without it
  }

  for (const rule of rules) {
    const ruleId = rule.meta.id;

    // 合并规则默认选项和用户配置
    const defaultOptions = {};
    if (rule.meta.options) {
      for (const [key, def] of Object.entries(rule.meta.options)) {
        defaultOptions[key] = def.default;
      }
    }

    const userConfig = ruleConfigs[ruleId] || {};
    const mergedConfig = {
      severity: userConfig.severity || rule.meta.severity || 'warning',
      options: { ...defaultOptions, ...userConfig.options },
    };

    const context = createContext({
      filePath,
      source,
      lang,
      ast: tree.rootNode,
      ruleConfig: mergedConfig,
      language,
    });

    try {
      rule.check(context);
    } catch (err) {
      allDiagnostics.push({
        filePath,
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 1,
        severity: 'error',
        message: `Rule "${ruleId}" threw an error: ${err.message}`,
        ruleId,
      });
      continue;
    }

    // 给每条诊断打上 ruleId 标记
    for (const d of context.getDiagnostics()) {
      d.ruleId = ruleId;
      allDiagnostics.push(d);
    }
  }

  return allDiagnostics;
}

export { visitNodes, createContext };
