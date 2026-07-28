# DropCode

A small browser-based file-sharing app. Upload a file, share the generated code or link, and download it on another device—no installation for recipients.

## Run

Requires Node.js 18 or later. No `npm install` is needed.

```bash
npm start
```

Open `http://localhost:3000`. To receive files from another device on the same Wi-Fi network, use the computer's local IP address instead of `localhost` (for example, `http://192.168.1.20:3000`). Keep the server running while transfers are active.

## Verify

```bash
npm test
```

This performs an upload, code lookup, download, and invalid-code check. Files expire automatically after 24 hours; the configured maximum upload size is 500 MB.

## Deploy to Render

1. Push this folder to a GitHub repository.
2. In Render, choose **New +** → **Blueprint** and select that repository.
3. Render reads `render.yaml`; approve the proposed `dropcode` service and deploy it.

The default Render disk is temporary, so uploads are removed whenever the service restarts (and automatically after 24 hours). Use persistent storage for a production deployment that needs stronger retention.
