import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useLocale } from "../i18n/locale";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { locale, setLocale, t } = useLocale();
  const [burgerOpen, setBurgerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
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

  // Header scroll effect
  useEffect(() => {
    const topbar = document.querySelector(".topbar");
    const onScroll = () =>
      topbar?.classList.toggle("scrolled", window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <div className="grain" />
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />

      {/* ── Header ── */}
      <header className="topbar scrolled">
        <div className="topbar-inner">
          <a className="brand" href="/"><img src="/logos/logo-icon.png" alt="" className="brand-icon" />{t.brandName}</a>
          <nav className={burgerOpen ? "open" : ""}>
            <a href="/#top" className="nav-brand" onClick={closeBurger}><img src="/logos/logo-icon.png" alt="" className="brand-icon" />{t.brandName}</a>
            <a href="/#savings" onClick={closeBurger}>{t.nav.savings}</a>
            <a href="/#calculator" onClick={closeBurger}>{t.nav.calculator}</a>
            <a href="/#workflow" onClick={closeBurger}>{t.nav.workflow}</a>
            <a href="/#usecases" onClick={closeBurger}>{t.nav.useCases}</a>
            <a href="/#pricing" onClick={closeBurger}>{t.nav.pricing}</a>
            <a href="/#faq" onClick={closeBurger}>{t.nav.faq}</a>
          </nav>
          <a className="button mini desktop-only" href="/#calculator">{t.nav.getStarted}</a>
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
            </div>
          </div>
          <a className="button mini mobile-cta" href="/#calculator">{t.nav.getStarted}</a>
          <button type="button" className={`burger ${burgerOpen ? "open" : ""}`} aria-label="Menu" onClick={() => setBurgerOpen((o) => !o)}>
            <span /><span /><span />
          </button>
        </div>
      </header>

      {children}

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-top">
            <div className="footer-brand">
              <a className="brand" href="/"><img src="/logos/logo-icon.png" alt="" className="brand-icon" />{t.brandName}</a>
              <p>{t.footer.description}</p>
            </div>
            <div className="footer-links">
              <div className="footer-col">
                <h4>{t.footer.product}</h4>
                <a href="/#savings">{t.nav.savings}</a>
                <a href="/#calculator">{t.nav.calculator}</a>
                <a href="/#workflow">{t.nav.workflow}</a>
                <a href="/#pricing">{t.nav.pricing}</a>
              </div>
              <div className="footer-col">
                <h4>{t.footer.company}</h4>
                <a href="/#faq">{t.nav.faq}</a>
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
