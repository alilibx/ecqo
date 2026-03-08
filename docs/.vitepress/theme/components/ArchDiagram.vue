<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";

const props = defineProps({
  config: { type: Object, required: true },
});

const container = ref(null);
const nodeRefs = ref({});
const layerRefs = ref({});
const paths = ref([]);

/* Unique ID per instance — prevents SVG marker collisions on pages with multiple diagrams */
const uid = Math.random().toString(36).slice(2, 8);

/* Diagram type detection */
const diagramType = computed(() => props.config.type || "layers");

/* ── Sequence diagram state ── */
const actorRefs = ref({});
const seqData = ref({ lifelines: [], messages: [], notes: [], groups: [] });
const seqBodyHeight = ref(200);

/* ── Flow diagram state ── */
const flowNodeRefs = ref({});
const flowData = ref({ edges: [], groups: [] });
const flowSvgSize = ref({ width: "100%", height: "100%" });

/* ── State diagram state ── */
const stateNodeRefs = ref({});
const stateData = ref({ transitions: [], groups: [] });
const stateSvgSize = ref({ width: "100%", height: "100%" });

/* ── Shared palette ── */
const layerPalette = {
  teal: {
    bg: "#e8f5f2",
    border: "#0d7a6a",
    accent: "#0d7a6a",
    label: "#094f44",
    iconBg: "#d0ece6",
  },
  warm: {
    bg: "#fef9f2",
    border: "#e8e0d0",
    accent: "#d4a017",
    label: "#3d362d",
    iconBg: "#f5edd8",
  },
  red: {
    bg: "#fff0ec",
    border: "#e04b2c",
    accent: "#e04b2c",
    label: "#b33a1f",
    iconBg: "#fdd8cf",
  },
  dark: {
    bg: "#edf5f3",
    border: "#094f44",
    accent: "#094f44",
    label: "#094f44",
    iconBg: "#c8e6df",
  },
  blue: {
    bg: "#eef4fd",
    border: "#2563eb",
    accent: "#2563eb",
    label: "#1e40af",
    iconBg: "#dbe8fc",
  },
};

/* ── Shared icon helpers ── */
function isIconify(icon) {
  return (
    icon.startsWith("si:") ||
    icon.startsWith("mdi:") ||
    icon.startsWith("logos:") ||
    icon.startsWith("carbon:") ||
    icon.startsWith("tabler:")
  );
}

function iconifyName(icon) {
  if (icon.startsWith("si:")) return "simple-icons:" + icon.slice(3);
  return icon;
}

/* ── Layers mode ── */
function getLayerStyle(layer) {
  const p = layerPalette[layer.color] || layerPalette.warm;
  return {
    "--l-bg": p.bg,
    "--l-border": p.border,
    "--l-accent": p.accent,
    "--l-label": p.label,
    "--l-icon-bg": p.iconBg,
  };
}

function setNodeRef(id, el) {
  if (el) nodeRefs.value[id] = el;
}

function setLayerRef(id, el) {
  if (el) layerRefs.value[id] = el;
}

function computePaths() {
  if (!container.value) return;
  const cr = container.value.getBoundingClientRect();
  const R = 8;
  const result = [];

  /* Build layer bounds + node→layer lookup */
  const layers = props.config.layers || [];
  const lBounds = {};
  for (const layer of layers) {
    const el = layerRefs.value[layer.id];
    if (!el) continue;
    const r = el.getBoundingClientRect();
    lBounds[layer.id] = { top: r.top - cr.top, bottom: r.bottom - cr.top };
  }
  const nodeLayer = {};
  for (const layer of layers) {
    for (const node of layer.nodes) {
      nodeLayer[node.id] = layer.id;
    }
  }
  const layerOrder = layers.map((l) => l.id);

  for (const conn of props.config.connections || []) {
    const fromEl = nodeRefs.value[conn.from];
    const toEl = nodeRefs.value[conn.to];
    if (!fromEl || !toEl) continue;

    const fr = fromEl.getBoundingClientRect();
    const tr = toEl.getBoundingClientRect();

    const x1 = fr.left + fr.width / 2 - cr.left;
    const y1 = fr.bottom - cr.top;
    const x2 = tr.left + tr.width / 2 - cr.left;
    const y2 = tr.top - cr.top;

    const goingUp = y2 < y1;
    const gap = Math.abs(y2 - y1);

    /* Compute midY: route through the gap between layers, not through a layer */
    let midY;
    const fromLid = nodeLayer[conn.from];
    const toLid = nodeLayer[conn.to];
    const fromIdx = layerOrder.indexOf(fromLid);
    const toIdx = layerOrder.indexOf(toLid);

    if (fromLid && toLid && fromLid !== toLid && lBounds[fromLid] && lBounds[toLid]) {
      /* Different layers — route through the first gap after source layer */
      const nextIdx = fromIdx < toIdx ? fromIdx + 1 : fromIdx - 1;
      const nextLid = layerOrder[nextIdx];
      const srcB = lBounds[fromLid];
      const nxtB = lBounds[nextLid];
      if (srcB && nxtB) {
        midY = fromIdx < toIdx
          ? (srcB.bottom + nxtB.top) / 2
          : (srcB.top + nxtB.bottom) / 2;
      } else {
        midY = goingUp ? y1 - gap / 2 : y1 + gap / 2;
      }
    } else {
      /* Same layer or fallback */
      midY = goingUp ? y1 - gap / 2 : y1 + gap / 2;
    }

    let d;
    if (Math.abs(x1 - x2) < 3) {
      d = `M ${x1} ${y1} L ${x2} ${y2}`;
    } else {
      const dx = x2 > x1 ? 1 : -1;
      const dy = goingUp ? -1 : 1;
      const r = Math.min(R, Math.abs(midY - y1) / 2, Math.abs(y2 - midY) / 2, Math.abs(x2 - x1) / 2);

      d = [
        `M ${x1} ${y1}`,
        `L ${x1} ${midY - dy * r}`,
        `Q ${x1} ${midY} ${x1 + dx * r} ${midY}`,
        `L ${x2 - dx * r} ${midY}`,
        `Q ${x2} ${midY} ${x2} ${midY + dy * r}`,
        `L ${x2} ${y2}`,
      ].join(" ");
    }

    const lx = (x1 + x2) / 2;
    const ly = midY;

    result.push({ d, label: conn.label, lx, ly });
  }

  paths.value = result;
}

/* ── Sequence mode ── */
function setActorRef(id, el) {
  if (el) actorRefs.value[id] = el;
}

