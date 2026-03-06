import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { RateLimiter, MINUTE, HOUR } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";
import { resend, verificationEmailHtml, waitlistEmailHtml } from "./emails";

const TOKEN_TTL = 24 * 60 * 60 * 1000; // 24 hours

const rateLimiter = new RateLimiter(components.rateLimiter, {
  waitlistGlobal: { kind: "fixed window", rate: 30, period: MINUTE },
  waitlistPerEmail: { kind: "token bucket", rate: 3, period: HOUR, capacity: 3 },
  verifyAttempt: { kind: "token bucket", rate: 5, period: 15 * MINUTE, capacity: 5 },
});

function normalizeEmail(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  const [local, domain] = trimmed.split("@");
  if (!local || !domain) throw new Error("Invalid email address.");
  if (local.includes("+")) {
    throw new Error("Email addresses with '+' aliases are not allowed.");
  }
  return `${local}@${domain}`;
}

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

// Cheap cached query — use this to check status before calling mutations
export const getStatus = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = email.trim().toLowerCase();
    const entry = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();

    if (!entry) return { found: false, verified: false, position: 0 };
    if (entry.verified) return { found: true, verified: true, position: entry.position };
    return { found: true, verified: false, position: 0 };
  },
});

export const requestVerification = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = normalizeEmail(email);

    await rateLimiter.limit(ctx, "waitlistGlobal", { throws: true });
    await rateLimiter.limit(ctx, "waitlistPerEmail", {
      key: normalized,
      throws: true,
    });

    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();

    if (existing?.verified) {
      return { status: "already_verified" as const, position: existing.position };
    }

    const token = generateToken();
    const tokenExpiresAt = Date.now() + TOKEN_TTL;

    if (existing) {
      await ctx.db.patch(existing._id, { verificationCode: token, tokenExpiresAt });
    } else {
      await ctx.db.insert("waitlist", {
        email: normalized,
        joinedAt: Date.now(),
        verified: false,
        verificationCode: token,
        tokenExpiresAt,
        position: 0,
      });
    }

    await resend.sendEmail(ctx, {
      from: "Ecqo <ecqo@arqq.in>",
      to: normalized,
      subject: "Verify your Ecqo waitlist spot",
      html: verificationEmailHtml(normalized, token),
    });

    return { status: "code_sent" as const };
  },
});

export const verify = mutation({
  args: { email: v.string(), token: v.string() },
  handler: async (ctx, { email, token }) => {
    const normalized = email.trim().toLowerCase();

    const entry = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();

    if (!entry) {
      throw new Error("No signup found for this email.");
    }

    if (entry.verified) {
      return { position: entry.position, alreadyVerified: true };
    }

    // Rate limit only unverified attempts
    await rateLimiter.limit(ctx, "verifyAttempt", {
      key: normalized,
      throws: true,
    });

    if (Date.now() > entry.tokenExpiresAt) {
      throw new Error("This verification link has expired. Please request a new one.");
    }

    if (entry.verificationCode !== token) {
      throw new Error("Invalid verification link.");
    }

    const latest = await ctx.db
      .query("waitlist")
      .withIndex("by_position")
      .order("desc")
      .first();

    const maxPosition = latest && latest.position > 0 ? latest.position : 0;
    const position = maxPosition + 1;

    await ctx.db.patch(entry._id, {
      verified: true,
      position,
      verificationCode: "",
    });

    await resend.sendEmail(ctx, {
      from: "Ecqo <ecqo@arqq.in>",
      to: normalized,
      subject: `You're #${position} on the Ecqo waitlist!`,
      html: waitlistEmailHtml(position),
    });

    return { position, alreadyVerified: false };
  },
});

export const getCount = query({
  args: {},
  handler: async (ctx) => {
    const latest = await ctx.db
      .query("waitlist")
      .withIndex("by_position")
      .order("desc")
      .first();
    return latest && latest.position > 0 ? latest.position : 0;
  },
});
