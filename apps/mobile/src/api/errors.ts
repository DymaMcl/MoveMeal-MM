import { ApiError } from './client';

/** Cheia de traducere potrivita pentru o eroare primita de la server. */
export function errorKey(error: unknown): string {
  if (!(error instanceof ApiError)) return 'errors.unknown';
  switch (error.data.code) {
    case 'ai_unavailable':
      return 'errors.aiUnavailable';
    case 'ai_busy':
    case 'ai_failed':
      return 'errors.aiFailed';
    case 'ai_blocked':
      return 'errors.aiBlocked';
    case 'ai_limit':
      return 'errors.aiLimit';
  }
  switch (error.status) {
    case 0:
      return 'errors.network';
    case 401:
      return 'errors.invalidCredentials';
    case 403:
      return error.data.code === 'account_blocked' ? 'errors.blocked' : 'errors.forbidden';
    case 409:
      return 'errors.emailTaken';
    case 413:
      return 'errors.imageTooLarge';
    case 423:
      return 'errors.locked';
    default:
      return 'errors.unknown';
  }
}