function getActorStyle(actor) {
  const p = layerPalette[actor.color] || layerPalette.teal;
  return {
    "--a-accent": p.accent,
    "--a-bg": p.bg,
    "--a-border": p.border,
    "--a-label": p.label,
    "--a-icon-bg": p.iconBg,
  };
}

function computeSeqLayout() {
  if (!container.value) return;
  const cr = container.value.getBoundingClientRect();

  const actors = props.config.actors || [];
  const steps = props.config.steps || [];
  const groups = props.config.groups || [];

  /* Measure actor positions */
  const actorPos = {};
  let maxActorBottom = 0;
  for (const actor of actors) {
    const el = actorRefs.value[actor.id];
    if (!el) continue;
    const r = el.getBoundingClientRect();
    actorPos[actor.id] = {
      cx: r.left + r.width / 2 - cr.left,
      bottom: r.bottom - cr.top,
    };
    maxActorBottom = Math.max(maxActorBottom, r.bottom - cr.top);
  }

  /* Compute step Y positions */
  const ROW_H = 44;
  const NOTE_PAD = 12;
  const NOTE_LINE_H = 14;
  const startY = maxActorBottom + 24;
  const stepYs = [];
  const stepHs = [];
  let y = startY;

  for (const step of steps) {
    stepYs.push(y);
    if (step.note) {
      const lines = step.note.split("\n").length;
      const h = Math.max(ROW_H, NOTE_PAD * 2 + lines * NOTE_LINE_H);
      stepHs.push(h);
      y += h;
    } else {
      stepHs.push(ROW_H);
      y += ROW_H;
    }
  }

  const totalHeight = y + 20;
  seqBodyHeight.value = totalHeight - maxActorBottom;

  /* Lifelines */
  const lifelines = actors.map((a) => ({
    x: actorPos[a.id]?.cx || 0,
    y1: actorPos[a.id]?.bottom || 0,
    y2: totalHeight,
  }));

  /* Messages & Notes */
  const messages = [];
  const notes = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const cy = stepYs[i] + stepHs[i] / 2;

    if (step.from && step.to) {
      const fromX = actorPos[step.from]?.cx || 0;
      const toX = actorPos[step.to]?.cx || 0;
      if (!fromX && !toX) continue;
      const dir = toX > fromX ? 1 : -1;

      messages.push({
        x1: fromX + dir * 2,
        x2: toX - dir * 2,
        y: cy,
        label: step.label,
        dashed: !!step.dashed,
        lx: (fromX + toX) / 2,
        lw: step.label ? step.label.length * 6 + 16 : 0,
      });
    } else if (step.note && step.over) {
      const overs = Array.isArray(step.over) ? step.over : [step.over];
      const xs = overs.map((id) => actorPos[id]?.cx || 0).filter(Boolean);
      if (!xs.length) continue;

      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const lines = step.note.split("\n");
      const maxLineLen = Math.max(...lines.map((l) => l.length));

      let noteX, noteW;
      if (overs.length === 1) {
        noteW = Math.max(130, Math.min(220, maxLineLen * 6.5 + 24));
        noteX = minX - noteW / 2;
      } else {
        noteX = minX - 12;
        noteW = maxX - minX + 24;
      }

      const noteCX = overs.length === 1 ? minX : (minX + maxX) / 2;
      const noteY = stepYs[i] + 2;
      const noteH = stepHs[i] - 4;
      const textStartY =
        noteY + noteH / 2 - ((lines.length - 1) * NOTE_LINE_H) / 2;

      notes.push({
        x: noteX,
        y: noteY,
        width: noteW,
        height: noteH,
        lines,
        cx: noteCX,
        textStartY,
      });
    }
  }

  /* Groups */
  const groupData = groups.map((g) => {
    const fy = stepYs[g.from] ?? startY;
    const ty = (stepYs[g.to] ?? startY) + (stepHs[g.to] ?? ROW_H);
    const pal = layerPalette[g.color] || layerPalette.teal;
    return {
      x: 8,
      y: fy - 10,
      width: cr.width - 16,
      height: ty - fy + 20,
      fill: pal.bg,
      stroke: pal.border,
      label: g.label,
      labelColor: pal.label,
    };
  });

  seqData.value = { lifelines, messages, notes, groups: groupData };
}

/* ── Flow diagram ── */
function setFlowNodeRef(id, el) {
  if (el) flowNodeRefs.value[id] = el;
}

function getFlowNodeStyle(node) {
  const p = layerPalette[node.color] || layerPalette.teal;
  return {
    "--n-bg": p.bg,
    "--n-border": p.border,
    "--n-accent": p.accent,
    "--n-label": p.label,
    "--n-icon-bg": p.iconBg,
    "grid-row": (node.row || 0) + 1,
    "grid-column": (node.col || 0) + 1,
  };
}

const flowGridStyle = computed(() => {
  if (diagramType.value !== "flow") return {};
  const nodes = props.config.nodes || [];
  let maxCol = 0;
  for (const n of nodes) maxCol = Math.max(maxCol, n.col || 0);
  const cols = maxCol + 1;
  const style = {};
  if (cols <= 3) {
    style["grid-template-columns"] = `repeat(${cols}, 1fr)`;
  } else if (cols <= 5) {
    style["grid-template-columns"] = `repeat(${cols}, 1fr)`;
    style["gap"] = "32px 16px";
  } else if (cols <= 7) {
    /* Medium-wide grids */
    const colW = 120;
    const gap = 14;
    style["grid-template-columns"] = `repeat(${cols}, ${colW}px)`;
    style["gap"] = `28px ${gap}px`;
    style["min-width"] = `${cols * colW + (cols - 1) * gap}px`;
  } else {
    /* Very wide grids (8+ cols): use compact columns with tighter spacing */
    const colW = 100;
    const gap = 10;
    style["grid-template-columns"] = `repeat(${cols}, ${colW}px)`;
    style["gap"] = `24px ${gap}px`;
    style["min-width"] = `${cols * colW + (cols - 1) * gap}px`;
  }
  return style;
});

