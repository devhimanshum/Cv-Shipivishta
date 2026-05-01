'use client';

import { cn } from '@/lib/utils/helpers';

type Variant = 'success' | 'error' | 'warning' | 'info' | 'neutral' | 'duplicate';

const variants: Record<Variant, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20',
  error: 'bg-red-50 text-red-700 ring-1 ring-red-600/20',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20',
  info: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20',
  neutral: 'bg-slate-100 text-slate-600 ring-1 ring-slate-600/20',
  duplicate: 'bg-purple-50 text-purple-700 ring-1 ring-purple-600/20',
};

interface BadgeProps {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'neutral', children, className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
}
