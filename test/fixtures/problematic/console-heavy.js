/**
 * Console-heavy code — should trigger no-console
 */

function logEverything(data) {
  console.log('start');
  console.debug('data:', data);
  console.warn('be careful');
  console.error('something went wrong');
  console.info('info message');
  return data;
}

function debugHelper(obj) {
  console.log(JSON.stringify(obj, null, 2));
  console.trace('stack trace');
  return obj;
}

export { logEverything, debugHelper };
