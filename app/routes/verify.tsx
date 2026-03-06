import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/verify")({
  validateSearch: (search: Record<string, unknown>) => ({
    email: (search.email as string) || "",
    token: (search.token as string) || "",
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const { email, token } = Route.useSearch();
  const navigate = useNavigate();

  // Cached query — free for repeat visits, reactive updates
  const status = useQuery(api.waitlist.getStatus, email ? { email } : "skip");

  const verify = useMutation(api.waitlist.verify);
  const [verifyState, setVerifyState] = useState<"idle" | "verifying" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const attempted = useRef(false);

  // If already verified via query, skip the mutation entirely
  const alreadyVerified = status?.verified === true;
  const position = status?.position ?? 0;

  useEffect(() => {
    // Don't call mutation if: no params, already verified, already attempted, or query still loading
    if (!email || !token || alreadyVerified || attempted.current || status === undefined) return;

    attempted.current = true;
    setVerifyState("verifying");

    verify({ email, token })
      .then(() => {
        setVerifyState("done");
      })
      .catch(() => {
        setVerifyState("error");
        setErrorMsg("This link is invalid or has expired. Please request a new one.");
      });
  }, [email, token, alreadyVerified, status, verify]);

  // Determine what to show
  const showSuccess = alreadyVerified || verifyState === "done";
  const showError = !showSuccess && verifyState === "error";
  const showLoading = !showSuccess && !showError;

  return (
    <>
      <div className="grain" />
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />

      <div className="verify-page">
        <a className="brand" href="/">Ecqo</a>
        <p className="verify-eyebrow">WhatsApp-Native Executive Assistant</p>

        {showLoading && (
          <div className="verify-card">
            <div className="verify-spinner" />
            <p className="verify-msg">Verifying your email...</p>
          </div>
        )}

        {showSuccess && (
          <div className="verify-card">
            <svg className="verify-check" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12l3 3 5-5" />
            </svg>
            <h1 className="verify-title">You're in!</h1>
            <p className="verify-position">#{position}</p>
            <p className="verify-subtitle">in the waitlist queue</p>
            <div className="verify-launch">
              <strong>Estimated launch:</strong> Q2 2026
            </div>
            <p className="verify-msg">
              Check your email for a confirmation.<br />
              We'll notify you when early access opens.
            </p>
            <button className="button" onClick={() => navigate({ to: "/" })}>
              Back to Ecqo
            </button>
          </div>
        )}

        {showError && (
          <div className="verify-card">
            <svg className="verify-x" viewBox="0 0 24 24" fill="none" stroke="var(--signal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M15 9l-6 6M9 9l6 6" />
            </svg>
            <h1 className="verify-title">Verification failed</h1>
            <p className="verify-msg">{errorMsg}</p>
            <button className="button" onClick={() => navigate({ to: "/" })}>
              Back to Ecqo
            </button>
          </div>
        )}
      </div>
    </>
  );
}
