/**
 * 终端报告生成器 - 彩色终端输出，类似 ESLint 风格
 */

// ANSI 颜色码
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

const SEVERITY_STYLES = {
  error:   { icon: '✖', color: colors.red,    label: 'error  ' },
  warning: { icon: '⚠', color: colors.yellow, label: 'warning' },
  info:    { icon: 'ℹ', color: colors.blue,   label: 'info   ' },
};

/**
 * 格式化诊断结果为彩色终端输出
 * @param {Array} diagnostics - 诊断数组
 * @param {Object} meta - 元数据 { filesAnalyzed, durationMs }
 * @returns {string} 格式化的输出文本
 */
export function formatTerminal(diagnostics, meta = {}) {
  if (diagnostics.length === 0) {
    const fileCount = meta.filesAnalyzed || 0;
    const duration = meta.durationMs ? ` in ${formatDuration(meta.durationMs)}` : '';
    return `${colors.bold}${colors.white}✓ No problems found${colors.reset}` +
           `${colors.gray} (analyzed ${fileCount} files${duration})${colors.reset}\n`;
  }

  // 按文件分组
  const grouped = groupByFile(diagnostics);
  const lines = [];

  for (const [filePath, problems] of grouped) {
    // 文件路径
    lines.push(`${colors.bold}${colors.white}  ${filePath}${colors.reset}`);

    // 排序：行号 → 列号
    problems.sort((a, b) => a.line - b.line || a.column - b.column);

    // 计算列宽
    const maxLineCol = Math.max(...problems.map(p => `${p.line}:${p.column}`.length));

    for (const problem of problems) {
      const style = SEVERITY_STYLES[problem.severity] || SEVERITY_STYLES.warning;
      const lineCol = `${problem.line}:${problem.column}`;
      const padded = lineCol.padEnd(maxLineCol + 2);

      lines.push(
        `    ${colors.gray}${padded}${colors.reset}` +
        `${style.color}${style.icon} ${style.label}${colors.reset}  ` +
        `${problem.message}` +
        `  ${colors.gray}${problem.ruleId || ''}${colors.reset}`
      );
    }

    lines.push(''); // 空行分隔
  }

  // 摘要行
  const summary = buildSummary(diagnostics, meta);
  lines.push(`  ${colors.gray}${'─'.repeat(40)}${colors.reset}`);
  lines.push(`  ${summary}`);

  return lines.join('\n') + '\n';
}

/**
 * 按文件分组并排序
 */
function groupByFile(diagnostics) {
  const map = new Map();
  for (const d of diagnostics) {
    if (!map.has(d.filePath)) map.set(d.filePath, []);
    map.get(d.filePath).push(d);
  }
  // 按文件路径排序
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

/**
 * 构建摘要行
 */
function buildSummary(diagnostics, meta) {
  const counts = { error: 0, warning: 0, info: 0 };
  for (const d of diagnostics) {
    counts[d.severity] = (counts[d.severity] || 0) + 1;
  }

  const parts = [];
  if (counts.error > 0) {
    parts.push(`${colors.red}✖ ${counts.error} error${counts.error > 1 ? 's' : ''}${colors.reset}`);
  }
  if (counts.warning > 0) {
    parts.push(`${colors.yellow}${counts.warning} warning${counts.warning > 1 ? 's' : ''}${colors.reset}`);
  }
  if (counts.info > 0) {
    parts.push(`${colors.blue}${counts.info} info${colors.reset}`);
  }

  const total = diagnostics.length;
  const fileCount = new Set(diagnostics.map(d => d.filePath)).size;
  const filesAnalyzed = meta.filesAnalyzed || fileCount;
  const duration = meta.durationMs ? ` in ${formatDuration(meta.durationMs)}` : '';

  return `${parts.join(', ')} in ${fileCount} file${fileCount > 1 ? 's' : ''} ` +
         `${colors.gray}(${total} problem${total > 1 ? 's' : ''} total)${colors.reset}\n` +
         `  ${colors.gray}Analyzed ${filesAnalyzed} files${duration}${colors.reset}`;
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default formatTerminal;
