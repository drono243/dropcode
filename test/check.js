const assert = require('node:assert/strict');
const { app } = require('../server');

(async () => {
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const stylesheet = await fetch(`${base}/layout-fix.css`, { signal: AbortSignal.timeout(5000) });
  assert.equal(stylesheet.status, 200);
  assert.match(stylesheet.headers.get('content-type'), /text\/css/);
  const form = new FormData();
  form.append('file', new Blob(['hello DropCode'], { type: 'text/plain' }), 'hello.txt');
  const upload = await fetch(`${base}/api/transfers`, { method: 'POST', body: form, signal: AbortSignal.timeout(5000) });
  assert.equal(upload.status, 201);
  const created = await upload.json();
  const info = await fetch(`${base}/api/transfers/${created.code}`, { signal: AbortSignal.timeout(5000) });
  assert.equal(info.status, 200);
  assert.equal((await info.clone().json()).mimeType, 'text/plain');
  const download = await fetch(`${base}/download/${created.code}`, { signal: AbortSignal.timeout(5000) });
  assert.equal(await download.text(), 'hello DropCode');
  const unknown = await fetch(`${base}/api/transfers/NOPE-0000`, { signal: AbortSignal.timeout(5000) });
  assert.equal(unknown.status, 404);
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  console.log('PASS: upload, transfer-code lookup, download, and invalid-code handling');
})().catch(error => { console.error(error); process.exit(1); });
