<script setup lang="ts">
import { ref, computed } from 'vue'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useStore } from '../store'
import type { UserData } from '../types'
import {
  ClipboardList,
  ChevronLeft,
  Search,
  X,
  LayoutGrid,
  Activity,
  CheckCircle2,
  History,
  Calendar,
  ChevronDown,
  ChevronUp,
  Timer,
  Minus,
  Plus,
  Trash2,
  Copy,
  FileDown,
  Mail,
  Send
} from 'lucide-vue-next'

import { useTransfers } from '../composables/useTransfers'

const props = defineProps<{ state: UserData & { _uid: string | null } }>()
const emit = defineEmits<{ back: []; toast: [msg: string] }>()
const { save } = useStore()
const { sendSessionToAccount } = useTransfers()
const isEditor = computed(() => props.state.activeProfile?.role === 'admin' || props.state.activeProfile?.role === 'editor')

const openSessions = ref(new Set<number>())
const search = ref('')
const confirmDeleteId = ref<number | null>(null)
const filterTab = ref<'all' | 'active' | 'done'>('all')

const transferMatosSessionId = ref<number | null>(null)
const transferEmailInput = ref('')

function openTransferModal(sessionId: number) {
  transferMatosSessionId.value = sessionId
  transferEmailInput.value = ''
}

async function confirmTransfer() {
  const sess = props.state.sessions.find(s => s.id === transferMatosSessionId.value)
  if (!sess) return
  if (!transferEmailInput.value.trim()) { emit('toast', 'Veuillez saisir un e-mail'); return }
  try {
    await sendSessionToAccount(sess, transferEmailInput.value)
    emit('toast', 'Session transférée avec succès !')
    transferMatosSessionId.value = null
  } catch (err: any) {
    emit('toast', "Erreur lors de l'envoi")
  }
}

// ─── ADD MATOS MODAL ───
const addMatosSessionId = ref<number | null>(null)
const addSearch = ref('')
const addQtys = ref<Record<number, number>>({})

const targetSession = computed(() =>
  props.state.sessions.find(s => s.id === addMatosSessionId.value) ?? null
)

const availableToAdd = computed(() => {
  if (!targetSession.value) return []
  const inSnap = new Set(targetSession.value.snapshot.map(s => s.id))
  return (props.state.items || []).filter(i =>
    !inSnap.has(i.id) &&
    i.name.toLowerCase().includes(addSearch.value.toLowerCase())
  )
})

function openAddModal(sessionId: number) {
  addMatosSessionId.value = sessionId
  addSearch.value = ''
  addQtys.value = {}
}

function setAddQty(itemId: number, val: number, max: number) {
  addQtys.value[itemId] = Math.max(0, Math.min(max, val))
}

async function confirmAdd() {
  const sess = targetSession.value
  if (!sess) return
  const toAdd = Object.entries(addQtys.value)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => {
      const item = (props.state.items || []).find(i => i.id === Number(id))
      if (!item) return null
      return { id: item.id, name: item.name, cat: item.cat, qty: item.qty, taken: qty, checked: qty === item.qty, borrowedFrom: null, imageUrl: item.imageUrl }
    })
    .filter(Boolean) as typeof sess.snapshot

  if (!toAdd.length) { emit('toast', 'Sélectionne au moins un item'); return }
  sess.snapshot = [...sess.snapshot, ...toAdd]
  sess.total = sess.snapshot.length
  sess.checked = sess.snapshot.filter(s => s.checked).length
  await save()
  emit('toast', `${toAdd.length} item${toAdd.length > 1 ? 's' : ''} ajouté${toAdd.length > 1 ? 's' : ''} !`)
  addMatosSessionId.value = null
}

// ─── EDIT SNAPSHOT ───
async function updateSnapQty(sess: any, snapIdx: number, delta: number) {
  const snap = sess.snapshot[snapIdx]
  const newTaken = Math.max(0, Math.min(snap.qty, snap.taken + delta))
  snap.taken = newTaken
  snap.checked = newTaken === snap.qty
  sess.checked = sess.snapshot.filter((s: any) => s.checked).length
  await save()
}

async function removeSnapItem(sess: any, snapIdx: number) {
  sess.snapshot.splice(snapIdx, 1)
  sess.total = sess.snapshot.length
  sess.checked = sess.snapshot.filter((s: any) => s.checked).length
  await save()
  emit('toast', 'Item retiré')
}

// ─── DURATION ───
function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

function durationLabel(days: number): string {
  if (days === 0) return "Aujourd'hui"
  if (days === 1) return '1 jour'
  return `${days} jours`
}

