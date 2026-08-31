import React from 'react';
import { LucideIcon } from 'lucide-react';

export type IconButtonVariant =
  | 'default'
  | 'primary'
  | 'danger'
  | 'ghost'
  | 'active'
  | 'success'
  | 'warning';

export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon | React.ReactNode;
  title: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  active?: boolean;
}

const variantStyles: Record<IconButtonVariant, string> = {
  default:
    'text-ink-muted hover:text-ink-text hover:bg-ink-panel active:bg-ink-hover',
  ghost:
    'text-ink-muted hover:text-ink-text hover:bg-ink-panel/40 active:bg-ink-hover/50',
  primary:
    'text-ink-accent-light hover:text-white hover:bg-ink-accent/30 active:bg-ink-accent/50',
  active:
    'text-white bg-ink-accent hover:bg-ink-accent-hover shadow-sm',
  danger:
    'text-ink-muted hover:text-ink-danger hover:bg-ink-danger-muted/40 active:bg-ink-danger-muted/60',
  success:
    'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 active:bg-emerald-900/50',
  warning:
    'text-amber-400 hover:text-amber-300 hover:bg-amber-950/40 active:bg-amber-900/50',
};

const sizeStyles: Record<IconButtonSize, { button: string; icon: string }> = {
  sm: { button: 'p-1 rounded', icon: 'w-3.5 h-3.5' },
  md: { button: 'p-1.5 rounded-md', icon: 'w-4 h-4' },
  lg: { button: 'p-2 rounded-lg', icon: 'w-5 h-5' },
};

export const IconButton: React.FC<IconButtonProps> = ({
  icon: IconComponent,
  title,
  variant = 'default',
  size = 'md',
  active = false,
  className = '',
  disabled,
  ...props
}) => {
  const currentVariant = active ? 'active' : variant;
  const sizeConfig = sizeStyles[size];

  const renderIcon = () => {
    if (React.isValidElement(IconComponent)) {
      return IconComponent;
    }
    const Icon = IconComponent as LucideIcon;
    return <Icon className={sizeConfig.icon} />;
  };

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      className={`inline-flex items-center justify-center transition-colors select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink-accent ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      } ${sizeConfig.button} ${variantStyles[currentVariant]} ${className}`}
      {...props}
    >
      {renderIcon()}
    </button>
  );
};
