<script setup lang="ts">
import { computed, ref } from 'vue'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import type { UserData } from '../types'
import { hasAvailableStock } from '../composables/useStock'

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

const recentSessions = computed(() => (props.state.sessions || []).slice(0, 3))

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

async function logout() {
  await signOut(auth)
  showProfile.value = false
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}
function pct(s: { checked: number; total: number }) {
  return s.total ? Math.round((s.checked / s.total) * 100) : 0
}
</script>

<template>
  <div class="page-root">
    <!-- HEADER -->
    <div class="home-header">
      <div>
        <div class="greeting">Bonjour, <span class="name">{{ user?.displayName || 'Réalisateur' }}</span> 👋</div>
        <div class="date">{{ new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) }}</div>
      </div>
      <button class="avatar-btn" @click="showProfile = true">
        {{ (user?.displayName || 'R')[0].toUpperCase() }}
      </button>
    </div>

    <div class="page-content">
      <!-- STATS -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-val">{{ state.items?.length ?? 0 }}</div>
          <div class="stat-lbl">Équipements</div>
        </div>
        <div class="stat-card" :class="{ 'stat-warn': unavailableItems.length > 0 }">
          <div class="stat-val">{{ unavailableItems.length }}</div>
          <div class="stat-lbl">Indisponibles</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">{{ state.sessions?.length ?? 0 }}</div>
          <div class="stat-lbl">Sessions</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">{{ state.templates?.length ?? 0 }}</div>
          <div class="stat-lbl">Templates</div>
        </div>
      </div>

      <!-- HERO CTA -->
      <div class="hero-cta">
        <!-- Stock info bar -->
        <div class="stock-info-row">
          <div class="stock-info-chip">
            <span class="sic-dot dot-ok"></span>
            <span>{{ availableUnitCount }} unité{{ availableUnitCount > 1 ? 'és' : 'é' }} dispo</span>
          </div>
          <div class="stock-info-chip" v-if="inUseUnitCount > 0">
            <span class="sic-dot dot-warn"></span>
            <span>{{ inUseUnitCount }} en tournage</span>
          </div>
          <div class="stock-info-chip" v-if="unavailableItems.length > 0">
            <span class="sic-dot dot-danger"></span>
            <span>{{ unavailableItems.length }} indispo</span>
          </div>
          <div class="stock-info-chip">
            <span class="sic-dot dot-neutral"></span>
            <span>{{ totalItemCount }} réf.</span>
          </div>
        </div>

        <!-- Big CTA -->
        <button
          class="big-cta"
          :class="{ 'big-cta-disabled': !stockAvailable }"
          @click="stockAvailable ? emit('navigate', 'checklist') : emit('toast', 'Aucun matos disponible — fais d\'abord un retour !')"
        >
          <span class="big-cta-icon">🎬</span>
          <div class="big-cta-text">
            <span class="big-cta-title">Préparer un Tournage</span>
            <span class="big-cta-sub">{{ stockAvailable ? availableUnitCount + ' unités disponibles' : 'Stock épuisé' }}</span>
          </div>
          <span class="big-cta-arrow">{{ stockAvailable ? '→' : '🔴' }}</span>
        </button>

        <!-- Retour secondary -->
        <button class="retour-btn" @click="emit('navigate', 'retour')">
          <span>📦 {{ pendingDepartures.length > 0 ? `${pendingDepartures.length} tournage${pendingDepartures.length > 1 ? 's' : ''} en attente de retour` : 'Enregistrer un retour' }}</span>
          <span v-if="pendingDepartures.length" class="retour-badge">{{ pendingDepartures.length }}</span>
        </button>
      </div>

      <!-- EMPTY STATE (no sessions at all) -->
      <div v-if="!recentSessions.length" class="empty-state">
        <span class="empty-icon">🎬</span>
        <p>Aucune session encore.<br>Lance ton premier tournage !</p>
      </div>

    </div>

    <!-- NAV -->
    <nav class="nav-bar">
      <button class="nav-item active" @click="emit('navigate', 'checklist')">
        <span class="nav-icon">✓</span><span>Checklist</span>
      </button>
      <button class="nav-item" @click="emit('navigate', 'historique')">
        <span class="nav-icon">📋</span><span>Historique</span>
      </button>
      <button class="nav-item" @click="emit('navigate', 'gestion')">
        <span class="nav-icon">⚙️</span><span>Gestion</span>
      </button>
    </nav>

    <!-- PROFILE MODAL -->
    <Teleport to="body">
      <div v-if="showProfile" class="modal-backdrop" @click.self="showProfile = false">
        <div class="modal-sheet">
          <div class="modal-handle"></div>
          <div class="profile-avatar">{{ (user?.displayName || 'R')[0].toUpperCase() }}</div>
          <div class="profile-name">{{ user?.displayName }}</div>
          <div class="profile-email">{{ user?.email }}</div>
          <div class="divider"></div>
          <button class="btn btn-danger btn-full" @click="logout">Se déconnecter</button>
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
  padding: 24px 20px 0;
}
.greeting { font-size: 14px; color: var(--text2); }
.name { font-weight: 700; color: var(--text); }
.date { font-size: 11px; color: var(--text3); margin-top: 2px; }
.avatar-btn {
  width: 42px; height: 42px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  color: #0a0a0f;
  font-size: 16px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  border: none; cursor: pointer;
}
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 20px;
}
.stat-card {
  background: var(--surface);
  border: 0.5px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 8px;
  text-align: center;
}
.stat-card.stat-warn { border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.05); }
.stat-val { font-size: 22px; font-weight: 800; }
.stat-lbl { font-size: 9px; color: var(--text3); margin-top: 2px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
/* ── HERO CTA ── */
.hero-cta { margin-bottom: 20px; }

.stock-info-row {
  display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;
}
.stock-info-chip {
  display: flex; align-items: center; gap: 5px;
  background: var(--surface); border: 0.5px solid var(--border);
  border-radius: 99px; padding: 5px 10px;
  font-size: 11px; font-weight: 600; color: var(--text2);
}
.sic-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.dot-ok      { background: var(--ok); }
.dot-warn    { background: var(--warn); }
.dot-danger  { background: var(--danger); }
.dot-neutral { background: var(--text3); }

.big-cta {
  width: 100%; display: flex; align-items: center; gap: 16px;
  padding: 20px 20px;
  border-radius: var(--radius);
  background: linear-gradient(135deg, rgba(240,192,64,0.22), rgba(240,192,64,0.06));
  border: 0.5px solid rgba(240,192,64,0.35);
  cursor: pointer; text-align: left;
  transition: transform 0.15s, box-shadow 0.15s;
  margin-bottom: 10px;
  box-shadow: 0 4px 24px rgba(240,192,64,0.10);
}
.big-cta:hover  { transform: translateY(-1px); box-shadow: 0 8px 32px rgba(240,192,64,0.18); }
.big-cta:active { transform: scale(0.98); }
.big-cta-disabled {
  opacity: 0.5; filter: grayscale(40%);
  box-shadow: none;
}
.big-cta-icon { font-size: 36px; flex-shrink: 0; }
.big-cta-text { flex: 1; display: flex; flex-direction: column; gap: 3px; }
.big-cta-title { font-size: 17px; font-weight: 800; color: var(--text); }
.big-cta-sub   { font-size: 12px; color: var(--text2); }
.big-cta-arrow { font-size: 20px; color: var(--accent); font-weight: 700; flex-shrink: 0; }

.retour-btn {
  width: 100%; display: flex; align-items: center; justify-content: space-between;
  padding: 13px 16px;
  border-radius: var(--radius);
  background: rgba(139,92,246,0.08);
  border: 0.5px solid rgba(139,92,246,0.2);
  cursor: pointer; font-size: 13px; font-weight: 600;
  color: var(--text2);
  transition: background 0.15s;
}
.retour-btn:hover { background: rgba(139,92,246,0.14); }
.retour-badge {
  background: #8b5cf6; color: #fff;
  font-size: 10px; font-weight: 800;
  padding: 2px 8px; border-radius: 99px;
}

.pending-banner {
  display: flex; align-items: center; gap: 8px;
  background: rgba(245,158,11,0.1);
  border: 0.5px solid rgba(245,158,11,0.25);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  font-size: 12px; color: var(--warn);
  margin-bottom: 16px;
}
.session-item {
  background: var(--surface);
  border: 0.5px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 14px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.session-item:hover { border-color: var(--border2); }
.session-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.session-name { font-size: 13px; font-weight: 600; }
.session-meta { font-size: 11px; color: var(--text3); margin-bottom: 8px; }
.profile-avatar {
  width: 64px; height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  color: #0a0a0f;
  font-size: 24px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 12px;
}
.profile-name { font-size: 18px; font-weight: 700; text-align: center; }
.profile-email { font-size: 13px; color: var(--text2); text-align: center; margin-top: 4px; margin-bottom: 16px; }
</style>
