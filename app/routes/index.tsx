import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/")({
  component: Home,
});

/* ── Constants ──────────────────────────────── */

const PHRASES = [
  "Human Assistant",
  "Entire Workflow",
  "Morning Routine",
  "Creative Energy",
];

const PLANS = [
  { name: "Founder", aed: 749, usd: 199 },
  { name: "Dreamer", aed: 1499, usd: 399 },
];

const PRESETS = [
  { label: "Use midpoint", aed: 8799, usd: 2400 },
  { label: "Use average", aed: 21999, usd: 5945 },
];

const CHAT_MESSAGES: {
  type: "incoming" | "outgoing";
  tag?: string;
  tagClass?: string;
  html: string;
  time: string;
}[] = [
  { type: "incoming", html: "Can we do lunch tomorrow at noon?", time: "10:42 AM" },
  { type: "outgoing", tag: "Scheduling", html: "Lunch &mdash; Tomorrow, 12:00 PM<br/>You + Sarah. <strong>Approve?</strong>", time: "10:42 AM" },
  { type: "incoming", html: "Confirmed", time: "10:43 AM" },
  { type: "outgoing", tag: "Synced", tagClass: "success-tag", html: "Event created &amp; synced to calendar", time: "10:43 AM" },
  { type: "incoming", html: "What's on my calendar tomorrow?", time: "10:44 AM" },
  { type: "outgoing", tag: "Calendar", html: "<strong>9 AM</strong> Standup<br/><strong>12 PM</strong> Lunch w/ Sarah<br/><strong>3 PM</strong> Investor call", time: "10:44 AM" },
  { type: "incoming", html: "Summarize my unread emails", time: "10:45 AM" },
  { type: "outgoing", tag: "Email", html: "<strong>12 unread</strong> &mdash; key ones:<br/>1. Legal &mdash; NDA ready<br/>2. David &mdash; Q1 deck<br/>3. AWS &mdash; $4,320 due", time: "10:45 AM" },
  { type: "incoming", html: "Remind me to call investor at 5pm", time: "10:46 AM" },
  { type: "outgoing", tag: "Reminder set", tagClass: "success-tag", html: "I'll ping you at 4:55 PM", time: "10:46 AM" },
  { type: "incoming", html: "Add flight BA 117 LHR&ndash;JFK Friday", time: "10:47 AM" },
  { type: "outgoing", tag: "Travel", html: "BA 117 Fri &mdash; LHR 09:30 &rarr; JFK 12:25<br/><strong>Add to calendar?</strong>", time: "10:47 AM" },
  { type: "incoming", html: "Yes, block the whole day", time: "10:48 AM" },
  { type: "outgoing", tag: "Synced", tagClass: "success-tag", html: "Flight added. Friday blocked.", time: "10:48 AM" },
];

/* ── Helpers ─────────────────────────────────── */

function fmt(value: number, currency: string) {
  const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
  return currency === "AED" ? `AED ${num}` : `$${num}`;
}

function price(aed: number, usd: number, currency: string) {
  return currency === "AED" ? `AED ${aed.toLocaleString("en-US")}` : `$${usd.toLocaleString("en-US")}`;
}

/* ── Component ──────────────────────────────── */

