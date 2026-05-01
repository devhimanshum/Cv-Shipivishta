'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Zap, Mail, CheckCircle2, XCircle, Clock,
  AlertCircle, ChevronRight, Loader2, SkipForward,
  FileText, Users, RefreshCw, Anchor, Play,
} from 'lucide-react';
import { apiClient } from '@/lib/utils/api-client';
import { cn } from '@/lib/utils/helpers';
import type { PreviewEmail } from '@/app/api/emails/preview/route';

/* ── Types ── */
type Step = 'idle' | 'scanning' | 'confirm' | 'processing' | 'done';

interface EmailJobStatus {
  email: PreviewEmail;
  status: 'queued' | 'running' | 'success' | 'skipped' | 'error';
  message?: string;
  candidateId?: string;
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

/* ── Icon per status ── */
function StatusIcon({ status, size = 16 }: { status: EmailJobStatus['status']; size?: number }) {
  const s = size;
  if (status === 'running')  return <Loader2    style={{ width: s, height: s }} className="animate-spin text-blue-500" />;
  if (status === 'success')  return <CheckCircle2 style={{ width: s, height: s }} className="text-emerald-500" />;
  if (status === 'skipped')  return <SkipForward  style={{ width: s, height: s }} className="text-amber-400" />;
  if (status === 'error')    return <XCircle      style={{ width: s, height: s }} className="text-maritime-500" />;
  return <Clock style={{ width: s, height: s }} className="text-slate-300" />;
}

function statusLabel(s: EmailJobStatus['status']) {
  if (s === 'running') return 'Analysing…';
  if (s === 'success') return 'Added to Review';
  if (s === 'skipped') return 'Skipped';
  if (s === 'error')   return 'Error';
  return 'Queued';
}

function statusColor(s: EmailJobStatus['status']) {
  if (s === 'running') return 'text-blue-600  bg-blue-50  border-blue-100';
  if (s === 'success') return 'text-emerald-700 bg-emerald-50 border-emerald-100';
  if (s === 'skipped') return 'text-amber-600 bg-amber-50  border-amber-100';
  if (s === 'error')   return 'text-maritime-600 bg-maritime-50 border-maritime-100';
  return 'text-slate-400 bg-slate-50 border-slate-100';
}

/* ── Progress bar ── */
function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ background: 'linear-gradient(90deg,#2563eb,#60a5fa)' }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
    </div>
  );
}

