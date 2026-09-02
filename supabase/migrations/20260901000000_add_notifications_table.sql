-- Create notifications table for in-app event reminders
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'event_reminder',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  event_occurrence_date DATE,
  scheduled_for TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, related_event_id, scheduled_for)
);

CREATE INDEX notifications_user_id_idx ON public.notifications (user_id);
CREATE INDEX notifications_user_read_idx ON public.notifications (user_id, read_at);
CREATE INDEX notifications_created_at_idx ON public.notifications (created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Users can create their own notifications from the app
CREATE POLICY "notifications_insert_own" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Users can only update their own notifications
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Service role can insert notifications
CREATE POLICY "notifications_insert_service_role" ON public.notifications FOR INSERT TO service_role WITH CHECK (true);
