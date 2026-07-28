const test = require('node:test');
const assert = require('node:assert/strict');
const { app, transfers } = require('../server');

let server, base;
test.before(async () => { server = app.listen(0); await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`; });
test.after(async () => {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
});

test('upload, look up with code, and download a file', async () => {
  const form = new FormData(); form.append('file', new Blob(['hello DropCode'], { type: 'text/plain' }), 'hello.txt');
  const upload = await fetch(`${base}/api/transfers`, { method: 'POST', body: form });
  assert.equal(upload.status, 201); const created = await upload.json(); assert.match(created.code, /^[A-F0-9]{4}-[A-F0-9]{4}$/);
  const info = await fetch(`${base}/api/transfers/${created.code}`); assert.equal(info.status, 200); assert.equal((await info.json()).name, 'hello.txt');
  const download = await fetch(`${base}/download/${created.code}`); assert.equal(download.status, 200); assert.equal(await download.text(), 'hello DropCode');
});
test('rejects unknown code', async () => { const response = await fetch(`${base}/api/transfers/NOPE-0000`); assert.equal(response.status, 404); });
