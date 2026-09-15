import express from "express";
import {
  getLastError,
  getQrDataUrl,
  getWaStatus,
  isConnected,
  listGroups,
  sendDocument,
  startWhatsApp,
} from "./wa";

const PORT = Number(process.env.PORT || 3100);
const API_KEY = process.env.WA_SERVICE_API_KEY || "";

function extractApiKey(req: express.Request): string {
  const header = req.header("authorization") || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  if (header.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
      // username:password — accept password (or either side) as API key
      const i = decoded.indexOf(":");
      if (i >= 0) {
        const user = decoded.slice(0, i);
        const pass = decoded.slice(i + 1);
        if (pass === API_KEY || user === API_KEY) return API_KEY;
      }
    } catch {
      /* ignore */
    }
  }
  const q = req.query.key;
  if (typeof q === "string" && q.trim()) return q.trim();
  return "";
}

function requireApiKey(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  if (!API_KEY) {
    res.status(500).json({ error: "WA_SERVICE_API_KEY belum di-set" });
    return;
  }
  if (extractApiKey(req) !== API_KEY) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Yumindo WA"');
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

/** Browser admin UI — Basic auth or ?key= */
function requireAdmin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  if (!API_KEY) {
    res.status(500).type("text").send("WA_SERVICE_API_KEY belum di-set");
    return;
  }
  if (extractApiKey(req) !== API_KEY) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Yumindo WA"');
    res
      .status(401)
      .type("html")
      .send(`<!doctype html><html lang="id"><head><meta charset="utf-8"/><title>Unauthorized</title></head>
<body style="font-family:system-ui;max-width:28rem;margin:3rem auto;padding:0 1rem">
  <h1>Unauthorized</h1>
  <p>Halaman pairing WhatsApp dilindungi. Login Basic Auth (password = API key) atau buka dengan <code>?key=…</code>.</p>
</body></html>`);
    return;
  }
  next();
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "25mb" }));

// Public liveness only — no QR / no session details
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/", requireAdmin, (_req, res) => {
  const status = getWaStatus();
  const qr = getQrDataUrl();
  const err = getLastError();
  res.type("html").send(`<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="8" />
  <meta name="robots" content="noindex,nofollow" />
  <title>Yumindo WA</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 420px; margin: 2rem auto; padding: 0 1rem; }
    .status { font-weight: 600; }
    .err { color: #b91c1c; font-size: 0.9rem; }
    img { display: block; margin: 1rem 0; border: 1px solid #ddd; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>Yumindo WhatsApp</h1>
  <p>Status: <span class="status">${status}</span></p>
  ${err ? `<p class="err">${err}</p>` : ""}
  ${
    status === "connected"
      ? "<p>Terhubung. Siap kirim Order Request ke grup supplier.</p>"
      : qr
        ? `<p>Scan QR dengan nomor warehouse:</p><img src="${qr}" alt="QR WhatsApp" width="320" height="320" />`
        : "<p>Menunggu QR / reconnect…</p>"
  }
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

app.get("/groups", requireApiKey, async (_req, res) => {
  try {
    const groups = await listGroups();
    res.json(groups);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal ambil grup";
    const status = /belum terhubung/i.test(message) ? 400 : 500;
    res.status(status).json({ error: message });
  }
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
