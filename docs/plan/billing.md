# Billing (Stripe)

Stripe integration architecture, plan definitions, webhook handling, and enforcement logic for Ecqqo subscriptions.

## Integration Architecture

```
+-------------------+                    +-------------------+
|                   |  1. Select plan    |                   |
|   Dashboard       +------- ---------->|  Stripe Checkout  |
|   (TanStack       |                    |  Session          |
|    Start)         |<-------------------+                   |
|                   |  5. Redirect       |                   |
+--------+----------+  (success/cancel)  +--------+----------+
         |                                        |
         | Convex queries                         | 2. Customer
         | (plan status,                          |    completes
         |  feature gates)                        |    payment
         |                                        |
+--------v----------+                    +--------v----------+
|                   |  4. Process event  |                   |
|   Convex          |<-------------------+   Stripe          |
|   (Control Plane) |    (webhook POST)  |   (Billing)       |
|                   |                    |                   |
|  +-------------+  |  3. Emit event     |  - Products       |
|  | subscrip-   |  |<-------------------+  - Prices         |
|  | tions table |  |                    |  - Customers      |
|  +------+------+  |                    |  - Subscriptions  |
|         |         |                    |  - Invoices       |
|  +------v------+  |                    +-------------------+
|  | plan        |  |
|  | enforcement |  |                    +-------------------+
|  +------+------+  |  6. Self-service   |                   |
|         |         +------- ---------->|  Stripe Billing   |
|  +------v------+  |                    |  Portal           |
|  | feature     |  |                    |                   |
|  | gates       |  |                    |  - Update card    |
|  +-------------+  |                    |  - Cancel plan    |
+-------------------+                    |  - View invoices  |
                                         +-------------------+
```

### Data Flow Detail

```
  Signup Flow:
  +---------+     +----------+     +-----------+     +--------+     +----------+
  | User    |---->| Clerk    |---->| Convex    |---->| Stripe |---->| Convex   |
  | signs   |     | creates  |     | creates   |     | creates|     | stores   |
  | up      |     | identity |     | workspace |     | cust.  |     | stripeId |
  +---------+     +----------+     +-----------+     +--------+     +----------+

  Checkout Flow:
  +---------+     +----------+     +-----------+     +--------+     +----------+
  | User    |---->| Dashboard|---->| Convex    |---->| Stripe |---->| Stripe   |
  | picks   |     | calls    |     | action    |     | creates|     | hosts    |
  | plan    |     | mutation |     | creates   |     | session|     | checkout |
  +---------+     +----------+     | checkout  |     +--------+     | page     |
                                   +-----------+                    +----------+
                                                                         |
                                                                         v
  +----------+     +----------+     +-----------+                   +--------+
  | Convex   |<----| Convex   |<----| Stripe    |<-----------------| User   |
  | updates  |     | webhook  |     | sends     |                   | pays   |
  | sub      |     | handler  |     | event     |                   |        |
  | table    |     |          |     |           |                   +--------+
  +----------+     +----------+     +-----------+
```

## Plan Definitions

| Plan | USD/mo | AED/mo | Principals | Features |
|------|--------|--------|-----------|----------|
| Founder | $199 | 749 AED | 1 | Unlimited scheduling, Approval workflow, Calendar + Reminders, WhatsApp sync, Memory system, Email support |
| Dreamer | $399 | 1,499 AED | Up to 5 | Everything in Founder, plus: Priority rules, Shared operator view, Email digest, Meeting briefs, Priority support |
| Custom | TBD | TBD | Custom | Everything in Dreamer, plus: Dedicated onboarding, Custom agent configuration, SLA guarantee, Direct Slack/WhatsApp support |

## Stripe Objects Mapping

| Stripe Object | Ecqqo Mapping | Notes |
|--------------|-------------|-------|
| Product | Ecqqo plan (Founder, Dreamer, Custom) | One product per plan tier |
| Price | Monthly price variant | Two prices per product: USD and AED |
| Customer | Workspace | 1:1 mapping. stripeId stored in workspaces table |
| Subscription | Active plan | One active sub per workspace |
| Checkout Session | Plan selection flow | Created by Convex action, hosted by Stripe |
| Billing Portal Session | Self-service management | Update card, cancel, view invoices |

### Convex Schema: `subscriptions` Table

```
subscriptions {
  workspaceId:       Id<"workspaces">      // foreign key
  stripeCustomerId:  string                 // cus_xxxxx
  stripeSubId:       string                 // sub_xxxxx
  stripePriceId:     string                 // price_xxxxx
  plan:              "founder" | "dreamer" | "custom"
  status:            "trialing" | "active" | "past_due" | "canceled" | "unpaid"
  currency:          "usd" | "aed"
  currentPeriodEnd:  number                 // Unix timestamp
  trialEnd:          number | null          // Unix timestamp
  cancelAtPeriodEnd: boolean
  createdAt:         number
  updatedAt:         number
}

indexes:
  by_workspace:    [workspaceId]
  by_stripe_sub:   [stripeSubId]
  by_stripe_cust:  [stripeCustomerId]
  by_status:       [status, currentPeriodEnd]
```

