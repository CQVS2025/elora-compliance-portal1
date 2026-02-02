import React, { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Medal, Star, TrendingUp, Flame, Award, Target, Zap, Crown, Building2, MapPin, Loader2 } from 'lucide-react';
import moment from 'moment';
import confetti from 'canvas-confetti';
import { vehiclesOptions, scansOptions } from '@/query/options';
import { usePermissions } from '@/components/auth/PermissionGuard';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import DataPagination from '@/components/ui/DataPagination';

const RANKINGS_PAGE_SIZE = 20;

function calculateBadges(driver) {
  const badges = [];
  if (driver.performanceScore >= 90) badges.push({ name: 'Elite Performer', icon: Crown, color: 'text-yellow-500 dark:text-yellow-400' });
  if (driver.performanceScore >= 80) badges.push({ name: 'Top Performer', icon: Trophy, color: 'text-purple-500 dark:text-purple-400' });
  if (driver.totalWashes >= 50) badges.push({ name: 'Wash Master', icon: Zap, color: 'text-blue-500 dark:text-blue-400' });
  if (driver.totalWashes >= 100) badges.push({ name: 'Century Club', icon: Award, color: 'text-primary' });
  if (driver.currentStreak >= 7) badges.push({ name: 'Week Warrior', icon: Flame, color: 'text-orange-500 dark:text-orange-400' });
  if (driver.currentStreak >= 14) badges.push({ name: 'Consistency King', icon: Star, color: 'text-red-500 dark:text-red-400' });
  if (driver.maxStreak >= 30) badges.push({ name: 'Marathon Master', icon: Target, color: 'text-indigo-500 dark:text-indigo-400' });
  return badges;
}

function getRankIcon(rank) {
  if (rank === 1) return <Crown className="w-6 h-6 text-yellow-500 dark:text-yellow-400" />;
  if (rank === 2) return <Medal className="w-5 h-5 text-muted-foreground" />;
  if (rank === 3) return <Medal className="w-5 h-5 text-amber-600 dark:text-amber-500" />;
  return null;
}

