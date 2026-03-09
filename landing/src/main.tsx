import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LocaleProvider } from "./i18n/locale";
import { Home } from "./pages/Home";
import { Verify } from "./pages/Verify";
import { Privacy } from "./pages/Privacy";
import { Terms } from "./pages/Terms";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LocaleProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
        </Routes>
      </BrowserRouter>
    </LocaleProvider>
  </StrictMode>,
);
