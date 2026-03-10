import { useState, useEffect, useRef, useCallback, type FormEvent } from "react";
import { requestVerification } from "../api";
import { useLocale } from "../i18n/locale";
import { AuroraBackground } from "../components/AuroraBackground";

/* ── Country detection via Intl API ─────────── */

function detectIsUAE(): boolean {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz === "Asia/Dubai" || tz === "Asia/Muscat";
  } catch {
    return false;
  }
}

/* ── Constants ──────────────────────────────── */

const PLANS = [
  { name: "Starter", nameAr: "\u0627\u0644\u0645\u0628\u062a\u062f\u0626", aed: 179, usd: 49, aedAnnual: 139, usdAnnual: 39 },
  { name: "Founder", nameAr: "\u0627\u0644\u0645\u0624\u0633\u0633", aed: 749, usd: 199, aedAnnual: 549, usdAnnual: 149 },
  { name: "Dreamer", nameAr: "\u0627\u0644\u062d\u0627\u0644\u0645", aed: 1499, usd: 399, aedAnnual: 999, usdAnnual: 269 },
];

const SLIDER_MAX_USD = 10000;
const SLIDER_MAX_AED = 36700;

/* ── Helpers ─────────────────────────────────── */

function fmt(value: number, currency: string, aedLabel: string) {
  const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
  return currency === "AED" ? `${num} ${aedLabel}` : `$${num}`;
}

function price(aed: number, usd: number, currency: string, aedLabel: string) {
  return currency === "AED" ? `${aed.toLocaleString("en-US")} ${aedLabel}` : `$${usd.toLocaleString("en-US")}`;
}

/* ── Component ──────────────────────────────── */

