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
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocFromServer,
  writeBatch,
  disableNetwork,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  FollowedPlayerConfig,
  Player,
  Match,
  ShogiMonthlyResult,
  PushNotificationItem,
} from '../types/shogi';
import { enrichAllResultsWithSupplements } from './matchSupplementService';


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

let isQuotaExceeded = false;

export function isFirestoreQuotaExceeded(): boolean {
  return isQuotaExceeded;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  if (errMsg.includes('Quota exceeded') || errMsg.includes('resource-exhausted')) {
    isQuotaExceeded = true;
    disableNetwork(db).catch(() => {});
    console.warn(
      'Firestore Quota Exceeded. Daily free tier write limit reached for database ai-studio-cdee4899-3822-455d-a0cc-3caae5b1b9c8.\n' +
        'Quota will reset tomorrow. Detailed database quota status:\n' +
        'https://console.firebase.google.com/project/jumping-impact-cjf39/firestore/databases/ai-studio-cdee4899-3822-455d-a0cc-3caae5b1b9c8/data?openUpgradeDialog=true'
    );
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.warn('Firestore Error:', JSON.stringify(errInfo));
}

/**
 * Validate Connection to Firestore on boot (as required by Firestore Integration guidelines).
 */
export async function testConnection(): Promise<boolean> {
  if (isQuotaExceeded) return false;
  try {
    await getDocFromServer(doc(db, 'app_data', 'connection_test'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline notice: Please check your Firebase configuration or internet connection.');
    } else {
      handleFirestoreError(error, OperationType.GET, 'app_data/connection_test');
    }
    return false;
  }
}

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

/**
 * Helper to convert email address to a safe document ID.
 */
export function getSafeCloudUserId(email?: string | null): string {
  if (!email) return 'default_user';
  return email.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Real-time listener for user's followed players from Firestore.
 */
export function subscribeFollowedPlayers(
  userId: string,
  onUpdate: (followed: FollowedPlayerConfig[]) => void
) {
  if (isQuotaExceeded) return () => {};
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
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, `users/${userId}/followed`);
    return () => {};
  }
}

/**
 * Save or update a single followed player in Firestore.
 */
export async function saveFollowedPlayerCloud(userId: string, config: FollowedPlayerConfig) {
  if (isQuotaExceeded) return;
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
 * Remove a followed player in Firestore.
 */
export async function removeFollowedPlayerCloud(userId: string, playerId: string) {
  if (isQuotaExceeded) return;
  const path = `users/${userId}/followed/${playerId}`;
  try {
    const docRef = doc(db, 'users', userId, 'followed', playerId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Sync local storage list of followed players into Cloud Firestore.
 */
export async function syncLocalListToCloud(userId: string, localList: FollowedPlayerConfig[]) {
  if (!localList || localList.length === 0) return;
  for (const config of localList) {
    await saveFollowedPlayerCloud(userId, config);
  }
}

/**
 * Fetch all active players (pro & women) from Firestore app_data/players.
 */
export async function fetchPlayersFromCloud(): Promise<{ players: Player[]; lastSyncTime: string } | null> {
  if (isQuotaExceeded) return null;
  const path = 'app_data/players';
  try {
    const snap = await getDoc(doc(db, 'app_data', 'players'));
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.players) && data.players.length > 0) {
        return {
          players: data.players as Player[],
          lastSyncTime: data.lastSyncTime || new Date().toISOString(),
        };
      }
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

/**
 * Save all players to Firestore app_data/players.
 */
export async function savePlayersToCloud(players: Player[], lastSyncTime?: string): Promise<boolean> {
  if (isQuotaExceeded) return false;
  const path = 'app_data/players';
  try {
    const cleanPlayers = JSON.parse(JSON.stringify(players));
    await setDoc(doc(db, 'app_data', 'players'), {
      players: cleanPlayers,
      count: cleanPlayers.length,
      lastSyncTime: lastSyncTime || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

/**
 * Fetch all official match schedules from Firestore app_data/matches.
 */
export async function fetchMatchesFromCloud(): Promise<{ matches: Match[]; lastSyncTime: string } | null> {
  if (isQuotaExceeded) return null;
  const path = 'app_data/matches';
  try {
    const snap = await getDoc(doc(db, 'app_data', 'matches'));
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.matches) && data.matches.length > 0) {
        return {
          matches: data.matches as Match[],
          lastSyncTime: data.lastSyncTime || new Date().toISOString(),
        };
      }
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

/**
 * Save official match schedules to Firestore app_data/matches.
 */
export async function saveMatchesToCloud(matches: Match[], lastSyncTime?: string): Promise<boolean> {
  if (isQuotaExceeded) return false;
  const path = 'app_data/matches';
  try {
    const cleanMatches = JSON.parse(JSON.stringify(matches));
    await setDoc(doc(db, 'app_data', 'matches'), {
      matches: cleanMatches,
      count: cleanMatches.length,
      lastSyncTime: lastSyncTime || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

/**
 * Fetch 2025 and 2026 fiscal year match results from Firestore (partitioned by month in fiscal_results).
 */
export async function fetchFiscalResultsFromCloud(): Promise<Record<string, ShogiMonthlyResult[]> | null> {
  if (isQuotaExceeded) return null;
  const path = 'fiscal_results';
  try {
    const colSnap = await getDocs(collection(db, 'fiscal_results'));
    if (colSnap.empty) {
      return null;
    }
    const combined: Record<string, ShogiMonthlyResult[]> = {};
    colSnap.forEach((docSnap) => {
      const month = docSnap.id;
      const data = docSnap.data();
      if (Array.isArray(data.results)) {
        const list = data.results as ShogiMonthlyResult[];
        list.forEach((r) => {
          if (r.tournament && (/N\s*H\s*K杯/i.test(r.tournament) || /Ｎ\s*Ｈ\s*Ｋ杯/.test(r.tournament))) {
            r.tournament = 'NHK杯';
          }
        });
        combined[month] = list;
      }
    });
    return Object.keys(combined).length > 0 ? enrichAllResultsWithSupplements(combined) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return null;
  }
}

/**
 * Save 2025 & 2026 fiscal year match results to Firestore (partitioned by month).
 */
export async function saveFiscalResultsToCloud(
  results: Record<string, ShogiMonthlyResult[]>
): Promise<boolean> {
  if (isQuotaExceeded) return false;
  const path = 'fiscal_results';
  try {
    const months = Object.keys(results);
    if (months.length === 0) return false;

    // Save in batches of months
    for (const month of months) {
      const monthResults = results[month];
      if (Array.isArray(monthResults) && monthResults.length > 0) {
        const cleanResults = JSON.parse(JSON.stringify(monthResults));
        cleanResults.forEach((r: any) => {
          if (r.tournament && (/N\s*H\s*K杯/i.test(r.tournament) || /Ｎ\s*Ｈ\s*Ｋ杯/.test(r.tournament))) {
            r.tournament = 'NHK杯';
          }
        });
        await setDoc(doc(db, 'fiscal_results', month), {
          month,
          results: cleanResults,
          count: cleanResults.length,
          updatedAt: new Date().toISOString(),
        });
      }
    }
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

/**
 * Fetch user notification history from Firestore users/{userId}/metadata/notifications.
 */
export async function fetchUserNotificationsFromCloud(userId: string): Promise<PushNotificationItem[] | null> {
  const path = `users/${userId}/metadata/notifications`;
  try {
    const snap = await getDoc(doc(db, 'users', userId, 'metadata', 'notifications'));
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.notifications)) {
        return data.notifications as PushNotificationItem[];
      }
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

/**
 * Save user notification history to Firestore users/{userId}/metadata/notifications.
 */
export async function saveUserNotificationsToCloud(
  userId: string,
  notifications: PushNotificationItem[]
): Promise<boolean> {
  if (isQuotaExceeded) return false;
  const path = `users/${userId}/metadata/notifications`;
  try {
    const clean = JSON.parse(JSON.stringify(notifications));
    await setDoc(doc(db, 'users', userId, 'metadata', 'notifications'), {
      notifications: clean,
      count: clean.length,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

export interface MigrationSummary {
  success: boolean;
  followedCount: number;
  playersCount: number;
  matchesCount: number;
  resultsMonthsCount: number;
  notificationsCount: number;
  migratedAt: string;
}

/**
 * Full migration function: Uploads all localStorage data to Firebase Firestore
 * and establishes Firestore as the primary persistent cloud database.
 */
export async function migrateAllLocalStorageToFirebase(
  userId: string,
  data: {
    followed: FollowedPlayerConfig[];
    players: Player[];
    matches: Match[];
    fiscalResults: Record<string, ShogiMonthlyResult[]>;
    notifications: PushNotificationItem[];
    lastSyncTime?: string | null;
    lastMatchSyncTime?: string | null;
  }
): Promise<MigrationSummary> {
  try {
    // 1. Sync Followed Players to Firestore subcollection
    if (data.followed && data.followed.length > 0) {
      for (const f of data.followed) {
        await saveFollowedPlayerCloud(userId, f);
      }
    }

    // 2. Sync Players list to app_data/players
    if (data.players && data.players.length > 0) {
      await savePlayersToCloud(data.players, data.lastSyncTime || undefined);
    }

    // 3. Sync Matches list to app_data/matches
    if (data.matches && data.matches.length > 0) {
      await saveMatchesToCloud(data.matches, data.lastMatchSyncTime || undefined);
    }

    // 4. Sync 2025 & 2026 Fiscal Results to fiscal_results/{month}
    if (data.fiscalResults && Object.keys(data.fiscalResults).length > 0) {
      await saveFiscalResultsToCloud(data.fiscalResults);
    }

    // 5. Sync Notifications to users/{userId}/metadata/notifications
    if (data.notifications && data.notifications.length > 0) {
      await saveUserNotificationsToCloud(userId, data.notifications);
    }

    const summary: MigrationSummary = {
      success: true,
      followedCount: data.followed?.length || 0,
      playersCount: data.players?.length || 0,
      matchesCount: data.matches?.length || 0,
      resultsMonthsCount: Object.keys(data.fiscalResults || {}).length,
      notificationsCount: data.notifications?.length || 0,
      migratedAt: new Date().toISOString(),
    };

    return summary;
  } catch (error) {
    console.error('Migration to Firebase failed:', error);
    return {
      success: false,
      followedCount: 0,
      playersCount: 0,
      matchesCount: 0,
      resultsMonthsCount: 0,
      notificationsCount: 0,
      migratedAt: new Date().toISOString(),
    };
  }
}
