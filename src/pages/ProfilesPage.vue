<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Profile } from '../types'
import { useStore } from '../store'
import PinPad from '../components/PinPad.vue'
import { Lock } from 'lucide-vue-next'

const props = defineProps<{
  profiles: Profile[];
}>()

const emit = defineEmits<{
  selected: [profile: Profile];
}>()

const store = useStore()
const selectedProfileForPin = ref<Profile | null>(null)
const pinError = ref(false)

function handleSelect(profile: Profile) {
  if (profile.isBlocked) return // Ne fait rien si bloqué
  
  if (profile.pin) {
    selectedProfileForPin.value = profile
    pinError.value = false
  } else {
    store.state.activeProfile = profile
    emit('selected', profile)
  }
}

function verifyPin(pin: string) {
  // Compare pins as strings to avoid Type mismatch (Number vs String)
  const storedPin = selectedProfileForPin.value?.pin?.toString()
  if (storedPin === pin) {
    pinError.value = false
    store.state.activeProfile = selectedProfileForPin.value
    emit('selected', selectedProfileForPin.value)
    selectedProfileForPin.value = null
  } else {
    pinError.value = true
  }
}

function initialLetter(name: string) {
  return name ? name.charAt(0).toUpperCase() : '?'
}
</script>

<template>
  <div class="profiles-root">
    <div class="profiles-container">
      <template v-if="!selectedProfileForPin">
        <h1 class="profiles-title">Qui est-ce ?</h1>
        
        <div class="profiles-grid">
          <div 
            v-for="profile in profiles" 
            :key="profile.id" 
            class="profile-card"
            :class="{ blocked: profile.isBlocked }"
            @click="handleSelect(profile)"
          >
            <div class="profile-avatar" :style="{ backgroundColor: profile.avatarColor || 'var(--surface2)' }">
              <span class="avatar-letter">{{ initialLetter(profile.name) }}</span>
              <div v-if="profile.pin && !profile.isBlocked" class="lock-icon">
                <Lock :size="16" />
              </div>
            </div>
            <div class="profile-name">{{ profile.name }}</div>
            <div v-if="profile.isBlocked" class="profile-role blocked-label">Bloqué</div>
            <div v-else class="profile-role">
              {{ profile.role === 'admin' ? 'Administrateur' : (profile.role === 'editor' ? 'Éditeur' : 'Lecteur') }}
            </div>
          </div>
        </div>
      </template>

      <template v-else>
        <h1 class="profiles-title" style="margin-bottom: 8px;">Code PIN requis</h1>
        <p style="color:var(--text3); margin-bottom: 32px; text-align:center;">
          Profil <strong>{{ selectedProfileForPin.name }}</strong>
        </p>
        
        <PinPad 
          :error="pinError" 
          @submit="verifyPin" 
          @cancel="selectedProfileForPin = null"
        />
        <div v-if="pinError" style="color:var(--danger); text-align:center; margin-top:24px; font-weight:600;">
          Code incorrect
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.profiles-root {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg);
  padding: 24px;
}

.profiles-container {
  width: 100%;
  max-width: 800px;
}

.profiles-title {
  text-align: center;
  font-size: 36px;
  font-weight: 800;
  margin-bottom: 48px;
  color: var(--text);
  letter-spacing: -0.02em;
}

.profiles-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 32px;
}

.profile-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: transform 0.2s;
  width: 120px;
}

.profile-card:hover:not(.blocked) .profile-avatar {
  border-color: var(--text);
}

.profile-card:hover:not(.blocked) .profile-name {
  color: var(--text);
}

.profile-card:active:not(.blocked) {
  transform: scale(0.95);
}

.profile-card.blocked {
  opacity: 0.4;
  cursor: not-allowed;
  filter: grayscale(100%);
}

.profile-avatar {
  width: 100px;
  height: 100px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  border: 3px solid transparent;
  transition: all 0.2s;
  position: relative;
  box-shadow: 0 8px 24px rgba(0,0,0,0.2);
}

.avatar-letter {
  font-size: 42px;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

.lock-icon {
  position: absolute;
  bottom: -8px;
  background: var(--surface2);
  border: 2px solid var(--bg);
  border-radius: 50%;
  padding: 4px;
  color: var(--text);
  display: flex;
  box-shadow: 0 2px 4px rgba(0,0,0,0.5);
}

.profile-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--text2);
  transition: color 0.2s;
  text-align: center;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-role {
  font-size: 12px;
  color: var(--text3);
  margin-top: 4px;
}

.blocked-label {
  color: var(--danger);
  font-weight: 700;
}
</style>
