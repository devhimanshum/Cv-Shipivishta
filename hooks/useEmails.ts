'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/utils/api-client';
import type { OutlookEmail, ProcessedEmail, ProcessEmailResult } from '@/types';
import toast from 'react-hot-toast';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  summary?: { processed: number; skipped: number; errors: number; total: number };
}

export function useEmails() {
  const [emails, setEmails] = useState<OutlookEmail[]>([]);
  const [processedEmails, setProcessedEmails] = useState<ProcessedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [inboxRes, processedRes] = await Promise.all([
        apiClient.get<ApiResponse<OutlookEmail[]>>('/api/emails?type=inbox'),
        apiClient.get<ApiResponse<ProcessedEmail[]>>('/api/emails?type=processed'),
      ]);
      setEmails(inboxRes.data);
      setProcessedEmails(processedRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch emails');
    } finally {
      setLoading(false);
    }
  }, []);

  const processAll = useCallback(async () => {
    setProcessing(true);
    try {
      const res = await apiClient.post<ApiResponse<ProcessEmailResult[]>>('/api/emails/process', {});
      if (res.summary) {
        toast.success(
          `Done: ${res.summary.processed} processed, ${res.summary.skipped} skipped, ${res.summary.errors} errors`
        );
      }
      await fetchEmails();
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Processing failed';
      toast.error(msg);
      throw err;
    } finally {
      setProcessing(false);
    }
  }, [fetchEmails]);

  const processSingle = useCallback(async (emailId: string) => {
    setProcessing(true);
    try {
      const res = await apiClient.post<ApiResponse<ProcessEmailResult>>('/api/emails/process', { emailId });
      toast.success('Email processed successfully');
      await fetchEmails();
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Processing failed';
      toast.error(msg);
      throw err;
    } finally {
      setProcessing(false);
    }
  }, [fetchEmails]);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  return {
    emails,
    processedEmails,
    loading,
    processing,
    error,
    fetchEmails,
    processAll,
    processSingle,
  };
}
