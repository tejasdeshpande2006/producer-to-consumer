import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from '../types';
import { Shield, CheckCircle, XCircle, UserCheck, Truck, Users, ShieldCheck, Search, Filter } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

const AdminDashboard: React.FC = () => {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    if (!isAdmin) return;

    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => doc.data() as UserProfile));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    return () => unsubscribe();
  }, [isAdmin]);

  const verifySeller = async (uid: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        isVerified: true
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const revokeVerification = async (uid: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        isVerified: false
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const liftSuspension = async (uid: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        isSuspended: false,
        strikes: 0
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const changeRole = async (uid: string, newRole: string) => {
    if (newRole === 'admin' && users.some(u => u.role === 'admin' && u.uid !== uid)) {
      alert('Only one admin is allowed in the system.');
      return;
    }
    try {
      const updateData: any = { role: newRole };
      if (newRole === 'delivery') {
        updateData.isVerified = true;
      } else if (newRole === 'producer') {
        updateData.isVerified = false; // Reset verification for new producers
      }
      
      await updateDoc(doc(db, 'users', uid), updateData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const approveProfileChange = async (uid: string) => {
    const user = users.find(u => u.uid === uid);
    if (!user || !user.pendingProfileChanges) return;

    try {
      await updateDoc(doc(db, 'users', uid), {
        name: user.pendingProfileChanges.name,
        email: user.pendingProfileChanges.email,
        phoneNumber: user.pendingProfileChanges.phoneNumber || user.phoneNumber || '',
        pendingProfileChanges: null
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const rejectProfileChange = async (uid: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        pendingProfileChanges: null
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const producers = users.filter(u => u.role === 'producer');
  const deliveryBoys = users.filter(u => u.role === 'delivery');
  const unverifiedSellers = producers.filter(p => !p.isVerified);
  const suspendedSellers = producers.filter(p => p.isSuspended);
  const profileChangeRequests = users.filter(u => !!u.pendingProfileChanges);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen space-y-6">
      <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-xs font-black text-gray-400 uppercase tracking-[0.4em] animate-pulse">Syncing Admin Data...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-12"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center space-x-8">
            <motion.div 
              whileHover={{ rotate: 12, scale: 1.1 }}
              className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-indigo-200 group transition-all duration-500"
            >
              <Shield className="text-white w-12 h-12 group-hover:scale-110 transition-transform" />
            </motion.div>
            <div>
              <h1 className="text-6xl font-black text-gray-900 tracking-tighter font-display uppercase leading-none">Admin Console<span className="text-indigo-600">.</span></h1>
              <p className="text-gray-400 font-bold uppercase tracking-[0.3em] text-xs mt-3">System overview and user management</p>
            </div>
          </div>
          <div className="flex flex-col items-end space-y-4">
            <div className="glass-surface px-8 py-4 rounded-3xl flex items-center space-x-4 border border-white/50 shadow-xl">
              <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Security Status</p>
                <span className="text-sm font-black uppercase tracking-widest text-indigo-600">Secure Access</span>
              </div>
            </div>
            
            {/* Role Switcher for Testing */}
            <div className="flex items-center space-x-2 bg-gray-100 p-2 rounded-2xl border border-gray-200">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Test Role:</span>
              {['admin', 'producer', 'delivery', 'consumer'].map((role) => (
                <button
                  key={role}
                  onClick={() => {
                    const adminUser = users.find(u => u.email === 'vpk525252@gmail.com');
                    if (adminUser) changeRole(adminUser.uid, role);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    users.find(u => u.email === 'vpk525252@gmail.com')?.role === role
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { label: 'Total Users', value: users.length, icon: Users, color: 'blue' },
            { label: 'Pending Sellers', value: unverifiedSellers.length, icon: UserCheck, color: 'amber' },
            { label: 'Delivery Fleet', value: deliveryBoys.length, icon: Truck, color: 'purple' },
            { label: 'Suspended', value: suspendedSellers.length, icon: XCircle, color: 'red' }
          ].map((stat, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -8, scale: 1.02 }}
              className="glossy-card p-10 group relative overflow-hidden"
            >
              <div className={`absolute top-0 right-0 w-32 h-32 bg-${stat.color}-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-${stat.color}-500/10 transition-colors`} />
              <div className="flex items-center justify-between mb-6 relative z-10">
                <div className={`w-12 h-12 rounded-2xl bg-${stat.color}-50 flex items-center justify-center group-hover:scale-110 transition-transform duration-500`}>
                  <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
                </div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em]">{stat.label}</p>
              </div>
              <p className="text-5xl font-black font-display tracking-tighter text-gray-900 relative z-10">{stat.value}</p>
            </motion.div>
          ))}
        </div>

      {/* Profile Change Requests Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="glossy-card overflow-hidden border border-white/50"
      >
        <div className="p-8 border-b border-gray-50 bg-indigo-50/30 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
              <UserCheck className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Profile Change Requests</h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">Review and approve user profile updates</p>
            </div>
          </div>
          <span className="px-5 py-2 bg-indigo-600 text-white text-[10px] font-black rounded-2xl uppercase tracking-[0.2em] shadow-lg shadow-indigo-200">
            {profileChangeRequests.length} REQUESTS
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] bg-gray-50/50">
                <th className="px-8 py-5">User Info</th>
                <th className="px-8 py-5">Proposed Changes</th>
                <th className="px-8 py-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <AnimatePresence mode="popLayout">
                {profileChangeRequests.map(user => (
                  <motion.tr 
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, x: -20 }}
                    key={user.uid} 
                    className="hover:bg-gray-50/50 transition-colors group"
                  >
                    <td className="px-8 py-6">
                      <div className="font-black text-gray-900 text-lg tracking-tight">{user.name}</div>
                      <div className="text-sm text-gray-400 font-medium">{user.email}</div>
                      <div className="inline-flex items-center px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-lg mt-2">{user.role}</div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="space-y-3">
                        <div className="flex items-center space-x-4">
                          <span className="text-gray-400 text-[10px] uppercase font-black tracking-widest w-12">Name</span>
                          <span className="font-bold text-gray-900 bg-white px-3 py-1 rounded-lg border border-gray-100 shadow-sm">{user.pendingProfileChanges?.name}</span>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className="text-gray-400 text-[10px] uppercase font-black tracking-widest w-12">Email</span>
                          <span className="font-bold text-gray-900 bg-white px-3 py-1 rounded-lg border border-gray-100 shadow-sm">{user.pendingProfileChanges?.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-end space-x-3">
                        <motion.button 
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => approveProfileChange(user.uid)}
                          className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center hover:bg-green-600 hover:text-white transition-all shadow-sm"
                          title="Approve"
                        >
                          <CheckCircle className="w-6 h-6" />
                        </motion.button>
                        <motion.button 
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => rejectProfileChange(user.uid)}
                          className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center hover:bg-red-600 hover:text-white transition-all shadow-sm"
                          title="Reject"
                        >
                          <XCircle className="w-6 h-6" />
                        </motion.button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              {profileChangeRequests.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="w-16 h-16 bg-gray-50 rounded-[2rem] flex items-center justify-center">
                        <UserCheck className="w-8 h-8 text-gray-300" />
                      </div>
                      <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">No pending profile change requests</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Suspended Sellers Section */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="glossy-card overflow-hidden border border-white/50"
        >
          <div className="p-8 border-b border-gray-50 bg-red-50/30 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Suspended Sellers</h3>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">Manage accounts with excessive strikes</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] bg-gray-50/50">
                  <th className="px-8 py-5">Seller Info</th>
                  <th className="px-8 py-5">Strikes</th>
                  <th className="px-8 py-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <AnimatePresence mode="popLayout">
                  {suspendedSellers.map(user => (
                    <motion.tr 
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, x: -20 }}
                      key={user.uid} 
                      className="hover:bg-gray-50/50 transition-colors group"
                    >
                      <td className="px-8 py-6">
                        <div className="font-black text-gray-900 tracking-tight">{user.name}</div>
                        <div className="text-xs text-gray-400 font-medium">{user.email}</div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="px-4 py-1.5 bg-red-100 text-red-700 text-[10px] font-black rounded-xl uppercase tracking-widest">
                          {user.strikes} STRIKES
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <motion.button 
                          whileHover={{ scale: 1.05, y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => liftSuspension(user.uid)}
                          className="px-6 py-3 bg-green-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-green-700 shadow-xl shadow-green-100 transition-all flex items-center space-x-3 ml-auto"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>Lift Suspension</span>
                        </motion.button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {suspendedSellers.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-8 py-20 text-center">
                      <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No sellers are currently suspended</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

      {/* Dedicated Seller Verification Section */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        className="glossy-card overflow-hidden border border-white/50"
      >
        <div className="p-8 border-b border-gray-50 bg-amber-50/30 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
              <UserCheck className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Seller Verification Requests</h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">Validate new producer accounts</p>
            </div>
          </div>
          <span className="px-5 py-2 bg-amber-600 text-white text-[10px] font-black rounded-2xl uppercase tracking-[0.2em] shadow-lg shadow-amber-200">
            {unverifiedSellers.length} PENDING
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] bg-gray-50/50">
                <th className="px-8 py-5">Seller Info</th>
                <th className="px-8 py-5">Email Address</th>
                <th className="px-8 py-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <AnimatePresence mode="popLayout">
                {unverifiedSellers.map(user => (
                  <motion.tr 
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, x: 20 }}
                    key={user.uid} 
                    className="hover:bg-gray-50/50 transition-colors group"
                  >
                    <td className="px-8 py-6">
                      <div className="font-black text-gray-900 tracking-tight">{user.name}</div>
                      <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">ID: {user.uid.slice(0, 8)}</div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-sm font-medium text-gray-600">{user.email}</div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <motion.button 
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => verifySeller(user.uid)}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center space-x-3 ml-auto"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Verify Seller</span>
                      </motion.button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              {unverifiedSellers.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-8 py-20 text-center">
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No pending verification requests</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>

    {/* Delivery Fleet Management */}
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="glossy-card overflow-hidden border border-white/50"
    >
      <div className="p-8 border-b border-gray-50 bg-purple-50/30 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
            <Truck className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Delivery Fleet Management</h3>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">Monitor and manage delivery partners</p>
          </div>
        </div>
        <span className="px-5 py-2 bg-purple-600 text-white text-[10px] font-black rounded-2xl uppercase tracking-[0.2em] shadow-lg shadow-purple-200">
          {deliveryBoys.length} ACTIVE
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] bg-gray-50/50">
              <th className="px-8 py-5">Delivery Partner</th>
              <th className="px-8 py-5">Email Address</th>
              <th className="px-8 py-5">Status</th>
              <th className="px-8 py-5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            <AnimatePresence mode="popLayout">
              {deliveryBoys.map(user => (
                <motion.tr 
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, y: 20 }}
                  key={user.uid} 
                  className="hover:bg-gray-50/50 transition-colors group"
                >
                  <td className="px-8 py-6">
                    <div className="font-black text-gray-900 tracking-tight">{user.name}</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">ID: {user.uid.slice(0, 8)}</div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="text-sm font-medium text-gray-600">{user.email}</div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${user.isOnline ? 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-300'}`} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${
                        user.isOnline ? 'text-green-600' : 'text-gray-400'
                      }`}>
                        {user.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => changeRole(user.uid, 'consumer')}
                      className="px-5 py-2.5 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all border border-red-100"
                    >
                      Remove Role
                    </motion.button>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
            {deliveryBoys.length === 0 && (
              <tr>
                <td colSpan={4} className="px-8 py-20 text-center">
                  <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No delivery partners registered</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>

    {/* Full User Management Table */}
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="glossy-card overflow-hidden border border-white/50"
    >
      <div className="p-8 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
            <Users className="w-6 h-6 text-gray-600" />
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">All System Users</h3>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">Comprehensive user directory and role management</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text"
              placeholder="SEARCH USERS..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 pr-6 py-3 bg-white/50 border border-gray-100 rounded-2xl text-[10px] font-black uppercase tracking-widest focus:ring-2 focus:ring-indigo-500 outline-none w-64 transition-all"
            />
          </div>
          <div className="relative">
            <select 
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="appearance-none pl-11 pr-10 py-3 bg-white border border-gray-100 rounded-2xl text-[10px] font-black uppercase tracking-widest focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer hover:bg-gray-50 shadow-sm"
            >
              <option value="all">ALL ROLES</option>
              <option value="consumer">CONSUMERS</option>
              <option value="producer">PRODUCERS</option>
              <option value="delivery">DELIVERY</option>
              <option value="admin">ADMINS</option>
            </select>
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] bg-gray-50/50">
              <th className="px-8 py-5">User</th>
              <th className="px-8 py-5">Role</th>
              <th className="px-8 py-5">Verification</th>
              <th className="px-8 py-5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            <AnimatePresence mode="popLayout">
              {users
                .filter(u => {
                  const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                      u.email.toLowerCase().includes(searchTerm.toLowerCase());
                  const matchesRole = roleFilter === 'all' || u.role === roleFilter;
                  return matchesSearch && matchesRole;
                })
                .map(user => (
                <motion.tr 
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  key={user.uid} 
                  className="hover:bg-gray-50/50 transition-colors group"
                >
                  <td className="px-8 py-6">
                    <div className="font-black text-gray-900 tracking-tight">{user.name}</div>
                    <div className="text-xs text-gray-400 font-medium">{user.email}</div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="relative inline-block">
                      <select 
                        className="appearance-none text-[10px] font-black uppercase tracking-widest bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 pr-10 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer hover:bg-white"
                        value={user.role}
                        onChange={(e) => changeRole(user.uid, e.target.value)}
                        disabled={user.email === 'vpk525252@gmail.com'}
                      >
                        <option value="consumer">Consumer</option>
                        <option value="producer">Producer</option>
                        <option value="delivery">Delivery</option>
                        {user.role === 'admin' && <option value="admin">Admin</option>}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Filter className="w-3 h-3 text-gray-400" />
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    {user.isVerified ? (
                      <span className="inline-flex items-center px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-green-50 text-green-600 border border-green-100">
                        VERIFIED
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-600 border border-amber-100">
                        PENDING
                      </span>
                    )}
                  </td>
                  <td className="px-8 py-6 text-right">
                    {user.role === 'producer' && (
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => user.isVerified ? revokeVerification(user.uid) : verifySeller(user.uid)}
                        className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          user.isVerified 
                          ? 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-100' 
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-100'
                        }`}
                      >
                        {user.isVerified ? 'Revoke' : 'Verify'}
                      </motion.button>
                    )}
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </motion.div>
      </motion.div>
    </div>
  );
};

export default AdminDashboard;
