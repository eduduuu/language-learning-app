import React from 'react';
import { Loader2 } from 'lucide-react';

export const cx = (...c: Array<string | false | null | undefined>) =>
  c.filter(Boolean).join(' ');

/* ─── Button ─────────────────────────────────────────────── */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading,
  fullWidth,
  disabled,
  className,
  children,
  ...rest
}) => (
  <button
    disabled={disabled || loading}
    className={cx(
      'relative inline-flex items-center justify-center gap-2 font-medium tracking-tight rounded-lg whitespace-nowrap',
      'transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
      fullWidth && 'w-full',
      size === 'sm' && 'px-3 py-1.5 text-xs',
      size === 'md' && 'px-4 py-2.5 text-sm',
      size === 'lg' && 'px-5 py-3 text-sm',
      variant === 'primary' &&
        'bg-amber-400 text-zinc-950 hover:bg-amber-300 active:bg-amber-500 shadow-glow',
      variant === 'secondary' &&
        'bg-zinc-800/80 text-zinc-100 hover:bg-zinc-700/80 border border-zinc-700/80 active:bg-zinc-700',
      variant === 'ghost' && 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60',
      variant === 'danger' &&
        'bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border border-rose-500/20',
      className,
    )}
    {...rest}
  >
    {loading && <Loader2 size={size === 'sm' ? 13 : 15} className="animate-spin" />}
    {children}
  </button>
);

/* ─── Card ───────────────────────────────────────────────── */
export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...rest
}) => (
  <div
    className={cx(
      'rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-[2px]',
      className,
    )}
    {...rest}
  />
);

export const CardHeader: React.FC<{
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  action?: React.ReactNode;
}> = ({ title, subtitle, icon: Icon, action }) => (
  <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-zinc-800/60">
    <div className="flex items-start gap-3">
      {Icon && (
        <div className="mt-0.5 grid place-items-center w-8 h-8 rounded-lg bg-amber-400/10 text-amber-400 ring-1 ring-amber-400/20">
          <Icon size={15} strokeWidth={2.2} />
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-zinc-100 tracking-tight">{title}</h3>
        {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

/* ─── PageHeader ─────────────────────────────────────────── */
export const PageHeader: React.FC<{
  icon?: React.ElementType;
  kicker?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}> = ({ icon: Icon, kicker, title, subtitle, action }) => (
  <div className="flex items-end justify-between gap-6 flex-wrap animate-slide-up">
    <div className="space-y-2.5 max-w-2xl">
      {kicker && (
        <div className="inline-flex items-center gap-2 text-amber-400/90">
          {Icon && <Icon size={13} strokeWidth={2.2} />}
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.22em]">
            {kicker}
          </span>
        </div>
      )}
      <h1 className="font-display text-4xl sm:text-[2.75rem] text-zinc-50 leading-[1.05]">
        {title}
      </h1>
      {subtitle && (
        <p className="text-sm text-zinc-400 leading-relaxed max-w-xl">{subtitle}</p>
      )}
    </div>
    {action}
  </div>
);

/* ─── Field ──────────────────────────────────────────────── */
export const Label: React.FC<{
  children: React.ReactNode;
  hint?: string;
  className?: string;
}> = ({ children, hint, className }) => (
  <label
    className={cx(
      'block text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400 mb-2',
      className,
    )}
  >
    {children}
    {hint && (
      <span className="ml-2 normal-case tracking-normal font-normal text-zinc-600">
        {hint}
      </span>
    )}
  </label>
);

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...rest }, ref) => (
  <input
    ref={ref}
    className={cx(
      'w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100',
      'placeholder:text-zinc-600 transition-colors',
      'focus:outline-none focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/15',
      className,
    )}
    {...rest}
  />
));
Input.displayName = 'Input';

/* ─── SegmentedControl ───────────────────────────────────── */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
}) {
  return (
    <div
      className={cx(
        'inline-flex p-1 bg-zinc-950/60 border border-zinc-800 rounded-lg gap-1',
        className,
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cx(
            'flex-1 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150',
            value === opt.value
              ? 'bg-zinc-800 text-zinc-50 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-300',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Slider ─────────────────────────────────────────────── */
export const Slider: React.FC<{
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  label: string;
  display?: React.ReactNode;
}> = ({ value, min, max, step = 1, onChange, label, display }) => (
  <div>
    <div className="flex justify-between items-baseline mb-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
        {label}
      </span>
      <span className="text-xs font-mono text-amber-400 tabular-nums">
        {display ?? value}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1.5 appearance-none bg-zinc-800 rounded-full cursor-pointer
        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-400
        [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(251,191,36,0.15)]
        [&::-webkit-slider-thumb]:transition-shadow
        hover:[&::-webkit-slider-thumb]:shadow-[0_0_0_6px_rgba(251,191,36,0.22)]"
    />
  </div>
);

/* ─── EmptyState ─────────────────────────────────────────── */
export const EmptyState: React.FC<{
  icon: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}> = ({ icon: Icon, title, description, action, className }) => (
  <div
    className={cx(
      'flex flex-col items-center justify-center text-center p-12 rounded-2xl',
      'border border-dashed border-zinc-800 bg-zinc-900/30',
      className,
    )}
  >
    <div className="grid place-items-center w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-600 mb-4">
      <Icon size={22} strokeWidth={1.75} />
    </div>
    <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
    {description && (
      <p className="text-xs text-zinc-500 max-w-xs mt-1.5 leading-relaxed">
        {description}
      </p>
    )}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

/* ─── Loading & Skeleton ─────────────────────────────────── */
export const LoadingState: React.FC<{ message?: string; className?: string }> = ({
  message,
  className,
}) => (
  <div
    className={cx(
      'flex flex-col items-center justify-center p-16 text-zinc-500',
      className,
    )}
  >
    <Loader2 size={26} className="animate-spin text-amber-400/80 mb-3" />
    {message && <p className="text-xs tracking-wide">{message}</p>}
  </div>
);

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cx('animate-pulse rounded-lg bg-zinc-800/50', className)} />
);

/* ─── Badge ──────────────────────────────────────────────── */
export const Badge: React.FC<{
  children: React.ReactNode;
  variant?: 'default' | 'gold' | 'success' | 'muted';
  className?: string;
}> = ({ children, variant = 'default', className }) => (
  <span
    className={cx(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider',
      variant === 'default' && 'bg-zinc-800 text-zinc-300 border border-zinc-700/80',
      variant === 'gold' && 'bg-amber-400/10 text-amber-300 border border-amber-400/20',
      variant === 'success' &&
        'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
      variant === 'muted' && 'bg-zinc-900 text-zinc-500 border border-zinc-800',
      className,
    )}
  >
    {children}
  </span>
);