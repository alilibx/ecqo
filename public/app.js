// Currency state
let currency = "AED";

const waitlistForm = document.getElementById("waitlist-form");
const waitlistStatus = document.getElementById("waitlist-status");
const currentCostInput = document.getElementById("current-cost");
const planCostInput = document.getElementById("plan-cost");
const monthlySavingsEl = document.getElementById("monthly-savings");
const annualSavingsEl = document.getElementById("annual-savings");
const savingsRateEl = document.getElementById("savings-rate");
const copyLinkButton = document.getElementById("copy-link");
const viralStatus = document.getElementById("viral-status");
const presetButtons = document.querySelectorAll(".preset");
const currencyButtons = document.querySelectorAll(".currency-btn");
const priceElements = document.querySelectorAll(".price");

function formatCurrency(value) {
  const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
  if (currency === "AED") {
    return `AED ${num}`;
  }
  return `$${num}`;
}

function updateSavings() {
  const current = Math.max(0, Number(currentCostInput?.value) || 0);
  const ecqo = Math.max(0, Number(planCostInput?.value) || 0);

  const monthlySavings = Math.max(0, current - ecqo);
  const annualSavings = monthlySavings * 12;
  const savingsRate = current > 0 ? (monthlySavings / current) * 100 : 0;

  if (monthlySavingsEl) {
    monthlySavingsEl.textContent = formatCurrency(monthlySavings);
  }

  if (annualSavingsEl) {
    annualSavingsEl.textContent = formatCurrency(annualSavings);
  }

  if (savingsRateEl) {
    savingsRateEl.textContent = `${savingsRate.toFixed(1)}%`;
  }
}

function switchCurrency(newCurrency) {
  if (newCurrency === currency) return;
  currency = newCurrency;
  const key = currency.toLowerCase();

  // Toggle active class on buttons
  currencyButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.currency === currency);
  });

  // Swap static price labels
  priceElements.forEach((el) => {
    const text = el.dataset[key];
    if (text) el.textContent = text;
  });

  // Swap calculator select options
  if (planCostInput) {
    [...planCostInput.options].forEach((opt) => {
      const val = opt.dataset[key];
      if (val) {
        opt.value = val;
        const name = opt.textContent.split("—")[0].trim();
        const formatted = currency === "AED"
          ? `AED ${Number(val).toLocaleString("en-US")}`
          : `$${Number(val).toLocaleString("en-US")}`;
        opt.textContent = `${name} — ${formatted}`;
      }
    });
  }

  // Swap preset button data-monthly
  presetButtons.forEach((btn) => {
    const val = btn.dataset[`monthly${currency === "AED" ? "Aed" : "Usd"}`];
    if (val) btn.dataset.monthly = val;
  });

  // Convert calculator input value
  if (currentCostInput) {
    const current = Number(currentCostInput.value) || 0;
    if (currency === "AED") {
      currentCostInput.value = String(Math.round(current * 3.67));
    } else {
      currentCostInput.value = String(Math.round(current / 3.67));
    }
  }

  updateSavings();
}

function applyPreset(event) {
  const button = event.currentTarget;
  const monthly = Number(button.dataset.monthly || 0);
  if (!Number.isFinite(monthly) || monthly <= 0 || !currentCostInput) {
    return;
  }

  currentCostInput.value = String(monthly);
  updateSavings();
  currentCostInput.focus();
}

async function copyReferralLink() {
  const link = "https://www.ecqo.ai/?ref=private-network";
  try {
    await navigator.clipboard.writeText(link);
    viralStatus.textContent = "Referral link copied.";
  } catch {
    viralStatus.textContent = `Copy this link: ${link}`;
  }
}

function submitWaitlist(event) {
  event.preventDefault();
  const email = document.getElementById("email")?.value.trim();

  if (!email) {
    waitlistStatus.textContent = "Please enter a valid email.";
    return;
  }

  waitlistStatus.textContent = "Private access request received. We will contact you shortly.";
  waitlistForm.reset();
}

currencyButtons.forEach((btn) => {
  btn.addEventListener("click", () => switchCurrency(btn.dataset.currency));
});

presetButtons.forEach((button) => {
  button.addEventListener("click", applyPreset);
});

currentCostInput?.addEventListener("input", updateSavings);
planCostInput?.addEventListener("change", updateSavings);
copyLinkButton?.addEventListener("click", copyReferralLink);
waitlistForm?.addEventListener("submit", submitWaitlist);

updateSavings();

// Typing headline rotation
const typedEl = document.getElementById("typed-text");
const phrases = ["Human Assistant", "Entire Workflow", "Morning Routine", "Creative Energy"];
let phraseIdx = 0;
let charIdx = 15;
let deleting = false;

function typeStep() {
  if (!typedEl) return;
  const phrase = phrases[phraseIdx];
  if (!deleting) {
    charIdx++;
    typedEl.textContent = phrase.slice(0, charIdx);
    if (charIdx >= phrase.length) {
      setTimeout(() => { deleting = true; typeStep(); }, 2200);
      return;
    }
    setTimeout(typeStep, 70 + Math.random() * 40);
  } else {
    charIdx--;
    typedEl.textContent = phrase.slice(0, charIdx);
    if (charIdx <= 0) {
      deleting = false;
      phraseIdx = (phraseIdx + 1) % phrases.length;
      setTimeout(typeStep, 400);
      return;
    }
    setTimeout(typeStep, 35);
  }
}

if (typedEl) setTimeout(() => { deleting = true; typeStep(); }, 2500);

// Continuous chat message sequencer (sliding window)
const waTyping = document.getElementById("wa-typing");
const allMsgs = document.querySelectorAll(".wa-msg:not(.wa-typing)");
const MAX_VISIBLE = 12;
let msgIdx = 0;

const waContainer = document.getElementById("wa-messages");

function scrollToBottom() {
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

function showNextMsg() {
  if (msgIdx >= allMsgs.length) {
    setTimeout(() => {
      allMsgs.forEach((m) => { m.classList.remove("show"); m.style.display = "none"; });
      if (waTyping) { waTyping.classList.remove("show"); waTyping.style.display = "none"; }
      msgIdx = 0;
      setTimeout(showNextMsg, 600);
    }, 3500);
    return;
  }

  const msg = allMsgs[msgIdx];
  const isOutgoing = msg.classList.contains("outgoing");

  if (isOutgoing && waTyping) {
    hideOldest();
    waTyping.classList.add("show");
    scrollToBottom();
    setTimeout(() => {
      waTyping.classList.remove("show");
      waTyping.style.display = "none";
      hideOldest();
      msg.style.display = "";
      msg.classList.add("show");
      scrollToBottom();
      msgIdx++;
      setTimeout(showNextMsg, 1400);
    }, 800);
  } else {
    hideOldest();
    msg.style.display = "";
    msg.classList.add("show");
    scrollToBottom();
    msgIdx++;
    setTimeout(showNextMsg, 1000);
  }
}

if (allMsgs.length > 0) setTimeout(showNextMsg, 600);

// Scroll reveal
const revealElements = document.querySelectorAll(".reveal");
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.08, rootMargin: "0px 0px -30px 0px" }
);
revealElements.forEach((el) => revealObserver.observe(el));

// Header scroll effect
const topbar = document.querySelector(".topbar");
if (topbar) {
  const onScroll = () => topbar.classList.toggle("scrolled", window.scrollY > 20);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}
