export type ApiEnvelope<T> = {
  data: T | null;
  error?: string | null;
  meta?: Record<string, unknown>;
};

export type ApiError = {
  status: number;
  message: string;
};

const API_KEY_STORAGE = 'caselog-api-key';

export const apiKeyStorage = {
  get: (): string | null => window.localStorage.getItem(API_KEY_STORAGE),
  set: (value: string): void => window.localStorage.setItem(API_KEY_STORAGE, value),
  clear: (): void => window.localStorage.removeItem(API_KEY_STORAGE)
};

const unwrapEnvelope = async <T>(response: Response): Promise<T> => {
  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || payload.error) {
    throw {
      status: response.status,
      message: payload.error ?? response.statusText
    } satisfies ApiError;
  }

  return payload.data as T;
};

export const apiRequest = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const token = apiKeyStorage.get();
  const headers = new Headers(options.headers ?? {});

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(path, {
    ...options,
    headers
  });

  return unwrapEnvelope<T>(response);
};
