<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStore } from '../store'
import {
  Users,
  ShieldAlert,
  Trash2,
  ChevronLeft,
  Settings2,
  ShieldCheck,
  Lock,
  Pencil,
  X
} from 'lucide-vue-next'
import type { UserData, Profile } from '../types'

const props = defineProps<{ state: UserData & { _uid: string | null; activeProfile?: Profile | null } }>()
const emit = defineEmits<{ back: []; toast: [msg: string] }>()
const { save } = useStore()

const isAdmin = computed(() => props.state.activeProfile?.role === 'admin')

// ─── PROFILES (ADMIN) ───
const newProfile = ref<Partial<Profile>>({ name: '', role: 'viewer', avatarColor: '#3b82f6', pin: '' })
const editingId = ref<string | null>(null)

function startEdit(p: Profile) {
  editingId.value = p.id
  newProfile.value = { ...p }
}

function cancelEdit() {
  editingId.value = null
  newProfile.value = { name: '', role: 'viewer', avatarColor: '#3b82f6', pin: '' }
}

async function saveProfile() {
  if (!newProfile.value.name?.trim()) return emit('toast', 'Le nom est obligatoire')
  if (!props.state.profiles) props.state.profiles = []

  if (editingId.value) {
    // Update existing
    const idx = props.state.profiles.findIndex(p => p.id === editingId.value)
    if (idx !== -1) {
      props.state.profiles[idx] = {
        ...props.state.profiles[idx],
        name: newProfile.value.name.trim(),
        role: newProfile.value.role as any,
        avatarColor: newProfile.value.avatarColor || '#3b82f6',
        pin: newProfile.value.pin?.toString() || undefined,
      }
      emit('toast', 'Profil mis à jour')
    }
  } else {
    // Create new
    props.state.profiles.push({
      id: 'prof-' + Date.now(),
      name: newProfile.value.name.trim(),
      role: newProfile.value.role as any,
      avatarColor: newProfile.value.avatarColor || '#3b82f6',
      pin: newProfile.value.pin?.toString() || undefined,
      isBlocked: false
    })
    emit('toast', 'Profil créé')
  }
  
  cancelEdit()
  await save()
}

async function deleteProfile(id: string) {
  if ((props.state.profiles || []).length <= 1) return emit('toast', 'Impossible de supprimer le dernier profil')
  const idx = props.state.profiles.findIndex(p => p.id === id)
  if (idx !== -1) props.state.profiles.splice(idx, 1)
  await save()
  emit('toast', 'Profil supprimé')
}

async function toggleBlockProfile(p: Profile) {
  p.isBlocked = !p.isBlocked
  await save()
  emit('toast', p.isBlocked ? 'Profil bloqué' : 'Profil débloqué')
}

function getRoleLabel(role: string) {
  if (role === 'admin') return 'Administrateur'
  if (role === 'editor') return 'Éditeur'
  return 'Lecteur'
}
</script>

