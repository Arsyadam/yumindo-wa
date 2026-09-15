# WhatsApp send anti-ban mitigations

## Goal

Reduce ban risk when sending Order Request PDFs, then point every supplier at the shared test group JID.

## Non-guarantee

WhatsApp can still ban accounts. This only adds human-like send pacing.

## Send path (`sendDocument`)

1. Serialize sends through one in-process queue.
2. Before each send: `composing` → random delay 1500–4000ms → `paused`.
3. Send the PDF document.
4. Random cooldown 800–2000ms before releasing the queue.
5. Keep `markOnlineOnConnect: false`.

## Suppliers

Update all on-prem `suppliers.whatsapp_group_jid` to `120363430154184975@g.us`.

## Verification

Deploy `yumindo-wa`, then send exactly one test PDF to that group.
