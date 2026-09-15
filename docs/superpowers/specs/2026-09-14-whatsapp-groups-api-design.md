# WhatsApp Groups API Design

## Goal

Expose the WhatsApp groups available to the connected Yumindo warehouse account so staff can select the correct supplier group JID.

## API

`GET /groups` requires the existing Bearer API key.

When the WhatsApp session is connected, it returns an array of group summaries:

- `jid`: WhatsApp group identifier used by document sending.
- `name`: group subject/name.
- `participantCount`: number of group participants.

If WhatsApp is not connected, the endpoint returns a client error with the existing connection-status message.

## Implementation

The Baileys wrapper will expose a group-list function based on `groupFetchAllParticipating()`. The Express route invokes it after API-key authentication. It does not expose message history, participant identities, invite codes, or other group metadata.

## Verification

Run TypeScript production build locally. Commit and push to `master`, which triggers Dokploy automatic deployment. Query `https://wa.yumindo.net/groups` with the configured service key and verify an authenticated JSON group list is returned.
