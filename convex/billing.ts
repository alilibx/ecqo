import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getUser, requireRole } from "./users";
import type { Id } from "./_generated/dataModel";
import Stripe from "stripe";

// ── Plan config ──

const PLAN_CONFIG = {
  founder: { maxPrincipals: 1 },
  dreamer: { maxPrincipals: 5 },
  custom: { maxPrincipals: 999 },
} as const;

const GRACE_PERIOD_DAYS = 7;

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key);
}

// ── Queries ──

/** Get the current subscription for a workspace. */
export const getSubscription = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const user = await getUser(ctx);
    await requireRole(ctx, user._id, workspaceId, [
      "owner",
      "principal",
      "operator",
    ]);

    return ctx.db
      .query("subscriptions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();
  },
});

/** Check whether a workspace has an active (usable) subscription. */
export const isActive = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();

    if (!sub) return { active: false, reason: "no_subscription" as const };

    const now = Date.now();

    if (sub.status === "active") return { active: true, plan: sub.plan };
    if (sub.status === "trialing") {
      if (sub.trialEnd && now < sub.trialEnd)
        return { active: true, plan: sub.plan };
      return { active: false, reason: "trial_expired" as const };
    }
    if (sub.status === "past_due") {
      const graceEnd =
        sub.currentPeriodEnd + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
      if (now < graceEnd) return { active: true, plan: sub.plan };
      return { active: false, reason: "grace_expired" as const };
    }

    return { active: false, reason: sub.status as "canceled" | "unpaid" };
  },
});

/** Get plan limits for a workspace. */
export const getPlanLimits = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();

    if (!sub) return null;
    return { plan: sub.plan, ...PLAN_CONFIG[sub.plan] };
  },
});

// ── Actions (call Stripe API) ──

/** Create a Stripe Checkout session for a plan. */
export const createCheckoutSession = action({
  args: {
    workspaceId: v.id("workspaces"),
    plan: v.union(v.literal("founder"), v.literal("dreamer")),
    currency: v.union(v.literal("usd"), v.literal("aed")),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, { workspaceId, plan, currency, successUrl, cancelUrl }) => {
    const stripe = getStripe();

    // Get or create Stripe customer for this workspace
    const sub = await ctx.runQuery(internal.billing.getSubscriptionInternal, {
      workspaceId,
    });

    let customerId: string;

    if (sub?.stripeCustomerId) {
      customerId = sub.stripeCustomerId;
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        metadata: { workspaceId },
      });
      customerId = customer.id;
    }

    // Look up the correct price from Stripe
    const priceId = process.env[
      `STRIPE_PRICE_${plan.toUpperCase()}_${currency.toUpperCase()}`
    ];
    if (!priceId) {
      throw new Error(
        `Price not configured: STRIPE_PRICE_${plan.toUpperCase()}_${currency.toUpperCase()}`,
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: workspaceId,
      subscription_data: {
        trial_period_days: sub ? undefined : 14,
        metadata: { workspaceId, plan, currency },
      },
    });

    return { url: session.url };
  },
});

/** Create a Stripe Billing Portal session for self-service management. */
export const createPortalSession = action({
  args: {
    workspaceId: v.id("workspaces"),
    returnUrl: v.string(),
  },
  handler: async (ctx, { workspaceId, returnUrl }) => {
    const stripe = getStripe();

    const sub = await ctx.runQuery(internal.billing.getSubscriptionInternal, {
      workspaceId,
    });
    if (!sub?.stripeCustomerId) {
      throw new Error("No billing account found for this workspace");
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  },
});

// ── Internal queries/mutations (for webhook + action use) ──

export const getSubscriptionInternal = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    return ctx.db
      .query("subscriptions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();
  },
});

export const getSubscriptionByStripeSubId = internalQuery({
  args: { stripeSubId: v.string() },
  handler: async (ctx, { stripeSubId }) => {
    return ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_sub", (q) => q.eq("stripeSubId", stripeSubId))
      .first();
  },
});

/** Upsert subscription from Stripe webhook data. */
export const upsertSubscription = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    stripeCustomerId: v.string(),
    stripeSubId: v.string(),
    stripePriceId: v.string(),
    plan: v.union(
      v.literal("founder"),
      v.literal("dreamer"),
      v.literal("custom"),
    ),
    status: v.union(
      v.literal("trialing"),
      v.literal("active"),
      v.literal("past_due"),
      v.literal("canceled"),
      v.literal("unpaid"),
    ),
    currency: v.union(v.literal("usd"), v.literal("aed")),
    currentPeriodEnd: v.number(),
    trialEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      });
      return existing._id;
    }

    return ctx.db.insert("subscriptions", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Update subscription status (used by webhook handlers). */
export const updateSubscriptionStatus = internalMutation({
  args: {
    stripeSubId: v.string(),
    status: v.union(
      v.literal("trialing"),
      v.literal("active"),
      v.literal("past_due"),
      v.literal("canceled"),
      v.literal("unpaid"),
    ),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
  },
  handler: async (ctx, { stripeSubId, status, currentPeriodEnd, cancelAtPeriodEnd }) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_sub", (q) => q.eq("stripeSubId", stripeSubId))
      .first();

    if (!sub) return;

    const patch: Record<string, unknown> = { status, updatedAt: Date.now() };
    if (currentPeriodEnd !== undefined) patch.currentPeriodEnd = currentPeriodEnd;
    if (cancelAtPeriodEnd !== undefined) patch.cancelAtPeriodEnd = cancelAtPeriodEnd;

    await ctx.db.patch(sub._id, patch);
  },
});
