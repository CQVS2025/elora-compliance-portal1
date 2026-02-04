import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star, StarOff, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import moment from 'moment';
import { toast } from '@/lib/toast';

// NEW: Import query options and mutations
import { favoritesOptions } from '@/query/options';
import { useToggleFavorite } from '@/query/mutations';

/**
 * Hook to manage favorite vehicles - MIGRATED TO TANSTACK QUERY OPTIONS
 */
export function useFavoriteVehicles(userEmail) {
  // Use queryOptions factory with proper user-scoped key
  const { data: favorites = [], isLoading } = useQuery(
    favoritesOptions(userEmail)
  );

  const [togglingVehicleRef, setTogglingVehicleRef] = useState(null);

  // Use mutation hook from mutations folder
  const toggleFavoriteMutation = useToggleFavorite();

  const isFavorite = (vehicleRef) => {
    if (!vehicleRef) return false;
    return favorites.some(fav => 
      fav.vehicleRef === vehicleRef || 
      fav.vehicle_ref === vehicleRef ||
      fav.vehicleRef === vehicleRef.toString() ||
      fav.vehicle_ref === vehicleRef.toString()
    );
  };

  const toggleFavorite = (vehicleRef, vehicleName) => {
    const currentlyFavorite = isFavorite(vehicleRef);
    setTogglingVehicleRef(vehicleRef);
    
    toggleFavoriteMutation.mutate(
      {
        userEmail,
        vehicleRef,
        vehicleName,
        isFavorite: !currentlyFavorite
      },
      {
        onSuccess: () => {
          setTogglingVehicleRef(null);
          if (!currentlyFavorite) {
            toast.success(`Added ${vehicleName} to favorites`);
          } else {
            toast.success(`Removed ${vehicleName} from favorites`);
          }
        },
        onError: (error) => {
          console.error('Error toggling favorite:', error);
          toast.error('Failed to update favorite');
          setTogglingVehicleRef(null);
        },
      }
    );
  };

  return {
    favorites,
    isLoading,
    isFavorite,
    toggleFavorite,
    isToggling: toggleFavoriteMutation.isPending,
    togglingVehicleRef
  };
}

/**
 * Favorite Star Button Component
 */
