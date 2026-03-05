import { jsxs, Fragment, jsx } from "react/jsx-runtime";
import { useState, useCallback, useEffect } from "react";
import { useMutation } from "convex/react";
import { anyApi, componentsGeneric } from "convex/server";
const api = anyApi;
componentsGeneric();
const PHRASES = ["Human Assistant", "Entire Workflow", "Morning Routine", "Creative Energy"];
const PLANS = [{
  name: "Founder",
  aed: 749,
  usd: 199
}, {
  name: "Dreamer",
  aed: 1499,
  usd: 399
}];
const CHAT_MESSAGES = [{
  type: "incoming",
  html: "Can we do lunch tomorrow at noon?",
  time: "10:42 AM"
}, {
  type: "outgoing",
  tag: "Scheduling",
  html: "Lunch &mdash; Tomorrow, 12:00 PM<br/>You + Sarah. <strong>Approve?</strong>",
  time: "10:42 AM"
}, {
  type: "incoming",
  html: "Confirmed",
  time: "10:43 AM"
}, {
  type: "outgoing",
  tag: "Synced",
  tagClass: "success-tag",
  html: "Event created &amp; synced to calendar",
  time: "10:43 AM"
}, {
  type: "incoming",
  html: "What's on my calendar tomorrow?",
  time: "10:44 AM"
}, {
  type: "outgoing",
  tag: "Calendar",
  html: "<strong>9 AM</strong> Standup<br/><strong>12 PM</strong> Lunch w/ Sarah<br/><strong>3 PM</strong> Investor call",
  time: "10:44 AM"
}, {
  type: "incoming",
  html: "Summarize my unread emails",
  time: "10:45 AM"
}, {
  type: "outgoing",
  tag: "Email",
  html: "<strong>12 unread</strong> &mdash; key ones:<br/>1. Legal &mdash; NDA ready<br/>2. David &mdash; Q1 deck<br/>3. AWS &mdash; $4,320 due",
  time: "10:45 AM"
}, {
  type: "incoming",
  html: "Remind me to call investor at 5pm",
  time: "10:46 AM"
}, {
  type: "outgoing",
  tag: "Reminder set",
  tagClass: "success-tag",
  html: "I'll ping you at 4:55 PM",
  time: "10:46 AM"
}, {
  type: "incoming",
  html: "Add flight BA 117 LHR&ndash;JFK Friday",
  time: "10:47 AM"
}, {
  type: "outgoing",
  tag: "Travel",
  html: "BA 117 Fri &mdash; LHR 09:30 &rarr; JFK 12:25<br/><strong>Add to calendar?</strong>",
  time: "10:47 AM"
}, {
  type: "incoming",
  html: "Yes, block the whole day",
  time: "10:48 AM"
}, {
  type: "outgoing",
  tag: "Synced",
  tagClass: "success-tag",
  html: "Flight added. Friday blocked.",
  time: "10:48 AM"
}];
function fmt(value, currency) {
  const num = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0
  }).format(value);
  return currency === "AED" ? `AED ${num}` : `$${num}`;
}
function price(aed, usd, currency) {
  return currency === "AED" ? `AED ${aed.toLocaleString("en-US")}` : `$${usd.toLocaleString("en-US")}`;
}
function Home() {
  const [currency, setCurrency] = useState("AED");
  const [currentCost, setCurrentCost] = useState(8799);
  const [selectedPlan, setSelectedPlan] = useState(0);
  const [burgerOpen, setBurgerOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [waitlistStep, setWaitlistStep] = useState("email");
  const [waitlistStatus, setWaitlistStatus] = useState("");
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const requestVerification = useMutation(api.waitlist.requestVerification);
  const verifyCode = useMutation(api.waitlist.verify);
  const planCost = currency === "AED" ? PLANS[selectedPlan].aed : PLANS[selectedPlan].usd;
  const monthlySavings = Math.max(0, currentCost - planCost);
  const annualSavings = monthlySavings * 12;
  const savingsRate = currentCost > 0 ? (monthlySavings / currentCost * 100).toFixed(1) : "0.0";
  const switchCurrency = useCallback((next) => {
    if (next === currency) return;
    setCurrentCost((prev) => next === "AED" ? Math.round(prev * 3.67) : Math.round(prev / 3.67));
    setCurrency(next);
  }, [currency]);
  const closeBurger = useCallback(() => setBurgerOpen(false), []);
  async function handleRequestCode(e) {
    e.preventDefault();
    if (!email.trim()) {
      setWaitlistStatus("Please enter a valid email.");
      return;
    }
    setWaitlistSubmitting(true);
    setWaitlistStatus("");
    try {
      const result = await requestVerification({
        email: email.trim()
      });
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
  async function handleVerify(e) {
    e.preventDefault();
    if (!verificationCode.trim()) {
      setWaitlistStatus("Please enter the 6-digit code.");
      return;
    }
    setWaitlistSubmitting(true);
    setWaitlistStatus("");
    try {
      const result = await verifyCode({
        email: email.trim(),
        code: verificationCode.trim()
      });
      if (result.alreadyVerified) {
        setWaitlistStatus(`You're already verified at position #${result.position}.`);
      } else {
        setWaitlistStatus(`You're #${result.position} on the waitlist! Check your email for confirmation.`);
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
      document.getElementById("viral-status").textContent = "Referral link copied.";
    } catch {
      document.getElementById("viral-status").textContent = `Copy this link: ${link}`;
    }
  }
  useEffect(() => {
    const reveals = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.08,
      rootMargin: "0px 0px -30px 0px"
    });
    reveals.forEach((el) => observer.observe(el));
    const topbar = document.querySelector(".topbar");
    const onScroll = () => topbar == null ? void 0 : topbar.classList.toggle("scrolled", window.scrollY > 20);
    window.addEventListener("scroll", onScroll, {
      passive: true
    });
    onScroll();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  useEffect(() => {
    const el = document.getElementById("typed-text");
    if (!el) return;
    let phraseIdx = 0;
    let charIdx = PHRASES[0].length;
    let deleting = false;
    let timer;
    function step() {
      const phrase = PHRASES[phraseIdx];
      if (!deleting) {
        charIdx++;
        el.textContent = phrase.slice(0, charIdx);
        if (charIdx >= phrase.length) {
          timer = setTimeout(() => {
            deleting = true;
            step();
          }, 2200);
          return;
        }
        timer = setTimeout(step, 70 + Math.random() * 40);
      } else {
        charIdx--;
        el.textContent = phrase.slice(0, charIdx);
        if (charIdx <= 0) {
          deleting = false;
          phraseIdx = (phraseIdx + 1) % PHRASES.length;
          timer = setTimeout(step, 400);
          return;
        }
        timer = setTimeout(step, 35);
      }
    }
    timer = setTimeout(() => {
      deleting = true;
      step();
    }, 2500);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    const allMsgs = document.querySelectorAll(".wa-msg:not(.wa-typing)");
    const waTyping = document.getElementById("wa-typing");
    const waContainer = document.getElementById("wa-messages");
    const MAX_VISIBLE = 12;
    let msgIdx = 0;
    let timer;
    function scrollBottom() {
      if (waContainer) waContainer.scrollTop = waContainer.scrollHeight;
    }
    function hideOldest() {
      const visible = [...allMsgs].filter((m) => m.classList.contains("show"));
      while (visible.length >= MAX_VISIBLE) {
        const old = visible.shift();
        old.classList.remove("show");
        old.style.display = "none";
      }
    }
    function showNext() {
      if (msgIdx >= allMsgs.length) {
        timer = setTimeout(() => {
          allMsgs.forEach((m) => {
            m.classList.remove("show");
            m.style.display = "none";
          });
          if (waTyping) {
            waTyping.classList.remove("show");
            waTyping.style.display = "none";
          }
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
          msg.style.display = "";
          msg.classList.add("show");
          scrollBottom();
          msgIdx++;
          timer = setTimeout(showNext, 1400);
        }, 800);
      } else {
        hideOldest();
        msg.style.display = "";
        msg.classList.add("show");
        scrollBottom();
        msgIdx++;
        timer = setTimeout(showNext, 1e3);
      }
    }
    if (allMsgs.length > 0) timer = setTimeout(showNext, 600);
    return () => clearTimeout(timer);
  }, []);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("div", { className: "grain" }),
    /* @__PURE__ */ jsx("div", { className: "bg-orb orb-1" }),
    /* @__PURE__ */ jsx("div", { className: "bg-orb orb-2" }),
    /* @__PURE__ */ jsx("div", { className: "bg-orb orb-3" }),
    /* @__PURE__ */ jsx("header", { className: "topbar", children: /* @__PURE__ */ jsxs("div", { className: "topbar-inner", children: [
      /* @__PURE__ */ jsx("a", { className: "brand", href: "#", children: "Ecqo" }),
      /* @__PURE__ */ jsxs("nav", { className: burgerOpen ? "open" : "", children: [
        /* @__PURE__ */ jsx("a", { href: "#top", className: "nav-brand", onClick: closeBurger, children: "Ecqo" }),
        /* @__PURE__ */ jsx("a", { href: "#savings", onClick: closeBurger, children: "Savings" }),
        /* @__PURE__ */ jsx("a", { href: "#calculator", onClick: closeBurger, children: "Calculator" }),
        /* @__PURE__ */ jsx("a", { href: "#workflow", onClick: closeBurger, children: "Workflow" }),
        /* @__PURE__ */ jsx("a", { href: "#usecases", onClick: closeBurger, children: "Use Cases" }),
        /* @__PURE__ */ jsx("a", { href: "#pricing", onClick: closeBurger, children: "Pricing" }),
        /* @__PURE__ */ jsx("a", { href: "#faq", onClick: closeBurger, children: "FAQ" })
      ] }),
      /* @__PURE__ */ jsx("a", { className: "button mini desktop-only", href: "#calculator", children: "Get Started" }),
      /* @__PURE__ */ jsxs("div", { className: "currency-toggle", children: [
        /* @__PURE__ */ jsx("button", { type: "button", className: `currency-btn ${currency === "AED" ? "active" : ""}`, onClick: () => switchCurrency("AED"), children: "AED" }),
        /* @__PURE__ */ jsx("button", { type: "button", className: `currency-btn ${currency === "USD" ? "active" : ""}`, onClick: () => switchCurrency("USD"), children: "USD" })
      ] }),
      /* @__PURE__ */ jsx("a", { className: "button mini mobile-cta", href: "#calculator", children: "Get Started" }),
      /* @__PURE__ */ jsxs("button", { type: "button", className: `burger ${burgerOpen ? "open" : ""}`, "aria-label": "Menu", onClick: () => setBurgerOpen((o) => !o), children: [
        /* @__PURE__ */ jsx("span", {}),
        /* @__PURE__ */ jsx("span", {}),
        /* @__PURE__ */ jsx("span", {})
      ] })
    ] }) }),
    /* @__PURE__ */ jsxs("main", { className: "layout", children: [
      /* @__PURE__ */ jsxs("section", { className: "hero", id: "top", children: [
        /* @__PURE__ */ jsxs("div", { className: "hero-content reveal", children: [
          /* @__PURE__ */ jsx("p", { className: "eyebrow", children: "WhatsApp-Native Executive Assistant" }),
          /* @__PURE__ */ jsxs("h1", { children: [
            "Empower your",
            /* @__PURE__ */ jsx("br", {}),
            /* @__PURE__ */ jsxs("span", { className: "typed-line", children: [
              /* @__PURE__ */ jsx("span", { id: "typed-text", children: "Human Assistant" }),
              /* @__PURE__ */ jsx("span", { className: "typed-cursor", children: "|" })
            ] })
          ] }),
          /* @__PURE__ */ jsx("p", { className: "subtitle", children: "Ecqo watches your WhatsApp chats for scheduling, calendar checks, email summaries, reminders, and more — then acts on your behalf. No extra apps. No handoffs. No follow-up leaks." }),
          /* @__PURE__ */ jsxs("div", { className: "hero-actions", children: [
            /* @__PURE__ */ jsx("a", { className: "button", href: "#calculator", children: "Get Started" }),
            /* @__PURE__ */ jsx("a", { className: "ghost", href: "#workflow", children: "See How It Works" })
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "hero-visual reveal delay-1", children: /* @__PURE__ */ jsxs("div", { className: "phone-frame", children: [
          /* @__PURE__ */ jsx("div", { className: "phone-notch" }),
          /* @__PURE__ */ jsxs("div", { className: "phone-screen", children: [
            /* @__PURE__ */ jsxs("div", { className: "wa-header", children: [
              /* @__PURE__ */ jsx("svg", { className: "wa-icon", viewBox: "0 0 24 24", fill: "none", stroke: "#fff", strokeWidth: "2", strokeLinecap: "round", children: /* @__PURE__ */ jsx("path", { d: "M15 18l-6-6 6-6" }) }),
              /* @__PURE__ */ jsx("div", { className: "wa-avatar", children: "E" }),
              /* @__PURE__ */ jsxs("div", { className: "wa-contact", children: [
                /* @__PURE__ */ jsx("span", { className: "wa-name", children: "Ecqo Assistant" }),
                /* @__PURE__ */ jsx("span", { className: "wa-online", children: "online" })
              ] }),
              /* @__PURE__ */ jsxs("svg", { className: "wa-icon", viewBox: "0 0 24 24", fill: "none", stroke: "#fff", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", children: [
                /* @__PURE__ */ jsx("path", { d: "M15.1 4.55a8 8 0 01.9 11.62l.01.01L22 22l-5.82-5.99A8 8 0 1115.1 4.55z" }),
                /* @__PURE__ */ jsx("path", { d: "M13 10v3l2.5 1.5" })
              ] }),
              /* @__PURE__ */ jsxs("svg", { className: "wa-icon", viewBox: "0 0 24 24", fill: "none", stroke: "#fff", strokeWidth: "1.8", strokeLinecap: "round", children: [
                /* @__PURE__ */ jsx("circle", { cx: "12", cy: "5", r: "1" }),
                /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "1" }),
                /* @__PURE__ */ jsx("circle", { cx: "12", cy: "19", r: "1" })
              ] })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "wa-chat", id: "wa-chat", children: /* @__PURE__ */ jsxs("div", { className: "wa-messages", id: "wa-messages", children: [
              CHAT_MESSAGES.map((msg, i) => /* @__PURE__ */ jsx("div", { className: `wa-bubble ${msg.type} wa-msg`, dangerouslySetInnerHTML: {
                __html: (msg.tag ? `<span class="ecqo-tag ${msg.tagClass || ""}">${msg.tag}</span>` : "") + msg.html + `<span class="wa-meta">${msg.time}${msg.type === "outgoing" ? ' <span class="wa-checks">&check;&check;</span>' : ""}</span>`
              } }, i)),
              /* @__PURE__ */ jsxs("div", { className: "wa-typing wa-msg", id: "wa-typing", children: [
                /* @__PURE__ */ jsx("span", {}),
                /* @__PURE__ */ jsx("span", {}),
                /* @__PURE__ */ jsx("span", {})
              ] })
            ] }) }),
            /* @__PURE__ */ jsxs("div", { className: "wa-input-bar", children: [
              /* @__PURE__ */ jsxs("div", { className: "wa-input-field", children: [
                /* @__PURE__ */ jsxs("svg", { className: "wa-input-icon", viewBox: "0 0 24 24", fill: "none", stroke: "#8a8a8a", strokeWidth: "1.8", strokeLinecap: "round", children: [
                  /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "9" }),
                  /* @__PURE__ */ jsx("path", { d: "M8 14s1.5 2 4 2 4-2 4-2" }),
                  /* @__PURE__ */ jsx("circle", { cx: "9", cy: "10", r: ".8", fill: "#8a8a8a", stroke: "none" }),
                  /* @__PURE__ */ jsx("circle", { cx: "15", cy: "10", r: ".8", fill: "#8a8a8a", stroke: "none" })
                ] }),
                /* @__PURE__ */ jsx("span", { children: "Type a message" }),
                /* @__PURE__ */ jsx("svg", { className: "wa-input-icon", viewBox: "0 0 24 24", fill: "none", stroke: "#8a8a8a", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", children: /* @__PURE__ */ jsx("path", { d: "M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.49" }) })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "wa-mic-btn", children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "#fff", stroke: "none", children: [
                /* @__PURE__ */ jsx("path", { d: "M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3z" }),
                /* @__PURE__ */ jsx("path", { d: "M19 11a7 7 0 01-14 0", fill: "none", stroke: "#fff", strokeWidth: "2", strokeLinecap: "round" }),
                /* @__PURE__ */ jsx("path", { d: "M12 18v3M9 21h6", fill: "none", stroke: "#fff", strokeWidth: "2", strokeLinecap: "round" })
              ] }) })
            ] })
          ] })
        ] }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "section-header reveal", id: "savings", children: [
        /* @__PURE__ */ jsx("p", { className: "eyebrow", children: "Cost Snapshot" }),
        /* @__PURE__ */ jsx("h2", { children: "Simple Benchmarks. Clear Savings." })
      ] }),
      /* @__PURE__ */ jsxs("section", { className: "cards three-up", children: [
        /* @__PURE__ */ jsxs("article", { className: "info-card reveal", children: [
          /* @__PURE__ */ jsx("div", { className: "card-icon", children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", children: [
            /* @__PURE__ */ jsx("rect", { x: "3", y: "4", width: "18", height: "16", rx: "3" }),
            /* @__PURE__ */ jsx("path", { d: "M7 9h10M7 13h7M7 17h4" })
          ] }) }),
          /* @__PURE__ */ jsx("p", { className: "label", children: "Remote VA Midpoint" }),
          /* @__PURE__ */ jsxs("p", { className: "value", children: [
            /* @__PURE__ */ jsx("span", { className: "price", children: price(8799, 2400, currency) }),
            /* @__PURE__ */ jsx("span", { children: "/mo" })
          ] }),
          /* @__PURE__ */ jsx("p", { className: "copy", children: "Based on global freelance VA midpoint from Upwork hourly bands." }),
          /* @__PURE__ */ jsx("button", { type: "button", className: "ghost preset", onClick: () => setCurrentCost(currency === "AED" ? 8799 : 2400), children: "Use midpoint" })
        ] }),
        /* @__PURE__ */ jsxs("article", { className: "info-card reveal delay-1", children: [
          /* @__PURE__ */ jsx("div", { className: "card-icon", children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", children: [
            /* @__PURE__ */ jsx("path", { d: "M3 21V7l5-3 4 3 4-3 5 3v14z" }),
            /* @__PURE__ */ jsx("path", { d: "M7 12h10M7 16h6" })
          ] }) }),
          /* @__PURE__ */ jsx("p", { className: "label", children: "Executive Assistant Average" }),
          /* @__PURE__ */ jsxs("p", { className: "value", children: [
            /* @__PURE__ */ jsx("span", { className: "price", children: price(21999, 5945, currency) }),
            /* @__PURE__ */ jsx("span", { children: "/mo" })
          ] }),
          /* @__PURE__ */ jsx("p", { className: "copy", children: "Based on Indeed US average EA salary converted to monthly cost." }),
          /* @__PURE__ */ jsx("button", { type: "button", className: "ghost preset", onClick: () => setCurrentCost(currency === "AED" ? 21999 : 5945), children: "Use average" })
        ] }),
        /* @__PURE__ */ jsxs("article", { className: "info-card highlight reveal delay-2", children: [
          /* @__PURE__ */ jsx("div", { className: "card-icon accent-icon", children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", children: [
            /* @__PURE__ */ jsx("rect", { x: "4", y: "5", width: "16", height: "14", rx: "3" }),
            /* @__PURE__ */ jsx("path", { d: "M8 12h8M8 16h5" }),
            /* @__PURE__ */ jsx("path", { d: "M16 8l3 3-3 3" })
          ] }) }),
          /* @__PURE__ */ jsx("p", { className: "label", children: "Ecqo" }),
          /* @__PURE__ */ jsxs("p", { className: "value", children: [
            "From ",
            /* @__PURE__ */ jsx("span", { className: "price", children: price(749, 199, currency) }),
            /* @__PURE__ */ jsx("span", { children: "/mo" })
          ] }),
          /* @__PURE__ */ jsx("p", { className: "copy", children: "WhatsApp-native automation designed to replace manual assistant overhead." }),
          /* @__PURE__ */ jsx("a", { className: "button", href: "#pricing", children: "Get Started" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("section", { className: "calculator", id: "calculator", children: [
        /* @__PURE__ */ jsxs("div", { className: "calculator-intro reveal", children: [
          /* @__PURE__ */ jsx("p", { className: "eyebrow", children: "Savings Calculator" }),
          /* @__PURE__ */ jsx("h2", { children: "Make the Decision in 15 Seconds" }),
          /* @__PURE__ */ jsx("p", { children: "Enter your current monthly assistant cost and compare it directly with your Ecqo plan." })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "calculator-main reveal delay-1", children: [
          /* @__PURE__ */ jsxs("div", { className: "inputs", children: [
            /* @__PURE__ */ jsxs("label", { children: [
              "Current assistant cost (monthly)",
              /* @__PURE__ */ jsx("input", { type: "number", min: 0, value: currentCost, onChange: (e) => setCurrentCost(Math.max(0, Number(e.target.value) || 0)) })
            ] }),
            /* @__PURE__ */ jsxs("label", { children: [
              "Ecqo plan",
              /* @__PURE__ */ jsx("select", { value: selectedPlan, onChange: (e) => setSelectedPlan(Number(e.target.value)), children: PLANS.map((p, i) => /* @__PURE__ */ jsxs("option", { value: i, children: [
                p.name,
                " — ",
                price(p.aed, p.usd, currency)
              ] }, i)) })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "results", children: [
            /* @__PURE__ */ jsxs("div", { className: "result-row", children: [
              /* @__PURE__ */ jsx("span", { children: "Monthly savings" }),
              /* @__PURE__ */ jsx("strong", { children: fmt(monthlySavings, currency) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "result-row", children: [
              /* @__PURE__ */ jsx("span", { children: "Annual savings" }),
              /* @__PURE__ */ jsx("strong", { children: fmt(annualSavings, currency) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "result-row", children: [
              /* @__PURE__ */ jsx("span", { children: "Savings rate" }),
              /* @__PURE__ */ jsxs("strong", { children: [
                savingsRate,
                "%"
              ] })
            ] })
          ] }),
          waitlistStep === "email" && /* @__PURE__ */ jsxs("form", { className: "waitlist", onSubmit: handleRequestCode, children: [
            /* @__PURE__ */ jsxs("label", { children: [
              "Your email",
              /* @__PURE__ */ jsx("input", { type: "email", required: true, placeholder: "you@office.com", value: email, onChange: (e) => setEmail(e.target.value) })
            ] }),
            /* @__PURE__ */ jsx("button", { type: "submit", className: "button", disabled: waitlistSubmitting, children: waitlistSubmitting ? "Sending..." : "Join the waitlist" }),
            waitlistStatus && /* @__PURE__ */ jsx("p", { className: "status", role: "status", "aria-live": "polite", children: waitlistStatus })
          ] }),
          waitlistStep === "code" && /* @__PURE__ */ jsxs("form", { className: "waitlist", onSubmit: handleVerify, children: [
            /* @__PURE__ */ jsxs("label", { children: [
              "Verification code",
              /* @__PURE__ */ jsx("input", { type: "text", inputMode: "numeric", pattern: "[0-9]{6}", maxLength: 6, required: true, placeholder: "000000", value: verificationCode, onChange: (e) => setVerificationCode(e.target.value.replace(/\D/g, "")), autoFocus: true })
            ] }),
            /* @__PURE__ */ jsx("button", { type: "submit", className: "button", disabled: waitlistSubmitting, children: waitlistSubmitting ? "Verifying..." : "Verify" }),
            /* @__PURE__ */ jsx("button", { type: "button", className: "ghost", onClick: () => {
              setWaitlistStep("email");
              setWaitlistStatus("");
              setVerificationCode("");
            }, children: "Use a different email" }),
            waitlistStatus && /* @__PURE__ */ jsx("p", { className: "status", role: "status", "aria-live": "polite", children: waitlistStatus })
          ] }),
          waitlistStep === "done" && /* @__PURE__ */ jsxs("div", { className: "waitlist", children: [
            waitlistStatus && /* @__PURE__ */ jsx("p", { className: "status", role: "status", "aria-live": "polite", children: waitlistStatus }),
            /* @__PURE__ */ jsx("button", { type: "button", className: "ghost", onClick: () => {
              setWaitlistStep("email");
              setWaitlistStatus("");
            }, children: "Join with another email" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "source-strip reveal", children: /* @__PURE__ */ jsxs("p", { children: [
        "Sources (accessed March 5, 2026):",
        " ",
        /* @__PURE__ */ jsx("a", { href: "https://www.indeed.com/career/executive-assistant/salaries", target: "_blank", rel: "noopener noreferrer", children: "Indeed EA" }),
        " ",
        "and",
        " ",
        /* @__PURE__ */ jsx("a", { href: "https://www.upwork.com/hire/virtual-assistants/cost/", target: "_blank", rel: "noopener noreferrer", children: "Upwork VA cost" }),
        "."
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "section-header reveal", id: "workflow", children: [
        /* @__PURE__ */ jsx("p", { className: "eyebrow", children: "Workflow" }),
        /* @__PURE__ */ jsx("h2", { children: "Built for Fast Decisions in Private Networks" })
      ] }),
      /* @__PURE__ */ jsxs("section", { className: "cards three-up workflow-cards", children: [
        /* @__PURE__ */ jsxs("article", { className: "info-card reveal", children: [
          /* @__PURE__ */ jsx("div", { className: "step-number", children: "01" }),
          /* @__PURE__ */ jsx("div", { className: "card-icon", children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", children: [
            /* @__PURE__ */ jsx("path", { d: "M5 8h14v10a2 2 0 01-2 2H7a2 2 0 01-2-2V8z" }),
            /* @__PURE__ */ jsx("path", { d: "M3 8l3-4h12l3 4" }),
            /* @__PURE__ */ jsx("path", { d: "M9 12h6M9 16h4" })
          ] }) }),
          /* @__PURE__ */ jsx("h3", { children: "Capture" }),
          /* @__PURE__ */ jsx("p", { children: "Ecqo reads approved WhatsApp threads and detects scheduling intent in real time." })
        ] }),
        /* @__PURE__ */ jsxs("article", { className: "info-card reveal delay-1", children: [
          /* @__PURE__ */ jsx("div", { className: "step-number", children: "02" }),
          /* @__PURE__ */ jsx("div", { className: "card-icon", children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", children: [
            /* @__PURE__ */ jsx("rect", { x: "4", y: "4", width: "16", height: "16", rx: "3" }),
            /* @__PURE__ */ jsx("path", { d: "M8 10h8M8 14h6" }),
            /* @__PURE__ */ jsx("path", { d: "M15 17l2 2 4-4" })
          ] }) }),
          /* @__PURE__ */ jsx("h3", { children: "Propose" }),
          /* @__PURE__ */ jsx("p", { children: "It drafts an action-ready proposal with participants, timing, and context." })
        ] }),
        /* @__PURE__ */ jsxs("article", { className: "info-card reveal delay-2", children: [
          /* @__PURE__ */ jsx("div", { className: "step-number", children: "03" }),
          /* @__PURE__ */ jsx("div", { className: "card-icon", children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", children: [
            /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "9" }),
            /* @__PURE__ */ jsx("path", { d: "M12 7v5l3 3" })
          ] }) }),
          /* @__PURE__ */ jsx("h3", { children: "Execute" }),
          /* @__PURE__ */ jsx("p", { children: "Once approved, Ecqo finalizes the event flow and keeps records synchronized." })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "section-header reveal", id: "usecases", children: [
        /* @__PURE__ */ jsx("p", { className: "eyebrow", children: "Use Cases" }),
        /* @__PURE__ */ jsx("h2", { children: "One Chat. Every Task Handled." })
      ] }),
      /* @__PURE__ */ jsxs("section", { className: "cards usecase-grid", children: [
        /* @__PURE__ */ jsxs("article", { className: "usecase-card reveal", children: [
          /* @__PURE__ */ jsx("div", { className: "usecase-icon", children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", children: [
            /* @__PURE__ */ jsx("rect", { x: "3", y: "4", width: "18", height: "18", rx: "3" }),
            /* @__PURE__ */ jsx("path", { d: "M3 10h18" }),
            /* @__PURE__ */ jsx("path", { d: "M9 4v6" }),
            /* @__PURE__ */ jsx("path", { d: "M15 4v6" }),
            /* @__PURE__ */ jsx("path", { d: "M8 15h2M14 15h2M8 19h2" })
          ] }) }),
          /* @__PURE__ */ jsx("h3", { children: "Smart Scheduling" }),
          /* @__PURE__ */ jsx("p", { children: "Detects meeting intent, proposes times, and creates calendar events after approval." }),
          /* @__PURE__ */ jsx("span", { className: "usecase-example", children: `"Let's meet Thursday at 3pm"` })
        ] }),
        /* @__PURE__ */ jsxs("article", { className: "usecase-card reveal delay-1", children: [
          /* @__PURE__ */ jsx("div", { className: "usecase-icon calendar-icon", children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", children: [
            /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "9" }),
            /* @__PURE__ */ jsx("path", { d: "M12 7v5l3 2" }),
            /* @__PURE__ */ jsx("path", { d: "M16.5 16.5l1.5 1.5" })
          ] }) }),
          /* @__PURE__ */ jsx("h3", { children: "Calendar Check" }),
          /* @__PURE__ */ jsx("p", { children: "Ask what's on your calendar today, tomorrow, or any day — get an instant summary." }),
          /* @__PURE__ */ jsx("span", { className: "usecase-example", children: '"What do I have tomorrow?"' })
        ] }),
        /* @__PURE__ */ jsxs("article", { className: "usecase-card reveal delay-2", children: [
          /* @__PURE__ */ jsx("div", { className: "usecase-icon email-icon", children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", children: [
            /* @__PURE__ */ jsx("rect", { x: "2", y: "5", width: "20", height: "14", rx: "3" }),
            /* @__PURE__ */ jsx("path", { d: "M2 7l10 6 10-6" })
          ] }) }),
          /* @__PURE__ */ jsx("h3", { children: "Email Digest" }),
          /* @__PURE__ */ jsx("p", { children: "Get a concise summary of unread emails, flagged threads, or messages from key contacts." }),
          /* @__PURE__ */ jsx("span", { className: "usecase-example", children: '"Summarize my unread emails"' })
        ] }),
        /* @__PURE__ */ jsxs("article", { className: "usecase-card reveal", children: [
          /* @__PURE__ */ jsx("div", { className: "usecase-icon reminder-icon", children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", children: [
            /* @__PURE__ */ jsx("path", { d: "M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" }),
            /* @__PURE__ */ jsx("path", { d: "M13.73 21a2 2 0 01-3.46 0" })
          ] }) }),
          /* @__PURE__ */ jsx("h3", { children: "Reminders & Follow-ups" }),
          /* @__PURE__ */ jsx("p", { children: "Set reminders via chat. Ecqo nudges you at the right time so nothing slips through." }),
          /* @__PURE__ */ jsx("span", { className: "usecase-example", children: '"Remind me to call Sarah at 5pm"' })
        ] }),
        /* @__PURE__ */ jsxs("article", { className: "usecase-card reveal delay-1", children: [
          /* @__PURE__ */ jsx("div", { className: "usecase-icon travel-icon", children: /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", children: /* @__PURE__ */ jsx("path", { d: "M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1L11 12l-2 3H6l-1 1 3 2 2 3 1-1v-3l3-2 3.7 7.3c.2.4.7.5 1.1.3l.5-.3c.4-.2.6-.6.5-1.1z" }) }) }),
          /* @__PURE__ */ jsx("h3", { children: "Travel Coordination" }),
          /* @__PURE__ */ jsx("p", { children: "Share flight details or hotel confirmations — Ecqo adds them to your calendar automatically." }),
          /* @__PURE__ */ jsx("span", { className: "usecase-example", children: '"Add my flight LHR to JFK on Friday"' })
        ] }),
        /* @__PURE__ */ jsxs("article", { className: "usecase-card reveal delay-2", children: [
          /* @__PURE__ */ jsx("div", { className: "usecase-icon brief-icon", children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", children: [
            /* @__PURE__ */ jsx("path", { d: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" }),
            /* @__PURE__ */ jsx("path", { d: "M14 2v6h6" }),
            /* @__PURE__ */ jsx("path", { d: "M8 13h8M8 17h6M8 9h2" })
          ] }) }),
          /* @__PURE__ */ jsx("h3", { children: "Meeting Briefs" }),
          /* @__PURE__ */ jsx("p", { children: "Get a pre-meeting brief with attendee context, agenda, and relevant notes before any call." }),
          /* @__PURE__ */ jsx("span", { className: "usecase-example", children: '"Brief me on my 2pm meeting"' })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "section-header reveal", id: "pricing", children: [
        /* @__PURE__ */ jsx("p", { className: "eyebrow", children: "Pricing" }),
        /* @__PURE__ */ jsx("h2", { children: "Choose a plan that works for you" })
      ] }),
      /* @__PURE__ */ jsxs("section", { className: "cards three-up pricing-grid", children: [
        /* @__PURE__ */ jsxs("article", { className: "info-card reveal", children: [
          /* @__PURE__ */ jsx("p", { className: "label", children: "Founder" }),
          /* @__PURE__ */ jsxs("p", { className: "value", children: [
            /* @__PURE__ */ jsx("span", { className: "price", children: price(749, 199, currency) }),
            /* @__PURE__ */ jsx("span", { children: "/month" })
          ] }),
          /* @__PURE__ */ jsxs("ul", { children: [
            /* @__PURE__ */ jsx("li", { children: "1 principal line" }),
            /* @__PURE__ */ jsx("li", { children: "Unlimited scheduling detections" }),
            /* @__PURE__ */ jsx("li", { children: "Proposal + approval flow" })
          ] }),
          /* @__PURE__ */ jsx("a", { className: "button", href: "#calculator", children: "Get Started" })
        ] }),
        /* @__PURE__ */ jsxs("article", { className: "info-card highlight reveal delay-1", children: [
          /* @__PURE__ */ jsx("div", { className: "popular-badge", children: "Most Popular" }),
          /* @__PURE__ */ jsx("p", { className: "label", children: "Dreamer" }),
          /* @__PURE__ */ jsxs("p", { className: "value", children: [
            /* @__PURE__ */ jsx("span", { className: "price", children: price(1499, 399, currency) }),
            /* @__PURE__ */ jsx("span", { children: "/month" })
          ] }),
          /* @__PURE__ */ jsxs("ul", { children: [
            /* @__PURE__ */ jsx("li", { children: "Up to 5 principals" }),
            /* @__PURE__ */ jsx("li", { children: "Priority rule logic" }),
            /* @__PURE__ */ jsx("li", { children: "Shared operations view" })
          ] }),
          /* @__PURE__ */ jsx("a", { className: "button", href: "#calculator", children: "Get Started" })
        ] }),
        /* @__PURE__ */ jsxs("article", { className: "info-card reveal delay-2", children: [
          /* @__PURE__ */ jsx("p", { className: "label", children: "Custom" }),
          /* @__PURE__ */ jsx("p", { className: "value", children: "TBD" }),
          /* @__PURE__ */ jsxs("ul", { children: [
            /* @__PURE__ */ jsx("li", { children: "Customizable for your team" }),
            /* @__PURE__ */ jsx("li", { children: "Dedicated onboarding" }),
            /* @__PURE__ */ jsx("li", { children: "Dedicated support" })
          ] }),
          /* @__PURE__ */ jsx("a", { className: "button", href: "#calculator", children: "Get Started" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("section", { className: "faq-section", id: "faq", children: [
        /* @__PURE__ */ jsx("div", { className: "section-header reveal", children: /* @__PURE__ */ jsx("h2", { children: "Frequently Asked Questions" }) }),
        /* @__PURE__ */ jsxs("div", { className: "faq-list reveal", children: [
          /* @__PURE__ */ jsxs("details", { children: [
            /* @__PURE__ */ jsx("summary", { children: "Is this WhatsApp-only?" }),
            /* @__PURE__ */ jsx("p", { children: "Yes. Ecqo is intentionally focused on direct WhatsApp Meta Cloud API integration. Everything happens inside the chat you already use." })
          ] }),
          /* @__PURE__ */ jsxs("details", { children: [
            /* @__PURE__ */ jsx("summary", { children: "Can we enforce approvals before scheduling?" }),
            /* @__PURE__ */ jsx("p", { children: "Yes. Events remain pending until required participants approve. Nothing gets added to your calendar without your explicit confirmation." })
          ] }),
          /* @__PURE__ */ jsxs("details", { children: [
            /* @__PURE__ */ jsx("summary", { children: "How does calendar check work?" }),
            /* @__PURE__ */ jsx("p", { children: `Just ask "What's on my calendar today?" or "Am I free Friday afternoon?" and Ecqo pulls your schedule in real time, giving you a clean summary right in chat.` })
          ] }),
          /* @__PURE__ */ jsxs("details", { children: [
            /* @__PURE__ */ jsx("summary", { children: "Which email providers are supported?" }),
            /* @__PURE__ */ jsx("p", { children: "Ecqo integrates with Gmail and Outlook. Ask for unread summaries, search for emails from specific contacts, or get flagged thread digests on demand." })
          ] }),
          /* @__PURE__ */ jsxs("details", { children: [
            /* @__PURE__ */ jsx("summary", { children: "Can Ecqo set reminders and follow-ups?" }),
            /* @__PURE__ */ jsx("p", { children: 'Yes. Say "Remind me to call Sarah at 5pm" or "Follow up with the investor next Monday" and Ecqo will notify you at the right time via WhatsApp.' })
          ] }),
          /* @__PURE__ */ jsxs("details", { children: [
            /* @__PURE__ */ jsx("summary", { children: "Is this still cost-effective vs remote assistant models?" }),
            /* @__PURE__ */ jsx("p", { children: "Yes. The calculator above compares against both remote VA midpoint and EA averages. Ecqo handles the repetitive coordination so your human assistant can focus on high-value work." })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("section", { className: "referral reveal", id: "referral", children: [
        /* @__PURE__ */ jsxs("div", { className: "referral-content", children: [
          /* @__PURE__ */ jsx("p", { className: "eyebrow", children: "Referral Loop" }),
          /* @__PURE__ */ jsx("h2", { children: "Share Ecqo with Your Operator Network" }),
          /* @__PURE__ */ jsx("p", { children: "Invite two qualified operators and unlock one free month." })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "ref-actions", children: [
          /* @__PURE__ */ jsx("button", { className: "button", type: "button", onClick: copyReferralLink, children: "Copy Referral Link" }),
          /* @__PURE__ */ jsx("a", { className: "ghost", target: "_blank", rel: "noopener noreferrer", href: "https://wa.me/?text=Ecqo%20replaces%20EA%2FVA%20work%20inside%20WhatsApp.%20See%20it%20here%3A%20https%3A%2F%2Fwww.ecqo.ai%2F", children: "Share on WhatsApp" }),
          /* @__PURE__ */ jsx("p", { id: "viral-status", className: "status", role: "status", "aria-live": "polite" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx("footer", { className: "footer", children: /* @__PURE__ */ jsxs("div", { className: "footer-inner", children: [
      /* @__PURE__ */ jsx("a", { className: "brand", href: "#", children: "Ecqo" }),
      /* @__PURE__ */ jsx("p", { children: "WhatsApp-native executive assistant automation." })
    ] }) })
  ] });
}
export {
  Home as component
};
