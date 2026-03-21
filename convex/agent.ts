import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { Id } from "./_generated/dataModel";

// ── System prompt ──

const SYSTEM_PROMPT = `You are Ecqqo, a WhatsApp-native executive assistant for high-net-worth operators, founders, and executives.

## Your role
You help your principal manage their day — scheduling, reminders, email summaries, calendar checks, travel coordination, and meeting briefs. You are fast, reliable, and never drop the ball.

## How to respond
- Match the language of the incoming message (English or Arabic)
- Be concise — WhatsApp messages should be short and scannable
- Use WhatsApp formatting: *bold* for emphasis, _italic_ for asides
- Keep responses under 500 characters for simple confirmations
- For lists, use bullet points or numbered lists
- Be warm but professional — you're a trusted assistant, not a chatbot
- If a request is ambiguous, ask one clarifying question
- Never make up information — say "I don't have that information yet" if unsure

## Current capabilities (M0)
You can have natural conversations and help with basic questions. Advanced features like calendar access, email integration, and action execution are coming soon. For now, acknowledge requests that require those features and let the principal know they're on the way.

## Boundaries
- Never share information about one principal with another
- Never take irreversible actions without explicit confirmation
- If asked to do something outside your capabilities, be honest about limitations`;

// ── Conversation context window ──

const MAX_CONTEXT_MESSAGES = 20;

// ── Provider failover ──

type ProviderConfig = {
  name: string;
  createModel: () => Parameters<typeof generateText>[0]["model"];
};

function getProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = [];

  if (process.env.ANTHROPIC_API_KEY) {
    providers.push({
      name: "anthropic",
      createModel: () => anthropic("claude-sonnet-4-20250514"),
    });
  }

  if (process.env.OPENAI_API_KEY) {
    providers.push({
      name: "openai",
      createModel: () => openai("gpt-4o"),
    });
  }

  return providers;
}

// ── Internal queries/mutations ──

/** Fetch recent messages from a chat for context assembly. */
export const getRecentMessages = internalQuery({
  args: {
    waAccountId: v.id("waAccounts"),
    chatJid: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("waMessages")
      .withIndex("by_chat", (q) =>
        q.eq("waAccountId", args.waAccountId).eq("chatJid", args.chatJid),
      )
      .order("desc")
      .take(args.limit);

    return messages.reverse();
  },
});

/** Look up waAccount by ID. */
export const getWaAccount = internalQuery({
  args: { accountId: v.id("waAccounts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.accountId);
  },
});

/** Create an agent run record. */
export const createAgentRun = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    principalId: v.id("users"),
    triggerId: v.string(),
    specialistType: v.union(
      v.literal("scheduler"),
      v.literal("calendar"),
      v.literal("email"),
      v.literal("reminder"),
      v.literal("travel"),
      v.literal("brief"),
    ),
  },
  handler: async (ctx, args) => {
    // Idempotency check
    const existing = await ctx.db
      .query("agentRuns")
      .withIndex("by_triggerId", (q) => q.eq("triggerId", args.triggerId))
      .unique();

    if (existing) return existing._id;

    return await ctx.db.insert("agentRuns", {
      workspaceId: args.workspaceId,
      principalId: args.principalId,
      triggerId: args.triggerId,
      status: "queued",
      specialistType: args.specialistType,
      startedAt: Date.now(),
    });
  },
});

/** Update agent run status. */
export const updateAgentRun = internalMutation({
  args: {
    runId: v.id("agentRuns"),
    status: v.union(
      v.literal("queued"),
      v.literal("planning"),
      v.literal("awaiting_approval"),
      v.literal("executing"),
      v.literal("retry_executing"),
      v.literal("completed"),
      v.literal("rejected"),
      v.literal("expired"),
      v.literal("failed"),
    ),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = { status: args.status };
    if (
      args.status === "completed" ||
      args.status === "failed" ||
      args.status === "rejected"
    ) {
      patch.completedAt = Date.now();
    }
    await ctx.db.patch(args.runId, patch);
  },
});

/** Create a run step record. */
export const createRunStep = internalMutation({
  args: {
    agentRunId: v.id("agentRuns"),
    stepType: v.union(
      v.literal("llm_call"),
      v.literal("tool_call"),
      v.literal("approval_wait"),
      v.literal("memory_query"),
    ),
    input: v.string(),
    output: v.optional(v.string()),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("runSteps", {
      agentRunId: args.agentRunId,
      stepType: args.stepType,
      input: args.input,
      output: args.output,
      durationMs: args.durationMs,
      createdAt: Date.now(),
    });
  },
});

/** Store the agent's response as an outbound message. */
export const storeAgentResponse = internalMutation({
  args: {
    waAccountId: v.id("waAccounts"),
    chatJid: v.string(),
    text: v.string(),
    agentRunId: v.id("agentRuns"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const hash = `agent-${args.agentRunId}-${now}`;

    await ctx.db.insert("waMessages", {
      waAccountId: args.waAccountId,
      externalId: `agent-${args.agentRunId}`,
      chatJid: args.chatJid,
      senderJid: "agent",
      timestamp: now,
      type: "text",
      text: args.text,
      fromMe: true,
      pushName: "Ecqqo",
      ingestionHash: hash,
      ingestedAt: now,
    });

    // Update chat metadata
    const chat = await ctx.db
      .query("waChats")
      .withIndex("by_account_chat", (q) =>
        q.eq("waAccountId", args.waAccountId).eq("chatJid", args.chatJid),
      )
      .unique();

    if (chat) {
      await ctx.db.patch(chat._id, {
        lastMessageAt: now,
        messageCount: chat.messageCount + 1,
        updatedAt: now,
      });
    }
  },
});

/** Find workspace owner as the principal for a waAccount. */
export const findPrincipal = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_workspace_role", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("role", "owner"),
      )
      .first();

    return membership?.userId ?? null;
  },
});

