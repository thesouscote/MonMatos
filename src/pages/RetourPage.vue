<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useStore } from '../store'
import type { UserData, Item, BorrowedItem } from '../types'
import {
  Package,
  ChevronLeft,
  Search,
  X,
  Check,
  Minus,
  Plus,
  ExternalLink,
  Trash2,
  Save,
  Settings2
} from 'lucide-vue-next'

const props = defineProps<{ state: UserData & { _uid: string | null } }>()
const emit = defineEmits<{ back: []; toast: [msg: string]; navigate: [page: any] }>()
const { save } = useStore()

// Step 1: choose parent departure
const pendingDepartures = computed(() =>
  (props.state.sessions || []).filter(s => s.phase === 'arrive' && !s.isReturned)
)

const activeParentId = ref<number | null>(null)

// Auto-select si 1 seul départ en cours, skip modal si 0
const showLinkModal = ref(false)

onMounted(() => {
  const pending = pendingDepartures.value
  if (pending.length === 1) {
    // 1 seul: sélection automatique
    activeParentId.value = pending[0].id
    initItems()
  } else if (pending.length === 0) {
    // Aucun: retour libre
    initItems()
  } else {
    // Plusieurs: afficher le modal
    showLinkModal.value = true
  }
})

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

const allItems    = computed(() => [...sessionItems.value, ...borrowedItems.value])
const totalQty    = computed(() => allItems.value.reduce((s, i) => s + i.qty, 0))
const takenQty    = computed(() => allItems.value.reduce((s, i) => s + (i.takenDepart ?? 0), 0))
const checkedCount = computed(() => takenQty.value)
const total       = computed(() => allItems.value.length)
const pct         = computed(() => totalQty.value ? Math.round((takenQty.value / totalQty.value) * 100) : 0)
const allDone     = computed(() => totalQty.value > 0 && takenQty.value === totalQty.value)

function getMaxQty(item: Item): number {
  if (activeParentId.value && parentSession.value) {
    const snap = parentSession.value.snapshot.find(s => s.id === item.id || s.name === item.name)
    if (snap) return snap.taken
  }
  return item.qty
}