export default function Leaderboard() {
  const [celebratedTop, setCelebratedTop] = useState(false);
  const [rankingsPage, setRankingsPage] = useState(1);
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

  const driverStats = useMemo(() => {
    const driverMap = new Map();
    const ts = (s) => s.createdAt ?? s.timestamp;
    vehicles.forEach(vehicle => {
      const driverName = vehicle.vehicleName ?? vehicle.name ?? 'Unknown Driver';
      const vehicleScans = scans.filter(s =>
        s.vehicleRef === vehicle.vehicleRef ||
        s.vehicleRef === vehicle.id ||
        (vehicle.device_ref && s.deviceRef === vehicle.device_ref) ||
        (vehicle.id && s.deviceRef === vehicle.id)
      );
      const washCount = vehicleScans.length;
      const target = vehicle.washesPerWeek * 4 || 12;
      const complianceRate = target > 0 ? Math.min(100, Math.round((washCount / target) * 100)) : 0;

      const scanDates = vehicleScans
        .map(s => moment(ts(s)).format('YYYY-MM-DD'))
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort();

      let currentStreak = 0;
      let maxStreak = 0;
      let tempStreak = 1;
      for (let i = 1; i < scanDates.length; i++) {
        const diff = moment(scanDates[i]).diff(moment(scanDates[i - 1]), 'days');
        if (diff === 1) tempStreak++;
        else {
          maxStreak = Math.max(maxStreak, tempStreak);
          tempStreak = 1;
        }
      }
      maxStreak = Math.max(maxStreak, tempStreak);
      if (scanDates.length > 0) {
        const lastScanDiff = moment().diff(moment(scanDates[scanDates.length - 1]), 'days');
        currentStreak = lastScanDiff <= 1 ? tempStreak : 0;
      }

      const performanceScore = Math.round(
        (complianceRate * 0.5) +
        (Math.min(100, (washCount / 20) * 100) * 0.3) +
        (Math.min(100, (currentStreak / 7) * 100) * 0.2)
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
  }, [vehicles, scans]);

  const topPerformer = driverStats[0];

  useEffect(() => {
    if (topPerformer && !celebratedTop && !vehiclesLoading && !scansLoading) {
      const t = setTimeout(() => {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }, 500);
      setCelebratedTop(true);
      return () => clearTimeout(t);
    }
  }, [topPerformer, celebratedTop, vehiclesLoading, scansLoading]);

  const totalRankings = driverStats.length;
  const totalRankingsPages = Math.max(1, Math.ceil(totalRankings / RANKINGS_PAGE_SIZE));
  const paginatedRankings = useMemo(() => {
    const start = (rankingsPage - 1) * RANKINGS_PAGE_SIZE;
    return driverStats.slice(start, start + RANKINGS_PAGE_SIZE);
  }, [driverStats, rankingsPage]);

  if (vehiclesLoading || scansLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center">
            <Trophy className="w-7 h-7 text-primary-foreground animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <p className="text-muted-foreground">Loading leaderboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Period & filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="font-medium text-foreground">Current Period</span>
          <span>{moment().format('MMMM YYYY')}</span>
        </div>
        {(customerFilter !== 'all' || siteFilter !== 'all') && (
          <p className="text-sm text-muted-foreground">
            Filtered: {customerFilter !== 'all' ? customerFilter : ''}{siteFilter !== 'all' ? ` – ${siteFilter}` : ''}
          </p>
        )}
      </div>

      {/* Top 3 Podium */}
      {driverStats.length >= 3 && (
        <div className="flex justify-center items-end gap-4 flex-wrap">
          {/* 2nd */}
          <Card className="w-40 flex-shrink-0">
            <CardContent className="pt-6 pb-6 text-center">
              <Medal className="w-6 h-6 text-muted-foreground mx-auto mb-3" />
              <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center">
                <span className="font-bold text-sm truncate px-1">{driverStats[1].name}</span>
              </div>
              {driverStats[1].customerName && (
                <Badge variant="secondary" className="mb-1 text-xs">{driverStats[1].customerName}</Badge>
              )}
              {driverStats[1].siteName && <p className="text-xs text-muted-foreground">{driverStats[1].siteName}</p>}
              <p className="text-2xl font-bold text-primary mt-2">{driverStats[1].performanceScore}</p>
              <p className="text-xs text-muted-foreground">Performance</p>
              <div className="flex items-center justify-center gap-1 mt-2 text-xs text-muted-foreground">
                <Flame className="w-3 h-3 text-orange-500" />
                {driverStats[1].currentStreak} day streak
              </div>
              <Badge className="mt-3 bg-muted-foreground text-muted">2nd Place</Badge>
            </CardContent>
          </Card>

          {/* 1st */}
          <Card className="w-48 -mt-4 flex-shrink-0 border-2 border-yellow-500/50 dark:border-yellow-400/50">
            <CardContent className="pt-6 pb-6 text-center relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400 rounded-t-xl" />
              <Crown className="w-8 h-8 text-yellow-500 dark:text-yellow-400 mx-auto mb-3" />
              <div className="w-20 h-20 rounded-full bg-yellow-500/10 dark:bg-yellow-400/10 mx-auto mb-3 flex items-center justify-center">
                <span className="font-bold truncate px-1">{driverStats[0].name}</span>
              </div>
              {driverStats[0].customerName && (
                <Badge variant="secondary" className="mb-1 text-xs">{driverStats[0].customerName}</Badge>
              )}
              {driverStats[0].siteName && <p className="text-xs text-muted-foreground">{driverStats[0].siteName}</p>}
              <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-500 mt-2">{driverStats[0].performanceScore}</p>
              <p className="text-xs text-muted-foreground">Performance</p>
              <div className="flex items-center justify-center gap-1 mt-2 text-xs text-muted-foreground">
                <Flame className="w-3 h-3 text-orange-500" />
                {driverStats[0].currentStreak} day streak
              </div>
              <div className="flex gap-1 justify-center mt-2">
                {driverStats[0].badges.slice(0, 3).map((badge, idx) => (
                  <badge.icon key={idx} className={`w-4 h-4 ${badge.color}`} />
                ))}
              </div>
              <Badge className="mt-3 bg-yellow-500 text-white hover:bg-yellow-600">Champion</Badge>
            </CardContent>
          </Card>

          {/* 3rd */}
          <Card className="w-40 flex-shrink-0">
            <CardContent className="pt-6 pb-6 text-center">
              <Medal className="w-6 h-6 text-amber-600 dark:text-amber-500 mx-auto mb-3" />
              <div className="w-16 h-16 rounded-full bg-amber-500/10 dark:bg-amber-400/10 mx-auto mb-3 flex items-center justify-center">
                <span className="font-bold text-sm truncate px-1">{driverStats[2].name}</span>
              </div>
              {driverStats[2].customerName && (
                <Badge variant="secondary" className="mb-1 text-xs">{driverStats[2].customerName}</Badge>
              )}
              {driverStats[2].siteName && <p className="text-xs text-muted-foreground">{driverStats[2].siteName}</p>}
              <p className="text-2xl font-bold text-primary mt-2">{driverStats[2].performanceScore}</p>
              <p className="text-xs text-muted-foreground">Performance</p>
              <div className="flex items-center justify-center gap-1 mt-2 text-xs text-muted-foreground">
                <Flame className="w-3 h-3 text-orange-500" />
                {driverStats[2].currentStreak} day streak
              </div>
              <Badge className="mt-3 bg-amber-600 text-white hover:bg-amber-700">3rd Place</Badge>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Complete Rankings (paginated) */}
      <Card>
        <CardHeader className="border-b border-border">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Complete Rankings
          </h2>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {paginatedRankings.map((driver) => (
              <div
                key={driver.name}
                className="px-6 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                      ${driver.rank === 1 ? 'bg-yellow-500 text-white' :
                        driver.rank === 2 ? 'bg-muted-foreground text-primary-foreground' :
                        driver.rank === 3 ? 'bg-amber-600 text-white' :
                        'bg-muted text-muted-foreground'}`}
                  >
                    {driver.rank <= 3 ? getRankIcon(driver.rank) : `#${driver.rank}`}
                  </div>
                  <div>
                    <p className="font-semibold">{driver.name}</p>
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      {driver.customerName && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          <Building2 className="w-3 h-3" />
                          {driver.customerName}
                        </span>
                      )}
                      {driver.siteName && (
                        <span className="text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {driver.siteName}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{driver.totalWashes} washes</span>
                      <span className="flex items-center gap-1">
                        <Flame className="w-3 h-3 text-orange-500" />
                        {driver.currentStreak} day streak
                      </span>
                    </div>
                    {driver.badges.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {driver.badges.map((badge, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs font-medium"
                          >
                            <badge.icon className={`w-3 h-3 ${badge.color}`} />
                            {badge.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">{driver.performanceScore}</p>
                  <p className="text-xs text-muted-foreground">Performance</p>
                  <div className="w-20 h-1.5 rounded-full bg-muted mt-2">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(driver.performanceScore, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {driverStats.length === 0 && (
            <div className="px-6 py-12 text-center">
              <Trophy className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No driver data available for this period.</p>
            </div>
          )}
          {totalRankings > 0 && (
            <div className="px-6 pb-4">
              <DataPagination
                currentPage={rankingsPage}
                totalPages={totalRankingsPages}
                totalItems={totalRankings}
                itemsPerPage={RANKINGS_PAGE_SIZE}
                onPageChange={setRankingsPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Achievement Badges legend */}
      <Card>
        <CardHeader className="border-b border-border">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-500" />
            Achievement Badges
          </h2>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { name: 'Elite Performer', icon: Crown, desc: '90+ score', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
              { name: 'Top Performer', icon: Trophy, desc: '80+ score', color: 'text-purple-500', bg: 'bg-purple-500/10' },
              { name: 'Wash Master', icon: Zap, desc: '50+ washes', color: 'text-blue-500', bg: 'bg-blue-500/10' },
              { name: 'Century Club', icon: Award, desc: '100+ washes', color: 'text-primary', bg: 'bg-primary/10' },
              { name: 'Week Warrior', icon: Flame, desc: '7 day streak', color: 'text-orange-500', bg: 'bg-orange-500/10' },
              { name: 'Consistency King', icon: Star, desc: '14 day streak', color: 'text-red-500', bg: 'bg-red-500/10' },
              { name: 'Marathon Master', icon: Target, desc: '30 day streak', color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
            ].map((badge) => (
              <div key={badge.name} className={`flex items-center gap-3 p-3 rounded-xl ${badge.bg}`}>
                <badge.icon className={`w-6 h-6 ${badge.color}`} />
                <div>
                  <p className="text-sm font-semibold">{badge.name}</p>
                  <p className="text-xs text-muted-foreground">{badge.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
