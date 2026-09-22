-- Add columns to support birthday notifications
ALTER TABLE public.notifications
  ADD COLUMN related_child_id UUID REFERENCES public.children(id) ON DELETE CASCADE,
  ADD COLUMN birthday_year INTEGER;

-- Update the UNIQUE constraint to support both event and birthday notifications
-- Drop the old constraint
ALTER TABLE public.notifications
  DROP CONSTRAINT notifications_user_id_related_event_id_scheduled_for_key;

-- Add new constraint that supports both types
-- For event notifications: (user_id, related_event_id, scheduled_for) must be unique
-- For birthday notifications: (user_id, related_child_id, birthday_year) must be unique
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_uniqueness UNIQUE (
    user_id,
    COALESCE(related_event_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(related_child_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(scheduled_for, '1970-01-01 00:00:00'::timestamptz),
    COALESCE(birthday_year, 0)
  );

-- Create indexes for birthday notifications
CREATE INDEX notifications_child_id_idx ON public.notifications (related_child_id);
CREATE INDEX notifications_birthday_year_idx ON public.notifications (birthday_year);
