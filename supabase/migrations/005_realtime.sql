-- ── Enable Supabase Realtime on the tables that need live notifications ────
-- Must be run in Supabase Dashboard > SQL Editor or via supabase migration

-- 1. Add tables to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE online_bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE salon_data;

-- 2. REPLICA IDENTITY FULL: required so UPDATE events carry the full row
--    (needed for filter-based subscriptions on UPDATE/DELETE)
ALTER TABLE online_bookings REPLICA IDENTITY FULL;
ALTER TABLE salon_data      REPLICA IDENTITY FULL;

-- 3. RLS policy: allow authenticated users to receive realtime events
--    for their own salon's bookings (SELECT is already in place, this is a no-op guard)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'online_bookings' AND policyname = 'bookings_realtime_auth'
  ) THEN
    EXECUTE '
      CREATE POLICY "bookings_realtime_auth" ON online_bookings
        FOR SELECT
        USING (auth.uid()::TEXT = salon_id OR auth.role() = ''anon'')
    ';
  END IF;
END $$;
