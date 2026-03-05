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

function formatUsd(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function updateSavings() {
  const current = Math.max(0, Number(currentCostInput?.value) || 0);
  const ecqo = Math.max(0, Number(planCostInput?.value) || 0);

  const monthlySavings = Math.max(0, current - ecqo);
  const annualSavings = monthlySavings * 12;
  const savingsRate = current > 0 ? (monthlySavings / current) * 100 : 0;

  if (monthlySavingsEl) {
    monthlySavingsEl.textContent = formatUsd(monthlySavings);
  }

  if (annualSavingsEl) {
    annualSavingsEl.textContent = formatUsd(annualSavings);
  }

  if (savingsRateEl) {
    savingsRateEl.textContent = `${savingsRate.toFixed(1)}%`;
  }
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

presetButtons.forEach((button) => {
  button.addEventListener("click", applyPreset);
});

currentCostInput?.addEventListener("input", updateSavings);
planCostInput?.addEventListener("change", updateSavings);
copyLinkButton?.addEventListener("click", copyReferralLink);
waitlistForm?.addEventListener("submit", submitWaitlist);

updateSavings();

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
