<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  milestones: { type: Array, required: true },
  weeks: { type: Array, required: true },
  startDate: { type: String, default: '2026-03-07' },
  endDate: { type: String, default: '2026-04-18' },
})

const expanded = ref({})
for (const ms of props.milestones) {
  expanded.value[ms.id] = ms.expanded !== false
}

const activeTooltip = ref(null)
const tooltipPos = ref({ x: 0, y: 0 })

function toggle(id) {
  expanded.value[id] = !expanded.value[id]
}

function showTooltip(evt, item, milestone) {
  const rect = evt.currentTarget.getBoundingClientRect()
  const wrap = evt.currentTarget.closest('.gantt-wrap')
  const wrapRect = wrap.getBoundingClientRect()
  tooltipPos.value = {
    x: Math.min(
      Math.max(rect.left + rect.width / 2 - wrapRect.left, 120),
      wrapRect.width - 120
    ),
    y: rect.top - wrapRect.top - 8,
  }
  activeTooltip.value = {
    name: item.fullName || item.name,
    area: item.area || null,
    desc: item.desc || milestone.desc,
    dates: item.dates || milestone.dates,
    color: milestone.color,
  }
}

function hideTooltip() {
  activeTooltip.value = null
}

/* Reactive clock that ticks every 60s so the "Today" line updates in real time */
const now = ref(Date.now())
let ticker
onMounted(() => {
  ticker = setInterval(() => { now.value = Date.now() }, 60_000)
})
onUnmounted(() => { clearInterval(ticker) })

const timelineStart = new Date(props.startDate).getTime()
const timelineEnd = new Date(props.endDate).getTime()

const todayPct = computed(() => {
  const pct = ((now.value - timelineStart) / (timelineEnd - timelineStart)) * 100
  return Math.max(0, Math.min(100, pct))
})
const showTodayLine = computed(() => todayPct.value > 0 && todayPct.value < 100)

/* Human-readable "Day X of 42" label */
const todayLabel = computed(() => {
  const dayNum = Math.ceil((now.value - timelineStart) / 86_400_000)
  const totalDays = Math.ceil((timelineEnd - timelineStart) / 86_400_000)
  if (dayNum < 1) return 'Not started'
  if (dayNum > totalDays) return 'Complete'
  return `Day ${dayNum} of ${totalDays}`
})
</script>

