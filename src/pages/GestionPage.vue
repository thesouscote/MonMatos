<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStore } from '../store'
import type { UserData, Item, StatusType, Template } from '../types'
import { STATUS_MAP } from '../types'

const props = defineProps<{ state: UserData & { _uid: string | null } }>()
const emit = defineEmits<{ back: []; toast: [msg: string] }>()
const { save } = useStore()

type GestionTab = 'items' | 'categories' | 'templates'
const tab = ref<GestionTab>('items')

// ─── ITEMS ───
const newItemName = ref('')
const newItemCat = ref('')
const newItemQty = ref(1)
const newItemTags = ref('')
const search = ref('')

const filteredItems = computed(() =>
  (props.state.items || []).filter(i =>
    i.name.toLowerCase().includes(search.value.toLowerCase()) ||
    i.cat.toLowerCase().includes(search.value.toLowerCase())
  )
)

const itemsByCat = computed(() => {
  const cats = props.state.categories || []
  return cats.map(cat => ({
    cat,
    items: filteredItems.value.filter(i => i.cat === cat),
  })).filter(g => g.items.length)
})

async function addItem() {
  const name = newItemName.value.trim()
  const cat = newItemCat.value
  if (!name || !cat) { emit('toast', 'Nom et catégorie requis !'); return }
  const items = props.state.items || []
  const newId = items.length ? Math.max(...items.map(i => i.id)) + 1 : 1
  const tags = newItemTags.value.split(',').map(t => t.trim()).filter(Boolean)
  props.state.items.push({
    id: newId, name, cat, qty: newItemQty.value || 1,
    status: 'ok', tags,
  })
  newItemName.value = ''; newItemCat.value = ''; newItemQty.value = 1; newItemTags.value = ''
  await save()
  emit('toast', `${name} ajouté !`)
}

async function deleteItem(id: number) {
  if (!confirm('Supprimer cet item ?')) return
  props.state.items = props.state.items.filter(i => i.id !== id)
  await save()
  emit('toast', 'Item supprimé')
}

async function setStatus(item: Item, status: StatusType) {
  item.status = status
  await save()
  emit('toast', `Statut mis à jour : ${STATUS_MAP[status].label}`)
}

// ─── CATEGORIES ───
const newCat = ref('')

async function addCategory() {
  const name = newCat.value.trim()
  if (!name) return
  if ((props.state.categories || []).includes(name)) { emit('toast', 'Catégorie déjà existante'); return }
  props.state.categories.push(name)
  newCat.value = ''
  await save()
}

async function deleteCategory(name: string) {
  if ((props.state.items || []).some(i => i.cat === name)) {
    emit('toast', "Supprime d'abord les items de cette catégorie"); return
  }
  props.state.categories = props.state.categories.filter(c => c !== name)
  await save()
}

// ─── TEMPLATES ───
const newTplName = ref('')
const selectedItemIds = ref<Set<number>>(new Set())

function toggleTplItem(id: number) {
  if (selectedItemIds.value.has(id)) selectedItemIds.value.delete(id)
  else selectedItemIds.value.add(id)
}

async function saveTemplate() {
  if (!newTplName.value.trim()) { emit('toast', 'Donne un nom au template'); return }
  if (selectedItemIds.value.size === 0) { emit('toast', 'Sélectionne au moins un item'); return }
  if (!props.state.templates) props.state.templates = []
  props.state.templates.push({
    id: Date.now(),
    name: newTplName.value.trim(),
    itemIds: [...selectedItemIds.value],
    createdAt: new Date().toISOString(),
  })
  newTplName.value = ''; selectedItemIds.value.clear()
  await save()
  emit('toast', 'Template sauvegardé !')
}

async function deleteTemplate(id: number) {
  if (!confirm('Supprimer ce template ?')) return
  props.state.templates = props.state.templates.filter(t => t.id !== id)
  await save()
}

function templateItemCount(tpl: Template) { return tpl.itemIds.length }
</script>

