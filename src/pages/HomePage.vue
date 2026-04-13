<script setup lang="ts">
import { computed, ref } from 'vue'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import type { UserData } from '../types'
import { hasAvailableStock } from '../composables/useStock'
import {
  Clapperboard,
  Package,
  Sparkles,
  ClipboardList,
  Settings2,
  House,
  ChevronRight,
  Check
} from 'lucide-vue-next'

const props = defineProps<{ state: UserData & { _uid: string | null } }>()
const emit = defineEmits<{
  navigate: [page: 'checklist' | 'retour' | 'historique' | 'gestion']
  toast: [msg: string]
}>()

const showProfile = ref(false)
const user = auth.currentUser

const pendingDepartures = computed(() =>
  (props.state.sessions || []).filter(s => s.phase === 'arrive' && !s.isReturned)
)

const stockAvailable = computed(() =>
  hasAvailableStock(props.state.items || [], props.state.sessions || [])
)

const recentSessions = computed(() => (props.state.sessions || []).slice(0, 1))

const unavailableItems = computed(() =>
  (props.state.items || []).filter(i => i.status === 'repair' || i.status === 'lost')
)

// Stock numbers for display
const totalItemCount = computed(() => (props.state.items || []).length)
const totalUnitCount = computed(() => (props.state.items || []).reduce((s, i) => s + i.qty, 0))
const inUseUnitCount = computed(() => {
  const active = (props.state.sessions || []).filter(s => s.phase === 'arrive' && !s.isReturned)
  let n = 0
  for (const sess of active) for (const snap of (sess.snapshot || [])) n += snap.taken ?? 0
  return n
})
const availableUnitCount = computed(() => Math.max(0, totalUnitCount.value - inUseUnitCount.value))

const availabilityPct = computed(() => {
  if (totalUnitCount.value === 0) return 0
  return Math.round((availableUnitCount.value / totalUnitCount.value) * 100)
})

async function logout() {
  await signOut(auth)
  showProfile.value = false
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short'
  })
}
function pct(checked: number, total: number) {
  return total ? Math.round((checked / total) * 100) : 0
}
</script>

