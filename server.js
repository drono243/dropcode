const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '127.0.0.1';
// Windows' temp folder is writable when the app folder is protected by the OS.
// Each transfer gets a random filename and is deleted automatically after 24 hours.
const uploadDir = os.tmpdir();
const transfers = new Map();
const MAX_FILE_SIZE = 500 * 1024 * 1024;

function createCode() {
  let code;
  do {
    code = crypto.randomBytes(4).toString('hex').toUpperCase().match(/.{1,4}/g).join('-');
  } while (transfers.has(code));
  return code;
}

function cleanExpiredTransfers() {
  const now = Date.now();
  for (const [code, transfer] of transfers) {
    if (transfer.expiresAt < now) {
      fs.unlink(transfer.path, () => {});
      transfers.delete(code);
    }
  }
}
setInterval(cleanExpiredTransfers, 60 * 60 * 1000).unref();

function json(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); }
function parseUpload(req, callback) {
  const boundaryMatch = (req.headers['content-type'] || '').match(/boundary=(.+)$/);
  if (!boundaryMatch) return callback(new Error('Upload must be multipart form data.'));
  const chunks = []; let total = 0;
  req.on('data', chunk => { total += chunk.length; if (total > MAX_FILE_SIZE + 1024 * 1024) { req.destroy(); callback(new Error('File is too large. The limit is 500 MB.')); } else chunks.push(chunk); });
  req.on('end', () => {
    const boundary = Buffer.from(`--${boundaryMatch[1]}`); const body = Buffer.concat(chunks); const start = body.indexOf(boundary);
    const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), start); const end = body.indexOf(boundary, headerEnd);
    if (start < 0 || headerEnd < 0 || end < 0) return callback(new Error('Could not read the uploaded file.'));
    const header = body.subarray(start, headerEnd).toString(); const filenameMatch = header.match(/filename="([^\"]*)"/);
    if (!filenameMatch || !filenameMatch[1]) return callback(new Error('Choose a file first.'));
    const contentTypeMatch = header.match(/Content-Type:\s*([^\r\n]+)/i);
    callback(null, { name: path.basename(filenameMatch[1]), data: body.subarray(headerEnd + 4, end - 2), mimeType: contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream' });
  });
}
function uploadTransfer(req, res) {
  parseUpload(req, (error, file) => {
    if (error) return json(res, error.message.includes('large') ? 413 : 400, { error: error.message });
  cleanExpiredTransfers();
  const code = createCode();
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  const filePath = path.join(uploadDir, `${crypto.randomUUID()}${path.extname(file.name)}`);
  try {
    fs.writeFileSync(filePath, file.data);
  } catch (writeError) {
    console.error('Could not store uploaded file:', writeError.message);
    return json(res, 500, { error: 'Could not save the file. Please try again.' });
  }
  transfers.set(code, {
    path: filePath, originalName: file.name, size: file.data.length, mimeType: file.mimeType,
    expiresAt
  });
  const base = `http://${req.headers.host}`;
  json(res, 201, { code, link: `${base}/download/${encodeURIComponent(code)}`, expiresAt });
  });
}

function getTransfer(code, res) {
  code = String(code || '').toUpperCase();
  const transfer = transfers.get(code);
  if (!transfer || transfer.expiresAt < Date.now()) {
    if (transfer) { fs.unlink(transfer.path, () => {}); transfers.delete(code); }
    json(res, 404, { error: 'This transfer code is invalid or has expired.' });
    return null;
  }
  return transfer;
}

function serveStatic(res, pathname) {
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = path.join(__dirname, 'public', file);
  if (!filePath.startsWith(path.join(__dirname, 'public')) || !fs.existsSync(filePath)) return false;
  const type = file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html';
  res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` }); fs.createReadStream(filePath).pipe(res); return true;
}
const app = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`); const info = url.pathname.match(/^\/api\/transfers\/([^/]+)$/); const download = url.pathname.match(/^\/download\/([^/]+)$/);
  if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { status: 'ok' });
  if (req.method === 'POST' && url.pathname === '/api/transfers') return uploadTransfer(req, res);
  if (req.method === 'GET' && info) { const transfer = getTransfer(info[1], res); if (transfer) json(res, 200, { name: transfer.originalName, size: transfer.size, mimeType: transfer.mimeType, expiresAt: transfer.expiresAt, downloadUrl: `/download/${encodeURIComponent(info[1].toUpperCase())}` }); return; }
  if (req.method === 'GET' && download) { const transfer = getTransfer(download[1], res); if (transfer) { res.writeHead(200, { 'Content-Type': transfer.mimeType, 'Content-Disposition': `attachment; filename="${encodeURIComponent(transfer.originalName)}"` }); fs.createReadStream(transfer.path).pipe(res); } return; }
  if (req.method === 'GET' && serveStatic(res, url.pathname)) return;
  json(res, 404, { error: 'Not found.' });
});
if (require.main === module) {
  app.once('error', error => {
    console.error(`Could not start DropCode: ${error.message}`);
    process.exitCode = 1;
  });
  app.listen(port, host, () => console.log(`DropCode running at http://${host}:${port}`));
}
module.exports = { app, transfers };
