# yumindo-wa

Thin Baileys WhatsApp bridge for Yumindo. Sends Order Request PDFs to supplier groups.

## Local

```bash
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:3100 — scan QR with the warehouse WhatsApp number.

## API

All except `/`, `/health` require `Authorization: Bearer $WA_SERVICE_API_KEY`.

- `GET /status` → `{ status, connected }`
- `GET /qr` → `{ qrDataUrl }`
- `POST /send-document` → `{ groupJid, filename, caption?, documentBase64 }`

## Docker / Dokploy

Mount a volume at `/data/auth` (`AUTH_DIR`). Set `WA_SERVICE_API_KEY` and `PORT`.