// ─── COPY SUMMARY ───
function copySummary(s: any) {
  const lines = [
    `📋 ${s.name}`,
    `📅 ${formatDate(s.date)}`,
    `${phaseLabel(s)}`,
    '',
    ...(s.snapshot || []).map((i: any) =>
      `${i.taken > 0 ? '✅' : '❌'} ${i.name} (${i.taken}/${i.qty})`
    )
  ]
  navigator.clipboard.writeText(lines.join('\n'))
  emit('toast', 'Résumé copié !')
}

// ─── SHARE EMAIL ───
function shareEmail(s: any) {
  const subject = encodeURIComponent(`${s.phase === 'depart' ? 'Retour' : 'Départ'} : ${s.name}`);
  const lines = [
    `📋 ${s.name}`,
    `📅 ${formatDate(s.date)}`,
    `${phaseLabel(s)}`,
    '',
    ...(s.snapshot || []).map((i: any) =>
      `${i.taken > 0 ? '✅' : '❌'} ${i.name} (${i.taken}/${i.qty})`
    )
  ];
  const body = encodeURIComponent(lines.join('\n'));
  window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
}

// ─── CORE ───
const filtered = computed(() => {
  let list = (props.state.sessions || []).filter(s =>
    s.name.toLowerCase().includes(search.value.toLowerCase())
  )
  if (filterTab.value === 'active') list = list.filter(s => s.phase === 'arrive' && !s.isReturned)
  if (filterTab.value === 'done')   list = list.filter(s => s.phase === 'depart' || s.isReturned)
  return list
})

const activeSessions = computed(() =>
  (props.state.sessions || []).filter(s => s.phase === 'arrive' && !s.isReturned)
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

function exportToPDF(s: any) {
  const doc = new jsPDF()
  const title = `MonMatos - ${s.name}`
  const date = formatDate(s.date)
  
  // Header
  doc.setFontSize(20)
  doc.text("MonMatos", 14, 22)
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(`Rapport de session : ${s.name}`, 14, 30)
  doc.text(`Date : ${date}`, 14, 35)
  doc.text(`Type : ${s.phase === 'depart' ? 'Retour' : 'Départ'}`, 14, 40)
  
  // Table
  const tableData = s.snapshot.map((item: any) => [
    item.name,
    item.cat,
    `${item.taken}/${item.qty}`,
    item.checked ? 'OK' : 'PARTIEL'
  ])
  
  autoTable(doc, {
    startY: 50,
    head: [['Équipement', 'Catégorie', 'Qté', 'État']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [0, 0, 0] },
    styles: { fontSize: 9 }
  })
  
  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(`Généré par MonMatos - Page ${i}/${pageCount}`, 14, doc.internal.pageSize.height - 10)
  }
  
  // Open in new tab
  window.open(doc.output('bloburl'), '_blank')
  emit('toast', 'PDF généré !')
}
</script>

