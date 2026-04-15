<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useStore } from '../store'
import type { UserData, Item } from '../types'
import { getAvailableQty } from '../composables/useStock'
import {
  Clapperboard,
  ChevronLeft,
  Search,
  X,
  Check,
  Minus,
  Plus,
  AlertCircle,
  Save
} from 'lucide-vue-next'

const props = defineProps<{ state: UserData & { _uid: string | null; activeProfile?: any } }>()
const emit = defineEmits<{ back: []; toast: [msg: string] }>()

const hasPermission = computed(() => props.state.activeProfile?.role !== 'viewer')

const { save } = useStore()

// Build session items with available stock capped
const sessionItems = ref<(Item & { availableQty: number })[]>(
  (props.state.items || [])
    .filter(i => i.status === 'ok' || i.status === 'lent')
    .map(i => {
      const avail = getAvailableQty(i.id, i.qty, props.state.sessions || [])
      return { ...i, availableQty: avail, checkedArrive: false, takenArrive: 0 }
    })
)

const search = ref('')
const showSaveModal = ref(false)
const sessionName = ref('')
const saving = ref(false)

const cats = computed(() => props.state.categories || [])

const filteredByCat = (cat: string) =>
  sessionItems.value.filter(i =>
    i.cat === cat && i.name.toLowerCase().includes(search.value.toLowerCase())
  )

const totalQty  = computed(() => sessionItems.value.reduce((s, i) => s + i.availableQty, 0))
const takenQty  = computed(() => sessionItems.value.reduce((s, i) => s + (i.takenArrive ?? 0), 0))
const checkedCount = computed(() => sessionItems.value.filter(i => (i.takenArrive ?? 0) > 0).length)
const total     = computed(() => sessionItems.value.length)
const pct       = computed(() => totalQty.value ? Math.round((takenQty.value / totalQty.value) * 100) : 0)
const allDone   = computed(() => totalQty.value > 0 && takenQty.value === totalQty.value)

// Items with no available stock
const noStockCount = computed(() => sessionItems.value.filter(i => i.availableQty === 0).length)
const hasAnyStock  = computed(() => sessionItems.value.some(i => i.availableQty > 0))

function toggleItem(item: Item & { availableQty: number }) {
  if (!hasPermission.value || item.availableQty === 0) return
  const cur = item.takenArrive ?? 0
  const max = item.availableQty
  // Cycle: 0 → 1 → 2 → … → max → 0
  const next = cur >= max ? 0 : cur + 1
  item.takenArrive = next
  item.checkedArrive = next === max
}

// ✅ Check all items in a category at once
function checkAllInCat(cat: string) {
  if (!hasPermission.value) return
  const items = filteredByCat(cat)
  const allChecked = items.every(i => (i.takenArrive ?? 0) === i.availableQty && i.availableQty > 0)
  items.forEach(item => {
    if (item.availableQty === 0) return
    if (allChecked) {
      item.takenArrive = 0; item.checkedArrive = false
    } else {
      item.takenArrive = item.availableQty; item.checkedArrive = true
    }
  })
}

// ⌨️ Keyboard: Space = toggle next unchecked item
function onKeyDown(e: KeyboardEvent) {
  if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) {
    e.preventDefault()
    const next = sessionItems.value.find(i => (i.takenArrive ?? 0) === 0 && i.availableQty > 0)
    if (next) toggleItem(next)
  }
}
onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))

function changeQty(item: Item & { availableQty: number }, delta: number) {
  if (!hasPermission.value || item.availableQty === 0) return
  const cur = item.takenArrive ?? 0
  const next = Math.max(0, Math.min(item.availableQty, cur + delta))
  item.takenArrive = next
  item.checkedArrive = next === item.availableQty
}

function checkClass(item: Item & { availableQty: number }) {
  if (item.availableQty === 0) return 'out-of-stock'
  const t = item.takenArrive ?? 0
  if (t === item.availableQty) return 'checked'
  if (t > 0) return 'partial'
  return ''
}

function openSave() {
  const anyTaken = sessionItems.value.some(i => (i.takenArrive ?? 0) > 0)
  if (!anyTaken) { emit('toast', 'Prends au moins un item !'); return }
  const d = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
  sessionName.value = `${d} – Départ`
  showSaveModal.value = true
}

async function confirmSave() {
  saving.value = true
  const name = sessionName.value.trim() || 'Session sans nom'
  const takenItems = sessionItems.value.filter(i => (i.takenArrive ?? 0) > 0)
  props.state.sessions.unshift({
    id: Date.now(), name,
    date: new Date().toISOString(),
    phase: 'arrive',
    total: sessionItems.value.length,
    checked: checkedCount.value,
    snapshot: takenItems.map(i => ({
      id: i.id, name: i.name, cat: i.cat, qty: i.qty,
      taken: i.takenArrive ?? 0,
      checked: !!i.checkedArrive,
      borrowedFrom: null,
      imageUrl: i.imageUrl,
    })),
    isReturned: false,
    linkedToDepartId: null,
  })
  try {
    await save()
    emit('toast', `"${name}" sauvegardé !`)
    emit('back')
  } catch (e) {
    emit('toast', 'Vérifiez votre connexion et réessayez.')
  } finally {
    saving.value = false
    showSaveModal.value = false
  }
}

