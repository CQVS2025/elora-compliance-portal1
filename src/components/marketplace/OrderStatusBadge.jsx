import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, XCircle, Truck, PackageCheck, CreditCard, Ban } from 'lucide-react';

const STATUS_MAP = {
  pending_approval: {
    label: 'Pending approval',
    icon: Clock,
    className: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle2,
    className: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  paid: {
    label: 'Paid',
    icon: CreditCard,
    className: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  dispatched: {
    label: 'Dispatched',
    icon: Truck,
    className: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  },
  delivered: {
    label: 'Delivered',
    icon: PackageCheck,
    className: 'border-emerald-400 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200',
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    className: 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
  },
  cancelled: {
    label: 'Cancelled',
    icon: Ban,
    className: 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300',
  },
};

export function OrderStatusBadge({ status, className = '' }) {
  const config = STATUS_MAP[status] ?? {
    label: status ?? 'Unknown',
    icon: Clock,
    className: 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300',
  };
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`gap-1 ${config.className} ${className}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}

export default OrderStatusBadge;
