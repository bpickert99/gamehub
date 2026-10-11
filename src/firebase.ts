import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase } from 'firebase/database'
import { firebaseConfig } from './firebaseConfig'

for (const [key, value] of Object.entries(firebaseConfig)) {
  if (!value) throw new Error(`Missing Firebase config "${key}" in src/firebaseConfig.ts (see README)`)
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getDatabase(app)
