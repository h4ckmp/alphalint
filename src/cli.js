#!/usr/bin/env node
/**
 * AlphaLint CLI 入口 - 参数解析、子命令分发
 * 使用 Node.js 内置 parseArgs，零依赖
 */
import { parseArgs } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadConfig, generateDefaultConfig, getFileRuleConfigs } from './config.js';
import { discoverFiles } from './file-discovery.js';
import { lintFile, registry } from './index.js';
import { formatTerminal } from './reporters/terminal.js';
import { formatJSON } from './reporters/json.js';
import { formatGitHub } from './reporters/github.js';

const VERSION = '0.1.0';

const HELP_TEXT = `
alphalint - 跨语言智能代码静态分析工具

Usage:
  alphalint [check] <paths...> [options]
  alphalint init
  alphalint list-rules [--lang <language>]

Commands:
  check       分析指定文件/目录（默认命令）
  init        生成 .alphalintrc.json 配置文件
  list-rules  列出所有可用规则

Options:
  --config <path>    指定配置文件路径
  --format <type>    输出格式: terminal (默认), json, github
  --fix              自动修复（预留，暂未实现）
  --max-warnings <n> 最大 warning 数量，超过则 exit 1
  --version          显示版本号
  --help             显示帮助信息

Examples:
  alphalint src/
  alphalint check src/ lib/ --format json
  alphalint --config custom.json src/
  alphalint init
`.trim();

/**
 * 解析命令行参数
 */
function parseCLIArgs(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      config: { type: 'string' },
      format: { type: 'string' },
      fix: { type: 'boolean', default: false },
      'max-warnings': { type: 'string' },
      lang: { type: 'string' },
      version: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
    allowPositionals: true,
    strict: false,
  });

  return { values, positionals };
}

/**
 * check 子命令 - 核心 lint 流程
 */
async function cmdCheck(paths, options) {
  // 加载配置
  const cliOverrides = {};
  if (options.format) cliOverrides.format = options.format;

  const config = await loadConfig({
    configPath: options.config,
    cliOverrides,
  });

  const format = config.format || 'terminal';

  // 如果没有指定路径，默认当前目录
  const targetPaths = paths.length > 0 ? paths : ['.'];

  // 文件发现
  const files = await discoverFiles(targetPaths, config);

  if (files.length === 0) {
    process.stderr.write('alphalint: No files found to analyze.\n');
    process.exit(0);
  }

  // 分析所有文件
  const startTime = Date.now();
  const allDiagnostics = [];

  for (const filePath of files) {
    try {
      const ruleConfigs = getFileRuleConfigs(filePath, config);
      const diagnostics = await lintFile(filePath, ruleConfigs);
      allDiagnostics.push(...diagnostics);
    } catch (err) {
      // 单文件失败不中断整个流程
      allDiagnostics.push({
        filePath,
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 1,
        severity: 'error',
        message: `Failed to analyze: ${err.message}`,
        ruleId: 'internal-error',
      });
    }
  }

  const durationMs = Date.now() - startTime;

  const meta = {
    filesAnalyzed: files.length,
    durationMs,
  };

  // 生成报告
  let output;
  switch (format) {
    case 'json':
      output = formatJSON(allDiagnostics, meta);
      break;
    case 'github':
      output = formatGitHub(allDiagnostics);
      break;
    case 'terminal':
    default:
      output = formatTerminal(allDiagnostics, meta);
      break;
  }

  process.stdout.write(output);

  // 决定 exit code
  const errorCount = allDiagnostics.filter(d => d.severity === 'error').length;
  const warningCount = allDiagnostics.filter(d => d.severity === 'warning').length;

  if (errorCount > 0) {
    process.exit(1);
  }

  // --max-warnings 支持
  const maxWarnings = options['max-warnings'] !== undefined
    ? parseInt(options['max-warnings'], 10)
    : Infinity;

  if (warningCount > maxWarnings) {
    process.stderr.write(
      `\nalphalint: Too many warnings (${warningCount}). Maximum allowed: ${maxWarnings}.\n`
    );
    process.exit(1);
  }

  process.exit(0);
}

/**
 * init 子命令 - 生成配置文件
 */
async function cmdInit() {
  const configPath = resolve('.alphalintrc.json');
  try {
    await writeFile(configPath, generateDefaultConfig(), { flag: 'wx' });
    process.stdout.write(`Created ${configPath}\n`);
  } catch (err) {
    if (err.code === 'EEXIST') {
      process.stderr.write(`alphalint: .alphalintrc.json already exists.\n`);
      process.exit(2);
    }
    throw err;
  }
}

/**
 * list-rules 子命令
 */
function cmdListRules(options) {
  let rules = registry.listAll();

  if (options.lang) {
    rules = rules.filter(r =>
      r.languages === '*' ||
      (Array.isArray(r.languages) && r.languages.includes(options.lang))
    );
  }

  if (rules.length === 0) {
    process.stdout.write('No rules found.\n');
    return;
  }

  // 表格输出
  const maxId = Math.max(...rules.map(r => r.id.length), 4);
  const maxDesc = Math.max(...rules.map(r => (r.description || '').length), 11);

  process.stdout.write(`\n  ${'Rule'.padEnd(maxId + 2)}${'Severity'.padEnd(10)}${'Languages'.padEnd(20)}Description\n`);
  process.stdout.write(`  ${'─'.repeat(maxId + 2 + 10 + 20 + 30)}\n`);

  for (const rule of rules) {
    const langs = rule.languages === '*' ? '*' : (rule.languages || []).join(', ');
    process.stdout.write(
      `  ${rule.id.padEnd(maxId + 2)}${(rule.severity || 'warning').padEnd(10)}${langs.padEnd(20)}${rule.description || ''}\n`
    );
  }
  process.stdout.write('\n');
}

/**
 * 主入口
 */
async function main() {
  try {
    const { values, positionals } = parseCLIArgs(process.argv.slice(2));

    if (values.version) {
      process.stdout.write(`alphalint v${VERSION}\n`);
      return;
    }

    if (values.help) {
      process.stdout.write(HELP_TEXT + '\n');
      return;
    }

    // 判断子命令
    const firstArg = positionals[0];

    if (firstArg === 'init') {
      await cmdInit();
      return;
    }

    if (firstArg === 'list-rules') {
      cmdListRules(values);
      return;
    }

    // check 命令（显式或隐式）
    const paths = firstArg === 'check' ? positionals.slice(1) : positionals;
    await cmdCheck(paths, values);
  } catch (err) {
    process.stderr.write(`alphalint: ${err.message}\n`);
    process.exit(2);
  }
}

main();
