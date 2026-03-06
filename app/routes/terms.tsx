import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <>
      <div className="grain" />
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />

      <header className="topbar scrolled">
        <div className="topbar-inner">
          <a className="brand" href="/">Ecqo</a>
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
        <h1>Terms of Service</h1>
        <p className="legal-updated">Last updated: March 6, 2026</p>

        <section>
          <h2>1. Acceptance of Terms</h2>
          <p>By accessing or using Ecqo's website and services, you agree to be bound by these Terms of Service. If you do not agree, do not use our services.</p>
        </section>

        <section>
          <h2>2. Service Description</h2>
          <p>Ecqo provides a WhatsApp-native executive assistant that automates scheduling, calendar management, email digests, reminders, and related productivity tasks. The service is currently in pre-launch and available via waitlist only.</p>
        </section>

        <section>
          <h2>3. Waitlist</h2>
          <p>Joining the waitlist does not guarantee access to the service. Waitlist positions are assigned upon email verification. We reserve the right to modify waitlist order, timing, and availability at our discretion.</p>
        </section>

        <section>
          <h2>4. Account Responsibilities</h2>
          <ul>
            <li>You must provide accurate information when signing up</li>
            <li>You are responsible for maintaining the security of your account</li>
            <li>You may not use the service for any unlawful purpose</li>
            <li>You may not attempt to abuse, manipulate, or circumvent our systems (including rate limits)</li>
          </ul>
        </section>

        <section>
          <h2>5. Intellectual Property</h2>
          <p>All content, branding, and technology on ecqo.ai are owned by Ecqo. You may not copy, modify, distribute, or reverse-engineer any part of our service without written permission.</p>
        </section>

        <section>
          <h2>6. Third-Party Services</h2>
          <p>Ecqo integrates with third-party services including WhatsApp (Meta), Google Calendar, and email providers. Your use of these integrations is also subject to their respective terms and policies.</p>
        </section>

        <section>
          <h2>7. Limitation of Liability</h2>
          <p>Ecqo is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the service. Our total liability shall not exceed the amount you paid us in the preceding 12 months.</p>
        </section>

        <section>
          <h2>8. Termination</h2>
          <p>We may suspend or terminate your access to the service at any time, with or without cause. You may stop using the service and request data deletion at any time.</p>
        </section>

        <section>
          <h2>9. Changes</h2>
          <p>We may update these terms from time to time. Continued use of the service after changes constitutes acceptance of the new terms.</p>
        </section>

        <section>
          <h2>10. Governing Law</h2>
          <p>These terms are governed by the laws of the United Arab Emirates. Any disputes shall be resolved in the courts of Dubai, UAE.</p>
        </section>

        <section>
          <h2>11. Contact</h2>
          <p>For questions about these Terms of Service, contact us at <a href="mailto:legal@ecqo.ai">legal@ecqo.ai</a>.</p>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-top">
            <div className="footer-brand">
              <a className="brand" href="/">Ecqo</a>
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
            <p>&copy; 2026 Ecqo. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
