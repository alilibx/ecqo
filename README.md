# Ecqo Landing + WhatsApp Assistant Backend

This project now includes:

- A conversion-focused SaaS landing page for **Ecqo** (high-net-worth ICP).
- A WhatsApp-only backend ingestion flow using **Meta Cloud API webhooks** (no Twilio).

## Run

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## Landing Page

Files:

- `public/index.html`
- `public/styles.css`
- `public/app.js`

Included:

- SEO metadata (title, description, canonical, Open Graph, Twitter tags).
- Structured data (`Organization`, `SoftwareApplication`).
- Pricing table and main CTA: **Replace Your EA/VA**.
- Global cost comparison section with US + SEA + remote marketplace benchmarks.
- Viral/referral section with copy-link + WhatsApp share action.

## WhatsApp Meta Cloud Webhook

### Verification endpoint

`GET /webhooks/meta/whatsapp`

Set `META_WEBHOOK_VERIFY_TOKEN` and use the same token in Meta webhook config.

### Message ingestion endpoint

`POST /webhooks/meta/whatsapp`

Expects Meta Cloud webhook payload format (`object=whatsapp_business_account`).
Text messages are parsed into scheduling proposals.

## Internal APIs

- `POST /api/messages` (for local testing; WhatsApp channel only)
- `GET /api/proposals`
- `POST /api/proposals/:id/respond`
- `GET /api/proposals/:id.ics`

## Notes

- Storage is in-memory for MVP.
- NLP extraction is currently rule-based.
- Add signature validation and persistent storage before production.
