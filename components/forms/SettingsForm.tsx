'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail, BrainCircuit, CheckCircle, XCircle, RefreshCw, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TokenUsagePanel } from '@/components/settings/TokenUsagePanel';
import { apiClient } from '@/lib/utils/api-client';
import { cn } from '@/lib/utils/helpers';
import toast from 'react-hot-toast';

interface SettingsData {
  outlook: {
    configured: boolean;
    inboxEmail: string;
    clientId: string;
    missingVars?: string[];
  };
  openai: {
    configured: boolean;
    model: string;
    missingVars?: string[];
  };
  // legacy alias — API may return either key
  gemini?: {
    configured: boolean;
    model: string;
  };
}

type Tab = 'connections' | 'usage';

export function SettingsForm() {
  const [data,    setData]    = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [tab,     setTab]     = useState<Tab>('connections');

  useEffect(() => {
    apiClient
      .get<{ success: boolean; data: SettingsData }>('/api/settings')
      .then(res => setData(res.data))
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const testOutlook = async () => {
    setTesting(true);
    try {
      const res = await apiClient.post<{ success: boolean; message: string }>(
        '/api/settings', { type: 'test_outlook' },
      );
      if (res.success) toast.success(res.message);
      else toast.error(res.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  // Support both old (gemini) and new (openai) API response shapes
  const openaiData     = data?.openai ?? (data?.gemini ? { ...data.gemini, missingVars: [] } : null);
  const openaiOk       = openaiData?.configured ?? false;
  const outlookOk      = data?.outlook.configured ?? false;

  return (
    <div className="space-y-5">
      {/* Tab switcher */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 w-fit">
        {([
          { key: 'connections', label: 'Connections' },
          { key: 'usage',       label: 'Token Usage', icon: <Zap className="h-3.5 w-3.5" /> },
        ] as { key: Tab; label: string; icon?: React.ReactNode }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all',
              tab === t.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── Connections tab ── */}
      {tab === 'connections' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

          {loading ? (
            <div className="space-y-4">
              {[1, 2].map(i => <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-100" />)}
            </div>
          ) : (
            <>
              {/* Outlook */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                      <Mail className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Outlook / Microsoft Graph</h3>
                      <p className="text-xs text-slate-500">Configured via environment variables</p>
                    </div>
                  </div>
                  <Badge variant={outlookOk ? 'success' : 'error'}>
                    {outlookOk
                      ? <><CheckCircle className="h-3 w-3 mr-1" />Connected</>
                      : <><XCircle className="h-3 w-3 mr-1" />Not configured</>}
                  </Badge>
                </div>

                {outlookOk && data?.outlook && (
                  <div className="space-y-2 mb-4">
                    {[
                      { label: 'Inbox Email', value: data.outlook.inboxEmail },
                      { label: 'Client ID',   value: data.outlook.clientId },
                      { label: 'Auth Flow',   value: 'Client Credentials (OAuth2)' },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
                        <span className="text-slate-500">{row.label}</span>
                        <span className="font-mono text-slate-700">{row.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  variant="outline" size="sm"
                  onClick={testOutlook} loading={testing}
                  disabled={!outlookOk}
                  icon={<RefreshCw className="h-3.5 w-3.5" />}
                >
                  Test Connection
                </Button>

                {!outlookOk && (
                  <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-1">
                    <p className="text-xs font-semibold text-amber-800">Missing environment variables:</p>
                    {(data?.outlook.missingVars ?? ['OUTLOOK_CLIENT_ID', 'OUTLOOK_TENANT_ID', 'OUTLOOK_CLIENT_SECRET', 'OUTLOOK_INBOX_EMAIL']).map(v => (
                      <code key={v} className="block text-xs text-amber-700 bg-white px-2 py-0.5 rounded border border-amber-100">{v}</code>
                    ))}
                    <p className="text-xs text-amber-600 pt-1">
                      Add these in <strong>Vercel → Project → Settings → Environment Variables</strong>, then redeploy.
                    </p>
                  </div>
                )}
              </div>

              {/* OpenAI */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
                      <BrainCircuit className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">OpenAI (ChatGPT)</h3>
                      <p className="text-xs text-slate-500">CV analysis · {openaiData?.model ?? 'gpt-4o-mini'}</p>
                    </div>
                  </div>
                  <Badge variant={openaiOk ? 'success' : 'error'}>
                    {openaiOk
                      ? <><CheckCircle className="h-3 w-3 mr-1" />Connected</>
                      : <><XCircle className="h-3 w-3 mr-1" />Not configured</>}
                  </Badge>
                </div>

                {openaiOk && (
                  <div className="mt-4 space-y-2">
                    {[
                      { label: 'Model',   value: openaiData?.model ?? 'gpt-4o-mini' },
                      { label: 'Pricing', value: '$0.15 / 1M input · $0.60 / 1M output' },
                      { label: 'Use',     value: 'Maritime CV rank extraction & analysis' },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
                        <span className="text-slate-500">{row.label}</span>
                        <span className="font-mono text-slate-700">{row.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {!openaiOk && (
                  <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-1">
                    <p className="text-xs font-semibold text-amber-800">Missing environment variable:</p>
                    <code className="block text-xs text-amber-700 bg-white px-2 py-0.5 rounded border border-amber-100">OPENAI_API_KEY</code>
                    <p className="text-xs text-amber-600 pt-1">
                      Add in <strong>Vercel → Project → Settings → Environment Variables</strong>, then redeploy.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* ── Usage tab ── */}
      {tab === 'usage' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <TokenUsagePanel />
        </motion.div>
      )}
    </div>
  );
}
