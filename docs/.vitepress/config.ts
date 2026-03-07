import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

export default withMermaid(
  defineConfig({
    title: "Ecqqo",
    description: "WhatsApp-native executive assistant - Architecture & Plan",
    head: [
      [
        "link",
        {
          rel: "icon",
          type: "image/png",
          href: "/logo.png",
        },
      ],
      [
        "link",
        {
          rel: "preconnect",
          href: "https://fonts.googleapis.com",
        },
      ],
      [
        "link",
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "",
        },
      ],
      [
        "link",
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=JetBrains+Mono:wght@400;500;600&display=swap",
        },
      ],
      [
        "link",
        {
          rel: "stylesheet",
          href: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css",
          integrity:
            "sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==",
          crossorigin: "anonymous",
          referrerpolicy: "no-referrer",
        },
      ],
      [
        "script",
        {
          src: "https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js",
        },
      ],
    ],
    vite: {
      vue: {
        template: {
          compilerOptions: {
            isCustomElement: (tag) => tag === "iconify-icon",
          },
        },
      },
    },
    themeConfig: {
      logo: {
        light: "/logo.png",
        dark: "/logo-light.png",
      },
      siteTitle: "Ecqqo Docs",
      nav: [
        { text: "Architecture", link: "/architecture/overview" },
        { text: "Flows", link: "/flows/connect-whatsapp" },
        { text: "Data Model", link: "/data-model/schema" },
        { text: "Plan", link: "/plan/milestones" },
      ],
      sidebar: [
        {
          text: "Overview",
          items: [{ text: "Introduction", link: "/" }],
        },
        {
          text: "Architecture",
          collapsed: false,
          items: [
            { text: "System Overview", link: "/architecture/overview" },
            { text: "Architectural Planes", link: "/architecture/planes" },
            { text: "Deployment & Infra", link: "/architecture/deployment" },
            { text: "Data Flow", link: "/architecture/data-flow" },
          ],
        },
        {
          text: "Flows",
          collapsed: false,
          items: [
            { text: "Connect WhatsApp", link: "/flows/connect-whatsapp" },
            {
              text: "User Identification",
              link: "/flows/user-identification",
            },
            { text: "Sync & Ingestion", link: "/flows/sync-ingestion" },
            { text: "Agent Runtime", link: "/flows/agent-runtime" },
            { text: "Memory Pipeline", link: "/flows/memory-pipeline" },
          ],
        },
        {
          text: "Agents & AI",
          collapsed: false,
          items: [
            { text: "Agent Architecture", link: "/agents/overview" },
            { text: "AI Providers", link: "/agents/ai-providers" },
          ],
        },
        {
          text: "Data Model",
          collapsed: false,
          items: [
            { text: "Schema & ERD", link: "/data-model/schema" },
            { text: "API Contracts", link: "/data-model/contracts" },
          ],
        },
        {
          text: "Dashboard",
          collapsed: false,
          items: [
            {
              text: "Information Architecture",
              link: "/dashboard/information-architecture",
            },
          ],
        },
        {
          text: "Plan",
          collapsed: false,
          items: [
            { text: "Milestones & Timeline", link: "/plan/milestones" },
            { text: "Epics & Issues", link: "/plan/epics" },
            { text: "Dependency Graph", link: "/plan/dependencies" },
            { text: "Cost Estimation", link: "/plan/cost-estimation" },
            { text: "Billing (Stripe)", link: "/plan/billing" },
          ],
        },
        {
          text: "Security",
          collapsed: false,
          items: [{ text: "Security Posture", link: "/security/posture" }],
        },
        {
          text: "Decisions",
          collapsed: false,
          items: [{ text: "ADR Log", link: "/decisions/adr-log" }],
        },
      ],
      socialLinks: [
        { icon: "github", link: "http://github.com/alilibx/ecqo" },
      ],
      search: { provider: "local" },
      outline: { level: [2, 3] },
    },
    mermaid: {
      theme: "base",
      flowchart: {
        htmlLabels: true,
        curve: "linear",
        wrappingWidth: 300,
        nodeSpacing: 60,
        rankSpacing: 70,
        padding: 20,
        diagramPadding: 16,
      },
      sequence: {
        diagramMarginX: 20,
        diagramMarginY: 20,
        actorMargin: 80,
        messageMargin: 40,
      },
      themeVariables: {
        // Primary colors - Ecqqo teal accent
        primaryColor: "#e8f5f2",
        primaryTextColor: "#094f44",
        primaryBorderColor: "#0d7a6a",
        // Secondary - signal red-orange
        secondaryColor: "#fff0ec",
        secondaryTextColor: "#1a1612",
        secondaryBorderColor: "#e04b2c",
        // Tertiary
        tertiaryColor: "#fef9f2",
        tertiaryTextColor: "#3d362d",
        tertiaryBorderColor: "#e8e0d0",
        // Lines and text
        lineColor: "#8a7e6d",
        textColor: "#1a1612",
        // Notes
        noteBkgColor: "#fef9f2",
        noteTextColor: "#3d362d",
        noteBorderColor: "#e8e0d0",
        // Sequence diagrams
        actorBkg: "#e8f5f2",
        actorBorder: "#0d7a6a",
        actorTextColor: "#094f44",
        actorLineColor: "#8a7e6d",
        signalColor: "#1a1612",
        signalTextColor: "#1a1612",
        activationBkgColor: "#e8f5f2",
        activationBorderColor: "#0d7a6a",
        sequenceNumberColor: "#ffffff",
        // State diagrams
        labelColor: "#1a1612",
        altBackground: "#fef9f2",
        // Flowchart
        nodeBkg: "#e8f5f2",
        nodeBorder: "#0d7a6a",
        clusterBkg: "#faf7f0",
        clusterBorder: "#e8e0d0",
        defaultLinkColor: "#8a7e6d",
        titleColor: "#1a1612",
        // Fonts
        fontFamily: "DM Sans, Inter, sans-serif",
        fontSize: "14px",
      },
    },
    mermaidPlugin: {
      class: "mermaid",
    },
  })
);
