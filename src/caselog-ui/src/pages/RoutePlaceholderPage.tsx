import { useEffect, useState } from 'react';
import { RouteState } from '../components/RouteState';

type RoutePlaceholderPageProps = {
  title: string;
  description: string;
  params?: Record<string, string>;
};

export const RoutePlaceholderPage = ({ title, description, params = {} }: RoutePlaceholderPageProps) => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 120);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <RouteState title={title} description={description} loading={loading} error={null}>
      {Object.keys(params).length > 0 && (
        <pre className="params-preview">{JSON.stringify(params, null, 2)}</pre>
      )}
    </RouteState>
  );
};