## Webhook Events to Handle

| Stripe Event | Convex Handler Action |
|-------------|----------------------|
| `checkout.session.completed` | 1. Look up workspace by client_reference. 2. Create/update subscription record. 3. Set status = "active" or "trialing". 4. Emit audit event. |
| `invoice.paid` | 1. Look up subscription by stripeSubId. 2. Extend currentPeriodEnd. 3. Clear any past_due flags. 4. Emit audit event. |
| `invoice.payment_failed` | 1. Set status = "past_due". 2. Start 7-day grace period. 3. Send notification via WhatsApp. 4. Send email via Resend. 5. Emit audit event. |
| `customer.subscription.updated` | 1. Update plan, price, status fields. 2. If plan changed: re-evaluate limits. 3. Emit audit event. |
| `customer.subscription.deleted` | 1. Set status = "canceled". 2. Disable agent runs (keep data). 3. Disable connector workers. 4. Emit audit event. |

### Webhook Verification

```
  Stripe POST --> Convex HTTP endpoint (/stripe/webhook)
                       |
                       v
               +-------+--------+
               | Verify webhook |
               | signature with |
               | STRIPE_WEBHOOK |
               | _SECRET        |
               +-------+--------+
                       |
              +--------+--------+
              |                 |
         Valid sig         Invalid sig
              |                 |
              v                 v
       Process event      Return 401
       (mutation)         Log attempt
```

## Plan Enforcement Logic

### Enforcement Points

| Action | Enforcement Check |
|--------|-------------------|
| Create waAccount (connect WhatsApp) | `subscription.status` in `["active", "trialing"]` |
| Add principal to workspace | Count principals < `plan.maxPrincipals` (Founder: 1, Dreamer: 5, Custom: N) |
| Trigger agent run | `status == "active"` OR (`status == "trialing"` AND `now < trialEnd`) OR (`status == "past_due"` AND `now < graceDeadline`) |
| Access dashboard | Always allowed (read-only view of billing status even when inactive) |

### Enforcement Flow

```
  Any gated action
       |
       v
  +----+-----+       +----------+
  | Load sub |------>| Status   |
  | record   |       | check    |
  +----------+       +----+-----+
                          |
            +-------------+-------------+
            |             |             |
         active       trialing      past_due
            |             |             |
            v             v             v
       +----+----+  +----+----+  +-----+------+
       | Check   |  | Check   |  | Within     |
       | plan    |  | trial   |  | grace      |
       | limits  |  | expiry  |  | period?    |
       +----+----+  +----+----+  +-----+------+
            |             |          |       |
         Within        Not yet    Yes       No
         limits        expired      |       |
            |             |         v       v
            v             v      Allow    Block
         Allow         Allow              + notify
```

### Grace Period and Trial Handling

| Scenario | Behavior |
|----------|----------|
| New workspace signup | 14-day free trial starts immediately. No payment method required. All Founder features available during trial. |
| Trial expiring (3 reminders) | Notify at day 10, day 13, and day 14. Via WhatsApp and email. |
| Trial expired | Status -> "unpaid". Agent runs disabled. Dashboard remains accessible (read-only). Data retained for 30 days. |
| Payment failed (active subscription) | Status -> "past_due". 7-day grace period starts. Agent runs continue during grace period. Notify at day 1, day 5, and day 7. |
| Grace period expired | Status -> "unpaid". Agent runs disabled. Connector workers stopped. Data retained; reactivation restores full access. |
| Plan upgrade | Immediate. Prorated credit applied. New limits take effect instantly. |
| Plan downgrade | Takes effect at end of current billing period. If over new plan limits, block new principals but do not remove existing ones. |

## Multi-Currency Handling

Ecqqo supports USD and AED billing. The user's currency preference persists through the subscription lifecycle.

```
  Dashboard currency toggle (landing page)
       |
       v
  User selects plan
       |
       v
  +----+----------+
  | Currency      |
  | preference    |
  | stored in     |
  | localStorage  |
  +----+----------+
       |
       v
  Checkout session created with correct Stripe Price ID
       |
       +---> USD price: price_founder_usd, price_dreamer_usd
       |
       +---> AED price: price_founder_aed, price_dreamer_aed
```

| Plan | USD Price ID | AED Price ID |
|------|-------------|-------------|
| Founder | price_xxxxx_usd | price_xxxxx_aed |
| Dreamer | price_yyyyy_usd | price_yyyyy_aed |
| Custom | Manual invoice | Manual invoice |

### Currency Rules

1. **Selection at checkout.** Currency is locked when the user completes checkout. Stripe does not allow mid-subscription currency changes.
2. **Display currency.** Dashboard always shows the subscription's billing currency, regardless of the display toggle on the landing page.
3. **Custom plan.** Custom plans are invoiced manually. Currency agreed during onboarding.
4. **AED/USD exchange.** Prices are set independently (not calculated from exchange rate). The AED price includes a small premium to account for currency risk: `$199 x 3.67 = 731 AED`, rounded up to `749 AED`.
