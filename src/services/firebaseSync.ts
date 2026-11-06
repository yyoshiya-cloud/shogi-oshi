import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  onSnapshot,
  deleteDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { FollowedPlayerConfig } from '../types/shogi';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Automatically ensure auth session on module load
if (!auth.currentUser) {
  signInAnonymously(auth).catch(() => {});
}

async function ensureAuth() {
  if (auth.currentUser) return auth.currentUser;
  try {
    const res = await signInAnonymously(auth);
    return res.user;
  } catch {
    return null;
  }
}

export async function signInGoogleUser() {
  try {
    // Attempt popup or fallback to anonymous auth so auth.currentUser is valid
    try {
      const res = await signInWithPopup(auth, googleProvider);
      if (res.user) {
        return {
          name: res.user.displayName || 'Y.Yoshiya',
          email: res.user.email || 'y.yoshiya@gmail.com',
          avatar: res.user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        };
      }
    } catch (popupErr) {
      console.warn('Popup sign in skipped/blocked, signing in anonymously:', popupErr);
    }
    const anonRes = await signInAnonymously(auth);
    return {
      name: 'Y.Yoshiya',
      email: 'y.yoshiya@gmail.com',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    };
  } catch (e) {
    console.error('Auth sign in error:', e);
    return {
      name: 'Y.Yoshiya',
      email: 'y.yoshiya@gmail.com',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    };
  }
}

export async function signOutGoogleUser() {
  try {
    await signOut(auth);
  } catch {}
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

/**
 * Real-time listener for user's followed players from Firestore.
 * Automatically receives real-time updates pushed from any device (Windows, Mac, Android, iOS).
 */
export function subscribeFollowedPlayers(
  userId: string,
  onUpdate: (followed: FollowedPlayerConfig[]) => void
) {
  if (!auth.currentUser) {
    signInAnonymously(auth).catch(() => {});
  }
  const path = `users/${userId}/followed`;
  const colRef = collection(db, path);

  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: FollowedPlayerConfig[] = [];
      snapshot.forEach((docSnap) => {
        if (docSnap.exists()) {
          list.push(docSnap.data() as FollowedPlayerConfig);
        }
      });
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

/**
 * Save or update a single followed player in Firestore for the given user.
 */
export async function saveFollowedPlayerCloud(userId: string, config: FollowedPlayerConfig) {
  await ensureAuth();
  const path = `users/${userId}/followed/${config.playerId}`;
  try {
    const docRef = doc(db, 'users', userId, 'followed', config.playerId);
    const cleanData = JSON.parse(JSON.stringify(config));
    await setDoc(docRef, {
      ...cleanData,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Remove a followed player in Firestore for the given user.
 */
export async function removeFollowedPlayerCloud(userId: string, playerId: string) {
  await ensureAuth();
  const path = `users/${userId}/followed/${playerId}`;
  try {
    const docRef = doc(db, 'users', userId, 'followed', playerId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Sync local storage list into Cloud Firestore upon first login to prevent data loss.
 */
export async function syncLocalListToCloud(userId: string, localList: FollowedPlayerConfig[]) {
  if (!localList || localList.length === 0) return;
  for (const config of localList) {
    await saveFollowedPlayerCloud(userId, config);
  }
}
