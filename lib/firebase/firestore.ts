import {
  collection, doc, getDoc, getDocs, setDoc, addDoc,
  updateDoc, query, where, orderBy, limit,
  serverTimestamp, Timestamp, DocumentData,
} from 'firebase/firestore';
import { db } from './config';
import type { Candidate, JobConfig, OutlookSettings, GeminiSettings, ProcessedEmail } from '@/types';

// ── Collection paths ───────────────────────────────────────
const COLLECTIONS = {
  SELECTED: 'candidates/selected/list',
  UNSELECTED: 'candidates/unselected/list',
  PROCESSED_EMAILS: 'emails/processedEmails/list',
  CONFIG: 'config',
  SETTINGS: 'settings',
} as const;

// ── Helpers ────────────────────────────────────────────────
function serializeTimestamp(data: DocumentData): DocumentData {
  const result: DocumentData = {};
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp) {
      result[key] = value.toDate().toISOString();
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = serializeTimestamp(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ── Candidates ─────────────────────────────────────────────
export async function saveCandidate(candidate: Omit<Candidate, 'id'>): Promise<string> {
  const collectionPath = candidate.reviewStatus === 'selected'
    ? COLLECTIONS.SELECTED
    : COLLECTIONS.UNSELECTED;

  const colRef = collection(db, collectionPath);
  const docRef = await addDoc(colRef, {
    ...candidate,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getCandidatesByDecision(decision: 'selected' | 'unselected'): Promise<Candidate[]> {
  const path = decision === 'selected' ? COLLECTIONS.SELECTED : COLLECTIONS.UNSELECTED;
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...serializeTimestamp(d.data()) } as Candidate));
}

export async function getAllCandidates(): Promise<Candidate[]> {
  const [selected, unselected] = await Promise.all([
    getCandidatesByDecision('selected'),
    getCandidatesByDecision('unselected'),
  ]);
  return [...selected, ...unselected].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function checkDuplicateCandidate(email: string): Promise<boolean> {
  const collections = [COLLECTIONS.SELECTED, COLLECTIONS.UNSELECTED];
  for (const path of collections) {
    const q = query(collection(db, path), where('email', '==', email));
    const snap = await getDocs(q);
    if (!snap.empty) return true;
  }
  return false;
}

// ── Processed Emails ───────────────────────────────────────
export async function saveProcessedEmail(email: Omit<ProcessedEmail, 'id'>): Promise<string> {
  const colRef = collection(db, COLLECTIONS.PROCESSED_EMAILS);
  const docRef = await addDoc(colRef, {
    ...email,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getProcessedEmails(): Promise<ProcessedEmail[]> {
  const q = query(
    collection(db, COLLECTIONS.PROCESSED_EMAILS),
    orderBy('processedAt', 'desc'),
    limit(100)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...serializeTimestamp(d.data()) } as ProcessedEmail));
}

export async function isEmailProcessed(outlookId: string): Promise<boolean> {
  const q = query(
    collection(db, COLLECTIONS.PROCESSED_EMAILS),
    where('outlookId', '==', outlookId)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

// ── Job Config ─────────────────────────────────────────────
export async function saveJobConfig(config: Omit<JobConfig, 'id'>): Promise<void> {
  const docRef = doc(db, COLLECTIONS.CONFIG, 'currentConfig');
  await setDoc(docRef, { ...config, updatedAt: new Date().toISOString() });
}

export async function getJobConfig(): Promise<JobConfig | null> {
  const docRef = doc(db, COLLECTIONS.CONFIG, 'currentConfig');
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...serializeTimestamp(snap.data()) } as JobConfig;
}

// ── Settings ───────────────────────────────────────────────
export async function saveOutlookSettings(settings: OutlookSettings): Promise<void> {
  const docRef = doc(db, COLLECTIONS.SETTINGS, 'outlookConfig');
  await setDoc(docRef, settings);
}

export async function getOutlookSettings(): Promise<OutlookSettings | null> {
  const docRef = doc(db, COLLECTIONS.SETTINGS, 'outlookConfig');
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return snap.data() as OutlookSettings;
}

export async function saveGeminiSettings(settings: GeminiSettings): Promise<void> {
  const docRef = doc(db, COLLECTIONS.SETTINGS, 'geminiConfig');
  await setDoc(docRef, settings);
}

export async function getGeminiSettings(): Promise<GeminiSettings | null> {
  const docRef = doc(db, COLLECTIONS.SETTINGS, 'geminiConfig');
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return snap.data() as GeminiSettings;
}
