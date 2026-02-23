import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Truck, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import TankLevelBar from '@/components/tankLevels/TankLevelBar';

const STATUS_BADGE = {
  CRITICAL: 'bg-red-600 text-white border-0',
  WARNING: 'bg-orange-500 text-white border-0',
  OK: 'bg-green-600 text-white border-0',
  NO_DEVICE: 'bg-muted text-muted-foreground border border-border',
  NO_DATA: 'bg-muted text-muted-foreground border border-border',
  ERROR: 'bg-red-600 text-white border-0',
};

const STATUS_TEXT = {
  CRITICAL: 'text-red-500 dark:text-red-400',
  WARNING: 'text-orange-500 dark:text-orange-400',
  OK: 'text-green-600 dark:text-green-400',
};

function productLabel(productType) {
  if (productType === 'TW') return 'TW';
  if (productType === 'GEL') return 'GEL';
  return 'ECSR';
}

/** Prefer actual product name from last refill (matches CMS Products); else short type (ECSR/TW/GEL). */
function tankProductDisplay(tank) {
  const name = tank.lastRefill?.productName ?? tank.lastRefill?.product;
  if (name && typeof name === 'string' && name.trim()) return name.trim();
  return productLabel(tank.product_type);
}

function displayLocation(site) {
  const loc = site?.location;
  const valid =
    loc &&
    typeof loc === 'string' &&
    loc !== 'undefined' &&
    loc !== 'null' &&
    !/^(undefined|null),?\s*(undefined|null)$/i.test(loc);
  if (valid) return loc;
  const isValidString = (val) =>
    val && typeof val === 'string' && val !== 'undefined' && val !== 'null' && val.trim() !== '';
  const suburb = site?.suburb ?? site?.addr_suburb ?? site?.addressSuburb ?? '';
  const state = site?.stateShort ?? site?.state_short ?? site?.addr_state_short ?? site?.state ?? '';
  const validSuburb = isValidString(suburb) ? suburb : '';
  const validState = isValidString(state) ? state : '';
  if (validSuburb && validState) return `${validSuburb}, ${validState}`;
  if (validSuburb) return validSuburb;
  if (validState) return validState;
  return '—';
}

export default function TankLevelCard({ site, onClick }) {
  const locationText = displayLocation(site);
  const badgeClass = STATUS_BADGE[site.overallStatus] || STATUS_BADGE.NO_DATA;
  const cardProps = onClick
    ? {
        role: 'button',
        tabIndex: 0,
        onClick,
        onKeyDown: (e) => (e.key === 'Enter' || e.key === ' ') && onClick(e),
        className: 'cursor-pointer hover:ring-2 hover:ring-primary/20 transition-shadow border border-border bg-card',
      }
    : { className: 'border border-border bg-card' };

  if (site.overallStatus === 'NO_DEVICE') {
    return (
      <Card {...cardProps}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="min-w-0">
              <p className="mb-1">
                <Badge variant="outline" className="text-xs font-medium text-muted-foreground">
                  {site.customer || 'Unknown customer'}
                </Badge>
              </p>
              <h3 className="text-lg font-bold truncate">{site.siteName}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{locationText}</p>
            </div>
            <Badge className={cn('text-xs font-medium uppercase shrink-0', badgeClass)}>NO DEVICE</Badge>
          </div>
          <div className="flex flex-col items-center justify-center py-8">
            <Activity className="w-10 h-10 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Awaiting device installation</p>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-border text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Truck className="w-3.5 h-3.5" />
              {site.vehicleCount || 0} vehicles
            </span>
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" />
              {site.deviceCount || 0}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const calibrationRate = site.tanks[0]?.calibration_rate_per_60s ?? 2.5;

  return (
    <Card {...cardProps}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="min-w-0 flex-1">
            <p className="mb-1.5">
              <Badge variant="outline" className="text-xs font-medium text-primary border-primary/50">
                {site.customer || 'Unknown customer'}
              </Badge>
            </p>
            <h3 className="text-lg font-bold truncate">{site.siteName}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{locationText}</p>
          </div>
          <Badge className={cn('text-xs font-semibold uppercase shrink-0', badgeClass)}>
            {site.overallStatus}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-6 justify-center">
          {site.tanks.map((tank, idx) => {
            const pct = tank.percentage != null ? tank.percentage : 0;
            const statusClass = STATUS_TEXT[tank.status] || 'text-muted-foreground';
            const daysLow = tank.status === 'CRITICAL' || tank.status === 'WARNING';

            const deviceName = tank.device?.computerName ?? tank.device?.computer_name ?? null;
            return (
              <div key={idx} className="flex flex-col items-center gap-1.5">
                <TankLevelBar percentage={pct} status={tank.status} size="md" />
                {deviceName && site.tanks.length > 1 && (
                  <span className="text-[10px] text-muted-foreground truncate max-w-full" title={deviceName}>
                    {deviceName}
                  </span>
                )}
                <span className="text-xs font-medium">
                  Tank {tank.tank_number} {tankProductDisplay(tank)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {tank.currentLitres != null ? tank.currentLitres : '—'}L / {tank.max_capacity_litres}L
                </span>
                {tank.daysRemaining != null && (
                  <span
                    className={cn(
                      'text-xs italic',
                      daysLow ? statusClass : 'text-muted-foreground'
                    )}
                  >
                    ~{tank.daysRemaining}d left
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-4 mt-3 border-t border-border text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5" />
            {site.vehicleCount ?? 0} vehicles • {calibrationRate} L/60s
          </span>
          <span className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            {site.deviceCount ?? 0}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
