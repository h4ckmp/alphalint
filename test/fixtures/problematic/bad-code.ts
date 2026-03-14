/**
 * Problematic code — should trigger multiple lint rules
 */

// no-any: using 'any' type
function processData(data: any): any {
  // no-console
  console.log('Processing:', data);

  // max-nesting-depth > 4
  if (data) {
    if (data.items) {
      for (const item of data.items) {
        if (item.active) {
          if (item.value > 0) {
            console.warn('deep nesting here');
          }
        }
      }
    }
  }

  return data;
}

// no-unused-vars
const unusedConfig = { timeout: 5000 };
const unusedHelper = (x: number) => x * 2;

// max-function-length > 50 lines
function veryLongFunction(input: any): string {
  let result = '';
  result += 'line 1';
  result += 'line 2';
  result += 'line 3';
  result += 'line 4';
  result += 'line 5';
  result += 'line 6';
  result += 'line 7';
  result += 'line 8';
  result += 'line 9';
  result += 'line 10';
  result += 'line 11';
  result += 'line 12';
  result += 'line 13';
  result += 'line 14';
  result += 'line 15';
  result += 'line 16';
  result += 'line 17';
  result += 'line 18';
  result += 'line 19';
  result += 'line 20';
  result += 'line 21';
  result += 'line 22';
  result += 'line 23';
  result += 'line 24';
  result += 'line 25';
  result += 'line 26';
  result += 'line 27';
  result += 'line 28';
  result += 'line 29';
  result += 'line 30';
  result += 'line 31';
  result += 'line 32';
  result += 'line 33';
  result += 'line 34';
  result += 'line 35';
  result += 'line 36';
  result += 'line 37';
  result += 'line 38';
  result += 'line 39';
  result += 'line 40';
  result += 'line 41';
  result += 'line 42';
  result += 'line 43';
  result += 'line 44';
  result += 'line 45';
  result += 'line 46';
  result += 'line 47';
  result += 'line 48';
  result += 'line 49';
  result += 'line 50';
  result += 'line 51';
  console.log(result);
  return result;
}

export { processData, veryLongFunction };
