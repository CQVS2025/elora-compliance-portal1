import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Apple-style Modal Component
 * Follows Apple Human Interface Guidelines with smooth animations and glassmorphism
 */
export default function AppleModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'default',
  showCloseButton = true,
  closeOnBackdrop = true,
  footer,
}) {
  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const sizes = {
    sm: 'max-w-sm',
    default: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'max-w-[calc(100vw-2rem)]',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeOnBackdrop ? onClose : undefined}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* Modal content */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className={`
              relative w-full ${sizes[size]}
              rounded-xl border bg-card text-card-foreground shadow-lg
              overflow-hidden
            `}
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <div className="px-8 pt-8 pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {title && (
                      <h2 className="text-2xl font-bold text-foreground">
                        {title}
                      </h2>
                    )}
                    {description && (
                      <p className="mt-1 text-muted-foreground">
                        {description}
                      </p>
                    )}
                  </div>
                  {showCloseButton && (
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                      <X className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Content */}
            <div className="px-8 py-6">{children}</div>

            {/* Footer */}
            {footer && (
              <div className="px-8 pb-8 pt-2 flex gap-3 justify-end">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/**
 * Confirmation Dialog - For delete/destructive actions
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'destructive',
  loading = false,
}) {
  return (
    <AppleModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmText}
          </Button>
        </>
      }
    />
  );
}

/**
 * Sheet - Bottom sheet for mobile, modal for desktop
 */
export function Sheet({ isOpen, onClose, title, children }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* Sheet content */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="
              absolute bottom-0 left-0 right-0
              rounded-t-xl border border-b-0 bg-card text-card-foreground
              max-h-[85vh] overflow-hidden shadow-lg
            "
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            {title && (
              <div className="px-6 pb-4 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">
                  {title}
                </h2>
              </div>
            )}

            {/* Content */}
            <div className="px-6 py-4 overflow-y-auto max-h-[calc(85vh-100px)]">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
