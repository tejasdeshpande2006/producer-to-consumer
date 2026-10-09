import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
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
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (firebaseUser) {
        const profileRef = doc(db, 'users', firebaseUser.uid);
        
        // Safety timeout for loading state
        const timeoutId = setTimeout(() => {
          setLoading(false);
        }, 5000);

        unsubProfile = onSnapshot(profileRef, (docSnap) => {
          clearTimeout(timeoutId);
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            setProfile(data);
            
            // Auto-upgrade hardcoded admin email if not already admin
            if (firebaseUser.email === 'vpk525252@gmail.com' && data.role !== 'admin') {
              updateDoc(profileRef, { role: 'admin', isVerified: true })
                .catch(err => console.error("Failed to auto-upgrade admin:", err));
            }
          } else {
            const isAdminEmail = firebaseUser.email === 'vpk525252@gmail.com';
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'User',
              email: firebaseUser.email || '',
              role: isAdminEmail ? 'admin' : 'consumer',
              walletBalance: 0,
              isVerified: isAdminEmail,
            };
            setDoc(profileRef, newProfile).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${firebaseUser.uid}`));
            setProfile(newProfile);
          }
          setLoading(false);
        }, (error) => {
          clearTimeout(timeoutId);
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const value = {
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'admin' || user?.email === 'vpk525252@gmail.com',
    isProducer: profile?.role === 'producer',
    isConsumer: profile?.role === 'consumer',
    isDelivery: profile?.role === 'delivery',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