function resetAll() {
  sessionItems.value.forEach(i => { i.checkedArrive = false; i.takenArrive = 0 })
}
</script>

<template>
  <div class="page-root">
    <!-- HEADER -->
    <div class="page-header">
      <button class="back-btn" @click="emit('back')"><ChevronLeft :size="20" /></button>
      <div style="display:flex;align-items:center;gap:10px">
        <Clapperboard :size="22" stroke-width="2.5" style="color:var(--accent)" />
        <h1>Départ</h1>
      </div>
      <div class="progress-pill">{{ takenQty }}/{{ totalQty }}</div>
    </div>

    <!-- PROGRESS -->
    <div style="padding: 10px 20px 0">
      <div class="progress-bar"><div class="progress-fill" :style="{ width: pct + '%' }"></div></div>
    </div>

    <div class="page-content">
      <!-- NO STOCK WARNING -->
      <div v-if="!hasAnyStock" class="no-stock-banner">
        <AlertCircle :size="20" />
        <div>
          <div style="font-weight:700; margin-bottom:2px">Aucun matos disponible</div>
          <div style="font-size:12px; color:var(--text2)">Tout ton matériel est déjà en cours de tournage. Fais d'abord un retour !</div>
        </div>
      </div>

      <!-- STOCK WARNING (partial) -->
      <div v-else-if="noStockCount > 0" class="partial-stock-banner">
        <AlertCircle :size="14" />
        <span>{{ noStockCount }} item{{ noStockCount > 1 ? 's' : '' }} épuisé{{ noStockCount > 1 ? 's' : '' }} (déjà en tournage)</span>
      </div>

      <!-- SEARCH -->
      <div class="search-bar">
        <Search :size="16" class="search-icon" />
        <input v-model="search" placeholder="Rechercher un équipement…" />
        <button v-if="search" @click="search = ''"><X :size="16" style="color: var(--text3)" /></button>
      </div>

      <!-- DONE BANNER -->
      <div v-if="allDone" class="done-banner animate-in">
        <div class="title"><Check :size="18" style="display:inline-block;vertical-align:middle;margin-right:6px" /> Tout est prêt !</div>
        <div class="sub">Tout le stock disponible est vérifié. Appuie sur Sauvegarder !</div>
      </div>

      <!-- ITEMS BY CAT -->
      <template v-for="cat in cats" :key="cat">
        <template v-if="filteredByCat(cat).length">
          <div class="cat-label">
            <span>{{ cat }}</span>
            <button v-if="hasPermission" class="cat-check-all" @click="checkAllInCat(cat)">
              {{ filteredByCat(cat).every(i => (i.takenArrive ?? 0) > 0 && i.availableQty > 0) ? 'Tout décocher' : 'Tout cocher' }}
            </button>
          </div>
          <div class="items-grid">
            <div
              v-for="item in filteredByCat(cat)"
              :key="item.id"
              class="item-card"
              :class="checkClass(item)"
              style="margin-bottom:0"
            >
            <!-- Cercle = toggle -->
            <div
              class="check-circle"
              :style="item.availableQty === 0 ? 'opacity:0.3; cursor:not-allowed' : 'cursor:pointer'"
              @click="toggleItem(item)"
            >
              <Check v-if="item.checkedArrive" :size="12" stroke-width="3" />
              <div v-else-if="(item.takenArrive ?? 0) > 0" class="partial-dot"></div>
            </div>

            <div v-if="item.imageUrl" class="item-mini-thumb" @click="toggleItem(item)">
              <img :src="item.imageUrl" alt="" loading="lazy" />
            </div>

            <div
              class="item-info"
              :style="item.availableQty === 0 ? 'cursor:not-allowed' : 'cursor:pointer'"
              @click="toggleItem(item)"
            >
              <div class="item-name-text" :style="item.availableQty === 0 ? 'opacity:0.45' : ''">
                {{ item.name }}
              </div>
              <!-- STOCK INDICATOR -->
              <div class="stock-line">
                <span v-if="item.status === 'lent'" class="stock-badge stock-lent">📤 Prêté / Loué</span>
                <span v-if="item.availableQty === 0" class="stock-badge stock-empty">Épuisé</span>
                <span v-else-if="item.availableQty < item.qty" class="stock-badge stock-partial">
                  {{ item.availableQty }}/{{ item.qty }} dispo
                </span>
                <span v-else class="stock-badge stock-ok">{{ item.qty }} en stock</span>
                <span v-if="item.tags?.length">
                  <span v-for="tag in item.tags" :key="tag" class="tag-chip">{{ tag }}</span>
                </span>
              </div>
            </div>

            <!-- QTY SELECTOR (only if stock available) -->
            <div class="qty-control" @click.stop v-if="hasPermission && item.availableQty > 1">
              <button class="qty-btn" @click="changeQty(item, -1)"><Minus :size="12" /></button>
              <div class="qty-num">{{ item.takenArrive ?? 0 }}</div>
              <button class="qty-btn" @click="changeQty(item, 1)"><Plus :size="12" /></button>
            </div>
            <div v-else class="qty-num" style="margin-left:auto; padding-right:12px; font-weight:700">
              {{ item.takenArrive ?? 0 }}
            </div>
            </div>
          </div>
        </template>
      </template>
    </div>

    <!-- BOTTOM BAR -->
    <div v-if="hasPermission" class="bottom-bar">
      <button class="btn btn-secondary btn-sm" @click="resetAll">Réinitialiser</button>
      <button class="btn btn-primary" :disabled="!hasAnyStock" @click="openSave">Sauvegarder</button>
    </div>

    <!-- READ-ONLY WARNING -->
    <div v-else class="bottom-bar" style="background:var(--surface2);">
      <div style="font-size:12px;color:var(--text3);font-weight:600;display:flex;align-items:center;gap:8px">
        <AlertCircle :size="16" /> Mode Lecteur
      </div>
    </div>

    <!-- SAVE MODAL -->
    <Teleport to="body">
      <div v-if="showSaveModal" class="modal-backdrop" @click.self="showSaveModal = false">
        <div class="modal-sheet">
          <div class="modal-handle"></div>
          <div class="modal-title"><Save :size="20" style="color:var(--accent);display:inline-block;vertical-align:middle;margin-right:8px" /> Sauver le départ</div>
          <div class="modal-desc">{{ takenQty }} unités emportées</div>
          <input v-model="sessionName" placeholder="Nom du tournage" style="margin-bottom:16px" />
          <div class="modal-actions">
            <button class="btn btn-secondary" style="flex:1" @click="showSaveModal = false">Annuler</button>
            <button class="btn btn-primary" style="flex:2" :disabled="saving" @click="confirmSave">
              {{ saving ? 'Sauvegarde…' : 'Confirmer' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.progress-pill {
  background: var(--surface2); border: 0.5px solid var(--border2);
  border-radius: 99px; padding: 4px 12px;
  font-size: 12px; font-weight: 700;
}
.bottom-bar {
  position: fixed; bottom: 0; left: 0; right: 0;
  width: 100%;
  display: flex; gap: 10px; justify-content: center;
  padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
  background: rgba(22,22,31,0.95); backdrop-filter: blur(20px);
  border-top: 0.5px solid var(--border2);
  z-index: 1001; /* Above mobile nav if it ever shows */
}
.bottom-bar > .btn { max-width: 400px; }
.partial-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--warn); }

