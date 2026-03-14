/**
 * 规则: no-console
 * 检测 console.log/warn/error/debug/info 调用残留
 */
export default {
  meta: {
    id: 'no-console',
    description: '生产代码中不应有 console 调用',
    languages: ['javascript', 'typescript'],
    severity: 'warning',
    fixable: false,
    options: {
      allow: { type: 'array', default: [], description: '允许的 console 方法名' },
    },
  },

  check(context) {
    const allow = new Set(context.options.allow || []);

    context.visit(['call_expression'], (node) => {
      const fn = node.childForFieldName('function');
      if (!fn || fn.type !== 'member_expression') return;

      const obj = fn.childForFieldName('object');
      const prop = fn.childForFieldName('property');
      if (!obj || !prop) return;

      if (obj.type === 'identifier' && obj.text === 'console') {
        const method = prop.text;
        if (!allow.has(method)) {
          context.report({
            node,
            message: `Unexpected console.${method} in production code`,
          });
        }
      }
    });
  },
};