export function Home() {
  const isUAE = detectIsUAE();
  const { locale, setLocale, t } = useLocale();
  const [currency, setCurrency] = useState<string>(isUAE ? "AED" : "USD");
  const [currentCost, setCurrentCost] = useState(isUAE ? 8799 : 2400);
  const [selectedPlan, setSelectedPlan] = useState(0);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");
  const [burgerOpen, setBurgerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState("");
  const [waitlistStep, setWaitlistStep] = useState<"email" | "done">("email");
  const [waitlistStatus, setWaitlistStatus] = useState("");
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | "device">("device");

  useEffect(() => {
    const stored = localStorage.getItem("theme") as "light" | "dark" | "device" | null;
    setTheme(stored || "device");
  }, []);

  useEffect(() => {
    if (theme !== "device") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.setAttribute("data-theme", mq.matches ? "dark" : "light");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  const applyTheme = useCallback((next: "light" | "dark" | "device") => {
    setTheme(next);
    localStorage.setItem("theme", next);
    if (next === "device") {
      const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    } else {
      document.documentElement.setAttribute("data-theme", next);
    }
  }, []);

  const planCost = currency === "AED" ? PLANS[selectedPlan].aedAnnual : PLANS[selectedPlan].usdAnnual;
  const monthlySavings = Math.max(0, currentCost - planCost);
  const weeklySavings = Math.round(monthlySavings / 4.33);
  const annualSavings = monthlySavings * 12;
  const savingsRate = currentCost > 0 ? ((monthlySavings / currentCost) * 100).toFixed(0) : "0";
  const hourlyRate = currency === "AED" ? 55 : 15;
  const timeSavedWeekly = Math.round((monthlySavings / hourlyRate) / 4.33);
  const timeSavedMonthly = Math.round(monthlySavings / hourlyRate);
  const timeSavedAnnually = timeSavedMonthly * 12;

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

  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [settingsOpen]);

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
      const result = await requestVerification(email.trim());
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

  // Chat message sequencer + agent feed — re-run when locale changes
  useEffect(() => {
    const allMsgs = document.querySelectorAll(".wa-msg:not(.wa-typing)");
    const waTyping = document.getElementById("wa-typing");
    const waContainer = document.getElementById("wa-messages");
    const feedSlots = [...document.querySelectorAll(".feed-slot")] as HTMLElement[];
    const SLOT_COUNT = feedSlots.length;
    const iconSrcs: Record<string, string> = {
      whatsapp: "https://cdn.simpleicons.org/whatsapp/white",
      gcal: "https://cdn.simpleicons.org/googlecalendar",
      gmail: "https://cdn.simpleicons.org/gmail",
      outlook: "/icons/outlook.svg",
    };
    const MAX_VISIBLE = 12;
    let msgIdx = 0;
    let feedIdx = 0;
    let timer: ReturnType<typeof setTimeout>;

    // Reset all messages and feed on locale change
    allMsgs.forEach((m) => { m.classList.remove("show"); (m as HTMLElement).style.display = "none"; });
    feedSlots.forEach((s) => { s.classList.remove("show", "flash"); s.className = "agent-feed-item feed-slot"; });
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

    function fillSlot(slot: HTMLElement, data: { icon: string; label: string; detail: string }) {
      const iconEl = slot.querySelector(".agent-feed-icon") as HTMLElement;
      iconEl.className = `agent-feed-icon icon-${data.icon}`;
      iconEl.innerHTML = `<img src="${iconSrcs[data.icon]}" alt="${data.icon}" width="16" height="16" />`;
      const labelEl = slot.querySelector(".agent-feed-label") as HTMLElement;
      const detailEl = slot.querySelector(".agent-feed-detail") as HTMLElement;
      labelEl.textContent = data.label;
      detailEl.textContent = data.detail;
    }

    function showFeedItem() {
      if (feedIdx >= t.agentFeed.length) return;
      const data = t.agentFeed[feedIdx];
      feedSlots.forEach((s) => s.classList.remove("flash"));

      if (feedIdx < SLOT_COUNT) {
        // Still filling — just reveal the next slot
        const slot = feedSlots[feedIdx];
        fillSlot(slot, data);
        slot.classList.add("show");
        requestAnimationFrame(() => slot.classList.add("flash"));
        setTimeout(() => slot.classList.remove("flash"), 1200);
      } else {
        // All slots full — shift content up, new item at bottom
        // 1. Fade out top slot
        feedSlots[0].classList.remove("show");
        setTimeout(() => {
          // 2. Shift content: slot[1]->[0], [2]->[1], ..., [n-1]->[n-2]
          for (let i = 0; i < SLOT_COUNT - 1; i++) {
            const src = feedSlots[i + 1];
            const dst = feedSlots[i];
            dst.querySelector(".agent-feed-icon")!.className = src.querySelector(".agent-feed-icon")!.className;
            dst.querySelector(".agent-feed-icon")!.innerHTML = src.querySelector(".agent-feed-icon")!.innerHTML;
            dst.querySelector(".agent-feed-label")!.textContent = src.querySelector(".agent-feed-label")!.textContent;
            dst.querySelector(".agent-feed-detail")!.textContent = src.querySelector(".agent-feed-detail")!.textContent;
            dst.classList.add("show");
          }
          // 3. Fill last slot with new data
          const lastSlot = feedSlots[SLOT_COUNT - 1];
          lastSlot.classList.remove("show");
          fillSlot(lastSlot, data);
          requestAnimationFrame(() => {
            lastSlot.classList.add("show");
            requestAnimationFrame(() => lastSlot.classList.add("flash"));
            setTimeout(() => lastSlot.classList.remove("flash"), 1200);
          });
        }, 350);
      }
      feedIdx++;
    }

    function showNext() {
      if (msgIdx >= allMsgs.length) {
        timer = setTimeout(() => {
          allMsgs.forEach((m) => { m.classList.remove("show"); (m as HTMLElement).style.display = "none"; });
          feedSlots.forEach((s) => { s.classList.remove("show", "flash"); });
          if (waTyping) { waTyping.classList.remove("show"); waTyping.style.display = "none"; }
          msgIdx = 0;
          feedIdx = 0;
          timer = setTimeout(showNext, 600);
        }, 3500);
        return;
      }

      const msg = allMsgs[msgIdx];
      const isOutgoing = msg.classList.contains("outgoing");

      if (isOutgoing && waTyping) {
        hideOldest();
        waTyping.classList.add("show");
        showFeedItem();
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
          <div className="settings-wrap" ref={settingsRef}>
            <button type="button" className={`settings-trigger ${settingsOpen ? "open" : ""}`} aria-label="Settings" onClick={() => setSettingsOpen((o) => !o)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001.08 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1.08z" /></svg>
            </button>
            <div className={`settings-popover ${settingsOpen ? "open" : ""}`}>
              <div className="settings-row">
                <span className="settings-label">{t.nav.language}</span>
                <div className="toggle-group">
                  <button type="button" className={`toggle-btn ${locale === "en" ? "active" : ""}`} onClick={() => setLocale("en")}>EN</button>
                  <button type="button" className={`toggle-btn ${locale === "ar" ? "active" : ""}`} onClick={() => setLocale("ar")}>{"\u0639\u0631\u0628\u064a"}</button>
                </div>
              </div>
              <div className="settings-row">
                <span className="settings-label">{t.nav.theme}</span>
                <div className="toggle-group">
                  <button type="button" className={`toggle-btn ${theme === "light" ? "active" : ""}`} onClick={() => applyTheme("light")} aria-label="Light">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
                  </button>
                  <button type="button" className={`toggle-btn ${theme === "device" ? "active" : ""}`} onClick={() => applyTheme("device")} aria-label="Device">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                  </button>
                  <button type="button" className={`toggle-btn ${theme === "dark" ? "active" : ""}`} onClick={() => applyTheme("dark")} aria-label="Dark">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
                  </button>
                </div>
              </div>
              <div className="settings-row">
                <span className="settings-label">{t.nav.currency}</span>
                <div className="toggle-group">
                  <button type="button" className={`toggle-btn ${currency === "AED" ? "active" : ""}`} onClick={() => switchCurrency("AED")}>{t.currencyLabels.AED}</button>
                  <button type="button" className={`toggle-btn ${currency === "USD" ? "active" : ""}`} onClick={() => switchCurrency("USD")}>{t.currencyLabels.USD}</button>
                </div>
              </div>
            </div>
          </div>
          <a className="button mini mobile-cta" href="#calculator">{t.nav.getStarted}</a>
          <button type="button" className={`burger ${burgerOpen ? "open" : ""}`} aria-label="Menu" onClick={() => setBurgerOpen((o) => !o)}>
            <span /><span /><span />
          </button>
        </div>
      </header>

      <main className="layout">
        {/* ── Hero ── */}
        <AuroraBackground className="hero" id="top">
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
            <div className="integrations-strip">
              <span className="integrations-label">{t.integrations.label}</span>
              <div className="integrations-logos">
                <div className="integration-logo" title="WhatsApp">
                  <svg viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </div>
                <div className="integration-logo" title="Google Calendar">
                  <svg viewBox="0 0 24 24"><path d="M18.316 5.684H24v12.632h-5.684V5.684z" fill="#1967D2"/><path d="M5.684 24l-5.684-5.684V5.684L5.684 0v24z" fill="#1967D2" opacity=".4"/><path d="M18.316 5.684L24 0H5.684l12.632 5.684z" fill="#1967D2" opacity=".5"/><path d="M12 17.526a5.526 5.526 0 100-11.052 5.526 5.526 0 000 11.052z" fill="#fff"/><path d="M12 8.21v4.105l2.526 2.526" fill="none" stroke="#1967D2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div className="integration-logo" title="Gmail">
                  <svg viewBox="0 0 24 24"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335"/></svg>
                </div>
                <div className="integration-logo" title="Outlook">
                  <svg viewBox="0 0 24 24"><path d="M24 7.387v10.478c0 .23-.08.424-.238.576a.807.807 0 01-.588.234h-8.543v-7.08l1.63 1.18a.272.272 0 00.322 0l7.17-5.186a.586.586 0 01.247.798z" fill="#0078D4"/><path d="M15.87 8.17a.272.272 0 01-.322 0l-1.63-1.18V4.825h8.543c.226 0 .42.08.581.24.161.159.245.35.252.573L15.87 8.17z" fill="#0078D4" opacity=".7"/><path d="M0 5.125c0-.645.22-1.19.66-1.634A2.195 2.195 0 012.263 2.85h6.37v18.298H2.262a2.182 2.182 0 01-1.602-.642A2.17 2.17 0 010 18.875V5.125z" fill="#0078D4"/><ellipse cx="5.448" cy="12" rx="2.756" ry="3.474" fill="#fff"/></svg>
                </div>
              </div>
            </div>
          </div>

          <div className="hero-visual reveal delay-1">
            <div className="agent-feed" id="agent-feed">
              <div className="agent-feed-header">
                <span className="agent-pulse" />
                <span className="agent-feed-title"> {locale === "ar" ? t.agent + " " + t.brandName : t.brandName + " " + t.agent} </span>
              </div>
              <div className="agent-feed-list" id="agent-feed-list">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={`${locale}-slot-${i}`} className="agent-feed-item feed-slot">
                    <div className="agent-feed-icon" />
                    <div className="agent-feed-text">
                      <span className="agent-feed-label" />
                      <span className="agent-feed-detail" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
        </AuroraBackground>

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
              <div className="savings-illus">
                <svg viewBox="0 0 120 60" fill="none">
                  <rect x="8" y="10" width="28" height="20" rx="3" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="3 2" transform="rotate(-6 22 20)" />
                  <rect x="42" y="14" width="28" height="20" rx="3" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="3 2" transform="rotate(4 56 24)" />
                  <rect x="78" y="8" width="28" height="20" rx="3" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="3 2" transform="rotate(-3 92 18)" />
                  <path d="M20 38c8-12 16 8 24-4s16 10 24-2s16 8 24-6" stroke="var(--signal)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
                  <circle cx="30" cy="46" r="3" fill="var(--muted)" opacity="0.3" />
                  <circle cx="58" cy="50" r="2" fill="var(--muted)" opacity="0.2" />
                  <circle cx="86" cy="44" r="2.5" fill="var(--muted)" opacity="0.25" />
                </svg>
              </div>
            </article>
            <article className="old-card" onClick={() => setCurrentCost(currency === "AED" ? 21999 : 5945)}>
              <p className="old-label">{t.savings.eaAverage}</p>
              <p className="old-price">{price(21999, 5945, currency, t.currencyLabels.AED)}<span>{t.savings.mo}</span></p>
              <p className="old-copy">{t.savings.eaCopy}</p>
              <span className="old-save">{t.savings.savingsLabel} {t.savings.savingsEa}</span>
              <div className="savings-illus">
                <svg viewBox="0 0 120 60" fill="none">
                  <rect x="10" y="6" width="22" height="18" rx="3" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="3 2" transform="rotate(5 21 15)" />
                  <rect x="38" y="12" width="22" height="18" rx="3" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="3 2" transform="rotate(-8 49 21)" />
                  <rect x="66" y="4" width="22" height="18" rx="3" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="3 2" transform="rotate(3 77 13)" />
                  <rect x="88" y="16" width="22" height="18" rx="3" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="3 2" transform="rotate(-5 99 25)" />
                  <path d="M16 40l8-6 10 10 8-14 10 8 12-12 10 6 12-10" stroke="var(--signal)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
                  <circle cx="24" cy="50" r="2" fill="var(--muted)" opacity="0.2" />
                  <circle cx="52" cy="48" r="3" fill="var(--muted)" opacity="0.3" />
                  <circle cx="80" cy="52" r="2" fill="var(--muted)" opacity="0.2" />
                  <circle cx="100" cy="46" r="2.5" fill="var(--muted)" opacity="0.25" />
                </svg>
              </div>
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
                <p className="new-price">{t.savings.from} {price(179, 49, currency, t.currencyLabels.AED)}<span>{t.savings.mo}</span></p>
              </div>
              <div className="new-card-right">
                <p className="new-copy">{t.savings.ecqqoCopy}</p>
                <a className="button" href="#calculator">{t.nav.getStarted}</a>
                <div className="new-card-illus">
                  <svg viewBox="0 0 120 50" fill="none">
                    <rect x="10" y="8" width="30" height="16" rx="4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
                    <rect x="45" y="8" width="30" height="16" rx="4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
                    <rect x="80" y="8" width="30" height="16" rx="4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
                    <polyline points="25,30 60,30 95,30" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="25" cy="30" r="3" fill="rgba(255,255,255,0.5)" />
                    <circle cx="60" cy="30" r="3" fill="rgba(255,255,255,0.5)" />
                    <circle cx="95" cy="30" r="3" fill="rgba(255,255,255,0.5)" />
                    <path d="M22 16l3 3 5-5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M57 16l3 3 5-5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M92 16l3 3 5-5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
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
            <div className="slider-group">
              <span className="slider-label">{t.calculator.currentCost}</span>
              <div className="slider-value-display">
                {currency === "USD" && <span className="slider-currency">$</span>}
                <span className="slider-amount">{new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(currentCost)}</span>
                {currency === "AED" && <span className="slider-currency">{t.currencyLabels.AED}</span>}
                <span className="slider-period">{t.calculator.perMonth}</span>
              </div>
              <div className="slider-track-wrap">
                <input
                  type="range"
                  className="cost-slider"
                  min={0}
                  max={currency === "AED" ? SLIDER_MAX_AED : SLIDER_MAX_USD}
                  step={currency === "AED" ? 100 : 50}
                  value={currentCost}
                  onChange={(e) => setCurrentCost(Number(e.target.value))}
                  style={{ "--slider-pct": `${(currentCost / (currency === "AED" ? SLIDER_MAX_AED : SLIDER_MAX_USD)) * 100}%` } as React.CSSProperties}
                />
                <div className="slider-glow" style={{ left: `${(currentCost / (currency === "AED" ? SLIDER_MAX_AED : SLIDER_MAX_USD)) * 100}%` }} />
              </div>
              <div className="slider-range-labels">
                <span>{currency === "USD" ? "$0" : `0 ${t.currencyLabels.AED}`}</span>
                <span>{currency === "USD" ? `$${(SLIDER_MAX_USD / 1000).toFixed(0)}k` : `${(SLIDER_MAX_AED / 1000).toFixed(0)}k ${t.currencyLabels.AED}`}</span>
              </div>
            </div>

            <div className="plan-selector">
              <span className="plan-selector-label">{t.calculator.ecqqoPlan}</span>
              <div className="plan-options">
                {PLANS.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`plan-option ${selectedPlan === i ? "active" : ""}`}
                    onClick={() => setSelectedPlan(i)}
                  >
                    <span className="plan-option-name">{locale === "ar" ? p.nameAr : p.name}</span>
                    <span className="plan-option-price">
                      <span className="plan-option-old">{price(p.aed, p.usd, currency, t.currencyLabels.AED)}</span>
                      {price(p.aedAnnual, p.usdAnnual, currency, t.currencyLabels.AED)}
                    </span>
                    <span className="plan-option-period">{t.calculator.perMonth}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="results-grid">
              <div className="results results-money">
                <span className="results-heading">{t.calculator.moneySavedHeading}</span>
                <div className="result-hero-value">{fmt(weeklySavings, currency, t.currencyLabels.AED)}</div>
                <span className="result-hero-label">{t.calculator.perWeek}</span>
                <div className="result-details">
                  <div className="result-row">
                    <span>{t.calculator.perMonth}</span>
                    <strong>{fmt(monthlySavings, currency, t.currencyLabels.AED)}</strong>
                  </div>
                  <div className="result-row">
                    <span>{t.calculator.perYear}</span>
                    <strong>{fmt(annualSavings, currency, t.currencyLabels.AED)}</strong>
                  </div>
                  <div className="result-row">
                    <span>{t.calculator.savingsRate}</span>
                    <strong>{savingsRate}%</strong>
                  </div>
                </div>
              </div>
              <div className="results results-time">
                <span className="results-heading">{t.calculator.timeSavedHeading}</span>
                <div className="result-hero-value">{timeSavedWeekly}h</div>
                <span className="result-hero-label">{t.calculator.perWeek}</span>
                <div className="result-details">
                  <div className="result-row">
                    <span>{t.calculator.perMonth}</span>
                    <strong>{timeSavedMonthly}h</strong>
                  </div>
                  <div className="result-row">
                    <span>{t.calculator.perYear}</span>
                    <strong>{timeSavedAnnually}h</strong>
                  </div>
                </div>
              </div>
            </div>

            {waitlistStep === "email" ? (
              <form className="waitlist-inline" onSubmit={handleJoinWaitlist}>
                <div className="waitlist-input-row">
                  <input
                    type="email"
                    required
                    placeholder={t.calculator.emailPlaceholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <button type="submit" className="button" disabled={waitlistSubmitting}>
                    {waitlistSubmitting ? t.calculator.sending : t.calculator.joinWaitlist}
                  </button>
                </div>
                {waitlistStatus && (
                  <p className="status" role="status" aria-live="polite">{waitlistStatus}</p>
                )}
              </form>
            ) : (
              <div className="waitlist-inline waitlist-done">
                {waitlistStatus && (
                  <p className="waitlist-done-msg" role="status" aria-live="polite">{waitlistStatus}</p>
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
          <div className="workflow-connector">
            <div className="workflow-connector-arrow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </div>
            <div className="workflow-connector-arrow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </div>
          </div>
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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="3" />
                <path d="M3 10h18" />
                <path d="M9 4v6M15 4v6" />
                <circle cx="12" cy="16" r="2" fill="currentColor" opacity="0.3" />
                <path d="M8 14h2M14 14h2" />
                <path d="M8 19h2" />
                <path d="M16 13l2 2-2 2" opacity="0.5" />
              </svg>
            </div>
            <h3>{t.useCases.scheduling}</h3>
            <p>{t.useCases.schedulingDesc}</p>
            <span className="usecase-example">{t.useCases.schedulingExample}</span>
          </article>

          <article className="usecase-card reveal delay-1">
            <div className="usecase-icon calendar-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
                <circle cx="12" cy="12" r="1" fill="currentColor" />
                <path d="M12 3v1M12 20v1M3 12h1M20 12h1" opacity="0.3" />
                <path d="M5.6 5.6l.7.7M17.7 17.7l.7.7M5.6 18.4l.7-.7M17.7 6.3l.7-.7" opacity="0.2" />
              </svg>
            </div>
            <h3>{t.useCases.calendar}</h3>
            <p>{t.useCases.calendarDesc}</p>
            <span className="usecase-example">{t.useCases.calendarExample}</span>
          </article>

          <article className="usecase-card reveal delay-2">
            <div className="usecase-icon email-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="3" />
                <path d="M2 7l10 6 10-6" />
                <circle cx="18" cy="8" r="3" fill="currentColor" opacity="0.25" />
                <text x="18" y="9.5" textAnchor="middle" fill="currentColor" fontSize="4" fontWeight="bold" opacity="0.6">3</text>
              </svg>
            </div>
            <h3>{t.useCases.email}</h3>
            <p>{t.useCases.emailDesc}</p>
            <span className="usecase-example">{t.useCases.emailExample}</span>
          </article>

          <article className="usecase-card reveal">
            <div className="usecase-icon reminder-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
                <path d="M12 2v1" />
                <path d="M20 8c.5-1 .5-2 0-3" opacity="0.35" />
                <path d="M4 8c-.5-1-.5-2 0-3" opacity="0.35" />
              </svg>
            </div>
            <h3>{t.useCases.reminders}</h3>
            <p>{t.useCases.remindersDesc}</p>
            <span className="usecase-example">{t.useCases.remindersExample}</span>
          </article>

          <article className="usecase-card reveal delay-1">
            <div className="usecase-icon travel-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1L11 12l-2 3H6l-1 1 3 2 2 3 1-1v-3l3-2 3.7 7.3c.2.4.7.5 1.1.3l.5-.3c.4-.2.6-.6.5-1.1z" />
                <path d="M2 20c3-2 6-1 9-3" opacity="0.25" strokeDasharray="2 2" />
              </svg>
            </div>
            <h3>{t.useCases.travel}</h3>
            <p>{t.useCases.travelDesc}</p>
            <span className="usecase-example">{t.useCases.travelExample}</span>
          </article>

          <article className="usecase-card reveal delay-2">
            <div className="usecase-icon brief-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <path d="M14 2v6h6" />
                <path d="M8 13h8M8 17h6M8 9h2" />
                <rect x="14" y="14" width="4" height="4" rx="1" fill="currentColor" opacity="0.15" />
                <path d="M15 16l1 1 2-2" opacity="0.5" />
              </svg>
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
            <p className="label">{t.pricing.starter}</p>
            <p className="value">
              {billingCycle === "annual" && <span className="price-old">{price(179, 49, currency, t.currencyLabels.AED)}</span>}
              <span className="price">{billingCycle === "annual" ? price(139, 39, currency, t.currencyLabels.AED) : price(179, 49, currency, t.currencyLabels.AED)}</span>
              <span>{t.pricing.month}</span>
            </p>
            <p className="billed-note">{billingCycle === "annual" ? t.pricing.billedAnnually : t.pricing.billedMonthly}</p>
            <ul>
              {t.pricing.starterFeatures.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
            <a className="button" href="#calculator">{t.nav.getStarted}</a>
          </article>
          <article className="info-card highlight reveal delay-1">
            <div className="popular-badge">{t.pricing.mostPopular}</div>
            <p className="label">{t.pricing.founder}</p>
            <p className="value">
              {billingCycle === "annual" && <span className="price-old">{price(749, 199, currency, t.currencyLabels.AED)}</span>}
              <span className="price">{billingCycle === "annual" ? price(549, 149, currency, t.currencyLabels.AED) : price(749, 199, currency, t.currencyLabels.AED)}</span>
              <span>{t.pricing.month}</span>
            </p>
            <p className="billed-note">{billingCycle === "annual" ? t.pricing.billedAnnually : t.pricing.billedMonthly}</p>
            <ul>
              {t.pricing.founderFeatures.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
            <a className="button" href="#calculator">{t.nav.getStarted}</a>
          </article>
          <article className="info-card reveal delay-2">
            <p className="label">{t.pricing.dreamer}</p>
            <p className="value">
              {billingCycle === "annual" && <span className="price-old">{price(1499, 399, currency, t.currencyLabels.AED)}</span>}
              <span className="price">{billingCycle === "annual" ? price(999, 269, currency, t.currencyLabels.AED) : price(1499, 399, currency, t.currencyLabels.AED)}</span>
              <span>{t.pricing.month}</span>
            </p>
            <p className="billed-note">{billingCycle === "annual" ? t.pricing.billedAnnually : t.pricing.billedMonthly}</p>
            <ul>
              {t.pricing.dreamerFeatures.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
            <a className="button" href="#calculator">{t.nav.getStarted}</a>
          </article>
        </section>

        <div className="custom-plan-banner reveal">
          <div className="custom-plan-inner">
            <div className="custom-plan-text">
              <h3>{t.pricing.customSubtitle}</h3>
              <p>{t.pricing.customDescription}</p>
            </div>
            <a className="button" href="#calculator">{t.pricing.customCta}</a>
          </div>
        </div>

        <div className="trust-badges reveal">
          <span className="trust-badge">
            <svg className="trust-badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
            {t.trust.encrypted}
          </span>
          <span className="trust-badge">
            <svg className="trust-badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            {t.trust.cancel}
          </span>
          <span className="trust-badge">
            <svg className="trust-badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            {t.trust.powered}
          </span>
        </div>

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
              {/* <a className="footer-wa-cta" href="https://wa.me/message/ecqqo" target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                {t.footer.whatsappCta}
              </a> */}
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
