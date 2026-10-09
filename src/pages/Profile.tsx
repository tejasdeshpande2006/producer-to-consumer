import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, auth } from '../firebase';
import { doc, updateDoc, serverTimestamp, arrayUnion, arrayRemove } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { User, Mail, Shield, Clock, CheckCircle, AlertCircle, Phone, Lock, Eye, EyeOff, Truck, LogOut, MapPin, Plus, Home, Briefcase, Trash2, Star, Edit2, X } from 'lucide-react';
import { SavedAddress } from '../types';

const Profile: React.FC = () => {
  const { profile, user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Address Book State
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);
  const [addressForm, setAddressForm] = useState({
    label: 'Home',
    fullName: '',
    phoneNumber: '',
    alternatePhone: '',
    pincode: '',
    city: '',
    state: '',
    address: '',
    landmark: '',
    isDefault: false
  });
  const [savingAddress, setSavingAddress] = useState(false);

  // Memoize to prevent re-renders
  const savedAddresses = useMemo(() => profile?.savedAddresses || [], [profile?.savedAddresses]);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setEmail(profile.email);
      setPhoneNumber(profile.phoneNumber || '');
    }
  }, [profile]);

  const openAddressModal = (address?: SavedAddress) => {
    if (address) {
      setEditingAddress(address);
      setAddressForm({
        label: address.label,
        fullName: address.fullName,
        phoneNumber: address.phoneNumber,
        alternatePhone: address.alternatePhone || '',
        pincode: address.pincode,
        city: address.city,
        state: address.state,
        address: address.address,
        landmark: address.landmark || '',
        isDefault: address.isDefault || false
      });
    } else {
      setEditingAddress(null);
      setAddressForm({
        label: 'Home',
        fullName: profile?.name || '',
        phoneNumber: profile?.phoneNumber || '',
        alternatePhone: '',
        pincode: '',
        city: '',
        state: '',
        address: '',
        landmark: '',
        isDefault: savedAddresses.length === 0
      });
    }
    setShowAddressModal(true);
  };

  const handleSaveAddress = async () => {
    if (!user || !profile) return;
    if (!addressForm.fullName || !addressForm.phoneNumber || !addressForm.pincode || !addressForm.city || !addressForm.state || !addressForm.address) {
      alert('Please fill all required fields');
      return;
    }

    setSavingAddress(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const newAddress: SavedAddress = {
        id: editingAddress?.id || `addr_${Date.now()}`,
        ...addressForm
      };

      let updatedAddresses: SavedAddress[];
      
      if (editingAddress) {
        // Update existing address
        updatedAddresses = savedAddresses.map(a => 
          a.id === editingAddress.id ? newAddress : a
        );
      } else {
        // Add new address
        updatedAddresses = [...savedAddresses, newAddress];
      }

      // If this is set as default, remove default from others
      if (newAddress.isDefault) {
        updatedAddresses = updatedAddresses.map(a => ({
          ...a,
          isDefault: a.id === newAddress.id
        }));
      }

      await updateDoc(userRef, { savedAddresses: updatedAddresses });
      setShowAddressModal(false);
      setMessage({ type: 'success', text: editingAddress ? 'Address updated!' : 'Address saved!' });
    } catch (error) {
      console.error('Error saving address:', error);
      setMessage({ type: 'error', text: 'Failed to save address' });
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!user || !confirm('Are you sure you want to delete this address?')) return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      const updatedAddresses = savedAddresses.filter(a => a.id !== addressId);
      await updateDoc(userRef, { savedAddresses: updatedAddresses });
      setMessage({ type: 'success', text: 'Address deleted!' });
    } catch (error) {
      console.error('Error deleting address:', error);
      setMessage({ type: 'error', text: 'Failed to delete address' });
    }
  };

  const handleSetDefaultAddress = async (addressId: string) => {
    if (!user) return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      const updatedAddresses = savedAddresses.map(a => ({
        ...a,
        isDefault: a.id === addressId
      }));
      await updateDoc(userRef, { savedAddresses: updatedAddresses });
      setMessage({ type: 'success', text: 'Default address updated!' });
    } catch (error) {
      console.error('Error updating default:', error);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    setIsSubmitting(true);
    setMessage(null);

    try {
      const userRef = doc(db, 'users', user.uid);
      
      if (profile.role === 'consumer') {
        // Direct update for consumers
        await updateDoc(userRef, {
          name,
          email,
          phoneNumber,
        });
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
      } else {
        // Pending update for producers and delivery boys
        await updateDoc(userRef, {
          pendingProfileChanges: {
            name,
            email,
            phoneNumber,
            timestamp: serverTimestamp(),
          }
        });
        setMessage({ type: 'success', text: 'Profile changes submitted for admin approval.' });
      }
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setIsChangingPassword(true);
    setMessage(null);

    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      
      setMessage({ type: 'success', text: 'Password changed successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error changing password:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to change password. Check your current password.' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (!profile) return null;

  const needsApproval = profile.role === 'producer' || profile.role === 'delivery';
  const hasPendingChanges = !!profile.pendingProfileChanges;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-3xl mx-auto space-y-12">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="glossy-card overflow-hidden group"
        >
          <div className="bg-indigo-600 px-12 py-20 text-white relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-12 h-1 bg-white/30 rounded-full" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-60">Account Settings</span>
              </div>
              <h1 className="text-6xl font-black tracking-tighter font-display uppercase mb-4">Your Profile<span className="text-indigo-300">.</span></h1>
              <div className="inline-flex items-center space-x-3 px-4 py-2 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <p className="text-indigo-100 font-black text-xs uppercase tracking-widest">{profile.role} Account</p>
              </div>
            </div>
            <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-white/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000" />
            <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-96 h-96 bg-indigo-400/30 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000" />
          </div>

          <div className="p-12 space-y-12">
            {message && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`p-8 rounded-[2rem] flex items-center gap-6 border-2 shadow-xl ${
                  message.type === 'success' ? 'bg-green-50 text-green-700 border-green-100 shadow-green-100/50' : 'bg-red-50 text-red-700 border-red-100 shadow-red-100/50'
                }`}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                  message.type === 'success' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {message.type === 'success' ? <CheckCircle size={28} /> : <AlertCircle size={28} />}
                </div>
                <div>
                  <h4 className="text-lg font-black uppercase tracking-tight font-display">{message.type === 'success' ? 'Success' : 'Error'}</h4>
                  <p className="text-sm font-bold opacity-80 uppercase tracking-widest">{message.text}</p>
                </div>
              </motion.div>
            )}

            {hasPendingChanges && (
              <div className="p-10 bg-amber-50 border-2 border-amber-100 rounded-[2.5rem] flex gap-8 shadow-2xl shadow-amber-100/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-100 rounded-full -mr-16 -mt-16 blur-3xl opacity-50" />
                <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0 relative z-10">
                  <Clock className="text-amber-600" size={32} />
                </div>
                <div className="relative z-10">
                  <h3 className="text-amber-900 font-black text-2xl font-display tracking-tighter mb-2 uppercase">Verification Pending</h3>
                  <p className="text-amber-800/70 text-base font-bold leading-relaxed">
                    You have submitted changes to your profile. An admin will review them shortly.
                  </p>
                  <div className="mt-6 p-6 bg-white/60 backdrop-blur-md rounded-2xl border border-amber-200/50 shadow-sm">
                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-[0.3em] mb-2">Proposed Changes</p>
                    <p className="text-amber-900 font-black text-lg tracking-tight font-display">
                      {profile.pendingProfileChanges?.name} <span className="mx-2 text-amber-300">/</span> {profile.pendingProfileChanges?.email} <span className="mx-2 text-amber-300">/</span> {profile.pendingProfileChanges?.phoneNumber}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] ml-2">
                  Full Name
                </label>
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-focus-within:shadow-indigo-100 transition-all">
                    <User className="text-gray-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-20 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-indigo-600 outline-none transition-all font-bold text-gray-900 placeholder:text-gray-300"
                    placeholder="Your full name"
                    required
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] ml-2">
                  Phone Number
                </label>
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-focus-within:shadow-indigo-100 transition-all">
                    <Phone className="text-gray-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                  </div>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full pl-20 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-indigo-600 outline-none transition-all font-bold text-gray-900 placeholder:text-gray-300"
                    placeholder="Phone number"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] ml-2">
                Email Address
              </label>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-focus-within:shadow-indigo-100 transition-all">
                  <Mail className="text-gray-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-20 pr-6 py-5 bg-gray-50/50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-indigo-600 outline-none transition-all font-bold text-gray-900 placeholder:text-gray-300"
                  placeholder="Your email address"
                  required
                />
              </div>
            </div>

            {profile.role === 'consumer' && (
              <div className="p-10 bg-indigo-50/50 border-2 border-indigo-100 rounded-[2.5rem] space-y-8">
                <div>
                  <h3 className="text-2xl font-black text-indigo-900 font-display tracking-tighter uppercase">Join the Ecosystem</h3>
                  <p className="text-indigo-800/60 text-sm font-bold uppercase tracking-widest mt-1">Upgrade your account to start selling or delivering</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <motion.button
                    whileHover={{ scale: 1.05, y: -4 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={async () => {
                      if (!user) return;
                      setIsSubmitting(true);
                      try {
                        await updateDoc(doc(db, 'users', user.uid), {
                          role: 'producer',
                          isVerified: false
                        });
                        setMessage({ type: 'success', text: 'Application submitted! Awaiting admin verification.' });
                      } catch (error) {
                        setMessage({ type: 'error', text: 'Failed to submit application.' });
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    className="p-8 bg-white rounded-3xl border border-indigo-100 shadow-xl shadow-indigo-100/20 text-center group hover:border-indigo-600 transition-all"
                  >
                    <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                      <Shield className="text-indigo-600" size={32} />
                    </div>
                    <h4 className="text-lg font-black text-indigo-900 uppercase tracking-tight font-display">Become Producer</h4>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-2">Sell your products directly</p>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05, y: -4 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={async () => {
                      if (!user) return;
                      setIsSubmitting(true);
                      try {
                        await updateDoc(doc(db, 'users', user.uid), {
                          role: 'delivery',
                          isVerified: true // Delivery partners are auto-verified for now
                        });
                        setMessage({ type: 'success', text: 'Welcome to the delivery fleet!' });
                      } catch (error) {
                        setMessage({ type: 'error', text: 'Failed to join fleet.' });
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    className="p-8 bg-white rounded-3xl border border-indigo-100 shadow-xl shadow-indigo-100/20 text-center group hover:border-indigo-600 transition-all"
                  >
                    <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                      <Truck className="text-indigo-600" size={32} />
                    </div>
                    <h4 className="text-lg font-black text-indigo-900 uppercase tracking-tight font-display">Join Fleet</h4>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-2">Deliver orders and earn</p>
                  </motion.button>
                </div>
              </div>
            )}

            <div className="pt-6">
              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-6 glossy-button rounded-[1.5rem] font-black text-xl flex items-center justify-center gap-3 disabled:opacity-50 uppercase tracking-widest ${
                  isSubmitting ? 'cursor-not-allowed' : ''
                }`}
              >
                {isSubmitting ? (
                  <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  needsApproval ? 'Submit for Approval' : 'Update Profile'
                )}
              </motion.button>
              {needsApproval && (
                <p className="text-center text-[10px] text-gray-400 mt-6 font-black uppercase tracking-[0.2em]">
                  * Profile changes for {profile.role}s require administrator verification.
                </p>
              )}
            </div>
          </form>
        </div>
      </motion.div>

      {/* Password Change Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div className="p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Lock className="text-amber-600" size={20} />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Security</h2>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Current Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type={showPasswords ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                  placeholder="••••••••"
                  required
                />
                <button 
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type={showPasswords ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type={showPasswords ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isChangingPassword}
                className={`w-full py-4 rounded-xl font-bold text-white transition-all shadow-lg shadow-amber-100 flex items-center justify-center gap-2 ${
                  isChangingPassword ? 'bg-amber-400 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-700 active:scale-[0.98]'
                }`}
              >
                {isChangingPassword ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>
      </motion.div>

      {/* Address Book Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <MapPin className="text-emerald-600" size={20} />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Saved Addresses</h2>
            </div>
            <button
              onClick={() => openAddressModal()}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors"
            >
              <Plus size={18} />
              <span>Add New</span>
            </button>
          </div>

          {savedAddresses.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl">
              <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No saved addresses yet</p>
              <p className="text-gray-400 text-sm mt-1">Add an address for faster checkout</p>
            </div>
          ) : (
            <div className="space-y-4">
              {savedAddresses.map(addr => (
                <div 
                  key={addr.id}
                  className={`p-5 rounded-xl border-2 transition-all ${
                    addr.isDefault ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                        addr.label === 'Home' ? 'bg-blue-100' : addr.label === 'Work' ? 'bg-amber-100' : 'bg-gray-100'
                      }`}>
                        {addr.label === 'Home' ? <Home className="w-6 h-6 text-blue-600" /> : 
                         addr.label === 'Work' ? <Briefcase className="w-6 h-6 text-amber-600" /> : 
                         <MapPin className="w-6 h-6 text-gray-600" />}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-bold text-gray-900">{addr.label}</span>
                          {addr.isDefault && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                              <Star size={10} className="fill-emerald-600" />
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-700">{addr.fullName}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          {addr.address}, {addr.landmark ? `${addr.landmark}, ` : ''}{addr.city}, {addr.state} - {addr.pincode}
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                          📞 {addr.phoneNumber}{addr.alternatePhone ? `, ${addr.alternatePhone}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {!addr.isDefault && (
                        <button
                          onClick={() => handleSetDefaultAddress(addr.id)}
                          className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Set as default"
                        >
                          <Star size={18} />
                        </button>
                      )}
                      <button
                        onClick={() => openAddressModal(addr)}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteAddress(addr.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Address Modal */}
      <AnimatePresence>
        {showAddressModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddressModal(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">
                  {editingAddress ? 'Edit Address' : 'Add New Address'}
                </h3>
                <button onClick={() => setShowAddressModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Label Selection */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                    Address Type
                  </label>
                  <div className="flex gap-3">
                    {['Home', 'Work', 'Other'].map(label => (
                      <button
                        key={label}
                        onClick={() => setAddressForm(prev => ({ ...prev, label }))}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-medium transition-all ${
                          addressForm.label === label 
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {label === 'Home' ? <Home size={16} /> : label === 'Work' ? <Briefcase size={16} /> : <MapPin size={16} />}
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Full Name *</label>
                    <input
                      type="text"
                      value={addressForm.fullName}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, fullName: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="Full name"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Phone *</label>
                    <input
                      type="tel"
                      value={addressForm.phoneNumber}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, phoneNumber: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="10-digit mobile"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Alt Phone</label>
                    <input
                      type="tel"
                      value={addressForm.alternatePhone}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, alternatePhone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Pincode *</label>
                    <input
                      type="text"
                      value={addressForm.pincode}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="6-digit pincode"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">City *</label>
                    <input
                      type="text"
                      value={addressForm.city}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, city: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="City"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">State *</label>
                    <select
                      value={addressForm.state}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, state: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="">Select State</option>
                      <option value="Andhra Pradesh">Andhra Pradesh</option>
                      <option value="Bihar">Bihar</option>
                      <option value="Delhi">Delhi</option>
                      <option value="Gujarat">Gujarat</option>
                      <option value="Karnataka">Karnataka</option>
                      <option value="Kerala">Kerala</option>
                      <option value="Madhya Pradesh">Madhya Pradesh</option>
                      <option value="Maharashtra">Maharashtra</option>
                      <option value="Punjab">Punjab</option>
                      <option value="Rajasthan">Rajasthan</option>
                      <option value="Tamil Nadu">Tamil Nadu</option>
                      <option value="Telangana">Telangana</option>
                      <option value="Uttar Pradesh">Uttar Pradesh</option>
                      <option value="West Bengal">West Bengal</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Address *</label>
                    <textarea
                      value={addressForm.address}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                      rows={2}
                      placeholder="House No., Building, Street, Area"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Landmark</label>
                    <input
                      type="text"
                      value={addressForm.landmark}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, landmark: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="Nearby landmark (optional)"
                    />
                  </div>
                </div>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addressForm.isDefault}
                    onChange={(e) => setAddressForm(prev => ({ ...prev, isDefault: e.target.checked }))}
                    className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Set as default address</span>
                </label>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowAddressModal(false)}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAddress}
                    disabled={savingAddress}
                    className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {savingAddress ? 'Saving...' : 'Save Address'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logout Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="pt-12"
      >
        <button
          onClick={async () => {
            const { signOut } = await import('firebase/auth');
            const { auth } = await import('../firebase');
            await signOut(auth);
            window.location.href = '/';
          }}
          className="w-full py-6 bg-red-50 text-red-600 rounded-[1.5rem] font-black text-xl uppercase tracking-widest border-2 border-red-100 hover:bg-red-100 transition-all flex items-center justify-center gap-4 shadow-xl shadow-red-100/50"
        >
          <LogOut size={28} />
          <span>Logout from Account</span>
        </button>
      </motion.div>
      </div>
    </div>
  );
};

export default Profile;
