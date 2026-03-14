/**
 * 规则: max-nesting-depth
 * 检测代码块嵌套层级过深
 */
const nestingTypes = {
  javascript: new Set([
    'if_statement', 'for_statement', 'for_in_statement',
    'while_statement', 'do_statement', 'switch_statement', 'try_statement',
  ]),
  typescript: new Set([
    'if_statement', 'for_statement', 'for_in_statement',
    'while_statement', 'do_statement', 'switch_statement', 'try_statement',
  ]),
  python: new Set([
    'if_statement', 'for_statement', 'while_statement',
    'try_statement', 'with_statement',
  ]),
  go: new Set([
    'if_statement', 'for_statement', 'switch_statement', 'select_statement',
  ]),
};

function walkNesting(node, types, depth, max, context) {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (types.has(child.type)) {
      const newDepth = depth + 1;
      if (newDepth > max) {
        context.report({
          node: child,
          message: `Nesting depth ${newDepth} exceeds limit of ${max}`,
        });
      }
      walkNesting(child, types, newDepth, max, context);
    } else {
      walkNesting(child, types, depth, max, context);
    }
  }
}

export default {
  meta: {
    id: 'max-nesting-depth',
    description: '代码块嵌套层级不应过深',
    languages: ['javascript', 'typescript', 'python', 'go'],
    severity: 'warning',
    fixable: false,
    options: {
      max: { type: 'number', default: 4, description: '最大嵌套层数' },
    },
  },

  check(context) {
    const max = context.options.max;
    const types = nestingTypes[context.lang];
    if (!types) return;

    walkNesting(context.ast, types, 0, max, context);
  },
};
