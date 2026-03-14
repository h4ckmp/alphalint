/**
 * 规则注册表 - 管理内置和自定义规则
 */
export class RuleRegistry {
  #rules = new Map();

  /**
   * 注册一条规则
   */
  register(rule, source = 'builtin') {
    if (!rule.meta?.id) throw new Error('Rule must have meta.id');
    this.#rules.set(rule.meta.id, { ...rule, source });
  }

  /**
   * 获取指定语言的所有适用规则
   */
  getRulesForLang(lang) {
    return [...this.#rules.values()].filter(rule => {
      const langs = rule.meta.languages;
      return langs === '*' || (Array.isArray(langs) && langs.includes(lang));
    });
  }

  /**
   * 获取单条规则
   */
  getRule(id) {
    return this.#rules.get(id) || null;
  }

  /**
   * 列出所有规则
   */
  listAll() {
    return [...this.#rules.values()].map(r => ({
      id: r.meta.id,
      description: r.meta.description,
      languages: r.meta.languages,
      severity: r.meta.severity,
      source: r.source,
    }));
  }

  get size() {
    return this.#rules.size;
  }
}
