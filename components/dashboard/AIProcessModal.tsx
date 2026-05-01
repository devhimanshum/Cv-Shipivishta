'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Zap, Mail, CheckCircle2, XCircle, Clock,
  Loader2, SkipForward, FileText, Users, RefreshCw,
  CheckSquare, Square, Play, AlertCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/utils/api-client';
import { cn } from '@/lib/utils/helpers';
import type { PreviewEmail } from '@/app/api/emails/preview/route';

/* ── localStorage key for last-sync time ── */
const LAST_SYNC_KEY = 'shipivishta_last_sync';

function saveLastSync() {
  try { localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString()); } catch { /* noop */ }
}
function getLastSync(): string | null {
  try { return localStorage.getItem(LAST_SYNC_KEY); } catch { return null; }
}
function formatSync(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1)  return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return `${diffH}h ago`;
  return d.toLocaleDateString();
}

/* ── Types ── */
type Step = 'scanning' | 'confirm' | 'processing' | 'done' | 'error';

interface EmailJobStatus {
  email: PreviewEmail;
  status: 'queued' | 'running' | 'success' | 'skipped' | 'error';
  message?: string;
}

interface PreviewData {
  emails: PreviewEmail[];
  pendingCount: number;
  processedCount: number;
  totalCount: number;
}

interface ProcessResult {
  success: boolean;
  data?: { status: string; message?: string; candidateId?: string };
  error?: string;
}

/* ── Status icon ── */
function StatusIcon({ status }: { status: EmailJobStatus['status'] }) {
  if (status === 'running')  return <Loader2      className="h-4 w-4 animate-spin text-blue-500 shrink-0" />;
  if (status === 'success')  return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
  if (status === 'skipped')  return <SkipForward  className="h-4 w-4 text-amber-400 shrink-0" />;
  if (status === 'error')    return <XCircle      className="h-4 w-4 text-red-400 shrink-0" />;
  return <Clock className="h-4 w-4 text-slate-300 shrink-0" />;
}

function statusBadge(s: EmailJobStatus['status']) {
  if (s === 'running') return 'text-blue-600 bg-blue-50 border-blue-100';
  if (s === 'success') return 'text-emerald-700 bg-emerald-50 border-emerald-100';
  if (s === 'skipped') return 'text-amber-600 bg-amber-50 border-amber-100';
  if (s === 'error')   return 'text-red-600 bg-red-50 border-red-100';
  return 'text-slate-400 bg-slate-50 border-slate-100';
}

function statusText(s: EmailJobStatus['status']) {
  if (s === 'running') return 'Analysing…';
  if (s === 'success') return 'Added to Review';
  if (s === 'skipped') return 'Already Done';
  if (s === 'error')   return 'Error';
  return 'Queued';
}

/* ── Progress bar ── */
function ProgressBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={cn('relative h-2 w-full overflow-hidden rounded-full bg-slate-100', className)}>
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ background: 'linear-gradient(90deg,#1e40af,#3b82f6,#60a5fa)' }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      />
    </div>
  );
}