// ── Main agent action ──

/**
 * Process an incoming WhatsApp message through the AI agent pipeline.
 *
 * Flow:
 * 1. Load message context (recent conversation history)
 * 2. Build system prompt + conversation messages
 * 3. Call LLM via Vercel AI SDK (with failover)
 * 4. Store response and agent run record
 * 5. Return response text for delivery via WhatsApp
 */
export const processMessage = internalAction({
  args: {
    waAccountId: v.id("waAccounts"),
    chatJid: v.string(),
    senderJid: v.optional(v.string()),
    messageText: v.string(),
    triggerId: v.string(),
    isFirstMessage: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ response: string; provider: string } | { error: string }> => {
    const startTime = Date.now();

    // 1. Get account and workspace info
    const account = await ctx.runQuery(internal.agent.getWaAccount, {
      accountId: args.waAccountId,
    });

    if (!account) {
      return { error: "WhatsApp account not found" };
    }

    if (!account.workspaceId) {
      return { error: "Account not linked to a workspace" };
    }

    // Find principal (workspace owner)
    const principalId = await ctx.runQuery(internal.agent.findPrincipal, {
      workspaceId: account.workspaceId,
    });

    if (!principalId) {
      return { error: "No principal found for workspace" };
    }

    // 2. Load contact info for personalization
    let contactContext = "";
    if (args.senderJid) {
      const contact = await ctx.runQuery(internal.contacts.getByJid, {
        waAccountId: args.waAccountId,
        jid: args.senderJid,
      });

      if (contact) {
        const namePart = contact.name ? `Their name is ${contact.name}. ` : "";
        const localePart = `Their preferred language is ${contact.locale === "ar" ? "Arabic" : "English"}. `;
        const firstTimePart = args.isFirstMessage
          ? "This is their FIRST message ever. Welcome them warmly, introduce yourself, and explain what you can help with. "
          : "";
        contactContext = `\n\n## About this user\n${namePart}${localePart}Phone: ${contact.phone}. ${firstTimePart}`;
      }
    }

    // Create agent run record
    const runId = await ctx.runMutation(internal.agent.createAgentRun, {
      workspaceId: account.workspaceId,
      principalId: principalId as Id<"users">,
      triggerId: args.triggerId,
      specialistType: "scheduler", // Default for M0 — orchestrator routing comes in M1
    });

    try {
      // 3. Get conversation context
      const recentMessages = await ctx.runQuery(
        internal.agent.getRecentMessages,
        {
          waAccountId: args.waAccountId,
          chatJid: args.chatJid,
          limit: MAX_CONTEXT_MESSAGES,
        },
      );

      // 4. Build messages array for LLM
      const conversationMessages: Array<{
        role: "user" | "assistant";
        content: string;
      }> = [];

      for (const msg of recentMessages) {
        if (!msg.text) continue;

        if (msg.senderJid === "agent" || msg.fromMe) {
          conversationMessages.push({ role: "assistant", content: msg.text });
        } else {
          conversationMessages.push({ role: "user", content: msg.text });
        }
      }

      // Ensure the current message is included (it may not be in the DB yet)
      const lastMsg = conversationMessages[conversationMessages.length - 1];
      if (!lastMsg || lastMsg.content !== args.messageText || lastMsg.role !== "user") {
        conversationMessages.push({
          role: "user",
          content: args.messageText,
        });
      }

      // 5. Call LLM with failover
      const providers = getProviders();

      if (providers.length === 0) {
        await ctx.runMutation(internal.agent.updateAgentRun, {
          runId,
          status: "failed",
        });
        return { error: "No AI providers configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in Convex environment." };
      }

      let responseText: string | null = null;
      let usedProvider: string = "unknown";

      for (const provider of providers) {
        try {
          const result = await generateText({
            model: provider.createModel(),
            system: SYSTEM_PROMPT + contactContext,
            messages: conversationMessages,
            maxTokens: 1024,
          });

          responseText = result.text;
          usedProvider = provider.name;
          break;
        } catch (err) {
          console.error(`Provider ${provider.name} failed:`, err);
          continue;
        }
      }

      if (!responseText) {
        await ctx.runMutation(internal.agent.updateAgentRun, {
          runId,
          status: "failed",
        });
        return { error: "All AI providers failed" };
      }

      const durationMs = Date.now() - startTime;

      // 6. Record the LLM call step
      await ctx.runMutation(internal.agent.createRunStep, {
        agentRunId: runId,
        stepType: "llm_call",
        input: JSON.stringify({
          provider: usedProvider,
          messageCount: conversationMessages.length,
        }),
        output: JSON.stringify({ responseLength: responseText.length }),
        durationMs,
      });

      // 7. Store the response message
      await ctx.runMutation(internal.agent.storeAgentResponse, {
        waAccountId: args.waAccountId,
        chatJid: args.chatJid,
        text: responseText,
        agentRunId: runId,
      });

      // 8. Mark run as completed
      await ctx.runMutation(internal.agent.updateAgentRun, {
        runId,
        status: "completed",
      });

      return { response: responseText, provider: usedProvider };
    } catch (err) {
      // Mark run as failed
      await ctx.runMutation(internal.agent.updateAgentRun, {
        runId,
        status: "failed",
      });
      throw err;
    }
  },
});
