import type { QueryClient } from "@tanstack/react-query";
import type { ConvexReactClient } from "convex/react";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { auth } from "@clerk/tanstack-react-start/server";
import "../styles.css";

const fetchClerkAuth = createServerFn({ method: "GET" }).handler(async () => {
  const authObj = await auth();
  const token = await authObj.getToken({ template: "convex" });
  return { userId: authObj.userId, token };
});

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  convexClient: ConvexReactClient;
  convexQueryClient: ConvexQueryClient;
}>()({
  beforeLoad: async ({ context }) => {
    const auth = await fetchClerkAuth();
    if (auth.token) {
      context.convexQueryClient.serverHttpClient?.setAuth(auth.token);
    }
    return { userId: auth.userId };
  },
  component: RootComponent,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      { title: "Ecqqo | Dashboard" },
      { name: "robots", content: "noindex" },
      { name: "theme-color", content: "#faf7f0" },
    ],
    links: [
      { rel: "icon", type: "image/x-icon", href: "/favicons/favicon.ico" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap",
      },
    ],
  }),
});

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('theme')||'device';var d=t==='device'?(window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):t;document.documentElement.setAttribute('data-theme',d)})()` }} />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
