/**
 * 规则: max-function-length
 * 检测函数体超过指定行数
 */
const nodeTypes = {
  javascript: ['function_declaration', 'arrow_function', 'method_definition', 'function'],
  typescript: ['function_declaration', 'arrow_function', 'method_definition', 'function'],
  python: ['function_definition'],
  go: ['function_declaration', 'method_declaration'],
};

function getFunctionName(node) {
  // 尝试从不同语言的函数节点中提取函数名
  const nameNode = node.childForFieldName('name')
    || node.childForFieldName('declarator');
  if (nameNode) return nameNode.text;

  // arrow function: 看父节点是否是变量声明
  if (node.parent?.type === 'variable_declarator') {
    const id = node.parent.childForFieldName('name');
    if (id) return id.text;
  }

  return '<anonymous>';
}

export default {
  meta: {
    id: 'max-function-length',
    description: '函数体不应超过指定行数',
    languages: ['javascript', 'typescript', 'python', 'go'],
    severity: 'warning',
    fixable: false,
    options: {
      max: { type: 'number', default: 50, description: '最大行数' },
    },
  },

  nodeTypes,

  check(context) {
    const max = context.options.max;
    const types = nodeTypes[context.lang];
    if (!types) return;

    context.visit(types, (node) => {
      const lines = node.endPosition.row - node.startPosition.row + 1;
      if (lines > max) {
        context.report({
          node,
          message: `Function "${getFunctionName(node)}" has ${lines} lines, exceeds limit of ${max}`,
        });
      }
    });
  },
};
