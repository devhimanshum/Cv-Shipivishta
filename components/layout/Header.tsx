'use client';

interface HeaderProps {
  title: string;
  subtitle?: string;
  /** Optional extra buttons rendered on the right */
  actions?: React.ReactNode;
  /** @deprecated — use actions prop instead */
  onRefresh?: () => void;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <div
      className="relative flex items-center justify-between px-6 py-4 bg-white shrink-0"
      style={{ borderBottom: '1px solid #e8eef6' }}
    >
      {/* Subtle top gradient line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent" />

      {/* Title */}
      <div>
        <h1 className="text-[17px] font-bold text-navy-900 tracking-tight">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 text-[12px] text-slate-400 font-medium">{subtitle}</p>
        )}
      </div>

      {/* Right-side actions */}
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