/* Stock indicators */
.stock-line { display: flex; align-items: center; gap: 6px; margin-top: 3px; flex-wrap: wrap; }
.stock-badge {
  font-size: 10px; font-weight: 700; padding: 2px 7px;
  border-radius: 99px;
}
.stock-ok      { background: rgba(34,197,94,0.12);  color: var(--ok); }
.stock-partial { background: rgba(245,158,11,0.12); color: var(--warn); }
.stock-empty   { background: rgba(239,68,68,0.12);  color: var(--danger); }
.stock-lent    { background: rgba(139,92,246,0.15); color: #a78bfa; }

/* Out of stock card */
.item-card.out-of-stock {
  opacity: 0.6;
  border-style: dashed;
}

/* Banners */
.no-stock-banner {
  display: flex; align-items: flex-start; gap: 12px;
  background: rgba(239,68,68,0.1); border: 0.5px solid rgba(239,68,68,0.3);
  border-radius: var(--radius); padding: 14px 16px; margin-bottom: 14px;
  color: var(--danger); font-size: 13px;
}
.partial-stock-banner {
  display: flex; align-items: center; gap: 8px;
  background: rgba(245,158,11,0.08); border: 0.5px solid rgba(245,158,11,0.2);
  border-radius: var(--radius-sm); padding: 9px 12px; margin-bottom: 12px;
  font-size: 12px; color: var(--warn);
}
.item-mini-thumb {
  width: 38px; height: 38px; border-radius: 6px;
  overflow: hidden; background: var(--surface2);
  margin-right: 2px; flex-shrink: 0;
  border: 0.5px solid var(--border2);
}
.item-mini-thumb img { width: 100%; height: 100%; object-fit: cover; }
button:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
