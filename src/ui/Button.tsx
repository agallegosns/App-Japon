import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface CommonProps {
  variant?: Variant;
  block?: boolean;
  small?: boolean;
  icon?: ReactNode;
}

function classes({ variant = 'secondary', block, small }: CommonProps, iconOnly: boolean, extra?: string): string {
  return ['btn', `btn-${variant}`, block && 'btn-block', small && 'btn-sm', iconOnly && 'btn-icon', extra]
    .filter(Boolean)
    .join(' ');
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, CommonProps {
  /** Botón solo con icono: requiere etiqueta accesible. */
  label?: string;
}

export function Button({ variant, block, small, icon, label, children, className, type = 'button', ...rest }: ButtonProps) {
  const iconOnly = !children && !!icon;
  return (
    <button
      type={type}
      className={classes({ variant, block, small }, iconOnly, className)}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export interface LinkButtonProps extends LinkProps, CommonProps {
  label?: string;
}

export function LinkButton({ variant, block, small, icon, label, children, className, ...rest }: LinkButtonProps) {
  const iconOnly = !children && !!icon;
  return (
    <Link className={classes({ variant, block, small }, iconOnly, className)} aria-label={iconOnly ? label : undefined} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
