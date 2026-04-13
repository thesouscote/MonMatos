import { ref, computed } from 'vue'
import { useStore } from '../store'
import { storage } from '../firebase'
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import {
  Settings2,
  Package,
  Tag,
  ClipboardList,
  Search,
  X,
  Pencil,
  Trash2,
  Plus,
  Camera,
  Check,
  Wrench,
  ArrowUpRight,
  ChevronLeft
} from 'lucide-vue-next'
import type { UserData, Item, StatusType, Template } from '../types'
import { STATUS_MAP } from '../types'

const props = defineProps<{ state: UserData & { _uid: string | null } }>()
const emit = defineEmits<{ back: []; toast: [msg: string] }>()
const { save } = useStore()

// Helper to resolve status icon
const getStatusIcon = (iconName: string) => {
  const map: any = { check: Check, wrench: Wrench, 'arrow-up-right': ArrowUpRight, x: X }
  return map[iconName] || Check
}

// ─── TABS ───
type GestionTab = 'items' | 'categories' | 'templates'
const tab = ref<GestionTab>('items')

// ─── FILTER ───
const activeCat = ref<string>('Tous')
const search = ref('')

const allCats = computed(() => ['Tous', ...(props.state.categories || [])])

const filteredItems = computed(() => {
  let items = props.state.items || []
  if (activeCat.value !== 'Tous') items = items.filter(i => i.cat === activeCat.value)
  if (search.value) items = items.filter(i => i.name.toLowerCase().includes(search.value.toLowerCase()))
  return items
})

const itemsByCat = computed(() => {
  if (activeCat.value !== 'Tous') return [{ cat: activeCat.value, items: filteredItems.value }]
  return (props.state.categories || []).map(cat => ({
    cat,
    items: filteredItems.value.filter(i => i.cat === cat),
  })).filter(g => g.items.length)
})

// ─── ADD / EDIT MODAL ───
const showItemModal = ref(false)
const showDeleteConfirm = ref(false)
const itemToDelete = ref<number | null>(null)
const editingItem = ref<Item | null>(null)

const form = ref({
  name: '',
  cat: '',
  qty: 1,
  tags: '',
  status: 'ok' as StatusType,
  imageUrl: '',
})

const imageFile = ref<File | null>(null)
const imagePreview = ref<string | null>(null)
const isUploading = ref(false)

/**
 * Compresse une image via Canvas pour limiter le poids
 */
async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (e) => {
      const img = new Image()
      img.src = e.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 800
        const MAX_HEIGHT = 800
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)
        canvas.toBlob((blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Canvas compression failed'))
        }, 'image/jpeg', 0.7) // 70% quality
      }
    }
    reader.onerror = reject
  })
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files && input.files[0]) {
    const file = input.files[0]
    if (file.size > 5 * 1024 * 1024) { emit('toast', 'Image trop lourde (max 5Mo)'); return }
    imageFile.value = file
    imagePreview.value = URL.createObjectURL(file)
  }
}

function removePreview() {
  imageFile.value = null
  imagePreview.value = null
  form.value.imageUrl = ''
}

function openAddModal() {
  editingItem.value = null
  form.value = { name: '', cat: activeCat.value !== 'Tous' ? activeCat.value : '', qty: 1, tags: '', status: 'ok', imageUrl: '' }
  imageFile.value = null
  imagePreview.value = null
  showItemModal.value = true
}

function openEditModal(item: Item) {
  editingItem.value = item
  form.value = {
    name: item.name,
    cat: item.cat,
    qty: item.qty,
    tags: (item.tags || []).join(', '),
    status: item.status || 'ok',
    imageUrl: item.imageUrl || '',
  }
  imageFile.value = null
  imagePreview.value = item.imageUrl || null
  showItemModal.value = true
}

