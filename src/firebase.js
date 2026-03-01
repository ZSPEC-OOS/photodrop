import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyDmTlYeGThBZCVdq5vVnpWDk-Tpw8qE_iY",
  authDomain: "photodump-e1fcb.firebaseapp.com",
  projectId: "photodump-e1fcb",
  storageBucket: "photodump-e1fcb.firebasestorage.app",
  messagingSenderId: "928707760074",
  appId: "1:928707760074:web:409e108d9511b008c70933",
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const storage = getStorage(app)
