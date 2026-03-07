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
    ],
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
        { icon: "github", link: "https://github.com/your-org/ecqqo" },
      ],
      search: { provider: "local" },
      outline: { level: [2, 3] },
    },
    mermaid: {
      theme: "neutral",
    },
  })
);
