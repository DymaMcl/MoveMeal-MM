import { ApiError } from './client';

/** Cheia de traducere potrivita pentru o eroare primita de la server. */
export function errorKey(error: unknown): string {
  if (!(error instanceof ApiError)) return 'errors.unknown';
  switch (error.data.code) {
    case 'ai_unavailable':
      return 'errors.aiUnavailable';
    case 'ai_busy':
      return 'errors.aiBusy';
    case 'ai_failed':
      return 'errors.aiFailed';
    case 'ai_blocked':
      return 'errors.aiBlocked';
    case 'ai_limit':
      return 'errors.aiLimit';
    case 'not_food':
      return 'errors.notFood';
    case 'posts_limit':
      return 'errors.postsLimit';
    case 'community_disabled':
      return 'errors.communityDisabled';
    case 'product_not_found':
    case 'product_incomplete':
      return 'errors.productNotFound';
    case 'products_unavailable':
      return 'errors.productsUnavailable';
    case 'label_unreadable':
      return 'errors.labelUnreadable';
    case 'product_invalid':
      return 'errors.productInvalid';
    case 'products_limit':
      return 'errors.productsLimit';
    case 'barcode_taken':
      return 'errors.barcodeTaken';
    case 'macros_exceed':
      return 'errors.macrosExceed';
    case 'nothing_to_copy':
      return 'errors.nothingToCopy';
    case 'saved_meals_limit':
      return 'errors.savedMealsLimit';
    case 'content_rejected':
      // Motivul respingerii (de exemplu „adult”, „not_relevant”) are un mesaj propriu.
      return `social.rejected.${String(error.data.reason ?? 'unsafe')}`;
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
    case 404:
      return 'errors.notFound';
    case 413:
      return 'errors.imageTooLarge';
    case 423:
      return 'errors.locked';
    default:
      return 'errors.unknown';
  }
}
