import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Home,
  DollarSign,
  Droplets,
  Activity,
  MapPin,
  FileText,
  Mail,
  Palette,
  Sparkles,
  MessageSquare,
  ClipboardList,
  CalendarDays,
  CalendarClock,
  Package,
  ImageIcon,
  Bell,
  Store,
  ShoppingCart,
  ChevronDown,
  Compass,
  Receipt,
  Truck,
  Plug,
  Settings,
} from 'lucide-react';
import { useAvailableTabs, usePermissions } from '@/components/auth/PermissionGuard';
import { useMarketplaceAccess } from '@/hooks/useMarketplaceAccess';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const DASHBOARD_NAV_ITEM = { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/' };

const ALL_TABS = [
  DASHBOARD_NAV_ITEM,
  { value: 'compliance', label: 'Compliance', icon: Home, path: '/compliance' },
  { value: 'vehicle-image-log', label: 'Vehicle Image Log', icon: ImageIcon, path: '/vehicle-image-log' },
  { value: 'operations-log', label: 'Operations Log', icon: ClipboardList, path: '/operations-log' },
  { value: 'delivery-calendar', label: 'Delivery Calendar', icon: CalendarDays, path: '/delivery-calendar' },
  { value: 'alerts', label: 'Alerts', icon: Bell, path: '/alerts', showNewBadge: false },
  { value: 'report-schedules', label: 'Report Schedules', icon: CalendarClock, path: '/report-schedules', showNewBadge: false },
  { value: 'stock-orders', label: 'Stock & Orders', icon: Package, path: '/stock-orders' },
  { value: 'costs', label: 'Usage Costs', icon: DollarSign, path: '/usage-costs' },
  { value: 'refills', label: 'Tank Levels', icon: Droplets, path: '/tank-levels' },
  { value: 'devices', label: 'Device Health', icon: Activity, path: '/device-health' },
  { value: 'sites', label: 'Sites', icon: MapPin, path: '/sites' },
  { value: 'reports', label: 'Reports', icon: FileText, path: '/reports' },
  { value: 'email-reports', label: 'Email Reports', icon: Mail, path: '/email-reports' },
  { value: 'branding', label: 'Branding', icon: Palette, path: '/branding' },
];

const MAIN_TABS = ALL_TABS.filter((t) => t.value !== 'dashboard');

const INTELLIGENCE_TABS = [
  { value: 'ai-insights', label: 'Elora AI', icon: Sparkles, path: '/ai-insights', showNewBadge: false },
  { value: 'sms-alerts', label: 'Alerts History', icon: MessageSquare, path: '/sms-alerts', showNewBadge: false },
];

const MARKETPLACE_BUYER_ITEM = { value: 'marketplace', label: 'Marketplace', icon: Store, path: '/marketplace' };
const MARKETPLACE_CART_ITEM = { value: 'marketplace-cart', label: 'My Cart', icon: ShoppingCart, path: '/marketplace/cart' };
const MARKETPLACE_ORDERS_ITEM = { value: 'marketplace-orders', label: 'My Orders', icon: Receipt, path: '/marketplace/orders' };
const MARKETPLACE_ADMIN_ITEM = { value: 'marketplace-admin', label: 'Marketplace Admin', icon: Store, path: '/admin/marketplace' };
const MARKETPLACE_ADMIN_ORDERS_ITEM = { value: 'marketplace-admin-orders', label: 'Orders', icon: Receipt, path: '/admin/marketplace/orders' };
const MARKETPLACE_ADMIN_INTEGRATIONS_ITEM = { value: 'marketplace-admin-integrations', label: 'Integrations', icon: Plug, path: '/admin/marketplace/integrations' };
const MARKETPLACE_ADMIN_SETTINGS_ITEM = { value: 'marketplace-admin-settings', label: 'Settings', icon: Settings, path: '/admin/marketplace/settings' };
const MARKETPLACE_ADMIN_FREIGHT_ITEM = { value: 'marketplace-admin-freight', label: 'Freight', icon: Truck, path: '/admin/marketplace/freight' };
const MARKETPLACE_ADMIN_FREIGHT_PRODUCTS_ITEM = { value: 'marketplace-admin-freight-products', label: 'Per-product setup', icon: Truck, path: '/admin/marketplace/freight/products' };
const WAREHOUSE_DISPATCH_ITEM = { value: 'warehouse-orders', label: 'Dispatch', icon: Truck, path: '/warehouse/orders' };

/**
 * Renders a single nav item with optional "New" badge.
 */
function NavItem({ item, isActive, onNavigate }) {
  const Icon = item.icon;
  return (
    <SidebarMenuItem key={item.value}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarMenuButton asChild isActive={isActive}>
              <a
                href={item.path}
                className="flex items-center gap-2"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(item.path);
                }}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
                {item.showNewBadge && (
                  <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">New</Badge>
                )}
              </a>
            </SidebarMenuButton>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{item.label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </SidebarMenuItem>
  );
}

