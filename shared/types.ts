// ── Connector → Convex event types ──

export type ConnectorEventType =
  | "QR_READY"
  | "SCANNED"
  | "CONNECTED"
  | "DISCONNECTED"
  | "MESSAGE_BATCH"
  | "HEARTBEAT";

export interface ConnectorEvent {
  type: ConnectorEventType;
  waAccountId?: string;
  sessionId: string;
  timestamp: number;
  payload: unknown;
}

export interface QrReadyPayload {
  qrCode: string;
}

export interface ConnectedPayload {
  phoneNumber: string;
  pushName: string;
  platform: string;
}

export interface MessageBatchPayload {
  messages: NormalizedMessage[];
  cursor?: string;
}

export interface HeartbeatPayload {
  uptimeMs: number;
  memoryUsageMb: number;
}

// ── Normalized WhatsApp message ──

export interface NormalizedMessage {
  /** WhatsApp message ID */
  externalId: string;
  /** Chat JID (e.g., 971501234567@s.whatsapp.net) */
  chatJid: string;
  /** Sender JID */
  senderJid: string;
  /** Unix timestamp (seconds) */
  timestamp: number;
  /** Message type */
  type: "text" | "image" | "video" | "audio" | "document" | "sticker" | "location" | "contact" | "reaction" | "other";
  /** Text content (if text message or caption) */
  text?: string;
  /** Whether this message was sent by the user (not received) */
  fromMe: boolean;
  /** Push name of sender */
  pushName?: string;
}

// ── Connection session states ──

export type ConnectSessionStatus =
  | "created"
  | "qr_ready"
  | "scanned"
  | "connected"
  | "expired"
  | "failed"
  | "retry_pending"
  | "disconnected";
