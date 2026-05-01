'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/utils/api-client';
import type { Candidate } from '@/types';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export function useCandidates(decision?: 'selected' | 'unselected') {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const path = decision
        ? `/api/candidates?decision=${decision}`
        : '/api/candidates';
      const res = await apiClient.get<ApiResponse<Candidate[]>>(path);
      setCandidates(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch candidates');
    } finally {
      setLoading(false);
    }
  }, [decision]);

  useEffect(() => { fetch(); }, [fetch]);

  return { candidates, loading, error, refetch: fetch };
}

export function useStats() {
  const [stats, setStats] = useState({ total: 0, pending: 0, selected: 0, unselected: 0, duplicates: 0, processedEmails: 0 });
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<ApiResponse<typeof stats>>('/api/stats');
      setStats(res.data);
    } catch {
      // silently fail — show zeros
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { stats, loading, refetch: fetch };
}
