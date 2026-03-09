import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

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

export default http;