<template>
  <div class="page-root">
    <div class="page-header">
      <button class="back-btn" @click="emit('back')">←</button>
      <h1>⚙️ Gestion</h1>
    </div>

    <!-- TABS -->
    <div class="tab-bar">
      <button :class="{ active: tab === 'items' }" @click="tab = 'items'">Équipements</button>
      <button :class="{ active: tab === 'categories' }" @click="tab = 'categories'">Catégories</button>
      <button :class="{ active: tab === 'templates' }" @click="tab = 'templates'">Templates</button>
    </div>

    <div class="page-content">

      <!-- ═══ ITEMS ═══ -->
      <template v-if="tab === 'items'">
        <!-- ADD FORM -->
        <div class="card" style="margin-bottom:16px">
          <div class="section-title">Ajouter un équipement</div>
          <input v-model="newItemName" placeholder="Nom de l'équipement" style="margin-bottom:8px" />
          <select v-model="newItemCat" style="margin-bottom:8px">
            <option value="">-- Catégorie --</option>
            <option v-for="c in state.categories" :key="c" :value="c">{{ c }}</option>
          </select>
          <div style="display:flex; gap:8px; margin-bottom:8px">
            <div style="flex:1">
              <label style="font-size:11px; color:var(--text3)">Quantité</label>
              <input v-model.number="newItemQty" type="number" min="1" />
            </div>
            <div style="flex:2">
              <label style="font-size:11px; color:var(--text3)">Tags (séparés par virgule)</label>
              <input v-model="newItemTags" placeholder="ex: fragile, lourd" />
            </div>
          </div>
          <button class="btn btn-primary btn-full" @click="addItem">+ Ajouter</button>
        </div>

        <!-- SEARCH -->
        <div class="search-bar">
          <span class="search-icon">🔍</span>
          <input v-model="search" placeholder="Rechercher…" />
          <button v-if="search" @click="search=''" style="color:var(--text3);font-size:16px">✕</button>
        </div>

        <div v-if="!filteredItems.length" class="empty-state">
          <span class="empty-icon">📦</span>
          <p>Aucun équipement trouvé.</p>
        </div>

        <template v-for="group in itemsByCat" :key="group.cat">
          <div class="cat-label">{{ group.cat }}</div>
          <div v-for="item in group.items" :key="item.id" class="gest-item">
            <div class="gest-item-left">
              <div class="gest-item-name">{{ item.name }}</div>
              <div class="gest-item-sub">
                Qté: {{ item.qty }}
                <span v-if="item.tags?.length"> · {{ item.tags.join(', ') }}</span>
              </div>
              <!-- STATUS SELECTOR -->
              <div class="status-row">
                <button
                  v-for="(info, key) in STATUS_MAP"
                  :key="key"
                  class="status-opt"
                  :class="{ active: item.status === key, [`st-${key}`]: true }"
                  @click="setStatus(item, key as StatusType)"
                >{{ info.icon }}</button>
              </div>
            </div>
            <button class="btn-del" @click="deleteItem(item.id)">✕</button>
          </div>
        </template>
      </template>

      <!-- ═══ CATEGORIES ═══ -->
      <template v-else-if="tab === 'categories'">
        <div class="card" style="margin-bottom:16px">
          <div class="section-title">Nouvelle catégorie</div>
          <div style="display:flex; gap:8px">
            <input v-model="newCat" placeholder="Nom de la catégorie" @keyup.enter="addCategory" />
            <button class="btn btn-primary" style="flex-shrink:0" @click="addCategory">+</button>
          </div>
        </div>

        <div v-if="!state.categories.length" class="empty-state">
          <p>Aucune catégorie.</p>
        </div>

        <div class="cats-list">
          <div v-for="cat in state.categories" :key="cat" class="cat-row">
            <span class="cat-row-name">{{ cat }}</span>
            <span class="cat-row-count">{{ (state.items || []).filter(i => i.cat === cat).length }} items</span>
            <button class="btn-del" @click="deleteCategory(cat)">✕</button>
          </div>
        </div>
      </template>

      <!-- ═══ TEMPLATES ═══ -->
      <template v-else-if="tab === 'templates'">
        <!-- EXISTING TEMPLATES -->
        <div v-if="state.templates?.length" style="margin-bottom:20px">
          <div class="section-title">Mes templates</div>
          <div v-for="tpl in state.templates" :key="tpl.id" class="template-card">
            <span class="template-icon">📋</span>
            <div class="template-info">
              <div class="template-name">{{ tpl.name }}</div>
              <div class="template-count">{{ templateItemCount(tpl) }} équipements</div>
            </div>
            <button class="btn-del" @click="deleteTemplate(tpl.id)">✕</button>
          </div>
        </div>

        <!-- CREATE TEMPLATE -->
        <div class="card">
          <div class="section-title">Créer un template</div>
          <input v-model="newTplName" placeholder="Nom du template (ex: Kit Studio)" style="margin-bottom:12px" />
          <div class="section-title">Sélectionner les items</div>
          <template v-for="cat in state.categories" :key="cat">
            <div class="cat-label">{{ cat }}</div>
            <div
              v-for="item in (state.items || []).filter(i => i.cat === cat)"
              :key="item.id"
              class="tpl-item"
              :class="{ selected: selectedItemIds.has(item.id) }"
              @click="toggleTplItem(item.id)"
            >
              <div class="check-circle" style="width:18px;height:18px">
                <span v-if="selectedItemIds.has(item.id)" class="check-icon" style="font-size:10px">✓</span>
              </div>
              <span style="font-size:13px">{{ item.name }}</span>
            </div>
          </template>
          <button class="btn btn-primary btn-full" style="margin-top:16px" @click="saveTemplate">
            Sauvegarder le template
          </button>
        </div>
      </template>

    </div>
  </div>
