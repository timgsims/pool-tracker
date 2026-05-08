ALTER TABLE seasons ADD COLUMN IF NOT EXISTS stats_available boolean NOT NULL DEFAULT true;

-- Mark seasons with randomised historical data as excluded from date-sensitive stats
UPDATE seasons SET stats_available = false WHERE name IN ('2024', '2025');

-- Any non-active season whose end_date is in the future should not appear as a past season view
UPDATE seasons SET stats_available = false WHERE is_active = false AND end_date >= CURRENT_DATE AND name NOT IN ('2024', '2025');
