<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStore } from '../store'
import type { UserData, Item, BorrowedItem } from '../types'

const props = defineProps<{ state: UserData & { _uid: string | null } }>()
const emit = defineEmits<{ back: []; toast: [msg: string] }>()
const { save } = useStore()

// Step 1: choose parent departure
const pendingDepartures = computed(() =>
  (props.state.sessions || []).filter(s => s.phase === 'arrive' && !s.isReturned)
)

const activeParentId = ref<number | null>(null)
const showLinkModal = ref(true) // always show first if there are pending deps

const parentSession = computed(() =>
  activeParentId.value
    ? props.state.sessions.find(s => s.id === activeParentId.value)
    : null
)

function selectParent(id: number | null) {
  activeParentId.value = id
  showLinkModal.value = false
  initItems()
}

// Session items
const sessionItems = ref<Item[]>([])
const borrowedItems = ref<BorrowedItem[]>([])
const search = ref('')

function initItems() {
  const all = props.state.items || []
  if (parentSession.value?.snapshot) {
    const snaps = parentSession.value.snapshot.filter(s => s.taken > 0)
    sessionItems.value = snaps.map(snap => {
      const orig = all.find(i => i.id === snap.id || i.name === snap.name)
      if (!orig) return null
      return { ...orig, qty: snap.taken, checkedDepart: false, takenDepart: 0 }
    }).filter(Boolean) as Item[]
  } else {
    sessionItems.value = all
      .filter(i => i.status === 'ok' || i.status === 'lent')
      .map(i => ({ ...i, checkedDepart: false, takenDepart: 0 }))
  }
}

const cats = computed(() => props.state.categories || [])

const filteredByCat = (cat: string) =>
  sessionItems.value.filter(i => i.cat === cat && i.name.toLowerCase().includes(search.value.toLowerCase()))

const allItems = computed(() => [...sessionItems.value, ...borrowedItems.value])
const checkedCount = computed(() => allItems.value.filter(i => i.checkedDepart).length)
const total = computed(() => allItems.value.length)
const pct = computed(() => total.value ? Math.round((checkedCount.value / total.value) * 100) : 0)
const allDone = computed(() => total.value > 0 && checkedCount.value === total.value)

function getMaxQty(item: Item): number {
  if (activeParentId.value && parentSession.value) {
    const snap = parentSession.value.snapshot.find(s => s.id === item.id || s.name === item.name)
    if (snap) return snap.taken
  }
  return item.qty
}

function toggleItem(item: Item) {
  const max = getMaxQty(item)
  if ((item.takenDepart ?? 0) === max) {
    item.takenDepart = 0; item.checkedDepart = false
  } else {
    item.takenDepart = max; item.checkedDepart = true
  }
}

function changeQty(item: Item, delta: number) {
  const max = getMaxQty(item)
  const next = Math.max(0, Math.min(max, (item.takenDepart ?? 0) + delta))
  item.takenDepart = next
  item.checkedDepart = next === max
}

function checkClass(item: Item) {
  const t = item.takenDepart ?? 0
  const max = getMaxQty(item)
  if (t === max) return 'checked'
  if (t > 0) return 'partial'
  return ''
}

// BORROWED
const showBorrowPanel = ref(false)
const borrowName = ref('')
const borrowFrom = ref('')
const borrowQty = ref(1)

function addBorrowed() {
  if (!borrowName.value.trim()) return
  borrowedItems.value.push({
    _bid: Date.now(),
    name: borrowName.value.trim(),
    borrowedFrom: borrowFrom.value.trim() || null,
    qty: borrowQty.value,
    checkedDepart: false,
    takenDepart: 0,
  })
  borrowName.value = ''; borrowFrom.value = ''; borrowQty.value = 1
  emit('toast', 'Item emprunté ajouté')
}

function removeBorrowed(bid: number) {
  borrowedItems.value = borrowedItems.value.filter(b => b._bid !== bid)
}

// SAVE
const showSaveModal = ref(false)
const sessionName = ref('')
const saving = ref(false)

function openSave() {
  if (checkedCount.value === 0) { emit('toast', 'Coche au moins un item !'); return }
  const d = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
  sessionName.value = `${d} – Retour`
  showSaveModal.value = true
}

