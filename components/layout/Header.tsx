'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { apiClient } from '@/lib/utils/api-client';
import toast from 'react-hot-toast';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, onRefresh, actions }: HeaderProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await apiClient.post<{
        success: boolean;
        summary?: { processed: number; skipped: number; errors: number };
      }>('/api/refresh', {});
      if (res.summary) {
        toast.success(`Refreshed: ${res.summary.processed} new CVs processed`);
      } else {
        toast.success('Refresh complete');
      }
      onRefresh?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="relative flex items-center justify-between px-6 py-4 bg-white shrink-0"
      style={{ borderBottom: '1px solid #e8eef6' }}>

      {/* Subtle top gradient line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent" />

      {/* Title */}
      <div>
        <h1 className="text-[17px] font-bold text-navy-900 tracking-tight">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 text-[12px] text-slate-400 font-medium">{subtitle}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {actions}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-surface-100 hover:border-slate-300 hover:text-slate-800 transition-all duration-150 disabled:opacity-60 shadow-card"
        >
          <motion.div
            animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
            transition={{ duration: 0.7, repeat: refreshing ? Infinity : 0, ease: 'linear' }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </motion.div>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
    </div>
  );
}
