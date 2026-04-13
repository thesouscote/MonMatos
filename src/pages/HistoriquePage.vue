<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStore } from '../store'
import type { UserData } from '../types'

const props = defineProps<{ state: UserData & { _uid: string | null } }>()
const emit = defineEmits<{ back: []; toast: [msg: string] }>()
const { save } = useStore()

const openSessions = ref<Set<number>>(new Set())
const search = ref('')
const confirmDeleteId = ref<number | null>(null)

const filtered = computed(() =>
  (props.state.sessions || []).filter(s =>
    s.name.toLowerCase().includes(search.value.toLowerCase())
  )
)

function toggle(id: number) {
  if (openSessions.value.has(id)) openSessions.value.delete(id)
  else openSessions.value.add(id)
}

function pct(s: { checked: number; total: number }) {
  return s.total ? Math.round(s.checked / s.total * 100) : 0
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function phaseLabel(s: any) {
  if (s.phase === 'depart') return '📦 Retour'
  return s.isReturned ? '🎬 Départ (Clôturé)' : '🎬 Départ (En cours)'
}

async function deleteSession(id: number) {
  confirmDeleteId.value = null
  const idx = props.state.sessions.findIndex(s => s.id === id)
  if (idx !== -1) props.state.sessions.splice(idx, 1)
  await save()
  emit('toast', 'Session supprimée')
}
</script>

<template>
  <div class="page-root">
    <div class="page-header">
      <button class="back-btn" @click="emit('back')">←</button>
      <h1>📋 Historique</h1>
    </div>

    <div class="page-content">
      <!-- SEARCH -->
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input v-model="search" placeholder="Rechercher une session…" />
        <button v-if="search" @click="search = ''" style="color:var(--text3);font-size:16px">✕</button>
      </div>

      <div v-if="!filtered.length" class="empty-state">
        <span class="empty-icon">📋</span>
        <p>Aucune session trouvée.</p>
      </div>

      <div v-for="s in filtered" :key="s.id" class="hist-session">
        <div class="hist-header" @click="toggle(s.id)">
          <div>
            <div class="hist-title">{{ s.name }}</div>
            <div class="hist-date">{{ formatDate(s.date) }} · {{ phaseLabel(s) }}</div>
          </div>
          <div style="display:flex; align-items:center; gap:8px">
            <span class="badge" :class="pct(s) === 100 ? 'badge-ok' : 'badge-partial'">
              {{ pct(s) === 100 ? 'Complet' : `${s.checked}/${s.total}` }}
            </span>
            <span style="color:var(--text3); font-size:12px">{{ openSessions.has(s.id) ? '▲' : '▼' }}</span>
          </div>
        </div>

        <div class="hist-body" :class="{ open: openSessions.has(s.id) }">
          <div class="hist-phase-label">
            {{ s.phase === 'depart' ? 'Équipements du retour' : 'Équipements du départ' }}
          </div>
          <div v-for="item in (s.snapshot || [])" :key="item.id" class="hist-item">
            <div class="dot" :class="item.checked ? 'dot-ok' : (item.taken > 0 && item.taken < item.qty ? 'dot-warn' : 'dot-ko')"></div>
            <span>
              {{ item.name }}
              <span v-if="item.qty > 1" style="color:var(--text3); font-size:11px">
                ({{ item.taken ?? (item.checked ? item.qty : 0) }}/{{ item.qty }})
              </span>
              <span v-if="item.borrowedFrom" style="color:var(--warn); font-size:11px">
                – rendu à {{ item.borrowedFrom }}
              </span>
            </span>
          </div>
          <div class="divider"></div>
          <div v-if="confirmDeleteId === s.id" class="delete-confirm">
            <span>Supprimer définitivement ?</span>
            <button class="btn btn-danger btn-sm" @click="deleteSession(s.id)">Oui, supprimer</button>
            <button class="btn btn-secondary btn-sm" @click="confirmDeleteId = null">Annuler</button>
          </div>
          <button v-else class="btn btn-danger btn-sm btn-full" style="margin-top:4px" @click="confirmDeleteId = s.id">
            🗑️ Supprimer cette session
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
