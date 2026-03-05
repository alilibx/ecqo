import { jsxs, jsx } from "react/jsx-runtime";
import { createRootRouteWithContext, HeadContent, Outlet, Scripts, createFileRoute, lazyRouteComponent, createRouter } from "@tanstack/react-router";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { ConvexProvider } from "convex/react";
import { routerWithQueryClient } from "@tanstack/react-router-with-query";
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Ecqo",
      url: "https://www.ecqo.ai/",
      logo: "https://www.ecqo.ai/logo.png"
    },
    {
      "@type": "SoftwareApplication",
      name: "Ecqo",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: [
        {
          "@type": "Offer",
          name: "Founder",
          price: "199",
          priceCurrency: "USD"
        },
        {
          "@type": "Offer",
          name: "Dreamer",
          price: "399",
          priceCurrency: "USD"
        }
      ],
      description: "A WhatsApp-native executive assistant that handles scheduling, calendar checks, email digests, reminders, and calendar execution."
    }
  ]
};
const Route$1 = createRootRouteWithContext()({
  component: RootComponent,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      {
        title: "Ecqo | Empower your Human Assistant"
      },
      {
        name: "description",
        content: "Ecqo is a WhatsApp-native executive assistant for high-net-worth operators. Replace EA/VA workflows with automated scheduling and approvals."
      },
      {
        name: "keywords",
        content: "WhatsApp executive assistant, replace virtual assistant, executive assistant automation, HNWI productivity"
      },
      { name: "robots", content: "index,follow,max-image-preview:large" },
      { property: "og:type", content: "website" },
      {
        property: "og:title",
        content: "Ecqo | Empower your Human Assistant"
      },
      {
        property: "og:description",
        content: "From WhatsApp chat to confirmed calendar actions. Built for principals, founders, and family-office teams."
      },
      { property: "og:url", content: "https://www.ecqo.ai/" },
      { property: "og:image", content: "https://www.ecqo.ai/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Ecqo | Empower" },
      {
        name: "twitter:description",
        content: "Global cost-efficient executive assistant automation, directly inside WhatsApp."
      },
      {
        name: "twitter:image",
        content: "https://www.ecqo.ai/og-image.png"
      }
    ],
    links: [
      { rel: "canonical", href: "https://www.ecqo.ai/" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous"
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Archivo+Black&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500&display=swap"
      }
    ]
  })
});
function RootComponent() {
  return /* @__PURE__ */ jsxs("html", { lang: "en", children: [
    /* @__PURE__ */ jsxs("head", { children: [
      /* @__PURE__ */ jsx(HeadContent, {}),
      /* @__PURE__ */ jsx(
        "script",
        {
          type: "application/ld+json",
          dangerouslySetInnerHTML: { __html: JSON.stringify(jsonLd) }
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("body", { children: [
      /* @__PURE__ */ jsx(Outlet, {}),
      /* @__PURE__ */ jsx(Scripts, {})
    ] })
  ] });
}
const $$splitComponentImporter = () => import("./index-CTTSPqxR.js");
const Route = createFileRoute("/")({
  component: lazyRouteComponent($$splitComponentImporter, "component")
});
const IndexRoute = Route.update({
  id: "/",
  path: "/",
  getParentRoute: () => Route$1
});
const rootRouteChildren = {
  IndexRoute
};
const routeTree = Route$1._addFileChildren(rootRouteChildren)._addFileTypes();
function getRouter() {
  const CONVEX_URL = "https://patient-malamute-473.eu-west-1.convex.cloud";
  const convexQueryClient = new ConvexQueryClient(CONVEX_URL);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn()
      }
    }
  });
  convexQueryClient.connect(queryClient);
  const router = routerWithQueryClient(
    createRouter({
      routeTree,
      defaultPreload: "intent",
      context: { queryClient },
      scrollRestoration: true,
      Wrap: ({ children }) => /* @__PURE__ */ jsx(ConvexProvider, { client: convexQueryClient.convexClient, children })
    }),
    queryClient
  );
  return router;
}
export {
  getRouter
};
