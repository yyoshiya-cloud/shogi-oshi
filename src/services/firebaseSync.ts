import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
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
