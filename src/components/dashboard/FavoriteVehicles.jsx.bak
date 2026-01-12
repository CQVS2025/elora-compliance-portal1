import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, StarOff, Loader2 } from 'lucide-react';
import { base44 } from "@/api/base44Client";
import { toast } from 'sonner';

/**
 * Hook to manage favorite vehicles
 */
export function useFavoriteVehicles(userEmail) {
  const queryClient = useQueryClient();

  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ['favoriteVehicles', userEmail],
    queryFn: async () => {
      if (!userEmail) return [];
      try {
        const response = await base44.functions.invoke('elora_get_favorites', { userEmail });
        return response.data || [];
      } catch (error) {
        console.error('Error fetching favorites:', error);
        return [];
      }
    },
    enabled: !!userEmail,
    staleTime: 30000,
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ vehicleRef, vehicleName, isFavorite }) => {
      const response = await base44.functions.invoke('elora_toggle_favorite', {
        userEmail,
        vehicleRef,
        vehicleName,
        isFavorite
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['favoriteVehicles', userEmail]);
    },
    onError: (error) => {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite');
    }
  });

  const isFavorite = (vehicleRef) => {
    return favorites.some(fav => fav.vehicleRef === vehicleRef);
  };

  const toggleFavorite = (vehicleRef, vehicleName) => {
    const currentlyFavorite = isFavorite(vehicleRef);
    toggleFavoriteMutation.mutate({
      vehicleRef,
      vehicleName,
      isFavorite: !currentlyFavorite
    });

    if (!currentlyFavorite) {
      toast.success(`Added ${vehicleName} to favorites`);
    } else {
      toast.success(`Removed ${vehicleName} from favorites`);
    }
  };

  return {
    favorites,
    isLoading,
    isFavorite,
    toggleFavorite,
    isToggling: toggleFavoriteMutation.isPending
  };
}

/**
 * Favorite Star Button Component
 */
export function FavoriteButton({ vehicleRef, vehicleName, userEmail, className = '' }) {
  const { isFavorite, toggleFavorite, isToggling } = useFavoriteVehicles(userEmail);
  const favorite = isFavorite(vehicleRef);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggleFavorite(vehicleRef, vehicleName);
      }}
      disabled={isToggling}
      className={`p-1.5 rounded-lg hover:bg-slate-100 transition-colors ${className}`}
      title={favorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      {isToggling ? (
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
      ) : favorite ? (
        <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
      ) : (
        <Star className="w-5 h-5 text-slate-400" />
      )}
    </button>
  );
}

/**
 * Favorites Filter Component
 */
export function FavoritesFilter({ vehicles, userEmail, onFilterChange }) {
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const { favorites, isLoading } = useFavoriteVehicles(userEmail);

  const filteredVehicles = useMemo(() => {
    if (!showOnlyFavorites || !favorites || favorites.length === 0) {
      return vehicles;
    }
    const favoriteRefs = new Set(favorites.map(fav => fav.vehicleRef));
    return vehicles.filter(v => favoriteRefs.has(v.id) || favoriteRefs.has(v.rfid));
  }, [vehicles, favorites, showOnlyFavorites]);

  React.useEffect(() => {
    if (onFilterChange) {
      onFilterChange(filteredVehicles);
    }
  }, [filteredVehicles, onFilterChange]);

  if (!userEmail || isLoading) return null;

  const favoriteCount = favorites.length;

  return (
    <button
      onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
        showOnlyFavorites
          ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-300'
          : 'bg-white text-slate-600 border-2 border-slate-200 hover:border-slate-300'
      }`}
    >
      {showOnlyFavorites ? (
        <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
      ) : (
        <StarOff className="w-4 h-4" />
      )}
      <span>
        {showOnlyFavorites ? 'Show All' : 'Favorites Only'}
      </span>
      {favoriteCount > 0 && (
        <span className="ml-1 px-2 py-0.5 bg-yellow-500 text-white text-xs rounded-full">
          {favoriteCount}
        </span>
      )}
    </button>
  );
}

/**
 * Favorites Quick List Component
 */
export function FavoritesQuickList({ userEmail, onVehicleClick, className = '' }) {
  const { favorites, isLoading } = useFavoriteVehicles(userEmail);

  if (isLoading) {
    return (
      <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" />
          Favorite Vehicles
        </h3>
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-slate-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!favorites || favorites.length === 0) {
    return (
      <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" />
          Favorite Vehicles
        </h3>
        <p className="text-slate-500 text-sm text-center py-4">
          Click the star icon on any vehicle to add it to your favorites
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
        <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
        Favorite Vehicles
        <span className="ml-auto text-sm font-normal text-slate-500">
          {favorites.length}
        </span>
      </h3>

      <div className="space-y-2">
        {favorites.map((fav) => (
          <button
            key={fav.id || fav.vehicleRef}
            onClick={() => onVehicleClick && onVehicleClick(fav.vehicleRef)}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors text-left"
          >
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
            <span className="text-sm font-medium text-slate-800 truncate">
              {fav.vehicleName}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Default Export - Dashboard Favorite Vehicles Widget
 * Adapts FavoritesQuickList for use in Dashboard with user context
 */
export default function FavoriteVehicles({ vehicles, selectedCustomer, selectedSite }) {
  // Get user email from context or permissions
  const userEmail = typeof window !== 'undefined'
    ? localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail')
    : null;

  return (
    <FavoritesQuickList
      userEmail={userEmail}
      onVehicleClick={(vehicleRef) => {
        // Could navigate to vehicle details or filter table
        console.log('Clicked favorite vehicle:', vehicleRef);
      }}
    />
  );
}
