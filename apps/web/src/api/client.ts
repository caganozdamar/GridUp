import { API_BASE_URL } from '../config';

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type QueryParams = Record<string, string | number | boolean | undefined>;

function buildUrl(path: string, params?: QueryParams): string {
  const url = new URL(path, API_BASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function apiPatch<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path), { method: 'PATCH' });
  } catch {
    throw new ApiError('Could not connect to the server');
  }

  if (!response.ok) {
    throw new ApiError(`Request failed (${response.status})`, response.status);
  }

  return (await response.json()) as T;
}

export async function apiGet<T>(path: string, params?: QueryParams): Promise<T> {
  const url = buildUrl(path, params);

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new ApiError('Could not connect to the server');
  }

  if (!response.ok) {
    throw new ApiError(`Request failed (${response.status})`, response.status);
  }

  return (await response.json()) as T;
}
