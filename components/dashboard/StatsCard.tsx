'use client';

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils/helpers';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  color?: 'primary' | 'green' | 'red' | 'amber' | 'purple' | 'navy';
  delay?: number;
  subtitle?: string;
}

const colorMap = {
  primary: {
    iconBg: 'bg-primary-100',
    iconColor: 'text-primary-600',
    accent: '#2563eb',
    gradient: 'from-primary-50 to-white',
    border: 'border-primary-100',
  },
  navy: {
    iconBg: 'bg-navy-100',
    iconColor: 'text-navy-700',
    accent: '#0d254a',
    gradient: 'from-blue-50 to-white',
    border: 'border-blue-100',
  },
  green: {
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    accent: '#059669',
    gradient: 'from-emerald-50 to-white',
    border: 'border-emerald-100',
  },
  red: {
    iconBg: 'bg-maritime-100',
    iconColor: 'text-maritime-600',
    accent: '#C0392B',
    gradient: 'from-red-50 to-white',
    border: 'border-red-100',
  },
  amber: {
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    accent: '#d97706',
    gradient: 'from-amber-50 to-white',
    border: 'border-amber-100',
  },
  purple: {
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    accent: '#7c3aed',
    gradient: 'from-purple-50 to-white',
    border: 'border-purple-100',
  },
};

export function StatsCard({
  title, value, icon: Icon, trend, color = 'primary', delay = 0, subtitle,
}: StatsCardProps) {
  const c = colorMap[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        'relative rounded-2xl border bg-gradient-to-br p-5 overflow-hidden transition-all duration-200',
        'hover:shadow-card-hover hover:-translate-y-0.5 cursor-default',
        c.gradient, c.border,
      )}
      style={{ boxShadow: '0 1px 4px rgba(14,37,98,0.07)' }}
    >
      {/* Top accent bar */}
      <div
        className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl"
        style={{ background: `linear-gradient(90deg, transparent, ${c.accent}60, transparent)` }}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 truncate">{title}</p>
          <p className="mt-2.5 text-[32px] font-bold leading-none tracking-tight text-slate-900">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-[11px] text-slate-400 truncate">{subtitle}</p>
          )}
          {trend && (
            <div className={cn(
              'mt-2 flex items-center gap-1 text-[11px] font-medium',
              trend.value >= 0 ? 'text-emerald-600' : 'text-red-500'
            )}>
              {trend.value >= 0
                ? <TrendingUp className="h-3 w-3" />
                : <TrendingDown className="h-3 w-3" />}
              {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
            </div>
          )}
        </div>

        {/* Icon */}
        <div className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
          c.iconBg,
        )}>
          <Icon className={cn('h-5 w-5', c.iconColor)} />
        </div>
      </div>
    </motion.div>
  );
}
