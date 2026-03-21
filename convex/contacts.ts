import { v } from "convex/values";
import { internalQuery, query, type MutationCtx } from "./_generated/server";
import { getUser, requireRole } from "./users";
import type { Id } from "./_generated/dataModel";

// ── Helpers ──

/** Extract phone number from WhatsApp JID (e.g. "1234567890@s.whatsapp.net" → "1234567890") */
function phoneFromJid(jid: string): string {
  return jid.split("@")[0];
}

/** Detect locale from message text using simple heuristics. */
export function detectLocale(text: string): "en" | "ar" {
  // Arabic Unicode range: \u0600-\u06FF (Arabic), \u0750-\u077F (Arabic Supplement)
  const arabicChars = text.match(/[\u0600-\u06FF\u0750-\u077F]/g)?.length ?? 0;
  const totalChars = text.replace(/\s/g, "").length || 1;
  return arabicChars / totalChars > 0.3 ? "ar" : "en";
}

// ── Contact resolution (callable from any mutation context) ──

/**
 * Resolve a contact by JID within an existing mutation transaction.
 * Creates a new contact on first interaction.
 */
export async function resolveContact(
  ctx: MutationCtx,
  args: {
    waAccountId: Id<"waAccounts">;
    senderJid: string;
    pushName?: string;
    messageText?: string;
    timestamp: number;
  },
): Promise<{ isFirstMessage: boolean; locale: "en" | "ar" }> {
  const existing = await ctx.db
    .query("waContacts")
    .withIndex("by_account_jid", (q) =>
      q.eq("waAccountId", args.waAccountId).eq("jid", args.senderJid),
    )
    .unique();

  if (existing) {
    const updates: Record<string, unknown> = {
      lastSeenAt: args.timestamp,
      messageCount: existing.messageCount + 1,
    };

    if (args.pushName && !existing.name) {
      updates.name = args.pushName;
    }

    const locale = args.messageText ? detectLocale(args.messageText) : existing.locale;
    updates.locale = locale;

    await ctx.db.patch(existing._id, updates);
    return { isFirstMessage: false, locale };
  }

  // Create new contact
  const locale = args.messageText ? detectLocale(args.messageText) : "en";
  const phone = phoneFromJid(args.senderJid);

  await ctx.db.insert("waContacts", {
    waAccountId: args.waAccountId,
    jid: args.senderJid,
    phone,
    name: args.pushName,
    locale,
    firstSeenAt: args.timestamp,
    lastSeenAt: args.timestamp,
    messageCount: 1,
  });

  return { isFirstMessage: true, locale };
}

// ── Internal queries (for agent context) ──

/** Get contact by JID for agent context enrichment. */
export const getByJid = internalQuery({
  args: {
    waAccountId: v.id("waAccounts"),
    jid: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("waContacts")
      .withIndex("by_account_jid", (q) =>
        q.eq("waAccountId", args.waAccountId).eq("jid", args.jid),
      )
      .unique();
  },
});

// ── Dashboard queries (RBAC-protected) ──

/** List all contacts for a workspace's WhatsApp account. */
export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    await requireRole(ctx, user._id, args.workspaceId, [
      "owner",
      "principal",
      "operator",
    ]);

    const account = await ctx.db
      .query("waAccounts")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .first();

    if (!account) return [];

    return await ctx.db
      .query("waContacts")
      .withIndex("by_account", (q) => q.eq("waAccountId", account._id))
      .collect();
  },
});

/** Get a specific contact by phone number. */
export const getByPhone = query({
  args: {
    workspaceId: v.id("workspaces"),
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    await requireRole(ctx, user._id, args.workspaceId, [
      "owner",
      "principal",
      "operator",
    ]);

    const account = await ctx.db
      .query("waAccounts")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .first();

    if (!account) return null;

    return await ctx.db
      .query("waContacts")
      .withIndex("by_account_phone", (q) =>
        q.eq("waAccountId", account._id).eq("phone", args.phone),
      )
      .unique();
  },
});
