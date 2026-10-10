import { createClient } from '@supabase/supabase-js';
import type { Product, UserProfile } from './types';

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

export const appMode = import.meta.env.VITE_APP_MODE || (isSupabaseConfigured() ? 'live' : 'offline');

export const supabase = isSupabaseConfigured()
  ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
  : undefined;

export interface SupabaseProfileRow {
  id: string;
  name: string;
  email: string;
  phone_number?: string | null;
  sms_notifications?: boolean | null;
  role: UserProfile['role'];
  wallet_balance?: number | null;
  is_verified?: boolean | null;
  is_online?: boolean | null;
  strikes?: number | null;
  is_suspended?: boolean | null;
  saved_addresses?: UserProfile['savedAddresses'] | null;
  pending_profile_changes?: UserProfile['pendingProfileChanges'] | null;
  location?: UserProfile['location'] | null;
}

export const mapSupabaseProfile = (row: SupabaseProfileRow): UserProfile => ({
  uid: row.id,
  name: row.name,
  email: row.email,
  phoneNumber: row.phone_number || '',
  smsNotifications: row.sms_notifications ?? false,
  role: row.role,
  walletBalance: Number(row.wallet_balance ?? 0),
  isVerified: row.is_verified ?? false,
  savedAddresses: row.saved_addresses || [],
  pendingProfileChanges: row.pending_profile_changes || null,
  isOnline: row.is_online ?? false,
  strikes: row.strikes ?? 0,
  isSuspended: row.is_suspended ?? false,
  location: row.location || undefined,
});

export const buildSupabaseProfilePayload = (profile: Partial<UserProfile> & { uid: string; email: string }) => ({
  id: profile.uid,
  name: profile.name || profile.email.split('@')[0] || 'User',
  email: profile.email,
  phone_number: profile.phoneNumber || '',
  sms_notifications: profile.smsNotifications ?? false,
  role: profile.role || 'consumer',
  wallet_balance: profile.walletBalance ?? 0,
  is_verified: profile.isVerified ?? false,
  is_online: profile.isOnline ?? false,
  strikes: profile.strikes ?? 0,
  is_suspended: profile.isSuspended ?? false,
  saved_addresses: profile.savedAddresses ?? [],
  pending_profile_changes: profile.pendingProfileChanges ?? null,
  location: profile.location ?? null,
});


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
