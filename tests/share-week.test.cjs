const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html', 'utf8');
const source = html.match(/const wrap=(.*);\n  x.shadowColor/)[1];
const x = { font: '', measureText(text) { return { width: text.length * Number(this.font.match(/(\d+)px/)[1]) }; } };
const wrap = new Function('x', 'return (' + source + ')')(x);
test('long split headline always returns a fallback at the minimum size', () => {
  const result = wrap(('WWWWWW ').repeat(10).trim(), 440, 'sans-serif', 72, 2);
  assert.equal(result.s, 44);
  assert.equal(result.lines.length, 2);
});
test('all starting sizes terminate and respect the line limit', () => {
  for (const size of [72, 88, 104]) {
    const result = wrap(('Wide headline ').repeat(30), 400, 'sans-serif', size, 3);
    assert.equal(result.s, 44);
    assert.equal(result.lines.length, 3);
  }
});
test('short headline keeps original size', () => {
  assert.deepEqual(wrap('Win', 440, 'sans-serif', 72, 2), { lines: ['Win'], s: 72 });
});
