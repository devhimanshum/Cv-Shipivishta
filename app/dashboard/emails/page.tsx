'use client';


import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { EmailList } from '@/components/emails/EmailList';
import { Badge } from '@/components/ui/Badge';
import { useEmails } from '@/hooks/useEmails';
import { formatDate, timeAgo } from '@/lib/utils/helpers';
import type { ProcessedEmail } from '@/types';

type Tab = 'inbox' | 'processed';

function ProcessedEmailRow({ email, index }: { email: ProcessedEmail; index: number }) {
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.03 }}
      className="hover:bg-slate-50 transition-colors"
    >
      <td className="px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-900 truncate max-w-[200px]">{email.subject}</p>
          <p className="text-xs text-slate-500">{email.senderName}</p>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">{email.senderEmail}</td>
      <td className="px-4 py-3">
        <Badge
          variant={
            email.status === 'processed' ? 'success' :
            email.status === 'skipped' ? 'warning' : 'error'
          }
        >
          {email.status === 'processed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
          {email.status === 'skipped' && <Clock className="h-3 w-3 mr-1" />}
          {email.status === 'error' && <AlertTriangle className="h-3 w-3 mr-1" />}
          {email.status}
        </Badge>
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">
        {email.attachmentName || '—'}
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">
        {timeAgo(email.processedAt)}
      </td>
    </motion.tr>
  );
}

export default function EmailsPage() {
  const [tab, setTab] = useState<Tab>('inbox');
  const {
    emails, processedEmails, loading, processing,
    fetchEmails, processAll, processSingle,
  } = useEmails();

  const pendingCount = emails.filter(e => !e.processed).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Emails" subtitle="Outlook inbox and processed emails" />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl p-6 space-y-5">

          {/* Tab bar */}
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1 w-fit">
            {[
              { id: 'inbox' as Tab, label: 'Inbox', count: emails.length },
              { id: 'processed' as Tab, label: 'Processed', count: processedEmails.length },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${
                  tab === t.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
                <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                  tab === t.id ? 'bg-primary-100 text-primary-700' : 'bg-slate-200 text-slate-500'
                }`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {/* Pending badge */}
          {tab === 'inbox' && pendingCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
              <Clock className="h-4 w-4 text-amber-600" />
              <p className="text-sm text-amber-700">
                <strong>{pendingCount}</strong> unprocessed email{pendingCount !== 1 ? 's' : ''} waiting
              </p>
            </div>
          )}

          {/* Content */}
          {loading ? (
            <div className="space-y-3">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-200" />
              ))}
            </div>
          ) : tab === 'inbox' ? (
            <EmailList
              emails={emails}
              processing={processing}
              onProcessSingle={processSingle}
              onProcessAll={processAll}
            />
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              {processedEmails.length === 0 ? (
                <div className="py-12 text-center">
                  <Mail className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No processed emails yet</p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Sender</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">CV File</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Processed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {processedEmails.map((email, i) => (
                      <ProcessedEmailRow key={email.id} email={email} index={i} />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
