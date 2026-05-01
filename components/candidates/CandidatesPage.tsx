'use client';

import { useState, useMemo, useCallback } from 'react';
import { Users, Download, RotateCcw, Loader2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { CandidateCard } from '@/components/candidates/CandidateCard';
import { CandidateFilters, DEFAULT_FILTERS, applyFilters } from '@/components/candidates/CandidateFilters';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { useCandidates } from '@/hooks/useCandidates';
import { apiClient } from '@/lib/utils/api-client';
import toast from 'react-hot-toast';
import type { FilterState } from '@/components/candidates/CandidateFilters';
import type { Candidate } from '@/types';

interface CandidatesPageProps {
  decision: 'selected' | 'unselected';
  title: string;
  subtitle: string;
}

// ── CSV export ────────────────────────────────────────────────
function exportCSV(candidates: Candidate[], filename: string) {
  const headers = [
    'Name', 'Email', 'Phone', 'Current Rank', 'Total Sea Service (months)',
    'Rank Match', 'Rank Match Score', 'Education', 'Duplicate',
    'Review Status', 'Review Note', 'Processed At',
  ];

  const rows = candidates.map(c => [
    c.name, c.email, c.phone, c.currentRank,
    c.totalSeaServiceMonths,
    c.rankMatched !== undefined ? (c.rankMatched ? 'Yes' : 'No') : '',
    c.rankMatchScore ?? '',
    c.education, c.duplicate ? 'Yes' : 'No',
    c.reviewStatus, c.reviewNote ?? '', c.processedAt,
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CandidatesPage({ decision, title, subtitle }: CandidatesPageProps) {
  const { candidates, loading, refetch } = useCandidates(decision);
  const [filters,  setFilters]  = useState<FilterState>(DEFAULT_FILTERS);
  const [undoing,  setUndoing]  = useState<string | null>(null);

  const filtered = useMemo(() => applyFilters(candidates, filters), [candidates, filters]);

  const handleUndo = useCallback(async (candidateId: string) => {
    setUndoing(candidateId);
    try {
      await apiClient.put('/api/candidates/review', { candidateId });
      toast.success('Decision reversed — candidate moved back to Review');
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Undo failed');
    } finally {
      setUndoing(null);
    }
  }, [refetch]);

  const handleExport = useCallback(() => {
    if (filtered.length === 0) {
      toast.error('No candidates to export');
      return;
    }
    exportCSV(filtered, `${decision}_candidates_${new Date().toISOString().slice(0,10)}.csv`);
    toast.success(`Exported ${filtered.length} candidates as CSV`);
  }, [filtered, decision]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title={title} subtitle={subtitle} />

      <div className="flex-1 overflow-y-auto bg-surface-50">
        <div className="mx-auto max-w-7xl p-6 space-y-5">

          {/* ── Filters ── */}
          <CandidateFilters
            filters={filters}
            onChange={setFilters}
            totalCount={candidates.length}
            filteredCount={filtered.length}
            extra={
              <button
                onClick={handleExport}
                disabled={loading || candidates.length === 0}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-surface-100 hover:border-slate-300 transition-all shadow-card disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>
            }
          />

          {/* ── Content ── */}
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array(6).fill(0).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : filtered.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((c, i) => (
                <div key={c.id} className="relative group">
                  <CandidateCard candidate={c} index={i} />
                  {/* Undo button overlay */}
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleUndo(c.id)}
                      disabled={undoing === c.id}
                      title="Move back to pending review"
                      className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-500 shadow-card hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 transition-all disabled:opacity-60"
                    >
                      {undoing === c.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <RotateCcw className="h-3 w-3" />}
                      Undo
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{ background: 'linear-gradient(135deg,#f0f6ff,#e8eef6)' }}>
                <Users className="h-7 w-7 text-primary-300" />
              </div>
              <p className="text-sm font-semibold text-slate-600">
                {filters.search ? 'No matching candidates' : `No ${decision} candidates yet`}
              </p>
              {!filters.search && (
                <p className="text-xs text-slate-400 mt-1">
                  Process CVs from inbox and review them to populate this list
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
