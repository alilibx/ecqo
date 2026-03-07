import DefaultTheme from "vitepress/theme";
import "./custom.css";
import { setupMermaidZoom } from "./mermaid-zoom";
import { onMounted, watch } from "vue";
import { useRoute } from "vitepress";
import type { Theme } from "vitepress";
import ArchDiagram from "./components/ArchDiagram.vue";

const theme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("ArchDiagram", ArchDiagram);
  },
  setup() {
    const route = useRoute();
    onMounted(() => {
      setupMermaidZoom();
    });
    // Re-setup when route changes (diagrams re-render)
    watch(
      () => route.path,
      () => {
        // Close any open zoom on navigation
        document.querySelectorAll(".mermaid.zoomed").forEach((el) => {
          el.classList.remove("zoomed");
        });
        document.body.style.overflow = "";
      }
    );
  },
};

export default theme;
