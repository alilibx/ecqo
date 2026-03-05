import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
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
  const verify = useMutation(api.waitlist.verify);
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [position, setPosition] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!email || !token) {
      setStatus("error");
      setErrorMsg("Invalid verification link.");
      return;
    }

    let cancelled = false;

    verify({ email, token })
      .then((result) => {
        if (cancelled) return;
        setPosition(result.position);
        setStatus("success");
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Verification failed.");
      });

    return () => { cancelled = true; };
  }, [email, token, verify]);

  return (
    <>
      <div className="grain" />
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />

      <div className="verify-page">
        <a className="brand" href="/">Ecqo</a>
        <p className="verify-eyebrow">WhatsApp-Native Executive Assistant</p>

        {status === "verifying" && (
          <div className="verify-card">
            <div className="verify-spinner" />
            <p className="verify-msg">Verifying your email...</p>
          </div>
        )}

        {status === "success" && (
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

        {status === "error" && (
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