function toggleItem(item: Item) {
  const max = getMaxQty(item)
  const cur = item.takenDepart ?? 0
  // Cycle: 0 → 1 → 2 → … → max → 0
  const next = cur >= max ? 0 : cur + 1
  item.takenDepart = next
  item.checkedDepart = next === max
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

// ─── ADD MATOS FROM INVENTORY ───
const showAddModal = ref(false)
const addSearch = ref('')
const addQtys = ref<Record<number, number>>({})

const alreadyInSession = computed(() => new Set(sessionItems.value.map(i => i.id)))

const inventoryToAdd = computed(() =>
  (props.state.items || []).filter(i =>
    !alreadyInSession.value.has(i.id) &&
    i.name.toLowerCase().includes(addSearch.value.toLowerCase())
  )
)

function openAddModal() {
  addSearch.value = ''
  addQtys.value = {}
  showAddModal.value = true
}

function setAddQty(itemId: number, val: number, max: number) {
  addQtys.value[itemId] = Math.max(0, Math.min(max, val))
}

function confirmAddMatos() {
  const added = Object.entries(addQtys.value)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => {
      const item = (props.state.items || []).find(i => i.id === Number(id))
      if (!item) return null
      return { ...item, qty: Number(qty), checkedDepart: false, takenDepart: 0 }
    })
    .filter(Boolean) as Item[]

  if (!added.length) { emit('toast', 'Sélectionne au moins un item'); return }
  sessionItems.value.push(...added)
  showAddModal.value = false
  emit('toast', `${added.length} item${added.length > 1 ? 's' : ''} ajouté${added.length > 1 ? 's' : ''} !`)
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

// SAVE — direct, no modal
const saving = ref(false)

async function openSave() {
  if (checkedCount.value === 0) { emit('toast', 'Coche au moins un item !'); return }
  if (!allDone.value) {
    const missing = totalQty.value - takenQty.value
    emit('toast', `⚠️ ${missing} unité${missing > 1 ? 's' : ''} manquante${missing > 1 ? 's' : ''} — vérifie tout le matos !`)
    return
  }
  if (saving.value) return
  saving.value = true

  const d = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
  const name = parentSession.value
    ? `${parentSession.value.name} — Retour`
    : `${d} – Retour`

  const allSnap = [
    ...sessionItems.value.map(i => ({
      id: i.id, name: i.name, cat: i.cat, qty: i.qty,
      taken: i.takenDepart ?? 0,
      checked: !!i.checkedDepart,
      borrowedFrom: null,
      imageUrl: i.imageUrl,
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

  // Marquer le départ parent comme retourné
  if (activeParentId.value) {
    const parent = props.state.sessions.find(s => s.id === activeParentId.value)
    if (parent) parent.isReturned = true
  }

  await save()
  saving.value = false
  emit('toast', `✅ ${name} sauvegardé !`)
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
          <div class="modal-title"><Package :size="20" style="color:var(--accent);display:inline-block;vertical-align:middle;margin-right:8px" /> Retour</div>
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
      <header class="page-header">
        <div class="ph-left" style="display:flex;align-items:center;gap:12px;flex:1">
          <button class="btn-back" @click="emit('back')"><ChevronLeft :size="20" /></button>
          <div style="display:flex;flex-direction:column">
            <h1 class="page-title" style="font-size:13px;letter-spacing:0.05em">RETOUR MATÉRIEL</h1>
            <div v-if="parentSession" style="font-size:10px; color:var(--accent); font-family:var(--font-mono)">↳ {{ parentSession.name }}</div>
          </div>
        </div>
        <button class="btn-tech-link" style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--surface2);border-radius:6px;font-size:10px;font-weight:700;color:var(--text2)" @click="emit('navigate', 'gestion')">
          <Settings2 :size="14" />
          <span>MATOS</span>
        </button>
      </header>

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
          <div class="title"><Check :size="18" style="display:inline-block;vertical-align:middle;margin-right:6px" /> Tout est rentré !</div>
          <div class="sub">Tout le matériel est vérifié. Appuie sur Sauvegarder !</div>
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
                <Check v-if="item.checkedDepart" :size="10" stroke-width="3" />
                <div v-else-if="(item.takenDepart ?? 0) > 0" class="partial-dot"></div>
              </div>
              <div v-if="item.imageUrl" class="item-mini-thumb">
                <img :src="item.imageUrl" alt="" loading="lazy" />
              </div>
              <div class="item-info">
                <div class="item-name-text">{{ item.name }}</div>
              </div>
              <div v-if="getMaxQty(item) > 1" class="qty-selector" @click.stop>
                <button class="qty-btn" @click="changeQty(item, -1)"><Minus :size="14" /></button>
                <span class="qty-val">{{ item.takenDepart ?? 0 }}/{{ getMaxQty(item) }}</span>
                <button class="qty-btn" @click="changeQty(item, 1)"><Plus :size="14" /></button>
              </div>
              <span v-else class="item-qty-badge">×1</span>
            </div>
          </template>
        </template>

        <!-- ACTIONS: AJOUTER MATOS + EMPRUNT -->
        <div class="divider"></div>
        <div style="display:flex; gap:8px; margin-bottom:10px">
          <button class="btn-add-matos" style="flex:1" @click="openAddModal">
            <Package :size="14" style="display:inline-block;vertical-align:middle;margin-right:6px" /> Ajouter du matos
          </button>
          <button class="btn btn-secondary btn-sm" style="flex:1" @click="showBorrowPanel = !showBorrowPanel">
            <template v-if="showBorrowPanel"><X :size="14" style="margin-right:6px" /> Fermer</template>
            <template v-else><Plus :size="14" style="margin-right:6px" /> Emprunt externe</template>
          </button>
        </div>
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
            <Check v-if="b.checkedDepart" :size="10" stroke-width="3" />
          </div>
          <div class="item-info" @click="b.checkedDepart = !b.checkedDepart">
            <div class="item-name-text">{{ b.name }}</div>
            <div v-if="b.borrowedFrom" class="item-sub"><ExternalLink :size="10" style="display:inline-block;vertical-align:middle;margin-right:4px" /> Rendre à {{ b.borrowedFrom }}</div>
          </div>
          <button @click="removeBorrowed(b._bid)" style="color:var(--danger); padding:4px"><Trash2 :size="16" /></button>
        </div>
      </div>

      <!-- BOTTOM BAR -->
      <div class="bottom-bar">
        <button class="btn btn-secondary btn-sm" @click="sessionItems.forEach(i => { i.checkedDepart = false; i.takenDepart = 0 })">
          Réinit.
        </button>
        <button
          class="btn btn-primary"
          :class="{ 'btn-blocked': !allDone }"
          :style="!allDone ? 'opacity:0.5; cursor:not-allowed' : ''"
          @click="openSave"
        >
          {{ allDone ? 'Sauvegarder' : `⚠️ ${totalQty - takenQty} manquant${(totalQty - takenQty) > 1 ? 's' : ''}` }}
        </button>
      </div>


      <!-- ADD MATOS MODAL -->
      <Teleport to="body">
        <div v-if="showAddModal" class="modal-backdrop" @click.self="showAddModal = false">
          <div class="modal-sheet" style="max-height:85dvh; overflow-y:auto">
            <div class="modal-handle"></div>
            <div class="modal-title"><Package :size="20" style="color:var(--accent);display:inline-block;vertical-align:middle;margin-right:8px" /> Ajouter du matos</div>
            <div class="search-bar" style="margin-bottom:12px">
              <Search :size="16" class="search-icon" />
              <input v-model="addSearch" placeholder="Rechercher…" />
            </div>
            <div v-if="!inventoryToAdd.length" style="text-align:center; color:var(--text3); font-size:13px; padding:16px 0">
              Tout le stock est déjà dans cette session.
            </div>
            <div v-for="item in inventoryToAdd" :key="item.id" class="add-item-row">
              <div class="add-item-info">
                <div class="add-item-name">{{ item.name }}</div>
                <div class="add-item-cat">{{ item.cat }} · {{ item.qty }} en stock</div>
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
              <button class="btn btn-secondary" style="flex:1" @click="showAddModal = false">Annuler</button>
              <button class="btn btn-primary" style="flex:2" @click="confirmAddMatos">
                Ajouter ({{ Object.values(addQtys).filter(q => q > 0).length }})
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
.partial-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--warn); }

.btn-add-matos {
  padding: 10px; border-radius: var(--radius-sm);
  background: rgba(240,192,64,0.08); border: 0.5px dashed rgba(240,192,64,0.3);
  color: var(--accent); font-size: 13px; font-weight: 600;
  cursor: pointer; transition: background 0.15s;
}
.btn-add-matos:hover { background: rgba(240,192,64,0.14); }

.add-item-row {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 0; border-bottom: 0.5px solid var(--border);
}
.add-item-info { flex: 1; min-width: 0; }
.add-item-name { font-size: 13px; font-weight: 600; }
.add-item-cat  { font-size: 11px; color: var(--text3); margin-top: 2px; }
.add-qty-row   { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.qty-active    { color: var(--accent); font-weight: 700; }
.item-mini-thumb {
  width: 38px; height: 38px; border-radius: 6px;
  overflow: hidden; background: var(--surface2);
  margin: 0 4px; flex-shrink: 0;
  border: 0.5px solid var(--border2);
}
.item-mini-thumb img { width: 100%; height: 100%; object-fit: cover; }
</style>
