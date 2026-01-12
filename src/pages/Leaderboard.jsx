import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, Star, TrendingUp, Flame, Award, Target, Zap, Crown, ChevronLeft, Building2, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import moment from 'moment';
import { Progress } from "@/components/ui/progress";
import confetti from 'canvas-confetti';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

async function fetchVehicles({ customerId, siteId } = {}) {
  const params = {};
  if (customerId && customerId !== 'all') params.customer_id = customerId;
  if (siteId && siteId !== 'all') params.site_id = siteId;
  const response = await supabaseClient.elora.vehicles(params);
  return response?.data ?? response ?? [];
}

async function fetchScans({ customerId, siteId } = {}) {
  const startDate = moment().startOf('month').format('YYYY-MM-DD');
  const endDate = moment().format('YYYY-MM-DD');
  const params = { start_date: startDate, end_date: endDate };
  if (customerId && customerId !== 'all') params.customer_id = customerId;
  if (siteId && siteId !== 'all') params.site_id = siteId;
  const response = await supabaseClient.elora.scans(params);
  return response?.data ?? response ?? [];
}

export default function Leaderboard() {
  const [timeframe, setTimeframe] = useState('month');
  const [celebratedTop, setCelebratedTop] = useState(false);

  // Get filters from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const customerFilter = urlParams.get('customer') || 'all';
  const siteFilter = urlParams.get('site') || 'all';

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ['vehicles', customerFilter, siteFilter],
    queryFn: () => fetchVehicles({ customerId: customerFilter, siteId: siteFilter }),
  });

  const { data: scans = [], isLoading: scansLoading } = useQuery({
    queryKey: ['scans', timeframe, customerFilter, siteFilter],
    queryFn: () => fetchScans({ customerId: customerFilter, siteId: siteFilter }),
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

  const getRankColor = (rank) => {
    if (rank === 1) return 'from-yellow-400 to-yellow-600';
    if (rank === 2) return 'from-gray-300 to-gray-500';
    if (rank === 3) return 'from-orange-400 to-orange-600';
    return 'from-slate-200 to-slate-400';
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return <Trophy className="w-6 h-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-400" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-orange-500" />;
    return <span className="text-slate-500 font-bold">#{rank}</span>;
  };

  if (vehiclesLoading || scansLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <Trophy className="w-16 h-16 text-[#7CB342] animate-bounce mx-auto mb-4" />
          <p className="text-slate-600">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-8 px-6 shadow-xl">
        <div className="max-w-6xl mx-auto">
          <Link to={createPageUrl('Dashboard')}>
            <Button variant="ghost" className="text-white hover:bg-white/20 mb-4">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold flex items-center gap-3">
                <Trophy className="w-10 h-10" />
                Driver Leaderboard
              </h1>
              <p className="text-purple-100 mt-2">Compete, achieve, and dominate the fleet!</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-purple-200">Current Period</p>
              <p className="text-2xl font-bold">{moment().format('MMMM YYYY')}</p>
              {(customerFilter !== 'all' || siteFilter !== 'all') && (
                <p className="text-sm text-purple-200 mt-1">
                  Filtered: {customerFilter !== 'all' ? customerFilter : ''}{siteFilter !== 'all' ? ` • ${siteFilter}` : ''}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Top 3 Podium */}
        {driverStats.length >= 3 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {/* 2nd Place */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-8"
            >
              <Card className="border-2 border-gray-300 shadow-lg">
                <CardContent className="p-6 text-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 mx-auto flex items-center justify-center mb-4">
                    <Medal className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="font-bold text-xl mb-1">{driverStats[1].name}</h3>
                  <div className="flex items-center justify-center gap-2 text-xs mb-1">
                    {driverStats[1].customerName && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {driverStats[1].customerName}
                      </span>
                    )}
                    {driverStats[1].siteName && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {driverStats[1].siteName}
                      </span>
                    )}
                  </div>
                  <p className="text-3xl font-black text-gray-600 mb-2">{driverStats[1].performanceScore}</p>
                  <Badge className="bg-gray-500 text-white mb-3">2nd Place</Badge>
                  <div className="space-y-1 text-sm text-slate-600">
                    <p>{driverStats[1].totalWashes} washes</p>
                    <p>🔥 {driverStats[1].currentStreak} day streak</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* 1st Place */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-4 border-yellow-400 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400" />
                <CardContent className="p-6 text-center">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 mx-auto flex items-center justify-center mb-4 shadow-xl">
                    <Crown className="w-12 h-12 text-white animate-pulse" />
                  </div>
                  <h3 className="font-bold text-2xl mb-1">{driverStats[0].name}</h3>
                  <div className="flex items-center justify-center gap-2 text-xs mb-1">
                    {driverStats[0].customerName && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {driverStats[0].customerName}
                      </span>
                    )}
                    {driverStats[0].siteName && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {driverStats[0].siteName}
                      </span>
                    )}
                  </div>
                  <p className="text-4xl font-black text-yellow-600 mb-2">{driverStats[0].performanceScore}</p>
                  <Badge className="bg-yellow-500 text-white mb-3 text-sm">🏆 Champion</Badge>
                  <div className="space-y-1 text-sm text-slate-600">
                    <p className="font-semibold">{driverStats[0].totalWashes} washes</p>
                    <p>🔥 {driverStats[0].currentStreak} day streak</p>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-center mt-3">
                    {driverStats[0].badges.slice(0, 3).map((badge, idx) => (
                      <badge.icon key={idx} className={`w-5 h-5 ${badge.color}`} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* 3rd Place */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-8"
            >
              <Card className="border-2 border-orange-300 shadow-lg">
                <CardContent className="p-6 text-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 mx-auto flex items-center justify-center mb-4">
                    <Medal className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="font-bold text-xl mb-1">{driverStats[2].name}</h3>
                  <div className="flex items-center justify-center gap-2 text-xs mb-1">
                    {driverStats[2].customerName && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {driverStats[2].customerName}
                      </span>
                    )}
                    {driverStats[2].siteName && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {driverStats[2].siteName}
                      </span>
                    )}
                  </div>
                  <p className="text-3xl font-black text-orange-600 mb-2">{driverStats[2].performanceScore}</p>
                  <Badge className="bg-orange-500 text-white mb-3">3rd Place</Badge>
                  <div className="space-y-1 text-sm text-slate-600">
                    <p>{driverStats[2].totalWashes} washes</p>
                    <p>🔥 {driverStats[2].currentStreak} day streak</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Full Rankings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#7CB342]" />
              Complete Rankings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {driverStats.map((driver, index) => (
              <motion.div
                key={driver.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-4 p-4 bg-white rounded-lg border border-slate-200 hover:shadow-md transition-shadow"
              >
                {/* Rank */}
                <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${getRankColor(driver.rank)} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                  {getRankIcon(driver.rank)}
                </div>

                {/* Driver Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-lg text-slate-800">{driver.name}</h3>
                    {driver.customerName && (
                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {driver.customerName}
                      </Badge>
                    )}
                    {driver.siteName && (
                      <Badge variant="secondary" className="text-xs flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {driver.siteName}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 flex-wrap">
                    <span className="text-sm text-slate-600">{driver.totalWashes} washes</span>
                    <span className="text-sm text-slate-600">🔥 {driver.currentStreak} day streak</span>
                    {driver.maxStreak > 7 && (
                      <span className="text-sm text-slate-600">🏅 {driver.maxStreak} max streak</span>
                    )}
                  </div>
                  {/* Badges */}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {driver.badges.map((badge, idx) => (
                      <Badge key={idx} variant="outline" className="flex items-center gap-1 text-xs">
                        <badge.icon className={`w-3 h-3 ${badge.color}`} />
                        {badge.name}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Performance Score */}
                <div className="text-right flex-shrink-0">
                  <p className="text-3xl font-black text-[#7CB342]">{driver.performanceScore}</p>
                  <p className="text-xs text-slate-500">Performance</p>
                  <Progress value={driver.performanceScore} className="w-24 mt-2 h-2" />
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>

        {/* Achievement Legend */}
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-purple-600" />
              Achievement Badges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { name: 'Elite Performer', icon: Crown, desc: '90+ score', color: 'text-yellow-500' },
                { name: 'Top Performer', icon: Trophy, desc: '80+ score', color: 'text-purple-500' },
                { name: 'Wash Master', icon: Zap, desc: '50+ washes', color: 'text-blue-500' },
                { name: 'Century Club', icon: Award, desc: '100+ washes', color: 'text-emerald-500' },
                { name: 'Week Warrior', icon: Flame, desc: '7 day streak', color: 'text-orange-500' },
                { name: 'Consistency King', icon: Star, desc: '14 day streak', color: 'text-red-500' },
                { name: 'Marathon Master', icon: Target, desc: '30 day streak', color: 'text-indigo-500' },
              ].map((badge) => (
                <div key={badge.name} className="flex items-center gap-2 p-3 bg-white rounded-lg border border-slate-200">
                  <badge.icon className={`w-6 h-6 ${badge.color}`} />
                  <div>
                    <p className="text-xs font-semibold text-slate-800">{badge.name}</p>
                    <p className="text-xs text-slate-500">{badge.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
