<script setup lang="ts">
import { computed, ref } from 'vue'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import type { UserData } from '../types'

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

const recentSessions = computed(() => (props.state.sessions || []).slice(0, 3))

const availableItems = computed(() =>
  (props.state.items || []).filter(i => i.status === 'ok' || i.status === 'lent')
)

const unavailableItems = computed(() =>
  (props.state.items || []).filter(i => i.status === 'repair' || i.status === 'lost')
)

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

      <!-- ACTIONS -->
      <div class="actions-grid">
        <button class="action-card action-depart" @click="emit('navigate', 'checklist')">
          <span class="action-icon">🎬</span>
          <div class="action-title">Départ</div>
          <div class="action-desc">Préparer le matériel</div>
        </button>
        <button class="action-card action-retour" @click="emit('navigate', 'retour')">
          <span class="action-icon">📦</span>
          <div class="action-title">Retour</div>
          <div class="action-desc">Vérifier le matériel</div>
          <div v-if="pendingDepartures.length" class="action-badge">
            {{ pendingDepartures.length }}
          </div>
        </button>
      </div>

      <!-- PENDING DEPARTURES BANNER -->
      <div v-if="pendingDepartures.length" class="pending-banner">
        <span>⚠️</span>
        <span>{{ pendingDepartures.length }} tournage{{ pendingDepartures.length > 1 ? 's' : '' }} en cours sans retour enregistré</span>
      </div>

      <!-- RECENT SESSIONS -->
      <div v-if="recentSessions.length">
        <div class="section-title">Sessions récentes</div>
        <div
          v-for="s in recentSessions"
          :key="s.id"
          class="session-item"
          @click="emit('navigate', 'historique')"
        >
          <div class="session-top">
            <span class="session-name">{{ s.name }}</span>
            <span class="badge" :class="pct(s) === 100 ? 'badge-ok' : 'badge-partial'">
              {{ pct(s) === 100 ? 'Complet' : `${s.checked}/${s.total}` }}
            </span>
          </div>
          <div class="session-meta">{{ formatDate(s.date) }} · {{ s.phase === 'depart' ? '📦 Retour' : s.isReturned ? '🎬 Clôturé' : '🎬 En cours' }}</div>
          <div class="progress-bar"><div class="progress-fill" :style="{ width: pct(s) + '%' }"></div></div>
        </div>
      </div>
      <div v-else class="empty-state">
        <span class="empty-icon">🎬</span>
        <p>Aucune session encore.<br>Lance ta première checklist !</p>
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
.actions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 14px;
}
.action-card {
  position: relative;
  display: flex; flex-direction: column; align-items: flex-start;
  padding: 20px 16px;
  border-radius: var(--radius);
  border: none; cursor: pointer;
  text-align: left;
  transition: transform 0.15s, box-shadow 0.15s;
}
.action-card:active { transform: scale(0.97); }
.action-depart {
  background: linear-gradient(135deg, rgba(240,192,64,0.2), rgba(240,192,64,0.05));
  border: 0.5px solid rgba(240,192,64,0.25);
}
.action-retour {
  background: linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.05));
  border: 0.5px solid rgba(139,92,246,0.25);
}
.action-icon { font-size: 28px; margin-bottom: 10px; }
.action-title { font-size: 15px; font-weight: 700; color: var(--text); }
.action-desc { font-size: 11px; color: var(--text2); margin-top: 2px; }
.action-badge {
  position: absolute; top: 10px; right: 10px;
  background: var(--accent);
  color: #0a0a0f;
  font-size: 10px; font-weight: 800;
  width: 20px; height: 20px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
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
