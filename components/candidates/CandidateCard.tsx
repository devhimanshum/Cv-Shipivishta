'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Phone, Anchor, Clock, BookOpen,
  AlertCircle, ChevronDown, ChevronUp,
  ClipboardList,
} from 'lucide-react';
import { CVPreviewButton } from '@/components/ui/CVPreviewButton';
import { Badge } from '@/components/ui/Badge';
import { cn, formatDate } from '@/lib/utils/helpers';
import type { Candidate, RankEntry } from '@/types';

const AVATAR_COLORS = [
  'from-violet-500 to-purple-600', 'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',  'from-orange-500 to-amber-600',
  'from-rose-500 to-pink-600',     'from-indigo-500 to-blue-600',
];
const getColor    = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
const getInitials = (name: string) => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '??';

function monthsLabel(m: number) {
  if (!m) return '—';
  const y = Math.floor(m / 12), mo = m % 12;
  return [y ? `${y}yr` : '', mo ? `${mo}mo` : ''].filter(Boolean).join(' ');
}

function RankPill({ entry }: { entry: RankEntry }) {
  return (
    <div className={cn(
      'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs',
      entry.isPresentRole ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50',
    )}>
      <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', entry.isPresentRole ? 'bg-emerald-500' : 'bg-slate-300')} />
      <span className={cn('font-semibold truncate max-w-[130px]', entry.isPresentRole ? 'text-emerald-800' : 'text-slate-700')}>
        {entry.rank}
      </span>
      {entry.durationMonths ? (
        <span className="shrink-0 text-slate-400">{monthsLabel(entry.durationMonths)}</span>
      ) : null}
    </div>
  );
}

interface CandidateCardProps {
  candidate: Candidate;
  index?: number;
}

export function CandidateCard({ candidate, index = 0 }: CandidateCardProps) {
  const [expanded, setExpanded] = useState(false);
  const topRanks    = (candidate.rankHistory ?? []).slice(0, 3);
  const extraRanks  = (candidate.rankHistory ?? []).length - 3;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className={cn(
        'rounded-2xl border bg-white overflow-hidden transition-shadow hover:shadow-md',
        candidate.duplicate ? 'border-amber-200' : 'border-slate-200',
      )}
    >
      {/* ── Header ── */}
      <div className="flex items-start gap-3 px-5 pt-5 pb-3">
        <div className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
          'bg-gradient-to-br text-white text-sm font-bold shadow-sm',
          getColor(candidate.name),
        )}>
          {getInitials(candidate.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="font-bold text-slate-900 text-sm leading-tight">{candidate.name || 'Unknown'}</p>
              {candidate.currentRank && (
                <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold text-primary-700 bg-primary-50 border border-primary-100 rounded-full px-2 py-0.5">
                  <Anchor className="h-2.5 w-2.5" />{candidate.currentRank}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {candidate.duplicate && (
                <Badge variant="duplicate">
                  <AlertCircle className="h-3 w-3 mr-1" />Duplicate
                </Badge>
              )}
              <Badge variant={candidate.reviewStatus === 'selected' ? 'success' : 'error'}>
                {candidate.reviewStatus}
              </Badge>
            </div>
          </div>

          {/* Contact */}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
            {candidate.email && (
              <span className="flex items-center gap-1 text-[11px] text-slate-500">
                <Mail className="h-3 w-3" />{candidate.email}
              </span>
            )}
            {candidate.phone && (
              <span className="flex items-center gap-1 text-[11px] text-slate-500">
                <Phone className="h-3 w-3" />{candidate.phone}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Sea service ── */}
      {candidate.totalSeaServiceMonths > 0 && (
        <div className="mx-5 flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-3">
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          Total sea service: <strong>{monthsLabel(candidate.totalSeaServiceMonths)}</strong>
        </div>
      )}

      {/* ── Top ranks ── */}
      {topRanks.length > 0 && (
        <div className="px-5 pb-3 flex flex-wrap gap-1.5">
          {topRanks.map((r, i) => <RankPill key={i} entry={r} />)}
          {extraRanks > 0 && !expanded && (
            <span className="flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-400 font-medium">
              +{extraRanks} more
            </span>
          )}
        </div>
      )}

      {/* ── Expanded detail ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 space-y-3">
              {/* All rank history */}
              {(candidate.rankHistory ?? []).slice(3).map((r, i) => (
                <RankPill key={i} entry={r} />
              ))}

              {/* Summary */}
              {candidate.summary && (
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <ClipboardList className="h-3 w-3" /> AI Summary
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">{candidate.summary}</p>
                </div>
              )}

              {/* Education */}
              {candidate.education && candidate.education !== 'Not specified' && (
                <div className="flex items-start gap-2">
                  <BookOpen className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-600">{candidate.education}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-2.5">
        <p className="text-[11px] text-slate-400">{formatDate(candidate.processedAt || candidate.createdAt)}</p>
        <div className="flex items-center gap-2">
          {candidate.cvAttachmentId && candidate.emailId && (
            <CVPreviewButton
              emailId={candidate.emailId}
              attachmentId={candidate.cvAttachmentId}
              fileName={candidate.cvFileName || 'CV'}
              variant="ghost"
            />
          )}
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {expanded ? 'Less' : 'More'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
