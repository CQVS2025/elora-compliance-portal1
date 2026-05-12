import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/AuthContext';
import { useMarketplaceAccess } from '@/hooks/useMarketplaceAccess';
import { cartOptions } from '@/query/options/marketplace';

/**
 * Header-mounted cart shortcut.
 *
 * Renders only for users who can shop (their company has marketplace_enabled).
 * Marketplace admins, super_admins without a buyer company, and users from
 * disabled companies don't see this button.
 *
 * The count badge sits in the upper-right corner of the icon and only shows
 * when there's at least one item in the cart, capped at "99+".
 */
export default function CartHeaderButton() {
  const { user, userProfile } = useAuth();
  const { canShop } = useMarketplaceAccess();
  const userId = user?.id;
  const companyId = userProfile?.company_id;

  const { data: items = [] } = useQuery({
    ...cartOptions(companyId, userId),
    enabled: !!canShop && !!userId && !!companyId,
  });

  if (!canShop) return null;

  const count = items.length;
  const label = count === 0 ? 'Cart (empty)' : `Cart, ${count} item${count === 1 ? '' : 's'}`;

  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="relative h-9 w-9"
            aria-label={label}
          >
            <Link to="/marketplace/cart">
              <ShoppingCart className="w-4 h-4" />
              {count > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full border-2 border-background bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
                  aria-hidden
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
