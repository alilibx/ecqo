import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useAction } from "convex/react";
import { useState, useCallback } from "react";
import { api } from "../../../convex/_generated/api";
import { useDashboard } from "../../lib/dashboard-context";

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsPage,
});

const PLANS = [
  {
    id: "founder" as const,
    name: "Founder",
    usd: 199,
    aed: 749,
    principals: 1,
    features: [
      "Unlimited scheduling",
      "Approval workflow",
      "Calendar + Reminders",
      "WhatsApp sync",
      "Memory system",
      "Email support",
    ],
  },
  {
    id: "dreamer" as const,
    name: "Dreamer",
    usd: 399,
    aed: 1499,
    principals: 5,
    features: [
      "Everything in Founder",
      "Priority rules",
      "Shared operator view",
      "Email digest",
      "Meeting briefs",
      "Priority support",
    ],
  },
];

function SettingsPage() {
  const { workspaceId, role } = useDashboard();
  const subscription = useQuery(api.billing.getSubscription, { workspaceId });
  const createCheckout = useAction(api.billing.createCheckoutSession);
  const createPortal = useAction(api.billing.createPortalSession);

  const [currency, setCurrency] = useState<"usd" | "aed">("usd");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = useCallback(
    async (plan: "founder" | "dreamer") => {
      setLoading(plan);
      setError(null);
      try {
        const result = await createCheckout({
          workspaceId,
          plan,
          currency,
          successUrl: `${window.location.origin}/dashboard/settings?success=1`,
          cancelUrl: `${window.location.origin}/dashboard/settings`,
        });
        if (result.url) {
          window.location.href = result.url;
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to start checkout",
        );
      } finally {
        setLoading(null);
      }
    },
    [createCheckout, workspaceId, currency],
  );

  const handleManageBilling = useCallback(async () => {
    setLoading("portal");
    setError(null);
    try {
      const result = await createPortal({
        workspaceId,
        returnUrl: `${window.location.origin}/dashboard/settings`,
      });
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to open billing portal",
      );
    } finally {
      setLoading(null);
    }
  }, [createPortal, workspaceId]);

  // Show current subscription status if active
  if (subscription) {
    return (
      <div className="settings-page">
        <h1 className="settings-title">Billing</h1>

        <div className="settings-card">
          <div className="settings-card-header">
            <h2 className="settings-card-title">Current Plan</h2>
            <StatusBadge status={subscription.status} />
          </div>

          <div className="settings-detail-grid">
            <div className="settings-detail">
              <span className="settings-detail-label">Plan</span>
              <span className="settings-detail-value">
                {subscription.plan.charAt(0).toUpperCase() +
                  subscription.plan.slice(1)}
              </span>
            </div>
            <div className="settings-detail">
              <span className="settings-detail-label">Currency</span>
              <span className="settings-detail-value">
                {subscription.currency.toUpperCase()}
              </span>
            </div>
            <div className="settings-detail">
              <span className="settings-detail-label">Current period ends</span>
              <span className="settings-detail-value">
                {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </span>
            </div>
            {subscription.trialEnd && (
              <div className="settings-detail">
                <span className="settings-detail-label">Trial ends</span>
                <span className="settings-detail-value">
                  {new Date(subscription.trialEnd).toLocaleDateString()}
                </span>
              </div>
            )}
            {subscription.cancelAtPeriodEnd && (
              <div className="settings-detail">
                <span className="settings-detail-label">Cancellation</span>
                <span className="settings-detail-value settings-detail-value--warn">
                  Cancels at period end
                </span>
              </div>
            )}
          </div>

          {role === "owner" && (
            <button
              className="settings-btn"
              onClick={handleManageBilling}
              disabled={loading === "portal"}
            >
              {loading === "portal" ? "Opening..." : "Manage Billing"}
            </button>
          )}
        </div>

        {error && <p className="settings-error">{error}</p>}
      </div>
    );
  }

  // No subscription — show plan selection
  return (
    <div className="settings-page">
      <h1 className="settings-title">Choose a Plan</h1>
      <p className="settings-subtitle">
        Start with a 14-day free trial. No credit card required to begin.
      </p>

      <div className="settings-currency-toggle">
        <button
          className={`settings-currency-btn ${currency === "usd" ? "settings-currency-btn--active" : ""}`}
          onClick={() => setCurrency("usd")}
        >
          USD
        </button>
        <button
          className={`settings-currency-btn ${currency === "aed" ? "settings-currency-btn--active" : ""}`}
          onClick={() => setCurrency("aed")}
        >
          AED
        </button>
      </div>

      <div className="settings-plan-grid">
        {PLANS.map((plan) => (
          <div key={plan.id} className="settings-plan-card">
            <h2 className="settings-plan-name">{plan.name}</h2>
            <div className="settings-plan-price">
              <span className="settings-plan-amount">
                {currency === "usd" ? `$${plan.usd}` : `${plan.aed} AED`}
              </span>
              <span className="settings-plan-period">/month</span>
            </div>
            <p className="settings-plan-principals">
              {plan.principals === 1
                ? "1 principal"
                : `Up to ${plan.principals} principals`}
            </p>
            <ul className="settings-plan-features">
              {plan.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            {role === "owner" && (
              <button
                className="settings-btn settings-btn--primary"
                onClick={() => handleSubscribe(plan.id)}
                disabled={loading !== null}
              >
                {loading === plan.id ? "Redirecting..." : "Start Free Trial"}
              </button>
            )}
          </div>
        ))}
      </div>

      {error && <p className="settings-error">{error}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    active: "settings-badge--active",
    trialing: "settings-badge--trial",
    past_due: "settings-badge--warn",
    canceled: "settings-badge--danger",
    unpaid: "settings-badge--danger",
  };

  return (
    <span className={`settings-badge ${colorMap[status] ?? ""}`}>
      {status.replace("_", " ")}
    </span>
  );
}
