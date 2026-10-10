import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json());

const getAdminProfileId = async () => {
  if (!supabase) return null;

  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle();

  return data?.id || null;
};

app.get('/api/health', async (_req, res) => {
  if (!supabase) {
    res.status(500).json({ status: 'error', message: 'Supabase is not configured' });
    return;
  }

  const { data, error } = await supabase.from('health_check').select('*').limit(1);
  res.json({
    status: error ? 'error' : 'ok',
    supabase: true,
    error: error?.message || null,
    health: data || [],
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/wallet/addMoney', async (req, res) => {
  if (!supabase) {
    res.status(500).json({ error: 'Supabase is not configured' });
    return;
  }

  const { userId, amount } = req.body as { userId?: string; amount?: number };
  if (!userId || !amount || amount <= 0) {
    res.status(400).json({ error: 'Invalid parameters' });
    return;
  }

  const { data: userProfile, error: loadError } = await supabase
    .from('profiles')
    .select('wallet_balance')
    .eq('id', userId)
    .maybeSingle();

  if (loadError || !userProfile) {
    res.status(404).json({ error: 'User profile not found' });
    return;
  }

  const newBalance = Number(userProfile.wallet_balance || 0) + Number(amount);
  const { error: updateError } = await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('id', userId);
  if (updateError) {
    res.status(500).json({ error: updateError.message });
    return;
  }

  const { error: txError } = await supabase.from('transactions').insert({
    user_id: userId,
    amount: Number(amount),
    transaction_type: 'credit',
    status: 'completed',
    description: 'Money Added',
    timestamp: new Date().toISOString(),
  });

  if (txError) {
    res.status(500).json({ error: txError.message });
    return;
  }

  res.json({ success: true, balance: newBalance });
});

app.post('/api/wallet/purchase', async (req, res) => {
  if (!supabase) {
    res.status(500).json({ error: 'Supabase is not configured' });
    return;
  }

  const { userId, orderDetails, cartItemIds } = req.body as {
    userId?: string;
    orderDetails?: {
      totalAmount?: number;
      shippingAddress?: string;
      deliveryDetails?: Record<string, any>;
      sellerId?: string;
      items?: Array<{ productId: string; title: string; price: number; quantity: number }>;
    };
    cartItemIds?: string[];
  };

  const totalAmount = Number(orderDetails?.totalAmount || 0);
  if (!userId || !orderDetails || !totalAmount || !Array.isArray(orderDetails.items) || orderDetails.items.length === 0) {
    res.status(400).json({ error: 'Invalid parameters' });
    return;
  }

  const { data: userProfile, error: loadError } = await supabase
    .from('profiles')
    .select('id,name,wallet_balance')
    .eq('id', userId)
    .maybeSingle();

  if (loadError || !userProfile) {
    res.status(404).json({ error: 'User profile not found' });
    return;
  }

  if (Number(userProfile.wallet_balance || 0) < totalAmount) {
    res.status(400).json({ error: 'Insufficient funds' });
    return;
  }

  const baseAmount = totalAmount / 1.05;
  const platformFee = totalAmount - baseAmount;
  const adminId = await getAdminProfileId();
  const orderId = crypto.randomUUID();

  const { error: orderError } = await supabase.from('orders').insert({
    id: orderId,
    buyer_id: userId,
    buyer_name: userProfile.name || 'Unknown Buyer',
    shipping_address: orderDetails.shippingAddress || '',
    delivery_details: orderDetails.deliveryDetails || null,
    seller_id: orderDetails.sellerId || null,
    status: 'pending',
    total_amount: totalAmount,
    items: orderDetails.items,
    timestamp: new Date().toISOString(),
    base_amount: baseAmount,
    platform_fee: platformFee,
  });

  if (orderError) {
    res.status(500).json({ error: orderError.message });
    return;
  }

  const { error: debitError } = await supabase.from('transactions').insert({
    user_id: userId,
    order_id: orderId,
    amount: totalAmount,
    transaction_type: 'debit',
    status: 'completed',
    description: `Purchase of ${orderDetails.items.length} item(s)`,
    timestamp: new Date().toISOString(),
  });

  if (debitError) {
    res.status(500).json({ error: debitError.message });
    return;
  }

  const newBalance = Number(userProfile.wallet_balance || 0) - totalAmount;
  const { error: balanceError } = await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('id', userId);
  if (balanceError) {
    res.status(500).json({ error: balanceError.message });
    return;
  }

  if (adminId) {
    const { data: adminProfile } = await supabase.from('profiles').select('wallet_balance').eq('id', adminId).maybeSingle();
    const adminBalance = Number(adminProfile?.wallet_balance || 0) + platformFee;
    await supabase.from('profiles').update({ wallet_balance: adminBalance }).eq('id', adminId);
    await supabase.from('transactions').insert({
      user_id: adminId,
      order_id: orderId,
      amount: platformFee,
      transaction_type: 'credit',
      status: 'completed',
      description: `Platform fee from order ${orderId.slice(0, 8)}`,
      timestamp: new Date().toISOString(),
    });
  }

  if (Array.isArray(cartItemIds) && cartItemIds.length > 0) {
    await supabase.from('cart').delete().eq('user_id', userId).in('id', cartItemIds);
  }

  res.json({ success: true, orderId });
});

const start = async () => {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true' ? { overlay: false } : false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exitCode = 1;
});