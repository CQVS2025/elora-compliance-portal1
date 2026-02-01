/**
 * User-Friendly Error Messages
 * Converts technical error messages into simple, layman-readable messages
 */

/**
 * Convert technical error message to user-friendly message
 * @param {string|Error} error - The error object or message
 * @param {string} context - Context of the error (e.g., 'creating user', 'updating company')
 * @returns {string} User-friendly error message
 */
export function getUserFriendlyError(error, context = '') {
  const errorMessage = typeof error === 'string' ? error : error?.message || 'Something went wrong';
  const lowerError = errorMessage.toLowerCase();
  
  console.log('getUserFriendlyError called with:', { errorMessage, lowerError, context });

  // Database/Connection errors
  if (lowerError.includes('timeout') || lowerError.includes('timed out')) {
    return 'Connection is slow. Please check your internet and try again.';
  }

  if (lowerError.includes('network') || lowerError.includes('fetch failed')) {
    return 'Cannot connect to the server. Please check your internet connection.';
  }

  if (lowerError.includes('connection') || lowerError.includes('econnrefused')) {
    return 'Server is not responding. Please try again in a moment.';
  }

  // Authentication errors
  if (lowerError.includes('deactivated') || lowerError.includes('account has been deactivated')) {
    return 'Your account has been deactivated. Please contact your administrator to reactivate it.';
  }

  if (lowerError.includes('not assigned') || lowerError.includes('unassigned') || lowerError.includes('no company')) {
    return 'You are not assigned to any company. Please contact your administrator.';
  }

  if (lowerError.includes('invalid login') || lowerError.includes('invalid credentials')) {
    return 'Email or password is incorrect. Please try again.';
  }

  if (lowerError.includes('email not confirmed') || lowerError.includes('email not verified')) {
    return 'Please verify your email address before logging in.';
  }

  if (lowerError.includes('user not found') || lowerError.includes('user does not exist')) {
    return 'No account found with this email address.';
  }

  if (lowerError.includes('password') && lowerError.includes('weak')) {
    return 'Password is too weak. Please use at least 6 characters.';
  }

  // Check for already registered/exists email
  const hasAlreadyRegistered = lowerError.includes('already registered');
  const hasAlreadyExists = lowerError.includes('already exists');
  const hasUserWithEmail = lowerError.includes('user with email');
  console.log('Email duplicate checks:', { hasAlreadyRegistered, hasAlreadyExists, hasUserWithEmail });
  
  if (hasAlreadyRegistered || hasAlreadyExists || hasUserWithEmail) {
    // Extract email from error message if present for better UX
    const emailMatch = errorMessage.match(/["']([^"']+@[^"']+)["']/);
    console.log('Email already registered check matched!', { emailMatch });
    if (emailMatch) {
      return `The email ${emailMatch[1]} is already registered. Please use a different email address.`;
    }
    return 'This email is already registered. Please use a different email address.';
  }

  // Permission errors
  if (lowerError.includes('permission') || lowerError.includes('not authorized') || lowerError.includes('forbidden')) {
    return 'You don\'t have permission to do this. Please contact your administrator.';
  }

  if (lowerError.includes('access denied')) {
    return 'Access denied. Please contact your administrator.';
  }

  // Validation errors
  if (lowerError.includes('required') || lowerError.includes('missing')) {
    return 'Please fill in all required fields.';
  }

  if (lowerError.includes('invalid email')) {
    return 'Please enter a valid email address.';
  }

  if (lowerError.includes('duplicate') || lowerError.includes('unique constraint')) {
    return 'This information already exists. Please use different details.';
  }

  // Schema/Database errors
  if (lowerError.includes('column') && lowerError.includes('not found')) {
    return 'System configuration error. Please contact support.';
  }

  if (lowerError.includes('schema cache')) {
    return 'System is updating. Please try again in a moment.';
  }

  // File/Upload errors
  if (lowerError.includes('file too large') || lowerError.includes('size')) {
    return 'File is too large. Please use a smaller file.';
  }

  if (lowerError.includes('file type') || lowerError.includes('format not supported')) {
    return 'File type is not supported. Please use a different file.';
  }

  // Rate limiting
  if (lowerError.includes('too many requests') || lowerError.includes('rate limit')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }

  // Generic fallback with context
  if (context) {
    return `Unable to complete ${errorMessage}. Please try again or contact support.`;
  }

  // Last resort - return a generic friendly message
  return 'Something went wrong. Please try again or contact support if the problem continues.';
}

/**
 * Get success message for common actions
 * @param {string} action - The action performed (e.g., 'create', 'update', 'delete')
 * @param {string} entity - The entity affected (e.g., 'user', 'company', 'vehicle')
 * @returns {object} Toast message object with title and description
 */
export function getSuccessMessage(action, entity) {
  const messages = {
    create: {
      title: 'Created Successfully',
      description: `${capitalize(entity)} has been created.`
    },
    update: {
      title: 'Updated Successfully',
      description: `${capitalize(entity)} has been updated.`
    },
    delete: {
      title: 'Deleted Successfully',
      description: `${capitalize(entity)} has been deleted.`
    },
    save: {
      title: 'Saved Successfully',
      description: `Your changes have been saved.`
    },
    copy: {
      title: 'Copied',
      description: 'Copied to clipboard.'
    },
    send: {
      title: 'Sent Successfully',
      description: `${capitalize(entity)} has been sent.`
    },
    activate: {
      title: 'Activated',
      description: `${capitalize(entity)} is now active.`
    },
    deactivate: {
      title: 'Deactivated',
      description: `${capitalize(entity)} is now inactive.`
    }
  };

  return messages[action] || {
    title: 'Success',
    description: 'Action completed successfully.'
  };
}

/**
 * Capitalize first letter of a string
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format error for toast display
 * @param {string|Error} error - The error
 * @param {string} context - Context of the error
 * @returns {object} Toast message object
 */
export function formatErrorForToast(error, context = '') {
  return {
    title: 'Error',
    description: getUserFriendlyError(error, context),
    variant: 'destructive'
  };
}

/**
 * Format success for toast display
 * @param {string} action - The action performed
 * @param {string} entity - The entity affected
 * @returns {object} Toast message object
 */
export function formatSuccessForToast(action, entity) {
  return getSuccessMessage(action, entity);
}