function computeFlowLayout() {
  if (!container.value) return;
  const el = container.value;
  const cr = el.getBoundingClientRect();

  /* Size SVGs to match scrollable content, not just the visible viewport */
  flowSvgSize.value = {
    width: Math.max(el.scrollWidth, cr.width) + "px",
    height: Math.max(el.scrollHeight, cr.height) + "px",
  };
  const nodes = props.config.nodes || [];
  const edges = props.config.edges || [];
  const groups = props.config.groups || [];
  const dir = props.config.direction || "TD";
  const R = 8;

  const nodeById = {};
  for (const n of nodes) nodeById[n.id] = n;

  /* Measure node positions */
  const nodePos = {};
  for (const node of nodes) {
    const el = flowNodeRefs.value[node.id];
    if (!el) continue;
    const r = el.getBoundingClientRect();
    nodePos[node.id] = {
      cx: r.left + r.width / 2 - cr.left,
      cy: r.top + r.height / 2 - cr.top,
      top: r.top - cr.top,
      bottom: r.bottom - cr.top,
      left: r.left - cr.left,
      right: r.right - cr.left,
    };
  }

  /* Compute edges */
  const edgeData = [];
  for (const edge of edges) {
    const from = nodePos[edge.from];
    const to = nodePos[edge.to];
    if (!from || !to) continue;

    const fn = nodeById[edge.from];
    const tn = nodeById[edge.to];
    const rowDiff = (tn?.row || 0) - (fn?.row || 0);
    const colDiff = (tn?.col || 0) - (fn?.col || 0);

    let x1, y1, x2, y2, routeAxis;

    if (dir === "TD" || dir === "TB") {
      if (rowDiff !== 0) {
        routeAxis = "v";
        if (rowDiff > 0) { x1 = from.cx; y1 = from.bottom; x2 = to.cx; y2 = to.top; }
        else { x1 = from.cx; y1 = from.top; x2 = to.cx; y2 = to.bottom; }
      } else {
        routeAxis = "h";
        if (colDiff > 0) { x1 = from.right; y1 = from.cy; x2 = to.left; y2 = to.cy; }
        else { x1 = from.left; y1 = from.cy; x2 = to.right; y2 = to.cy; }
      }
    } else {
      if (colDiff !== 0) {
        routeAxis = "h";
        if (colDiff > 0) { x1 = from.right; y1 = from.cy; x2 = to.left; y2 = to.cy; }
        else { x1 = from.left; y1 = from.cy; x2 = to.right; y2 = to.cy; }
      } else {
        routeAxis = "v";
        if (rowDiff > 0) { x1 = from.cx; y1 = from.bottom; x2 = to.cx; y2 = to.top; }
        else { x1 = from.cx; y1 = from.top; x2 = to.cx; y2 = to.bottom; }
      }
    }

    /* Build SVG path */
    let d;
    const adx = Math.abs(x2 - x1);
    const ady = Math.abs(y2 - y1);

    if ((adx < 3 && routeAxis === "v") || (ady < 3 && routeAxis === "h")) {
      d = `M ${x1} ${y1} L ${x2} ${y2}`;
    } else if (routeAxis === "v") {
      const midY = (y1 + y2) / 2;
      const dxDir = x2 > x1 ? 1 : -1;
      const dyDir = y2 > y1 ? 1 : -1;
      const r = Math.min(R, adx / 2, Math.abs(midY - y1), Math.abs(y2 - midY));
      d = [
        `M ${x1} ${y1}`,
        `L ${x1} ${midY - dyDir * r}`,
        `Q ${x1} ${midY} ${x1 + dxDir * r} ${midY}`,
        `L ${x2 - dxDir * r} ${midY}`,
        `Q ${x2} ${midY} ${x2} ${midY + dyDir * r}`,
        `L ${x2} ${y2}`,
      ].join(" ");
    } else {
      const midX = (x1 + x2) / 2;
      const dxDir = x2 > x1 ? 1 : -1;
      const dyDir = y2 > y1 ? 1 : -1;
      const r = Math.min(R, ady / 2, Math.abs(midX - x1), Math.abs(x2 - midX));
      d = [
        `M ${x1} ${y1}`,
        `L ${midX - dxDir * r} ${y1}`,
        `Q ${midX} ${y1} ${midX} ${y1 + dyDir * r}`,
        `L ${midX} ${y2 - dyDir * r}`,
        `Q ${midX} ${y2} ${midX + dxDir * r} ${y2}`,
        `L ${x2} ${y2}`,
      ].join(" ");
    }

    const lx = (x1 + x2) / 2;
    const ly = (y1 + y2) / 2;

    edgeData.push({
      d,
      label: edge.label,
      lx, ly,
      lw: edge.label ? edge.label.length * 6 + 16 : 0,
      dashed: !!edge.dashed,
    });
  }

  /* Compute groups */
  const allNodes = props.config.nodes || [];
  let maxColNum = 0;
  for (const n of allNodes) maxColNum = Math.max(maxColNum, n.col || 0);
  const isWideGrid = maxColNum >= 7;

  const groupData = groups.map((g) => {
    const gNodes = (g.nodes || []).map((id) => nodePos[id]).filter(Boolean);
    if (!gNodes.length) return null;
    const minX = Math.min(...gNodes.map((n) => n.left));
    const maxX = Math.max(...gNodes.map((n) => n.right));
    const minY = Math.min(...gNodes.map((n) => n.top));
    const maxY = Math.max(...gNodes.map((n) => n.bottom));
    const pad = isWideGrid ? 12 : 20;
    const pal = layerPalette[g.color] || layerPalette.teal;
    return {
      x: minX - pad,
      y: minY - pad - 20,
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2 + 20,
      fill: pal.bg,
      stroke: pal.border,
      label: g.label,
      labelColor: pal.label,
    };
  }).filter(Boolean);

  flowData.value = { edges: edgeData, groups: groupData };
}

/* ── State diagram ── */
function setStateNodeRef(id, el) {
  if (el) stateNodeRefs.value[id] = el;
}

function getStateNodeStyle(node) {
  const p = layerPalette[node.color] || layerPalette.teal;
  return {
    "--s-bg": p.bg,
    "--s-border": p.border,
    "--s-accent": p.accent,
    "--s-label": p.label,
    "--s-icon-bg": p.iconBg,
    "grid-row": (node.row || 0) + 1,
    "grid-column": (node.col || 0) + 1,
  };
}

const stateGridStyle = computed(() => {
  if (diagramType.value !== "state") return {};
  const states = props.config.states || [];
  let maxCol = 0;
  for (const s of states) maxCol = Math.max(maxCol, s.col || 0);
  const cols = maxCol + 1;
  const style = {};
  if (cols <= 3) {
    style["grid-template-columns"] = `repeat(${cols}, 1fr)`;
  } else if (cols <= 5) {
    style["grid-template-columns"] = `repeat(${cols}, 1fr)`;
    style["gap"] = "48px 32px";
  } else {
    style["grid-template-columns"] = `repeat(${cols}, 120px)`;
    style["gap"] = "40px 20px";
  }
  return style;
});

