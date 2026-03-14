/**
 * GitHub Actions 报告生成器 - 输出 workflow commands
 */

/**
 * 格式化诊断结果为 GitHub Actions annotations
 * @param {Array} diagnostics - 诊断数组
 * @returns {string} GitHub workflow commands
 */
export function formatGitHub(diagnostics) {
  if (diagnostics.length === 0) return '';

  const lines = diagnostics
    .sort((a, b) => a.filePath.localeCompare(b.filePath) || a.line - b.line)
    .map(d => {
      // GitHub 只支持 error, warning, notice
      const level = d.severity === 'error' ? 'error' :
                    d.severity === 'info' ? 'notice' : 'warning';
      const title = d.ruleId || 'alphalint';
      // 转义特殊字符
      const message = escapeGitHub(d.message);
      return `::${level} file=${d.filePath},line=${d.line},col=${d.column},title=${title}::${message}`;
    });

  return lines.join('\n') + '\n';
}

function escapeGitHub(str) {
  return str
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A');
}

export default formatGitHub;
