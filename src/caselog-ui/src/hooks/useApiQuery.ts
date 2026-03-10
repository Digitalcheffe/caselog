import { useEffect, useState } from 'react';

type AsyncStatus<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

export const useApiQuery = <T>(queryFn: () => Promise<T>, deps: unknown[] = []): AsyncStatus<T> => {
  const [state, setState] = useState<AsyncStatus<T>>({ data: null, loading: true, error: null });

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setState({ data: null, loading: true, error: null });
      try {
        const response = await queryFn();
        if (mounted) {
          setState({ data: response, loading: false, error: null });
        }
      } catch (error) {
        if (mounted) {
          const message = error instanceof Error ? error.message : 'Unknown API error';
          setState({ data: null, loading: false, error: message });
        }
      }
    };

    void run();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
};
