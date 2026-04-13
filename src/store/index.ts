import { reactive, readonly } from 'vue'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { UserData, Item } from '../types'

const DEFAULT_DATA: UserData = {
  categories: ['Caméra', 'Audio', 'Lumière', 'Support', 'Stockage', 'Alimentation', 'Divers'],
  items: [
    { id: 1,  name: 'Caméra principale',  cat: 'Caméra',       qty: 1, status: 'ok', tags: [] },
    { id: 2,  name: 'Objectifs',          cat: 'Caméra',       qty: 3, status: 'ok', tags: [] },
    { id: 3,  name: 'Filtres ND',         cat: 'Caméra',       qty: 1, status: 'ok', tags: [] },
    { id: 4,  name: 'Enregistreur audio', cat: 'Audio',        qty: 1, status: 'ok', tags: [] },
    { id: 5,  name: 'Micro perche',       cat: 'Audio',        qty: 1, status: 'ok', tags: [] },
    { id: 6,  name: 'Micro cravate',      cat: 'Audio',        qty: 2, status: 'ok', tags: [] },
    { id: 7,  name: 'Casque monitoring',  cat: 'Audio',        qty: 1, status: 'ok', tags: [] },
    { id: 8,  name: 'Panneau LED',        cat: 'Lumière',      qty: 2, status: 'ok', tags: [] },
    { id: 9,  name: 'Réflecteurs',        cat: 'Lumière',      qty: 2, status: 'ok', tags: [] },
    { id: 10, name: 'Trépied caméra',     cat: 'Support',      qty: 1, status: 'ok', tags: [] },
    { id: 11, name: 'Trépied lumière',    cat: 'Support',      qty: 2, status: 'ok', tags: [] },
    { id: 12, name: 'Slider / gimbal',    cat: 'Support',      qty: 1, status: 'ok', tags: [] },
    { id: 13, name: 'Cartes SD',          cat: 'Stockage',     qty: 4, status: 'ok', tags: [] },
    { id: 14, name: 'Disque dur externe', cat: 'Stockage',     qty: 1, status: 'ok', tags: [] },
    { id: 15, name: 'Batteries caméra',   cat: 'Alimentation', qty: 4, status: 'ok', tags: [] },
    { id: 16, name: 'Chargeurs',          cat: 'Alimentation', qty: 2, status: 'ok', tags: [] },
    { id: 17, name: 'Multiprise',         cat: 'Alimentation', qty: 1, status: 'ok', tags: [] },
    { id: 18, name: 'Laptop',             cat: 'Divers',       qty: 1, status: 'ok', tags: [] },
    { id: 19, name: 'Câbles HDMI',        cat: 'Divers',       qty: 3, status: 'ok', tags: [] },
  ],
  sessions: [],
  templates: [],
}

const state = reactive<UserData & { _uid: string | null }>({
  ...JSON.parse(JSON.stringify(DEFAULT_DATA)),
  _uid: null,
})

export function useStore() {
  async function loadFromFirebase(uid: string) {
    state._uid = uid
    const ref = doc(db, 'users', uid)
    const snap = await getDoc(ref)
    if (snap.exists()) {
      const data = snap.data() as UserData
      state.categories = data.categories || []
      state.sessions = data.sessions || []
      state.templates = data.templates || []
      // Migrate items: ensure status + tags exist
      state.items = (data.items || []).map((i: Item) => ({
        ...i,
        status: i.status || 'ok',
        tags: i.tags || [],
        checkedArrive: false,
        checkedDepart: false,
        takenArrive: 0,
        takenDepart: 0,
      }))
    } else {
      const fresh = JSON.parse(JSON.stringify(DEFAULT_DATA))
      state.categories = fresh.categories
      state.items = fresh.items
      state.sessions = []
      state.templates = []
      await setDoc(ref, {
        categories: state.categories,
        items: state.items,
        sessions: [],
        templates: [],
      })
    }
  }

  async function save() {
    if (!state._uid) return
    const ref = doc(db, 'users', state._uid)
    await setDoc(ref, {
      categories: state.categories,
      items: state.items,
      sessions: state.sessions,
      templates: state.templates,
    })
  }

  return { state: readonly(state) as typeof state, loadFromFirebase, save }
}
