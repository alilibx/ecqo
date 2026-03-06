import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { useState, useEffect, useRef, useCallback, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useLocale } from "../i18n/locale";

const getCountry = createServerFn({ method: "GET" }).handler(async () => {
  const country = getRequestHeader("x-vercel-ip-country") || getRequestHeader("cf-ipcountry") || "";
  return country.toUpperCase();
});

export const Route = createFileRoute("/")({
  component: Home,
  loader: async () => {
    const country = await getCountry();
    return { country };
  },
});

/* ── Constants ──────────────────────────────── */

const PLANS = [
  { name: "Founder", nameAr: "المؤسس", aed: 749, usd: 199 },
  { name: "Dreamer", nameAr: "الحالم", aed: 1499, usd: 399 },
];

/* ── Helpers ─────────────────────────────────── */

function fmt(value: number, currency: string, aedLabel: string) {
  const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
  return currency === "AED" ? `${num} ${aedLabel}` : `$${num}`;
}

function price(aed: number, usd: number, currency: string, aedLabel: string) {
  return currency === "AED" ? `${aed.toLocaleString("en-US")} ${aedLabel}` : `$${usd.toLocaleString("en-US")}`;
}

/* ── Component ──────────────────────────────── */

function Home() {
  const { country } = Route.useLoaderData();
  const isUAE = country === "AE";
  const { locale, setLocale, t } = useLocale();
  const [currency, setCurrency] = useState<string>(isUAE ? "AED" : "USD");
  const [currentCost, setCurrentCost] = useState(isUAE ? 8799 : 2400);
  const [selectedPlan, setSelectedPlan] = useState(0);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");
  const [burgerOpen, setBurgerOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [waitlistStep, setWaitlistStep] = useState<"email" | "done">("email");
  const [waitlistStatus, setWaitlistStatus] = useState("");
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);

  const requestVerification = useMutation(api.waitlist.requestVerification);

  const planCost = currency === "AED" ? PLANS[selectedPlan].aed : PLANS[selectedPlan].usd;
  const monthlySavings = Math.max(0, currentCost - planCost);
  const annualSavings = monthlySavings * 12;
  const savingsRate = currentCost > 0 ? ((monthlySavings / currentCost) * 100).toFixed(1) : "0.0";

  const chatMessages = t.wa.messages;
  const phrases = t.hero.phrases;

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

  async function handleJoinWaitlist(e: FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setWaitlistStatus(t.calculator.emailError);
      return;
    }
    if (trimmed.split("@")[0]?.includes("+")) {
      setWaitlistStatus(t.calculator.aliasError);
      return;
    }
    setWaitlistSubmitting(true);
    setWaitlistStatus("");
    try {
      const result = await requestVerification({ email: email.trim() });
      if (result.status === "already_verified") {
        setWaitlistStatus(`${t.calculator.alreadyVerified} #${result.position}.`);
      } else {
        setWaitlistStatus(t.calculator.checkEmail);
      }
      setWaitlistStep("done");
      setEmail("");
    } catch {
      setWaitlistStatus(t.calculator.error);
    } finally {
      setWaitlistSubmitting(false);
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

  // Typing headline — re-run when locale changes
  useEffect(() => {
    const el = document.getElementById("typed-text");
    if (!el) return;
    let phraseIdx = 0;
    let charIdx = phrases[0].length;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;

    el.textContent = phrases[0];

    function step() {
      const phrase = phrases[phraseIdx];
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
          phraseIdx = (phraseIdx + 1) % phrases.length;
          timer = setTimeout(step, 400);
          return;
        }
        timer = setTimeout(step, 35);
      }
    }

    timer = setTimeout(() => { deleting = true; step(); }, 2500);
    return () => clearTimeout(timer);
  }, [phrases]);

  // Chat message sequencer — re-run when locale changes
  useEffect(() => {
    const allMsgs = document.querySelectorAll(".wa-msg:not(.wa-typing)");
    const waTyping = document.getElementById("wa-typing");
    const waContainer = document.getElementById("wa-messages");
    const MAX_VISIBLE = 12;
    let msgIdx = 0;
    let timer: ReturnType<typeof setTimeout>;

    // Reset all messages on locale change
    allMsgs.forEach((m) => { m.classList.remove("show"); (m as HTMLElement).style.display = "none"; });
    if (waTyping) { waTyping.classList.remove("show"); waTyping.style.display = "none"; }

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
  }, [locale]);

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
          <a className="brand" href="#"><img src="/logos/logo-icon.png" alt="" className="brand-icon" />{t.brandName}</a>
          <nav className={burgerOpen ? "open" : ""}>
            <a href="#top" className="nav-brand" onClick={closeBurger}><img src="/logos/logo-icon.png" alt="" className="brand-icon" />{t.brandName}</a>
            <a href="#savings" onClick={closeBurger}>{t.nav.savings}</a>
            <a href="#calculator" onClick={closeBurger}>{t.nav.calculator}</a>
            <a href="#workflow" onClick={closeBurger}>{t.nav.workflow}</a>
            <a href="#usecases" onClick={closeBurger}>{t.nav.useCases}</a>
            <a href="#pricing" onClick={closeBurger}>{t.nav.pricing}</a>
            <a href="#faq" onClick={closeBurger}>{t.nav.faq}</a>
          </nav>
          <a className="button mini desktop-only" href="#calculator">{t.nav.getStarted}</a>
          <div className="locale-toggle">
            <button type="button" className={`locale-btn ${locale === "en" ? "active" : ""}`} onClick={() => setLocale("en")}>EN</button>
            <button type="button" className={`locale-btn ${locale === "ar" ? "active" : ""}`} onClick={() => setLocale("ar")}>عربي</button>
          </div>
          <div className="currency-toggle">
            <button type="button" className={`currency-btn ${currency === "AED" ? "active" : ""}`} onClick={() => switchCurrency("AED")}>{t.currencyLabels.AED}</button>
            <button type="button" className={`currency-btn ${currency === "USD" ? "active" : ""}`} onClick={() => switchCurrency("USD")}>{t.currencyLabels.USD}</button>
          </div>
          <a className="button mini mobile-cta" href="#calculator">{t.nav.getStarted}</a>
          <button type="button" className={`burger ${burgerOpen ? "open" : ""}`} aria-label="Menu" onClick={() => setBurgerOpen((o) => !o)}>
            <span /><span /><span />
          </button>
        </div>
      </header>

      <main className="layout">
        {/* ── Hero ── */}
        <section className="hero" id="top">
          <div className="hero-content reveal">
            <p className="eyebrow">{t.hero.eyebrow}</p>
            <h1>
              {t.hero.titleLine1}<br />
              <span className="typed-line">
                <span id="typed-text">{phrases[0]}</span>
                <span className="typed-cursor">|</span>
              </span>
            </h1>
            <p className="subtitle">{t.hero.subtitle}</p>
            <div className="hero-actions">
              <a className="button" href="#calculator">{t.hero.cta}</a>
              <a className="ghost" href="#workflow">{t.hero.secondaryCta}</a>
            </div>
          </div>

          <div className="hero-visual reveal delay-1">
            <div className="phone-frame">
              <div className="phone-notch" />
              <div className="phone-screen">
                {/* WhatsApp header */}
                <div className="wa-header">
                  <svg className="wa-icon" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
                  <div className="wa-avatar"><img src="/logos/logo-icon-light.png" alt={t.brandName} className="wa-avatar-icon" /></div>
                  <div className="wa-contact">
                    <span className="wa-name">{t.wa.assistantName}</span>
                    <span className="wa-online">{t.wa.online}</span>
                  </div>
                  <svg className="wa-icon" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15.1 4.55a8 8 0 01.9 11.62l.01.01L22 22l-5.82-5.99A8 8 0 1115.1 4.55z" /><path d="M13 10v3l2.5 1.5" /></svg>
                  <svg className="wa-icon" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></svg>
                </div>

                {/* Chat area */}
                <div className="wa-chat" id="wa-chat">
                  <div className="wa-messages" id="wa-messages">
                    {chatMessages.map((msg, i) => (
                      <div
                        key={`${locale}-${i}`}
                        className={`wa-bubble ${msg.type} wa-msg`}
                        dangerouslySetInnerHTML={{
                          __html:
                            ("tag" in msg && msg.tag
                              ? `<span class="ecqqo-tag ${"tagClass" in msg && msg.tagClass ? msg.tagClass : ""}">${msg.tag}</span>`
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
                    <span>{t.wa.typeMessage}</span>
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
          <p className="eyebrow">{t.savings.eyebrow}</p>
          <h2>{t.savings.title}</h2>
          <p className="section-subtitle">{t.savings.subtitle}</p>
        </div>

        <section className="savings-section reveal">
          <div className="savings-old">
            <article className="old-card" onClick={() => setCurrentCost(currency === "AED" ? 8799 : 2400)}>
              <p className="old-label">{t.savings.vaMidpoint}</p>
              <p className="old-price">{price(8799, 2400, currency, t.currencyLabels.AED)}<span>{t.savings.mo}</span></p>
              <p className="old-copy">{t.savings.vaCopy}</p>
              <span className="old-save">{t.savings.savingsLabel} {t.savings.savingsVa}</span>
            </article>
            <article className="old-card" onClick={() => setCurrentCost(currency === "AED" ? 21999 : 5945)}>
              <p className="old-label">{t.savings.eaAverage}</p>
              <p className="old-price">{price(21999, 5945, currency, t.currencyLabels.AED)}<span>{t.savings.mo}</span></p>
              <p className="old-copy">{t.savings.eaCopy}</p>
              <span className="old-save">{t.savings.savingsLabel} {t.savings.savingsEa}</span>
            </article>
          </div>
          <div className="savings-arrow reveal delay-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
          </div>
          <article className="new-card reveal delay-1">
            <div className="new-card-inner">
              <div className="new-card-left">
                <img src="/logos/logo-icon-light.png" alt={t.brandName} className="new-card-logo" />
                <p className="new-label">{t.savings.ecqqoLabel}</p>
                <p className="new-price">{t.savings.from} {price(749, 199, currency, t.currencyLabels.AED)}<span>{t.savings.mo}</span></p>
              </div>
              <div className="new-card-right">
                <p className="new-copy">{t.savings.ecqqoCopy}</p>
                <a className="button" href="#calculator">{t.nav.getStarted}</a>
              </div>
            </div>
          </article>
        </section>

        {/* ── Calculator ── */}
        <section className="calculator" id="calculator">
          <div className="calculator-intro reveal">
            <p className="eyebrow">{t.calculator.eyebrow}</p>
            <h2>{t.calculator.title}</h2>
            <p>{t.calculator.description}</p>
          </div>

          <div className="calculator-main reveal delay-1">
            <div className="inputs">
              <label>
                {t.calculator.currentCost}
                <input
                  type="number"
                  min={0}
                  value={currentCost}
                  onChange={(e) => setCurrentCost(Math.max(0, Number(e.target.value) || 0))}
                />
              </label>
              <label>
                {t.calculator.ecqqoPlan}
                <select
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(Number(e.target.value))}
                >
                  {PLANS.map((p, i) => (
                    <option key={i} value={i}>
                      {locale === "ar" ? p.nameAr : p.name} - {price(p.aed, p.usd, currency, t.currencyLabels.AED)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="results">
              <div className="result-row">
                <span>{t.calculator.monthlySavings}</span>
                <strong>{fmt(monthlySavings, currency, t.currencyLabels.AED)}</strong>
              </div>
              <div className="result-row">
                <span>{t.calculator.annualSavings}</span>
                <strong>{fmt(annualSavings, currency, t.currencyLabels.AED)}</strong>
              </div>
              <div className="result-row">
                <span>{t.calculator.savingsRate}</span>
                <strong>{savingsRate}%</strong>
              </div>
            </div>

            {waitlistStep === "email" && (
              <form className="waitlist" onSubmit={handleJoinWaitlist}>
                <label>
                  {t.calculator.yourEmail}
                  <input
                    type="email"
                    required
                    placeholder={t.calculator.emailPlaceholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <button type="submit" className="button" disabled={waitlistSubmitting}>
                  {waitlistSubmitting ? t.calculator.sending : t.calculator.joinWaitlist}
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
                  {t.calculator.joinAnother}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ── Workflow ── */}
        <div className="section-header reveal" id="workflow">
          <p className="eyebrow">{t.workflow.eyebrow}</p>
          <h2>{t.workflow.title}</h2>
        </div>

        <section className="cards three-up workflow-cards">
          <article className="info-card reveal">
            <div className="step-number">01</div>
            <div className="card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8h14v10a2 2 0 01-2 2H7a2 2 0 01-2-2V8z" /><path d="M3 8l3-4h12l3 4" /><path d="M9 12h6M9 16h4" /></svg>
            </div>
            <h3>{t.workflow.capture}</h3>
            <p>{t.workflow.captureDesc}</p>
          </article>
          <article className="info-card reveal delay-1">
            <div className="step-number">02</div>
            <div className="card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 10h8M8 14h6" /><path d="M15 17l2 2 4-4" /></svg>
            </div>
            <h3>{t.workflow.propose}</h3>
            <p>{t.workflow.proposeDesc}</p>
          </article>
          <article className="info-card reveal delay-2">
            <div className="step-number">03</div>
            <div className="card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>
            </div>
            <h3>{t.workflow.execute}</h3>
            <p>{t.workflow.executeDesc}</p>
          </article>
        </section>

        {/* ── Use Cases ── */}
        <div className="section-header reveal" id="usecases">
          <p className="eyebrow">{t.useCases.eyebrow}</p>
          <h2>{t.useCases.title}</h2>
        </div>

        <section className="cards usecase-grid">
          <article className="usecase-card reveal">
            <div className="usecase-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M3 10h18" /><path d="M9 4v6" /><path d="M15 4v6" /><path d="M8 15h2M14 15h2M8 19h2" /></svg>
            </div>
            <h3>{t.useCases.scheduling}</h3>
            <p>{t.useCases.schedulingDesc}</p>
            <span className="usecase-example">{t.useCases.schedulingExample}</span>
          </article>

          <article className="usecase-card reveal delay-1">
            <div className="usecase-icon calendar-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /><path d="M16.5 16.5l1.5 1.5" /></svg>
            </div>
            <h3>{t.useCases.calendar}</h3>
            <p>{t.useCases.calendarDesc}</p>
            <span className="usecase-example">{t.useCases.calendarExample}</span>
          </article>

          <article className="usecase-card reveal delay-2">
            <div className="usecase-icon email-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 7l10 6 10-6" /></svg>
            </div>
            <h3>{t.useCases.email}</h3>
            <p>{t.useCases.emailDesc}</p>
            <span className="usecase-example">{t.useCases.emailExample}</span>
          </article>

          <article className="usecase-card reveal">
            <div className="usecase-icon reminder-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>
            </div>
            <h3>{t.useCases.reminders}</h3>
            <p>{t.useCases.remindersDesc}</p>
            <span className="usecase-example">{t.useCases.remindersExample}</span>
          </article>

          <article className="usecase-card reveal delay-1">
            <div className="usecase-icon travel-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1L11 12l-2 3H6l-1 1 3 2 2 3 1-1v-3l3-2 3.7 7.3c.2.4.7.5 1.1.3l.5-.3c.4-.2.6-.6.5-1.1z" /></svg>
            </div>
            <h3>{t.useCases.travel}</h3>
            <p>{t.useCases.travelDesc}</p>
            <span className="usecase-example">{t.useCases.travelExample}</span>
          </article>

          <article className="usecase-card reveal delay-2">
            <div className="usecase-icon brief-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h6M8 9h2" /></svg>
            </div>
            <h3>{t.useCases.briefs}</h3>
            <p>{t.useCases.briefsDesc}</p>
            <span className="usecase-example">{t.useCases.briefsExample}</span>
          </article>
        </section>

        {/* ── Pricing ── */}
        <div className="section-header reveal" id="pricing">
          <p className="eyebrow">{t.pricing.eyebrow}</p>
          <h2>{t.pricing.title}</h2>
          <div className="billing-toggle">
            <button type="button" className={`billing-btn ${billingCycle === "monthly" ? "active" : ""}`} onClick={() => setBillingCycle("monthly")}>{t.pricing.monthly}</button>
            <button type="button" className={`billing-btn ${billingCycle === "annual" ? "active" : ""}`} onClick={() => setBillingCycle("annual")}>
              {t.pricing.annual}
              <span className="save-badge">{t.pricing.save30}</span>
            </button>
          </div>
        </div>

        <section className="cards three-up pricing-grid">
          <article className="info-card reveal">
            <p className="label">{t.pricing.founder}</p>
            <p className="value">
              {billingCycle === "annual" && <span className="price-old">{price(749, 199, currency, t.currencyLabels.AED)}</span>}
              <span className="price">{billingCycle === "annual" ? price(Math.round(749 * 0.7), Math.round(199 * 0.7), currency, t.currencyLabels.AED) : price(749, 199, currency, t.currencyLabels.AED)}</span>
              <span>{t.pricing.month}</span>
            </p>
            <p className="billed-note">{billingCycle === "annual" ? t.pricing.billedAnnually : t.pricing.billedMonthly}</p>
            <ul>
              {t.pricing.founderFeatures.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
            <a className="button" href="#calculator">{t.nav.getStarted}</a>
          </article>
          <article className="info-card highlight reveal delay-1">
            <div className="popular-badge">{t.pricing.mostPopular}</div>
            <p className="label">{t.pricing.dreamer}</p>
            <p className="value">
              {billingCycle === "annual" && <span className="price-old">{price(1499, 399, currency, t.currencyLabels.AED)}</span>}
              <span className="price">{billingCycle === "annual" ? price(Math.round(1499 * 0.7), Math.round(399 * 0.7), currency, t.currencyLabels.AED) : price(1499, 399, currency, t.currencyLabels.AED)}</span>
              <span>{t.pricing.month}</span>
            </p>
            <p className="billed-note">{billingCycle === "annual" ? t.pricing.billedAnnually : t.pricing.billedMonthly}</p>
            <ul>
              {t.pricing.dreamerFeatures.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
            <a className="button" href="#calculator">{t.nav.getStarted}</a>
          </article>
          <article className="info-card reveal delay-2">
            <p className="label">{t.pricing.custom}</p>
            <p className="value">{t.pricing.customPrice}</p>
            <ul>
              {t.pricing.customFeatures.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
            <a className="button" href="#calculator">{t.nav.getStarted}</a>
          </article>
        </section>

        {/* ── FAQ ── */}
        <section className="faq-section" id="faq">
          <div className="section-header reveal">
            <h2>{t.faq.title}</h2>
          </div>
          <div className="faq-list reveal">
            {t.faq.items.map((item, i) => (
              <details key={i}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-top">
            <div className="footer-brand">
              <a className="brand" href="#"><img src="/logos/logo-icon.png" alt="" className="brand-icon" />{t.brandName}</a>
              <p>{t.footer.description}</p>
            </div>
            <div className="footer-links">
              <div className="footer-col">
                <h4>{t.footer.product}</h4>
                <a href="#savings">{t.nav.savings}</a>
                <a href="#calculator">{t.nav.calculator}</a>
                <a href="#workflow">{t.nav.workflow}</a>
                <a href="#pricing">{t.nav.pricing}</a>
              </div>
              <div className="footer-col">
                <h4>{t.footer.company}</h4>
                <a href="#faq">{t.nav.faq}</a>
                <a href="/privacy">{t.footer.privacy}</a>
                <a href="/terms">{t.footer.terms}</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; {t.footer.copyright}</p>
          </div>
        </div>
      </footer>
    </>
  );
}
