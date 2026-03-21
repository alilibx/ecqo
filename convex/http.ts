import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import Stripe from "stripe";

const http = httpRouter();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Preflight handler
function handleOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// POST /waitlist/request-verification
http.route({
  path: "/waitlist/request-verification",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const { email } = await req.json();
    const result = await ctx.runMutation(api.waitlist.requestVerification, { email });
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }),
});

http.route({
  path: "/waitlist/request-verification",
  method: "OPTIONS",
  handler: httpAction(async () => handleOptions()),
});

// POST /waitlist/verify
http.route({
  path: "/waitlist/verify",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const { email, token } = await req.json();
    const result = await ctx.runMutation(api.waitlist.verify, { email, token });
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }),
});

http.route({
  path: "/waitlist/verify",
  method: "OPTIONS",
  handler: httpAction(async () => handleOptions()),
});

// GET /waitlist/status?email=...
http.route({
  path: "/waitlist/status",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const email = url.searchParams.get("email") ?? "";
    const result = await ctx.runQuery(api.waitlist.getStatus, { email });
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }),
});

http.route({
  path: "/waitlist/status",
  method: "OPTIONS",
  handler: httpAction(async () => handleOptions()),
});

// ── Stripe webhook ──

/** Extract subscription ID from a Stripe invoice object (handles string or object). */
function invoiceSubId(invoice: Record<string, unknown>): string | null {
  const s = invoice.subscription;
  if (typeof s === "string") return s;
  if (s && typeof s === "object" && "id" in (s as Record<string, unknown>))
    return (s as { id: string }).id;
  return null;
}

http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return new Response("Missing stripe-signature", { status: 400 });
    }

    const body = await req.text();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch {
      return new Response("Invalid signature", { status: 401 });
    }

    // Use `as any` for raw event data — Stripe SDK types don't always match webhook payloads exactly.
    const obj = event.data.object as any;

    switch (event.type) {
      case "checkout.session.completed": {
        const workspaceId = obj.client_reference_id as string | null;
        const subRef = obj.subscription as string | null;
        if (!workspaceId || !subRef) break;

        // Retrieve full subscription details from Stripe
        const sub = await stripe.subscriptions.retrieve(subRef) as any;
        const price = sub.items?.data?.[0]?.price;
        const meta = sub.metadata ?? {};

        await ctx.runMutation(internal.billing.upsertSubscription, {
          workspaceId: workspaceId as any,
          stripeCustomerId: String(sub.customer),
          stripeSubId: sub.id,
          stripePriceId: price?.id ?? "",
          plan: (meta.plan as "founder" | "dreamer" | "custom") ?? "founder",
          status: sub.status === "trialing" ? "trialing" : "active",
          currency: (meta.currency as "usd" | "aed") ?? "usd",
          currentPeriodEnd: (sub.current_period_end ?? 0) * 1000,
          trialEnd: sub.trial_end ? sub.trial_end * 1000 : undefined,
          cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
        });
        break;
      }

      case "invoice.paid": {
        const subId = invoiceSubId(obj);
        if (!subId) break;

        const sub = await stripe.subscriptions.retrieve(subId) as any;
        await ctx.runMutation(internal.billing.updateSubscriptionStatus, {
          stripeSubId: subId,
          status: "active",
          currentPeriodEnd: (sub.current_period_end ?? 0) * 1000,
        });
        break;
      }

      case "invoice.payment_failed": {
        const subId = invoiceSubId(obj);
        if (!subId) break;

        await ctx.runMutation(internal.billing.updateSubscriptionStatus, {
          stripeSubId: subId,
          status: "past_due",
        });
        break;
      }

      case "customer.subscription.updated": {
        const meta = obj.metadata ?? {};
        const workspaceId = meta.workspaceId;
        if (!workspaceId) break;

        const statusMap: Record<string, string> = {
          active: "active",
          trialing: "trialing",
          past_due: "past_due",
          canceled: "canceled",
          unpaid: "unpaid",
        };

        await ctx.runMutation(internal.billing.updateSubscriptionStatus, {
          stripeSubId: obj.id,
          status: (statusMap[obj.status] ?? "active") as any,
          currentPeriodEnd: (obj.current_period_end ?? 0) * 1000,
          cancelAtPeriodEnd: Boolean(obj.cancel_at_period_end),
        });
        break;
      }

      case "customer.subscription.deleted": {
        await ctx.runMutation(internal.billing.updateSubscriptionStatus, {
          stripeSubId: obj.id,
          status: "canceled",
        });
        break;
      }
    }

    return new Response("ok", { status: 200 });
  }),
});

export default http;