function computeStateLayout() {
  if (!container.value) return;
  const el = container.value;
  const cr = el.getBoundingClientRect();

  stateSvgSize.value = {
    width: Math.max(el.scrollWidth, cr.width) + "px",
    height: Math.max(el.scrollHeight, cr.height) + "px",
  };

  const states = props.config.states || [];
  const transitions = props.config.transitions || [];
  const groups = props.config.groups || [];
  const R = 10;

  const stateById = {};
  for (const s of states) stateById[s.id] = s;

  /* Measure state positions */
  const statePos = {};
  for (const state of states) {
    const el = stateNodeRefs.value[state.id];
    if (!el) continue;
    const r = el.getBoundingClientRect();
    statePos[state.id] = {
      cx: r.left + r.width / 2 - cr.left,
      cy: r.top + r.height / 2 - cr.top,
      top: r.top - cr.top,
      bottom: r.bottom - cr.top,
      left: r.left - cr.left,
      right: r.right - cr.left,
      width: r.width,
      height: r.height,
    };
  }

  /* Compute transitions */
  const transData = [];

  /* Track how many self-loops per node for stacking */
  const selfLoopCount = {};

  for (const t of transitions) {
    const from = statePos[t.from];
    const to = statePos[t.to];
    if (!from || !to) continue;

    /* Self-transition: loop arrow */
    if (t.from === t.to) {
      const idx = selfLoopCount[t.from] || 0;
      selfLoopCount[t.from] = idx + 1;
      const loopR = 20;
      const offsetY = idx * 28;
      const x = from.cx;
      const y = from.top - offsetY;
      const d = `M ${x - 14} ${y} C ${x - 14} ${y - loopR - 10}, ${x + 14} ${y - loopR - 10}, ${x + 14} ${y}`;
      transData.push({
        d,
        label: t.label,
        lx: x,
        ly: y - loopR - 8,
        lw: t.label ? t.label.length * 6 + 16 : 0,
        dashed: !!t.dashed,
        self: true,
      });
      continue;
    }

    const fn = stateById[t.from];
    const tn = stateById[t.to];
    const rowDiff = (tn?.row || 0) - (fn?.row || 0);
    const colDiff = (tn?.col || 0) - (fn?.col || 0);

    let x1, y1, x2, y2;

    /* Determine anchor points based on relative position */
    if (Math.abs(rowDiff) >= Math.abs(colDiff)) {
      /* Primarily vertical */
      if (rowDiff > 0) {
        x1 = from.cx; y1 = from.bottom;
        x2 = to.cx; y2 = to.top;
      } else {
        x1 = from.cx; y1 = from.top;
        x2 = to.cx; y2 = to.bottom;
      }
    } else {
      /* Primarily horizontal */
      if (colDiff > 0) {
        x1 = from.right; y1 = from.cy;
        x2 = to.left; y2 = to.cy;
      } else {
        x1 = from.left; y1 = from.cy;
        x2 = to.right; y2 = to.cy;
      }
    }

    /* Build curved SVG path */
    let d;
    const adx = Math.abs(x2 - x1);
    const ady = Math.abs(y2 - y1);

    if (adx < 3 && ady > 0) {
      /* Straight vertical */
      d = `M ${x1} ${y1} L ${x2} ${y2}`;
    } else if (ady < 3 && adx > 0) {
      /* Straight horizontal */
      d = `M ${x1} ${y1} L ${x2} ${y2}`;
    } else {
      /* Curved path using cubic bezier */
      const isVertical = Math.abs(rowDiff) >= Math.abs(colDiff);
      if (isVertical) {
        const midY = (y1 + y2) / 2;
        d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
      } else {
        const midX = (x1 + x2) / 2;
        d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
      }
    }

    const lx = (x1 + x2) / 2;
    const ly = (y1 + y2) / 2;

    transData.push({
      d,
      label: t.label,
      lx, ly,
      lw: t.label ? t.label.length * 6 + 16 : 0,
      dashed: !!t.dashed,
      self: false,
    });
  }

  /* Compute groups */
  const groupData = groups.map((g) => {
    const gStates = (g.states || []).map((id) => statePos[id]).filter(Boolean);
    if (!gStates.length) return null;
    const minX = Math.min(...gStates.map((s) => s.left));
    const maxX = Math.max(...gStates.map((s) => s.right));
    const minY = Math.min(...gStates.map((s) => s.top));
    const maxY = Math.max(...gStates.map((s) => s.bottom));
    const pad = 24;
    const pal = layerPalette[g.color] || layerPalette.teal;
    return {
      x: minX - pad,
      y: minY - pad - 22,
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2 + 22,
      fill: pal.bg,
      stroke: pal.border,
      label: g.label,
      labelColor: pal.label,
    };
  }).filter(Boolean);

  stateData.value = { transitions: transData, groups: groupData };
}

/* ── Lifecycle ── */
function computeLayout() {
  if (diagramType.value === "layers") computePaths();
  else if (diagramType.value === "sequence") computeSeqLayout();
  else if (diagramType.value === "flow") computeFlowLayout();
  else if (diagramType.value === "state") computeStateLayout();
}

let ro;
onMounted(async () => {
  await nextTick();
  setTimeout(computeLayout, 200);
  ro = new ResizeObserver(computeLayout);
  if (container.value) ro.observe(container.value);
  window.addEventListener("resize", computeLayout);
});

onUnmounted(() => {
  ro?.disconnect();
  window.removeEventListener("resize", computeLayout);
});
</script>

