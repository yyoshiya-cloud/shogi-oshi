import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  onSnapshot,
  deleteDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { FollowedPlayerConfig } from '../types/shogi';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export async function signInGoogleUser(email = 'y.yoshiya@gmail.com', name = 'Y.Yoshiya') {
  return {
    name: name || 'Y.Yoshiya',
    email: email || 'y.yoshiya@gmail.com',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  };
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

/**
 * Real-time listener for user's followed players from Firestore.
 */
export function subscribeFollowedPlayers(
  userId: string,
  onUpdate: (followed: FollowedPlayerConfig[]) => void
) {
  try {
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
        if (list.length > 0) {
          onUpdate(list);
        }
      },
      () => {}
    );
  } catch {
    return () => {};
  }
}

/**
 * Save or update a single followed player in Firestore.
 */
export async function saveFollowedPlayerCloud(userId: string, config: FollowedPlayerConfig) {
  try {
    const docRef = doc(db, 'users', userId, 'followed', config.playerId);
    const cleanData = JSON.parse(JSON.stringify(config));
    await setDoc(docRef, {
      ...cleanData,
      updatedAt: new Date().toISOString(),
    });
  } catch {}
}

/**
 * Remove a followed player in Firestore.
 */
export async function removeFollowedPlayerCloud(userId: string, playerId: string) {
  try {
    const docRef = doc(db, 'users', userId, 'followed', playerId);
    await deleteDoc(docRef);
  } catch {}
}

/**
 * Sync local storage list into Cloud Firestore.
 */
export async function syncLocalListToCloud(userId: string, localList: FollowedPlayerConfig[]) {
  if (!localList || localList.length === 0) return;
  for (const config of localList) {
    await saveFollowedPlayerCloud(userId, config);
  }
}
