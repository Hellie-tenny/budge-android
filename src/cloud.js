// Optional account sign-in (Firebase Authentication: Google, plus email and password as a fallback).
// Sprout works without an account; this only identifies a person for the sync that comes later.
// The web config below is not secret. Access is controlled by Firebase Authentication and the database rules.
import { initializeApp } from 'firebase/app'
import {
  initializeAuth, getAuth, indexedDBLocalPersistence, browserLocalPersistence, onAuthStateChanged,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, sendEmailVerification,
  GoogleAuthProvider, EmailAuthProvider, signInWithPopup, signInWithCredential,
  reauthenticateWithCredential, reauthenticateWithPopup, deleteUser,
} from 'firebase/auth'
import { isNative } from './native.js'

export const app = initializeApp({
  apiKey: 'AIzaSyCLkDloV6R2FzYk7HSymgbLiWshkn5KrGY',
  authDomain: 'sprout-ledger.firebaseapp.com',
  projectId: 'sprout-ledger',
  storageBucket: 'sprout-ledger.firebasestorage.app',
  messagingSenderId: '289711455165',
  appId: '1:289711455165:web:30e301943d603596c930d4',
  measurementId: 'G-6L5JCLN7RF', 
})

// In the Android app the web view cannot show Google's pop-up, so it uses plain persistence and Google signs in
// through the native plugin (below). In a browser the normal setup, with pop-up support, is used.
let auth
try { auth = isNative() ? initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] }) : getAuth(app) } catch { auth = getAuth(app) }

// The native Google plugin is only loaded inside the Android app. This returns the module, never the plugin itself:
// a Capacitor plugin handed back through a promise gets treated as a promise and fails with ".then() is not implemented".
const nativePlugin = () => import('@capacitor-firebase/authentication')

// Calls fn with the signed-in person ({ uid, email }) or null. Returns a function that stops listening.
export const watchUser = fn => onAuthStateChanged(auth, u => fn(u ? { uid: u.uid, email: u.email, hasPassword: u.providerData.some(p => p.providerId === 'password') } : null))

export async function signUp(email, password) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password)
  sendEmailVerification(user).catch(() => {})
}
export const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password)
export async function signInGoogle() {
  if (isNative()) {
    // The plugin shows the Google account picker; the Firebase web SDK then signs in with the token it returns.
    const { FirebaseAuthentication } = await nativePlugin()
    const r = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true })
    if (!r.credential?.idToken) throw new Error('Google did not return an ID token. Check google-services.json.')
    await signInWithCredential(auth, GoogleAuthProvider.credential(r.credential.idToken))
  } else await signInWithPopup(auth, new GoogleAuthProvider())
}
export async function signOutUser() {
  await signOut(auth)
  if (isNative()) { try { const { FirebaseAuthentication } = await nativePlugin(); await FirebaseAuthentication.signOut() } catch { /* nothing signed in natively */ } }
}
// Permanently deletes the signed-in account. Firebase wants a recent sign-in for this, so the person proves it is them
// again first (password, or the Google account picker). Data on this device is not touched.
export async function deleteAccount(password, beforeDelete) {
  const u = auth.currentUser
  if (!u) return
  if (u.providerData.some(p => p.providerId === 'password')) {
    await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, password || ''))
  } else if (isNative()) {
    const { FirebaseAuthentication } = await nativePlugin()
    const r = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true })
    if (!r.credential?.idToken) throw new Error('Google did not return an ID token.')
    await reauthenticateWithCredential(u, GoogleAuthProvider.credential(r.credential.idToken))
  } else await reauthenticateWithPopup(u, new GoogleAuthProvider())
  if (beforeDelete) await beforeDelete(u.uid) // e.g. erase this person's synced data while still signed in
  await deleteUser(u)
  if (isNative()) { try { const { FirebaseAuthentication } = await nativePlugin(); await FirebaseAuthentication.signOut() } catch { /* nothing signed in natively */ } }
}
export const resetPassword = email => sendPasswordResetEmail(auth, email)

export function authMessage(e) {
  if (/cancel/i.test(e?.code + ' ' + e?.message)) return ''   // the person closed the Google window: not an error
  switch (e?.code) {
    case 'auth/popup-closed-by-user': case 'auth/cancelled-popup-request': return ''
    case 'auth/popup-blocked': return 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.'
    case 'auth/account-exists-with-different-credential': return 'This email already has an account that signs in a different way.'
    case 'auth/invalid-email': return 'That email address does not look right.'
    case 'auth/missing-password': return 'Enter your password.'
    case 'auth/invalid-credential': case 'auth/wrong-password': case 'auth/user-not-found': return 'Wrong email or password.'
    case 'auth/email-already-in-use': return 'An account with this email already exists. Try signing in.'
    case 'auth/weak-password': return 'Choose a stronger password.'
    case 'auth/requires-recent-login': return 'Please sign in again, then try once more.'
    case 'auth/too-many-requests': return 'Too many attempts. Wait a few minutes and try again.'
    case 'auth/network-request-failed': return 'No internet connection.'
    default: return 'Something went wrong. Please try again.'
  }
}
