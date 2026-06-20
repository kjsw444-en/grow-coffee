import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useButtonSound } from '../../audio/SoundProvider';
import './Button.css';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: 'primary' | 'harvest' | 'ghost';
  silent?: boolean;
};

export function Button({
  children,
  variant = 'primary',
  className = '',
  silent = false,
  onClick,
  ...props
}: ButtonProps) {
  const buttonSound = useButtonSound(variant === 'harvest' ? 'harvest' : 'button');

  return (
    <button
      type="button"
      className={`ui-button ui-button--${variant} ${className}`.trim()}
      onClick={async (e) => {
        if (!silent) await buttonSound();
        onClick?.(e);
      }}
      {...props}
    >
      {children}
    </button>
  );
}