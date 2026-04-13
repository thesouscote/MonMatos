<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStore } from '../store'
import type { UserData, Item, BorrowedItem } from '../types'

const props = defineProps<{ state: UserData & { _uid: string | null } }>()
const emit = defineEmits<{ back: []; toast: [msg: string] }>()

const { save } = useStore()

// Local reactive copy of items for this session
const sessionItems = ref<Item[]>(
  (props.state.items || [])
    .filter(i => i.status === 'ok' || i.status === 'lent')
    .map(i => ({ ...i, checkedArrive: false, takenArrive: 0 }))
)

const search = ref('')
const showSaveModal = ref(false)
const sessionName = ref('')
const saving = ref(false)
const openHist = ref<number[]>([])

const cats = computed(() => props.state.categories || [])

const filteredByCat = (cat: string) =>
  sessionItems.value.filter(i => i.cat === cat && i.name.toLowerCase().includes(search.value.toLowerCase()))

const checkedCount = computed(() => sessionItems.value.filter(i => i.checkedArrive).length)
const total = computed(() => sessionItems.value.length)
const pct = computed(() => total.value ? Math.round((checkedCount.value / total.value) * 100) : 0)
const allDone = computed(() => total.value > 0 && checkedCount.value === total.value)

function toggleItem(item: Item) {
  if ((item.takenArrive ?? 0) === 0) {
    // Pas encore pris → prendre tout
    item.takenArrive = item.qty
    item.checkedArrive = true
  } else {
    // Partiellement ou totalement pris → tout décocher
    item.takenArrive = 0
    item.checkedArrive = false
  }
}

function changeQty(item: Item, delta: number) {
  const cur = item.takenArrive ?? 0
  const next = Math.max(0, Math.min(item.qty, cur + delta))
  item.takenArrive = next
  item.checkedArrive = next === item.qty
}

function checkClass(item: Item) {
  const t = item.takenArrive ?? 0
  if (t === item.qty) return 'checked'
  if (t > 0) return 'partial'
  return ''
}

function openSave() {
  if (checkedCount.value === 0) { emit('toast', 'Coche au moins un item !'); return }
  const d = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
  sessionName.value = `${d} – Départ`
  showSaveModal.value = true
}

async function confirmSave() {
  saving.value = true
  const name = sessionName.value.trim() || 'Session sans nom'
  const checkedItems = sessionItems.value.filter(i => (i.takenArrive ?? 0) > 0)
  props.state.sessions.unshift({
    id: Date.now(),
    name,
    date: new Date().toISOString(),
    phase: 'arrive',
    total: sessionItems.value.length,
    checked: checkedCount.value,
    snapshot: checkedItems.map(i => ({
      id: i.id,
      name: i.name,
      cat: i.cat,
      qty: i.qty,
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
      <div class="progress-pill">{{ checkedCount }}/{{ total }}</div>
    </div>

    <!-- PROGRESS -->
    <div style="padding: 10px 20px 0">
      <div class="progress-bar"><div class="progress-fill" :style="{ width: pct + '%' }"></div></div>
    </div>

    <div class="page-content">
      <!-- SEARCH -->
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input v-model="search" placeholder="Rechercher un équipement…" />
        <button v-if="search" @click="search = ''" style="color: var(--text3); font-size: 16px;">✕</button>
      </div>

      <!-- DONE BANNER -->
      <div v-if="allDone" class="done-banner animate-in">
        <div class="title">🎉 Tout est prêt !</div>
        <div class="sub">Tout le matériel est vérifié. Bon tournage !</div>
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
            @click="toggleItem(item)"
          >
            <div class="check-circle">
              <span v-if="item.checkedArrive" class="check-icon">✓</span>
              <span v-else-if="(item.takenArrive ?? 0) > 0" class="partial-icon">~</span>
            </div>
            <div class="item-info">
              <div class="item-name-text">{{ item.name }}</div>
              <div v-if="item.tags?.length" class="item-tags">
                <span v-for="tag in item.tags" :key="tag" class="tag-chip">{{ tag }}</span>
              </div>
            </div>
            <div v-if="item.qty > 1" class="qty-selector" @click.stop>
              <button class="qty-btn" @click="changeQty(item, -1)">−</button>
              <span class="qty-val">{{ item.takenArrive ?? 0 }}/{{ item.qty }}</span>
              <button class="qty-btn" @click="changeQty(item, 1)">+</button>
            </div>
            <span v-else class="item-qty-badge">×1</span>
          </div>
        </template>
      </template>
    </div>

    <!-- BOTTOM BAR -->
    <div class="bottom-bar">
      <button class="btn btn-secondary btn-sm" @click="resetAll">Réinitialiser</button>
      <button class="btn btn-primary" @click="openSave">Sauvegarder</button>
    </div>

    <!-- SAVE MODAL -->
    <Teleport to="body">
      <div v-if="showSaveModal" class="modal-backdrop" @click.self="showSaveModal = false">
        <div class="modal-sheet">
          <div class="modal-handle"></div>
          <div class="modal-title">💾 Sauver le départ</div>
          <div class="modal-desc">{{ checkedCount }} équipements cochés</div>
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
  background: var(--surface2);
  border: 0.5px solid var(--border2);
  border-radius: 99px;
  padding: 4px 12px;
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