/* ── Stat pill ── */
function Pill({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className={cn('flex items-center gap-2 rounded-xl border px-3 py-2', color)}>
      <span className="text-lg font-bold leading-none">{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{label}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   Main Modal
══════════════════════════════════════════════════ */
interface Props {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export function AIProcessModal({ open, onClose, onComplete }: Props) {
  const [step,        setStep]        = useState<Step>('scanning');
  const [preview,     setPreview]     = useState<PreviewData | null>(null);
  const [jobs,        setJobs]        = useState<EmailJobStatus[]>([]);
  const [scanErr,     setScanErr]     = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSync,    setLastSync]    = useState<string | null>(null);
  const abortRef = useRef(false);

  /* ── Derived counts ── */
  const done    = jobs.filter(j => j.status !== 'queued' && j.status !== 'running').length;
  const success = jobs.filter(j => j.status === 'success').length;
  const skipped = jobs.filter(j => j.status === 'skipped').length;
  const errors  = jobs.filter(j => j.status === 'error').length;
  const running = jobs.find(j => j.status === 'running');

  /* ── Auto-scan whenever modal opens ── */
  const handleScan = useCallback(async () => {
    setStep('scanning');
    setScanErr(null);
    setPreview(null);
    setJobs([]);
    setSelectedIds(new Set());
    try {
      const res = await apiClient.get<{ success: boolean; data: PreviewData; error?: string }>(
        '/api/emails/preview'
      );
      if (!res.success) throw new Error((res as { error?: string }).error || 'Scan failed');
      setPreview(res.data);
      // Pre-select ALL unprocessed emails by default
      const newIds = new Set(res.data.emails.filter(e => !e.isProcessed).map(e => e.id));
      setSelectedIds(newIds);
      saveLastSync();
      setLastSync(new Date().toISOString());
      setStep('confirm');
    } catch (err) {
      setScanErr(err instanceof Error ? err.message : 'Could not scan inbox');
      setStep('error');
    }
  }, []);

  useEffect(() => {
    if (open) {
      setLastSync(getLastSync());
      handleScan();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* ── Start processing selected emails ── */
  const handleStart = useCallback(async () => {
    if (!preview) return;
    abortRef.current = false;

    const toProcess = preview.emails.filter(e => !e.isProcessed && selectedIds.has(e.id));
    if (toProcess.length === 0) { setStep('done'); return; }

    const initialJobs: EmailJobStatus[] = toProcess.map(e => ({ email: e, status: 'queued' }));
    setJobs(initialJobs);
    setStep('processing');

    for (let i = 0; i < toProcess.length; i++) {
      if (abortRef.current) break;
      const email = toProcess[i];

      setJobs(prev => prev.map((j, idx) => idx === i ? { ...j, status: 'running' } : j));

      try {
        const res = await apiClient.post<ProcessResult>('/api/emails/process', { emailId: email.id });
        const status = res.data?.status === 'success' ? 'success'
          : res.data?.status === 'skipped' ? 'skipped' : 'error';
        setJobs(prev => prev.map((j, idx) =>
          idx === i ? { ...j, status, message: res.data?.message } : j
        ));
      } catch (err) {
        setJobs(prev => prev.map((j, idx) =>
          idx === i ? { ...j, status: 'error', message: err instanceof Error ? err.message : 'Failed' } : j
        ));
      }
    }

    setStep('done');
    onComplete?.();
  }, [preview, selectedIds, onComplete]);

  /* ── Close / reset ── */
  const handleClose = useCallback(() => {
    if (step === 'processing') abortRef.current = true;
    setStep('scanning');
    setPreview(null);
    setJobs([]);
    setScanErr(null);
    setSelectedIds(new Set());
    onClose();
  }, [step, onClose]);

  /* ── Toggle helpers ── */
  const toggleEmail = (id: string) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () => {
    if (!preview) return;
    const newEmails = preview.emails.filter(e => !e.isProcessed);
    if (selectedIds.size === newEmails.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(newEmails.map(e => e.id)));
  };

  if (!open) return null;

  const newEmails       = preview?.emails.filter(e => !e.isProcessed) ?? [];
  const doneEmails      = preview?.emails.filter(e =>  e.isProcessed) ?? [];
  const allNewSelected  = newEmails.length > 0 && selectedIds.size === newEmails.length;
  const pct             = jobs.length > 0 ? Math.round((done / jobs.length) * 100) : 0;

  return (
    <AnimatePresence>
      <motion.div
        key="ai-modal-bg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(4,14,30,0.72)', backdropFilter: 'blur(6px)' }}
        onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
      >
        <motion.div
          key="ai-modal-panel"
          initial={{ opacity: 0, scale: 0.96, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 18 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="relative flex flex-col w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
          style={{ maxHeight: '92vh' }}
        >

          {/* ══ HEADER ══ */}
          <div
            className="relative flex items-center justify-between gap-3 px-6 py-4 shrink-0"
            style={{ background: 'linear-gradient(135deg,#040e1e 0%,#0d254a 100%)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent" />

            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ background: 'rgba(37,99,235,0.2)', border: '1px solid rgba(96,165,250,0.2)' }}>
                <Zap className="h-[18px] w-[18px] text-blue-300" />
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-white truncate" style={{ fontFamily: 'Georgia, serif' }}>
                  AI Process
                </p>
                <p className="text-[10px] text-blue-300/60 font-medium uppercase tracking-widest truncate">
                  Maritime CV Analyser
                  {lastSync && (
                    <span className="ml-2 normal-case tracking-normal">
                      · Last sync {formatSync(lastSync)}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Re-scan button (shown on confirm / error) */}
              {(step === 'confirm' || step === 'error') && (
                <button
                  onClick={handleScan}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-blue-300/70 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <RefreshCw className="h-3 w-3" /> Rescan
                </button>
              )}
              <button
                onClick={handleClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ══ BODY ══ */}
          <div className="flex-1 overflow-y-auto min-h-0">

            {/* ── SCANNING ── */}
            {step === 'scanning' && (
              <div className="flex flex-col items-center justify-center gap-5 px-8 py-16 text-center">
                <div className="relative flex h-20 w-20 items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
                  <motion.div
                    className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary-500"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                  <Mail className="h-8 w-8 text-primary-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Scanning Inbox…</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Fetching emails with attachments · checking processed status
                  </p>
                </div>
                <motion.div
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                  className="flex items-center gap-2 rounded-full bg-blue-50 border border-blue-100 px-4 py-2 text-xs font-medium text-blue-600"
                >
                  <Zap className="h-3.5 w-3.5" />
                  Connecting to Outlook via Microsoft Graph…
                </motion.div>
              </div>
            )}

            {/* ── ERROR ── */}
            {step === 'error' && (
              <div className="flex flex-col items-center justify-center gap-4 px-8 py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
                  <AlertCircle className="h-8 w-8 text-red-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Scan Failed</h3>
                  <p className="mt-1 text-sm text-slate-500 max-w-sm">{scanErr}</p>
                </div>
                <button
                  onClick={handleScan}
                  className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg,#1e40af,#2563eb)', boxShadow: '0 4px 14px rgba(37,99,235,0.35)' }}
                >
                  <RefreshCw className="h-4 w-4" /> Try Again
                </button>
              </div>
            )}

            {/* ── CONFIRM ── */}
            {step === 'confirm' && preview && (
              <div className="flex flex-col">

                {/* ── Summary bar ── */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-surface-50 flex-wrap">
                  <Pill label="Total Emails"    value={preview.totalCount}     color="text-slate-700 bg-white border-slate-200" />
                  <Pill label="New"             value={preview.pendingCount}   color="text-primary-700 bg-primary-50 border-primary-100" />
                  <Pill label="Already Done"    value={preview.processedCount} color="text-emerald-700 bg-emerald-50 border-emerald-100" />
                  <Pill label="Selected"        value={selectedIds.size}       color="text-indigo-700 bg-indigo-50 border-indigo-100" />
                </div>

                {/* ── Select-all toolbar ── */}
                {newEmails.length > 0 && (
                  <div className="flex items-center gap-3 px-6 py-2.5 border-b border-slate-100 bg-slate-50/60">
                    <button onClick={toggleAll} className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors">
                      {allNewSelected
                        ? <CheckSquare className="h-4 w-4 text-primary-500" />
                        : <Square      className="h-4 w-4 text-slate-300" />}
                      {allNewSelected ? 'Deselect All' : 'Select All New'}
                    </button>
                    <span className="text-[11px] text-slate-400">
                      {selectedIds.size} of {newEmails.length} new emails selected for processing
                    </span>
                  </div>
                )}

                {/* ── Email list ── */}
                <div className="divide-y divide-slate-50 overflow-y-auto" style={{ maxHeight: 340 }}>
                  {preview.emails.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                      <Users className="h-10 w-10 text-slate-200" />
                      <p className="text-sm text-slate-400">No emails with attachments found in inbox</p>
                    </div>
                  ) : (
                    <>
                      {/* New (unprocessed) emails first */}
                      {newEmails.map(email => {
                        const sel = selectedIds.has(email.id);
                        return (
                          <button
                            key={email.id}
                            onClick={() => toggleEmail(email.id)}
                            className={cn(
                              'flex items-center gap-3 px-6 py-3.5 w-full text-left transition-colors',
                              sel ? 'bg-primary-50/60 hover:bg-primary-50' : 'hover:bg-slate-50',
                            )}
                          >
                            {sel
                              ? <CheckSquare className="h-4 w-4 text-primary-500 shrink-0" />
                              : <Square      className="h-4 w-4 text-slate-300 shrink-0" />}
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                              <FileText className="h-4 w-4 text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <p className="text-[13px] font-semibold text-slate-800 truncate">{email.subject}</p>
                              <p className="text-[11px] text-slate-400 truncate">
                                {email.senderName || email.senderEmail}
                                {email.senderName && email.senderEmail ? ` · ${email.senderEmail}` : ''}
                              </p>
                            </div>
                            <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold text-primary-600 bg-primary-50 border-primary-100">
                              New
                            </span>
                          </button>
                        );
                      })}

                      {/* Already processed emails (dimmed, not clickable) */}
                      {doneEmails.map(email => (
                        <div key={email.id} className="flex items-center gap-3 px-6 py-3 opacity-40">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                            <FileText className="h-4 w-4 text-emerald-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-slate-500 truncate">{email.subject}</p>
                            <p className="text-[11px] text-slate-400 truncate">{email.senderName || email.senderEmail}</p>
                          </div>
                          <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 border-emerald-100">
                            Done
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {/* All-done notice */}
                {preview.pendingCount === 0 && (
                  <div className="flex items-center gap-2 mx-6 my-4 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700 font-medium">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    All emails already processed — inbox is fully up to date!
                  </div>
                )}
              </div>
            )}

            {/* ── PROCESSING ── */}
            {step === 'processing' && (
              <div className="flex flex-col">

                {/* Progress header */}
                <div className="px-6 py-5 border-b border-slate-100 bg-surface-50 space-y-3">
                  {/* Percentage + count */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        Processing CVs — {done} of {jobs.length} complete
                      </p>
                      {running && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5 max-w-xs">
                          Now: {running.email.subject}
                        </p>
                      )}
                    </div>
                    <span className="text-2xl font-bold text-primary-600">{pct}%</span>
                  </div>

                  {/* Progress bar */}
                  <ProgressBar value={done} max={jobs.length} />

                  {/* Stats row */}
                  <div className="flex gap-2 flex-wrap">
                    <Pill label="Added"   value={success} color="text-emerald-700 bg-emerald-50 border-emerald-100" />
                    <Pill label="Skipped" value={skipped} color="text-amber-600 bg-amber-50 border-amber-100" />
                    <Pill label="Errors"  value={errors}  color="text-red-600 bg-red-50 border-red-100" />
                    <Pill label="Queued"  value={jobs.length - done} color="text-slate-500 bg-slate-50 border-slate-200" />
                  </div>
                </div>

                {/* Live log */}
                <div className="divide-y divide-slate-50 overflow-y-auto" style={{ maxHeight: 300 }}>
                  {jobs.map((job, idx) => (
                    <motion.div
                      key={job.email.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className={cn(
                        'flex items-center gap-3 px-6 py-3',
                        job.status === 'running' ? 'bg-blue-50/60' : '',
                        job.status === 'queued'  ? 'opacity-40'   : '',
                      )}
                    >
                      <StatusIcon status={job.status} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-slate-800 truncate">{job.email.subject}</p>
                        {job.message && (
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">{job.message}</p>
                        )}
                      </div>
                      <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold', statusBadge(job.status))}>
                        {statusText(job.status)}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* ── DONE ── */}
            {step === 'done' && (
              <div className="flex flex-col items-center gap-6 px-8 py-10 text-center">
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                  className="flex h-20 w-20 items-center justify-center rounded-2xl"
                  style={{ background: 'linear-gradient(135deg,#d1fae5,#a7f3d0)' }}
                >
                  <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                </motion.div>

                <div>
                  <h3 className="text-lg font-bold text-slate-900">Processing Complete</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    All selected CVs have been analysed and are ready for review.
                  </p>
                </div>

                <div className="flex gap-3 flex-wrap justify-center">
                  <Pill label="Added to Review" value={success} color="text-emerald-700 bg-emerald-50 border-emerald-100" />
                  <Pill label="Skipped"         value={skipped} color="text-amber-600 bg-amber-50 border-amber-100" />
                  <Pill label="Errors"          value={errors}  color="text-red-600 bg-red-50 border-red-100" />
                </div>

                {success > 0 && (
                  <div className="flex items-center gap-2 rounded-xl bg-primary-50 border border-primary-100 px-4 py-3 text-sm text-primary-700 font-medium">
                    <Users className="h-4 w-4 shrink-0" />
                    {success} new candidate{success > 1 ? 's' : ''} added to the Review queue
                  </div>
                )}

                {/* Detailed log */}
                {jobs.length > 0 && (
                  <details className="w-full text-left">
                    <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600 font-medium select-none">
                      View full log ({jobs.length} emails)
                    </summary>
                    <div className="mt-2 rounded-xl border border-slate-100 divide-y divide-slate-50 overflow-hidden">
                      {jobs.map(job => (
                        <div key={job.email.id} className="flex items-center gap-3 px-4 py-2.5">
                          <StatusIcon status={job.status} />
                          <span className="flex-1 text-xs text-slate-700 truncate">{job.email.subject}</span>
                          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', statusBadge(job.status))}>
                            {statusText(job.status)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>

          {/* ══ FOOTER ══ */}
          <div
            className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 shrink-0 bg-surface-50"
          >
            <button
              onClick={handleClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              {step === 'done' ? 'Close' : 'Cancel'}
            </button>

            <div className="flex items-center gap-2">
              {/* Confirm → Start */}
              {step === 'confirm' && selectedIds.size > 0 && (
                <button
                  onClick={handleStart}
                  className="flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white transition-all"
                  style={{ background: 'linear-gradient(135deg,#1e40af,#2563eb)', boxShadow: '0 4px 14px rgba(37,99,235,0.35)' }}
                >
                  <Play className="h-4 w-4" />
                  Process {selectedIds.size} CV{selectedIds.size > 1 ? 's' : ''}
                </button>
              )}

              {/* Processing → Stop */}
              {step === 'processing' && (
                <button
                  onClick={() => { abortRef.current = true; }}
                  className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors"
                >
                  Stop
                </button>
              )}

              {/* Done → Go to Review */}
              {step === 'done' && success > 0 && (
                <a
                  href="/dashboard/review"
                  className="flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white transition-all"
                  style={{ background: 'linear-gradient(135deg,#065f46,#059669)', boxShadow: '0 4px 14px rgba(5,150,105,0.35)' }}
                >
                  <Users className="h-4 w-4" /> Go to Review
                </a>
              )}
            </div>
          </div>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
