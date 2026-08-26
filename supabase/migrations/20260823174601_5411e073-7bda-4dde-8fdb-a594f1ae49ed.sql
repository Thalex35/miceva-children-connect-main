
-- roles
CREATE TYPE public.app_role AS ENUM ('admin', 'member');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- children
CREATE TABLE public.children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  approximate_age INTEGER,
  gender TEXT,
  address TEXT,
  class_group TEXT,
  registration_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX children_last_name_idx ON public.children (lower(last_name));
CREATE INDEX children_first_name_idx ON public.children (lower(first_name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.children TO authenticated;
GRANT ALL ON public.children TO service_role;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
CREATE POLICY "children_select" ON public.children FOR SELECT TO authenticated USING (true);
CREATE POLICY "children_insert" ON public.children FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "children_update" ON public.children FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "children_delete_admin" ON public.children FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER children_updated_at BEFORE UPDATE ON public.children FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  name TEXT,
  relationship TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_emergency BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX guardians_child_id_idx ON public.guardians (child_id);
CREATE INDEX guardians_phone_idx ON public.guardians (phone);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guardians TO authenticated;
GRANT ALL ON public.guardians TO service_role;
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guardians_select" ON public.guardians FOR SELECT TO authenticated USING (true);
CREATE POLICY "guardians_insert" ON public.guardians FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "guardians_update" ON public.guardians FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "guardians_delete" ON public.guardians FOR DELETE TO authenticated USING (true);
CREATE TRIGGER guardians_updated_at BEFORE UPDATE ON public.guardians FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.administration_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  responsibilities TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.administration_members TO authenticated;
GRANT ALL ON public.administration_members TO service_role;
ALTER TABLE public.administration_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_members_select" ON public.administration_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_members_insert" ON public.administration_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admin_members_update" ON public.administration_members FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_members_delete_admin" ON public.administration_members FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER admin_members_updated_at BEFORE UPDATE ON public.administration_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ,
  location TEXT,
  responsible_person TEXT,
  event_type TEXT NOT NULL DEFAULT 'other',
  recurrence TEXT NOT NULL DEFAULT 'none',
  recurrence_days INTEGER[],
  recurrence_until DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX events_start_idx ON public.events (start_datetime);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_select" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "events_insert" ON public.events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "events_update" ON public.events FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "events_delete_admin" ON public.events FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.event_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  occurrence_date DATE NOT NULL,
  cancelled BOOLEAN NOT NULL DEFAULT false,
  override_title TEXT,
  override_start_time TIME,
  override_end_time TIME,
  override_location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, occurrence_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_exceptions TO authenticated;
GRANT ALL ON public.event_exceptions TO service_role;
ALTER TABLE public.event_exceptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event_exceptions_all" ON public.event_exceptions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  username TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_at_idx ON public.audit_logs (created_at DESC);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select" ON public.audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit_insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- profile auto-creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'member'))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- seed administration members
INSERT INTO public.administration_members (name, role) VALUES
  ('Theodore Louisjuste', 'Management / Coordinator'),
  ('Daphca Vilbrun', 'Secretary'),
  ('Andy Vilbrun', 'Disciplinary'),
  ('Rosena Silin', 'Principal');

-- seed recurring prayer activities
INSERT INTO public.events (title, description, start_datetime, end_datetime, location, event_type, recurrence, recurrence_days)
VALUES
  ('Sunday Prayer Meeting', 'Weekly prayer meeting', '2026-01-04 09:00:00+00', '2026-01-04 10:30:00+00', 'Church', 'prayer', 'weekly', ARRAY[0]),
  ('Tuesday Prayer Meeting', 'Weekly prayer meeting', '2026-01-06 17:00:00+00', '2026-01-06 18:30:00+00', 'Church', 'prayer', 'weekly', ARRAY[2]);

-- seed children from the 2026 register (supplied entries)
WITH data(last_name, first_name, dob, approx_age, phone) AS (VALUES
  ('Benoit', 'Jackson Fils', DATE '2014-01-20', 12, '37 93 15 75'),
  ('Benoit', 'Jackson Ley', DATE '2023-12-11', 2, NULL),
  ('Bis', 'Kervens Rondellyson', NULL, NULL, NULL),
  ('Delva', 'James', DATE '2013-06-05', 12, NULL),
  ('Dévine', 'Guerson', DATE '2015-01-20', 11, NULL),
  ('Doryson', 'Joseph', DATE '2015-10-01', 11, NULL),
  ('Dumé', 'Anne Darlie Julia', DATE '2015-06-26', 11, '34 10 32 39'),
  ('Exilus', 'Alexandelle', DATE '2014-12-04', 11, NULL),
  ('Ferjus', 'Charnia', DATE '2017-05-10', 9, '31 46 80 55'),
  ('Ferjus', 'Charnison', DATE '2017-05-10', 9, '31 46 80 55'),
  ('Ferjus', 'Fredena', DATE '2014-03-24', 12, '31 46 80 55'),
  ('François', 'Naïssa', DATE '2016-06-03', NULL, NULL),
  ('François', 'Watson', DATE '2015-10-06', 11, '46 18 06 23')
), ins AS (
  INSERT INTO public.children (first_name, last_name, date_of_birth, approximate_age)
  SELECT first_name, last_name, dob, approx_age FROM data
  RETURNING id, first_name, last_name
)
INSERT INTO public.guardians (child_id, phone, is_primary, relationship)
SELECT ins.id, data.phone, true, 'Parent / Guardian'
FROM ins JOIN data ON data.first_name = ins.first_name AND data.last_name = ins.last_name
WHERE data.phone IS NOT NULL;
