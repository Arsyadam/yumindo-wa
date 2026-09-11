import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import fs from "node:fs";
import path from "node:path";
import pino from "pino";
import QRCode from "qrcode";

export type WaStatus = "connected" | "qr_required" | "disconnected";

const logger = pino({ level: process.env.LOG_LEVEL || "info" });

let sock: WASocket | null = null;
let status: WaStatus = "disconnected";
let lastQr: string | null = null;
let lastQrDataUrl: string | null = null;
let starting = false;

function authDir() {
  return process.env.AUTH_DIR || path.join(process.cwd(), "auth");
}

function disconnectCode(error: unknown): number {
  if (
    error &&
    typeof error === "object" &&
    "output" in error &&
    error.output &&
    typeof error.output === "object" &&
    "statusCode" in error.output
  ) {
    return Number((error.output as { statusCode: unknown }).statusCode);
  }
  return DisconnectReason.connectionClosed;
}

export function getWaStatus(): WaStatus {
  return status;
}

export function getQrDataUrl(): string | null {
  return lastQrDataUrl;
}

export function getQrRaw(): string | null {
  return lastQr;
}

export function isConnected() {
  return status === "connected" && !!sock;
}

async function setQr(qr: string) {
  lastQr = qr;
  lastQrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
  status = "qr_required";
}

export async function startWhatsApp(): Promise<void> {
  if (starting || sock) return;
  starting = true;

  try {
    const dir = authDir();
    fs.mkdirSync(dir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(dir);

    sock = makeWASocket({
      auth: state,
      logger: logger.child({ module: "baileys" }),
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      // Keep WA web version reasonably current for QR pairing.
      version: [2, 3000, 1023223821],
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
      void (async () => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          await setQr(qr);
          logger.info("QR ready for pairing");
        }

        if (connection === "open") {
          status = "connected";
          lastQr = null;
          lastQrDataUrl = null;
          logger.info("WhatsApp connected");
        }

        if (connection === "close") {
          status = "disconnected";
          const code = disconnectCode(lastDisconnect?.error);
          // 401/403/405 often mean protocol/version mismatch — back off harder
          const hardFail = code === 401 || code === 403 || code === 405;
          const shouldReconnect = code !== DisconnectReason.loggedOut;
          logger.warn({ code, shouldReconnect, hardFail }, "WhatsApp connection closed");

          sock = null;
          starting = false;

          if (shouldReconnect) {
            setTimeout(
              () => {
                void startWhatsApp();
              },
              hardFail ? 15_000 : 2_000,
            );
          } else {
            status = "qr_required";
            logger.error("Logged out — delete AUTH_DIR and rescan QR");
          }
        }
      })();
    });
  } catch (error) {
    starting = false;
    sock = null;
    status = "disconnected";
    throw error;
  } finally {
    starting = false;
  }
}

export async function sendDocument(params: {
  groupJid: string;
  filename: string;
  caption?: string;
  documentBase64: string;
}) {
  if (!isConnected() || !sock) {
    throw new Error("WhatsApp belum terhubung. Scan QR di / lalu coba lagi.");
  }

  const jid = params.groupJid.trim();
  if (!jid.endsWith("@g.us")) {
    throw new Error("groupJid harus berakhiran @g.us");
  }

  const buffer = Buffer.from(params.documentBase64, "base64");
  if (!buffer.length) {
    throw new Error("documentBase64 kosong");
  }

  const filename =
    params.filename.replace(/[^\w.\-()+ ]+/g, "_") || "document.pdf";

  await sock.sendMessage(jid, {
    document: buffer,
    mimetype: "application/pdf",
    fileName: filename.endsWith(".pdf") ? filename : `${filename}.pdf`,
    caption: params.caption || undefined,
  });
}
