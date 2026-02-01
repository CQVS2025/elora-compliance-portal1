import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/supabase';
import { queryClientInstance } from '@/lib/query-client';
import { queryKeys } from '../keys';

/**
 * Favorites Mutations
 * 
 * Mutations for managing user favorite vehicles with optimistic updates.
 */

/**
 * Toggle favorite vehicle with optimistic update for instant UI feedback
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userEmail, vehicleRef, vehicleName, isFavorite }) => {
      const response = await callEdgeFunction('elora_toggle_favorite', {
        userEmail,
        vehicleRef,
        vehicleName,
        isFavorite,
      });
      return response;
    },
    // Optimistic update for instant UI feedback
    onMutate: async ({ userEmail, vehicleRef, vehicleName, isFavorite }) => {
      const queryKey = queryKeys.user.favorites(userEmail);
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });
      
      // Snapshot the previous value
      const previousFavorites = queryClient.getQueryData(queryKey);
      
      // Optimistically update the cache
      queryClient.setQueryData(queryKey, (old = []) => {
        if (isFavorite) {
          // Adding to favorites
          return [...old, { vehicleRef, vehicleName, userEmail }];
        } else {
          // Removing from favorites
          return old.filter(fav => fav.vehicleRef !== vehicleRef);
        }
      });
      
      // Return context with previous value for rollback
      return { previousFavorites };
    },
    // Rollback on error
    onError: (err, variables, context) => {
      if (context?.previousFavorites) {
        queryClient.setQueryData(
          queryKeys.user.favorites(variables.userEmail),
          context.previousFavorites
        );
      }
    },
    // Always refetch after error or success to ensure consistency
    onSettled: (data, error, variables) => {
      queryClientInstance.invalidateQueries({
        queryKey: queryKeys.user.favorites(variables.userEmail),
      });
    },
  });
}
