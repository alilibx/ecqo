import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import "../styles.css";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Ecqqo",
      url: "https://www.ecqqo.com/",
      logo: "https://www.ecqqo.com/logo.png",
    },
    {
      "@type": "SoftwareApplication",
      name: "Ecqqo",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: [
        {
          "@type": "Offer",
          name: "Founder",
          price: "199",
          priceCurrency: "USD",
        },
        {
          "@type": "Offer",
          name: "Dreamer",
          price: "399",
          priceCurrency: "USD",
        },
      ],
      description:
        "A WhatsApp-native executive assistant that handles scheduling, calendar checks, email digests, reminders, and calendar execution.",
    },
  ],
};

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  component: RootComponent,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      {
        title: "Ecqqo | Empower your Human Assistant",
      },
      {
        name: "description",
        content:
          "Ecqqo is a WhatsApp-native executive assistant for high-net-worth operators. Replace EA/VA workflows with automated scheduling and approvals.",
      },
      {
        name: "keywords",
        content:
          "WhatsApp executive assistant, replace virtual assistant, executive assistant automation, HNWI productivity",
      },
      { name: "robots", content: "index,follow,max-image-preview:large" },
      { name: "msapplication-TileColor", content: "#faf7f0" },
      { name: "msapplication-TileImage", content: "/favicons/ms-icon-144x144.png" },
      { name: "msapplication-config", content: "/favicons/browserconfig.xml" },
      { name: "theme-color", content: "#faf7f0" },
      { property: "og:type", content: "website" },
      {
        property: "og:title",
        content: "Ecqqo | Empower your Human Assistant",
      },
      {
        property: "og:description",
        content:
          "From WhatsApp chat to confirmed calendar actions. Built for principals, founders, and family-office teams.",
      },
      { property: "og:url", content: "https://www.ecqqo.com/" },
      { property: "og:image", content: "https://www.ecqqo.com/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Ecqqo | Empower" },
      {
        name: "twitter:description",
        content:
          "Global cost-efficient executive assistant automation, directly inside WhatsApp.",
      },
      {
        name: "twitter:image",
        content: "https://www.ecqqo.com/og-image.png",
      },
    ],
    links: [
      { rel: "canonical", href: "https://www.ecqqo.com/" },
      // Favicons
      { rel: "icon", type: "image/x-icon", href: "/favicons/favicon.ico" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicons/favicon-16x16.png" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicons/favicon-32x32.png" },
      { rel: "icon", type: "image/png", sizes: "96x96", href: "/favicons/favicon-96x96.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/favicons/android-icon-192x192.png" },
      // Apple touch icons
      { rel: "apple-touch-icon", sizes: "57x57", href: "/favicons/apple-icon-57x57.png" },
      { rel: "apple-touch-icon", sizes: "60x60", href: "/favicons/apple-icon-60x60.png" },
      { rel: "apple-touch-icon", sizes: "72x72", href: "/favicons/apple-icon-72x72.png" },
      { rel: "apple-touch-icon", sizes: "76x76", href: "/favicons/apple-icon-76x76.png" },
      { rel: "apple-touch-icon", sizes: "114x114", href: "/favicons/apple-icon-114x114.png" },
      { rel: "apple-touch-icon", sizes: "120x120", href: "/favicons/apple-icon-120x120.png" },
      { rel: "apple-touch-icon", sizes: "144x144", href: "/favicons/apple-icon-144x144.png" },
      { rel: "apple-touch-icon", sizes: "152x152", href: "/favicons/apple-icon-152x152.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/favicons/apple-icon-180x180.png" },
      // Manifest
      { rel: "manifest", href: "/favicons/manifest.json" },
      // Fonts
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Archivo+Black&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
});

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
