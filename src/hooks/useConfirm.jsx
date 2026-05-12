import React, { useCallback, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * useConfirm — async confirmation dialog hook backed by shadcn AlertDialog.
 *
 * Returns:
 *   {
 *     confirm: (opts) => Promise<boolean>,
 *     ConfirmDialog: ReactNode,
 *   }
 *
 * Usage in a component:
 *
 *   const { confirm, ConfirmDialog } = useConfirm();
 *
 *   const handleDelete = async () => {
 *     const ok = await confirm({
 *       title: 'Delete "Green Acid"?',
 *       description: 'This will also remove all packaging prices and SDS docs.',
 *       confirmLabel: 'Delete',
 *       destructive: true,
 *     });
 *     if (!ok) return;
 *     await deleteMutation.mutateAsync(...);
 *   };
 *
 *   return (
 *     <>
 *       ...
 *       {ConfirmDialog}
 *     </>
 *   );
 *
 * Keeps the imperative `if (!ok) return;` style native window.confirm() gave
 * us, but uses a fully theme-aware, accessible dialog with proper focus
 * handling and keyboard support (Escape to cancel, Enter to confirm).
 */

const DEFAULTS = {
  title: 'Are you sure?',
  description: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  destructive: false,
};

export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState(DEFAULTS);
  const resolverRef = useRef(null);

  const settle = useCallback((result) => {
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
    setOpen(false);
  }, []);

  const confirm = useCallback((opts = {}) => {
    setOptions({ ...DEFAULTS, ...opts });
    setOpen(true);
    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const ConfirmDialog = (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        // Escape key, overlay click, or programmatic close
        if (!nextOpen) settle(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{options.title}</AlertDialogTitle>
          {options.description ? (
            <AlertDialogDescription>{options.description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>
            {options.cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => settle(true)}
            className={
              options.destructive
                ? cn(buttonVariants({ variant: 'destructive' }))
                : undefined
            }
          >
            {options.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, ConfirmDialog };
}

export default useConfirm;
