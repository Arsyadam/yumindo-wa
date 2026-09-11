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
- `/status`, `/qr`, `/send-document` — Bearer API key
- `/health` — public liveness only (`{ ok: true }`)

## API

`Authorization: Bearer $WA_SERVICE_API_KEY`

- `GET /status` → `{ status, connected }`
- `GET /qr` → `{ qrDataUrl }`
- `POST /send-document` → `{ groupJid, filename, caption?, documentBase64 }`

## Docker / Dokploy

Mount a volume at `/data/auth` (`AUTH_DIR`). Set `WA_SERVICE_API_KEY` and `PORT`.
