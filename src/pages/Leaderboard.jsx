import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Medal, Star, TrendingUp, Flame, Award, Target, Zap, Crown, ArrowLeft, Building2, MapPin, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import moment from 'moment';
import confetti from 'canvas-confetti';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { vehiclesOptions, scansOptions } from '@/query/options';
import { usePermissions } from '@/components/auth/PermissionGuard';

export default function Leaderboard() {
  const [timeframe, setTimeframe] = useState('month');
  const [celebratedTop, setCelebratedTop] = useState(false);
  const permissions = usePermissions();
  const companyId = permissions.userProfile?.company_id;

  const urlParams = new URLSearchParams(window.location.search);
  const customerFilter = urlParams.get('customer') || 'all';
  const siteFilter = urlParams.get('site') || 'all';

  const startDate = moment().startOf('month').format('YYYY-MM-DD');
  const endDate = moment().format('YYYY-MM-DD');

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    ...vehiclesOptions(companyId, {
      customerId: customerFilter !== 'all' ? customerFilter : undefined,
      siteId: siteFilter !== 'all' ? siteFilter : undefined,
    }),
    placeholderData: (prev) => prev,
  });

  const { data: scans = [], isLoading: scansLoading } = useQuery({
    ...scansOptions(companyId, {
      startDate,
      endDate,
      customerId: customerFilter !== 'all' ? customerFilter : undefined,
      siteId: siteFilter !== 'all' ? siteFilter : undefined,
    }),
    placeholderData: (prev) => prev,
  });

  const calculateBadges = (driver) => {
    const badges = [];

    if (driver.performanceScore >= 90) badges.push({ name: 'Elite Performer', icon: Crown, color: 'text-yellow-500' });
    if (driver.performanceScore >= 80) badges.push({ name: 'Top Performer', icon: Trophy, color: 'text-purple-500' });
    if (driver.totalWashes >= 50) badges.push({ name: 'Wash Master', icon: Zap, color: 'text-blue-500' });
    if (driver.totalWashes >= 100) badges.push({ name: 'Century Club', icon: Award, color: 'text-emerald-500' });
    if (driver.currentStreak >= 7) badges.push({ name: 'Week Warrior', icon: Flame, color: 'text-orange-500' });
    if (driver.currentStreak >= 14) badges.push({ name: 'Consistency King', icon: Star, color: 'text-red-500' });
    if (driver.maxStreak >= 30) badges.push({ name: 'Marathon Master', icon: Target, color: 'text-indigo-500' });

    return badges;
  };

  const driverStats = useMemo(() => {
    // Group vehicles by driver (using vehicle name as proxy)
    const driverMap = new Map();

    vehicles.forEach(vehicle => {
      const driverName = vehicle.vehicleName || 'Unknown Driver';
      const vehicleScans = scans.filter(s => s.vehicleRef === vehicle.vehicleRef);
      const washCount = vehicleScans.length;
      const target = vehicle.washesPerWeek * 4 || 12; // Monthly target
      const complianceRate = target > 0 ? Math.min(100, Math.round((washCount / target) * 100)) : 0;

      // Calculate streak (consecutive days with washes)
      const scanDates = vehicleScans
        .map(s => moment(s.timestamp).format('YYYY-MM-DD'))
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort();

      let currentStreak = 0;
      let maxStreak = 0;
      let tempStreak = 1;

      for (let i = 1; i < scanDates.length; i++) {
        const diff = moment(scanDates[i]).diff(moment(scanDates[i - 1]), 'days');
        if (diff === 1) {
          tempStreak++;
        } else {
          maxStreak = Math.max(maxStreak, tempStreak);
          tempStreak = 1;
        }
      }
      maxStreak = Math.max(maxStreak, tempStreak);

      // Check if most recent scan is today or yesterday
      if (scanDates.length > 0) {
        const lastScanDiff = moment().diff(moment(scanDates[scanDates.length - 1]), 'days');
        currentStreak = lastScanDiff <= 1 ? tempStreak : 0;
      }

      // Performance score (weighted algorithm)
      const performanceScore = Math.round(
        (complianceRate * 0.5) + // 50% compliance
        (Math.min(100, (washCount / 20) * 100) * 0.3) + // 30% wash volume
        (Math.min(100, (currentStreak / 7) * 100) * 0.2) // 20% consistency streak
      );

      if (!driverMap.has(driverName)) {
        driverMap.set(driverName, {
          name: driverName,
          vehicles: [],
          totalWashes: 0,
          totalTarget: 0,
          performanceScore: 0,
          currentStreak: 0,
          maxStreak: 0,
          lastScan: null,
          customerName: vehicle.customerName,
          siteName: vehicle.siteName
        });
      }

      const driver = driverMap.get(driverName);
      driver.vehicles.push(vehicle.vehicleName);
      driver.totalWashes += washCount;
      driver.totalTarget += target;
      driver.performanceScore = Math.max(driver.performanceScore, performanceScore);
      driver.currentStreak = Math.max(driver.currentStreak, currentStreak);
      driver.maxStreak = Math.max(driver.maxStreak, maxStreak);
      driver.lastScan = vehicle.lastScanAt;
    });

    return Array.from(driverMap.values())
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .map((driver, index) => ({
        ...driver,
        rank: index + 1,
        badges: calculateBadges(driver)
      }));
  }, [vehicles, scans, calculateBadges]);

  const topPerformer = driverStats[0];

  React.useEffect(() => {
    if (topPerformer && !celebratedTop && !vehiclesLoading && !scansLoading) {
      setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }, 500);
      setCelebratedTop(true);
    }
  }, [topPerformer, celebratedTop, vehiclesLoading, scansLoading]);

  const getRankIcon = (rank) => {
    if (rank === 1) return <Crown className="w-6 h-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return null;
  };

  if (vehiclesLoading || scansLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Trophy className="w-7 h-7 text-white animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
            <p className="text-gray-600 dark:text-gray-400">Loading leaderboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Link
            to={createPageUrl('Dashboard')}
            className="inline-flex items-center gap-2 text-white/80 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Dashboard</span>
          </Link>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur
                             flex items-center justify-center">
                <Trophy className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Driver Leaderboard</h1>
                <p className="text-white/80">Compete, achieve, and dominate the fleet!</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white/60 text-sm">Current Period</p>
              <p className="text-white text-xl font-bold">{moment().format('MMMM YYYY')}</p>
              {(customerFilter !== 'all' || siteFilter !== 'all') && (
                <p className="text-white/60 text-sm mt-1">
                  Filtered: {customerFilter !== 'all' ? customerFilter : ''}{siteFilter !== 'all' ? ` - ${siteFilter}` : ''}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Top 3 Podium */}
        {driverStats.length >= 3 && (
          <div className="flex justify-center items-end gap-4 mb-8">
            {/* 2nd Place */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="w-40"
            >
              <div className="backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80
                             rounded-2xl border border-gray-200/20 dark:border-zinc-800/50
                             shadow-lg shadow-black/5 p-6 text-center">
                <div className="flex justify-center mb-3">
                  <Medal className="w-6 h-6 text-gray-400" />
                </div>
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-zinc-800 mx-auto mb-3
                               flex items-center justify-center">
                  <span className="font-bold text-sm truncate px-1">{driverStats[1].name}</span>
                </div>
                <div className="space-y-1 mb-3">
                  {driverStats[1].customerName && (
                    <span className="inline-block px-2 py-1 rounded-full text-xs font-medium
                                   bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                      {driverStats[1].customerName}
                    </span>
                  )}
                  {driverStats[1].siteName && (
                    <p className="text-xs text-gray-500">{driverStats[1].siteName}</p>
                  )}
                </div>
                <p className="text-2xl font-bold text-emerald-500">{driverStats[1].performanceScore}</p>
                <p className="text-xs text-gray-500">Performance</p>
                <div className="flex items-center justify-center gap-1 mt-2 text-xs text-gray-500">
                  <Flame className="w-3 h-3 text-orange-500" />
                  {driverStats[1].currentStreak} day streak
                </div>
                <div className="mt-3 py-1 px-3 rounded-full text-xs font-bold bg-gray-400 text-white inline-block">
                  2nd Place
                </div>
              </div>
            </motion.div>

            {/* 1st Place */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="w-48 -mt-4"
            >
              <div className="backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80
                             rounded-2xl border-2 border-yellow-400
                             shadow-xl shadow-yellow-500/20 p-6 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400" />
                <div className="flex justify-center mb-3">
                  <Crown className="w-8 h-8 text-yellow-500" />
                </div>
                <div className="w-20 h-20 rounded-full bg-yellow-100 dark:bg-yellow-500/20 mx-auto mb-3
                               flex items-center justify-center">
                  <span className="font-bold truncate px-1">{driverStats[0].name}</span>
                </div>
                <div className="space-y-1 mb-3">
                  {driverStats[0].customerName && (
                    <span className="inline-block px-2 py-1 rounded-full text-xs font-medium
                                   bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                      {driverStats[0].customerName}
                    </span>
                  )}
                  {driverStats[0].siteName && (
                    <p className="text-xs text-gray-500">{driverStats[0].siteName}</p>
                  )}
                </div>
                <p className="text-3xl font-bold text-yellow-600">{driverStats[0].performanceScore}</p>
                <p className="text-xs text-gray-500">Performance</p>
                <div className="flex items-center justify-center gap-1 mt-2 text-xs text-gray-500">
                  <Flame className="w-3 h-3 text-orange-500" />
                  {driverStats[0].currentStreak} day streak
                </div>
                <div className="flex gap-1 justify-center mt-2">
                  {driverStats[0].badges.slice(0, 3).map((badge, idx) => (
                    <badge.icon key={idx} className={`w-4 h-4 ${badge.color}`} />
                  ))}
                </div>
                <div className="mt-3 py-1 px-3 rounded-full text-xs font-bold bg-yellow-500 text-white inline-block">
                  Champion
                </div>
              </div>
            </motion.div>

            {/* 3rd Place */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="w-40"
            >
              <div className="backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80
                             rounded-2xl border border-gray-200/20 dark:border-zinc-800/50
                             shadow-lg shadow-black/5 p-6 text-center">
                <div className="flex justify-center mb-3">
                  <Medal className="w-6 h-6 text-amber-600" />
                </div>
                <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-500/20 mx-auto mb-3
                               flex items-center justify-center">
                  <span className="font-bold text-sm truncate px-1">{driverStats[2].name}</span>
                </div>
                <div className="space-y-1 mb-3">
                  {driverStats[2].customerName && (
                    <span className="inline-block px-2 py-1 rounded-full text-xs font-medium
                                   bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                      {driverStats[2].customerName}
                    </span>
                  )}
                  {driverStats[2].siteName && (
                    <p className="text-xs text-gray-500">{driverStats[2].siteName}</p>
                  )}
                </div>
                <p className="text-2xl font-bold text-emerald-500">{driverStats[2].performanceScore}</p>
                <p className="text-xs text-gray-500">Performance</p>
                <div className="flex items-center justify-center gap-1 mt-2 text-xs text-gray-500">
                  <Flame className="w-3 h-3 text-orange-500" />
                  {driverStats[2].currentStreak} day streak
                </div>
                <div className="mt-3 py-1 px-3 rounded-full text-xs font-bold bg-amber-600 text-white inline-block">
                  3rd Place
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Complete Rankings */}
        <div className="backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80
                       rounded-2xl border border-gray-200/20 dark:border-zinc-800/50
                       shadow-lg shadow-black/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200/50 dark:border-zinc-800/50">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Complete Rankings
            </h2>
          </div>
          <div className="divide-y divide-gray-200/50 dark:divide-zinc-800/50">
            {driverStats.map((driver, index) => (
              <motion.div
                key={driver.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="px-6 py-4 flex items-center justify-between
                          hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Rank */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center
                                 ${driver.rank === 1 ? 'bg-yellow-500' :
                                   driver.rank === 2 ? 'bg-gray-400' :
                                   driver.rank === 3 ? 'bg-amber-600' :
                                   'bg-gray-200 dark:bg-zinc-700'}
                                 ${driver.rank <= 3 ? 'text-white' : 'text-gray-600 dark:text-gray-400'}
                                 font-bold text-sm`}>
                    {driver.rank <= 3 ? getRankIcon(driver.rank) : `#${driver.rank}`}
                  </div>

                  {/* Driver Info */}
                  <div>
                    <p className="font-semibold">{driver.name}</p>
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      {driver.customerName && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700
                                        dark:bg-emerald-500/20 dark:text-emerald-400 font-medium
                                        flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {driver.customerName}
                        </span>
                      )}
                      {driver.siteName && (
                        <span className="text-gray-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {driver.siteName}
                        </span>
                      )}
                    </div>
                    {/* Stats */}
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>{driver.totalWashes} washes</span>
                      <span className="flex items-center gap-1">
                        <Flame className="w-3 h-3 text-orange-500" />
                        {driver.currentStreak} day streak
                      </span>
                    </div>
                    {/* Badges */}
                    {driver.badges.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {driver.badges.map((badge, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                                     bg-gray-100 dark:bg-zinc-800 text-xs font-medium"
                          >
                            <badge.icon className={`w-3 h-3 ${badge.color}`} />
                            {badge.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Performance Score */}
                <div className="text-right">
                  <p className="text-2xl font-bold text-emerald-500">{driver.performanceScore}</p>
                  <p className="text-xs text-gray-500">Performance</p>
                  <div className="w-20 h-1.5 rounded-full bg-gray-200 dark:bg-zinc-700 mt-2">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.min(driver.performanceScore, 100)}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            ))}

            {driverStats.length === 0 && (
              <div className="px-6 py-12 text-center">
                <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No driver data available for this period.</p>
              </div>
            )}
          </div>
        </div>

        {/* Achievement Legend */}
        <div className="backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80
                       rounded-2xl border border-gray-200/20 dark:border-zinc-800/50
                       shadow-lg shadow-black/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200/50 dark:border-zinc-800/50">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Award className="w-5 h-5 text-purple-500" />
              Achievement Badges
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { name: 'Elite Performer', icon: Crown, desc: '90+ score', color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-500/10' },
                { name: 'Top Performer', icon: Trophy, desc: '80+ score', color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10' },
                { name: 'Wash Master', icon: Zap, desc: '50+ washes', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10' },
                { name: 'Century Club', icon: Award, desc: '100+ washes', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
                { name: 'Week Warrior', icon: Flame, desc: '7 day streak', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/10' },
                { name: 'Consistency King', icon: Star, desc: '14 day streak', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10' },
                { name: 'Marathon Master', icon: Target, desc: '30 day streak', color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
              ].map((badge) => (
                <div
                  key={badge.name}
                  className={`flex items-center gap-3 p-3 rounded-xl ${badge.bg}`}
                >
                  <badge.icon className={`w-6 h-6 ${badge.color}`} />
                  <div>
                    <p className="text-sm font-semibold">{badge.name}</p>
                    <p className="text-xs text-gray-500">{badge.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
