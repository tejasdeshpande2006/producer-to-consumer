import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../supabase';

export const browserLocalPersistence = 'browserLocalPersistence';

export const setPersistence = async () => undefined;

export const getAuth = () => ({
  get currentUser(): User | null {
    return null;
  },
});

export const signOut = async () => {
  await supabase?.auth.signOut();
};

export const signInWithEmailAndPassword = async (_auth: any, email: string, password: string) => {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase.auth.signInWithPassword({ email, password });
};

export const createUserWithEmailAndPassword = async (_auth: any, email: string, password: string) => {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase.auth.signUp({ email, password });
};

export const signInWithPopup = async (_auth: any, _provider: any) => {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase.auth.signInWithOAuth({ provider: 'google' });
};

export class GoogleAuthProvider {}

export const updatePassword = async (_user: User, password: string) => {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase.auth.updateUser({ password });
};

export const EmailAuthProvider = {
  credential: (email: string, password: string) => ({ email, password }),
};

export const reauthenticateWithCredential = async (_user: User, credential: { email: string; password: string }) => {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase.auth.signInWithPassword({ email: credential.email, password: credential.password });
};

export const onAuthStateChanged = (_auth: any, callback: (user: User | null) => void) => {
  supabase?.auth.getSession().then(({ data }) => callback((data.session?.user as User) || null));
  const { data } = supabase?.auth.onAuthStateChange((_, session: Session | null) => callback((session?.user as User) || null)) || { data: null };
  return () => data?.subscription.unsubscribe();
};