<template>
  <div class="arch-diagram" ref="container">
    <!-- ===== LAYERS MODE ===== -->
    <template v-if="diagramType === 'layers'">
      <div
        v-for="layer in config.layers"
        :key="layer.id"
        :ref="(el) => setLayerRef(layer.id, el)"
        class="arch-layer"
        :style="getLayerStyle(layer)"
      >
        <div class="arch-layer-accent" />
        <div class="arch-layer-inner">
          <div class="arch-layer-header">
            <div class="arch-layer-header-icon">
              <iconify-icon
                v-if="layer.icon && isIconify(layer.icon)"
                :icon="iconifyName(layer.icon)"
                width="16"
                height="16"
              />
              <i v-else-if="layer.icon" :class="'fa-solid ' + layer.icon" />
            </div>
            <div>
              <div class="arch-layer-title">{{ layer.title }}</div>
              <div v-if="layer.subtitle" class="arch-layer-subtitle">
                {{ layer.subtitle }}
              </div>
            </div>
          </div>
          <div class="arch-layer-nodes">
            <div
              v-for="node in layer.nodes"
              :key="node.id"
              :ref="(el) => setNodeRef(node.id, el)"
              class="arch-node"
            >
              <div class="arch-node-icon">
                <iconify-icon
                  v-if="isIconify(node.icon)"
                  :icon="iconifyName(node.icon)"
                  width="18"
                  height="18"
                />
                <i v-else :class="'fa-solid ' + node.icon" />
              </div>
              <div class="arch-node-body">
                <div class="arch-node-title">{{ node.title }}</div>
                <div v-if="node.subtitle" class="arch-node-subtitle">
                  {{ node.subtitle }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ===== SEQUENCE MODE ===== -->
    <template v-else-if="diagramType === 'sequence'">
      <div class="seq-actors">
        <div
          v-for="actor in config.actors"
          :key="actor.id"
          :ref="(el) => setActorRef(actor.id, el)"
          class="seq-actor"
          :style="getActorStyle(actor)"
        >
          <div class="seq-actor-icon">
            <iconify-icon
              v-if="isIconify(actor.icon)"
              :icon="iconifyName(actor.icon)"
              width="18"
              height="18"
            />
            <i v-else :class="'fa-solid ' + actor.icon" />
          </div>
          <div class="seq-actor-title">{{ actor.title }}</div>
          <div v-if="actor.subtitle" class="seq-actor-subtitle">
            {{ actor.subtitle }}
          </div>
        </div>
      </div>
      <div class="seq-body" :style="{ height: seqBodyHeight + 'px' }"></div>
    </template>

    <!-- ===== FLOW MODE ===== -->
    <template v-else-if="diagramType === 'flow'">
      <div class="flow-grid" :class="{ 'flow-grid-wide': (config.nodes || []).reduce((m, n) => Math.max(m, n.col || 0), 0) >= 7 }" :style="flowGridStyle">
        <div
          v-for="node in config.nodes"
          :key="node.id"
          :ref="(el) => setFlowNodeRef(node.id, el)"
          class="flow-node"
          :class="'flow-node-' + (node.shape || 'rect')"
          :style="getFlowNodeStyle(node)"
        >
          <div class="flow-node-icon">
            <iconify-icon
              v-if="isIconify(node.icon)"
              :icon="iconifyName(node.icon)"
              width="16"
              height="16"
            />
            <i v-else :class="'fa-solid ' + node.icon" />
          </div>
          <div class="flow-node-title">{{ node.title }}</div>
          <div v-if="node.subtitle" class="flow-node-sub">{{ node.subtitle }}</div>
        </div>
      </div>
    </template>

    <!-- ===== STATE MODE ===== -->
    <template v-else-if="diagramType === 'state'">
      <div class="state-grid" :style="stateGridStyle">
        <div
          v-for="state in config.states"
          :key="state.id"
          :ref="(el) => setStateNodeRef(state.id, el)"
          class="state-node"
          :class="'state-node-' + (state.shape || 'default')"
          :style="getStateNodeStyle(state)"
        >
          <template v-if="state.shape === 'initial'">
            <div class="state-initial-dot" />
          </template>
          <template v-else-if="state.shape === 'final'">
            <div class="state-final-ring">
              <div class="state-final-dot" />
            </div>
          </template>
          <template v-else>
            <div class="state-node-icon" v-if="state.icon">
              <iconify-icon
                v-if="isIconify(state.icon)"
                :icon="iconifyName(state.icon)"
                width="16"
                height="16"
              />
              <i v-else :class="'fa-solid ' + state.icon" />
            </div>
            <div class="state-node-title">{{ state.title }}</div>
            <div v-if="state.subtitle" class="state-node-sub">{{ state.subtitle }}</div>
          </template>
        </div>
      </div>
    </template>

    <!-- ===== SVG LINES (behind layers, z-index 1) ===== -->
    <svg class="arch-svg arch-svg-lines" :style="diagramType === 'flow' ? flowSvgSize : diagramType === 'state' ? stateSvgSize : {}">
      <template v-if="diagramType === 'layers'">
        <defs>
          <marker
            :id="`arrow-${uid}`"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#0d7a6a" class="arch-arrow-head" />
          </marker>
        </defs>
        <path
          v-for="(p, i) in paths"
          :key="i"
          :d="p.d"
          fill="none"
          stroke="#0d7a6a"
          stroke-width="1.5"
          stroke-opacity="0.5"
          :marker-end="`url(#arrow-${uid})`"
          class="arch-conn-line"
        />
      </template>
      <template v-else-if="diagramType === 'sequence'">
        <defs>
          <marker
            :id="`seq-arrow-${uid}`"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#0d7a6a" class="seq-arrow-head" />
          </marker>
        </defs>
        <!-- Groups -->
        <template v-for="(g, i) in seqData.groups" :key="'g' + i">
          <rect :x="g.x" :y="g.y" :width="g.width" :height="g.height" :fill="g.fill" :stroke="g.stroke" stroke-width="1" rx="8" opacity="0.6" class="seq-group-bg" />
        </template>
        <!-- Lifelines -->
        <line v-for="(ll, i) in seqData.lifelines" :key="'ll' + i" :x1="ll.x" :y1="ll.y1" :x2="ll.x" :y2="ll.y2" stroke="#c5bdb0" stroke-width="1" stroke-dasharray="4,3" stroke-opacity="0.5" class="seq-lifeline" />
        <!-- Message lines -->
        <line v-for="(m, i) in seqData.messages" :key="'m' + i" :x1="m.x1" :y1="m.y" :x2="m.x2" :y2="m.y" stroke="#0d7a6a" stroke-width="1.5" stroke-opacity="0.6" :stroke-dasharray="m.dashed ? '6,3' : 'none'" :marker-end="`url(#seq-arrow-${uid})`" class="seq-msg-line" />
        <!-- Note backgrounds -->
        <rect v-for="(n, i) in seqData.notes" :key="'n' + i" :x="n.x" :y="n.y" :width="n.width" :height="n.height" fill="#fef9f2" stroke="#e8e0d0" stroke-width="1" rx="6" class="seq-note-bg" />
      </template>
      <template v-else-if="diagramType === 'flow'">
        <defs>
          <marker
            :id="`flow-arrow-${uid}`"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#0d7a6a" class="flow-arrow-head" />
          </marker>
        </defs>
        <!-- Groups -->
        <rect v-for="(g, i) in flowData.groups" :key="'fg' + i" :x="g.x" :y="g.y" :width="g.width" :height="g.height" :fill="g.fill" :stroke="g.stroke" stroke-width="1" rx="10" opacity="0.5" class="flow-group-bg" />
        <!-- Edges -->
        <path
          v-for="(e, i) in flowData.edges"
          :key="'fe' + i"
          :d="e.d"
          fill="none"
          stroke="#0d7a6a"
          stroke-width="1.5"
          stroke-opacity="0.5"
          :stroke-dasharray="e.dashed ? '6,3' : 'none'"
          :marker-end="`url(#flow-arrow-${uid})`"
          class="flow-edge-line"
        />
      </template>
      <template v-else-if="diagramType === 'state'">
        <defs>
          <marker
            :id="`state-arrow-${uid}`"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#0d7a6a" class="state-arrow-head" />
          </marker>
        </defs>
        <!-- Groups -->
        <rect v-for="(g, i) in stateData.groups" :key="'sg' + i" :x="g.x" :y="g.y" :width="g.width" :height="g.height" :fill="g.fill" :stroke="g.stroke" stroke-width="1" rx="12" opacity="0.5" class="state-group-bg" />
        <!-- Transitions -->
        <path
          v-for="(t, i) in stateData.transitions"
          :key="'st' + i"
          :d="t.d"
          fill="none"
          stroke="#0d7a6a"
          stroke-width="1.5"
          stroke-opacity="0.5"
          :stroke-dasharray="t.dashed ? '6,3' : 'none'"
          :marker-end="`url(#state-arrow-${uid})`"
          class="state-trans-line"
        />
      </template>
    </svg>

    <!-- ===== SVG LABELS (above layers, z-index 3) ===== -->
    <svg class="arch-svg arch-svg-labels" :style="diagramType === 'flow' ? flowSvgSize : diagramType === 'state' ? stateSvgSize : {}">
      <template v-if="diagramType === 'layers'">
        <g v-for="(p, i) in paths" :key="i">
          <template v-if="p.label">
            <rect
              :x="p.lx - p.label.length * 3.2 - 8"
              :y="p.ly - 10"
              :width="p.label.length * 6.4 + 16"
              height="20"
              rx="10"
              class="arch-conn-label-bg"
            />
            <text
              :x="p.lx"
              :y="p.ly + 1"
              text-anchor="middle"
              dominant-baseline="middle"
              class="arch-label-text"
            >
              {{ p.label }}
            </text>
          </template>
        </g>
      </template>
      <template v-else-if="diagramType === 'sequence'">
        <!-- Group labels -->
        <text v-for="(g, i) in seqData.groups" :key="'gl' + i" :x="g.x + 12" :y="g.y + 16" :fill="g.labelColor" class="seq-group-label">{{ g.label }}</text>
        <!-- Message labels -->
        <template v-for="(m, i) in seqData.messages" :key="'ml' + i">
          <g v-if="m.label">
            <rect :x="m.lx - m.lw / 2" :y="m.y - 20" :width="m.lw" height="18" rx="9" fill="#fff" stroke="#e8e0d0" stroke-width="0.75" class="seq-msg-label-bg" />
            <text :x="m.lx" :y="m.y - 10" text-anchor="middle" dominant-baseline="middle" class="seq-msg-label">{{ m.label }}</text>
          </g>
        </template>
        <!-- Note text -->
        <text v-for="(n, i) in seqData.notes" :key="'nt' + i" :x="n.cx" :y="n.textStartY" text-anchor="middle" dominant-baseline="middle" class="seq-note-text">
          <tspan v-for="(line, j) in n.lines" :key="j" :x="n.cx" :dy="j === 0 ? '0' : '14'">{{ line }}</tspan>
        </text>
      </template>
      <template v-else-if="diagramType === 'flow'">
        <!-- Group labels -->
        <text v-for="(g, i) in flowData.groups" :key="'fgl' + i" :x="g.x + 12" :y="g.y + 16" :fill="g.labelColor" class="flow-group-label">{{ g.label }}</text>
        <!-- Edge labels -->
        <template v-for="(e, i) in flowData.edges" :key="'fel' + i">
          <g v-if="e.label">
            <rect :x="e.lx - e.lw / 2" :y="e.ly - 10" :width="e.lw" height="20" rx="10" class="flow-edge-label-bg" />
            <text :x="e.lx" :y="e.ly + 1" text-anchor="middle" dominant-baseline="middle" class="flow-edge-label">{{ e.label }}</text>
          </g>
        </template>
      </template>
      <template v-else-if="diagramType === 'state'">
        <!-- Group labels -->
        <text v-for="(g, i) in stateData.groups" :key="'sgl' + i" :x="g.x + 14" :y="g.y + 16" :fill="g.labelColor" class="state-group-label">{{ g.label }}</text>
        <!-- Transition labels -->
        <template v-for="(t, i) in stateData.transitions" :key="'stl' + i">
          <g v-if="t.label">
            <rect :x="t.lx - t.lw / 2" :y="t.ly - 10" :width="t.lw" height="20" rx="10" class="state-trans-label-bg" />
            <text :x="t.lx" :y="t.ly + 1" text-anchor="middle" dominant-baseline="middle" class="state-trans-label">{{ t.label }}</text>
          </g>
        </template>
      </template>
    </svg>
  </div>
</template>

<style scoped>
.arch-diagram {
  position: relative;
  padding: 12px 0 24px;
  font-family: "DM Sans", "Inter", sans-serif;
  max-width: 820px;
  margin: 0 auto;
  overflow-x: auto;
}

/* Expand container for wide flow grids so they get more room before scrolling */
.arch-diagram:has(.flow-grid-wide) {
  max-width: 1100px;
}

/* ── Layer ── */
.arch-layer {
  position: relative;
  z-index: 2;
  margin-bottom: 28px;
  border-radius: 14px;
  overflow: hidden;
  background: var(--l-bg);
  border: 1px solid color-mix(in srgb, var(--l-border) 40%, transparent);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
}

.arch-layer-accent {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 4px;
  background: var(--l-accent);
  border-radius: 14px 0 0 14px;
}

.arch-layer-inner {
  padding: 16px 20px 18px 24px;
}

.arch-layer-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  color: var(--l-label);
}

