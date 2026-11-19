import { ApiError } from './client';

/** Cheia de traducere potrivita pentru o eroare primita de la server. */
export function errorKey(error: unknown): string {
  if (!(error instanceof ApiError)) return 'errors.unknown';
  switch (error.status) {
    case 0:
      return 'errors.network';
    case 401:
      return 'errors.invalidCredentials';
    case 409:
      return 'errors.emailTaken';
    case 423:
      return 'errors.locked';
    default:
      return 'errors.unknown';
  }
}
