const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");
const querystring = require("node:querystring");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(process.cwd(), "public");
const META_WEBHOOK_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || "ecqo-verify-token";

const state = {
  conversations: new Map(),
  proposals: new Map(),
  messageSeq: 1,
  proposalSeq: 1
};

const INTENT_PATTERN = /\b(meet|meeting|sync|call|coffee|lunch|dinner|appointment|catch\s?up|hang\s?out|connect|schedule|book)\b/i;
const AFFIRMATION_PATTERN = /\b(works|sounds good|perfect|great|see you|confirmed|done|let's do it|ok|okay)\b/i;

const WEEKDAY_INDEX = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendText(res, statusCode, text, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, { "Content-Type": contentType });
  res.end(text);
}

function notFound(res) {
  sendJson(res, 404, { error: "Not found" });
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function parseBody(req, rawBody) {
  const contentType = (req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  if (!rawBody) {
    return {};
  }

  if (contentType === "application/json") {
    return JSON.parse(rawBody);
  }

  if (contentType === "application/x-www-form-urlencoded") {
    return querystring.parse(rawBody);
  }

  return { rawBody };
}

function sanitizeText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function normalizeParticipant(id, fallbackName, options = {}) {
  const allowGenerated = options.allowGenerated !== false;
  const rawId = sanitizeText(id);
  const safeId = rawId || (allowGenerated ? `participant-${Math.random().toString(16).slice(2, 8)}` : "");
  const safeName = sanitizeText(fallbackName) || safeId;
  return { id: safeId, name: safeName };
}

function normalizeDirectConversationId(channel, senderId, recipientId) {
  const ids = [sanitizeText(senderId), sanitizeText(recipientId)].filter(Boolean).sort();
  if (ids.length < 2) {
    return `${channel}:${ids[0] || "unknown"}`;
  }
  return `${channel}:${ids[0]}__${ids[1]}`;
}

function getOrCreateConversation(id, channel) {
  const existing = state.conversations.get(id);
  if (existing) {
    return existing;
  }

  const fresh = {
    id,
    channel,
    participants: new Map(),
    messages: [],
    proposalIds: []
  };

  state.conversations.set(id, fresh);
  return fresh;
}

function addParticipant(conversation, participant) {
  if (!participant.id) {
    return;
  }
  if (!conversation.participants.has(participant.id)) {
    conversation.participants.set(participant.id, { id: participant.id, name: participant.name });
    return;
  }

  const existing = conversation.participants.get(participant.id);
  if (!existing.name && participant.name) {
    existing.name = participant.name;
  }
}

function parseMessagePayload(payload) {
  const requestedChannel = sanitizeText(payload.channel || "whatsapp").toLowerCase();
  const channel = requestedChannel || "whatsapp";
  if (channel !== "whatsapp") {
    return { error: "Only WhatsApp is supported in this build." };
  }
  const sender = normalizeParticipant(
    payload.senderId || payload.from || payload.From,
    payload.senderName || payload.profileName || payload.ProfileName,
    { allowGenerated: false }
  );
  const recipient = normalizeParticipant(
    payload.recipientId || payload.to || payload.To,
    payload.recipientName || payload.toName || payload.To,
    { allowGenerated: false }
  );
  const text = sanitizeText(payload.text || payload.body || payload.Body);

  if (!sender.id || !text) {
    return { error: "senderId/from and text/body are required." };
  }

  const conversationId = sanitizeText(payload.conversationId) || normalizeDirectConversationId(channel, sender.id, recipient.id);
  const timestamp = payload.timestamp ? new Date(payload.timestamp) : new Date();

  if (Number.isNaN(timestamp.getTime())) {
    return { error: "Invalid timestamp." };
  }

  return {
    message: {
      id: `msg_${state.messageSeq++}`,
      channel,
      conversationId,
      text,
      senderId: sender.id,
      senderName: sender.name,
      recipientId: recipient.id,
      recipientName: recipient.name,
      timestamp: timestamp.toISOString()
    }
  };
}

function extractTimeParts(text) {
  const explicit = text.match(/\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/i);
  if (explicit) {
    let hour = Number(explicit[1]) % 12;
    const meridiem = explicit[3].toLowerCase();
    if (meridiem === "pm") {
      hour += 12;
    }
    return { hour, minute: Number(explicit[2] || 0) };
  }

  const twentyFour = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (twentyFour) {
    return { hour: Number(twentyFour[1]), minute: Number(twentyFour[2]) };
  }

  const atNumber = text.match(/\bat\s+(\d{1,2})(?::([0-5]\d))?\b/i);
  if (atNumber) {
    const rawHour = Number(atNumber[1]);
    let hour = rawHour;
    if (/\b(evening|tonight|night|dinner)\b/i.test(text) && rawHour < 12) {
      hour += 12;
    }
    if (/\b(morning|breakfast)\b/i.test(text) && rawHour === 12) {
      hour = 0;
    }
    return { hour: hour % 24, minute: Number(atNumber[2] || 0) };
  }

  if (/\bnoon\b/i.test(text)) {
    return { hour: 12, minute: 0 };
  }

  if (/\bmidnight\b/i.test(text)) {
    return { hour: 0, minute: 0 };
  }

  if (/\bmorning\b/i.test(text)) {
    return { hour: 9, minute: 0 };
  }

  if (/\bafternoon\b/i.test(text)) {
    return { hour: 15, minute: 0 };
  }

  if (/\bevening|tonight\b/i.test(text)) {
    return { hour: 19, minute: 0 };
  }

  return { hour: 10, minute: 0 };
}

function nextWeekdayDate(reference, weekdayName) {
  const target = WEEKDAY_INDEX[weekdayName.toLowerCase()];
  if (target === undefined) {
    return null;
  }

  const date = new Date(reference);
  const current = date.getDay();
  let delta = target - current;
  if (delta <= 0) {
    delta += 7;
  }
  date.setDate(date.getDate() + delta);
  return date;
}

function parseDateTime(text, reference = new Date()) {
  const cleaned = text.toLowerCase();
  const time = extractTimeParts(cleaned);

  const isoMatch = cleaned.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const date = new Date(reference);
    date.setFullYear(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    date.setHours(time.hour, time.minute, 0, 0);
    return date;
  }

  if (/\bday after tomorrow\b/.test(cleaned)) {
    const date = new Date(reference);
    date.setDate(date.getDate() + 2);
    date.setHours(time.hour, time.minute, 0, 0);
    return date;
  }

  if (/\btomorrow\b/.test(cleaned)) {
    const date = new Date(reference);
    date.setDate(date.getDate() + 1);
    date.setHours(time.hour, time.minute, 0, 0);
    return date;
  }

  if (/\btoday\b/.test(cleaned) || /\btonight\b/.test(cleaned)) {
    const date = new Date(reference);
    date.setHours(time.hour, time.minute, 0, 0);
    if (date <= reference) {
      date.setDate(date.getDate() + 1);
    }
    return date;
  }

  const weekdayMatch = cleaned.match(/\b(next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (weekdayMatch) {
    const weekdayDate = nextWeekdayDate(reference, weekdayMatch[2]);
    if (weekdayDate) {
      weekdayDate.setHours(time.hour, time.minute, 0, 0);
      return weekdayDate;
    }
  }

  if (/\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/.test(cleaned) || /\bat\s+\d{1,2}\b/.test(cleaned)) {
    const date = new Date(reference);
    date.setHours(time.hour, time.minute, 0, 0);
    if (date <= reference) {
      date.setDate(date.getDate() + 1);
    }
    return date;
  }

  return null;
}

function parseDurationMinutes(text) {
  const durationMatch = text.match(/\bfor\s+(\d+)\s*(minutes|mins|min|hours|hrs|hr|h)\b/i);
  if (!durationMatch) {
    return 60;
  }

  const value = Number(durationMatch[1]);
  const unit = durationMatch[2].toLowerCase();
  if (unit.startsWith("h")) {
    return value * 60;
  }
  return value;
}

function parseLocation(text) {
  const inMatch = text.match(
    /\bin\s+([a-z][a-z0-9 '&-]{2,80}?)(?=\s+for\s+\d+\s*(?:minutes|mins|min|hours|hrs|hr|h)\b|[,.!?]|$)/i
  );
  if (inMatch) {
    return inMatch[1].trim();
  }

  const atMatch = text.match(
    /\bat\s+([a-z][a-z0-9 '&-]{2,80}?)(?=\s+for\s+\d+\s*(?:minutes|mins|min|hours|hrs|hr|h)\b|[,.!?]|$)/i
  );
  if (atMatch) {
    return atMatch[1].trim();
  }

  return "";
}

function buildProposalTitle(conversation, message) {
  const people = Array.from(conversation.participants.values())
    .slice(0, 2)
    .map((participant) => participant.name)
    .filter(Boolean);

  if (people.length >= 2) {
    return `Meeting: ${people[0]} + ${people[1]}`;
  }

  return `Meeting from ${message.senderName || message.senderId}`;
}

function hasNearbyDuplicate(conversationId, startAt) {
  const proposedAt = new Date(startAt).getTime();
  const tenMinutes = 10 * 60 * 1000;

  for (const proposal of state.proposals.values()) {
    if (proposal.conversationId !== conversationId) {
      continue;
    }
    if (proposal.status === "rejected") {
      continue;
    }

    const existingStart = new Date(proposal.startAt).getTime();
    if (Math.abs(existingStart - proposedAt) <= tenMinutes) {
      return true;
    }
  }

  return false;
}

function toGoogleDateString(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function buildCalendarLinks(proposal) {
  const dates = `${toGoogleDateString(proposal.startAt)}/${toGoogleDateString(proposal.endAt)}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: proposal.title,
    details: proposal.description,
    dates,
    location: proposal.location || ""
  });

  return {
    googleUrl: `https://calendar.google.com/calendar/render?${params.toString()}`,
    icsUrl: `/api/proposals/${proposal.id}.ics`
  };
}

function buildIcsText(proposal) {
  const uid = `${proposal.id}@ecqo.local`;
  const createdAt = toGoogleDateString(proposal.createdAt);
  const start = toGoogleDateString(proposal.startAt);
  const end = toGoogleDateString(proposal.endAt);
  const attendeeLines = proposal.participants
    .map((participant) => `ATTENDEE;CN=${escapeIcsText(participant.name)}:mailto:${escapeIcsText(participant.id)}@chat.local`)
    .join("\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ecqo//Chat Assistant//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${createdAt}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcsText(proposal.title)}`,
    `DESCRIPTION:${escapeIcsText(proposal.description)}`,
    `LOCATION:${escapeIcsText(proposal.location || "")}`,
    attendeeLines,
    "END:VEVENT",
    "END:VCALENDAR"
  ]
    .filter(Boolean)
    .join("\n");
}

function createProposalIfNeeded(conversation, message) {
  const text = message.text;
  const intentDetected = INTENT_PATTERN.test(text) || AFFIRMATION_PATTERN.test(text);
  if (!intentDetected) {
    return null;
  }

  const startDate = parseDateTime(text, new Date(message.timestamp));
  if (!startDate) {
    return null;
  }

  if (hasNearbyDuplicate(conversation.id, startDate.toISOString())) {
    return null;
  }

  const participants = Array.from(conversation.participants.values());
  if (participants.length < 2) {
    return null;
  }

  const duration = parseDurationMinutes(text);
  const endDate = new Date(startDate.getTime() + duration * 60 * 1000);

  const proposal = {
    id: `prop_${state.proposalSeq++}`,
    conversationId: conversation.id,
    channel: message.channel,
    title: buildProposalTitle(conversation, message),
    description: `Created from message: "${message.text}"`,
    location: parseLocation(text),
    sourceMessageIds: [message.id],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startAt: startDate.toISOString(),
    endAt: endDate.toISOString(),
    status: "pending",
    participants: participants.map((participant) => ({
      id: participant.id,
      name: participant.name,
      decision: "pending",
      decidedAt: null
    }))
  };

  const links = buildCalendarLinks(proposal);
  proposal.googleUrl = links.googleUrl;
  proposal.icsUrl = links.icsUrl;

  state.proposals.set(proposal.id, proposal);
  conversation.proposalIds.push(proposal.id);

  return proposal;
}

function ingestMessage(rawPayload) {
  const parsed = parseMessagePayload(rawPayload);
  if (parsed.error) {
    return { error: parsed.error };
  }

  const message = parsed.message;
  const conversation = getOrCreateConversation(message.conversationId, message.channel);

  addParticipant(conversation, { id: message.senderId, name: message.senderName });
  if (message.recipientId) {
    addParticipant(conversation, { id: message.recipientId, name: message.recipientName });
  }

  conversation.messages.push(message);

  const proposal = createProposalIfNeeded(conversation, message);

  return {
    message,
    proposal,
    conversation
  };
}

function serializeConversation(conversation) {
  return {
    id: conversation.id,
    channel: conversation.channel,
    participants: Array.from(conversation.participants.values()),
    messages: conversation.messages,
    proposalIds: conversation.proposalIds
  };
}

function serializeProposal(proposal) {
  return {
    ...proposal,
    participantSummary: proposal.participants.reduce(
      (summary, participant) => {
        summary[participant.decision] += 1;
        return summary;
      },
      { pending: 0, accepted: 0, rejected: 0 }
    )
  };
}

function updateProposalState(proposal) {
  if (proposal.participants.some((participant) => participant.decision === "rejected")) {
    proposal.status = "rejected";
    proposal.updatedAt = new Date().toISOString();
    return;
  }

  if (proposal.participants.every((participant) => participant.decision === "accepted")) {
    proposal.status = "confirmed";
    proposal.updatedAt = new Date().toISOString();
    return;
  }

  proposal.status = "pending";
  proposal.updatedAt = new Date().toISOString();
}

function respondToProposal(proposalId, participantId, action) {
  const proposal = state.proposals.get(proposalId);
  if (!proposal) {
    return { error: "Proposal not found." };
  }

  if (!["accept", "reject"].includes(action)) {
    return { error: "Action must be accept or reject." };
  }

  const participant = proposal.participants.find((entry) => entry.id === participantId);
  if (!participant) {
    return { error: "Participant is not part of this proposal." };
  }

  participant.decision = action === "accept" ? "accepted" : "rejected";
  participant.decidedAt = new Date().toISOString();
  updateProposalState(proposal);

  return { proposal };
}

function getMetaContactName(changeValue, fromId) {
  if (!changeValue || !Array.isArray(changeValue.contacts)) {
    return fromId;
  }

  const contact = changeValue.contacts.find((entry) => entry.wa_id === fromId);
  return contact?.profile?.name || fromId;
}

function ingestMetaWebhookPayload(payload) {
  const ingested = [];

  if (!payload || payload.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) {
    return ingested;
  }

  payload.entry.forEach((entry) => {
    if (!Array.isArray(entry.changes)) {
      return;
    }

    entry.changes.forEach((change) => {
      const value = change.value;
      if (!value || !Array.isArray(value.messages)) {
        return;
      }

      value.messages.forEach((message) => {
        if (message.type !== "text" || !message.text?.body) {
          return;
        }

        const senderId = sanitizeText(message.from);
        if (!senderId) {
          return;
        }

        const senderName = getMetaContactName(value, senderId);
        const recipientId = sanitizeText(value.metadata?.display_phone_number || value.metadata?.phone_number_id);
        const eventTimestamp = message.timestamp ? new Date(Number(message.timestamp) * 1000) : new Date();
        const timestamp = Number.isNaN(eventTimestamp.getTime()) ? new Date() : eventTimestamp;

        const result = ingestMessage({
          channel: "whatsapp",
          senderId,
          senderName,
          recipientId,
          recipientName: "You",
          text: message.text.body,
          timestamp: timestamp.toISOString()
        });

        if (!result.error) {
          ingested.push(result);
        }
      });
    });
  });

  return ingested;
}

async function handleApiRequest(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, {
      status: "ok",
      timestamp: new Date().toISOString(),
      proposals: state.proposals.size,
      conversations: state.conversations.size
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/messages") {
    const raw = await readBody(req);
    let body;

    try {
      body = parseBody(req, raw);
    } catch {
      sendJson(res, 400, { error: "Invalid request body." });
      return;
    }

    const result = ingestMessage(body);
    if (result.error) {
      sendJson(res, 400, { error: result.error });
      return;
    }

    sendJson(res, 201, {
      message: result.message,
      proposalCreated: result.proposal ? serializeProposal(result.proposal) : null,
      conversation: serializeConversation(result.conversation)
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/webhooks/meta/whatsapp") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === META_WEBHOOK_VERIFY_TOKEN && challenge) {
      sendText(res, 200, challenge, "text/plain; charset=utf-8");
      return;
    }

    sendText(res, 403, "Verification failed", "text/plain; charset=utf-8");
    return;
  }

  if (req.method === "POST" && url.pathname === "/webhooks/meta/whatsapp") {
    const raw = await readBody(req);
    let body;

    try {
      body = parseBody(req, raw);
    } catch {
      sendJson(res, 400, { error: "Invalid request body." });
      return;
    }

    const results = ingestMetaWebhookPayload(body);
    sendJson(res, 200, {
      received: true,
      messagesProcessed: results.length,
      proposalsCreated: results.filter((entry) => entry.proposal).length
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/conversations") {
    const conversations = Array.from(state.conversations.values()).map(serializeConversation);
    sendJson(res, 200, conversations);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/proposals") {
    const proposals = Array.from(state.proposals.values())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(serializeProposal);

    sendJson(res, 200, proposals);
    return;
  }

  const respondMatch = url.pathname.match(/^\/api\/proposals\/([^/]+)\/respond$/);
  if (req.method === "POST" && respondMatch) {
    const proposalId = respondMatch[1];
    const raw = await readBody(req);
    let body;

    try {
      body = parseBody(req, raw);
    } catch {
      sendJson(res, 400, { error: "Invalid request body." });
      return;
    }

    const participantId = sanitizeText(body.participantId);
    const action = sanitizeText(body.action);

    const result = respondToProposal(proposalId, participantId, action);
    if (result.error) {
      sendJson(res, 400, { error: result.error });
      return;
    }

    sendJson(res, 200, { proposal: serializeProposal(result.proposal) });
    return;
  }

  const icsMatch = url.pathname.match(/^\/api\/proposals\/([^/]+)\.ics$/);
  if (req.method === "GET" && icsMatch) {
    const proposalId = icsMatch[1];
    const proposal = state.proposals.get(proposalId);
    if (!proposal) {
      notFound(res);
      return;
    }

    sendText(res, 200, buildIcsText(proposal), "text/calendar; charset=utf-8");
    return;
  }

  notFound(res);
}

function serveStatic(req, res, url) {
  if (req.method !== "GET") {
    return false;
  }

  let target = url.pathname;
  if (target === "/") {
    target = "/index.html";
  }

  const allowed = ["/index.html", "/styles.css", "/app.js", "/robots.txt", "/sitemap.xml"];
  if (!allowed.includes(target)) {
    return false;
  }

  const absolute = path.join(PUBLIC_DIR, target);
  const ext = path.extname(absolute);

  try {
    const data = fs.readFileSync(absolute);
    sendText(res, 200, data, MIME_TYPES[ext] || "application/octet-stream");
    return true;
  } catch {
    sendJson(res, 500, { error: "Failed to serve static asset." });
    return true;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith("/api") || url.pathname.startsWith("/webhooks")) {
      await handleApiRequest(req, res, url);
      return;
    }

    if (serveStatic(req, res, url)) {
      return;
    }

    notFound(res);
  } catch (error) {
    sendJson(res, 500, {
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Ecqo assistant server running on http://localhost:${PORT}`);
});