.arch-layer-header-icon {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: color-mix(in srgb, var(--l-accent) 15%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--l-accent);
  flex-shrink: 0;
}

.arch-layer-title {
  font-weight: 700;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  line-height: 1.2;
}

.arch-layer-subtitle {
  font-weight: 400;
  font-size: 11px;
  opacity: 0.65;
  line-height: 1.2;
  margin-top: 1px;
}

.arch-layer-nodes {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

/* ── Node ── */
.arch-node {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fff;
  border: 1px solid color-mix(in srgb, var(--l-border) 50%, transparent);
  border-radius: 10px;
  padding: 10px 14px;
  min-width: 140px;
  flex: 1 1 0;
  max-width: 240px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.2s, transform 0.2s;
}

.arch-node:hover {
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.arch-node-icon {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  background: var(--l-icon-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--l-label);
  font-size: 16px;
  flex-shrink: 0;
}

.arch-node-title {
  font-weight: 600;
  font-size: 13px;
  color: #1a1612;
  line-height: 1.3;
}

.arch-node-subtitle {
  font-size: 11px;
  color: #8a7e6d;
  line-height: 1.3;
  margin-top: 1px;
}

/* ── SVG connections ── */
.arch-svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
}

.arch-svg-lines {
  z-index: 1;
}

.arch-svg-labels {
  z-index: 3;
}

.arch-conn-label-bg {
  fill: var(--vp-c-bg, #fff);
  stroke: #e8e0d0;
  stroke-width: 0.75;
}

.arch-label-text {
  font-size: 10px;
  fill: #3d362d;
  font-family: "JetBrains Mono", "DM Sans", monospace;
  font-weight: 500;
}

/* ── Sequence mode ── */
.seq-actors {
  display: flex;
  justify-content: space-evenly;
  gap: 16px;
  padding: 0 16px;
  position: relative;
  z-index: 2;
}

.seq-actor {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: var(--a-bg);
  border: 1px solid color-mix(in srgb, var(--a-border) 40%, transparent);
  border-radius: 10px;
  padding: 12px 16px;
  min-width: 100px;
  max-width: 160px;
  flex: 1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.2s;
}

.seq-actor:hover {
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.08);
}

.seq-actor-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--a-icon-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-label);
  font-size: 15px;
}

