import type { ReactNode } from 'react';
import './Card.css';

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className = '' }: CardProps) {
  return <section className={`ui-card ${className}`.trim()}>{children}</section>;
}
