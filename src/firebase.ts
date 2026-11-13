import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;

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
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function signInWithGoogleCloudSync(): Promise<{
  ok: boolean;
  user?: User;
  unauthorizedDomain?: string;
  message?: string;
}> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { ok: true, user: result.user };
  } catch (err: any) {
    const code = err?.code || '';
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    if (code === 'auth/unauthorized-domain') {
      return {
        ok: false,
        unauthorizedDomain: hostname,
        message: `ডোমেইন (${hostname}) Firebase Console-এ অনুমোদিত তালিকায় যুক্ত করতে হবে।`,
      };
    }
    if (code === 'auth/popup-closed-by-user') {
      return { ok: false, message: 'গুগল সাইন-ইন পপআপ বন্ধ করা হয়েছে।' };
    }
    return {
      ok: false,
      message: err?.message || 'গুগল ক্লাউড সিঙ্ক চালু করা যায়নি।',
    };
  }
}

export async function signOutCloudSync(): Promise<void> {
  await signOut(auth);
}

export { onAuthStateChanged };
export type { User };
