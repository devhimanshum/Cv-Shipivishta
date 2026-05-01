'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Zap, TrendingUp, DollarSign, RefreshCw,
  ArrowDown, ArrowUp, FileText, Calendar,
  BarChart3, AlertCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/utils/api-client';
import { cn } from '@/lib/utils/helpers';
import type { TokenUsageRecord, DailyUsageSummary } from '@/types';

interface UsageData {
  today: DailyUsageSummary;
  daily: DailyUsageSummary[];
  records: TokenUsageRecord[];
  totals: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    totalCost: number;
    totalRequests: number;
  };
}

// ── helpers ───────────────────────────────────────────────────
function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
function formatCost(usd: number) {
  if (usd < 0.001) return '<$0.001';
  return `$${usd.toFixed(4)}`;
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// ── Stat card ─────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, color }: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; color: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', color)}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-xs font-medium text-slate-500 mt-0.5">{label}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Mini bar chart (last 7 days) ──────────────────────────────
function MiniBarChart({ daily }: { daily: DailyUsageSummary[] }) {
  const last7 = [...daily].slice(0, 7).reverse();
  if (!last7.length) return null;
  const max   = Math.max(...last7.map(d => d.totalTokens), 1);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-4 w-4 text-slate-500" />
        <h4 className="text-sm font-bold text-slate-800">Daily Token Usage (Last 7 Days)</h4>
      </div>
      <div className="flex items-end gap-2 h-28">
        {last7.map((d, i) => {
          const pct = (d.totalTokens / max) * 100;
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 group">
              <div className="relative w-full flex flex-col justify-end" style={{ height: 80 }}>
                {/* Tooltip */}
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 bg-slate-900 text-white text-[10px] rounded-lg px-2 py-1 whitespace-nowrap">
                  {formatTokens(d.totalTokens)} · {formatCost(d.costUsd)}
                </div>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(pct, 4)}%` }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className={cn(
                    'w-full rounded-t-lg',
                    d.totalTokens > 0 ? 'bg-primary-500' : 'bg-slate-100',
                  )}
                />
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                {new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Per-request log table ─────────────────────────────────────
function RequestLog({ records }: { records: TokenUsageRecord[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? records : records.slice(0, 10);

  if (!records.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-500" />
          <h4 className="text-sm font-bold text-slate-800">CV Processing Log</h4>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
            {records.length}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Candidate</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Date & Time</th>
              <th className="px-4 py-2.5 text-right font-semibold text-slate-500">
                <span className="flex items-center justify-end gap-1"><ArrowDown className="h-3 w-3 text-blue-400" />Input</span>
              </th>
              <th className="px-4 py-2.5 text-right font-semibold text-slate-500">
                <span className="flex items-center justify-end gap-1"><ArrowUp className="h-3 w-3 text-emerald-400" />Output</span>
              </th>
              <th className="px-4 py-2.5 text-right font-semibold text-slate-500">Total</th>
              <th className="px-4 py-2.5 text-right font-semibold text-slate-500">Cost</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Model</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={r.id ?? i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800 truncate max-w-[160px]">{r.candidateName}</p>
                  <p className="text-slate-400 truncate max-w-[160px]">{r.emailSubject}</p>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  <p>{formatDate(r.processedAt)}</p>
                  <p className="text-slate-400">{formatTime(r.processedAt)}</p>
                </td>
                <td className="px-4 py-3 text-right font-mono text-blue-600">{formatTokens(r.inputTokens)}</td>
                <td className="px-4 py-3 text-right font-mono text-emerald-600">{formatTokens(r.outputTokens)}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-slate-700">{formatTokens(r.totalTokens)}</td>
                <td className="px-4 py-3 text-right font-mono text-amber-600">{formatCost(r.costUsd)}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    {r.model}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {records.length > 10 && (
        <div className="border-t border-slate-100 px-5 py-3 text-center">
          <button
            onClick={() => setShowAll(s => !s)}
            className="text-xs font-medium text-primary-600 hover:underline"
          >
            {showAll ? 'Show less' : `Show all ${records.length} records`}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────
export function TokenUsagePanel() {
  const [data,       setData]       = useState<UsageData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [range,      setRange]      = useState(30);

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success: boolean; data: UsageData }>(`/api/usage?days=${range}`);
      setData(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load usage');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range]);

  useEffect(() => { fetch(); }, [fetch]);

  if (loading) return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />)}
      </div>
      <div className="h-48 rounded-2xl bg-slate-100 animate-pulse" />
      <div className="h-64 rounded-2xl bg-slate-100 animate-pulse" />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center gap-3 py-12 text-center rounded-2xl border border-slate-200 bg-white">
      <AlertCircle className="h-8 w-8 text-red-400" />
      <p className="text-sm text-slate-500">{error}</p>
      <button onClick={() => fetch()} className="text-xs text-primary-600 hover:underline font-medium">Retry</button>
    </div>
  );

  const { today, daily, records, totals } = data!;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
            <Zap className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">AI Token Usage</h3>
            <p className="text-xs text-slate-500">OpenAI · {totals.totalRequests} CVs processed</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={range}
            onChange={e => setRange(Number(e.target.value))}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={() => fetch(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Today highlight */}
      <div className="rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 to-indigo-50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-3.5 w-3.5 text-primary-600" />
          <span className="text-xs font-bold text-primary-700 uppercase tracking-wider">Today</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Requests',     value: String(today.requests),                  color: 'text-slate-800' },
            { label: 'Input tokens', value: formatTokens(today.inputTokens),          color: 'text-blue-700' },
            { label: 'Output tokens',value: formatTokens(today.outputTokens),         color: 'text-emerald-700' },
            { label: 'Cost (USD)',   value: formatCost(today.costUsd),                color: 'text-amber-700' },
          ].map(item => (
            <div key={item.label} className="rounded-xl bg-white/60 px-3 py-2.5 border border-white/80">
              <p className={cn('text-lg font-bold', item.color)}>{item.value}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Period stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Requests" value={String(totals.totalRequests)}
          sub={`Last ${range} days`}
          icon={<TrendingUp className="h-4 w-4 text-primary-600" />}
          color="bg-primary-100"
        />
        <StatCard
          label="Input Tokens" value={formatTokens(totals.totalInputTokens)}
          sub="Prompt tokens sent"
          icon={<ArrowDown className="h-4 w-4 text-blue-600" />}
          color="bg-blue-100"
        />
        <StatCard
          label="Output Tokens" value={formatTokens(totals.totalOutputTokens)}
          sub="Completion tokens"
          icon={<ArrowUp className="h-4 w-4 text-emerald-600" />}
          color="bg-emerald-100"
        />
        <StatCard
          label="Total Cost" value={formatCost(totals.totalCost)}
          sub="USD · gpt-4o-mini"
          icon={<DollarSign className="h-4 w-4 text-amber-600" />}
          color="bg-amber-100"
        />
      </div>

      {/* Bar chart */}
      {daily.length > 0 && <MiniBarChart daily={daily} />}

      {/* Request log */}
      {records.length > 0
        ? <RequestLog records={records} />
        : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center">
            <Zap className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No CV processing in the last {range} days</p>
            <p className="text-xs text-slate-300 mt-1">Process a CV from the Inbox to see usage here</p>
          </div>
        )
      }
    </div>
  );
}