<template>
  <div class="page-root">
    <!-- HEADER -->
    <div class="home-header">
      <div>
        <div class="greeting">Système de gestion <span class="badge-tech">v2.1</span></div>
        <div class="user-info">
          <Sparkles :size="14" style="color:var(--text3)" />
          <span>{{ user?.displayName || 'Réalisateur' }}</span>
        </div>
      </div>
      <button class="avatar-btn" @click="showProfile = true">
        {{ (user?.displayName || 'R')[0].toUpperCase() }}
      </button>
    </div>

    <div class="page-content">
      <div class="grid-2">
        <!-- TECHNICAL DASHBOARD -->
        <div class="tech-dashboard" style="margin-bottom:0">
          <div class="dashboard-grid">
            <div class="tech-gauge-wrap">
              <svg class="tech-gauge" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" class="gauge-bg" />
                <circle
                  cx="50" cy="50" r="45"
                  class="gauge-fill"
                  :stroke-dasharray="282.7"
                  :stroke-dashoffset="282.7 - (availabilityPct * 2.827)"
                  stroke-linecap="round"
                />
              </svg>
              <div class="gauge-info">
                <span class="gauge-val">{{ availabilityPct }}%</span>
                <span class="gauge-lbl">STOCK</span>
              </div>
            </div>

            <div class="tech-stats">
              <div class="t-stat">
                <span class="t-stat-lbl">TOTAL</span>
                <span class="t-stat-val">{{ totalUnitCount }}</span>
              </div>
              <div class="t-stat" :class="{ 't-warn': inUseUnitCount > 0 }">
                <span class="t-stat-lbl">OUT</span>
                <span class="t-stat-val">{{ inUseUnitCount }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- RECENT ACTIVITY -->
        <div v-if="recentSessions.length > 0" class="section-top" style="margin-top: 32px;">
          <div class="section-title">ACTIVITÉ RÉCENTE</div>
          <div class="recent-list">
            <div 
              v-for="s in recentSessions" :key="s.id" 
              class="session-row" 
              @click="emit('navigate', 'historique')"
            >
              <span class="sr-name">{{ s.name }}</span>
              <span class="sr-date">{{ formatDate(s.date) }}</span>
              <span class="sr-pct">{{ pct(s.checked, s.total) }}%</span>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <Clapperboard :size="48" style="opacity:0.1;margin-bottom:12px" />
          <p>Aucune activité enregistrée.</p>
        </div>
      </div>

    </div>

    <!-- PROFILE MODAL -->
    <Teleport to="body">
      <div v-if="showProfile" class="modal-backdrop" @click.self="showProfile = false">
        <div class="modal-sheet">
          <div class="modal-handle"></div>
          <div style="text-align:center;margin-bottom:24px">
            <div class="profile-avatar">{{ (user?.displayName || 'R')[0].toUpperCase() }}</div>
            <div style="font-size:18px;font-weight:800;margin-top:12px">{{ user?.displayName }}</div>
            <div style="font-size:12px;color:var(--text3);font-family:var(--font-mono)">{{ user?.email }}</div>
          </div>
          <div class="divider"></div>
          <button class="btn btn-danger btn-full" @click="logout">TERMINER LA SESSION</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.home-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 24px 0;
}
.greeting {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  color: var(--text3);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 4px;
}
.badge-tech {
  background: var(--surface2);
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--text);
  margin-left: 4px;
}
.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 800;
}
.avatar-btn {
  width: 44px; height: 44px;
  border-radius: 50%;
  border: 1px solid var(--border2);
  background: var(--surface2);
  color: var(--text);
  font-size: 16px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
}

.tech-.dashboard-card {
  background: var(--surface);
  border: 0.5px solid var(--border2);
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: var(--shadow);
}
.dashboard-grid {
  display: flex;
  align-items: center;
  gap: 20px;
}
.tech-gauge-wrap {
  position: relative;
  width: 90px;
  height: 90px;
}
.tech-gauge { width: 100%; height: 100%; transform: rotate(-90deg); }
.gauge-bg { fill: none; stroke: var(--surface2); stroke-width: 8; }
.gauge-fill {
  fill: none; stroke: var(--accent); stroke-width: 8;
  transition: stroke-dashoffset 0.8s ease;
}
.gauge-info {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.gauge-val { font-family: var(--font-mono); font-size: 16px; font-weight: 800; line-height: 1; }
.gauge-lbl { font-size: 8px; font-weight: 700; color: var(--text3); margin-top: 2px; }

.tech-stats { flex: 1; display: grid; gap: 8px; }
.t-stat { 
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 12px; background: var(--bg2); border-radius: 6px;
}
.t-stat-lbl { font-size: 9px; font-weight: 700; color: var(--text3); }
.t-stat-val { font-family: var(--font-mono); font-size: 13px; font-weight: 700; }
.t-warn .t-stat-val { color: var(--warn); }
.t-danger .t-stat-val { color: var(--danger); }

.session-mini-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 16px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.session-mini-card:hover {
  background: var(--surface2);
  border-color: var(--text3);
}
.smc-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}
.smc-name {
  font-size: 14px;
  font-weight: 700;
}
.smc-date {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text3);
}
.smc-footer {
  display: flex;
  align-items: center;
  gap: 16px;
}
.progress-bar-small {
  flex: 1;
  height: 2px;
  background: var(--surface2);
  border-radius: 1px;
  overflow: hidden;
}
.smc-pct {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 800;
  color: var(--text2);
}

.profile-avatar {
  width: 64px; height: 64px; border-radius: 50%;
  background: var(--accent); color: #000;
  font-size: 24px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto;
}
</style>
