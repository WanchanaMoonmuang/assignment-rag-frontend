export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api"
).replace(/\/$/, "");

export interface ApiErrorDetail {
  loc?: Array<string | number>;
  msg?: string;
  type?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly details?: ApiErrorDetail[];

  constructor(status: number, message: string, details?: ApiErrorDetail[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

interface AuthHandlers {
  getToken: () => string | null;
  onUnauthorized: () => void;
}

let authHandlers: AuthHandlers = {
  getToken: () => null,
  onUnauthorized: () => undefined,
};

export function configureApiAuth(handlers: AuthHandlers): () => void {
  authHandlers = handlers;
  return () => {
    authHandlers = {
      getToken: () => null,
      onUnauthorized: () => undefined,
    };
  };
}

export function handleUnauthorizedResponse(): void {
  authHandlers.onUnauthorized();
}

function messageFromStatus(status: number): string {
  if (status === 401) return "Your session is invalid or has expired.";
  if (status === 404) return "The requested resource was not found.";
  if (status >= 500) return "The service is temporarily unavailable.";
  return "The request could not be completed.";
}

export async function parseApiError(response: Response): Promise<ApiError> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return new ApiError(response.status, messageFromStatus(response.status));
  }

  if (typeof payload === "object" && payload !== null && "detail" in payload) {
    const detail = payload.detail;
    if (typeof detail === "string" && detail.trim()) {
      return new ApiError(response.status, detail);
    }
    if (Array.isArray(detail)) {
      const details = detail.filter(
        (item): item is ApiErrorDetail => typeof item === "object" && item !== null,
      );
      const message = details
        .map((item) => item.msg)
        .filter((item): item is string => Boolean(item))
        .join(" ");
      return new ApiError(response.status, message || messageFromStatus(response.status), details);
    }
  }
  return new ApiError(response.status, messageFromStatus(response.status));
}

interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  auth?: boolean;
  body?: unknown;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { auth = true, body, headers, ...requestOptions } = options;
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Accept", "application/json");
  if (body !== undefined) requestHeaders.set("Content-Type", "application/json");

  if (auth) {
    const token = authHandlers.getToken();
    if (token) requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestOptions,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    if (auth && response.status === 401) handleUnauthorizedResponse();
    throw error;
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// For fetching a private binary resource (e.g. an original document file) with
// bearer auth. Returns the raw Blob instead of parsing JSON.
export async function apiRequestBlob(path: string): Promise<Blob> {
  const requestHeaders = new Headers();
  const token = authHandlers.getToken();
  if (token) requestHeaders.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { headers: requestHeaders });

  if (!response.ok) {
    const error = await parseApiError(response);
    if (response.status === 401) handleUnauthorizedResponse();
    throw error;
  }

  return await response.blob();
}

// For multipart uploads. No Content-Type is set so the browser attaches its own
// boundary; auth injection and error handling otherwise match apiRequest.
export async function apiRequestFormData<T>(path: string, formData: FormData): Promise<T> {
  const requestHeaders = new Headers();
  requestHeaders.set("Accept", "application/json");
  const token = authHandlers.getToken();
  if (token) requestHeaders.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: requestHeaders,
    body: formData,
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    if (response.status === 401) handleUnauthorizedResponse();
    throw error;
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
