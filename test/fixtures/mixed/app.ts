/**
 * Mixed code — some clean, some problematic
 */

// Clean function
function validateEmail(email: string): boolean {
  return email.includes('@') && email.includes('.');
}

// Problematic: uses 'any'
function parseConfig(raw: any): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    result[key] = String(value);
  }
  return result;
}

// Clean function
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

// Problematic: console.log
function debug(label: string, value: unknown): void {
  console.log(`[${label}]`, value);
}

// Clean function
function sum(numbers: number[]): number {
  return numbers.reduce((a, b) => a + b, 0);
}

export { validateEmail, parseConfig, slugify, debug, sum };
