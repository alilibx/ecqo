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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
        {status === "verifying" && (
          <p style={{ fontSize: 18, color: "#8a7e6d" }}>Verifying your email...</p>
        )}

        {status === "success" && (
          <>
            <h1 style={{ fontFamily: "'Archivo Black', Impact, sans-serif", fontSize: 32, margin: "0 0 8px", color: "#1a1612" }}>You're in!</h1>
            <p style={{ fontFamily: "'Archivo Black', Impact, sans-serif", fontSize: 64, color: "#0d7a6a", margin: "16px 0 4px" }}>#{position}</p>
            <p style={{ color: "#8a7e6d", fontSize: 16, margin: "0 0 32px" }}>in the waitlist queue</p>
            <p style={{ color: "#8a7e6d", fontSize: 14, lineHeight: 1.6 }}>
              Check your email for a confirmation with your position.<br />
              We'll notify you when early access opens.
            </p>
            <button
              className="button"
              style={{ marginTop: 24 }}
              onClick={() => navigate({ to: "/" })}
            >
              Back to Ecqo
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <h1 style={{ fontFamily: "'Archivo Black', Impact, sans-serif", fontSize: 28, margin: "0 0 12px", color: "#1a1612" }}>Verification failed</h1>
            <p style={{ color: "#8a7e6d", fontSize: 16, margin: "0 0 24px" }}>{errorMsg}</p>
            <button
              className="button"
              onClick={() => navigate({ to: "/" })}
            >
              Back to Ecqo
            </button>
          </>
        )}
      </div>
    </div>
  );
}