<template>
  <div class="page-root">
    <div class="page-header">
      <button class="back-btn" @click="emit('back')"><ChevronLeft :size="20" /></button>
      <div style="display:flex;align-items:center;gap:10px">
        <ClipboardList :size="22" stroke-width="2.5" style="color:var(--accent)" />
        <h1>Historique</h1>
      </div>
      <div class="progress-pill" v-if="activeSessions.length">
        🔴 {{ activeSessions.length }} en cours
      </div>
    </div>

    <div class="page-content">
      <!-- SEARCH -->
      <div class="search-bar">
        <Search :size="16" class="search-icon" />
        <input v-model="search" placeholder="Rechercher une session…" />
        <button v-if="search" @click="search = ''"><X :size="16" style="color:var(--text3)" /></button>
      </div>

      <!-- FILTER TABS -->
      <div class="filter-tabs">
        <button class="filter-tab" :class="{ active: filterTab === 'all' }" @click="filterTab = 'all'">
          <LayoutGrid :size="14" /> Toutes ({{ (state.sessions || []).length }})
        </button>
        <button class="filter-tab" :class="{ active: filterTab === 'active' }" @click="filterTab = 'active'">
          <Activity :size="14" /> En cours ({{ activeSessions.length }})
        </button>
        <button class="filter-tab" :class="{ active: filterTab === 'done' }" @click="filterTab = 'done'">
          <CheckCircle2 :size="14" /> Clôturées
        </button>
      </div>

      <div v-if="!filtered.length" class="empty-state">
        <History :size="48" style="opacity:0.2;margin-bottom:12px" />
        <p>Aucune session trouvée.</p>
      </div>

      <div v-for="s in filtered" :key="s.id" class="hist-session">
        <!-- HEADER ROW -->
        <div class="hist-header" @click="toggle(s.id)">
          <div style="flex:1; min-width:0; display:flex; gap:12px; align-items:center">
            <div class="hist-icon-box">
              <Package v-if="s.phase === 'depart'" :size="16" />
              <Clapperboard v-else :size="16" />
            </div>
            <div style="flex:1; min-width:0">
              <div class="hist-title">{{ s.name }}</div>
              <div class="hist-date"><Calendar :size="10" style="vertical-align:middle;margin-right:2px" /> {{ formatDate(s.date) }}</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:6px; flex-shrink:0">
            <!-- Duration badge for active departures -->
            <span
              v-if="s.phase === 'arrive' && !s.isReturned && daysSince(s.date) > 0"
              class="duration-badge"
            ><Timer :size="10" /> {{ durationLabel(daysSince(s.date)) }}</span>
            <span class="badge" :class="pct(s) === 100 ? 'badge-ok' : 'badge-partial'">
              {{ phaseLabel(s).replace(/[🎬📦]/g, '') }}
            </span>
            <ChevronUp v-if="openSessions.has(s.id)" :size="16" style="color:var(--text3)" />
            <ChevronDown v-else :size="16" style="color:var(--text3)" />
          </div>
        </div>

        <!-- EXPANDED BODY -->
        <div class="hist-body" :class="{ open: openSessions.has(s.id) }">
          <div class="hist-phase-label" style="display:flex;align-items:center;justify-content:space-between">
            <span>{{ s.phase === 'depart' ? 'Équipements retournés' : 'Équipements emportés' }}</span>
            <div style="display:flex;gap:8px">
              <button class="cat-check-all" @click="exportToPDF(s)"><FileDown :size="12" style="margin-right:4px" /> PDF</button>
              <button class="cat-check-all" @click="copySummary(s)"><Copy :size="12" style="margin-right:4px" /> Copier</button>
              <button class="cat-check-all" @click="shareEmail(s)"><Mail :size="12" style="margin-right:4px" /> E-mail</button>
              <button v-if="isEditor" class="cat-check-all" @click="openTransferModal(s.id)"><Send :size="12" style="margin-right:4px" /> Compte</button>
            </div>
          </div>

          <!-- SNAPSHOT ITEMS (editable) -->
          <div v-for="(item, idx) in (s.snapshot || [])" :key="item.id" class="hist-item-row">
            <div class="dot" :class="item.checked ? 'dot-ok' : (item.taken > 0 ? 'dot-warn' : 'dotKo')"></div>
            <img v-if="item.imageUrl" :src="item.imageUrl" class="hist-mini-thumb" loading="lazy" />
            <span class="hist-item-name">
              {{ item.name }}
              <span v-if="item.borrowedFrom" style="color:var(--warn);font-size:11px"> – {{ item.borrowedFrom }}</span>
            </span>
            <div class="snap-qty" @click.stop>
              <button v-if="isEditor" class="snap-btn" @click="updateSnapQty(s, idx, -1)"><Minus :size="10" /></button>
              <span>{{ item.taken }}/{{ item.qty }}</span>
              <button v-if="isEditor" class="snap-btn" @click="updateSnapQty(s, idx, 1)"><Plus :size="10" /></button>
              <button v-if="isEditor" class="snap-del" @click="removeSnapItem(s, idx)"><Trash2 :size="14" /></button>
            </div>
          </div>

          <div class="divider"></div>

          <!-- ADD MATOS button -->
          <button v-if="isEditor" class="btn-add-matos" @click="openAddModal(s.id)">
            <Plus :size="14" style="margin-right:6px" /> Ajouter du matos à cette session
          </button>

          <!-- DELETE -->
          <template v-if="isEditor">
            <div v-if="confirmDeleteId === s.id" class="delete-confirm">
              <span>Supprimer définitivement ?</span>
              <button class="btn btn-danger btn-sm" @click="deleteSession(s.id)">Oui</button>
              <button class="btn btn-secondary btn-sm" @click="confirmDeleteId = null">Annuler</button>
            </div>
            <button v-else class="btn btn-danger btn-sm btn-full" style="margin-top:6px" @click="confirmDeleteId = s.id">
              <Trash2 :size="16" style="margin-right:8px" /> Supprimer cette session
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- ═══ ADD MATOS MODAL ═══ -->
    <Teleport to="body">
      <div v-if="addMatosSessionId !== null" class="modal-backdrop" @click.self="addMatosSessionId = null">
        <div class="modal-sheet" style="max-height:85dvh">
          <div class="modal-handle"></div>
          <div class="modal-title"><Plus :size="20" style="color:var(--accent);vertical-align:middle;margin-right:8px" /> Ajouter du matos</div>
          <div class="modal-desc">{{ targetSession?.name }}</div>

          <div class="search-bar" style="margin-bottom:12px">
            <Search :size="16" class="search-icon" />
            <input v-model="addSearch" placeholder="Rechercher un équipement…" />
          </div>

          <div v-if="!availableToAdd.length" style="text-align:center; color:var(--text3); font-size:13px; padding:20px 0">
            Tous tes équipements sont déjà dans cette session.
          </div>

          <div v-for="item in availableToAdd" :key="item.id" class="add-item-row">
            <div class="add-item-info">
              <div class="add-item-name">{{ item.name }}</div>
              <div class="add-item-cat">{{ item.cat }}</div>
            </div>
            <div class="add-qty-row">
              <button class="qty-btn" @click="setAddQty(item.id, (addQtys[item.id] ?? 0) - 1, item.qty)"><Minus :size="14" /></button>
              <span class="qty-val" :class="{ 'qty-active': (addQtys[item.id] ?? 0) > 0 }">
                {{ addQtys[item.id] ?? 0 }}/{{ item.qty }}
              </span>
              <button class="qty-btn" @click="setAddQty(item.id, (addQtys[item.id] ?? 0) + 1, item.qty)"><Plus :size="14" /></button>
            </div>
          </div>

          <div class="modal-actions" style="margin-top:16px">
            <button class="btn btn-secondary" style="flex:1" @click="addMatosSessionId = null">Annuler</button>
            <button class="btn btn-primary" style="flex:2" @click="confirmAdd">
              Ajouter ({{ Object.values(addQtys).filter(q => q > 0).length }} items)
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ═══ TRANSFER MODAL ═══ -->
    <Teleport to="body">
      <div v-if="transferMatosSessionId !== null" class="modal-backdrop" @click.self="transferMatosSessionId = null">
        <div class="modal-sheet" style="max-height:50dvh">
          <div class="modal-handle"></div>
          <div class="modal-title"><Send :size="20" style="color:var(--accent);vertical-align:middle;margin-right:8px" /> Envoyer à un compte</div>
          <div class="modal-desc">Transfère cette session et son contenu au compte MonMatos cible.</div>

          <div class="search-bar" style="margin:20px 0">
            <Mail :size="16" class="search-icon" />
            <input v-model="transferEmailInput" type="email" placeholder="E-mail du compte destinataire..." />
          </div>

          <div class="modal-actions" style="margin-top:16px">
            <button class="btn btn-secondary" style="flex:1" @click="transferMatosSessionId = null">Annuler</button>
            <button class="btn btn-primary" style="flex:2" @click="confirmTransfer">Envoyer</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.progress-pill {
  background: rgba(239,68,68,0.12); color: var(--danger);
  border: 0.5px solid rgba(239,68,68,0.2);
  border-radius: 99px; padding: 4px 12px;
  font-size: 11px; font-weight: 700;
}
.hist-item-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 0; border-bottom: 0.5px solid var(--border);
}
.hist-item-name { flex: 1; font-size: 13px; }
.snap-qty { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.snap-btn {
  width: 22px; height: 22px; border-radius: 50%;
  background: var(--surface2); border: 0.5px solid var(--border2);
  font-size: 13px; font-weight: 700; color: var(--text);
  display: flex; align-items: center; justify-content: center;
}
.snap-btn:hover { background: var(--border2); }
.snap-qty span { font-size: 11px; color: var(--text2); min-width: 32px; text-align: center; }
.snap-del { color: var(--text3); font-size: 13px; padding: 2px 4px; background: transparent; }
.snap-del:hover { color: var(--danger); }
.btn-add-matos {
  width: 100%; padding: 10px; border-radius: var(--radius-sm);
  background: rgba(240,192,64,0.08); border: 0.5px dashed rgba(240,192,64,0.3);
  color: var(--accent); font-size: 13px; font-weight: 600;
  cursor: pointer; transition: background 0.15s; margin-bottom: 8px;
}
.btn-add-matos:hover { background: rgba(240,192,64,0.14); }
.add-item-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 0.5px solid var(--border); }
.add-item-info { flex: 1; min-width: 0; }
.add-item-name { font-size: 13px; font-weight: 600; }
.add-item-cat  { font-size: 11px; color: var(--text3); }
.add-qty-row   { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.add-item-cat  { font-size: 11px; color: var(--text3); }
.add-qty-row   { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.qty-active    { color: var(--accent); font-weight: 700; }
.hist-mini-thumb {
  width: 28px; height: 28px; border-radius: 4px;
  object-fit: cover; background: var(--surface2);
  border: 0.5px solid var(--border2); flex-shrink: 0;
}
.hist-icon-box {
  width: 32px; height: 32px; border-radius: 8px;
  background: var(--surface2); color: var(--text3);
  display: flex; align-items: center; justify-content: center;
}
.duration-badge { display: flex; align-items: center; gap: 4px; }
.filter-tab { display: flex; align-items: center; gap: 6px; }
</style>