</template>

<style scoped>
.tab-bar {
  display: flex;
  padding: 0 20px;
  gap: 4px;
  border-bottom: 0.5px solid var(--border);
  margin-bottom: 0;
}
.tab-bar button {
  padding: 10px 14px; font-size: 13px; font-weight: 600;
  color: var(--text3); border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
}
.tab-bar button.active { color: var(--accent); border-bottom-color: var(--accent); }

.gest-item {
  display: flex; align-items: flex-start; gap: 10px;
  background: var(--surface);
  border: 0.5px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 14px;
  margin-bottom: 6px;
}
.gest-item-left { flex: 1; min-width: 0; }
.gest-item-name { font-size: 14px; font-weight: 600; }
.gest-item-sub  { font-size: 11px; color: var(--text3); margin-top: 2px; }

.status-row { display: flex; gap: 4px; margin-top: 8px; }
.status-opt {
  padding: 3px 8px; font-size: 11px; border-radius: 99px;
  background: var(--surface2); border: 0.5px solid var(--border2);
  color: var(--text3); transition: all 0.15s;
}
.status-opt.active.st-ok     { background: rgba(34,197,94,0.2);  border-color: var(--ok);     color: var(--ok); }
.status-opt.active.st-repair { background: rgba(245,158,11,0.2); border-color: var(--warn);   color: var(--warn); }
.status-opt.active.st-lent   { background: rgba(139,92,246,0.2); border-color: #8b5cf6;       color: #8b5cf6; }
.status-opt.active.st-lost   { background: rgba(239,68,68,0.2);  border-color: var(--danger); color: var(--danger); }

.btn-del {
  color: var(--text3); font-size: 16px; padding: 4px;
  transition: color 0.15s; flex-shrink: 0;
}
.btn-del:hover { color: var(--danger); }

.cats-list { display: flex; flex-direction: column; gap: 8px; }
.cat-row {
  display: flex; align-items: center; gap: 10px;
  background: var(--surface);
  border: 0.5px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 14px;
}
.cat-row-name { font-size: 14px; font-weight: 600; flex: 1; }
.cat-row-count { font-size: 11px; color: var(--text3); }

.tpl-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 12px; border-radius: var(--radius-sm);
  cursor: pointer; transition: background 0.15s;
}
.tpl-item:hover { background: var(--surface2); }
.tpl-item.selected { background: rgba(240,192,64,0.08); }
</style>
