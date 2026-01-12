import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Scheduled Email Report Delivery
 * This function should be triggered by a cron job (daily, weekly, monthly)
 * It checks all users with email report preferences enabled and sends reports
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    console.log('Starting scheduled report delivery...');

    // Fetch all email report preferences
    const allPreferences = await base44.asServiceRole.entities.EmailReportPreferences.list();

    if (!allPreferences || allPreferences.length === 0) {
      console.log('No email report preferences found');
      return new Response(JSON.stringify({
        success: true,
        message: 'No users with email reports enabled',
        sentCount: 0
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const now = new Date();
    const results = {
      total: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      errors: []
    };

    // Process each user's preferences
    for (const pref of allPreferences) {
      results.total++;

      // Skip if not enabled
      if (!pref.enabled) {
        console.log(`Skipping ${pref.user_email} - reports not enabled`);
        results.skipped++;
        continue;
      }

      // Check if it's time to send based on frequency
      const shouldSend = checkIfShouldSend(pref, now);

      if (!shouldSend) {
        console.log(`Skipping ${pref.user_email} - not scheduled for now`);
        results.skipped++;
        continue;
      }

      // Send the report
      try {
        console.log(`Sending report to ${pref.user_email}...`);

        // Invoke the sendEmailReport function
        await base44.asServiceRole.functions.invoke('sendEmailReport', {
          userEmail: pref.user_email,
          reportTypes: pref.report_types || [],
          includeCharts: pref.include_charts !== false,
          includeAiInsights: pref.include_ai_insights !== false
        });

        // Update next scheduled time
        const nextScheduled = calculateNextScheduled(
          pref.frequency,
          now,
          pref.scheduled_time || '09:00',
          pref.scheduled_day_of_week ?? 1,
          pref.scheduled_day_of_month || 1
        );
        await base44.asServiceRole.entities.EmailReportPreferences.update(pref.id, {
          last_sent: now.toISOString(),
          next_scheduled: nextScheduled
        });

        console.log(`Successfully sent report to ${pref.user_email}`);
        results.sent++;

      } catch (error) {
        console.error(`Error sending report to ${pref.user_email}:`, error);
        results.failed++;
        results.errors.push({
          email: pref.user_email,
          error: error.message
        });
      }
    }

    console.log('Scheduled report delivery complete:', results);

    return new Response(JSON.stringify({
      success: true,
      message: 'Scheduled report delivery complete',
      results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Scheduled reports function error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

/**
 * Check if a report should be sent now based on frequency and last sent time
 */
function checkIfShouldSend(pref, now) {
  if (!pref.last_sent) {
    // Never sent before, check if it's the scheduled time today
    return isScheduledTimeNow(pref, now);
  }

  const lastSent = new Date(pref.last_sent);
  const hoursSinceLastSent = (now - lastSent) / (1000 * 60 * 60);

  // Check if enough time has passed AND if it's the scheduled time
  switch (pref.frequency) {
    case 'daily':
      // Send if more than 23 hours since last sent AND it's the scheduled time
      return hoursSinceLastSent >= 23 && isScheduledTimeNow(pref, now);

    case 'weekly':
      // Send if more than 6.5 days since last sent AND it's the scheduled day/time
      return hoursSinceLastSent >= 156 && isScheduledTimeNow(pref, now);

    case 'monthly':
      // Send if more than 29 days since last sent AND it's the scheduled day/time
      return hoursSinceLastSent >= 696 && isScheduledTimeNow(pref, now);

    default:
      return false;
  }
}

/**
 * Check if current time matches the scheduled time for sending
 */
function isScheduledTimeNow(pref, now) {
  const scheduledTime = pref.scheduled_time || '09:00';
  const [scheduledHour, scheduledMinute] = scheduledTime.split(':').map(Number);

  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // Check if we're within a 1-hour window of the scheduled time
  // This gives flexibility for cron job timing
  const isTimeMatch = Math.abs(currentHour - scheduledHour) === 0 &&
                      Math.abs(currentMinute - scheduledMinute) <= 30;

  if (!isTimeMatch) {
    return false;
  }

  // For weekly, check day of week
  if (pref.frequency === 'weekly') {
    const scheduledDayOfWeek = pref.scheduled_day_of_week ?? 1; // Default Monday
    const currentDayOfWeek = now.getDay();
    return currentDayOfWeek === scheduledDayOfWeek;
  }

  // For monthly, check day of month
  if (pref.frequency === 'monthly') {
    const scheduledDayOfMonth = pref.scheduled_day_of_month || 1;
    const currentDayOfMonth = now.getDate();
    return currentDayOfMonth === scheduledDayOfMonth;
  }

  // For daily, just the time match is enough
  return true;
}

/**
 * Calculate the next scheduled send time based on frequency
 */
function calculateNextScheduled(frequency, fromDate, scheduledTime = '09:00', dayOfWeek = 1, dayOfMonth = 1) {
  const now = new Date(fromDate);
  const [hours, minutes] = scheduledTime.split(':').map(Number);

  let nextDate = new Date(fromDate);

  switch (frequency) {
    case 'daily':
      nextDate.setHours(hours, minutes, 0, 0);
      nextDate.setDate(nextDate.getDate() + 1);
      break;

    case 'weekly':
      nextDate.setHours(hours, minutes, 0, 0);
      nextDate.setDate(nextDate.getDate() + 7);
      break;

    case 'monthly':
      nextDate.setHours(hours, minutes, 0, 0);
      nextDate.setMonth(nextDate.getMonth() + 1);
      nextDate.setDate(dayOfMonth);
      break;

    default:
      // Default to weekly
      nextDate.setHours(hours, minutes, 0, 0);
      nextDate.setDate(nextDate.getDate() + 7);
  }

  return nextDate.toISOString();
}
