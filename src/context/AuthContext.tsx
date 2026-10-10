import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, buildSupabaseProfilePayload, mapSupabaseProfile, type SupabaseProfileRow } from '../supabase';
import { UserProfile } from '../types';

type SupabaseAuthUser = User & { uid: string };

interface AuthContextType {
  user: SupabaseAuthUser | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isProducer: boolean;
  isConsumer: boolean;
  isDelivery: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isProducer: false,
  isConsumer: false,
  isDelivery: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SupabaseAuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const hydrateProfile = async (session: Session | null) => {
      if (!mounted) return;

      const authUser = session?.user ? ({ ...session.user, uid: session.user.id } as SupabaseAuthUser) : null;
      setUser(authUser);

      if (!authUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const { data: existingProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        console.error('Failed to load Supabase profile:', error);
      }

      if (existingProfile) {
        const mappedProfile = mapSupabaseProfile(existingProfile as SupabaseProfileRow);
        setProfile(mappedProfile);
      } else {
        const email = authUser.email || '';
        const payload = buildSupabaseProfilePayload({
          uid: authUser.id,
          email,
          name: authUser.user_metadata?.displayName || authUser.user_metadata?.full_name || 'User',
          role: (authUser.user_metadata?.role as UserProfile['role']) || 'consumer',
          isVerified: false,
          walletBalance: 0,
        });

        const { data: insertedProfile, error: insertError } = await supabase
          .from('profiles')
          .upsert(payload)
          .select('*')
          .single();

        if (!mounted) return;

        if (insertError) {
          console.error('Failed to create Supabase profile:', insertError);
          setProfile({
            uid: authUser.id,
            name: authUser.user_metadata?.displayName || authUser.user_metadata?.full_name || 'User',
            email,
            role: 'consumer',
            walletBalance: 0,
            isVerified: false,
          });
        } else if (insertedProfile) {
          setProfile(mapSupabaseProfile(insertedProfile as SupabaseProfileRow));
        }
      }

      setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => {
      hydrateProfile(data.session || null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      void hydrateProfile(session);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const value = {
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    isProducer: profile?.role === 'producer',
    isConsumer: profile?.role === 'consumer',
    isDelivery: profile?.role === 'delivery',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
