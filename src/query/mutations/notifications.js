import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryClientInstance } from '@/lib/query-client';
import { queryKeys } from '../keys';

/**
 * Notifications Mutations
 * 
 * Mutations for managing user notifications with optimistic updates.
 */

/**
 * Mark notification as read with optimistic update
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ notificationId, companyId }) => {
      const { data, error } = await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);
      
      if (error) throw error;
      return data;
    },
    // Optimistic update
    onMutate: async ({ notificationId, companyId, userEmail }) => {
      const queryKey = queryKeys.tenant.notifications(companyId, userEmail);
      
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData(queryKey);
      
      // Optimistically mark as read
      queryClient.setQueryData(queryKey, (old = []) =>
        old.map(n => 
          n.id === notificationId 
            ? { ...n, read: true, read_at: new Date().toISOString() }
            : n
        )
      );
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.tenant.notifications(variables.companyId, variables.userEmail),
          context.previousData
        );
      }
    },
    onSettled: (data, error, variables) => {
      queryClientInstance.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            Array.isArray(key) &&
            key[0] === 'tenant' &&
            key[1] === variables.companyId &&
            key[2] === 'notifications'
          );
        },
      });
    },
  });
}

/**
 * Mark all notifications as read with optimistic update
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userEmail, companyId }) => {
      const { data, error } = await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('user_email', userEmail)
        .eq('read', false);
      
      if (error) throw error;
      return data;
    },
    // Optimistic update
    onMutate: async ({ userEmail, companyId }) => {
      const queryKey = queryKeys.tenant.notifications(companyId, userEmail);
      
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData(queryKey);
      
      // Optimistically mark all as read
      queryClient.setQueryData(queryKey, (old = []) =>
        old.map(n => ({ ...n, read: true, read_at: new Date().toISOString() }))
      );
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.tenant.notifications(variables.companyId, variables.userEmail),
          context.previousData
        );
      }
    },
    onSettled: (data, error, variables) => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.tenant.notifications(variables.companyId, variables.userEmail),
      });
    },
  });
}

/**
 * Delete notification with optimistic update
 */
export function useDeleteNotification() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ notificationId, companyId }) => {
      const { data, error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);
      
      if (error) throw error;
      return data;
    },
    // Optimistic update
    onMutate: async ({ notificationId, companyId, userEmail }) => {
      const queryKey = queryKeys.tenant.notifications(companyId, userEmail);
      
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData(queryKey);
      
      // Optimistically remove from list
      queryClient.setQueryData(queryKey, (old = []) =>
        old.filter(n => n.id !== notificationId)
      );
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.tenant.notifications(variables.companyId, variables.userEmail),
          context.previousData
        );
      }
    },
    onSettled: (data, error, variables) => {
      queryClientInstance.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            Array.isArray(key) &&
            key[0] === 'tenant' &&
            key[1] === variables.companyId &&
            key[2] === 'notifications'
          );
        },
      });
    },
  });
}
