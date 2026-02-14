import React from 'react';
import { Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const LIKELIHOOD_OPTIONS = [
  { value: 'green', label: 'On Track', pillClass: 'bg-emerald-500 hover:bg-emerald-600', dotClass: 'bg-emerald-500' },
  { value: 'orange', label: 'Off Track (At Risk)', pillClass: 'bg-amber-500 hover:bg-amber-600', dotClass: 'bg-amber-500' },
  { value: 'red', label: 'Off Track (Critical)', pillClass: 'bg-red-500 hover:bg-red-600', dotClass: 'bg-red-500' },
];

export function getDefaultLikelihood(row, targetDefault = 12) {
  const target = row.target ?? targetDefault;
  const washes = row.washes_completed ?? 0;
  if (washes >= target) return 'green';
  if (washes === 0) return 'red';
  return 'orange';
}

export function getLikelihoodDisplay(likelihood) {
  const opt = LIKELIHOOD_OPTIONS.find((o) => o.value === likelihood);
  if (!opt) return { label: '—', pillClass: '' };
  const isOnTrack = likelihood === 'green';
  return {
    label: isOnTrack ? 'ON TRACK' : 'OFF TRACK',
    pillClass: opt.pillClass,
  };
}

export default function VehicleLikelihoodCell({ row, override, onOverride, targetDefault = 12, canEdit = true }) {
  const effective = override ?? getDefaultLikelihood(row, targetDefault);
  const display = getLikelihoodDisplay(effective);
  const vehicleRef = row.id ?? row.rfid;

  return (
    <div className="flex items-center gap-2">
      <Badge className={`${display.pillClass} text-white border-0 shrink-0`} variant="secondary">
        {display.label}
      </Badge>
      {canEdit && onOverride && (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 rounded-full ${display.pillClass} text-white hover:opacity-90`}
            aria-label="Edit likelihood"
            onClick={(e) => e.stopPropagation()}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-[100]" onClick={(e) => e.stopPropagation()}>
          {LIKELIHOOD_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => onOverride?.(vehicleRef, opt.value)}
            >
              <span className={`inline-block h-2 w-2 rounded-full mr-2 shrink-0 ${opt.dotClass}`} />
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      )}
    </div>
  );
}
