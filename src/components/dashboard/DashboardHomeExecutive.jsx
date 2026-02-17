import React from 'react';
import { Link } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import {
  AlertTriangle,
  ChevronRight,
  Bot,
  Activity,
  FileText,
  BarChart3,
  MessageSquare,
  Wrench,
  Droplets,
  Info,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { motion } from 'framer-motion';
import moment from 'moment';

/** Greeting based on user's local time (from their device/PC). */
function getGreeting() {
  const hour = new Date().getHours(); // 0–23 in user's local timezone
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Good night'; // 21:00–04:59 local
}

/**
 * Executive summary for the compliance dashboard — Action Required, AI Insight, Quick Links, Recent Activity.
 * Tab visibility respected: items hidden when user cannot access the corresponding tab.
 */
export default function DashboardHomeExecutive({
  userName,
  companyName,
  lastUpdatedAt,
  filteredVehicles = [],
  filteredScans = [],
  hasAIInsights = false,
  hasSMSAlerts = false,
  hasDeviceHealth = false,
  hasEmailReports = false,
  onViewBelow50Click,
  showWelcome = true,
}) {
  const firstName = (userName || '').split(/\s+/)[0] || 'there';
  const greeting = getGreeting();

  const targetDefault = 12;
  const getTargetWashes = (v) => v?.protocolNumber ?? v?.target ?? targetDefault;

  const lastUpdatedStr = lastUpdatedAt
    ? formatDistanceToNow(typeof lastUpdatedAt === 'number' ? new Date(lastUpdatedAt) : lastUpdatedAt, {
        addSuffix: false,
      })
    : null;

  // Map vehicleRef -> name for Recent Activity
  const vehicleNameMap = React.useMemo(() => {
    const map = new Map();
    filteredVehicles.forEach((v) => {
      const ref = v.id ?? v.vehicleRef ?? v.rfid;
      if (ref) map.set(String(ref), v.name ?? v.id ?? ref);
    });
    return map;
  }, [filteredVehicles]);

  const actionItems = [];
  const criticalVehicle = filteredVehicles.find((v) => (v.washes_completed ?? 0) === 0);
  if (criticalVehicle && hasAIInsights) {
    const target = getTargetWashes(criticalVehicle);
    const name = criticalVehicle.name ?? criticalVehicle.id ?? 'Vehicle';
    actionItems.push({
      id: 'critical-vehicle',
      label: `${name} — Critical, 0/${target}`,
      action: 'Send Reminder',
      href: '/ai-insights',
      icon: MessageSquare,
      infoTooltip: 'Send alerts from the Risk Predictions tab',
    });
  }
  if (hasDeviceHealth) {
    actionItems.push({
      id: 'devices',
      label: 'Device Health Check',
      action: 'View',
      href: '/device-health',
      icon: Wrench,
    });
  }
  const below50Count = filteredVehicles.filter((v) => {
    const target = getTargetWashes(v);
    const washes = v.washes_completed ?? 0;
    return target > 0 && washes > 0 && (washes / target) * 100 < 50;
  }).length;
  if (below50Count > 0) {
    actionItems.push({
      id: 'below-50',
      label: `${below50Count} vehicle${below50Count !== 1 ? 's' : ''} below 50% weekly progress`,
      action: 'View List',
      isScroll: true,
      icon: BarChart3,
    });
  }
  if (hasAIInsights) {
    actionItems.push({
      id: 'ai',
      label: 'AI recommendations',
      action: 'View',
      href: '/ai-insights',
      icon: Bot,
      infoTooltip: 'Go to the Recommendations tab',
    });
  }
  if (hasEmailReports) {
    actionItems.push({
      id: 'report',
      label: 'Weekly report',
      action: 'Generate',
      href: '/email-reports',
      icon: FileText,
    });
  }

  const recentActivity = filteredScans
    .slice()
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
    .slice(0, 5)
    .map((s, i) => {
      const name = vehicleNameMap.get(String(s.vehicleRef)) ?? s.vehicleRef ?? 'Vehicle';
      return {
        id: `scan-${i}`,
        text: `${name} washed at ${s.siteName ?? 'site'}`,
        time: s.timestamp ? moment(s.timestamp).fromNow() : null,
      };
    });

  const quickLinks = [
    { label: 'Run AI Analysis', path: '/ai-insights', show: hasAIInsights },
    { label: 'Download Weekly Report', path: '/email-reports', show: hasEmailReports },
    { label: 'SMS Reminder Queue', path: '/ai-insights', show: hasSMSAlerts, infoTooltip: 'Send alerts from the Risk Predictions tab' },
    { label: 'Device Health Check', path: '/device-health', show: hasDeviceHealth },
  ].filter((l) => l.show);

  const aiInsight = {
    text: 'Friday compliance is 34% below average across sites.',
    recommendation:
      'Schedule SMS reminders for Thursday afternoon to prompt Friday morning washes. This could improve weekly compliance by an estimated 12%.',
    confidence: 91,
    dataWeeks: 8,
  };

  const handleBelow50Click = () => {
    const el = document.getElementById('vehicle-compliance-table');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    onViewBelow50Click?.();
  };

  return (
    <TooltipProvider>
      <div className="space-y-5">
        {showWelcome && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-lg border border-border/60 bg-card/50 px-4 py-3"
          >
            <h2 className="text-base font-semibold text-foreground">
              {greeting}, {firstName}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {format(new Date(), 'EEEE d MMM yyyy')}
              {companyName && ` · ${companyName}`}
              {lastUpdatedStr && ` · Updated ${lastUpdatedStr} ago`}
            </p>
          </motion.div>
        )}

        {/* Four equal-size cards: Action Required, AI Insight, Quick Links, Recent Activity */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:grid-rows-2 lg:auto-rows-fr">
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="min-h-[280px] lg:min-h-0 lg:h-full">
            <Card className="h-full overflow-hidden border-border/60 bg-card flex flex-col">
              <CardContent className="p-4 flex-1 flex flex-col min-h-0 overflow-y-auto">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground shrink-0">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Action Required
                </h3>
                {actionItems.length > 0 ? (
                  <ul className="mt-3 space-y-2 flex-1 min-h-0">
                    {actionItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="truncate text-foreground">{item.label}</span>
                            {item.infoTooltip && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground hover:text-foreground" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[220px] text-xs">
                                  {item.infoTooltip}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          {item.isScroll ? (
                            <button
                              type="button"
                              onClick={handleBelow50Click}
                              className="shrink-0 text-xs font-medium text-primary hover:underline"
                            >
                              {item.action} →
                            </button>
                          ) : (
                            <Link
                              to={item.href}
                              className="shrink-0 text-xs font-medium text-primary hover:underline"
                            >
                              {item.action} →
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground flex-1">No actions required right now.</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {hasAIInsights && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.05 }} className="min-h-[280px] lg:min-h-0 lg:h-full">
              <Card className="h-full overflow-hidden border-border/60 bg-card flex flex-col">
                <CardContent className="p-4 flex-1 flex flex-col min-h-0 overflow-y-auto">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                    AI Insight of the Day
                  </h3>
                  <p className="mt-2 text-xs text-muted-foreground">{aiInsight.text}</p>
                  <p className="mt-1.5 text-xs text-foreground flex-1 min-h-0">
                    <span className="font-medium">Recommendation: </span>
                    {aiInsight.recommendation}
                  </p>
                  <p className="mt-2 text-[11px] text-muted-foreground shrink-0">
                    Confidence: {aiInsight.confidence}% · {aiInsight.dataWeeks} weeks of data
                  </p>
                  <Link
                    to="/ai-insights"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline shrink-0"
                  >
                    View AI Insights
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.08 }} className="min-h-[280px] lg:min-h-0 lg:h-full">
            <Card className="h-full overflow-hidden border-border/60 bg-card flex flex-col">
              <CardContent className="p-4 flex-1 flex flex-col min-h-0 overflow-y-auto">
                <h3 className="text-sm font-semibold text-foreground shrink-0">Quick Links</h3>
                {quickLinks.length > 0 ? (
                  <ul className="mt-2 space-y-1.5 flex-1 min-h-0">
                    {quickLinks.map((link) => (
                      <li key={link.path + link.label} className="flex items-center gap-2">
                        <Link
                          to={link.path}
                          className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-primary"
                        >
                          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                          {link.label}
                        </Link>
                        {link.infoTooltip && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info
                                className="h-3 w-3 shrink-0 cursor-help text-muted-foreground"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[220px] text-xs">
                              {link.infoTooltip}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground flex-1">No quick links available.</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.1 }} className="min-h-[280px] lg:min-h-0 lg:h-full">
            <Card className="h-full overflow-hidden border-border/60 bg-card flex flex-col">
              <CardContent className="p-4 flex-1 flex flex-col min-h-0 overflow-y-auto">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground shrink-0">
                  <Activity className="h-4 w-4 text-primary" />
                  Recent Activity
                </h3>
                {recentActivity.length > 0 ? (
                  <ul className="mt-2 space-y-1.5 flex-1 min-h-0">
                    {recentActivity.map((a) => (
                      <li key={a.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Droplets className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                        <span>
                          {a.time && `${a.time} — `}
                          {a.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground flex-1">
                    No recent activity to display.
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </TooltipProvider>
  );
}
