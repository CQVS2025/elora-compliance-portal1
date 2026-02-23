import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Truck, Droplet } from 'lucide-react';
import { cn } from '@/lib/utils';
import TankLevelBar from '@/components/tankLevels/TankLevelBar';

function productLabel(productType) {
  if (productType === 'TW') return 'TW';
  if (productType === 'GEL') return 'GEL';
  return 'ECSR';
}

/** Prefer actual product name from last refill (matches CMS Products); else short type. */
function tankProductDisplay(tank) {
  const name = tank.lastRefill?.productName ?? tank.lastRefill?.product;
  if (name && typeof name === 'string' && name.trim()) return name.trim();
  return productLabel(tank.product_type);
}

function displayLocation(site) {
  const loc = site?.location;
  if (loc && typeof loc === 'string' && loc !== 'undefined' && !/^(undefined|null)/i.test(loc)) return loc;
  const suburb = site?.suburb ?? site?.addr_suburb ?? '';
  const state = site?.stateShort ?? site?.state_short ?? site?.state ?? '';
  if (suburb && state) return `${suburb}, ${state}`;
  return state || suburb || '—';
}

export default function TankLevelDetailSheet({ site, open, onOpenChange }) {
  if (!site) return null;

  const locationText = displayLocation(site);
  const calibrationRate = site.tanks?.[0]?.calibration_rate_per_60s ?? 2.5;

  const statusColor = {
    CRITICAL: 'text-red-500 dark:text-red-400',
    WARNING: 'text-orange-500 dark:text-orange-400',
    OK: 'text-green-600 dark:text-green-400',
    NO_DEVICE: 'text-muted-foreground',
    NO_DATA: 'text-muted-foreground',
  }[site.overallStatus] || 'text-muted-foreground';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto bg-background/95 backdrop-blur"
      >
        <SheetHeader className="text-left space-y-1 pb-4 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-xs font-medium">
              {site.customer || 'Unknown customer'}
            </Badge>
          </div>
          <SheetTitle className="text-xl font-bold">{site.siteName}</SheetTitle>
          <SheetDescription>
            {locationText}
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* Status & Calibration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Status
              </p>
              <p className={cn('font-semibold', statusColor)}>{site.overallStatus}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Calibration
              </p>
              <p className="text-sm font-medium text-primary">{calibrationRate} L/60s</p>
            </div>
          </div>

          {/* Vehicles & Tanks summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Vehicles
              </p>
              <p className="text-2xl font-bold">{site.vehicleCount ?? 0}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Tanks
              </p>
              <p className="text-2xl font-bold">{site.tanks?.length ?? 0}</p>
            </div>
          </div>

          {/* Tank status sections */}
          {site.tanks?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2 mb-4">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Tank Status
              </h3>
              <div className="space-y-6">
                {site.tanks.map((tank, idx) => {
                  const daysSinceRefill = tank.lastRefill?.date
                    ? Math.floor(
                        (new Date() - new Date(tank.lastRefill.date)) / (24 * 60 * 60 * 1000)
                      )
                    : null;
                  const dailyWashes =
                    daysSinceRefill > 0 && tank.consumption?.scanCount != null
                      ? (tank.consumption.scanCount / daysSinceRefill).toFixed(1)
                      : tank.consumption?.scanCount ?? '—';

                  return (
                    <div
                      key={idx}
                      className="rounded-lg border border-border p-4 relative bg-card"
                    >
                      <Badge
                        className={cn(
                          'absolute top-3 right-3 text-xs font-semibold uppercase',
                          tank.status === 'CRITICAL' && 'bg-red-600 text-white border-0',
                          tank.status === 'WARNING' && 'bg-orange-500 text-white border-0',
                          tank.status === 'OK' && 'bg-green-600 text-white border-0'
                        )}
                      >
                        {tank.status}
                      </Badge>
                      <h4 className="text-sm font-semibold mb-3 pr-20">
                        Tank {tank.tank_number} – {tankProductDisplay(tank)}
                      </h4>
                      <div className="flex gap-4 mb-4">
                        <div className="shrink-0">
                          <TankLevelBar percentage={tank.percentage} status={tank.status} size="md" />
                          <p className="text-xs text-center mt-1 text-muted-foreground">
                            {tank.percentage != null ? `${tank.percentage}%` : '—'}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm flex-1 min-w-0">
                          <div>
                            <p className="text-xs text-muted-foreground">Current level</p>
                            <p
                              className={cn(
                                'font-medium',
                                (tank.status === 'CRITICAL' || tank.status === 'WARNING') &&
                                  'text-red-500 dark:text-red-400'
                              )}
                            >
                              {tank.currentLitres != null ? `${tank.currentLitres} L` : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Capacity</p>
                            <p className="font-medium">{tank.max_capacity_litres} L</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Daily usage</p>
                            <p className="font-medium">
                              {tank.consumption?.avgDailyLitres != null
                                ? `~${tank.consumption.avgDailyLitres} L/d`
                                : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Days to empty</p>
                            <p
                              className={cn(
                                'font-medium',
                                (tank.status === 'CRITICAL' || tank.status === 'WARNING') &&
                                  'text-red-500 dark:text-red-400'
                              )}
                            >
                              {tank.daysRemaining != null
                                ? `${tank.daysRemaining} days`
                                : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Since refill</p>
                            <p className="font-medium">
                              {daysSinceRefill != null ? `${daysSinceRefill} days` : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Daily washes</p>
                            <p className="font-medium">{dailyWashes}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Connected devices */}
          {site.tanks?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Connected devices
              </h3>
              <div className="flex flex-wrap gap-2">
                {site.tanks.map((tank, idx) => {
                  const device = tank.device;
                  if (!device) return null;
                  const app = device.application || productLabel(tank.product_type);
                  const name =
                    device.computerName || device.deviceRef || `Device ${idx + 1}`;
                  const version = device.version;
                  return (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-sm"
                    >
                      <Droplet className="w-3.5 h-3.5" />
                      <span className="font-medium">{app}</span>
                      <span className="text-muted-foreground">{name}</span>
                      {version && (
                        <span className="text-xs text-muted-foreground">v{version}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No device state */}
          {site.overallStatus === 'NO_DEVICE' && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
              <p className="text-sm">Awaiting device installation</p>
              <p className="text-xs mt-1">No tank data available for this site yet.</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
