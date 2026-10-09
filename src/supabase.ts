import { createClient } from '@supabase/supabase-js';
import type { Product, UserProfile } from './types';

const DEMO_USER_ID = 'demo-user-1';
const DEMO_SESSION_KEY = 'p2c-demo-session';
const DEMO_PROFILE_KEY = 'p2c-demo-profile';

export const DEMO_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    sellerId: 'seller-1',
    title: 'Organic Mango Basket',
    description: 'Hand-picked premium Alphonso mangoes from a family farm in Ratnagiri.',
    price: 799,
    stock: 42,
    category: 'Groceries',
    images: ['https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=800&q=80']
  },
  {
    id: 'prod-2',
    sellerId: 'seller-2',
    title: 'Minimal Leather Backpack',
    description: 'Crafted for everyday commute and a polished lifestyle.',
    price: 2499,
    stock: 18,
    category: 'Fashion',
    images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80']
  },
  {
    id: 'prod-3',
    sellerId: 'seller-3',
    title: 'Smart Fitness Band',
    description: 'Track sleep, steps, and workouts with a lightweight wearable design.',
    price: 1999,
    stock: 32,
    category: 'Electronics',
    images: ['https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?auto=format&fit=crop&w=800&q=80']
  },
  {
    id: 'prod-4',
    sellerId: 'seller-4',
    title: 'Botanical Face Care Kit',
    description: 'A nourishing skincare set made with natural ingredients and no harsh additives.',
    price: 1299,
    stock: 27,
    category: 'Beauty',
    images: ['https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80']
  },
  {
    id: 'prod-5',
    sellerId: 'seller-5',
    title: 'Scented Home Diffuser',
    description: 'A cozy premium aroma diffuser to create a calming home environment.',
    price: 1599,
    stock: 20,
    category: 'Home',
    images: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80']
  },
  {
    id: 'prod-6',
    sellerId: 'seller-6',
    title: 'Gym Starter Kit',
    description: 'Essential strength accessories for home workouts and daily training.',
    price: 2199,
    stock: 14,
    category: 'Sports',
    images: ['https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=800&q=80']
  }
];

export const isSupabaseConfigured = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return false;
  }

  try {
    const parsedUrl = new URL(supabaseUrl);
    return parsedUrl.protocol === 'https:' && parsedUrl.hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
};

export const appMode = import.meta.env.VITE_APP_MODE || (isSupabaseConfigured() ? 'live' : 'demo');

export const supabase = isSupabaseConfigured()
  ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
  : undefined;

export const getDemoProfile = (email = 'local.user@local.test', displayName = 'Local Shopper', role: UserProfile['role'] = 'consumer'): UserProfile => ({
  uid: DEMO_USER_ID,
  name: displayName,
  email,
  phoneNumber: '+91 90000 00000',
  smsNotifications: false,
  role,
  walletBalance: 2450,
  isVerified: true,
  isOnline: true,
  strikes: 0,
  isSuspended: false,
  location: {
    lat: 19.076,
    lng: 72.8777,
    lastUpdated: new Date().toISOString(),
  },
});

export const demoSession = {
  id: DEMO_USER_ID,
  email: 'local.user@local.test',
  user_metadata: {
    displayName: 'Local Shopper',
  },
};

export const saveDemoUser = (user: { id: string; email?: string; user_metadata?: { displayName?: string } }) => {
  localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user));
};

export const getStoredDemoUser = () => {
  const raw = localStorage.getItem(DEMO_SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as { id: string; email?: string; user_metadata?: { displayName?: string } };
  } catch {
    return null;
  }
};

export const saveDemoProfile = (profile: UserProfile) => {
  localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify(profile));
};

export const getStoredDemoProfile = (): UserProfile | null => {
  const raw = localStorage.getItem(DEMO_PROFILE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
};

export const clearDemoSession = () => {
  localStorage.removeItem(DEMO_SESSION_KEY);
  localStorage.removeItem(DEMO_PROFILE_KEY);
};

export async function testConnection() {
  if (!supabase) return false;

  try {
    const { data, error } = await supabase.from('health_check').select('*').limit(1);
    if (error) {
      console.error('Supabase connection test error:', error);
      return false;
    }
    console.log('Supabase connection successful');
    return true;
  } catch (error) {
    console.error('Supabase connection failed:', error);
    return false;
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
}

export interface AuditLog {
  id: string;
  collection: string;
  documentId: string;
  operationType: OperationType;
  changes: Record<string, any>;
  userId: string;
  timestamp: Date;
}

export async function logOperation(
  collection: string,
  documentId: string,
  operationType: OperationType,
  changes: Record<string, any>,
  userId: string
): Promise<void> {
  if (!supabase) return;

  try {
    await supabase.from('audit_logs').insert([
      {
        collection,
        document_id: documentId,
        operation_type: operationType,
        changes,
        user_id: userId,
        timestamp: new Date().toISOString(),
      },
    ]);
  } catch (error) {
    console.error('Failed to log operation:', error);
  }
}
