import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDog4msPwRlx-lc41Wf9cfzoqWxNIGKjb0",
  authDomain: "smart-basket-51f51.firebaseapp.com",
  projectId: "smart-basket-51f51",
  storageBucket: "smart-basket-51f51.firebasestorage.app",
  messagingSenderId: "649770612597",
  appId: "1:649770612597:web:953cdf7a08212de3b8053c",
  measurementId: "G-8R8LGTXHK5",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export function getFirebaseAuthErrorMessage(error: unknown): string {
  const err = error as { code?: string; message?: string } | null;
  const code = err?.code?.trim() || '';
  const message = err?.message?.trim() || '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please check your credentials and try again.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please use the Login tab.';
    case 'auth/weak-password':
      return 'Password is too weak. Please enter at least 6 characters.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a few minutes and try again.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed before completion.';
    case 'auth/network-request-failed':
      return 'Network error while connecting to Firebase. Please check your internet connection.';
    case 'auth/unauthorized-domain':
      return `${code}: Add this domain in Firebase Console -> Authentication -> Settings -> Authorized domains.`;
    case 'auth/operation-not-allowed':
      return `${code}: Enable Email/Password and Google sign-in in Firebase Console -> Authentication -> Sign-in method.`;
    default:
      if (code && message) return `${code}: ${message}`;
      if (code) return code;
      if (message) return message;
      return 'Authentication failed. Please try again.';
  }
}

export function getFirestoreErrorMessage(error: unknown): string {
  const err = error as { code?: string; message?: string } | null;
  const code = err?.code?.trim() || '';
  const message = err?.message?.trim() || '';

  if (code === 'permission-denied' || code === 'firestore/permission-denied') {
    return 'Firestore permission denied. Please ensure you are signed in or update Firestore Security Rules in Firebase Console.';
  }
  if (code === 'unavailable' || code === 'firestore/unavailable') {
    return 'Unable to reach Firestore right now. Please check your internet connection.';
  }
  if (code && message) return `${code}: ${message}`;
  if (message) return message;
  return 'Database sync error. Please try again.';
}
