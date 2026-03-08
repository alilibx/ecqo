/**
 * Normalize Baileys WAMessage into our NormalizedMessage format.
 * Produces ingestionHash for deduplication.
 */

import type { proto } from "@whiskeysockets/baileys";
import type { NormalizedMessage } from "@ecqqo/shared";
import { createHash } from "crypto";

export function normalizeMessage(
  msg: proto.IWebMessageInfo,
  accountJid: string,
): NormalizedMessage | null {
  const key = msg.key;
  if (!key?.id || !key.remoteJid) return null;

  const rawTs = msg.messageTimestamp;
  const timestamp =
    typeof rawTs === "number"
      ? rawTs
      : rawTs && typeof rawTs === "object" && "toNumber" in rawTs
        ? (rawTs as { toNumber: () => number }).toNumber()
        : Math.floor(Date.now() / 1000);

  // Unwrap nested message containers (viewOnce, ephemeral, etc.)
  const content = unwrapMessage(msg.message);
  const type = getMessageType(content);
  const text = extractText(content);

  // Skip protocol/system messages with no useful content
  if (type === "other" && !text && !msg.message) return null;

  const senderJid = key.fromMe
    ? accountJid
    : key.participant || key.remoteJid;

  // Debug: log unrecognized message types
  if (type === "other" && msg.message) {
    const keys = Object.keys(msg.message).filter(
      (k) => !k.startsWith("messageContext"),
    );
    console.log(`   [debug] Unknown message type, keys: ${keys.join(", ")}`);
  }

  return {
    externalId: key.id,
    chatJid: key.remoteJid,
    senderJid,
    timestamp,
    type,
    text: text || undefined,
    fromMe: key.fromMe ?? false,
    pushName: msg.pushName || undefined,
  };
}

/**
 * Unwrap nested message containers.
 * WhatsApp wraps messages in viewOnceMessage, ephemeralMessage,
 * documentWithCaptionMessage, editedMessage, etc.
 */
function unwrapMessage(
  content: proto.IMessage | null | undefined,
): proto.IMessage | null | undefined {
  if (!content) return content;

  // Unwrap viewOnce (disappearing media)
  if (content.viewOnceMessage?.message) {
    return unwrapMessage(content.viewOnceMessage.message);
  }
  if (content.viewOnceMessageV2?.message) {
    return unwrapMessage(content.viewOnceMessageV2.message);
  }

  // Unwrap ephemeral (disappearing chat)
  if (content.ephemeralMessage?.message) {
    return unwrapMessage(content.ephemeralMessage.message);
  }

  // Unwrap document with caption
  if (content.documentWithCaptionMessage?.message) {
    return unwrapMessage(content.documentWithCaptionMessage.message);
  }

  // Unwrap edited message
  if (content.editedMessage?.message) {
    return unwrapMessage(content.editedMessage.message);
  }

  return content;
}

function getMessageType(
  content: proto.IMessage | null | undefined,
): NormalizedMessage["type"] {
  if (!content) return "other";
  if (content.conversation || content.extendedTextMessage) return "text";
  if (content.imageMessage) return "image";
  if (content.videoMessage) return "video";
  if (content.audioMessage || content.pttMessage) return "audio";
  if (content.documentMessage) return "document";
  if (content.stickerMessage) return "sticker";
  if (content.locationMessage || content.liveLocationMessage) return "location";
  if (content.contactMessage || content.contactsArrayMessage) return "contact";
  if (content.reactionMessage) return "reaction";
  return "other";
}

function extractText(
  content: proto.IMessage | null | undefined,
): string | null {
  if (!content) return null;
  if (content.conversation) return content.conversation;
  if (content.extendedTextMessage?.text)
    return content.extendedTextMessage.text;
  if (content.imageMessage?.caption) return content.imageMessage.caption;
  if (content.videoMessage?.caption) return content.videoMessage.caption;
  if (content.documentMessage?.caption)
    return content.documentMessage.caption;
  // Reaction emoji
  if (content.reactionMessage?.text) return content.reactionMessage.text;
  return null;
}

export function computeIngestionHash(
  accountSessionId: string,
  externalId: string,
): string {
  return createHash("sha256")
    .update(`${accountSessionId}:${externalId}`)
    .digest("hex");
}