.seq-actor-title {
  font-weight: 600;
  font-size: 12px;
  color: var(--a-label);
  text-align: center;
  line-height: 1.2;
}

.seq-actor-subtitle {
  font-size: 10px;
  color: #8a7e6d;
  text-align: center;
  line-height: 1.2;
}

.seq-body {
  position: relative;
  z-index: 0;
}

.seq-msg-label {
  font-size: 10px;
  fill: #3d362d;
  font-family: "JetBrains Mono", "DM Sans", monospace;
  font-weight: 500;
}

.seq-note-text {
  font-size: 10px;
  fill: #3d362d;
  font-family: "JetBrains Mono", "DM Sans", monospace;
  font-weight: 400;
}

.seq-group-label {
  font-size: 10px;
  font-family: "DM Sans", "Inter", sans-serif;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* ── Dark mode: Layers ── */
.dark .arch-layer {
  background: #1a1815;
  border-color: #302b24;
}

.dark .arch-layer-accent {
  opacity: 0.9;
}

.dark .arch-layer-header {
  color: var(--l-accent);
}

.dark .arch-layer-title {
  color: #e8e2d8;
}

.dark .arch-layer-subtitle {
  color: #9a9189;
  opacity: 1;
}

.dark .arch-layer-header-icon {
  background: rgba(255, 255, 255, 0.08);
  color: var(--l-accent);
}

.dark .arch-node {
  background: #232019;
  border-color: #3a342a;
}

.dark .arch-node:hover {
  background: #2a261f;
  box-shadow: 0 3px 16px rgba(0, 0, 0, 0.3);
}

.dark .arch-node-icon {
  background: rgba(255, 255, 255, 0.07);
  color: var(--l-accent);
}

.dark .arch-node-title {
  color: #f0ebe2;
}

.dark .arch-node-subtitle {
  color: #9a9189;
}

.dark .arch-conn-line {
  stroke: var(--l-accent, #1aad96);
  stroke-opacity: 0.4;
}

.dark .arch-arrow-head {
  fill: var(--l-accent, #1aad96);
  opacity: 0.5;
}

.dark .arch-conn-label-bg {
  fill: var(--vp-c-bg, #1a1815);
  stroke: #3a342a;
}

.dark .arch-label-text {
  fill: #c5bdb0;
}

/* ── Dark mode: Sequence ── */
.dark .seq-actor {
  background: #1a1815;
  border-color: #302b24;
}

.dark .seq-actor:hover {
  background: #222019;
  box-shadow: 0 3px 16px rgba(0, 0, 0, 0.3);
}

.dark .seq-actor-icon {
  background: rgba(255, 255, 255, 0.08);
  color: var(--a-accent);
}

.dark .seq-actor-title {
  color: #e8e2d8;
}

.dark .seq-actor-subtitle {
  color: #9a9189;
}

.dark .seq-lifeline {
  stroke: #3a342a;
  stroke-opacity: 0.6;
}

.dark .seq-msg-line {
  stroke: #1aad96;
  stroke-opacity: 0.4;
}

.dark .seq-arrow-head {
  fill: #1aad96;
  opacity: 0.5;
}

.dark .seq-msg-label-bg {
  fill: #1a1815;
  stroke: #3a342a;
}

.dark .seq-msg-label {
  fill: #c5bdb0;
}

.dark .seq-note-bg {
  fill: #232019;
  stroke: #3a342a;
}

.dark .seq-note-text {
  fill: #c5bdb0;
}

.dark .seq-group-bg {
  opacity: 0.3;
}

.dark .seq-group-label {
  fill: #c5bdb0 !important;
}

/* ── Flow mode ── */
.flow-grid {
  display: grid;
  gap: 40px 24px;
  justify-items: center;
  align-items: center;
  padding: 8px 16px;
  position: relative;
  z-index: 2;
}

.flow-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  position: relative;
  transition: transform 0.2s, box-shadow 0.2s;
  max-width: 100%;
  box-sizing: border-box;
  word-break: break-word;
}

.flow-node-rect {
  background: #fff;
  border: 1px solid color-mix(in srgb, var(--n-border) 50%, transparent);
  border-radius: 10px;
  padding: 10px 12px;
  min-width: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.flow-node-rect:hover {
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.flow-node-diamond {
  width: 140px;
  aspect-ratio: 1;
  padding: 0;
}

.flow-node-diamond::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 70.7%;
  height: 70.7%;
  transform: translate(-50%, -50%) rotate(45deg);
  border-radius: 5px;
  background: #fff;
  border: 1px solid color-mix(in srgb, var(--n-border) 50%, transparent);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.flow-node-diamond:hover::before {
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.08);
}

.flow-node-diamond > * {
  position: relative;
  z-index: 1;
}

.flow-node-diamond .flow-node-icon {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  margin-bottom: 4px;
  font-size: 11px;
}

.flow-node-pill {
  background: #fff;
  border: 1.5px solid color-mix(in srgb, var(--n-border) 60%, transparent);
  border-radius: 999px;
  padding: 10px 16px;
  min-width: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.flow-node-pill:hover {
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.flow-node-icon {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: var(--n-icon-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--n-accent);
  font-size: 13px;
  margin-bottom: 6px;
  flex-shrink: 0;
}

.flow-node-title {
  font-weight: 600;
  font-size: 12px;
  color: #1a1612;
  line-height: 1.3;
  max-width: 100%;
  overflow-wrap: break-word;
}

.flow-node-sub {
  font-size: 10px;
  color: #8a7e6d;
  line-height: 1.3;
  margin-top: 2px;
  max-width: 100%;
  overflow-wrap: break-word;
}

/* Compact nodes for wide grids */
.flow-grid-wide .flow-node-rect {
  padding: 8px 8px;
}

.flow-grid-wide .flow-node-icon {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  font-size: 11px;
  margin-bottom: 4px;
}

.flow-grid-wide .flow-node-title {
  font-size: 10.5px;
}

.flow-grid-wide .flow-node-sub {
  font-size: 9px;
}

.flow-node-diamond .flow-node-title {
  font-size: 10.5px;
  max-width: 80px;
  line-height: 1.25;
}

.flow-edge-label-bg {
  fill: var(--vp-c-bg, #fff);
  stroke: #e8e0d0;
  stroke-width: 0.75;
}

.flow-edge-label {
  font-size: 10px;
  fill: #3d362d;
  font-family: "JetBrains Mono", "DM Sans", monospace;
  font-weight: 500;
}

.flow-group-label {
  font-size: 10px;
  font-family: "DM Sans", "Inter", sans-serif;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* ── Dark mode: Flow ── */
.dark .flow-node-rect {
  background: #232019;
  border-color: #3a342a;
}

.dark .flow-node-rect:hover {
  background: #2a261f;
  box-shadow: 0 3px 16px rgba(0, 0, 0, 0.3);
}

.dark .flow-node-diamond::before {
  background: #232019;
  border-color: #3a342a;
}

.dark .flow-node-diamond:hover::before {
  background: #2a261f;
  box-shadow: 0 3px 16px rgba(0, 0, 0, 0.3);
}

.dark .flow-node-pill {
  background: #232019;
  border-color: #3a342a;
}

.dark .flow-node-pill:hover {
  background: #2a261f;
  box-shadow: 0 3px 16px rgba(0, 0, 0, 0.3);
}

.dark .flow-node-icon {
  background: rgba(255, 255, 255, 0.07);
  color: var(--n-accent);
}

.dark .flow-node-title {
  color: #f0ebe2;
}

.dark .flow-node-sub {
  color: #9a9189;
}

.dark .flow-edge-line {
  stroke: #1aad96;
  stroke-opacity: 0.4;
}

.dark .flow-arrow-head {
  fill: #1aad96;
  opacity: 0.5;
}

.dark .flow-edge-label-bg {
  fill: var(--vp-c-bg, #1a1815);
  stroke: #3a342a;
}

.dark .flow-edge-label {
  fill: #c5bdb0;
}

.dark .flow-group-bg {
  opacity: 0.3;
}

.dark .flow-group-label {
  fill: #c5bdb0 !important;
}

/* ── State mode ── */
.state-grid {
  display: grid;
  gap: 48px 32px;
  justify-items: center;
  align-items: center;
  padding: 16px 16px;
  position: relative;
  z-index: 2;
}

.state-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  position: relative;
  transition: transform 0.2s, box-shadow 0.2s;
}

.state-node-default {
  background: #fff;
  border: 2px solid color-mix(in srgb, var(--s-border) 50%, transparent);
  border-radius: 14px;
  padding: 12px 16px;
  min-width: 100px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  border-top: 3px solid var(--s-accent);
}

.state-node-default:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.state-node-initial {
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  padding: 0;
  min-width: 0;
}

.state-initial-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #0d7a6a;
}

.state-node-final {
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  padding: 0;
  min-width: 0;
}

.state-final-ring {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2.5px solid #0d7a6a;
  display: flex;
  align-items: center;
  justify-content: center;
}

.state-final-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #0d7a6a;
}

.state-node-icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--s-icon-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--s-accent);
  font-size: 13px;
  margin-bottom: 6px;
  flex-shrink: 0;
}

.state-node-title {
  font-weight: 600;
  font-size: 12px;
  color: #1a1612;
  line-height: 1.3;
}

.state-node-sub {
  font-size: 10px;
  color: #8a7e6d;
  line-height: 1.3;
  margin-top: 2px;
}

.state-trans-label-bg {
  fill: var(--vp-c-bg, #fff);
  stroke: #e8e0d0;
  stroke-width: 0.75;
}

.state-trans-label {
  font-size: 10px;
  fill: #3d362d;
  font-family: "JetBrains Mono", "DM Sans", monospace;
  font-weight: 500;
}

.state-group-label {
  font-size: 10px;
  font-family: "DM Sans", "Inter", sans-serif;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* ── Dark mode: State ── */
.dark .state-node-default {
  background: #232019;
  border-color: #3a342a;
  border-top-color: var(--s-accent);
}

.dark .state-node-default:hover {
  background: #2a261f;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
}

.dark .state-node-icon {
  background: rgba(255, 255, 255, 0.07);
  color: var(--s-accent);
}

.dark .state-node-title {
  color: #f0ebe2;
}

.dark .state-node-sub {
  color: #9a9189;
}

.dark .state-initial-dot {
  background: #1aad96;
}

.dark .state-final-ring {
  border-color: #1aad96;
}

.dark .state-final-dot {
  background: #1aad96;
}

.dark .state-trans-line {
  stroke: #1aad96;
  stroke-opacity: 0.4;
}

.dark .state-arrow-head {
  fill: #1aad96;
  opacity: 0.5;
}

.dark .state-trans-label-bg {
  fill: var(--vp-c-bg, #1a1815);
  stroke: #3a342a;
}

.dark .state-trans-label {
  fill: #c5bdb0;
}

.dark .state-group-bg {
  opacity: 0.3;
}

.dark .state-group-label {
  fill: #c5bdb0 !important;
}
</style>
