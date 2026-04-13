<script setup lang="ts">
import { ref, computed } from 'vue'
import { Clapperboard, Mail } from 'lucide-vue-next'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth'
import { auth } from '../firebase'

const emit = defineEmits<{ toast: [msg: string] }>()

const tab = ref<'login' | 'register'>('login')
const email = ref('')
const password = ref('')
const prenom = ref('')
const error = ref('')
const loading = ref(false)
const resetSent = ref(false)
const showReset = ref(false)

const canLogin = computed(() => email.value && password.value)
const canRegister = computed(() => prenom.value && email.value && password.value.length >= 6)

async function login() {
  if (!canLogin.value) return
  loading.value = true
  error.value = ''
  try {
    await signInWithEmailAndPassword(auth, email.value, password.value)
  } catch (e: any) {
    error.value = firebaseMsg(e.code)
  } finally {
    loading.value = false
  }
}

async function register() {
  if (!canRegister.value) return
  loading.value = true
  error.value = ''
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.value, password.value)
    await updateProfile(cred.user, { displayName: prenom.value })
    emit('toast', `Bienvenue ${prenom.value} !`)
  } catch (e: any) {
    error.value = firebaseMsg(e.code)
  } finally {
    loading.value = false
  }
}

async function forgotPassword() {
  if (!email.value) {
    error.value = 'Entre ton email pour recevoir le lien.'
    return
  }
  loading.value = true
  error.value = ''
  try {
    await sendPasswordResetEmail(auth, email.value)
    resetSent.value = true
    showReset.value = false
  } catch (e: any) {
    error.value = firebaseMsg(e.code)
  } finally {
    loading.value = false
  }
}

function firebaseMsg(code: string) {
  const map: Record<string, string> = {
    'auth/email-already-in-use': 'Cet email est déjà utilisé.',
    'auth/invalid-email': 'Email invalide.',
    'auth/weak-password': 'Mot de passe trop court (min. 6 caractères).',
    'auth/user-not-found': 'Aucun compte avec cet email.',
    'auth/wrong-password': 'Mot de passe incorrect.',
    'auth/invalid-credential': 'Email ou mot de passe incorrect.',
    'auth/too-many-requests': 'Trop de tentatives. Réessaie plus tard.',
  }
  return map[code] || 'Une erreur est survenue.'
}
</script>

<template>
  <div class="auth-root">
    <div class="auth-card">
      <div class="auth-logo"><Clapperboard :size="48" style="color:var(--accent)" /></div>
      <h1 class="auth-title">MonMatos</h1>
      <p class="auth-sub">Checklist de tournage professionnelle</p>

      <div class="auth-tabs">
        <button :class="{ active: tab === 'login' }" @click="tab = 'login'">Connexion</button>
        <button :class="{ active: tab === 'register' }" @click="tab = 'register'">Inscription</button>
      </div>

      <div v-if="error" class="auth-error">{{ error }}</div>

      <!-- LOGIN -->
      <div v-if="tab === 'login'" class="auth-form">
        <div v-if="resetSent" class="auth-success">
          <Mail :size="16" style="margin-right:8px;vertical-align:middle" />
          Email envoyé ! Vérifie ta boîte mail.
        </div>
        <input v-model="email" type="email" placeholder="Email" @keyup.enter="login" />
        <input v-if="!showReset" v-model="password" type="password" placeholder="Mot de passe" @keyup.enter="login" />
        <button v-if="!showReset" class="btn btn-primary btn-full" :disabled="!canLogin || loading" @click="login">
          {{ loading ? 'Connexion…' : 'Se connecter' }}
        </button>
        <button v-if="showReset" class="btn btn-primary btn-full" :disabled="loading" @click="forgotPassword">
          {{ loading ? 'Envoi…' : 'Envoyer le lien de réinitialisation' }}
        </button>
        <button class="btn-forgot" @click="showReset = !showReset; error = ''; resetSent = false">
          {{ showReset ? '← Retour à la connexion' : 'Mot de passe oublié ?' }}
        </button>
      </div>

      <!-- REGISTER -->
      <div v-else class="auth-form">
        <input v-model="prenom" type="text" placeholder="Ton prénom" @keyup.enter="register" />
        <input v-model="email" type="email" placeholder="Email" @keyup.enter="register" />
        <input v-model="password" type="password" placeholder="Mot de passe (min. 6 car.)" @keyup.enter="register" />
        <button class="btn btn-primary btn-full" :disabled="!canRegister || loading" @click="register">
          {{ loading ? 'Création…' : 'Créer mon compte' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-root {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background-color: var(--bg);
  background-image: 
    radial-gradient(at 0% 0%, rgba(255,255,255,0.03) 0px, transparent 50%),
    radial-gradient(at 100% 100%, rgba(255,255,255,0.02) 0px, transparent 50%);
}
.auth-card {
  width: 100%;
  max-width: 380px;
  background: var(--surface);
  border: 0.5px solid var(--border2);
  border-radius: 24px;
  padding: 36px 28px;
  text-align: center;
  box-shadow: var(--shadow);
}
.auth-logo { font-size: 48px; margin-bottom: 12px; }
.auth-title { font-size: 26px; font-weight: 800; margin-bottom: 4px; }
.auth-sub { font-size: 13px; color: var(--text2); margin-bottom: 28px; }
.auth-tabs {
  display: flex;
  background: var(--bg2);
  border-radius: var(--radius-sm);
  padding: 4px;
  margin-bottom: 20px;
}
.auth-tabs button {
  flex: 1; padding: 9px; font-size: 13px; font-weight: 600;
  border-radius: 8px; color: var(--text3);
  transition: all 0.2s;
}
.auth-tabs button.active { background: var(--surface2); color: var(--text); }
.auth-form { display: flex; flex-direction: column; gap: 10px; }
.auth-error {
  background: rgba(239,68,68,0.1);
  border: 0.5px solid rgba(239,68,68,0.3);
  border-radius: var(--radius-sm);
  color: var(--danger);
  font-size: 13px;
  padding: 10px 14px;
  margin-bottom: 10px;
  text-align: left;
}
button:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-forgot {
  background: none;
  color: var(--text2);
  font-size: 12px;
  text-decoration: underline;
  padding: 4px;
  margin-top: -4px;
}
.btn-forgot:hover { color: var(--accent); }
.auth-success {
  background: rgba(34,197,94,0.1);
  border: 0.5px solid rgba(34,197,94,0.3);
  border-radius: var(--radius-sm);
  color: #22c55e;
  font-size: 13px;
  padding: 10px 14px;
  text-align: left;
}
</style>