async function confirmSave() {
  saving.value = true
  const name = sessionName.value.trim() || 'Retour sans nom'

  const allSnap = [
    ...sessionItems.value.map(i => ({
      id: i.id, name: i.name, cat: i.cat, qty: i.qty,
      taken: i.takenDepart ?? 0,
      checked: !!i.checkedDepart,
      borrowedFrom: null,
    })),
    ...borrowedItems.value.map(b => ({
      id: b._bid, name: b.name, cat: '', qty: b.qty,
      taken: b.takenDepart ?? b.qty,
      checked: !!b.checkedDepart,
      borrowedFrom: b.borrowedFrom,
    })),
  ]

  const session = {
    id: Date.now(), name,
    date: new Date().toISOString(),
    phase: 'depart' as const,
    total: allItems.value.length,
    checked: checkedCount.value,
    snapshot: allSnap,
    linkedToDepartId: activeParentId.value,
  }

  props.state.sessions.unshift(session)

  // Mark parent as returned
  if (activeParentId.value) {
    const parent = props.state.sessions.find(s => s.id === activeParentId.value)
    if (parent) parent.isReturned = true
  }

  await save()
  saving.value = false
  showSaveModal.value = false
  emit('toast', `"${name}" sauvegardé !`)
  emit('back')
}
</script>

