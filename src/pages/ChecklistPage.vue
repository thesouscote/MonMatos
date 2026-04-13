<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStore } from '../store'
import type { UserData, Item } from '../types'
import { getAvailableQty } from '../composables/useStock'

const props = defineProps<{ state: UserData & { _uid: string | null } }>()
const emit = defineEmits<{ back: []; toast: [msg: string] }>()

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
  if (item.availableQty === 0) return
  if ((item.takenArrive ?? 0) === 0) {
    item.takenArrive = item.availableQty
    item.checkedArrive = true
  } else {
    item.takenArrive = 0
    item.checkedArrive = false
  }
}

function changeQty(item: Item & { availableQty: number }, delta: number) {
  if (item.availableQty === 0) return
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
    })),
    isReturned: false,
    linkedToDepartId: null,
  })
  await save()
  saving.value = false
  showSaveModal.value = false
  emit('toast', `"${name}" sauvegardé !`)
  emit('back')
}

function resetAll() {
  sessionItems.value.forEach(i => { i.checkedArrive = false; i.takenArrive = 0 })
}
</script>

<template>
  <div class="page-root">
    <!-- HEADER -->
    <div class="page-header">
      <button class="back-btn" @click="emit('back')">←</button>
      <h1>🎬 Départ</h1>
      <div class="progress-pill">{{ takenQty }}/{{ totalQty }}</div>
    </div>

    <!-- PROGRESS -->
    <div style="padding: 10px 20px 0">
      <div class="progress-bar"><div class="progress-fill" :style="{ width: pct + '%' }"></div></div>
    </div>

    <div class="page-content">
      <!-- NO STOCK WARNING -->
      <div v-if="!hasAnyStock" class="no-stock-banner">
        <span>🔴</span>
        <div>
          <div style="font-weight:700; margin-bottom:2px">Aucun matos disponible</div>
          <div style="font-size:12px; color:var(--text2)">Tout ton matériel est déjà en cours de tournage. Fais d'abord un retour !</div>
        </div>
      </div>

      <!-- STOCK WARNING (partial) -->
      <div v-else-if="noStockCount > 0" class="partial-stock-banner">
        <span>⚠️</span>
        <span>{{ noStockCount }} item{{ noStockCount > 1 ? 's' : '' }} épuisé{{ noStockCount > 1 ? 's' : '' }} (déjà en tournage)</span>
      </div>

      <!-- SEARCH -->
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input v-model="search" placeholder="Rechercher un équipement…" />
        <button v-if="search" @click="search = ''" style="color: var(--text3); font-size: 16px;">✕</button>
      </div>

      <!-- DONE BANNER -->
      <div v-if="allDone" class="done-banner animate-in">
        <div class="title">🎉 Tout est prêt !</div>
        <div class="sub">Tout le stock disponible est vérifié. Bon tournage !</div>
        <button class="btn btn-primary" @click="openSave">Sauvegarder ce départ</button>
      </div>

      <!-- ITEMS BY CAT -->
      <template v-for="cat in cats" :key="cat">
        <template v-if="filteredByCat(cat).length">
          <div class="cat-label">{{ cat }}</div>
          <div
            v-for="item in filteredByCat(cat)"
            :key="item.id"
            class="item-card"
            :class="checkClass(item)"
          >
            <!-- Cercle = toggle -->
            <div
              class="check-circle"
              :style="item.availableQty === 0 ? 'opacity:0.3; cursor:not-allowed' : 'cursor:pointer'"
              @click="toggleItem(item)"
            >
              <span v-if="item.checkedArrive" class="check-icon">✓</span>
              <span v-else-if="(item.takenArrive ?? 0) > 0" class="partial-icon">~</span>
            </div>

            <div class="item-info">
              <div class="item-name-text" :style="item.availableQty === 0 ? 'opacity:0.45' : ''">
                {{ item.name }}
              </div>
              <!-- STOCK INDICATOR -->
              <div class="stock-line">
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
            <div v-if="item.availableQty > 1" class="qty-selector">
              <button class="qty-btn" @click.stop="changeQty(item, -1)">−</button>
              <span class="qty-val">{{ item.takenArrive ?? 0 }}/{{ item.availableQty }}</span>
              <button class="qty-btn" @click.stop="changeQty(item, 1)">+</button>
            </div>
            <span v-else-if="item.availableQty === 1" class="item-qty-badge">×1</span>
            <span v-else class="item-qty-badge" style="opacity:0.3">×0</span>
          </div>
        </template>
      </template>
    </div>

    <!-- BOTTOM BAR -->
    <div class="bottom-bar">
      <button class="btn btn-secondary btn-sm" @click="resetAll">Réinitialiser</button>
      <button class="btn btn-primary" :disabled="!hasAnyStock" @click="openSave">Sauvegarder</button>
    </div>

    <!-- SAVE MODAL -->
    <Teleport to="body">
      <div v-if="showSaveModal" class="modal-backdrop" @click.self="showSaveModal = false">
        <div class="modal-sheet">
          <div class="modal-handle"></div>
          <div class="modal-title">💾 Sauver le départ</div>
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
  position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 100%; max-width: 480px;
  display: flex; gap: 10px;
  padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
  background: rgba(22,22,31,0.95); backdrop-filter: blur(20px);
  border-top: 0.5px solid var(--border2);
}
.partial-icon { font-size: 11px; color: var(--warn); font-weight: 900; }

/* Stock indicators */
.stock-line { display: flex; align-items: center; gap: 6px; margin-top: 3px; flex-wrap: wrap; }
.stock-badge {
  font-size: 10px; font-weight: 700; padding: 2px 7px;
  border-radius: 99px;
}
.stock-ok      { background: rgba(34,197,94,0.12);  color: var(--ok); }
.stock-partial { background: rgba(245,158,11,0.12); color: var(--warn); }
.stock-empty   { background: rgba(239,68,68,0.12);  color: var(--danger); }

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
button:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
