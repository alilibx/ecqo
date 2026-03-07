import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy | Ecqqo" },
      { name: "description", content: "How Ecqqo collects, uses, and protects your personal information. Read our privacy policy for our WhatsApp-native executive assistant service." },
      { property: "og:title", content: "Privacy Policy | Ecqqo" },
      { property: "og:description", content: "How Ecqqo collects, uses, and protects your personal information." },
      { property: "og:url", content: "https://ecqqo.com/privacy" },
    ],
    links: [
      { rel: "canonical", href: "https://ecqqo.com/privacy" },
    ],
  }),
});

function PrivacyPage() {
  return (
    <>
      <div className="grain" />
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />

      <header className="topbar scrolled">
        <div className="topbar-inner">
          <a className="brand" href="/"><img src="/logos/logo-icon.png" alt="" className="brand-icon" />Ecqqo</a>
          <nav>
            <a href="/#savings">Savings</a>
            <a href="/#calculator">Calculator</a>
            <a href="/#workflow">Workflow</a>
            <a href="/#pricing">Pricing</a>
            <a href="/#faq">FAQ</a>
          </nav>
          <a className="button mini desktop-only" href="/#calculator">Get Started</a>
        </div>
      </header>

      <main className="legal-page">
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: March 6, 2026</p>

        <section>
          <h2>1. Introduction</h2>
          <p>Ecqqo ("we", "us", "our") operates the website ecqqo.com and provides a WhatsApp-native executive assistant service. This Privacy Policy explains how we collect, use, and protect your personal information.</p>
        </section>

        <section>
          <h2>2. Information We Collect</h2>
          <h3>Information you provide</h3>
          <ul>
            <li><strong>Email address</strong> — when you join our waitlist</li>
            <li><strong>WhatsApp messages</strong> — when you use our service (after launch)</li>
            <li><strong>Calendar and email data</strong> — only with your explicit authorization, to perform scheduling and digest tasks</li>
          </ul>
          <h3>Information collected automatically</h3>
          <ul>
            <li>Basic analytics data (page views, device type, browser)</li>
            <li>IP address (for rate limiting and security)</li>
          </ul>
        </section>

        <section>
          <h2>3. How We Use Your Information</h2>
          <ul>
            <li>To manage your waitlist position and send verification emails</li>
            <li>To provide and improve our executive assistant service</li>
            <li>To communicate product updates and launch notifications</li>
            <li>To prevent abuse and ensure platform security</li>
          </ul>
        </section>

        <section>
          <h2>4. Data Sharing</h2>
          <p>We do not sell your personal information. We may share data with:</p>
          <ul>
            <li><strong>Service providers</strong> — email delivery (Resend), hosting (Vercel), database (Convex), and WhatsApp (Meta Cloud API)</li>
            <li><strong>Legal obligations</strong> — if required by law or to protect our rights</li>
          </ul>
        </section>

        <section>
          <h2>5. Data Security</h2>
          <p>We use industry-standard security measures including encryption in transit (TLS), secure database storage, and access controls. No system is 100% secure, but we take reasonable steps to protect your data.</p>
        </section>

        <section>
          <h2>6. Data Retention</h2>
          <p>We retain your information for as long as your account is active or as needed to provide our services. Waitlist data is retained until launch or until you request deletion.</p>
        </section>

        <section>
          <h2>7. Your Rights</h2>
          <p>You may request to access, correct, or delete your personal information at any time by contacting us at <a href="mailto:privacy@ecqqo.com">privacy@ecqqo.com</a>.</p>
        </section>

        <section>
          <h2>8. Changes</h2>
          <p>We may update this policy from time to time. We will notify you of significant changes via email or through our website.</p>
        </section>

        <section>
          <h2>9. Contact</h2>
          <p>For questions about this Privacy Policy, contact us at <a href="mailto:privacy@ecqqo.com">privacy@ecqqo.com</a>.</p>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-top">
            <div className="footer-brand">
              <a className="brand" href="/"><img src="/logos/logo-icon.png" alt="" className="brand-icon" />Ecqqo</a>
              <p>WhatsApp-native executive assistant automation for high-net-worth operators, founders, and family-office teams.</p>
            </div>
            <div className="footer-links">
              <div className="footer-col">
                <h4>Product</h4>
                <a href="/#savings">Savings</a>
                <a href="/#calculator">Calculator</a>
                <a href="/#workflow">Workflow</a>
                <a href="/#pricing">Pricing</a>
              </div>
              <div className="footer-col">
                <h4>Company</h4>
                <a href="/#faq">FAQ</a>
                <a href="/privacy">Privacy Policy</a>
                <a href="/terms">Terms of Service</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2026 Ecqqo. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
