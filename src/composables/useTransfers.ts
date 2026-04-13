import { ref } from 'vue'
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc } from 'firebase/firestore'
import { db, auth } from '../firebase'
import type { Session, Transfer } from '../types'

export function useTransfers() {
  const pendingTransfers = ref<Transfer[]>([])
  let unsubscribe: (() => void) | null = null
  
  function listenTransfers() {
    if (!auth.currentUser?.email) return
    const q = query(
      collection(db, 'transfers'),
      where('toEmail', '==', auth.currentUser.email),
      where('status', '==', 'pending')
    )
    unsubscribe = onSnapshot(q, (snap) => {
      pendingTransfers.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Transfer))
    })
  }

  function stopListeningTransfers() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    pendingTransfers.value = []
  }

  async function sendSessionToAccount(session: Session, toEmail: string) {
    if (!auth.currentUser) throw new Error("Non connecté")
    await addDoc(collection(db, 'transfers'), {
      fromUid: auth.currentUser.uid,
      fromEmail: auth.currentUser.email,
      toEmail: toEmail.toLowerCase().trim(),
      session,
      status: 'pending',
      createdAt: Date.now()
    })
  }

  async function acceptTransfer(transferId: string, session: Session, store: any) {
    // 1. Mark transfer as accepted
    await updateDoc(doc(db, 'transfers', transferId), { status: 'accepted' })
    
    // 2. Clone the session and assign a new ID
    const newSession = {
       ...session,
       id: Date.now(),
    }
    store.state.sessions.unshift(newSession)
    
    // 3. Merging items into the receiver's inventory
    const existingItems = store.state.items
    for (const snap of session.snapshot) {
      const existing = existingItems.find((i: any) => i.name.toLowerCase() === snap.name.toLowerCase())
      if (!existing) {
        // Create new item in the inventory if it doesn't exist
        existingItems.push({
           id: Date.now() + Math.floor(Math.random() * 10000),
           name: snap.name,
           cat: snap.cat || 'Divers',
           qty: snap.qty || snap.taken, // at least the quantity in the session
           status: snap.status || 'ok',
           tags: snap.tags || [],
           imageUrl: snap.imageUrl || ''
        })
      } else {
        // If it exists, user requested to just add them: "ça doit jute rajouter"
        // Let's add the session quantity to the existing item's quantity
        existing.qty += (snap.qty || snap.taken)
        // Optionally update the imageUrl if the received one has it but existing doesn't
        if (!existing.imageUrl && snap.imageUrl) existing.imageUrl = snap.imageUrl
      }
    }
    
    await store.save()
  }

  async function rejectTransfer(transferId: string) {
    await updateDoc(doc(db, 'transfers', transferId), { status: 'rejected' })
  }

  return { 
    pendingTransfers, 
    listenTransfers, 
    stopListeningTransfers,
    sendSessionToAccount, 
    acceptTransfer, 
    rejectTransfer 
  }
}