/* ── Stat chip ── */
function Chip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={cn('flex flex-col items-center rounded-xl border px-4 py-2.5 text-center', color)}>
      <span className="text-xl font-bold leading-tight">{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70 mt-0.5">{label}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   Main Modal
══════════════════════════════════════════════════ */
interface Props {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;   // called when processing finishes (to refresh stats)
}

export function AIProcessModal({ open, onClose, onComplete }: Props) {
  const [step,     setStep]     = useState<Step>('idle');
  const [preview,  setPreview]  = useState<PreviewData | null>(null);
  const [jobs,     setJobs]     = useState<EmailJobStatus[]>([]);
  const [scanErr,  setScanErr]  = useState<string | null>(null);
  const abortRef = useRef(false);

  /* ── Counts derived from jobs ── */
  const done    = jobs.filter(j => j.status !== 'queued' && j.status !== 'running').length;
  const success = jobs.filter(j => j.status === 'success').length;
  const skipped = jobs.filter(j => j.status === 'skipped').length;
  const errors  = jobs.filter(j => j.status === 'error').length;
  const running = jobs.find(j => j.status === 'running');

  /* ── Step 1: Scan inbox ── */
  const handleScan = useCallback(async () => {
    setStep('scanning');
    setScanErr(null);
    setPreview(null);
    try {
      const res = await apiClient.get<{ success: boolean; data: PreviewData; error?: string }>(
        '/api/emails/preview'
      );
      if (!res.success) throw new Error(res.error || 'Scan failed');
      setPreview(res.data);
      setStep('confirm');
    } catch (err) {
      setScanErr(err instanceof Error ? err.message : 'Could not scan inbox');
      setStep('idle');
    }
  }, []);

  /* ── Step 2 → 3: Start processing ── */
  const handleStart = useCallback(async () => {
    if (!preview) return;
    abortRef.current = false;

    const pending = preview.emails.filter(e => !e.isProcessed);
    if (pending.length === 0) { setStep('done'); return; }

    // Initialise job queue
    const initialJobs: EmailJobStatus[] = pending.map(e => ({ email: e, status: 'queued' }));
    setJobs(initialJobs);
    setStep('processing');

    // Process one-by-one so we get live feedback
    for (let i = 0; i < pending.length; i++) {
      if (abortRef.current) break;

      const email = pending[i];

      // Mark as running
      setJobs(prev => prev.map((j, idx) =>
        idx === i ? { ...j, status: 'running' } : j
      ));

      try {
        const res = await apiClient.post<ProcessResult>(
          '/api/emails/process', { emailId: email.id }
        );
        const status = res.data?.status === 'success'
          ? 'success'
          : res.data?.status === 'skipped'
          ? 'skipped'
          : 'error';

        setJobs(prev => prev.map((j, idx) =>
          idx === i ? {
            ...j,
            status,
            message:     res.data?.message,
            candidateId: res.data?.candidateId,
          } : j
        ));
      } catch (err) {
        setJobs(prev => prev.map((j, idx) =>
          idx === i ? {
            ...j,
            status: 'error',
            message: err instanceof Error ? err.message : 'Processing failed',
          } : j
        ));
      }
    }

    setStep('done');
    onComplete?.();
  }, [preview, onComplete]);

  /* ── Reset & close ── */
  const handleClose = useCallback(() => {
    if (step === 'processing') {
      abortRef.current = true; // signal abort
    }
    setStep('idle');
    setPreview(null);
    setJobs([]);
    setScanErr(null);
    onClose();
  }, [step, onClose]);

  /* ── Re-scan ── */
  const handleRescan = useCallback(() => {
    setStep('idle');
    setPreview(null);
    setJobs([]);
    setScanErr(null);
    setTimeout(handleScan, 50);
  }, [handleScan]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="ai-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(4,14,30,0.7)', backdropFilter: 'blur(6px)' }}
        onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
      >
        <motion.div
          key="ai-modal-panel"
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 20 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="relative flex flex-col w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
          style={{ maxHeight: '90vh' }}
        >
          {/* ── Header ── */}
          <div className="relative flex items-center justify-between gap-3 px-6 py-4 shrink-0"
            style={{ background: 'linear-gradient(135deg, #040e1e 0%, #0d254a 100%)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>

            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent" />

            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: 'rgba(37,99,235,0.2)', border: '1px solid rgba(96,165,250,0.2)' }}>
                <Zap className="h-4.5 w-4.5 text-blue-300" style={{ width: 18, height: 18 }} />
              </div>
              <div>
                <p className="text-[15px] font-bold text-white" style={{ fontFamily: 'Georgia, serif' }}>
                  AI Process
                </p>
                <p className="text-[10px] text-blue-300/60 font-medium uppercase tracking-widest">
                  Maritime CV Analyser
                </p>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto">

            {/* ══ IDLE ══ */}
            {step === 'idle' && (
              <div className="flex flex-col items-center justify-center gap-6 px-8 py-14 text-center">
                <div className="relative">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl"
                    style={{ background: 'linear-gradient(135deg,#eff6ff,#dbeafe)' }}>
                    <Mail className="h-10 w-10 text-primary-400" />
                  </div>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                    className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary-600"
                  >
                    <Zap className="h-3.5 w-3.5 text-white" />
                  </motion.div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-900">Scan & Analyse CVs</h3>
                  <p className="mt-2 text-sm text-slate-500 max-w-sm">
                    Scan your Outlook inbox for new CV emails, preview what's ready, then let AI extract maritime rank history and sea service data.
                  </p>
                </div>

                {scanErr && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-maritime-100 bg-maritime-50 px-4 py-3 text-sm text-maritime-700 text-left w-full">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Scan Failed</p>
                      <p className="text-xs mt-0.5 opacity-80">{scanErr}</p>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2 w-full max-w-xs">
                  <button
                    onClick={handleScan}
                    className="flex items-center justify-center gap-2.5 rounded-xl py-3 text-sm font-semibold text-white transition-all"
                    style={{ background: 'linear-gradient(135deg,#1e40af,#2563eb)', boxShadow: '0 4px 14px rgba(37,99,235,0.4)' }}
                  >
                    <Mail className="h-4 w-4" />
                    Scan Inbox
                    <ChevronRight className="h-4 w-4 opacity-60" />
                  </button>
                  <p className="text-[11px] text-slate-400 text-center">
                    Only emails with attachments are checked
                  </p>
                </div>
              </div>
            )}

            {/* ══ SCANNING ══ */}
            {step === 'scanning' && (
              <div className="flex flex-col items-center justify-center gap-6 px-8 py-14 text-center">
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
                  <p className="mt-1 text-sm text-slate-400">Fetching emails with attachments and checking processed status</p>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-blue-50 border border-blue-100 px-4 py-2 text-xs font-medium text-blue-600">
                  <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                    <Anchor className="h-3.5 w-3.5" />
                  </motion.div>
                  Connecting to Outlook via Microsoft Graph…
                </div>
              </div>
            )}

            {/* ══ CONFIRM ══ */}
            {step === 'confirm' && preview && (
              <div className="flex flex-col gap-0">

                {/* Summary bar */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-surface-50">
                  <Chip label="Total Emails" value={preview.totalCount}     color="text-slate-700 bg-white border-slate-200" />
                  <Chip label="New to Process" value={preview.pendingCount}  color="text-primary-700 bg-primary-50 border-primary-100" />
                  <Chip label="Already Done"  value={preview.processedCount} color="text-emerald-700 bg-emerald-50 border-emerald-100" />

                  <button
                    onClick={handleRescan}
                    className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                  >
                    <RefreshCw className="h-3 w-3" /> Rescan
                  </button>
                </div>

                {/* Email list */}
                <div className="divide-y divide-slate-50 overflow-y-auto" style={{ maxHeight: 340 }}>
                  {preview.emails.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                      <Users className="h-10 w-10 text-slate-200" />
                      <p className="text-sm text-slate-400">No emails with attachments found in inbox</p>
                    </div>
                  ) : (
                    preview.emails.map(email => (
                      <div key={email.id} className={cn(
                        'flex items-center gap-3 px-6 py-3.5 transition-colors',
                        email.isProcessed ? 'bg-slate-50/60' : 'hover:bg-blue-50/40',
                      )}>
                        <div className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                          email.isProcessed ? 'bg-emerald-50' : 'bg-blue-50',
                        )}>
                          <FileText className={cn('h-4 w-4', email.isProcessed ? 'text-emerald-400' : 'text-blue-400')} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'text-[13px] font-semibold truncate',
                            email.isProcessed ? 'text-slate-400' : 'text-slate-800',
                          )}>
                            {email.subject}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {email.senderName || email.senderEmail}
                            {email.senderName && ` · ${email.senderEmail}`}
                          </p>
                        </div>

                        <span className={cn(
                          'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                          email.isProcessed
                            ? 'text-emerald-600 bg-emerald-50 border-emerald-100'
                            : 'text-primary-600 bg-primary-50 border-primary-100',
                        )}>
                          {email.isProcessed ? 'Done' : 'New'}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* CTA */}
                {preview.pendingCount === 0 && (
                  <div className="flex items-center gap-2 mx-6 my-4 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    All emails already processed — inbox is up to date!
                  </div>
                )}
              </div>
            )}

            {/* ══ PROCESSING ══ */}
            {step === 'processing' && (
              <div className="flex flex-col gap-0">

                {/* Progress header */}
                <div className="px-6 py-4 border-b border-slate-100 bg-surface-50">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-[13px] font-bold text-slate-800">
                        Processing {done} of {jobs.length}
                      </p>
                      {running && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5 max-w-xs">
                          {running.email.subject}
                        </p>
                      )}
                    </div>
                    <span className="text-sm font-bold text-primary-600">
                      {jobs.length > 0 ? Math.round((done / jobs.length) * 100) : 0}%
                    </span>
                  </div>
                  <ProgressBar value={done} max={jobs.length} />

                  <div className="flex gap-3 mt-3">
                    <Chip label="Done"    value={success} color="text-emerald-700 bg-emerald-50 border-emerald-100" />
                    <Chip label="Skipped" value={skipped} color="text-amber-600 bg-amber-50 border-amber-100" />
                    <Chip label="Errors"  value={errors}  color="text-maritime-600 bg-maritime-50 border-maritime-100" />
                  </div>
                </div>

                {/* Live log */}
                <div className="divide-y divide-slate-50 overflow-y-auto" style={{ maxHeight: 320 }}>
                  {jobs.map((job, idx) => (
                    <motion.div
                      key={job.email.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className={cn(
                        'flex items-center gap-3 px-6 py-3 transition-colors',
                        job.status === 'running' ? 'bg-blue-50/60' : '',
                      )}
                    >
                      <StatusIcon status={job.status} size={16} />

                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-[13px] font-semibold truncate',
                          job.status === 'queued' ? 'text-slate-300' : 'text-slate-800',
                        )}>
                          {job.email.subject}
                        </p>
                        {job.message && (
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">{job.message}</p>
                        )}
                      </div>

                      <span className={cn(
                        'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                        statusColor(job.status),
                      )}>
                        {statusLabel(job.status)}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* ══ DONE ══ */}
            {step === 'done' && (
              <div className="flex flex-col items-center gap-6 px-8 py-10 text-center">
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 18 }}
                  className="flex h-20 w-20 items-center justify-center rounded-2xl"
                  style={{ background: 'linear-gradient(135deg,#d1fae5,#a7f3d0)' }}
                >
                  <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                </motion.div>

                <div>
                  <h3 className="text-lg font-bold text-slate-900">Processing Complete</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    All CVs have been analysed and are ready for your review.
                  </p>
                </div>

                {/* Final summary chips */}
                <div className="flex gap-3 flex-wrap justify-center">
                  <Chip label="Added to Review" value={success} color="text-emerald-700 bg-emerald-50 border-emerald-100" />
                  <Chip label="Skipped"         value={skipped} color="text-amber-600 bg-amber-50 border-amber-100" />
                  <Chip label="Errors"          value={errors}  color="text-maritime-600 bg-maritime-50 border-maritime-100" />
                </div>

                {success > 0 && (
                  <div className="flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-primary-700 font-medium">
                    <Users className="h-4 w-4 shrink-0" />
                    {success} new candidate{success > 1 ? 's' : ''} added to the Review queue
                  </div>
                )}

                {/* Per-email result log collapsed */}
                {jobs.length > 0 && (
                  <details className="w-full text-left">
                    <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600 font-medium select-none">
                      View detailed log ({jobs.length} emails)
                    </summary>
                    <div className="mt-2 rounded-xl border border-slate-100 divide-y divide-slate-50 overflow-hidden">
                      {jobs.map(job => (
                        <div key={job.email.id} className="flex items-center gap-3 px-4 py-2.5">
                          <StatusIcon status={job.status} size={14} />
                          <span className="flex-1 text-xs text-slate-700 truncate">{job.email.subject}</span>
                          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', statusColor(job.status))}>
                            {statusLabel(job.status)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>

          {/* ── Footer actions ── */}
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 shrink-0 bg-surface-50">
            <button
              onClick={handleClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              {step === 'done' ? 'Close' : 'Cancel'}
            </button>

            <div className="flex items-center gap-2">
              {/* Idle → Scan */}
              {step === 'idle' && (
                <button
                  onClick={handleScan}
                  className="flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white transition-all"
                  style={{ background: 'linear-gradient(135deg,#1e40af,#2563eb)', boxShadow: '0 4px 14px rgba(37,99,235,0.35)' }}
                >
                  <Mail className="h-4 w-4" /> Scan Inbox
                </button>
              )}

              {/* Confirm → Start */}
              {step === 'confirm' && preview && preview.pendingCount > 0 && (
                <button
                  onClick={handleStart}
                  className="flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white transition-all"
                  style={{ background: 'linear-gradient(135deg,#1e40af,#2563eb)', boxShadow: '0 4px 14px rgba(37,99,235,0.35)' }}
                >
                  <Play className="h-4 w-4" />
                  Start Processing {preview.pendingCount} CV{preview.pendingCount > 1 ? 's' : ''}
                </button>
              )}

              {/* Processing — cancel */}
              {step === 'processing' && (
                <button
                  onClick={() => { abortRef.current = true; }}
                  className="flex items-center gap-2 rounded-xl border border-maritime-200 bg-maritime-50 px-4 py-2 text-sm font-semibold text-maritime-600 hover:bg-maritime-100 transition-colors"
                >
                  Stop Processing
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