/**
 * Collapsible group wrapper.
 *
 * Has TWO render modes driven by the surrounding sidebar's collapse state:
 *
 *   • Expanded sidebar (default desktop / mobile sheet) — renders a Radix
 *     Collapsible with the text label as a trigger button. Expand / collapse
 *     animates via the `collapsible-down` and `collapsible-up` keyframes
 *     (defined in tailwind.config.js, driven by the
 *     --radix-collapsible-content-height var). Children are sub-tab rows
 *     with full text labels.
 *
 *   • Icon-collapsed sidebar (desktop only) — renders a single 36×36 icon
 *     button that represents the whole group. Clicking it expands the
 *     sidebar AND opens this group's accordion, so the user lands on the
 *     expanded view with the right group already open. Hover shows a
 *     tooltip with the group name.
 *
 * The group label / icon never picks up an "active" colour even when one of
 * its child items is the current route. Only the selected sub-tab row
 * (a SidebarMenuButton) renders in the active style.
 */
function CollapsibleGroup({ label, groupIcon: GroupIcon, isOpen, onToggle, onForceOpen, children }) {
  const { state: sidebarState, setOpen: setSidebarOpen, isMobile } = useSidebar();
  const inIconMode = sidebarState === 'collapsed' && !isMobile;

  if (inIconMode) {
    return (
      <SidebarGroup className="py-1">
        <TooltipProvider delayDuration={120}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={label}
                onClick={() => {
                  setSidebarOpen(true);
                  onForceOpen?.();
                }}
                className={cn(
                  'mx-auto flex h-9 w-9 items-center justify-center rounded-md',
                  'text-sidebar-foreground/70 transition-colors',
                  'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                )}
              >
                {GroupIcon ? <GroupIcon className="size-4" /> : null}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{label}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup>
      <Collapsible open={isOpen} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            aria-expanded={isOpen}
            className={cn(
              'group flex w-full items-center justify-between rounded-md px-2 py-1.5',
              'text-xs font-medium uppercase tracking-wider transition-colors',
              'text-sidebar-foreground/70',
              'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
            )}
          >
            <span>{label}</span>
            <ChevronDown
              className={cn(
                'size-3.5 transition-transform duration-200 ease-out',
                'group-data-[state=closed]:-rotate-90',
                'group-data-[state=open]:rotate-0',
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent
          className={cn(
            'overflow-hidden',
            'data-[state=open]:animate-collapsible-down',
            'data-[state=closed]:animate-collapsible-up',
          )}
        >
          <SidebarGroupContent>
            <SidebarMenu>{children}</SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );
}

/**
 * Main sidebar navigation. Three accordion groups:
 *   - Navigation (open by default)
 *   - Intelligence
 *   - Marketplace
 *
 * Behaviour: at most one group is expanded at a time. Clicking a collapsed
 * group expands it and closes the others; clicking the currently-open group
 * collapses it. On first mount, the group containing the current route is
 * opened automatically (so the active page is visible without an extra
 * click) — falling back to "navigation" when no route matches.
 */
export default function NavMain() {
  const navigate = useNavigate();
  const location = useLocation();
  const { effectiveTabValues = [] } = usePermissions();
  const availableTabs = useAvailableTabs(MAIN_TABS);
  const availableIntelligenceTabs = useAvailableTabs(INTELLIGENCE_TABS);
  const { canSee: marketplaceCanSee, canShop: marketplaceCanShop, canAdminister: marketplaceCanAdminister } = useMarketplaceAccess();
  const currentPath = location.pathname;
  const isDashboardActive = currentPath === '/' || currentPath === '/dashboard' || currentPath === '/Dashboard';
  const showDashboard = effectiveTabValues.includes('dashboard');
  const isMarketplaceActive = currentPath === '/marketplace' || currentPath.startsWith('/marketplace/products');
  const isMarketplaceCartActive = currentPath === '/marketplace/cart';
  const isMarketplaceOrdersActive = currentPath === '/marketplace/orders' || currentPath.startsWith('/marketplace/orders/');
  const isMarketplaceAdminActive = currentPath === '/admin/marketplace';
  const isMarketplaceAdminOrdersActive = currentPath.startsWith('/admin/marketplace/orders');
  const isMarketplaceAdminIntegrationsActive = currentPath.startsWith('/admin/marketplace/integrations');
  const isMarketplaceAdminFreightActive = currentPath === '/admin/marketplace/freight';
  const isMarketplaceAdminFreightProductsActive = currentPath.startsWith('/admin/marketplace/freight/products');
  const isMarketplaceAdminSettingsActive = currentPath.startsWith('/admin/marketplace/settings');
  const isWarehouseDispatchActive = currentPath.startsWith('/warehouse/');

  // Resolve which group should be open at first mount based on the current
  // route, falling back to "navigation". After mount, the user controls
  // expansion manually.
  const [openGroup, setOpenGroup] = useState(() => {
    if (INTELLIGENCE_TABS.some((t) => currentPath === t.path)) return 'intelligence';
    if (isMarketplaceActive || isMarketplaceCartActive || isMarketplaceAdminActive) return 'marketplace';
    return 'navigation';
  });

  const toggle = (groupId) => setOpenGroup((prev) => (prev === groupId ? null : groupId));

  return (
    <>
      <CollapsibleGroup
        label="Operations"
        groupIcon={Compass}
        isOpen={openGroup === 'navigation'}
        onToggle={() => toggle('navigation')}
        onForceOpen={() => setOpenGroup('navigation')}
      >
        {showDashboard && (
          <NavItem item={DASHBOARD_NAV_ITEM} isActive={isDashboardActive} onNavigate={navigate} />
        )}
        {availableTabs.map((item) => {
          const isActive = currentPath === item.path;
          return <NavItem key={item.value} item={item} isActive={isActive} onNavigate={navigate} />;
        })}
      </CollapsibleGroup>

      {availableIntelligenceTabs.length > 0 && (
        <CollapsibleGroup
          label="Intelligence"
          groupIcon={Sparkles}
          isOpen={openGroup === 'intelligence'}
          onToggle={() => toggle('intelligence')}
          onForceOpen={() => setOpenGroup('intelligence')}
        >
          {availableIntelligenceTabs.map((item) => {
            const isActive = currentPath === item.path;
            return <NavItem key={item.value} item={item} isActive={isActive} onNavigate={navigate} />;
          })}
        </CollapsibleGroup>
      )}

      {marketplaceCanSee && (
        <CollapsibleGroup
          label="Marketplace"
          groupIcon={Store}
          isOpen={openGroup === 'marketplace'}
          onToggle={() => toggle('marketplace')}
          onForceOpen={() => setOpenGroup('marketplace')}
        >
          {/* Marketplace tab is visible to admins (preview) AND buyers. */}
          <NavItem item={MARKETPLACE_BUYER_ITEM} isActive={isMarketplaceActive} onNavigate={navigate} />
          {/* Shopping-only items: cart + my orders */}
          {marketplaceCanShop && (
            <>
              <NavItem item={MARKETPLACE_CART_ITEM} isActive={isMarketplaceCartActive} onNavigate={navigate} />
              <NavItem item={MARKETPLACE_ORDERS_ITEM} isActive={isMarketplaceOrdersActive} onNavigate={navigate} />
            </>
          )}
          {/* Admin-only items */}
          {marketplaceCanAdminister && (
            <>
              <NavItem item={MARKETPLACE_ADMIN_ITEM} isActive={isMarketplaceAdminActive} onNavigate={navigate} />
              <NavItem item={MARKETPLACE_ADMIN_ORDERS_ITEM} isActive={isMarketplaceAdminOrdersActive} onNavigate={navigate} />
              <NavItem item={MARKETPLACE_ADMIN_FREIGHT_ITEM} isActive={isMarketplaceAdminFreightActive} onNavigate={navigate} />
              <NavItem item={MARKETPLACE_ADMIN_FREIGHT_PRODUCTS_ITEM} isActive={isMarketplaceAdminFreightProductsActive} onNavigate={navigate} />
              <NavItem item={MARKETPLACE_ADMIN_INTEGRATIONS_ITEM} isActive={isMarketplaceAdminIntegrationsActive} onNavigate={navigate} />
              <NavItem item={MARKETPLACE_ADMIN_SETTINGS_ITEM} isActive={isMarketplaceAdminSettingsActive} onNavigate={navigate} />
            </>
          )}
        </CollapsibleGroup>
      )}

      {/* Warehouse group — only visible to users mapped to a warehouse via marketplace_warehouse_users. */}
      <WarehouseGroup
        openGroup={openGroup}
        toggle={toggle}
        setOpenGroup={setOpenGroup}
        isActive={isWarehouseDispatchActive}
        navigate={navigate}
      />
    </>
  );
}

// ============================================================================
// Warehouse group — shown only when the user is mapped to at least one
// warehouse. Lightweight check via Supabase from inside this component so it
// doesn't slow down NavMain rendering for the 99% of users who aren't
// warehouse staff.
// ============================================================================
function WarehouseGroup({ openGroup, toggle, setOpenGroup, isActive, navigate }) {
  const { user } = useAuth();
  const [hasWarehouse, setHasWarehouse] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!user?.id) { setHasWarehouse(false); return; }
    supabase
      .from('marketplace_warehouse_users')
      .select('warehouse_id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .then(({ count }) => { if (alive) setHasWarehouse((count ?? 0) > 0); });
    return () => { alive = false; };
  }, [user?.id]);

  if (!hasWarehouse) return null;
  return (
    <CollapsibleGroup
      label="Warehouse"
      groupIcon={Truck}
      isOpen={openGroup === 'warehouse'}
      onToggle={() => toggle('warehouse')}
      onForceOpen={() => setOpenGroup('warehouse')}
    >
      <NavItem item={WAREHOUSE_DISPATCH_ITEM} isActive={isActive} onNavigate={navigate} />
    </CollapsibleGroup>
  );
}