function Home() {
  const [currency, setCurrency] = useState("AED");
  const [currentCost, setCurrentCost] = useState(8799);
  const [selectedPlan, setSelectedPlan] = useState(0);
  const [burgerOpen, setBurgerOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [waitlistStep, setWaitlistStep] = useState<"email" | "code" | "done">("email");
  const [waitlistStatus, setWaitlistStatus] = useState("");
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);

  const requestVerification = useMutation(api.waitlist.requestVerification);
  const verifyCode = useMutation(api.waitlist.verify);

  const planCost = currency === "AED" ? PLANS[selectedPlan].aed : PLANS[selectedPlan].usd;
  const monthlySavings = Math.max(0, currentCost - planCost);
  const annualSavings = monthlySavings * 12;
  const savingsRate = currentCost > 0 ? ((monthlySavings / currentCost) * 100).toFixed(1) : "0.0";

  const switchCurrency = useCallback(
    (next: string) => {
      if (next === currency) return;
      setCurrentCost((prev) =>
        next === "AED" ? Math.round(prev * 3.67) : Math.round(prev / 3.67),
      );
      setCurrency(next);
    },
    [currency],
  );

  const closeBurger = useCallback(() => setBurgerOpen(false), []);

  async function handleRequestCode(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setWaitlistStatus("Please enter a valid email.");
      return;
    }
    setWaitlistSubmitting(true);
    setWaitlistStatus("");
    try {
      const result = await requestVerification({ email: email.trim() });
      if (result.status === "already_verified") {
        setWaitlistStatus(`You're already verified at position #${result.position}.`);
        setWaitlistStep("done");
      } else {
        setWaitlistStatus("Check your email for a 6-digit verification code.");
        setWaitlistStep("code");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setWaitlistStatus(msg);
    } finally {
      setWaitlistSubmitting(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    if (!verificationCode.trim()) {
      setWaitlistStatus("Please enter the 6-digit code.");
      return;
    }
    setWaitlistSubmitting(true);
    setWaitlistStatus("");
    try {
      const result = await verifyCode({ email: email.trim(), code: verificationCode.trim() });
      if (result.alreadyVerified) {
        setWaitlistStatus(`You're already verified at position #${result.position}.`);
      } else {
        setWaitlistStatus(
          `You're #${result.position} on the waitlist! Check your email for confirmation.`,
        );
      }
      setWaitlistStep("done");
      setEmail("");
      setVerificationCode("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid code. Please try again.";
      setWaitlistStatus(msg);
    } finally {
      setWaitlistSubmitting(false);
    }
  }

  async function copyReferralLink() {
    const link = "https://www.ecqo.ai/?ref=private-network";
    try {
      await navigator.clipboard.writeText(link);
      document.getElementById("viral-status")!.textContent = "Referral link copied.";
    } catch {
      document.getElementById("viral-status")!.textContent = `Copy this link: ${link}`;
    }
  }

  /* ── Client-only animations ───────────────── */

  useEffect(() => {
    // Scroll reveal
    const reveals = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -30px 0px" },
    );
    reveals.forEach((el) => observer.observe(el));

    // Header scroll effect
    const topbar = document.querySelector(".topbar");
    const onScroll = () =>
      topbar?.classList.toggle("scrolled", window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Typing headline
  useEffect(() => {
    const el = document.getElementById("typed-text");
    if (!el) return;
    let phraseIdx = 0;
    let charIdx = PHRASES[0].length;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;

    function step() {
      const phrase = PHRASES[phraseIdx];
      if (!deleting) {
        charIdx++;
        el!.textContent = phrase.slice(0, charIdx);
        if (charIdx >= phrase.length) {
          timer = setTimeout(() => { deleting = true; step(); }, 2200);
          return;
        }
        timer = setTimeout(step, 70 + Math.random() * 40);
      } else {
        charIdx--;
        el!.textContent = phrase.slice(0, charIdx);
        if (charIdx <= 0) {
          deleting = false;
          phraseIdx = (phraseIdx + 1) % PHRASES.length;
          timer = setTimeout(step, 400);
          return;
        }
        timer = setTimeout(step, 35);
      }
    }

    timer = setTimeout(() => { deleting = true; step(); }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Chat message sequencer
  useEffect(() => {
    const allMsgs = document.querySelectorAll(".wa-msg:not(.wa-typing)");
    const waTyping = document.getElementById("wa-typing");
    const waContainer = document.getElementById("wa-messages");
    const MAX_VISIBLE = 12;
    let msgIdx = 0;
    let timer: ReturnType<typeof setTimeout>;

    function scrollBottom() {
      if (waContainer) waContainer.scrollTop = waContainer.scrollHeight;
    }

    function hideOldest() {
      const visible = [...allMsgs].filter((m) => m.classList.contains("show"));
      while (visible.length >= MAX_VISIBLE) {
        const old = visible.shift()!;
        old.classList.remove("show");
        (old as HTMLElement).style.display = "none";
      }
    }

    function showNext() {
      if (msgIdx >= allMsgs.length) {
        timer = setTimeout(() => {
          allMsgs.forEach((m) => { m.classList.remove("show"); (m as HTMLElement).style.display = "none"; });
          if (waTyping) { waTyping.classList.remove("show"); waTyping.style.display = "none"; }
          msgIdx = 0;
          timer = setTimeout(showNext, 600);
        }, 3500);
        return;
      }

      const msg = allMsgs[msgIdx];
      const isOutgoing = msg.classList.contains("outgoing");

      if (isOutgoing && waTyping) {
        hideOldest();
        waTyping.classList.add("show");
        scrollBottom();
        timer = setTimeout(() => {
          waTyping.classList.remove("show");
          waTyping.style.display = "none";
          hideOldest();
          (msg as HTMLElement).style.display = "";
          msg.classList.add("show");
          scrollBottom();
          msgIdx++;
          timer = setTimeout(showNext, 1400);
        }, 800);
      } else {
        hideOldest();
        (msg as HTMLElement).style.display = "";
        msg.classList.add("show");
        scrollBottom();
        msgIdx++;
        timer = setTimeout(showNext, 1000);
      }
    }

    if (allMsgs.length > 0) timer = setTimeout(showNext, 600);
    return () => clearTimeout(timer);
  }, []);

  /* ── Render ───────────────────────────────── */

  return (
    <>
      <div className="grain" />
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />
      <div className="bg-orb orb-3" />

      {/* ── Header ── */}
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#">Ecqo</a>
          <nav className={burgerOpen ? "open" : ""}>
            <a href="#top" className="nav-brand" onClick={closeBurger}>Ecqo</a>
            <a href="#savings" onClick={closeBurger}>Savings</a>
            <a href="#calculator" onClick={closeBurger}>Calculator</a>
            <a href="#workflow" onClick={closeBurger}>Workflow</a>
            <a href="#usecases" onClick={closeBurger}>Use Cases</a>
            <a href="#pricing" onClick={closeBurger}>Pricing</a>
            <a href="#faq" onClick={closeBurger}>FAQ</a>
          </nav>
          <a className="button mini desktop-only" href="#calculator">Get Started</a>
          <div className="currency-toggle">
            <button type="button" className={`currency-btn ${currency === "AED" ? "active" : ""}`} onClick={() => switchCurrency("AED")}>AED</button>
            <button type="button" className={`currency-btn ${currency === "USD" ? "active" : ""}`} onClick={() => switchCurrency("USD")}>USD</button>
          </div>
          <a className="button mini mobile-cta" href="#calculator">Get Started</a>
          <button type="button" className={`burger ${burgerOpen ? "open" : ""}`} aria-label="Menu" onClick={() => setBurgerOpen((o) => !o)}>
            <span /><span /><span />
          </button>
        </div>
      </header>

      <main className="layout">
        {/* ── Hero ── */}
        <section className="hero" id="top">
          <div className="hero-content reveal">
            <p className="eyebrow">WhatsApp-Native Executive Assistant</p>
            <h1>
              Empower your<br />
              <span className="typed-line">
                <span id="typed-text">Human Assistant</span>
                <span className="typed-cursor">|</span>
              </span>
            </h1>
            <p className="subtitle">
              Ecqo watches your WhatsApp chats for scheduling, calendar checks, email summaries,
              reminders, and more &mdash; then acts on your behalf. No extra apps. No handoffs. No
              follow-up leaks.
            </p>
            <div className="hero-actions">
              <a className="button" href="#calculator">Get Started</a>
              <a className="ghost" href="#workflow">See How It Works</a>
            </div>
          </div>

          <div className="hero-visual reveal delay-1">
            <div className="phone-frame">
              <div className="phone-notch" />
              <div className="phone-screen">
                {/* WhatsApp header */}
                <div className="wa-header">
                  <svg className="wa-icon" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
                  <div className="wa-avatar">E</div>
                  <div className="wa-contact">
                    <span className="wa-name">Ecqo Assistant</span>
                    <span className="wa-online">online</span>
                  </div>
                  <svg className="wa-icon" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15.1 4.55a8 8 0 01.9 11.62l.01.01L22 22l-5.82-5.99A8 8 0 1115.1 4.55z" /><path d="M13 10v3l2.5 1.5" /></svg>
                  <svg className="wa-icon" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></svg>
                </div>

                {/* Chat area */}
                <div className="wa-chat" id="wa-chat">
                  <div className="wa-messages" id="wa-messages">
                    {CHAT_MESSAGES.map((msg, i) => (
                      <div
                        key={i}
                        className={`wa-bubble ${msg.type} wa-msg`}
                        dangerouslySetInnerHTML={{
                          __html:
                            (msg.tag
                              ? `<span class="ecqo-tag ${msg.tagClass || ""}">${msg.tag}</span>`
                              : "") +
                            msg.html +
                            `<span class="wa-meta">${msg.time}${
                              msg.type === "outgoing"
                                ? ' <span class="wa-checks">&check;&check;</span>'
                                : ""
                            }</span>`,
                        }}
                      />
                    ))}
                    <div className="wa-typing wa-msg" id="wa-typing">
                      <span /><span /><span />
                    </div>
                  </div>
                </div>

                {/* WhatsApp input bar */}
                <div className="wa-input-bar">
                  <div className="wa-input-field">
                    <svg className="wa-input-icon" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><circle cx="9" cy="10" r=".8" fill="#8a8a8a" stroke="none" /><circle cx="15" cy="10" r=".8" fill="#8a8a8a" stroke="none" /></svg>
                    <span>Type a message</span>
                    <svg className="wa-input-icon" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.49" /></svg>
                  </div>
                  <div className="wa-mic-btn">
                    <svg viewBox="0 0 24 24" fill="#fff" stroke="none"><path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3z" /><path d="M19 11a7 7 0 01-14 0" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" /><path d="M12 18v3M9 21h6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Savings ── */}
        <div className="section-header reveal" id="savings">
          <p className="eyebrow">Cost Snapshot</p>
          <h2>Simple Benchmarks. Clear Savings.</h2>
        </div>

        <section className="cards three-up">
          <article className="info-card reveal">
            <div className="card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M7 9h10M7 13h7M7 17h4" /></svg>
            </div>
            <p className="label">Remote VA Midpoint</p>
            <p className="value">
              <span className="price">{price(8799, 2400, currency)}</span>
              <span>/mo</span>
            </p>
            <p className="copy">Based on global freelance VA midpoint from Upwork hourly bands.</p>
            <button type="button" className="ghost preset" onClick={() => setCurrentCost(currency === "AED" ? 8799 : 2400)}>Use midpoint</button>
          </article>

          <article className="info-card reveal delay-1">
            <div className="card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21V7l5-3 4 3 4-3 5 3v14z" /><path d="M7 12h10M7 16h6" /></svg>
            </div>
            <p className="label">Executive Assistant Average</p>
            <p className="value">
              <span className="price">{price(21999, 5945, currency)}</span>
              <span>/mo</span>
            </p>
            <p className="copy">Based on Indeed US average EA salary converted to monthly cost.</p>
            <button type="button" className="ghost preset" onClick={() => setCurrentCost(currency === "AED" ? 21999 : 5945)}>Use average</button>
          </article>

          <article className="info-card highlight reveal delay-2">
            <div className="card-icon accent-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="5" width="16" height="14" rx="3" /><path d="M8 12h8M8 16h5" /><path d="M16 8l3 3-3 3" /></svg>
            </div>
            <p className="label">Ecqo</p>
            <p className="value">
              From <span className="price">{price(749, 199, currency)}</span>
              <span>/mo</span>
            </p>
            <p className="copy">WhatsApp-native automation designed to replace manual assistant overhead.</p>
            <a className="button" href="#pricing">Get Started</a>
          </article>
        </section>

        {/* ── Calculator ── */}
        <section className="calculator" id="calculator">
          <div className="calculator-intro reveal">
            <p className="eyebrow">Savings Calculator</p>
            <h2>Make the Decision in 15 Seconds</h2>
            <p>Enter your current monthly assistant cost and compare it directly with your Ecqo plan.</p>
          </div>

          <div className="calculator-main reveal delay-1">
            <div className="inputs">
              <label>
                Current assistant cost (monthly)
                <input
                  type="number"
                  min={0}
                  value={currentCost}
                  onChange={(e) => setCurrentCost(Math.max(0, Number(e.target.value) || 0))}
                />
              </label>
              <label>
                Ecqo plan
                <select
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(Number(e.target.value))}
                >
                  {PLANS.map((p, i) => (
                    <option key={i} value={i}>
                      {p.name} &mdash; {price(p.aed, p.usd, currency)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="results">
              <div className="result-row">
                <span>Monthly savings</span>
                <strong>{fmt(monthlySavings, currency)}</strong>
              </div>
              <div className="result-row">
                <span>Annual savings</span>
                <strong>{fmt(annualSavings, currency)}</strong>
              </div>
              <div className="result-row">
                <span>Savings rate</span>
                <strong>{savingsRate}%</strong>
              </div>
            </div>

            {waitlistStep === "email" && (
              <form className="waitlist" onSubmit={handleRequestCode}>
                <label>
                  Your email
                  <input
                    type="email"
                    required
                    placeholder="you@office.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <button type="submit" className="button" disabled={waitlistSubmitting}>
                  {waitlistSubmitting ? "Sending..." : "Join the waitlist"}
                </button>
                {waitlistStatus && (
                  <p className="status" role="status" aria-live="polite">{waitlistStatus}</p>
                )}
              </form>
            )}

            {waitlistStep === "code" && (
              <form className="waitlist" onSubmit={handleVerify}>
                <label>
                  Verification code
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    placeholder="000000"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                    autoFocus
                  />
                </label>
                <button type="submit" className="button" disabled={waitlistSubmitting}>
                  {waitlistSubmitting ? "Verifying..." : "Verify"}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => { setWaitlistStep("email"); setWaitlistStatus(""); setVerificationCode(""); }}
                >
                  Use a different email
                </button>
                {waitlistStatus && (
                  <p className="status" role="status" aria-live="polite">{waitlistStatus}</p>
                )}
              </form>
            )}

            {waitlistStep === "done" && (
              <div className="waitlist">
                {waitlistStatus && (
                  <p className="status" role="status" aria-live="polite">{waitlistStatus}</p>
                )}
                <button
                  type="button"
                  className="ghost"
                  onClick={() => { setWaitlistStep("email"); setWaitlistStatus(""); }}
                >
                  Join with another email
                </button>
              </div>
            )}
          </div>
        </section>

        <div className="source-strip reveal">
          <p>
            Sources (accessed March 5, 2026):{" "}
            <a href="https://www.indeed.com/career/executive-assistant/salaries" target="_blank" rel="noopener noreferrer">Indeed EA</a>
            {" "}and{" "}
            <a href="https://www.upwork.com/hire/virtual-assistants/cost/" target="_blank" rel="noopener noreferrer">Upwork VA cost</a>.
          </p>
        </div>

        {/* ── Workflow ── */}
        <div className="section-header reveal" id="workflow">
          <p className="eyebrow">Workflow</p>
          <h2>Built for Fast Decisions in Private Networks</h2>
        </div>

        <section className="cards three-up workflow-cards">
          <article className="info-card reveal">
            <div className="step-number">01</div>
            <div className="card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8h14v10a2 2 0 01-2 2H7a2 2 0 01-2-2V8z" /><path d="M3 8l3-4h12l3 4" /><path d="M9 12h6M9 16h4" /></svg>
            </div>
            <h3>Capture</h3>
            <p>Ecqo reads approved WhatsApp threads and detects scheduling intent in real time.</p>
          </article>
          <article className="info-card reveal delay-1">
            <div className="step-number">02</div>
            <div className="card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 10h8M8 14h6" /><path d="M15 17l2 2 4-4" /></svg>
            </div>
            <h3>Propose</h3>
            <p>It drafts an action-ready proposal with participants, timing, and context.</p>
          </article>
          <article className="info-card reveal delay-2">
            <div className="step-number">03</div>
            <div className="card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>
            </div>
            <h3>Execute</h3>
            <p>Once approved, Ecqo finalizes the event flow and keeps records synchronized.</p>
          </article>
        </section>

        {/* ── Use Cases ── */}
        <div className="section-header reveal" id="usecases">
          <p className="eyebrow">Use Cases</p>
          <h2>One Chat. Every Task Handled.</h2>
        </div>

        <section className="cards usecase-grid">
          <article className="usecase-card reveal">
            <div className="usecase-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M3 10h18" /><path d="M9 4v6" /><path d="M15 4v6" /><path d="M8 15h2M14 15h2M8 19h2" /></svg>
            </div>
            <h3>Smart Scheduling</h3>
            <p>Detects meeting intent, proposes times, and creates calendar events after approval.</p>
            <span className="usecase-example">"Let's meet Thursday at 3pm"</span>
          </article>

          <article className="usecase-card reveal delay-1">
            <div className="usecase-icon calendar-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /><path d="M16.5 16.5l1.5 1.5" /></svg>
            </div>
            <h3>Calendar Check</h3>
            <p>Ask what's on your calendar today, tomorrow, or any day &mdash; get an instant summary.</p>
            <span className="usecase-example">"What do I have tomorrow?"</span>
          </article>

          <article className="usecase-card reveal delay-2">
            <div className="usecase-icon email-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 7l10 6 10-6" /></svg>
            </div>
            <h3>Email Digest</h3>
            <p>Get a concise summary of unread emails, flagged threads, or messages from key contacts.</p>
            <span className="usecase-example">"Summarize my unread emails"</span>
          </article>

          <article className="usecase-card reveal">
            <div className="usecase-icon reminder-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>
            </div>
            <h3>Reminders &amp; Follow-ups</h3>
            <p>Set reminders via chat. Ecqo nudges you at the right time so nothing slips through.</p>
            <span className="usecase-example">"Remind me to call Sarah at 5pm"</span>
          </article>

          <article className="usecase-card reveal delay-1">
            <div className="usecase-icon travel-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1L11 12l-2 3H6l-1 1 3 2 2 3 1-1v-3l3-2 3.7 7.3c.2.4.7.5 1.1.3l.5-.3c.4-.2.6-.6.5-1.1z" /></svg>
            </div>
            <h3>Travel Coordination</h3>
            <p>Share flight details or hotel confirmations &mdash; Ecqo adds them to your calendar automatically.</p>
            <span className="usecase-example">"Add my flight LHR to JFK on Friday"</span>
          </article>

          <article className="usecase-card reveal delay-2">
            <div className="usecase-icon brief-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h6M8 9h2" /></svg>
            </div>
            <h3>Meeting Briefs</h3>
            <p>Get a pre-meeting brief with attendee context, agenda, and relevant notes before any call.</p>
            <span className="usecase-example">"Brief me on my 2pm meeting"</span>
          </article>
        </section>

        {/* ── Pricing ── */}
        <div className="section-header reveal" id="pricing">
          <p className="eyebrow">Pricing</p>
          <h2>Choose a plan that works for you</h2>
        </div>

        <section className="cards three-up pricing-grid">
          <article className="info-card reveal">
            <p className="label">Founder</p>
            <p className="value">
              <span className="price">{price(749, 199, currency)}</span>
              <span>/month</span>
            </p>
            <ul>
              <li>1 principal line</li>
              <li>Unlimited scheduling detections</li>
              <li>Proposal + approval flow</li>
            </ul>
            <a className="button" href="#calculator">Get Started</a>
          </article>
          <article className="info-card highlight reveal delay-1">
            <div className="popular-badge">Most Popular</div>
            <p className="label">Dreamer</p>
            <p className="value">
              <span className="price">{price(1499, 399, currency)}</span>
              <span>/month</span>
            </p>
            <ul>
              <li>Up to 5 principals</li>
              <li>Priority rule logic</li>
              <li>Shared operations view</li>
            </ul>
            <a className="button" href="#calculator">Get Started</a>
          </article>
          <article className="info-card reveal delay-2">
            <p className="label">Custom</p>
            <p className="value">TBD</p>
            <ul>
              <li>Customizable for your team</li>
              <li>Dedicated onboarding</li>
              <li>Dedicated support</li>
            </ul>
            <a className="button" href="#calculator">Get Started</a>
          </article>
        </section>

        {/* ── FAQ ── */}
        <section className="faq-section" id="faq">
          <div className="section-header reveal">
            <h2>Frequently Asked Questions</h2>
          </div>
          <div className="faq-list reveal">
            <details>
              <summary>Is this WhatsApp-only?</summary>
              <p>Yes. Ecqo is intentionally focused on direct WhatsApp Meta Cloud API integration. Everything happens inside the chat you already use.</p>
            </details>
            <details>
              <summary>Can we enforce approvals before scheduling?</summary>
              <p>Yes. Events remain pending until required participants approve. Nothing gets added to your calendar without your explicit confirmation.</p>
            </details>
            <details>
              <summary>How does calendar check work?</summary>
              <p>Just ask "What's on my calendar today?" or "Am I free Friday afternoon?" and Ecqo pulls your schedule in real time, giving you a clean summary right in chat.</p>
            </details>
            <details>
              <summary>Which email providers are supported?</summary>
              <p>Ecqo integrates with Gmail and Outlook. Ask for unread summaries, search for emails from specific contacts, or get flagged thread digests on demand.</p>
            </details>
            <details>
              <summary>Can Ecqo set reminders and follow-ups?</summary>
              <p>Yes. Say "Remind me to call Sarah at 5pm" or "Follow up with the investor next Monday" and Ecqo will notify you at the right time via WhatsApp.</p>
            </details>
            <details>
              <summary>Is this still cost-effective vs remote assistant models?</summary>
              <p>Yes. The calculator above compares against both remote VA midpoint and EA averages. Ecqo handles the repetitive coordination so your human assistant can focus on high-value work.</p>
            </details>
          </div>
        </section>

        {/* ── Referral ── */}
        <section className="referral reveal" id="referral">
          <div className="referral-content">
            <p className="eyebrow">Referral Loop</p>
            <h2>Share Ecqo with Your Operator Network</h2>
            <p>Invite two qualified operators and unlock one free month.</p>
          </div>
          <div className="ref-actions">
            <button className="button" type="button" onClick={copyReferralLink}>Copy Referral Link</button>
            <a
              className="ghost"
              target="_blank"
              rel="noopener noreferrer"
              href="https://wa.me/?text=Ecqo%20replaces%20EA%2FVA%20work%20inside%20WhatsApp.%20See%20it%20here%3A%20https%3A%2F%2Fwww.ecqo.ai%2F"
            >
              Share on WhatsApp
            </a>
            <p id="viral-status" className="status" role="status" aria-live="polite" />
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <a className="brand" href="#">Ecqo</a>
          <p>WhatsApp-native executive assistant automation.</p>
        </div>
      </footer>
    </>
  );
}
