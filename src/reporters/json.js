/**
 * JSON 报告生成器 - 结构化输出，供 CI/CD 消费
 */
import { detectLanguage } from '../parsers/index.js';

/**
 * 格式化诊断结果为 JSON
 * @param {Array} diagnostics - 诊断数组
 * @param {Object} meta - 元数据 { filesAnalyzed, durationMs }
 * @returns {string} JSON 字符串
 */
export function formatJSON(diagnostics, meta = {}) {
  const counts = { error: 0, warning: 0, info: 0 };
  for (const d of diagnostics) {
    counts[d.severity] = (counts[d.severity] || 0) + 1;
  }

  const filesWithProblems = new Set(diagnostics.map(d => d.filePath));

  // 按文件分组
  const resultMap = new Map();
  for (const d of diagnostics) {
    if (!resultMap.has(d.filePath)) {
      resultMap.set(d.filePath, []);
    }
    resultMap.get(d.filePath).push(d);
  }

  const results = [...resultMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([filePath, problems]) => ({
      filePath,
      language: detectLanguage(filePath) || 'unknown',
      problems: problems
        .sort((a, b) => a.line - b.line || a.column - b.column)
        .map(p => ({
          ruleId: p.ruleId || 'unknown',
          severity: p.severity,
          message: p.message,
          location: {
            start: { line: p.line, column: p.column },
            end: { line: p.endLine, column: p.endColumn },
          },
        })),
    }));

  const report = {
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    summary: {
      filesAnalyzed: meta.filesAnalyzed || 0,
      filesWithProblems: filesWithProblems.size,
      errors: counts.error,
      warnings: counts.warning,
      infos: counts.info,
      totalProblems: diagnostics.length,
      durationMs: meta.durationMs || 0,
    },
    results,
  };

  return JSON.stringify(report, null, 2) + '\n';
}

export default formatJSON;