async function saveItem() {
  const name = form.value.name.trim()
  const cat = form.value.cat
  if (!name) { emit('toast', 'Le nom est requis !'); return }
  if (!cat) { emit('toast', 'La catégorie est requise !'); return }

  const tags = form.value.tags.split(',').map(t => t.trim()).filter(Boolean)
  isUploading.value = true

  try {
    let finalUrl = form.value.imageUrl
    const items = props.state.items || []
    const itemId = editingItem.value ? editingItem.value.id : (items.length ? Math.max(...items.map(i => i.id)) + 1 : 1)

    // Handle Image Upload
    if (imageFile.value && props.state._uid) {
      const blob = await compressImage(imageFile.value)
      const path = `users/${props.state._uid}/items/${itemId}.jpg`
      const fileRef = storageRef(storage, path)
      await uploadBytes(fileRef, blob)
      finalUrl = await getDownloadURL(fileRef)
      // Force refresh (cache busting)
      finalUrl += `?t=${Date.now()}`
    } else if (imagePreview.value === null && form.value.imageUrl) {
      // User removed the image
      if (props.state._uid) {
        const path = `users/${props.state._uid}/items/${itemId}.jpg`
        try { await deleteObject(storageRef(storage, path)) } catch (e) {}
      }
      finalUrl = ''
    }

    if (editingItem.value) {
      const idx = props.state.items.findIndex(i => i.id === editingItem.value!.id)
      if (idx !== -1) {
        props.state.items[idx] = {
          ...props.state.items[idx],
          name, cat, qty: form.value.qty || 1, tags, status: form.value.status,
          imageUrl: finalUrl,
        }
      }
      emit('toast', `${name} mis à jour !`)
    } else {
      props.state.items.push({
        id: itemId, name, cat, qty: form.value.qty || 1, tags, status: form.value.status,
        imageUrl: finalUrl,
      })
      emit('toast', `${name} ajouté !`)
    }

    await save()
    showItemModal.value = false
  } catch (e: any) {
    console.error(e)
    emit('toast', "Erreur lors de la sauvegarde")
  } finally {
    isUploading.value = false
  }
}

function askDeleteItem(id: number) {
  itemToDelete.value = id
  showDeleteConfirm.value = true
}

async function confirmDeleteItem() {
  if (itemToDelete.value === null) return
  const id = itemToDelete.value
  const idx = props.state.items.findIndex(i => i.id === id)
  if (idx === -1) return

  const item = props.state.items[idx]
  // Nettoyage Storage
  if (item.imageUrl && props.state._uid) {
    const path = `users/${props.state._uid}/items/${id}.jpg`
    try { await deleteObject(storageRef(storage, path)) } catch (e) {}
  }

  props.state.items.splice(idx, 1)
  await save()
  showDeleteConfirm.value = false
  itemToDelete.value = null
  showItemModal.value = false
  emit('toast', 'Équipement supprimé')
}

async function setStatus(item: Item, status: StatusType) {
  item.status = status
  await save()
}

// ─── CATEGORIES ───
const newCat = ref('')
const editingCat = ref<string | null>(null)
const editCatName = ref('')

async function addCategory() {
  const name = newCat.value.trim()
  if (!name) return
  if ((props.state.categories || []).includes(name)) { emit('toast', 'Catégorie déjà existante'); return }
  props.state.categories.push(name)
  newCat.value = ''
  await save()
}

async function deleteCategory(name: string) {
  const count = (props.state.items || []).filter(i => i.cat === name).length
  if (count > 0) { emit('toast', `Supprime d'abord les ${count} items de cette catégorie`); return }
  const idx = props.state.categories.indexOf(name)
  if (idx !== -1) props.state.categories.splice(idx, 1)
  await save()
  emit('toast', 'Catégorie supprimée')
}

function startEditCat(name: string) { editingCat.value = name; editCatName.value = name }

async function saveEditCat() {
  if (!editingCat.value || !editCatName.value.trim()) return
  const oldName = editingCat.value
  const newName = editCatName.value.trim()
  const idx = props.state.categories.indexOf(oldName)
  if (idx !== -1) props.state.categories[idx] = newName
  // rename items too
  props.state.items.forEach(i => { if (i.cat === oldName) i.cat = newName })
  editingCat.value = null
  await save()
  emit('toast', 'Catégorie renommée !')
}

// ─── TEMPLATES ───
const newTplName = ref('')
const selectedIds = ref<Set<number>>(new Set())

function toggleTplItem(id: number) {
  if (selectedIds.value.has(id)) selectedIds.value.delete(id)
  else selectedIds.value.add(id)
}

async function saveTemplate() {
  if (!newTplName.value.trim()) { emit('toast', 'Donne un nom au template'); return }
  if (!selectedIds.value.size) { emit('toast', 'Sélectionne au moins un item'); return }
  if (!props.state.templates) props.state.templates = []
  props.state.templates.push({
    id: Date.now(), name: newTplName.value.trim(),
    itemIds: [...selectedIds.value], createdAt: new Date().toISOString(),
  })
  newTplName.value = ''; selectedIds.value.clear()
  await save()
  emit('toast', 'Template sauvegardé !')
}

