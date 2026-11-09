export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, code: string | null = null) {
    super(code ? `${status} ${code}` : `${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function codeOf(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return null;
}

/** Returns the data of an openapi-fetch result, or throws an ApiError. Only `code` is read from problem+json. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined && result.error !== null && result.error !== '') {
    throw new ApiError(result.response.status, codeOf(result.error));
  }
  if (!result.response.ok) throw new ApiError(result.response.status, null);
  return result.data as T;
}

export function isApiError(e: unknown, ...codes: string[]): boolean {
  if (!(e instanceof ApiError)) return false;
  return codes.length === 0 || (e.code !== null && codes.includes(e.code));
}
