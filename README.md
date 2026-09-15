# yumindo-wa

Thin Baileys WhatsApp bridge for Yumindo. Sends Order Request PDFs to supplier groups.

## Local

```bash
cp .env.example .env
npm install
npm run dev
```

Admin UI: `http://localhost:3100/?key=$WA_SERVICE_API_KEY` (or HTTP Basic Auth; password = API key).

## Security

- `/` (QR pairing) — **requires** API key (Basic Auth or `?key=`)
- `/status`, `/qr`, `/groups`, `/send-document` — Bearer API key
- `/health` — public liveness only (`{ ok: true }`)

## API

`Authorization: Bearer $WA_SERVICE_API_KEY`

- `GET /status` → `{ status, connected }`
- `GET /qr` → `{ qrDataUrl }`
- `GET /groups` → `[{ jid, name, participantCount }]`
- `POST /send-document` → `{ groupJid, filename, caption?, documentBase64 }`
  - Sends are serialized (one at a time).
  - Before each send: `composing` → random 1.5–4s delay → `paused`, then a short cooldown after send.
  - This reduces ban risk; it does **not** guarantee WhatsApp will never ban the number.

## Docker / Dokploy

Mount a **persistent volume** at `/data/auth` (`AUTH_DIR`). Without it, every redeploy wipes the WhatsApp session and requires a new QR scan.

Dokploy production uses named volume `yumindo-wa-auth` → `/data/auth`.

Set `WA_SERVICE_API_KEY` and `PORT`.