export function FavoriteButton({ vehicleRef, vehicleName, userEmail, className = '' }) {
  const { isFavorite, toggleFavorite, isToggling, togglingVehicleRef } = useFavoriteVehicles(userEmail);
  const favorite = isFavorite(vehicleRef);
  const hasUserEmail = !!userEmail;
  const isThisVehicleToggling = togglingVehicleRef === vehicleRef;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (hasUserEmail) {
          toggleFavorite(vehicleRef, vehicleName);
        }
      }}
      disabled={isThisVehicleToggling || !hasUserEmail}
      className={`
        p-1.5 rounded-lg transition-colors flex-shrink-0
        ${hasUserEmail 
          ? 'hover:bg-muted hover:scale-110 active:scale-95 cursor-pointer' 
          : 'opacity-50 cursor-not-allowed'
        }
        ${className}
      `}
      title={hasUserEmail 
        ? (favorite ? 'Remove from favorites' : 'Add to favorites')
        : 'Please log in to use favorites'
      }
    >
      {isThisVehicleToggling ? (
        <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />
      ) : favorite ? (
        <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
      ) : (
        <Star className={`w-5 h-5 ${hasUserEmail ? 'text-muted-foreground hover:text-yellow-500' : 'text-muted-foreground/60'}`} />
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
          ? 'bg-primary/10 text-primary border-2 border-primary/30'
          : 'bg-card text-foreground border-2 border-border hover:border-input'
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
      <div className={`bg-card rounded-2xl shadow-sm border border-border p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" />
          Favorite Vehicles
        </h3>
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!favorites || favorites.length === 0) {
    return (
      <div className={`bg-card rounded-2xl shadow-sm border border-border p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" />
          Favorite Vehicles
        </h3>
        <p className="text-muted-foreground text-sm text-center py-4">
          Click the star icon on any vehicle to add it to your favorites
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-card rounded-2xl shadow-sm border border-border p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
        Favorite Vehicles
        <span className="ml-auto text-sm font-normal text-muted-foreground">
          {favorites.length}
        </span>
      </h3>

      <div className="space-y-2">
        {favorites.map((fav) => (
          <button
            key={fav.id || fav.vehicleRef}
            onClick={() => onVehicleClick && onVehicleClick(fav.vehicleRef)}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
          >
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
            <span className="text-sm font-medium text-foreground truncate">
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
 * Shows favorite vehicles with ability to favorite/unfavorite
 */
export default function FavoriteVehicles({ vehicles, selectedCustomer, selectedSite, userEmail }) {
  const { favorites, isLoading, isFavorite, toggleFavorite, isToggling, togglingVehicleRef } = useFavoriteVehicles(userEmail);

  // Filter vehicles to show only favorites, or show all vehicles if no favorites
  const favoriteVehicles = useMemo(() => {
    if (!favorites || favorites.length === 0) {
      return [];
    }
    const favoriteRefs = new Set(
      favorites.map(fav => fav.vehicleRef || fav.vehicle_ref).filter(Boolean)
    );
    return vehicles.filter(v => {
      const vehicleRef = v.id || v.rfid || v.vehicleRef;
      return favoriteRefs.has(vehicleRef) || favoriteRefs.has(vehicleRef?.toString());
    });
  }, [vehicles, favorites]);

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" />
          Favorite Vehicles
        </h3>
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!userEmail) {
    return (
      <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" />
          Favorite Vehicles
        </h3>
        <p className="text-muted-foreground text-sm text-center py-4">
          Please log in to use favorites
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
          Favorite Vehicles
          {favorites && favorites.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-sm font-normal bg-primary/10 text-primary rounded-full">
              {favorites.length}
            </span>
          )}
        </h3>
      </div>

      {favoriteVehicles.length === 0 ? (
        <div className="text-center py-8">
          <Star className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm mb-2">
            No favorite vehicles yet
          </p>
          <p className="text-muted-foreground/80 text-xs">
            Click the star icon on any vehicle in the list below to add it to your favorites
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {favoriteVehicles.map((vehicle) => {
            const vehicleRef = vehicle.id || vehicle.rfid || vehicle.vehicleRef;
            const favorite = isFavorite(vehicleRef);
            const isCompliant = vehicle.washes_completed >= vehicle.target;

            return (
              <motion.div
                key={vehicleRef}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="
                  bg-card
                  border border-border
                  rounded-xl p-4
                  shadow-sm
                  hover:shadow-md
                  transition-all duration-200
                "
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-foreground truncate">
                      {vehicle.name}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {vehicle.site_name}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(vehicleRef, vehicle.name);
                    }}
                    disabled={togglingVehicleRef === vehicleRef}
                    className="p-1 rounded-lg hover:bg-muted transition-colors flex-shrink-0 ml-2"
                    title={favorite ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    {togglingVehicleRef === vehicleRef ? (
                      <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />
                    ) : (
                      <Star className={`w-4 h-4 ${favorite ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} />
                    )}
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Washes</span>
                    <span className="text-sm font-semibold text-foreground">
                      {vehicle.washes_completed}/{vehicle.target}
                    </span>
                  </div>

                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isCompliant
                          ? 'bg-primary'
                          : 'bg-amber-500'
                      }`}
                      style={{
                        width: `${Math.min(100, Math.round((vehicle.washes_completed / vehicle.target) * 100))}%`
                      }}
                    />
                  </div>

                  {vehicle.last_scan && (
                    <p className="text-xs text-muted-foreground">
                      Last: {moment(vehicle.last_scan).fromNow()}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
