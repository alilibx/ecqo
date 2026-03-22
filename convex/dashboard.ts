import { v } from "convex/values";
import { query } from "./_generated/server";
import { getUser, requireRole } from "./users";

// ── Dashboard overview stats ──

/** Aggregate stats for the dashboard home page. */
export const stats = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const user = await getUser(ctx);
    await requireRole(ctx, user._id, workspaceId, [
      "owner",
      "principal",
      "operator",
    ]);

    // WhatsApp account for this workspace
    const account = await ctx.db
      .query("waAccounts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();

    if (!account) {
      return {
        connected: false,
        contactCount: 0,
        chatCount: 0,
        messageCount: 0,
        agentRunsToday: 0,
        accountStatus: "disconnected" as const,
      };
    }

    const contacts = await ctx.db
      .query("waContacts")
      .withIndex("by_account", (q) => q.eq("waAccountId", account._id))
      .collect();

    const chats = await ctx.db
      .query("waChats")
      .withIndex("by_account", (q) => q.eq("waAccountId", account._id))
      .collect();

    // Count today's agent runs
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const runs = await ctx.db
      .query("agentRuns")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const agentRunsToday = runs.filter(
      (r) => r.startedAt >= todayStart.getTime(),
    ).length;

    const totalMessages = chats.reduce((sum, c) => sum + c.messageCount, 0);

    return {
      connected: account.status === "connected",
      contactCount: contacts.length,
      chatCount: chats.length,
      messageCount: totalMessages,
      agentRunsToday,
      accountStatus: account.status,
    };
  },
});

// ── Chat list for conversations page ──

/** List chats with latest message preview. Sorted by most recent activity. */
export const listChats = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const user = await getUser(ctx);
    await requireRole(ctx, user._id, workspaceId, [
      "owner",
      "principal",
      "operator",
    ]);

    const account = await ctx.db
      .query("waAccounts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();

    if (!account) return [];

    const chats = await ctx.db
      .query("waChats")
      .withIndex("by_account", (q) => q.eq("waAccountId", account._id))
      .collect();

    // Enrich each chat with contact info and last message
    const enriched = await Promise.all(
      chats.map(async (chat) => {
        // Get contact for 1:1 chats
        let contactName: string | null = null;
        let contactPhone: string | null = null;
        let contactLocale: "en" | "ar" = "en";

        if (!chat.isGroup) {
          const contact = await ctx.db
            .query("waContacts")
            .withIndex("by_account_jid", (q) =>
              q.eq("waAccountId", account._id).eq("jid", chat.chatJid),
            )
            .unique();
          if (contact) {
            contactName = contact.name ?? null;
            contactPhone = contact.phone;
            contactLocale = contact.locale;
          }
        }

        // Get last message
        const lastMessages = await ctx.db
          .query("waMessages")
          .withIndex("by_chat", (q) =>
            q.eq("waAccountId", account._id).eq("chatJid", chat.chatJid),
          )
          .order("desc")
          .take(1);

        const lastMessage = lastMessages[0] ?? null;

        return {
          _id: chat._id,
          chatJid: chat.chatJid,
          chatName: chat.chatName,
          isGroup: chat.isGroup,
          contentPolicy: chat.contentPolicy ?? "metadata",
          lastMessageAt: chat.lastMessageAt,
          messageCount: chat.messageCount,
          contactName,
          contactPhone,
          contactLocale,
          lastMessagePreview: lastMessage?.text?.slice(0, 100) ?? null,
          lastMessageFromMe: lastMessage?.fromMe ?? false,
          lastMessageType: lastMessage?.type ?? null,
        };
      }),
    );

    // Sort by most recent activity
    return enriched.sort(
      (a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0),
    );
  },
});

// ── Message thread for conversation detail ──

/** Get messages for a specific chat. Returns most recent messages first (reversed for display). */
export const listMessages = query({
  args: {
    workspaceId: v.id("workspaces"),
    chatJid: v.string(),
  },
  handler: async (ctx, { workspaceId, chatJid }) => {
    const user = await getUser(ctx);
    await requireRole(ctx, user._id, workspaceId, [
      "owner",
      "principal",
      "operator",
    ]);

    const account = await ctx.db
      .query("waAccounts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();

    if (!account) return { messages: [], contact: null };

    const messages = await ctx.db
      .query("waMessages")
      .withIndex("by_chat", (q) =>
        q.eq("waAccountId", account._id).eq("chatJid", chatJid),
      )
      .order("desc")
      .take(100);

    // Get contact info
    const contact = await ctx.db
      .query("waContacts")
      .withIndex("by_account_jid", (q) =>
        q.eq("waAccountId", account._id).eq("jid", chatJid),
      )
      .unique();

    return {
      messages: messages.reverse(),
      contact,
    };
  },
});

// ── Recent conversations for dashboard home ──

/** Get the 5 most recently active chats for the home overview. */
export const recentChats = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const user = await getUser(ctx);
    await requireRole(ctx, user._id, workspaceId, [
      "owner",
      "principal",
      "operator",
    ]);

    const account = await ctx.db
      .query("waAccounts")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();

    if (!account) return [];

    const chats = await ctx.db
      .query("waChats")
      .withIndex("by_account", (q) => q.eq("waAccountId", account._id))
      .collect();

    // Sort by lastMessageAt desc, take 5
    const sorted = chats
      .sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0))
      .slice(0, 5);

    // Enrich with contact names
    const enriched = await Promise.all(
      sorted.map(async (chat) => {
        let contactName: string | null = null;
        if (!chat.isGroup) {
          const contact = await ctx.db
            .query("waContacts")
            .withIndex("by_account_jid", (q) =>
              q.eq("waAccountId", account._id).eq("jid", chat.chatJid),
            )
            .unique();
          contactName = contact?.name ?? null;
        }
        return {
          _id: chat._id,
          chatJid: chat.chatJid,
          chatName: chat.chatName,
          isGroup: chat.isGroup,
          contactName,
          lastMessageAt: chat.lastMessageAt,
          messageCount: chat.messageCount,
        };
      }),
    );

    return enriched;
  },
});
