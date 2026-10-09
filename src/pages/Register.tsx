import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Mail, Lock, User, ArrowRight } from 'lucide-react';

import { motion } from 'motion/react';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('consumer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleRegister = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    const performGoogleRegister = async (retryCount = 0): Promise<void> => {
      try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        
        const profileRef = doc(db, 'users', result.user.uid);
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
          setError('An account already exists with this Google account. Please login instead.');
          setLoading(false);
          return;
        }

        await setDoc(profileRef, {
          uid: result.user.uid,
          name: result.user.displayName || 'User',
          email: result.user.email || '',
          phoneNumber: '',
          role: selectedRole,
          walletBalance: 0,
          isVerified: selectedRole === 'admin' // Auto-verify admin for demo
        });
      } catch (err: any) {
        if (err.code === 'auth/popup-closed-by-user') {
          setLoading(false);
          return;
        }
        
        if (err.code === 'auth/network-request-failed' && retryCount < 1) {
          // Wait a bit and retry once
          await new Promise(resolve => setTimeout(resolve, 1000));
          return performGoogleRegister(retryCount + 1);
        }

        if (err.code === 'auth/network-request-failed') {
          setError('Network error: Please check your internet connection or disable any ad-blockers/VPNs that might be blocking Firebase.');
          setLoading(false);
          return;
        }
        console.error('Registration error:', err);
        setError(err.message || 'An unexpected error occurred during registration.');
        setLoading(false);
      }
    };

    await performGoogleRegister();
    setLoading(false);
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    const performEmailRegister = async (retryCount = 0): Promise<void> => {
      try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName: name });
        
        const isAdminEmail = email.toLowerCase() === 'vpk525252@gmail.com';
        const role = isAdminEmail ? 'admin' : selectedRole;
        
        const profileRef = doc(db, 'users', result.user.uid);
        await setDoc(profileRef, {
          uid: result.user.uid,
          name: name,
          email: email,
          phoneNumber: phoneNumber,
          role: role,
          walletBalance: 0,
          isVerified: role === 'admin'
        });
        
        navigate('/');
      } catch (err: any) {
        if (err.code === 'auth/network-request-failed' && retryCount < 1) {
          // Wait a bit and retry once
          await new Promise(resolve => setTimeout(resolve, 1000));
          return performEmailRegister(retryCount + 1);
        }

        if (err.code === 'auth/network-request-failed') {
          setError('Network error: Please check your internet connection or disable any ad-blockers/VPNs that might be blocking Firebase.');
          setLoading(false);
          return;
        }
        console.error('Registration error:', err);
        if (err.code === 'auth/email-already-in-use') {
          setError('This email is already registered. Please login instead.');
        } else {
          setError(err.message || 'Failed to create account.');
        }
        setLoading(false);
      }
    };

    await performEmailRegister();
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center px-4 py-20 relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-100 rounded-full blur-[120px] opacity-50" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-100 rounded-full blur-[120px] opacity-50" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="glossy-card p-12 max-w-md w-full text-center relative z-10"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-500 animate-gradient-x" />
        
        <motion.div 
          whileHover={{ rotate: -15, scale: 1.1 }}
          className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-indigo-200 group"
        >
          <UserPlus className="text-white w-12 h-12 group-hover:scale-110 transition-transform" />
        </motion.div>
        
        <h1 className="text-5xl font-black text-gray-900 mb-3 tracking-tighter font-display uppercase leading-none">Join Us<span className="text-indigo-600">.</span></h1>
        <p className="text-gray-400 mb-12 font-bold text-sm uppercase tracking-[0.3em]">Create your account today</p>
        
        {error && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-10 p-5 bg-red-50 text-red-600 text-[10px] font-black rounded-2xl border border-red-100 uppercase tracking-[0.2em] flex items-center justify-center space-x-2"
          >
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span>{error}</span>
          </motion.div>
        )}

        <div className="space-y-6 mb-12">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Select Your Role</p>
          <div className="grid grid-cols-2 gap-6">
            {['consumer', 'producer'].map(r => (
              <motion.button
                key={r}
                whileHover={{ scale: 1.05, y: -4 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedRole(r)}
                className={`px-8 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border-2 ${
                  selectedRole === r 
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xl shadow-indigo-100' 
                    : 'bg-gray-50/50 text-gray-500 border-transparent hover:border-indigo-200 hover:bg-white'
                }`}
              >
                {r}
              </motion.button>
            ))}
          </div>
        </div>

        <form onSubmit={handleEmailRegister} className="space-y-6 mb-10">
          <div className="relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-focus-within:shadow-indigo-100 transition-all">
              <User className="w-5 h-5 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
            </div>
            <input 
              required
              type="text" 
              placeholder="Full Name"
              className="w-full pl-20 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-indigo-600 outline-none transition-all font-bold text-gray-900 placeholder:text-gray-300"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-focus-within:shadow-indigo-100 transition-all">
              <Mail className="w-5 h-5 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
            </div>
            <input 
              required
              type="email" 
              placeholder="Email Address"
              className="w-full pl-20 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-indigo-600 outline-none transition-all font-bold text-gray-900 placeholder:text-gray-300"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-focus-within:shadow-indigo-100 transition-all">
              <span className="font-black text-xs text-gray-400 group-focus-within:text-indigo-600 transition-colors">#</span>
            </div>
            <input 
              required
              type="tel" 
              placeholder="Phone Number"
              className="w-full pl-20 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-indigo-600 outline-none transition-all font-bold text-gray-900 placeholder:text-gray-300"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
          </div>
          <div className="relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-focus-within:shadow-indigo-100 transition-all">
              <Lock className="w-5 h-5 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
            </div>
            <input 
              required
              type="password" 
              placeholder="Password"
              className="w-full pl-20 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-indigo-600 outline-none transition-all font-bold text-gray-900 placeholder:text-gray-300"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            disabled={loading}
            type="submit"
            className="glossy-button w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-sm flex items-center justify-center space-x-3"
          >
            {loading ? (
              <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Create Account</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </motion.button>
        </form>

        <div className="relative mb-10">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100"></div>
          </div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-[0.3em] font-black">
            <span className="bg-white px-6 text-gray-400">Or register with</span>
          </div>
        </div>
        
        <motion.button
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          disabled={loading}
          onClick={handleGoogleRegister}
          className="w-full flex items-center justify-center space-x-4 px-8 py-5 bg-white border-2 border-gray-100 rounded-2xl hover:border-indigo-200 hover:bg-indigo-50/30 transition-all font-black text-gray-700 disabled:opacity-50 mb-10 shadow-sm group"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-6 h-6 group-hover:scale-110 transition-transform" />
          <span className="uppercase tracking-[0.2em] text-xs">Google Account</span>
        </motion.button>

        <p className="text-xs text-gray-400 font-bold uppercase tracking-[0.2em]">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-600 font-black hover:text-indigo-700 transition-colors ml-2 underline underline-offset-4">
            Login Now
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default Register;
