import type { HTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  action?: ReactNode;
  as?: 'section' | 'div' | 'article';
}

export function Card({ title, action, children, className, as: Tag = 'section', ...rest }: CardProps) {
  return (
    <Tag className={['card', className].filter(Boolean).join(' ')} {...rest}>
      {(title || action) && (
        <div className="card-header">
          {title && <h2 className="card-title">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </Tag>
  );
}

export function CardLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={['card', 'card-link', className].filter(Boolean).join(' ')}>
      {children}
    </Link>
  );
}