<template>
  <div class="page-root">
    <!-- HEADER -->
    <div class="page-header">
      <button class="back-btn" @click="emit('back')"><ChevronLeft :size="20" /></button>
      <div style="display:flex;align-items:center;gap:10px">
        <Users :size="22" stroke-width="2.5" style="color:var(--accent)" />
        <h1>Ekipe</h1>
      </div>
    </div>

    <div class="page-content" v-if="isAdmin">
      <div class="card" :class="{ 'edit-mode': editingId }" style="margin-bottom:24px">
        <div class="section-title">{{ editingId ? 'Modifier un membre' : 'Ajouter un nouveau membre' }}</div>
        <div class="form-group">
          <label>Nom complet</label>
          <input v-model="newProfile.name" placeholder="Ex: Jean Dupont..." />
        </div>
        
        <div class="form-row">
          <div class="form-group" style="flex:1">
            <label>Rôle / Permissions</label>
            <select v-model="newProfile.role">
              <option value="admin">Administrateur (Tout)</option>
              <option value="editor">Éditeur (Gère le matos)</option>
              <option value="viewer">Lecteur (Consultation seulement)</option>
            </select>
          </div>
          <div class="form-group" style="flex:1">
            <label>Couleur du profil</label>
            <div style="display:flex; gap:8px; align-items:center">
              <input type="color" v-model="newProfile.avatarColor" style="width:100%; height:42px; padding:2px; border-radius:8px; border:1px solid var(--border2)" />
            </div>
          </div>
        </div>

        <div class="form-group">
          <label>Code PIN de sécurité (4 chiffres - Optionnel)</label>
          <div style="position:relative">
            <input 
              v-model="newProfile.pin" 
              placeholder="Ex: 1234" 
              type="number" 
              maxlength="4" 
              style="padding-left:40px"
              oninput="if(this.value.length > 4) this.value = this.value.slice(0,4)"
            />
            <Lock :size="16" style="position:absolute; left:14px; top:13px; color:var(--text3)" />
          </div>
          <p style="font-size:11px; color:var(--text3); margin-top:6px">
            Si défini, ce code sera demandé sur l'écran d'accueil "Qui est-ce ?".
          </p>
        </div>

        <div class="form-actions">
          <button v-if="editingId" class="btn btn-secondary" style="flex:1" @click="cancelEdit">
            <X :size="18" style="margin-right:8px" /> Annuler
          </button>
          <button class="btn btn-primary" :style="{ flex: editingId ? 2 : 1 }" @click="saveProfile" :disabled="!newProfile.name">
            <ShieldCheck v-if="!editingId" :size="18" style="margin-right:8px" />
            {{ editingId ? 'Enregistrer les modifications' : 'Créer le profil' }}
          </button>
        </div>
      </div>

      <div class="section-title">L'Équipe actuelle ({{ state.profiles?.length || 0 }})</div>
      
      <div class="profiles-list">
        <div 
          v-for="p in state.profiles" 
          :key="p.id" 
          class="member-card" 
          :class="{ 'is-blocked': p.isBlocked }"
        >
          <div 
            class="member-avatar" 
            :style="{ backgroundColor: p.avatarColor || 'var(--accent)' }"
          >
            {{ p.name[0]?.toUpperCase() }}
          </div>
          
          <div class="member-info">
            <div class="member-name">{{ p.name }}</div>
            <div class="member-meta">
              <span class="member-role" :class="p.role">{{ getRoleLabel(p.role) }}</span>
              <span v-if="p.pin" class="pin-badge"><Lock :size="10" /> PIN</span>
            </div>
          </div>

          <div class="member-actions">
            <button class="icon-btn" @click="startEdit(p)" title="Modifier">
              <Pencil :size="18" />
            </button>
            <button 
              class="icon-btn" 
              :class="{ 'active-warn': p.isBlocked }"
              @click="toggleBlockProfile(p)" 
              :title="p.isBlocked ? 'Débloquer' : 'Bloquer'"
            >
              <ShieldAlert :size="18" />
            </button>
            <button 
              class="icon-btn danger" 
              @click="deleteProfile(p.id)" 
              title="Supprimer"
              v-if="state.profiles.length > 1"
            >
              <Trash2 :size="18" />
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else class="empty-state">
      <ShieldAlert :size="48" style="opacity:0.2; margin-bottom:16px" />
      <p>Accès réservé aux administrateurs.</p>
    </div>
  </div>
</template>

<style scoped>
.edit-mode {
  border: 1px solid var(--accent);
  box-shadow: 0 0 20px rgba(240,192,64,0.1);
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 14px;
}

.profiles-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.member-card {
  display: flex;
  align-items: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  transition: all 0.2s;
}

.member-card:hover {
  border-color: var(--border2);
  transform: translateY(-2px);
}

.member-card.is-blocked {
  opacity: 0.5;
  background: var(--bg2);
  border-style: dashed;
}

.member-avatar {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 2px 4px rgba(0,0,0,0.2);
  margin-right: 16px;
  box-shadow: var(--shadow);
}

.member-info {
  flex: 1;
  min-width: 0;
}

.member-name {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 4px;
}

.member-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.member-role {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
}

.member-role.admin { background: rgba(240,192,64,0.1); color: var(--accent); }
.member-role.editor { background: rgba(59,130,246,0.1); color: #3b82f6; }
.member-role.viewer { background: rgba(148,163,184,0.1); color: var(--text3); }

.pin-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 700;
  color: var(--text3);
  background: var(--surface2);
  padding: 2px 6px;
  border-radius: 4px;
}

.member-actions {
  display: flex;
  gap: 8px;
}

.icon-btn.active-warn {
  color: var(--danger);
  background: rgba(239,68,68,0.1);
  border-color: rgba(239,68,68,0.2);
}

.form-group label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: var(--text3);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

input, select {
  width: 100%;
}
</style>
