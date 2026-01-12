import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Clock, Truck, Droplet, Wrench, MapPin, User, TrendingUp, TrendingDown } from 'lucide-react';
import moment from 'moment';
import { base44 } from "@/api/base44Client";

const ACTIVITY_ICONS = {
  wash: Droplet,
  maintenance: Wrench,
  vehicle_added: Truck,
  site_added: MapPin,
  user_added: User,
  compliance_improved: TrendingUp,
  compliance_declined: TrendingDown,
};

async function fetchRecentActivity({ customerRef, siteRef, limit = 20 } = {}) {
  try {
    const response = await base44.functions.invoke('elora_recent_activity', {
      customerRef,
      siteRef,
      limit
    });
    return response.data || [];
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    return [];
  }
}

export default function RecentActivityFeed({ customerRef, siteRef, className = '' }) {
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['recentActivity', customerRef, siteRef],
    queryFn: () => fetchRecentActivity({ customerRef, siteRef }),
    staleTime: 60000, // 1 minute
    refetchInterval: 60000, // Auto-refresh every minute
  });

  if (isLoading) {
    return (
      <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#7CB342]" />
          Recent Activity
        </h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex gap-3">
              <div className="w-10 h-10 bg-slate-200 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#7CB342]" />
          Recent Activity
        </h3>
        <p className="text-slate-500 text-sm text-center py-8">
          No recent activity to display
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-[#7CB342]" />
        Recent Activity
      </h3>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {activities.map((activity, index) => {
          const Icon = ACTIVITY_ICONS[activity.type] || Clock;
          const timeAgo = moment(activity.timestamp).fromNow();

          return (
            <motion.div
              key={activity.id || index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                activity.type === 'wash' ? 'bg-blue-100 text-blue-600' :
                activity.type === 'maintenance' ? 'bg-orange-100 text-orange-600' :
                activity.type === 'compliance_improved' ? 'bg-green-100 text-green-600' :
                activity.type === 'compliance_declined' ? 'bg-red-100 text-red-600' :
                'bg-slate-100 text-slate-600'
              }`}>
                <Icon className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-800 font-medium">
                  {activity.title}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activity.description}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {timeAgo}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
