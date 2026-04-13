import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyDVnreASR57tBfe_i98c5Vf-UCwCCk4xXI',
  authDomain: 'monmatos-6b83b.firebaseapp.com',
  databaseURL: 'https://monmatos-6b83b-default-rtdb.firebaseio.com',
  projectId: 'monmatos-6b83b',
  storageBucket: 'monmatos-6b83b.firebasestorage.app',
  messagingSenderId: '490612390863',
  appId: '1:490612390863:web:e7b0da6aa59038e0c7f0ba',
  measurementId: 'G-VM5BL6ELF9',
}

const firebaseApp = initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)
export const db = getFirestore(firebaseApp)
