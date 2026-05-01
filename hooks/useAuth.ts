'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase/config';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Safety timeout — if Firebase doesn't respond in 8s, unblock the UI
    const timeout = setTimeout(() => {
      setLoading(false);
      setError('Firebase connection timed out. Check your configuration.');
    }, 8000);

    let unsub: (() => void) | undefined;
    try {
      unsub = onAuthStateChanged(
        auth,
        u => {
          clearTimeout(timeout);
          setUser(u);
          setLoading(false);
          setError(null);
        },
        err => {
          clearTimeout(timeout);
          console.error('Firebase auth error:', err);
          setLoading(false);
          setError(err.message);
        }
      );
    } catch (err) {
      clearTimeout(timeout);
      console.error('Firebase init error:', err);
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Firebase initialization failed');
    }

    return () => {
      clearTimeout(timeout);
      unsub?.();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  return { user, loading, error, signIn, signOut };
}
