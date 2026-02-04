/**
 * App-wide toast via Sonner (shadcn/ui).
 * Use this instead of useToast for consistency.
 */
export { toast } from 'sonner';
import { toast as sonnerToast } from 'sonner';
import { getUserFriendlyError, getSuccessMessage } from '@/utils/errorMessages';

/**
 * Show an error toast using formatted message from errorMessages.
 * @param {Error|string} error
 * @param {string} [context]
 */
export function toastError(error, context = '') {
  sonnerToast.error(getUserFriendlyError(error, context));
}

/**
 * Show a success toast using formatSuccessForToast / getSuccessMessage.
 * @param {string} action - e.g. 'create', 'update', 'delete', 'save', 'copy'
 * @param {string} entity - e.g. 'company', 'user'
 */
export function toastSuccess(action, entity) {
  const m = getSuccessMessage(action, entity);
  sonnerToast.success(m.title, { description: m.description });
}