<template>
  <div class="page-root">
    <!-- LINK MODAL -->
    <Teleport to="body">
      <div v-if="showLinkModal" class="modal-backdrop">
        <div class="modal-sheet">
          <div class="modal-handle"></div>
          <div class="modal-title">📦 Retour</div>
          <div class="modal-desc">Associer à un départ existant ?</div>

          <div v-if="pendingDepartures.length">
            <button
              v-for="s in pendingDepartures"
              :key="s.id"
              class="depart-session-btn"
              @click="selectParent(s.id)"
            >
              <div class="dsb-title">{{ s.name }}</div>
              <div class="dsb-date">
                {{ new Date(s.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) }}
                · {{ s.checked }} items emportés
              </div>
            </button>
          </div>
          <p v-else style="color:var(--text2); font-size:13px; margin-bottom:16px;">
            Aucun départ en cours trouvé.
          </p>

          <div class="modal-actions">
            <button class="btn btn-secondary" style="flex:1" @click="emit('back')">Annuler</button>
            <button class="btn btn-secondary" style="flex:1" @click="selectParent(null)">Retour libre</button>
          </div>
        </div>
      </div>
    </Teleport>

    <template v-if="!showLinkModal">
      <!-- HEADER -->
      <div class="page-header">
        <button class="back-btn" @click="emit('back')">←</button>
        <div style="flex:1">
          <h1>📦 Retour</h1>
          <div v-if="parentSession" style="font-size:11px; color:var(--accent);">↳ {{ parentSession.name }}</div>
        </div>
        <div class="progress-pill">{{ checkedCount }}/{{ total }}</div>
      </div>

      <div style="padding: 10px 20px 0">
        <div class="progress-bar"><div class="progress-fill" :style="{ width: pct + '%' }"></div></div>
      </div>

      <div class="page-content">
        <!-- SEARCH -->
        <div class="search-bar">
          <span class="search-icon">🔍</span>
          <input v-model="search" placeholder="Rechercher…" />
          <button v-if="search" @click="search = ''" style="color:var(--text3); font-size:16px;">✕</button>
        </div>

        <!-- DONE -->
        <div v-if="allDone" class="done-banner animate-in">
          <div class="title">✅ Tout est rentré !</div>
          <div class="sub">Tout le matériel est vérifié. Beau travail !</div>
          <button class="btn btn-primary" @click="openSave">Sauvegarder ce retour</button>
        </div>

        <!-- ITEMS -->
        <template v-for="cat in cats" :key="cat">
          <template v-if="filteredByCat(cat).length">
            <div class="cat-label">{{ cat }}</div>
            <div
              v-for="item in filteredByCat(cat)"
              :key="item.id"
              class="item-card"
              :class="checkClass(item)"
              @click="toggleItem(item)"
            >
              <div class="check-circle">
                <span v-if="item.checkedDepart" class="check-icon">✓</span>
                <span v-else-if="(item.takenDepart ?? 0) > 0" class="partial-icon">~</span>
              </div>
              <div class="item-info">
                <div class="item-name-text">{{ item.name }}</div>
              </div>
              <div v-if="getMaxQty(item) > 1" class="qty-selector" @click.stop>
                <button class="qty-btn" @click="changeQty(item, -1)">−</button>
                <span class="qty-val">{{ item.takenDepart ?? 0 }}/{{ getMaxQty(item) }}</span>
                <button class="qty-btn" @click="changeQty(item, 1)">+</button>
              </div>
              <span v-else class="item-qty-badge">×1</span>
            </div>
          </template>
        </template>

        <!-- BORROWED -->
        <div class="divider"></div>
        <button class="btn btn-secondary btn-full" style="margin-bottom:10px" @click="showBorrowPanel = !showBorrowPanel">
          {{ showBorrowPanel ? '✕ Fermer' : '+ Ajouter un emprunt' }}
        </button>
        <div v-if="showBorrowPanel" class="card animate-in" style="margin-bottom:12px">
          <input v-model="borrowName" placeholder="Nom de l'équipement" style="margin-bottom:8px" />
          <input v-model="borrowFrom" placeholder="Rendu à qui ?" style="margin-bottom:8px" />
          <div style="display:flex; gap:8px; align-items:center; margin-bottom:10px">
            <label style="font-size:12px; color:var(--text2); flex-shrink:0">Quantité</label>
            <input v-model.number="borrowQty" type="number" min="1" style="width:80px" />
          </div>
          <button class="btn btn-primary btn-full btn-sm" @click="addBorrowed">Ajouter</button>
        </div>
        <div v-for="b in borrowedItems" :key="b._bid" class="item-card" :class="b.checkedDepart ? 'checked' : ''">
          <div class="check-circle" @click="b.checkedDepart = !b.checkedDepart; b.takenDepart = b.checkedDepart ? b.qty : 0">
            <span v-if="b.checkedDepart" class="check-icon">✓</span>
          </div>
          <div class="item-info" @click="b.checkedDepart = !b.checkedDepart">
            <div class="item-name-text">{{ b.name }}</div>
            <div v-if="b.borrowedFrom" class="item-sub">→ Rendre à {{ b.borrowedFrom }}</div>
          </div>
          <button @click="removeBorrowed(b._bid)" style="color:var(--danger); font-size:18px; padding:4px">✕</button>
        </div>
      </div>

      <!-- BOTTOM BAR -->
      <div class="bottom-bar">
        <button class="btn btn-secondary btn-sm" @click="sessionItems.forEach(i => { i.checkedDepart = false; i.takenDepart = 0 })">
          Réinit.
        </button>
        <button class="btn btn-primary" @click="openSave">Sauvegarder</button>
      </div>

      <!-- SAVE MODAL -->
      <Teleport to="body">
        <div v-if="showSaveModal" class="modal-backdrop" @click.self="showSaveModal = false">
          <div class="modal-sheet">
            <div class="modal-handle"></div>
            <div class="modal-title">💾 Sauver le retour</div>
            <div class="modal-desc">{{ checkedCount }} équipements cochés</div>
            <input v-model="sessionName" placeholder="Nom du retour" style="margin-bottom:16px" />
            <div class="modal-actions">
              <button class="btn btn-secondary" style="flex:1" @click="showSaveModal = false">Annuler</button>
              <button class="btn btn-primary" style="flex:2" :disabled="saving" @click="confirmSave">
                {{ saving ? 'Sauvegarde…' : 'Confirmer' }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </template>
  </div>
</template>

<style scoped>
.progress-pill {
  background: var(--surface2); border: 0.5px solid var(--border2);
  border-radius: 99px; padding: 4px 12px;
  font-size: 12px; font-weight: 700;
}
.bottom-bar {
  position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 100%; max-width: 480px;
  display: flex; gap: 10px;
  padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
  background: rgba(22,22,31,0.95);
  backdrop-filter: blur(20px);
  border-top: 0.5px solid var(--border2);
}
.partial-icon { font-size: 11px; color: var(--warn); font-weight: 900; }
</style>
