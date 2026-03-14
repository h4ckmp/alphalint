/**
 * 规则: no-any
 * 检测 TypeScript 代码中 any 类型的使用
 */
export default {
  meta: {
    id: 'no-any',
    description: '避免使用 any 类型',
    languages: ['typescript'],
    severity: 'warning',
    fixable: false,
    options: {
      allowExplicit: { type: 'boolean', default: false, description: '是否允许显式 as any 断言' },
    },
  },

  check(context) {
    const allowExplicit = context.options.allowExplicit;

    // 查找所有 type_identifier 为 "any" 的节点
    context.visit(['predefined_type'], (node) => {
      if (node.text !== 'any') return;

      // 检查是否在 type_assertion (as any) 中
      if (allowExplicit) {
        let parent = node.parent;
        while (parent) {
          if (parent.type === 'as_expression') return;
          parent = parent.parent;
        }
      }

      context.report({
        node,
        message: 'Avoid using "any" type, use a more specific type instead',
      });
    });
  },
};
