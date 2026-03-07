/** Adds click-to-zoom behavior to all Mermaid diagrams */
export function setupMermaidZoom() {
  if (typeof window === "undefined") return;

  const handleClick = (e: Event) => {
    const target = (e.target as HTMLElement).closest(".mermaid");
    if (!target) return;

    // Toggle zoomed class
    if (target.classList.contains("zoomed")) {
      target.classList.remove("zoomed");
      document.body.style.overflow = "";
    } else {
      // Close any other zoomed diagram first
      document.querySelectorAll(".mermaid.zoomed").forEach((el) => {
        el.classList.remove("zoomed");
      });
      target.classList.add("zoomed");
      document.body.style.overflow = "hidden";
    }
  };

  // Close on Escape key
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".mermaid.zoomed").forEach((el) => {
        el.classList.remove("zoomed");
      });
      document.body.style.overflow = "";
    }
  };

  document.addEventListener("click", handleClick);
  document.addEventListener("keydown", handleKeydown);
}
