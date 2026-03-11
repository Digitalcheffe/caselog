import type { PropsWithChildren, ReactNode } from 'react';

export const Button = ({ children, variant = 'primary', ...props }: PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }>) => (
  <button {...props} className={`btn btn-${variant} ${props.className ?? ''}`.trim()}>
    {children}
  </button>
);

export const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} className={`input ${props.className ?? ''}`.trim()} />;
export const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} className={`input ${props.className ?? ''}`.trim()} />;
export const Select = ({ children, ...props }: PropsWithChildren<React.SelectHTMLAttributes<HTMLSelectElement>>) => <select {...props} className={`input ${props.className ?? ''}`.trim()}>{children}</select>;
export const Checkbox = (props: React.InputHTMLAttributes<HTMLInputElement>) => <input type="checkbox" {...props} className={`checkbox ${props.className ?? ''}`.trim()} />;

export const Card = ({ children, className, ...props }: PropsWithChildren<React.HTMLAttributes<HTMLElement>>) => (
  <section className={`card ${className ?? ""}`.trim()} {...props}>{children}</section>
);
export const CardGrid = ({ children }: PropsWithChildren) => <div className="card-grid">{children}</div>;
export const PageHeader = ({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) => (
  <header className="page-header"><div><h1>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</div>{actions}</header>
);

export const MetadataLine = ({ children, className }: PropsWithChildren<{ className?: string }>) => <p className={`meta-line ${className ?? ''}`.trim()}>{children}</p>;
export const TagList = ({ tags }: { tags: string[] }) => <div className="tag-list">{tags.map((tag) => <span key={tag} className="tag">{tag}</span>)}</div>;
export const EmptyState = ({ title, body }: { title: string; body: string }) => <Card><h3>{title}</h3><p className="muted">{body}</p></Card>;
export const Badge = ({ children, tone = 'neutral' }: PropsWithChildren<{ tone?: 'neutral' | 'accent' | 'danger' | 'success' | 'warning' }>) => <span className={`badge badge-${tone}`}>{children}</span>;
export const Spinner = () => <span className="spinner" aria-label="loading" />;
export const SkeletonCard = () => <div className="skeleton" />;

export const ConfirmDialog = ({ open, title, body, onConfirm, onCancel }: { open: boolean; title: string; body: string; onConfirm: () => void; onCancel: () => void }) => open ? (
  <div className="dialog-backdrop"><div className="card"><h3>{title}</h3><p>{body}</p><div className="row"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button variant="danger" onClick={onConfirm}>Confirm</Button></div></div></div>
) : null;

export const Toast = ({ message }: { message: string }) => <div className="toast">{message}</div>;
