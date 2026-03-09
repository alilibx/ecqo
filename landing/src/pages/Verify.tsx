import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { verify as verifyApi, getStatus } from "../api";

export function Verify() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const email = searchParams.get("email") || "";
  const token = searchParams.get("token") || "";

  // Poll status on mount
  const [status, setStatus] = useState<{ found: boolean; verified: boolean; position: number } | null | undefined>(undefined);

  useEffect(() => {
    if (!email) {
      setStatus(null);
      return;
    }
    getStatus(email).then((result) => setStatus(result ?? null));
  }, [email]);

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

    verifyApi(email, token)
      .then(() => {
        setVerifyState("done");
      })
      .catch(() => {
        setVerifyState("error");
        setErrorMsg("This link is invalid or has expired. Please request a new one.");
      });
  }, [email, token, alreadyVerified, status]);

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
        <a className="brand" href="/"><img src="/logos/logo-icon.png" alt="" className="brand-icon" />Ecqqo</a>
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
            <button className="button" onClick={() => navigate("/")}>
              Back to Ecqqo
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
            <button className="button" onClick={() => navigate("/")}>
              Back to Ecqqo
            </button>
          </div>
        )}
      </div>
    </>
  );
}
