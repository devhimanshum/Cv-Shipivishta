'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, X, Download, AlertCircle, ExternalLink } from 'lucide-react';
import { apiClient } from '@/lib/utils/api-client';
import { cn } from '@/lib/utils/helpers';

interface Props {
  emailId: string;
  attachmentId: string;
  fileName: string;
  /** button appearance */
  variant?: 'default' | 'ghost';
}

interface AttachmentData {
  base64: string;
  contentType: string;
  name: string;
}

export function CVPreviewButton({ emailId, attachmentId, fileName, variant = 'default' }: Props) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [data,    setData]    = useState<AttachmentData | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  async function handleOpen() {
    setOpen(true);
    if (data) return; // already loaded in memory

    // Check sessionStorage cache first
    const cacheKey = `cv_attachment_${attachmentId}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setData(JSON.parse(cached));
        return;
      }
    } catch { /* sessionStorage unavailable */ }

    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post<{ success: boolean; data: AttachmentData }>(
        '/api/emails/attachment', { emailId, attachmentId }
      );
      setData(res.data);
      // Cache in sessionStorage (survives page navigation, cleared on tab close)
      try { sessionStorage.setItem(cacheKey, JSON.stringify(res.data)); } catch { /* quota exceeded */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load CV');
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (!data) return;
    const a = document.createElement('a');
    a.href = `data:${data.contentType};base64,${data.base64}`;
    a.download = data.name || fileName;
    a.click();
  }

  const dataUrl = data ? `data:${data.contentType};base64,${data.base64}` : null;
  const isPdf   = data?.contentType === 'application/pdf';
  const isImage = data?.contentType.startsWith('image/');

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={handleOpen}
        className={cn(
          'flex items-center gap-1.5 rounded-xl text-xs font-semibold transition-all',
          variant === 'default'
            ? 'border border-primary-200 bg-primary-50 px-3 py-1.5 text-primary-700 hover:bg-primary-100'
            : 'text-primary-600 hover:underline',
        )}
      >
        <FileText className="h-3.5 w-3.5" />
        View CV
        <ExternalLink className="h-3 w-3 opacity-60" />
      </button>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
              style={{ width: '90vw', maxWidth: 900, height: '90vh' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="h-5 w-5 text-primary-500 shrink-0" />
                  <p className="text-sm font-semibold text-slate-900 truncate">{fileName}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {dataUrl && (
                    <button
                      onClick={handleDownload}
                      className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" /> Download
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-hidden bg-slate-50 flex items-center justify-center">
                {loading ? (
                  <div className="flex flex-col items-center gap-3 text-slate-400">
                    <div className="h-10 w-10 rounded-full border-4 border-slate-200 border-t-primary-500 animate-spin" />
                    <p className="text-sm">Loading CV…</p>
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center gap-3 text-center px-8">
                    <AlertCircle className="h-10 w-10 text-red-400" />
                    <p className="text-sm font-medium text-slate-600">Could not load CV</p>
                    <p className="text-xs text-slate-400 max-w-sm">{error}</p>
                    <p className="text-xs text-slate-400">The email or attachment may have been deleted from Outlook.</p>
                  </div>
                ) : isPdf ? (
                  <iframe
                    src={dataUrl!}
                    className="h-full w-full border-0"
                    title={fileName}
                  />
                ) : isImage ? (
                  <img
                    src={dataUrl!}
                    alt={fileName}
                    className="max-h-full max-w-full object-contain p-4"
                  />
                ) : dataUrl ? (
                  /* DOCX / other — show download prompt */
                  <div className="flex flex-col items-center gap-4 text-center px-8">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-50">
                      <FileText className="h-10 w-10 text-primary-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{fileName}</p>
                      <p className="text-xs text-slate-400 mt-1">This file type cannot be previewed in the browser.</p>
                    </div>
                    <button
                      onClick={handleDownload}
                      className="flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
                    >
                      <Download className="h-4 w-4" /> Download to view
                    </button>
                  </div>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
