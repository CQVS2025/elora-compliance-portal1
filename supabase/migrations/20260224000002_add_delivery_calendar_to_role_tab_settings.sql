-- Add delivery-calendar to existing role_tab_settings so the new tab appears for all roles
-- that already have tab overrides. Safe to run multiple times.
-- Migration: 20260224000002_add_delivery_calendar_to_role_tab_settings

UPDATE role_tab_settings
SET visible_tabs = array_append(visible_tabs, 'delivery-calendar'),
    updated_at = NOW()
WHERE NOT ('delivery-calendar' = ANY(visible_tabs));
