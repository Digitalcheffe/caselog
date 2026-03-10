import type { ReactNode } from 'react';

type RouteStateProps = {
  title: string;
  description: string;
  loading?: boolean;
  error?: string | null;
  children?: ReactNode;
};

export const RouteState = ({ title, description, loading = false, error = null, children }: RouteStateProps) => {
  if (loading) {
    return (
      <section className="panel">
        <p className="panel-meta">Loading</p>
        <h2 className="panel-title">{title}</h2>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel panel-error">
        <p className="panel-meta error">Error</p>
        <h2 className="panel-title">{title}</h2>
        <p className="panel-description">{error}</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <p className="panel-meta accent">Page scaffold</p>
      <h2 className="panel-title">{title}</h2>
      <p className="panel-description">{description}</p>
      {children}
    </section>
  );
};