<template>
  <div class="gantt-wrap">
    <!-- Tooltip -->
    <Transition name="gantt-tt">
      <div
        v-if="activeTooltip"
        class="gantt-tooltip"
        :style="{ left: tooltipPos.x + 'px', top: tooltipPos.y + 'px' }"
      >
        <div class="gantt-tooltip-header" :style="{ borderColor: activeTooltip.color }">
          <strong>{{ activeTooltip.name }}</strong>
          <span class="gantt-tooltip-dates">{{ activeTooltip.dates }}</span>
        </div>
        <div v-if="activeTooltip.area" class="gantt-tooltip-area">{{ activeTooltip.area }}</div>
        <div class="gantt-tooltip-desc">{{ activeTooltip.desc }}</div>
      </div>
    </Transition>

    <div class="gantt">
      <!-- Header -->
      <div class="gantt-head">
        <div class="gantt-name-col"></div>
        <div class="gantt-timeline-header">
          <span v-for="w in weeks" :key="w.label">{{ w.label }}</span>
        </div>
      </div>

      <!-- Body with grid lines behind -->
      <div class="gantt-body">
        <!-- Vertical grid lines -->
        <div class="gantt-gridlines">
          <div class="gantt-name-col"></div>
          <div class="gantt-gridline-area">
            <div
              v-for="(w, i) in weeks"
              :key="'gl' + i"
              class="gantt-vline"
              :style="{ left: w.start + '%' }"
            ></div>
            <div class="gantt-vline gantt-vline-end" style="left: 100%"></div>
            <!-- Today marker — updates every 60s -->
            <div v-if="showTodayLine" class="gantt-today" :style="{ left: todayPct + '%' }">
              <span class="gantt-today-label">{{ todayLabel }}</span>
            </div>
          </div>
        </div>

        <!-- Milestones -->
        <div v-for="ms in milestones" :key="ms.id" class="gantt-ms-wrap">
          <!-- Group header -->
          <div
            class="gantt-group-label"
            :style="{ '--gc': ms.color }"
            @click="toggle(ms.id)"
          >
            <span class="gantt-expand-icon" :class="{ collapsed: !expanded[ms.id] }">&#9662;</span>
            {{ ms.fullName }}
            <span class="gantt-group-dates">{{ ms.dates }}</span>
          </div>

          <!-- Milestone summary bar -->
          <div class="gantt-row gantt-row-milestone">
            <span class="gantt-task milestone-task" :style="{ color: ms.color }">{{ ms.label }}</span>
            <div class="gantt-track">
              <div
                class="gantt-bar"
                :class="'gantt-bar-' + ms.id"
                :style="{ left: ms.start + '%', width: ms.width + '%' }"
                @mouseenter="showTooltip($event, ms, ms)"
                @mouseleave="hideTooltip"
              >
                <span class="gantt-bar-label">{{ ms.dates }}</span>
              </div>
            </div>
          </div>

          <!-- Task rows -->
          <div v-show="expanded[ms.id]" class="gantt-tasks-wrap">
            <div v-for="t in ms.tasks" :key="t.id" class="gantt-row">
              <span class="gantt-task sub">{{ t.name }}</span>
              <div class="gantt-track">
                <div
                  class="gantt-bar"
                  :class="'gantt-bar-' + ms.id"
                  :style="{ left: t.start + '%', width: t.width + '%' }"
                  @mouseenter="showTooltip($event, t, ms)"
                  @mouseleave="hideTooltip"
                >
                  <span class="gantt-bar-label">{{ t.area }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gantt-wrap { margin: 24px 0; overflow-x: auto; position: relative; }
.gantt {
  min-width: 700px;
  font-family: 'DM Sans', 'Inter', sans-serif;
  font-size: 13px;
}

/* Header */
.gantt-head {
  display: flex;
  align-items: end;
  border-bottom: 2px solid #e8e0d0;
  padding-bottom: 8px;
}
.gantt-name-col { min-width: 130px; flex-shrink: 0; }
.gantt-timeline-header {
  flex: 1;
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 600;
  color: #8a7e6d;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

/* Body + grid lines */
.gantt-body { position: relative; }
.gantt-gridlines {
  position: absolute;
  inset: 0;
  display: flex;
  pointer-events: none;
  z-index: 0;
}
.gantt-gridline-area { flex: 1; position: relative; }
.gantt-vline {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: #ede8e0;
}
.gantt-vline-end { background: #ddd6ca; }

/* Today marker */
.gantt-today {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #e04b2c;
  z-index: 5;
  pointer-events: none;
}
.gantt-today-label {
  position: absolute;
  top: -2px;
  left: 50%;
  transform: translateX(-50%);
  background: #e04b2c;
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 6px;
  border-radius: 0 0 4px 4px;
  white-space: nowrap;
}

/* Milestone wrapper (display:contents so it doesn't break flex/grid) */
.gantt-ms-wrap { display: contents; }
.gantt-tasks-wrap { display: contents; }

/* Group header */
.gantt-group-label {
  position: relative;
  z-index: 1;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.4px;
  color: var(--gc);
  padding: 14px 0 6px;
  border-bottom: 1.5px solid color-mix(in srgb, var(--gc) 25%, transparent);
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.15s;
}
.gantt-group-label:hover { background: color-mix(in srgb, var(--gc) 4%, transparent); }
.gantt-expand-icon {
  font-size: 10px;
  transition: transform 0.2s;
  display: inline-block;
  width: 14px;
  text-align: center;
}
.gantt-expand-icon.collapsed { transform: rotate(-90deg); }
.gantt-group-dates {
  margin-left: auto;
  font-weight: 500;
  font-size: 11px;
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
}

/* Rows */
.gantt-row {
  display: flex;
  align-items: center;
  height: 36px;
  border-bottom: 1px solid #f5f0ea;
  position: relative;
  z-index: 1;
  transition: background 0.15s;
}
.gantt-row:hover { background: rgba(13, 122, 106, 0.02); }
.gantt-row-milestone { height: 40px; }

.gantt-task {
  min-width: 130px;
  flex-shrink: 0;
  font-weight: 600;
  font-size: 12px;
  color: #3d362d;
  white-space: nowrap;
  padding-left: 20px;
}
.gantt-task.milestone-task { font-weight: 700; font-size: 13px; }
.gantt-task.sub {
  font-weight: 400;
  padding-left: 36px;
  color: #6b6155;
  font-size: 12px;
}

/* Track */
.gantt-track { flex: 1; position: relative; height: 24px; }

/* Bars */
.gantt-bar {
  position: absolute;
  top: 4px;
  height: 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  display: flex;
  align-items: center;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.gantt-bar:hover {
  transform: scaleY(1.35);
  box-shadow: 0 3px 10px rgba(0,0,0,0.18);
  z-index: 10;
}
.gantt-bar-label {
  font-size: 9px;
  font-weight: 600;
  color: rgba(255,255,255,0.9);
  white-space: nowrap;
  padding: 0 8px;
  opacity: 0;
  transition: opacity 0.15s;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
  overflow: hidden;
  text-overflow: ellipsis;
}
.gantt-bar:hover .gantt-bar-label { opacity: 1; }

/* Milestone summary bar (bolder) */
.gantt-row-milestone .gantt-bar {
  height: 20px;
  top: 2px;
  border-radius: 10px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.12);
}
.gantt-row-milestone .gantt-bar-label { font-size: 10px; }

/* Bar colors */
.gantt-bar-m0 { background: linear-gradient(90deg, #0d7a6a, #14a892); }
.gantt-bar-m1 { background: linear-gradient(90deg, #2563eb, #60a5fa); }
.gantt-bar-m2 { background: linear-gradient(90deg, #d4a017, #f0c040); }
.gantt-bar-m3 { background: linear-gradient(90deg, #e04b2c, #f07050); }

/* Tooltip */
.gantt-tooltip {
  position: absolute;
  z-index: 100;
  transform: translate(-50%, -100%);
  background: #fff;
  border: 1px solid #e8e0d0;
  border-radius: 10px;
  padding: 12px 16px;
  min-width: 220px;
  max-width: 320px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  pointer-events: none;
  font-size: 12px;
  line-height: 1.4;
}
.gantt-tooltip::after {
  content: '';
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
  width: 10px;
  height: 10px;
  background: #fff;
  border-right: 1px solid #e8e0d0;
  border-bottom: 1px solid #e8e0d0;
}
.gantt-tooltip-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  padding-bottom: 6px;
  margin-bottom: 6px;
  border-bottom: 2px solid;
}
.gantt-tooltip-header strong { color: #1a1612; font-size: 13px; }
.gantt-tooltip-dates {
  font-size: 11px;
  color: #8a7e6d;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  font-weight: 500;
}
.gantt-tooltip-area {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #8a7e6d;
  margin-bottom: 4px;
}
.gantt-tooltip-desc { color: #3d362d; }

/* Tooltip transition */
.gantt-tt-enter-active { transition: opacity 0.15s, transform 0.15s; }
.gantt-tt-leave-active { transition: opacity 0.1s; }
.gantt-tt-enter-from { opacity: 0; transform: translate(-50%, -100%) translateY(4px); }
.gantt-tt-leave-to { opacity: 0; }

/* ── Dark mode ── */
.dark .gantt-head { border-color: #3a342a; }
.dark .gantt-timeline-header { color: #9a9189; }
.dark .gantt-vline { background: #2a261f; }
.dark .gantt-vline-end { background: #3a342a; }
.dark .gantt-today { background: #ff6b4a; }
.dark .gantt-today-label { background: #ff6b4a; }
.dark .gantt-row { border-color: #2a261f; }
.dark .gantt-row:hover { background: rgba(26, 173, 150, 0.03); }
.dark .gantt-task { color: #e8e2d8; }
.dark .gantt-task.sub { color: #9a9189; }
.dark .gantt-group-label { border-color: color-mix(in srgb, var(--gc) 30%, transparent); }
.dark .gantt-group-label:hover { background: color-mix(in srgb, var(--gc) 6%, transparent); }
.dark .gantt-bar-m0 { background: linear-gradient(90deg, #0d7a6a, #1aad96); }
.dark .gantt-bar-m1 { background: linear-gradient(90deg, #2563eb, #60a5fa); }
.dark .gantt-bar-m2 { background: linear-gradient(90deg, #d4a017, #f0c040); }
.dark .gantt-bar-m3 { background: linear-gradient(90deg, #c0392b, #e74c3c); }
.dark .gantt-bar { box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
.dark .gantt-bar:hover { box-shadow: 0 3px 10px rgba(0,0,0,0.4); }
.dark .gantt-tooltip {
  background: #1a1815;
  border-color: #3a342a;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}
.dark .gantt-tooltip::after {
  background: #1a1815;
  border-color: #3a342a;
}
.dark .gantt-tooltip-header strong { color: #f0ebe2; }
.dark .gantt-tooltip-dates { color: #9a9189; }
.dark .gantt-tooltip-area { color: #9a9189; }
.dark .gantt-tooltip-desc { color: #c5bdb0; }
</style>
