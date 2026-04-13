<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from './firebase'
import { useStore } from './store'
import {
  House,
  Clapperboard,
  Package,
  ClipboardList,
  Settings2
} from 'lucide-vue-next'

import AuthPage from './pages/AuthPage.vue'
import HomePage from './pages/HomePage.vue'
import ChecklistPage from './pages/ChecklistPage.vue'
import RetourPage from './pages/RetourPage.vue'
import HistoriquePage from './pages/HistoriquePage.vue'
import GestionPage from './pages/GestionPage.vue'
import ToastMsg from './components/ToastMsg.vue'

const { state, loadFromFirebase, resetState } = useStore()

type Page = 'home' | 'checklist' | 'retour' | 'historique' | 'gestion'

const loading = ref(true)
const isLoggedIn = ref(false)
const currentPage = ref<Page>('home')
const toast = ref<InstanceType<typeof ToastMsg> | null>(null)
const showProfile = ref(false)

const user = computed(() => auth.currentUser)

function showToast(msg: string) { toast.value?.show(msg) }
function navigate(page: Page) { currentPage.value = page }

const pendingCount = computed(() =>
  (state.sessions || []).filter(s => s.phase === 'arrive' && !s.isReturned).length
)

onMounted(() => {
  onAuthStateChanged(auth, async (u) => {
    if (u) {
      await loadFromFirebase(u.uid)
      isLoggedIn.value = true
    } else {
      isLoggedIn.value = false
    }
    loading.value = false
  })
})

async function logout() {
  await signOut(auth)
  resetState()
  showProfile.value = false
  isLoggedIn.value = false
}

const navItems = [
  { key: 'home',       icon: House,         label: 'Accueil' },
  { key: 'checklist',  icon: Clapperboard,  label: 'Départ' },
  { key: 'retour',     icon: Package,       label: 'Retour' },
  { key: 'historique', icon: ClipboardList, label: 'Historique' },
  { key: 'gestion',    icon: Settings2,     label: 'Matériel' },
] as const
</script>

<template>
  <!-- LOADER -->
  <div v-if="loading" class="loader">
    <Clapperboard :size="48" class="loader-logo" style="color: var(--accent)" />
  </div>

  <!-- AUTH -->
  <AuthPage v-else-if="!isLoggedIn" @toast="showToast" />

  <!-- APP -->
  <template v-else>
    <!-- SIDEBAR (desktop only) -->
    <aside class="sidebar">
      <div class="sidebar-logo">
        <Clapperboard :size="20" style="color: var(--accent)" />
        <span>MonMatos</span>
      </div>

      <button
        v-for="item in navItems"
        :key="item.key"
        class="sidebar-item"
        :class="{ active: currentPage === item.key }"
        @click="navigate(item.key)"
      >
        <component :is="item.icon" :size="18" class="si-icon" stroke-width="2" />
        {{ item.label }}
        <span v-if="item.key === 'retour' && pendingCount > 0" class="si-badge">{{ pendingCount }}</span>
      </button>

      <div class="sidebar-spacer"></div>

      <button class="sidebar-user" @click="showProfile = true">
        <div class="sidebar-avatar">{{ (user?.displayName || 'R')[0].toUpperCase() }}</div>
        <div style="min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            {{ user?.displayName || 'Réalisateur' }}
          </div>
          <div style="font-size:10px;color:var(--text3)">Paramètres</div>
        </div>
      </button>
    </aside>

    <!-- MAIN CONTENT -->
    <div class="app-desktop">
      <Transition name="page" mode="out-in">
        <div :key="currentPage" style="height:100%">
          <HomePage
            v-if="currentPage === 'home'"
            :state="state"
            @navigate="navigate"
            @toast="showToast"
          />
          <ChecklistPage
            v-else-if="currentPage === 'checklist'"
            :state="state"
            @back="navigate('home')"
            @toast="showToast"
          />
          <RetourPage
            v-else-if="currentPage === 'retour'"
            :state="state"
            @back="navigate('home')"
            @toast="showToast"
          />
          <HistoriquePage
            v-else-if="currentPage === 'historique'"
            :state="state"
            @back="navigate('home')"
            @toast="showToast"
          />
          <GestionPage
            v-else-if="currentPage === 'gestion'"
            :state="state"
            @back="navigate('home')"
            @toast="showToast"
          />
        </div>
      </Transition>
    </div>

    <ToastMsg ref="toast" />

    <!-- PROFILE MODAL -->
    <Teleport to="body">
      <div v-if="showProfile" class="modal-backdrop" @click.self="showProfile = false">
        <div class="modal-sheet">
          <div class="modal-handle"></div>
          <div style="text-align:center;margin-bottom:16px">
            <div class="profile-avatar-lg">{{ (user?.displayName || 'R')[0].toUpperCase() }}</div>
            <div style="font-size:17px;font-weight:700;margin-top:8px">{{ user?.displayName }}</div>
            <div style="font-size:12px;color:var(--text2);margin-top:2px">{{ user?.email }}</div>
          </div>
          <div class="divider"></div>
          <button class="btn btn-secondary btn-full" style="margin-bottom:8px" @click="navigate('gestion'); showProfile = false">
            <Settings2 :size="16" style="margin-right:8px" /> Gérer le matériel
          </button>
          <button class="btn btn-danger btn-full" @click="logout">Se déconnecter</button>
        </div>
      </div>
    </Teleport>

    <nav class="nav-bar">
      <button
        v-for="item in navItems"
        :key="item.key"
        class="nav-item"
        :class="{ active: currentPage === item.key }"
        @click="navigate(item.key)"
      >
        <component :is="item.icon" :size="20" class="ni-icon" stroke-width="2.2" />
        <span>{{ item.label }}</span>
      </button>
    </nav>
  </template>
</template>

<style>
.si-badge {
  margin-left: auto;
  background: var(--text3); color: var(--bg);
  font-family: var(--font-mono);
  font-size: 9px; font-weight: 800;
  padding: 1px 6px; border-radius: 4px;
}
.profile-avatar-lg {
  width: 60px; height: 60px; border-radius: 50%;
  background: var(--surface2);
  border: 1px solid var(--border2);
  color: var(--text); font-size: 22px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto;
}
</style>
