'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Save, ToggleLeft, ToggleRight, Clock, CheckCircle2,
  ChevronDown, ChevronUp, Info, Anchor,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/lib/utils/api-client';
import { cn } from '@/lib/utils/helpers';
import toast from 'react-hot-toast';
import type { RankConfig, RankRequirement } from '@/types';

// ── Maritime rank groups ──────────────────────────────────────
const RANK_GROUPS = [
  { label: 'Deck Officers',   icon: '🚢', ranks: ['Master', 'Chief Officer', 'Second Officer', 'Third Officer', 'Deck Cadet'] },
  { label: 'Engine Officers', icon: '⚙️', ranks: ['Chief Engineer', 'Second Engineer', 'Third Engineer', 'Fourth Engineer', 'TME/Fifth Engineer'] },
  { label: 'Electrical',      icon: '⚡', ranks: ['Electrical Officer - COC', 'Electrical Officer - without COC', 'Electrical Cadet'] },
  { label: 'Ratings',         icon: '👷', ranks: ['Fitter', 'Bosun', 'AB Deck', 'AB Engine', 'Ordinary Seamen', 'Wiper'] },
  { label: 'Specialists',     icon: '🔧', ranks: ['Gas Engineer', 'Pumpman'] },
  { label: 'Catering',        icon: '🍳', ranks: ['Chief Cook', 'Messman/GS/Asst. Cook'] },
];
const ALL_RANKS = RANK_GROUPS.flatMap(g => g.ranks);

function defaultRequirements(): RankRequirement[] {
  return ALL_RANKS.map(rank => ({ rank, enabled: true, minDurationMonths: 0 }));
}

function monthsLabel(m: number) {
  if (!m) return 'No min';
  const y = Math.floor(m / 12), mo = m % 12;
  return [y ? `${y}y` : '', mo ? `${mo}m` : ''].filter(Boolean).join(' ');
}

// ── Single rank row ───────────────────────────────────────────
function RankRow({ req, onChange }: { req: RankRequirement; onChange: (u: RankRequirement) => void }) {
  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-200',
      req.enabled ? 'border-primary-200 bg-primary-50/40' : 'border-slate-200 bg-white opacity-55',
    )}>
      <button onClick={() => onChange({ ...req, enabled: !req.enabled })} className="shrink-0">
        {req.enabled
          ? <ToggleRight className="h-6 w-6 text-primary-600" />
          : <ToggleLeft  className="h-6 w-6 text-slate-300" />}
      </button>
      <span className={cn('flex-1 text-sm font-medium', req.enabled ? 'text-slate-900' : 'text-slate-400')}>
        {req.rank}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <Clock className="h-3.5 w-3.5 text-slate-300" />
        <input
          type="number" min={0} max={600} step={1}
          value={req.minDurationMonths}
          disabled={!req.enabled}
          onChange={e => onChange({ ...req, minDurationMonths: Math.max(0, Number(e.target.value)) })}
          className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-50 disabled:text-slate-300"
        />
        <span className="w-14 text-[11px] text-slate-400">{monthsLabel(req.minDurationMonths)}</span>
      </div>
    </div>
  );
}

// ── Rank group section ────────────────────────────────────────
function RankGroup({
  group, requirements, onChangeAll,
}: {
  group: typeof RANK_GROUPS[number];
  requirements: RankRequirement[];
  onChangeAll: (u: RankRequirement[]) => void;
}) {
  const [open, setOpen] = useState(true);
  const groupReqs  = requirements.filter(r => group.ranks.includes(r.rank));
  const allEnabled = groupReqs.every(r => r.enabled);

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-base">{group.icon}</span>
          <span className="text-sm font-bold text-slate-800">{group.label}</span>
          <span className="text-xs text-slate-400">({groupReqs.filter(r => r.enabled).length}/{groupReqs.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChangeAll(requirements.map(r => group.ranks.includes(r.rank) ? { ...r, enabled: !allEnabled } : r))}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
          >
            {allEnabled ? 'Deselect all' : 'Select all'}
          </button>
          <button onClick={() => setOpen(o => !o)} className="text-slate-400 hover:text-slate-600">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="p-3 space-y-2">
              {groupReqs.map(req => (
                <RankRow
                  key={req.rank} req={req}
                  onChange={updated => onChangeAll(requirements.map(r => r.rank === updated.rank ? updated : r))}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export function ConfigForm() {
  const [requirements, setRequirements] = useState<RankRequirement[]>(defaultRequirements());
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get<{ success: boolean; data: RankConfig | null }>('/api/config');
        if (res.data?.requirements?.length) {
          const savedMap = new Map(res.data.requirements.map(r => [r.rank, r]));
          setRequirements(defaultRequirements().map(r => savedMap.get(r.rank) ?? r));
        }
      } catch { /* use defaults */ }
      finally { setLoading(false); }
    })();
  }, []);

  async function handleSave() {
    setSaving(true); setSaved(false);
    try {
      await apiClient.post('/api/config', { requirements });
      setSaved(true);
      toast.success('Rank configuration saved!');
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  }

  const enabledCount = requirements.filter(r => r.enabled).length;

  if (loading) return (
    <div className="space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-36 rounded-2xl bg-slate-100 animate-pulse" />)}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100">
            <Anchor className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Maritime Rank Configuration</h3>
            <p className="text-xs text-slate-500">{enabledCount}/{ALL_RANKS.length} ranks active</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setRequirements(r => r.map(x => ({ ...x, enabled: true  })))} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">Enable all</button>
          <button onClick={() => setRequirements(r => r.map(x => ({ ...x, enabled: false })))} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">Disable all</button>
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
        <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          AI extracts every rank and time duration from each CV. Set a <strong>minimum duration</strong> (months) per rank, or leave at <strong>0</strong> for no minimum. All processed CVs go to the <strong>Review</strong> screen for your final decision.
        </p>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-3 px-4">
        <div className="w-6 shrink-0" />
        <span className="flex-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Rank</span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0 pr-2">Min. months</span>
      </div>

      {/* Groups */}
      <div className="space-y-4">
        {RANK_GROUPS.map(group => (
          <RankGroup key={group.label} group={group} requirements={requirements} onChangeAll={setRequirements} />
        ))}
      </div>

      {/* Save */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <p className="text-xs text-slate-400">Applies to all future CV processing</p>
        <Button
          onClick={handleSave} loading={saving}
          icon={saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
        >
          {saved ? 'Saved!' : 'Save Configuration'}
        </Button>
      </div>
    </div>
  );
}
