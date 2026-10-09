-- Supabase schema for the P2C e-commerce app
-- Run this once in the Supabase SQL editor after creating your project.

create extension if not exists pgcrypto;

-- Common updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Helper role checks
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

create or replace function public.can_access_order(order_buyer uuid, order_seller uuid, order_delivery uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = order_buyer
      or auth.uid() = order_seller
      or auth.uid() = order_delivery
      or public.is_admin();
$$;

-- Profiles extend auth.users and back the app's auth/profile state
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'User',
  email text not null unique,
  phone_number text default '',
  sms_notifications boolean not null default false,
  role text not null default 'consumer' check (role in ('admin', 'producer', 'consumer', 'delivery')),
  wallet_balance numeric(10, 2) not null default 0 check (wallet_balance >= 0),
  is_verified boolean not null default false,
  is_online boolean not null default false,
  strikes integer not null default 0 check (strikes >= 0),
  is_suspended boolean not null default false,
  pending_profile_changes jsonb,
  location jsonb,
  last_location_update timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Products match the producer dashboard and storefront
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  price numeric(10, 2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  category text not null default 'General',
  images jsonb not null default '[]'::jsonb,
  video_url text default '',
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

-- Orders back the buyer, seller, and delivery views
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  buyer_name text,
  shipping_address text,
  seller_id uuid references public.profiles(id) on delete set null,
  delivery_boy_id uuid references public.profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned')),
  total_amount numeric(10, 2) not null check (total_amount >= 0),
  delivery_coordinates jsonb,
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

-- Order items are normalized so order history and detail views can be reconstructed.
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  title text not null,
  quantity integer not null check (quantity > 0),
  price numeric(10, 2) not null check (price >= 0),
  created_at timestamptz not null default now()
);

-- Wallet / penalty / revenue history
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  amount numeric(10, 2) not null,
  transaction_type text not null,
  status text not null default 'pending',
  description text,
  timestamp timestamptz not null default now()
);

-- Reviews power the product details page
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_name text not null,
  rating integer not null check (rating between 1 and 5),
  comment text not null,
  timestamp timestamptz not null default now()
);

-- Wishlist and cart
create table if not exists public.wishlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create table if not exists public.cart (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id)
);

drop trigger if exists trg_cart_updated_at on public.cart;
create trigger trg_cart_updated_at
before update on public.cart
for each row execute function public.set_updated_at();

-- Audit log table used by the client helper
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  collection text not null,
  document_id text not null,
  operation_type text not null,
  changes jsonb,
  user_id uuid references public.profiles(id) on delete set null,
  timestamp timestamptz not null default now()
);

-- Health check table for the client connection test
create table if not exists public.health_check (
  id serial primary key,
  status text not null default 'ok',
  checked_at timestamptz not null default now()
);

-- Auto-create a profile whenever a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  requested_name text;
  requested_phone text;
