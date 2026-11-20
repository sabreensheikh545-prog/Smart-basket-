import { getApps, initializeApp } from 'firebase/app';
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

const app = getApps().find((a) => a.name === '[DEFAULT]') || initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Isolated Firebase Auth instance for SMS OTP phone verification during Seller & Rider onboarding
// so verifying a mobile OTP never overwrites or logs out the user's primary Email/Google session.
const phoneOtpApp =
  getApps().find((a) => a.name === 'smart-basket-phone-otp') ||
  initializeApp(firebaseConfig, 'smart-basket-phone-otp');
export const phoneOtpAuth = getAuth(phoneOtpApp);

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
      return 'Too many requests or OTP attempts. Please wait a few minutes and try again.';
    case 'auth/invalid-phone-number':
      return 'Invalid phone number format. Enter a 10-digit Indian mobile number starting with 6-9.';
    case 'auth/invalid-verification-code':
      return 'Incorrect 6-digit SMS OTP. Please check the code sent to your mobile and try again.';
    case 'auth/code-expired':
      return 'This SMS OTP has expired. Please tap "Resend OTP" to request a new code.';
    case 'auth/captcha-check-failed':
      return 'reCAPTCHA verification failed. Please retry sending the OTP.';
    case 'auth/quota-exceeded':
      return 'Daily Firebase SMS OTP quota reached for this project. Please try again later.';
    case 'auth/billing-not-enabled':
      return 'Firebase Phone SMS OTP requires Phone Sign-In enabled (and Blaze plan or test phone numbers configured in Firebase Console).';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed before completion.';
    case 'auth/network-request-failed':
      return 'Network error while connecting to Firebase. Please check your internet connection.';
    case 'auth/unauthorized-domain':
      return `${code}: Add this domain in Firebase Console -> Authentication -> Settings -> Authorized domains.`;
    case 'auth/operation-not-allowed':
      return `${code}: Enable Phone / Email / Google sign-in in Firebase Console -> Authentication -> Sign-in method.`;
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
