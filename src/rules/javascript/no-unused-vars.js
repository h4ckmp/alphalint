/**
 * 规则: no-unused-vars
 * 检测声明了但从未使用的变量（Phase 1 简化方案）
 *
 * 已知局限：
 * - 不处理 eval() 动态引用
 * - 不跨文件分析（导出视为已使用）
 * - 函数参数暂不报告
 */

function collectDeclarations(rootNode) {
  const declarations = new Map(); // name → node
  const cursor = rootNode.walk();
  let reachedRoot = false;

  while (!reachedRoot) {
    const node = cursor.currentNode;

    // variable_declarator → name 字段是声明的标识符
    if (node.type === 'variable_declarator') {
      const nameNode = node.childForFieldName('name');
      if (nameNode && nameNode.type === 'identifier') {
        declarations.set(nameNode.text, nameNode);
      }
    }

    if (cursor.gotoFirstChild()) continue;
    if (cursor.gotoNextSibling()) continue;
    while (true) {
      if (!cursor.gotoParent()) { reachedRoot = true; break; }
      if (cursor.gotoNextSibling()) break;
    }
  }

  return declarations;
}

function collectReferences(rootNode, declarations) {
  const referenced = new Set();
  const cursor = rootNode.walk();
  let reachedRoot = false;

  while (!reachedRoot) {
    const node = cursor.currentNode;

    if (node.type === 'identifier' && declarations.has(node.text)) {
      // 排除声明位置本身
      const declNode = declarations.get(node.text);
      if (node.id !== declNode.id) {
        referenced.add(node.text);
      }
    }

    if (cursor.gotoFirstChild()) continue;
    if (cursor.gotoNextSibling()) continue;
    while (true) {
      if (!cursor.gotoParent()) { reachedRoot = true; break; }
      if (cursor.gotoNextSibling()) break;
    }
  }

  return referenced;
}

function isExported(node) {
  // 检查变量声明是否被导出
  let parent = node.parent;
  while (parent) {
    if (parent.type === 'export_statement' || parent.type === 'export_declaration') {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

export default {
  meta: {
    id: 'no-unused-vars',
    description: '声明了但未使用的变量',
    languages: ['javascript', 'typescript'],
    severity: 'warning',
    fixable: false,
    options: {
      ignorePattern: { type: 'string', default: '^_', description: '匹配此模式的变量名不报告' },
    },
  },

  check(context) {
    const ignorePattern = new RegExp(context.options.ignorePattern || '^_');
    const rootNode = context.ast;

    const declarations = collectDeclarations(rootNode);
    const referenced = collectReferences(rootNode, declarations);

    for (const [name, node] of declarations) {
      if (ignorePattern.test(name)) continue;
      if (referenced.has(name)) continue;
      if (isExported(node)) continue;

      context.report({
        node,
        message: `Variable "${name}" is declared but never used`,
      });
    }
  },
};
