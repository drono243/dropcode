const $ = (s) => document.querySelector(s);
const formatBytes = (bytes) => bytes < 1024 ? `${bytes} B` : `${(bytes / 1024 / 1024).toFixed(bytes > 10 * 1024 * 1024 ? 0 : 1)} MB`;
const status = $('#status');
let receivedFile = null, previewUrl = null;
function setStatus(message, type = '') { status.textContent = message; status.className = `status ${type}`; }

document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
  document.querySelectorAll('.tab, .panel').forEach(el => { el.classList.remove('active'); if (el.classList.contains('tab')) el.setAttribute('aria-selected', 'false'); });
  tab.classList.add('active'); tab.setAttribute('aria-selected', 'true'); $(`#${tab.dataset.panel}`).classList.add('active'); setStatus('');
}));
const fileInput = $('#fileInput');
fileInput.addEventListener('change', () => { $('#fileName').textContent = fileInput.files[0] ? `${fileInput.files[0].name} · ${formatBytes(fileInput.files[0].size)}` : ''; });
const dropZone = $('#dropZone');
['dragenter', 'dragover'].forEach(event => dropZone.addEventListener(event, e => { e.preventDefault(); dropZone.classList.add('dragging'); }));
['dragleave', 'drop'].forEach(event => dropZone.addEventListener(event, e => { e.preventDefault(); dropZone.classList.remove('dragging'); }));
dropZone.addEventListener('drop', e => { fileInput.files = e.dataTransfer.files; fileInput.dispatchEvent(new Event('change')); });

$('#uploadForm').addEventListener('submit', async e => {
  e.preventDefault(); const file = fileInput.files[0]; if (!file) return setStatus('Choose a file to continue.', 'error');
  const button = $('#sendButton'); button.disabled = true; button.innerHTML = 'Uploading…'; setStatus('');
  try { const response = await fetch('/api/transfers', { method: 'POST', body: new FormData(e.target) }); const data = await response.json(); if (!response.ok) throw new Error(data.error);
    $('#generatedCode').textContent = data.code; $('#generatedLink').href = data.link; $('#generatedLink').textContent = data.link; $('#sendResult').classList.remove('hidden'); setStatus('Your transfer is ready.', 'success');
  } catch (error) { setStatus(error.message || 'Upload failed.', 'error'); } finally { button.disabled = false; button.innerHTML = 'Generate transfer code <span>↗</span>'; }
});
$('#copyCode').addEventListener('click', async () => { await navigator.clipboard.writeText($('#generatedCode').textContent); $('#copyCode').textContent = 'Copied'; setTimeout(() => $('#copyCode').textContent = 'Copy', 1500); });
$('#receiveCode').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-F0-9]/g, '').replace(/(.{4})(?=.)/g, '$1-').slice(0, 9); });
$('#receiveForm').addEventListener('submit', async e => { e.preventDefault(); const code = $('#receiveCode').value; if (code.length !== 9) return setStatus('Enter the full 8-character transfer code.', 'error');
  setStatus('Looking for your file…'); try { const response = await fetch(`/api/transfers/${code}`); const data = await response.json(); if (!response.ok) throw new Error(data.error);
    $('#receivedName').textContent = data.name; $('#receivedSize').textContent = formatBytes(data.size); $('#downloadLink').href = data.downloadUrl; receivedFile = data; $('#receivedResult').classList.remove('hidden'); $('#preview').classList.add('hidden'); setStatus('File found.', 'success');
  } catch (error) { $('#receivedResult').classList.add('hidden'); $('#preview').classList.add('hidden'); setStatus(error.message || 'Could not find that file.', 'error'); }
});
$('#previewButton').addEventListener('click', async () => {
  if (!receivedFile) return;
  const container = $('#previewContent'); $('#preview').classList.remove('hidden'); container.innerHTML = '<p class="preview-loading">Loading preview…</p>';
  try {
    const response = await fetch(receivedFile.downloadUrl); if (!response.ok) throw new Error('Preview could not be loaded.');
    const blob = await response.blob(); if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = URL.createObjectURL(blob);
    const type = receivedFile.mimeType || blob.type;
    if (type.startsWith('image/')) container.innerHTML = `<img src="${previewUrl}" alt="Preview of ${receivedFile.name}">`;
    else if (type === 'application/pdf') container.innerHTML = `<iframe src="${previewUrl}" title="Preview of ${receivedFile.name}"></iframe>`;
    else if (type.startsWith('video/')) container.innerHTML = `<video controls src="${previewUrl}"></video>`;
    else if (type.startsWith('audio/')) container.innerHTML = `<audio controls src="${previewUrl}"></audio>`;
    else if (type.startsWith('text/') || /json|javascript|xml/.test(type)) { const text = await blob.text(); container.innerHTML = '<pre></pre>'; container.querySelector('pre').textContent = text.slice(0, 100000); }
    else container.innerHTML = '<p class="preview-loading">This file type cannot be previewed in the browser. Use Download to open it.</p>';
  } catch (error) { container.innerHTML = `<p class="preview-loading">${error.message}</p>`; }
});
$('#closePreview').addEventListener('click', () => { $('#preview').classList.add('hidden'); });
