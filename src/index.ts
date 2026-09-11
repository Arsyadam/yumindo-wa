import express from "express";
import {
  getQrDataUrl,
  getWaStatus,
  isConnected,
  sendDocument,
  startWhatsApp,
} from "./wa";

const PORT = Number(process.env.PORT || 3100);
const API_KEY = process.env.WA_SERVICE_API_KEY || "";

function requireApiKey(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  if (!API_KEY) {
    res.status(500).json({ error: "WA_SERVICE_API_KEY belum di-set" });
    return;
  }
  const header = req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (token !== API_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

const app = express();
app.use(express.json({ limit: "25mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, status: getWaStatus() });
});

app.get("/", (_req, res) => {
  const status = getWaStatus();
  const qr = getQrDataUrl();
  res.type("html").send(`<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="8" />
  <title>Yumindo WA</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 420px; margin: 2rem auto; padding: 0 1rem; }
    .status { font-weight: 600; }
    img { display: block; margin: 1rem 0; border: 1px solid #ddd; border-radius: 8px; }
    code { background: #f4f4f4; padding: 0.1rem 0.3rem; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Yumindo WhatsApp</h1>
  <p>Status: <span class="status">${status}</span></p>
  ${
    status === "connected"
      ? "<p>Terhubung. Siap kirim Order Request ke grup supplier.</p>"
      : qr
        ? `<p>Scan QR dengan nomor warehouse:</p><img src="${qr}" alt="QR WhatsApp" width="320" height="320" />`
        : "<p>Menunggu QR / reconnect…</p>"
  }
  <p><small>API: <code>/status</code> <code>/qr</code> <code>/send-document</code> (Bearer API key)</small></p>
</body>
</html>`);
});

app.get("/status", requireApiKey, (_req, res) => {
  res.json({
    status: getWaStatus(),
    connected: isConnected(),
  });
});

app.get("/qr", requireApiKey, (_req, res) => {
  const dataUrl = getQrDataUrl();
  if (!dataUrl) {
    res.status(404).json({
      error: "QR tidak tersedia",
      status: getWaStatus(),
    });
    return;
  }
  res.json({ status: getWaStatus(), qrDataUrl: dataUrl });
});

app.post("/send-document", requireApiKey, async (req, res) => {
  try {
    const { groupJid, filename, caption, documentBase64 } = req.body ?? {};
    if (
      typeof groupJid !== "string" ||
      typeof filename !== "string" ||
      typeof documentBase64 !== "string"
    ) {
      res.status(400).json({
        error: "groupJid, filename, documentBase64 wajib (string)",
      });
      return;
    }
    await sendDocument({
      groupJid,
      filename,
      caption: typeof caption === "string" ? caption : undefined,
      documentBase64,
    });
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal kirim";
    const status = /belum terhubung|groupJid|documentBase64/i.test(message)
      ? 400
      : 500;
    res.status(status).json({ error: message });
  }
});

async function main() {
  if (!API_KEY) {
    console.warn("[yumindo-wa] WA_SERVICE_API_KEY kosong — set sebelum production");
  }
  await startWhatsApp();
  app.listen(PORT, () => {
    console.log(`[yumindo-wa] listening on :${PORT}`);
  });
}

void main();
