<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'
import { useStore } from './store'

import AuthPage from './pages/AuthPage.vue'
import HomePage from './pages/HomePage.vue'
import ChecklistPage from './pages/ChecklistPage.vue'
import RetourPage from './pages/RetourPage.vue'
import HistoriquePage from './pages/HistoriquePage.vue'
import GestionPage from './pages/GestionPage.vue'
import ToastMsg from './components/ToastMsg.vue'

const { state, loadFromFirebase } = useStore()

type Page = 'home' | 'checklist' | 'retour' | 'historique' | 'gestion'

const loading = ref(true)
const isLoggedIn = ref(false)
const currentPage = ref<Page>('home')
const toast = ref<InstanceType<typeof ToastMsg> | null>(null)

function showToast(msg: string) { toast.value?.show(msg) }

onMounted(() => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      await loadFromFirebase(user.uid)
      isLoggedIn.value = true
    } else {
      isLoggedIn.value = false
    }
    loading.value = false
  })
})

function navigate(page: Page) { currentPage.value = page }
</script>

<template>
  <!-- LOADER -->
  <div v-if="loading" class="loader">
    <span class="loader-logo">🎬</span>
  </div>

  <!-- AUTH -->
  <AuthPage v-else-if="!isLoggedIn" @toast="showToast" />

  <!-- APP -->
  <template v-else>
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
    <ToastMsg ref="toast" />
  </template>
</template>