begin
  requested_role := lower(coalesce(new.raw_user_meta_data->>'role', 'consumer'));
  if new.email = 'vpk525252@gmail.com' then
    requested_role := 'admin';
  end if;

  if requested_role not in ('admin', 'producer', 'consumer', 'delivery') then
    requested_role := 'consumer';
  end if;

  requested_name := coalesce(
    new.raw_user_meta_data->>'displayName',
    new.raw_user_meta_data->>'name',
    split_part(coalesce(new.email, ''), '@', 1),
    'User'
  );

  requested_phone := coalesce(
    new.raw_user_meta_data->>'phoneNumber',
    new.raw_user_meta_data->>'phone_number',
    ''
  );

  insert into public.profiles (
    id,
    name,
    email,
    phone_number,
    sms_notifications,
    role,
    wallet_balance,
    is_verified,
    is_online,
    strikes,
    is_suspended,
    pending_profile_changes,
    location,
    last_location_update
  )
  values (
    new.id,
    requested_name,
    coalesce(new.email, ''),
    requested_phone,
    coalesce((new.raw_user_meta_data->>'smsNotifications')::boolean, false),
    requested_role,
    0,
    requested_role in ('admin', 'delivery'),
    false,
    0,
    false,
    null,
    null,
    null
  )
  on conflict (id) do update set
    name = excluded.name,
    email = excluded.email,
    phone_number = excluded.phone_number,
    role = excluded.role,
    is_verified = excluded.is_verified;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Indexes
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_products_seller_id on public.products(seller_id);
create index if not exists idx_products_category on public.products(category);
create index if not exists idx_products_available on public.products(is_available);
create index if not exists idx_orders_buyer_id on public.orders(buyer_id);
create index if not exists idx_orders_seller_id on public.orders(seller_id);
create index if not exists idx_orders_delivery_boy_id on public.orders(delivery_boy_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_transactions_user_id on public.transactions(user_id);
create index if not exists idx_transactions_order_id on public.transactions(order_id);
create index if not exists idx_reviews_product_id on public.reviews(product_id);
create index if not exists idx_wishlist_user_id on public.wishlist(user_id);
create index if not exists idx_cart_user_id on public.cart(user_id);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.transactions enable row level security;
alter table public.reviews enable row level security;
alter table public.wishlist enable row level security;
alter table public.cart enable row level security;
alter table public.audit_logs enable row level security;

-- Drop policies so the script can be re-run safely
drop policy if exists "Profiles are viewable by owner or admin" on public.profiles;
drop policy if exists "Profiles are insertable by owner or admin" on public.profiles;
drop policy if exists "Profiles are updatable by owner or admin" on public.profiles;

drop policy if exists "Products are viewable by everyone" on public.products;
drop policy if exists "Products are insertable by owner or admin" on public.products;
drop policy if exists "Products are updatable by owner or admin" on public.products;
drop policy if exists "Products are deletable by owner or admin" on public.products;

drop policy if exists "Orders are viewable by participants or admin" on public.orders;
drop policy if exists "Orders are insertable by buyer or admin" on public.orders;
drop policy if exists "Orders are updatable by participants or admin" on public.orders;

drop policy if exists "Order items are viewable by participants or admin" on public.order_items;

drop policy if exists "Transactions are viewable by owner or admin" on public.transactions;
drop policy if exists "Transactions are insertable by owner or admin" on public.transactions;

drop policy if exists "Reviews are viewable by everyone" on public.reviews;
drop policy if exists "Reviews are insertable by owner or admin" on public.reviews;
drop policy if exists "Reviews are updatable by owner or admin" on public.reviews;
drop policy if exists "Reviews are deletable by owner or admin" on public.reviews;

drop policy if exists "Wishlist is viewable by owner or admin" on public.wishlist;
drop policy if exists "Wishlist is insertable by owner or admin" on public.wishlist;
drop policy if exists "Wishlist is deletable by owner or admin" on public.wishlist;

drop policy if exists "Cart is viewable by owner or admin" on public.cart;
drop policy if exists "Cart is insertable by owner or admin" on public.cart;
drop policy if exists "Cart is updatable by owner or admin" on public.cart;
drop policy if exists "Cart is deletable by owner or admin" on public.cart;

drop policy if exists "Audit logs are viewable by owner or admin" on public.audit_logs;
drop policy if exists "Audit logs are insertable by owner or admin" on public.audit_logs;

-- Profiles
create policy "Profiles are viewable by owner or admin"
on public.profiles
for select
using (auth.uid() = id or public.is_admin());

create policy "Profiles are insertable by owner or admin"
on public.profiles
for insert
with check (auth.uid() = id or public.is_admin());

create policy "Profiles are updatable by owner or admin"
on public.profiles
for update
using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

-- Products
create policy "Products are viewable by everyone"
on public.products
for select
using (true);

create policy "Products are insertable by owner or admin"
on public.products
for insert
with check (auth.uid() = seller_id or public.is_admin());

create policy "Products are updatable by owner or admin"
on public.products
for update
using (auth.uid() = seller_id or public.is_admin())
with check (auth.uid() = seller_id or public.is_admin());

create policy "Products are deletable by owner or admin"
on public.products
for delete
using (auth.uid() = seller_id or public.is_admin());

-- Orders
create policy "Orders are viewable by participants or admin"
on public.orders
for select
using (public.can_access_order(buyer_id, seller_id, delivery_boy_id));

create policy "Orders are insertable by buyer or admin"
on public.orders
for insert
with check (auth.uid() = buyer_id or public.is_admin());

create policy "Orders are updatable by participants or admin"
on public.orders
for update
using (public.can_access_order(buyer_id, seller_id, delivery_boy_id))
with check (public.can_access_order(buyer_id, seller_id, delivery_boy_id));

-- Order items
create policy "Order items are viewable by participants or admin"
on public.order_items
for select
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and public.can_access_order(o.buyer_id, o.seller_id, o.delivery_boy_id)
  )
);

-- Transactions
create policy "Transactions are viewable by owner or admin"
on public.transactions
for select
using (auth.uid() = user_id or public.is_admin());

create policy "Transactions are insertable by owner or admin"
on public.transactions
for insert
with check (auth.uid() = user_id or public.is_admin());

-- Reviews
create policy "Reviews are viewable by everyone"
on public.reviews
for select
using (true);

create policy "Reviews are insertable by owner or admin"
on public.reviews
for insert
with check (auth.uid() = user_id or public.is_admin());

create policy "Reviews are updatable by owner or admin"
on public.reviews
for update
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

create policy "Reviews are deletable by owner or admin"
on public.reviews
for delete
using (auth.uid() = user_id or public.is_admin());

-- Wishlist
create policy "Wishlist is viewable by owner or admin"
on public.wishlist
for select
using (auth.uid() = user_id or public.is_admin());

create policy "Wishlist is insertable by owner or admin"
on public.wishlist
for insert
with check (auth.uid() = user_id or public.is_admin());

create policy "Wishlist is deletable by owner or admin"
on public.wishlist
for delete
using (auth.uid() = user_id or public.is_admin());

-- Cart
create policy "Cart is viewable by owner or admin"
on public.cart
for select
using (auth.uid() = user_id or public.is_admin());

create policy "Cart is insertable by owner or admin"
on public.cart
for insert
with check (auth.uid() = user_id or public.is_admin());

create policy "Cart is updatable by owner or admin"
on public.cart
for update
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

create policy "Cart is deletable by owner or admin"
on public.cart
for delete
using (auth.uid() = user_id or public.is_admin());

-- Audit logs
create policy "Audit logs are viewable by owner or admin"
on public.audit_logs
for select
using (auth.uid() = user_id or public.is_admin());

create policy "Audit logs are insertable by owner or admin"
on public.audit_logs
for insert
with check (auth.uid() = user_id or public.is_admin());
