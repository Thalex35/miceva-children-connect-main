CREATE TABLE public.finance_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX finance_categories_type_idx ON public.finance_categories (type);
CREATE INDEX finance_categories_name_idx ON public.finance_categories (name);

GRANT SELECT, INSERT, UPDATE ON public.finance_categories TO authenticated;
GRANT ALL ON public.finance_categories TO service_role;
ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_categories_select_authenticated" ON public.finance_categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "finance_categories_insert_admin" ON public.finance_categories
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "finance_categories_update_admin" ON public.finance_categories
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER finance_categories_updated_at BEFORE UPDATE ON public.finance_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'HTG' CHECK (currency IN ('HTG', 'USD')),
  category_id UUID NOT NULL REFERENCES public.finance_categories(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_voided BOOLEAN NOT NULL DEFAULT false,
  void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX financial_transactions_date_idx ON public.financial_transactions (date DESC);
CREATE INDEX financial_transactions_type_idx ON public.financial_transactions (type);
CREATE INDEX financial_transactions_category_idx ON public.financial_transactions (category_id);
CREATE INDEX financial_transactions_created_by_idx ON public.financial_transactions (created_by);
CREATE INDEX financial_transactions_is_voided_idx ON public.financial_transactions (is_voided);

GRANT SELECT, INSERT, UPDATE ON public.financial_transactions TO authenticated;
GRANT ALL ON public.financial_transactions TO service_role;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_transactions_select_admin" ON public.financial_transactions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "financial_transactions_insert_admin" ON public.financial_transactions
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "financial_transactions_update_admin" ON public.financial_transactions
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER financial_transactions_updated_at BEFORE UPDATE ON public.financial_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.finance_categories (name, type, description)
VALUES
  ('Offering', 'income', 'Regular church offerings'),
  ('Tithe', 'income', 'Tithe contributions'),
  ('Donation', 'income', 'General donations'),
  ('Fundraising', 'income', 'Fundraising income'),
  ('Autre revenu', 'income', 'Other income sources'),
  ('Lait', 'expense', 'Milk and dairy products'),
  ('Pain', 'expense', 'Bread and bakery items'),
  ('Sucre', 'expense', 'Sugar and related supplies'),
  ('Eau', 'expense', 'Water and related supplies'),
  ('Autre', 'expense', 'Other expense category'),
  ('Electricity', 'expense', 'Power and utilities'),
  ('Transportation', 'expense', 'Transportation costs'),
  ('Church Supplies', 'expense', 'Church materials and supplies'),
  ('Children''s Ministry', 'expense', 'Children''s ministry costs'),
  ('Maintenance', 'expense', 'Repairs and upkeep'),
  ('Events', 'expense', 'Special event expenses');
