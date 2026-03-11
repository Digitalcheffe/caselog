export type ApiEnvelope<T> = {
  data: T | null;
  error?: string | { message?: string } | null;
  meta?: Record<string, unknown>;
};

export type ApiError = {
  status: number;
  message: string;
  details?: unknown;
};

const TOKEN_STORAGE_KEY = 'caselog-token';
const USER_STORAGE_KEY = 'caselog-user';

export const authStorage = {
  getToken: (): string | null => window.localStorage.getItem(TOKEN_STORAGE_KEY),
  setSession: (token: string, user: unknown): void => {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  },
  clearSession: (): void => {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(USER_STORAGE_KEY);
  },
};

const logApiError = (params: {
  method: string;
  url: string;
  status: number;
  requestBody?: string;
  responseBody?: unknown;
}) => {
  console.error('API request failed', params);
};

const unwrapEnvelope = async <T>(response: Response, method: string, url: string, requestBody?: string): Promise<T> => {
  let payload: ApiEnvelope<T> | null = null;
  let problemDetails: {
    title?: string;
    detail?: string;
    errors?: Record<string, string[]>;
  } | null = null;
  try {
    const rawPayload = (await response.json()) as ApiEnvelope<T> | {
      title?: string;
      detail?: string;
      errors?: Record<string, string[]>;
    };
    if ("data" in rawPayload || "error" in rawPayload) {
      payload = rawPayload as ApiEnvelope<T>;
    } else {
      problemDetails = rawPayload;
    }
  } catch {
    payload = null;
  }

  if (response.status === 401) {
    authStorage.clearSession();
    window.location.assign('/login');
  }

  if (!response.ok || payload?.error) {
    const validationMessages = problemDetails?.errors
      ? Object.entries(problemDetails.errors)
          .flatMap(([field, messages]) => messages.map((message) => `${field}: ${message}`))
          .join(" ")
      : "";
    const fallbackMessage = [problemDetails?.detail, problemDetails?.title, validationMessages]
      .filter(Boolean)
      .join(" ")
      .trim();

    logApiError({
      method,
      url,
      status: response.status,
      requestBody,
      responseBody: payload ?? problemDetails,
    });
    throw {
      status: response.status,
      message:
        typeof payload?.error === 'string'
          ? payload.error
          : (payload?.error as { message?: string } | null)?.message ?? fallbackMessage || response.statusText,
      details: payload ?? problemDetails,
    } satisfies ApiError;
  }

  return payload?.data as T;
};

export const apiRequest = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const token = authStorage.getToken();
  const method = options.method ?? 'GET';
  const headers = new Headers(options.headers ?? {});
  const requestBody = typeof options.body === 'string' ? options.body : undefined;

  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const response = await fetch(path, {
      ...options,
      headers,
    });

    return unwrapEnvelope<T>(response, method, path, requestBody);
  } catch (error) {
    if ((error as ApiError).status) {
      throw error;
    }

    logApiError({
      method,
      url: path,
      status: 0,
      requestBody,
      responseBody: error,
    });
    throw {
      status: 0,
      message: 'Network error — check connection',
      details: error,
    } satisfies ApiError;
  }
};