async function deleteTemplate(id: number) {
  const idx = (props.state.templates || []).findIndex(t => t.id === id)
  if (idx !== -1) props.state.templates.splice(idx, 1)
  await save()
  emit('toast', 'Template supprimé')
}
</script>

<template>
  <div class="page-root">
    <!-- HEADER -->
    <div class="page-header">
      <button class="back-btn" @click="emit('back')"><ChevronLeft :size="20" /></button>
      <div style="display:flex;align-items:center;gap:10px">
        <Settings2 :size="22" stroke-width="2.5" style="color:var(--accent)" />
        <h1>Gestion</h1>
      </div>
    </div>

    <!-- TABS -->
    <div class="tab-bar">
      <button :class="{ active: tab === 'items' }" @click="tab = 'items'">
        <Package :size="14" /> Items <span class="tab-count">{{ state.items?.length ?? 0 }}</span>
      </button>
      <button :class="{ active: tab === 'categories' }" @click="tab = 'categories'">
        <Tag :size="14" /> Catégories
      </button>
      <button :class="{ active: tab === 'templates' }" @click="tab = 'templates'">
        <ClipboardList :size="14" /> Templates
      </button>
    </div>

    <div class="page-content">

      <!-- ═══════════ ITEMS ═══════════ -->
      <template v-if="tab === 'items'">
        <!-- SEARCH -->
        <div class="search-bar" style="margin-bottom:12px">
          <Search :size="16" class="search-icon" />
          <input v-model="search" placeholder="Rechercher un équipement…" />
          <button v-if="search" @click="search=''"><X :size="16" style="color:var(--text3)" /></button>
        </div>

        <!-- CAT FILTER PILLS -->
        <div class="cat-pills">
          <button
            v-for="cat in allCats"
            :key="cat"
            class="cat-pill"
            :class="{ active: activeCat === cat }"
            @click="activeCat = cat"
          >{{ cat }}</button>
        </div>

        <!-- STATUS SUMMARY -->
        <div class="status-summary">
          <div v-for="(info, key) in STATUS_MAP" :key="key" class="status-sum-item">
            <div class="status-sum-dot" :class="`status-${key}`"></div>
            <span>{{ (state.items || []).filter(i => i.status === key).length }}</span>
            <span class="status-sum-lbl">{{ info.label }}</span>
          </div>
        </div>

        <div v-if="!filteredItems.length" class="empty-state">
          <Package :size="48" style="opacity:0.2;margin-bottom:12px" />
          <p>Aucun équipement trouvé.</p>
        </div>

        <!-- ITEMS BY CATEGORY -->
        <template v-for="group in itemsByCat" :key="group.cat">
          <div class="cat-label">{{ group.cat }}</div>
          <div v-for="item in group.items" :key="item.id" class="equip-card" :class="`status-border-${item.status}`">
            <!-- LEFT: status indicator -->
            <div class="equip-status-bar" :class="`bg-${item.status}`"></div>

            <!-- MAIN CONTENT -->
            <div class="equip-thumb" @click="openEditModal(item)">
              <img v-if="item.imageUrl" :src="item.imageUrl" alt="" loading="lazy" />
              <Camera v-else :size="20" stroke-width="1.5" />
            </div>

            <div class="equip-body" @click="openEditModal(item)">
              <div class="equip-name">{{ item.name }}</div>
              <div class="equip-meta">
                <span class="equip-cat">{{ item.cat }}</span>
                <span class="equip-qty">× {{ item.qty }}</span>
                <span v-for="tag in item.tags" :key="tag" class="tag-chip">{{ tag }}</span>
              </div>
              <!-- STATUS QUICK TOGGLE -->
              <div class="equip-status-row" @click.stop>
                <button
                  v-for="(info, key) in STATUS_MAP"
                  :key="key"
                  class="equip-status-btn"
                   :class="{ active: item.status === key, [`s-${key}`]: true }"
                  :title="info.label"
                  @click="setStatus(item, key as StatusType)"
                >
                  <component :is="getStatusIcon(info.icon)" :size="12" stroke-width="2.5" />
                </button>
              </div>
            </div>

            <!-- EDIT BTN -->
            <div class="equip-actions">
              <button class="equip-edit-btn" @click="openEditModal(item)"><Pencil :size="16" /></button>
              <button class="equip-del-btn" @click="askDeleteItem(item.id)"><Trash2 :size="16" /></button>
            </div>
          </div>
        </template>
      </template>

      <!-- ═══════════ CATEGORIES ═══════════ -->
      <template v-else-if="tab === 'categories'">
        <!-- ADD -->
        <div class="card" style="margin-bottom:16px">
          <div class="section-title">Nouvelle catégorie</div>
          <div style="display:flex; gap:8px;">
            <input v-model="newCat" placeholder="Ex: Drone, Stabilisateur…" @keyup.enter="addCategory" />
            <button class="btn btn-primary" style="flex-shrink:0; padding:0 18px" @click="addCategory">+</button>
          </div>
        </div>

        <div v-if="!state.categories.length" class="empty-state">
          <span class="empty-icon">🏷️</span><p>Aucune catégorie.</p>
        </div>

        <div v-for="cat in state.categories" :key="cat" class="cat-manage-card">
          <div v-if="editingCat === cat" class="cat-edit-row">
            <input v-model="editCatName" style="flex:1" @keyup.enter="saveEditCat" />
            <button class="btn btn-primary btn-sm" @click="saveEditCat"><Check :size="14" /></button>
            <button class="btn btn-secondary btn-sm" @click="editingCat = null"><X :size="14" /></button>
          </div>
          <template v-else>
            <div class="cat-manage-info">
              <span class="cat-manage-name">{{ cat }}</span>
              <span class="cat-manage-count">{{ (state.items || []).filter(i => i.cat === cat).length }} items</span>
            </div>
            <div class="cat-manage-btns">
              <button class="icon-btn" title="Renommer" @click="startEditCat(cat)"><Pencil :size="16" /></button>
              <button class="icon-btn danger" title="Supprimer" @click="deleteCategory(cat)"><Trash2 :size="16" /></button>
            </div>
          </template>
        </div>
      </template>

      <!-- ═══════════ TEMPLATES ═══════════ -->
      <template v-else-if="tab === 'templates'">
        <!-- EXISTING -->
        <div v-if="state.templates?.length" style="margin-bottom:20px">
          <div class="section-title">Mes templates ({{ state.templates.length }})</div>
          <div v-for="tpl in state.templates" :key="tpl.id" class="tpl-card">
            <ClipboardList :size="24" stroke-width="1.5" style="color:var(--text3)" />
            <div class="tpl-info">
              <div class="tpl-name">{{ tpl.name }}</div>
              <div class="tpl-count">{{ tpl.itemIds.length }} équipements</div>
            </div>
            <button class="icon-btn danger" @click="deleteTemplate(tpl.id)"><Trash2 :size="18" /></button>
          </div>
        </div>

        <!-- CREATE -->
        <div class="card">
          <div class="section-title">Créer un template</div>
          <input v-model="newTplName" placeholder="Ex: Kit Studio, Kit Extérieur…" style="margin-bottom:14px" />

          <!-- Select items by cat -->
          <template v-for="cat in state.categories" :key="cat">
            <div class="cat-label">{{ cat }}</div>
            <div
              v-for="item in (state.items || []).filter(i => i.cat === cat)"
              :key="item.id"
              class="tpl-select-item"
              :class="{ selected: selectedIds.has(item.id) }"
              @click="toggleTplItem(item.id)"
            >
              <div class="tpl-checkbox">
                <Check v-if="selectedIds.has(item.id)" :size="12" stroke-width="3" />
              </div>
              <span>{{ item.name }}</span>
              <span class="tpl-item-qty">×{{ item.qty }}</span>
            </div>
          </template>

          <div class="selected-count" v-if="selectedIds.size > 0">
            {{ selectedIds.size }} équipement{{ selectedIds.size > 1 ? 's' : '' }} sélectionné{{ selectedIds.size > 1 ? 's' : '' }}
          </div>
          <button class="btn btn-primary btn-full" style="margin-top:14px" @click="saveTemplate">
            💾 Sauvegarder le template
          </button>
        </div>
      </template>
    </div>

    <!-- FAB: ADD ITEM (only on items tab) -->
    <button v-if="tab === 'items'" class="fab" @click="openAddModal"><Plus :size="32" /></button>

    <!-- ═══ ADD / EDIT MODAL ═══ -->
    <Teleport to="body">
      <div v-if="showItemModal" class="modal-backdrop" @click.self="showItemModal = false">
        <div class="modal-sheet">
          <div class="modal-handle"></div>
          <div class="modal-title">{{ editingItem ? '✏️ Modifier' : '➕ Ajouter' }} un équipement</div>

          <!-- PHOTO UPLOAD -->
          <div class="form-group">
            <label>Photo</label>
            <div class="photo-upload-zone" :class="{ 'has-image': imagePreview }" @click="$refs.fileInput.click()">
              <div v-if="imagePreview" class="photo-preview-wrap">
                <img :src="imagePreview" class="photo-preview" />
                <button class="btn-remove-photo" @click.stop="removePreview"><X :size="14" /></button>
              </div>
              <div v-else class="photo-placeholder">
                <Camera :size="24" stroke-width="1.5" />
                <span>Ajouter une photo</span>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label>Nom *</label>
            <input v-model="form.name" placeholder="Ex: Caméra Sony FX3" autofocus />
          </div>

          <div class="form-group">
            <label>Catégorie *</label>
            <select v-model="form.cat">
              <option value="">-- Choisir --</option>
              <option v-for="c in state.categories" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>

          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label>Quantité</label>
              <input v-model.number="form.qty" type="number" min="1" max="99" />
            </div>
            <div class="form-group" style="flex:2">
              <label>Tags <span style="color:var(--text3);font-weight:400">(virgule)</span></label>
              <input v-model="form.tags" placeholder="fragile, lourd…" />
            </div>
          </div>

          <div class="form-group">
            <label>Statut</label>
            <div class="status-select-row">
              <button
                v-for="(info, key) in STATUS_MAP"
                :key="key"
                 class="status-select-btn"
                :class="{ active: form.status === key, [`ss-${key}`]: true }"
                @click="form.status = key as StatusType"
              >
                <component :is="getStatusIcon(info.icon)" :size="20" stroke-width="2.5" class="ss-icon" />
                <span class="ss-label">{{ info.label }}</span>
              </button>
            </div>
          </div>

          <div class="modal-actions">
            <button class="btn btn-secondary" style="flex:1" @click="showItemModal = false">Annuler</button>
            <button
              v-if="editingItem"
              class="btn btn-danger btn-sm"
              @click="askDeleteItem(editingItem.id)"
            ><Trash2 :size="18" /></button>
            <button class="btn btn-primary" style="flex:2" :disabled="isUploading" @click="saveItem">
              {{ isUploading ? 'Envoi...' : (editingItem ? 'Modifier' : 'Ajouter') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- DELETE CONFIRM MODAL -->
    <Teleport to="body">
      <div v-if="showDeleteConfirm" class="modal-backdrop" @click.self="showDeleteConfirm = false">
        <div class="modal-sheet confirm-sheet">
          <div class="modal-handle"></div>
          <div class="confirm-icon"><Trash2 :size="32" /></div>
          <div class="modal-title">Supprimer cet item ?</div>
          <p class="modal-desc">
            Voulez-vous vraiment supprimer <strong>{{ props.state.items.find(i => i.id === itemToDelete)?.name }}</strong> ?
            <br>Cette action est irréversible.
          </p>
          <div class="modal-actions">
            <button class="btn btn-secondary" style="flex:1" @click="showDeleteConfirm = false">Annuler</button>
            <button class="btn btn-danger" style="flex:1" @click="confirmDeleteItem">Supprimer</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* ── TABS ── */
.tab-bar {
  display: flex; gap: 2px;
  padding: 0 16px;
  border-bottom: 0.5px solid var(--border);
  flex-shrink: 0;
}
.tab-bar button {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 12px; font-size: 12px; font-weight: 600;
  color: var(--text3); border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
  white-space: nowrap;
}
.tab-bar button.active { color: var(--accent); border-bottom-color: var(--accent); }
.tab-count {
  background: var(--surface2);
  border-radius: 99px; font-size: 10px;
  padding: 1px 6px; margin-left: 4px;
}

/* ── CAT PILLS ── */
.cat-pills {
  display: flex; gap: 6px; overflow-x: auto;
  padding-bottom: 10px; margin-bottom: 12px;
  scrollbar-width: none;
}
.cat-pills::-webkit-scrollbar { display: none; }
.cat-pill {
  padding: 6px 14px; border-radius: 99px; white-space: nowrap;
  font-size: 12px; font-weight: 600;
  background: var(--surface); border: 0.5px solid var(--border2);
  color: var(--text2); transition: all 0.15s;
}
.cat-pill.active {
  background: var(--accent); color: #0a0a0f; border-color: var(--accent);
}

/* ── STATUS SUMMARY ── */
.status-summary {
  display: flex; gap: 12px; margin-bottom: 14px;
  background: var(--surface); border: 0.5px solid var(--border);
  border-radius: var(--radius); padding: 10px 14px;
}
.status-sum-item { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; }
.status-sum-dot { width: 8px; height: 8px; border-radius: 50%; }
.status-sum-lbl { color: var(--text3); font-size: 10px; font-weight: 500; }
.status-ok      { background: var(--ok); }
.status-repair  { background: var(--warn); }
.status-lent    { background: #8b5cf6; }
.status-lost    { background: var(--danger); }

/* ── EQUIP CARD ── */
.equip-card {
  display: flex;
  background: var(--surface);
  border: 0.5px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 8px;
  overflow: hidden;
  transition: border-color 0.15s;
}
.equip-card:hover { border-color: var(--border2); }
.status-border-repair { border-color: rgba(245,158,11,0.3); }
.status-border-lent   { border-color: rgba(139,92,246,0.3); }
.status-border-lost   { border-color: rgba(239,68,68,0.3); }

.equip-thumb {
  width: 54px; height: 54px; flex-shrink: 0;
  background: var(--surface2);
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; color: var(--text3);
  margin: 12px 0 12px 12px;
  border-radius: 10px; overflow: hidden;
  border: 0.5px solid var(--border2);
}
.equip-thumb img { width: 100%; height: 100%; object-fit: cover; }

.equip-status-bar {
  width: 4px; flex-shrink: 0;
}
.bg-ok     { background: var(--ok); }
.bg-repair { background: var(--warn); }
.bg-lent   { background: #8b5cf6; }
.bg-lost   { background: var(--danger); }

.equip-body {
  flex: 1; padding: 12px; cursor: pointer; min-width: 0;
}
.equip-name { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.equip-meta {
  display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
  margin-bottom: 8px;
}
.equip-cat { font-size: 11px; color: var(--text3); }
.equip-qty { font-size: 11px; font-weight: 700; color: var(--text2); }
.equip-status-row { display: flex; gap: 4px; }
.equip-status-btn {
  padding: 3px 8px; font-size: 11px; border-radius: 99px;
  background: var(--surface2); border: 0.5px solid var(--border2);
  color: var(--text3); transition: all 0.15s;
}
.equip-status-btn.active.s-ok     { background: rgba(34,197,94,0.2);  border-color: var(--ok);     color: var(--ok); }
.equip-status-btn.active.s-repair { background: rgba(245,158,11,0.2); border-color: var(--warn);   color: var(--warn); }
.equip-status-btn.active.s-lent   { background: rgba(139,92,246,0.2); border-color: #8b5cf6;       color: #8b5cf6; }
.equip-status-btn.active.s-lost   { background: rgba(239,68,68,0.2);  border-color: var(--danger); color: var(--danger); }

.equip-actions {
  display: flex; flex-direction: column;
  border-left: 0.5px solid var(--border);
}
.equip-edit-btn, .equip-del-btn {
  flex: 1; padding: 0 14px;
  font-size: 14px;
  transition: background 0.15s;
  display: flex; align-items: center; justify-content: center;
  background: transparent;
}
.equip-edit-btn:hover { background: var(--surface2); }
.equip-del-btn  { border-top: 0.5px solid var(--border); }
.equip-del-btn:hover  { background: rgba(239,68,68,0.1); }

/* ── FAB ── */
.fab {
  position: fixed;
  bottom: 24px; right: calc(50% - 220px);
  width: 56px; height: 56px;
  border-radius: 50%;
  background: var(--accent);
  color: #0a0a0f;
  font-size: 28px; font-weight: 300;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 20px rgba(240,192,64,0.4);
  transition: transform 0.15s, box-shadow 0.15s;
  z-index: 50;
  border: none; cursor: pointer;
}
.fab:hover { transform: scale(1.05); box-shadow: 0 6px 28px rgba(240,192,64,0.5); }
.fab:active { transform: scale(0.95); }

/* ── FORM ── */
.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-size: 12px; font-weight: 600; color: var(--text2); margin-bottom: 6px; }
.form-row { display: flex; gap: 10px; }

/* ── STATUS SELECT ── */
.status-select-row { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.status-select-btn {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 10px; border-radius: var(--radius-sm);
  background: var(--surface2); border: 0.5px solid var(--border2);
  cursor: pointer; transition: all 0.15s;
}
.status-select-btn.active.ss-ok     { background: rgba(34,197,94,0.15);  border-color: var(--ok); }
.status-select-btn.active.ss-repair { background: rgba(245,158,11,0.15); border-color: var(--warn); }
.status-select-btn.active.ss-lent   { background: rgba(139,92,246,0.15); border-color: #8b5cf6; }
.status-select-btn.active.ss-lost   { background: rgba(239,68,68,0.15);  border-color: var(--danger); }
.ss-icon { font-size: 18px; }
.ss-label { font-size: 10px; font-weight: 600; color: var(--text2); }

/* ── CATEGORIES ── */
.cat-manage-card {
  background: var(--surface); border: 0.5px solid var(--border);
  border-radius: var(--radius); padding: 14px 16px;
  margin-bottom: 8px; display: flex; align-items: center;
}
.cat-manage-info { flex: 1; }
.cat-manage-name { font-size: 14px; font-weight: 600; }
.cat-manage-count { display: block; font-size: 11px; color: var(--text3); margin-top: 2px; }
.cat-manage-btns { display: flex; gap: 6px; }
.cat-edit-row { display: flex; gap: 8px; align-items: center; flex: 1; }
.icon-btn { font-size: 16px; padding: 6px; border-radius: var(--radius-sm); transition: background 0.15s; background: transparent; }
.icon-btn:hover { background: var(--surface2); }
.icon-btn.danger:hover { background: rgba(239,68,68,0.1); }

/* ── PHOTO UPLOAD ── */
.photo-upload-zone {
  width: 100%; height: 120px;
  background: var(--surface2);
  border: 1.5px dashed var(--border2);
  border-radius: var(--radius);
  display: flex; align-items: center; justify-content: center;
  position: relative; overflow: hidden; cursor: pointer;
  transition: all 0.2s;
}
.photo-upload-zone:hover { border-color: var(--accent); background: rgba(240,192,64,0.05); }
.photo-upload-zone.has-image { border-style: solid; border-color: var(--border2); }
.photo-preview-wrap { width: 100%; height: 100%; position: relative; }
.photo-preview { width: 100%; height: 100%; object-fit: contain; }
.photo-placeholder { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--text3); font-size: 13px; font-weight: 500; }
.btn-remove-photo {
  position: absolute; top: 8px; right: 8px;
  width: 24px; height: 24px; border-radius: 50%;
  background: rgba(0,0,0,0.6); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; border: none; z-index: 2;
}
.btn-remove-photo:hover { background: #ef4444; }

/* ── CONFIRM MODAL ── */
.confirm-sheet { text-align: center; }
.confirm-icon {
  width: 64px; height: 64px; border-radius: 50%;
  background: rgba(239,68,68,0.1); color: var(--danger);
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 16px;
}

/* ── TEMPLATES ── */
.tpl-card {
  display: flex; align-items: center; gap: 12px;
  background: var(--surface); border: 0.5px solid var(--border);
  border-radius: var(--radius); padding: 14px 16px;
  margin-bottom: 8px;
}
.tpl-icon { font-size: 24px; }
.tpl-info { flex: 1; }
.tpl-name { font-size: 14px; font-weight: 600; }
.tpl-count { font-size: 11px; color: var(--text3); }

.tpl-select-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: var(--radius-sm);
  cursor: pointer; transition: background 0.15s;
}
.tpl-select-item:hover { background: var(--surface2); }
.tpl-select-item.selected { background: rgba(240,192,64,0.08); }
.tpl-checkbox {
  width: 18px; height: 18px; border-radius: 4px;
  border: 1.5px solid var(--border2);
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 900; color: var(--accent);
  flex-shrink: 0;
}
.tpl-select-item.selected .tpl-checkbox { background: var(--accent); border-color: var(--accent); color: #0a0a0f; }
.tpl-item-qty { margin-left: auto; font-size: 11px; color: var(--text3); }
.selected-count {
  text-align: center; font-size: 12px; font-weight: 600;
  color: var(--accent); margin-top: 10px;
}
</style>
