const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string;

// Convex HTTP actions URL is the deployment URL with the path appended
const httpUrl = CONVEX_URL.replace(".cloud", ".site");

export async function requestVerification(email: string) {
  const res = await fetch(`${httpUrl}/waitlist/request-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<
    { status: "code_sent" } | { status: "already_verified"; position: number }
  >;
}

export async function verify(email: string, token: string) {
  const res = await fetch(`${httpUrl}/waitlist/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, token }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Verification failed: ${res.status}`);
  }
  return res.json() as Promise<{ position: number; alreadyVerified: boolean }>;
}

export async function getStatus(email: string) {
  const res = await fetch(
    `${httpUrl}/waitlist/status?email=${encodeURIComponent(email)}`,
  );
  if (!res.ok) return null;
  return res.json() as Promise<{
    found: boolean;
    verified: boolean;
    position: number;
  }>;
}
