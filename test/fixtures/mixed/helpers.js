/**
 * Mixed helpers — some clean, some with issues
 */

// Clean
function identity(x) {
  return x;
}

// Clean
function pipe(...fns) {
  return (x) => fns.reduce((v, f) => f(v), x);
}

// Problematic: unused variable
const DEFAULT_TIMEOUT = 3000;

// Problematic: console
function logWarning(msg) {
  console.warn('[WARN]', msg);
}

// Clean
function range(start, end) {
  const result = [];
  for (let i = start; i < end; i++) {
    result.push(i);
  }
  return result;
}

export { identity, pipe, logWarning, range };
