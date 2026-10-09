import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Wallet, User, LogOut, Shield, Truck, Heart, Menu, X, ChevronRight, Package } from 'lucide-react';
import P2CLogo from './P2CLogo';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

import { motion, AnimatePresence } from 'motion/react';

const Navbar: React.FC = () => {
  const { user, profile, isAdmin, isProducer, isDelivery } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
    setIsMenuOpen(false);
  };

  const navLinks = [
    { to: "/", label: "Browse" },
    { to: "/orders", label: "Orders", auth: true },
    { to: "/dashboard", label: "Dashboard", role: true },
    { to: "/producer", label: "Producer", producer: true },
    { to: "/admin", label: "Admin", admin: true, icon: Shield },
    { to: "/delivery", label: "Delivery", delivery: true, icon: Truck },
  ];

  const filteredLinks = navLinks.filter(link => {
    if (link.auth && !user) return false;
    if (link.role && !isAdmin && !isProducer && !isDelivery) return false;
    if (link.producer && !isProducer) return false;
    if (link.admin && !isAdmin) return false;
    if (link.delivery && !isDelivery) return false;
    return true;
  });

  return (
    <nav className="glass-surface sticky top-0 z-50 border-b border-white/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-24 items-center">
          <motion.div
            whileHover={{ scale: 1.05, rotate: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link to="/" className="flex items-center space-x-4">
              <div className="w-14 h-14 bg-indigo-600 rounded-[1.25rem] flex items-center justify-center shadow-2xl shadow-indigo-200 relative overflow-hidden group border-2 border-white/20">
                <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10">
                  <P2CLogo />
                </div>
              </div>
              <span className="text-4xl font-black tracking-tighter text-gray-900 font-display uppercase leading-none">P2C<span className="text-indigo-600">.</span></span>
            </Link>
          </motion.div>

          {/* Desktop Links */}
          <div className="hidden lg:flex items-center space-x-14">
            {filteredLinks.map((link) => {
              const Icon = link.icon;
              return (
                <motion.div key={link.to} whileHover={{ y: -2, scale: 1.05 }}>
                  <Link 
                    to={link.to} 
                    className="text-[10px] font-black text-gray-400 hover:text-indigo-600 transition-all uppercase tracking-[0.3em] flex items-center"
                  >
                    {Icon && <Icon className="w-4 h-4 mr-2" />}
                    {link.label}
                  </Link>
                </motion.div>
              );
            })}
          </div>

          <div className="flex items-center space-x-4 lg:space-x-10">
            {user ? (
              <>
                <motion.div className="hidden sm:block" whileHover={{ scale: 1.05, y: -2 }}>
                  <Link to="/wallet" className="flex items-center space-x-4 px-6 py-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl hover:bg-white hover:shadow-xl transition-all group">
                    <Wallet className="w-5 h-5 text-indigo-600 group-hover:rotate-12 transition-transform" />
                    <span className="text-base font-black text-indigo-900 tracking-tighter font-display">₹{profile?.walletBalance.toFixed(2)}</span>
                  </Link>
                </motion.div>
                
                <div className="flex items-center space-x-2 lg:space-x-4">
                  <motion.div whileHover={{ scale: 1.1, rotate: -8, y: -2 }} whileTap={{ scale: 0.9 }}>
                    <Link to="/cart" className="w-10 h-10 lg:w-12 lg:h-12 flex items-center justify-center text-gray-400 hover:text-indigo-600 transition-colors relative bg-gray-50 rounded-xl hover:bg-white hover:shadow-xl border border-transparent hover:border-indigo-100">
                      <ShoppingCart className="w-5 h-5" />
                    </Link>
                  </motion.div>
                  <motion.div className="hidden sm:flex" whileHover={{ scale: 1.1, rotate: 8, y: -2 }} whileTap={{ scale: 0.9 }}>
                    <Link to="/wishlist" className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors bg-gray-50 rounded-xl hover:bg-white hover:shadow-xl border border-transparent hover:border-red-100">
                      <Heart className="w-5 h-5" />
                    </Link>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.1, y: -2 }} whileTap={{ scale: 0.9 }}>
                    <Link to="/profile" className="w-10 h-10 lg:w-12 lg:h-12 flex items-center justify-center text-gray-400 hover:text-indigo-600 transition-colors bg-gray-50 rounded-xl hover:bg-white hover:shadow-xl border border-transparent hover:border-indigo-100">
                      <User className="w-5 h-5" />
                    </Link>
                  </motion.div>
                </div>

                <div className="hidden lg:block h-10 w-px bg-gray-100 mx-2" />
                
                <motion.button 
                  whileHover={{ scale: 1.05, x: 5 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleLogout} 
                  className="hidden lg:flex items-center space-x-3 px-6 py-3 text-red-600 bg-red-50 hover:bg-red-100 rounded-2xl transition-all border border-red-100 shadow-sm"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Logout</span>
                </motion.button>
              </>
            ) : (
              <div className="flex items-center space-x-4 lg:space-x-10">
                <Link to="/login" className="text-[10px] font-black text-gray-400 hover:text-indigo-600 transition-colors uppercase tracking-[0.3em]">
                  Sign In
                </Link>
                <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
                  <Link to="/register" className="px-6 lg:px-10 py-3 lg:py-4 bg-indigo-600 text-white text-[10px] font-black rounded-2xl uppercase tracking-[0.3em] shadow-2xl shadow-indigo-200 hover:bg-indigo-700 transition-all border border-indigo-500">
                    Register
                  </Link>
                </motion.div>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="lg:hidden w-10 h-10 flex items-center justify-center bg-gray-50 rounded-xl text-gray-600"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-white border-t border-gray-100 overflow-hidden"
          >
            <div className="px-4 py-8 space-y-6">
              {filteredLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl group active:bg-indigo-50 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
                        {Icon ? <Icon className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                      </div>
                      <span className="text-sm font-black text-gray-900 uppercase tracking-widest">{link.label}</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-active:text-indigo-600" />
                  </Link>
                );
              })}
              
              {user && (
                <div className="pt-6 border-t border-gray-100 space-y-4">
                  <Link
                    to="/wallet"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center justify-between p-4 bg-indigo-50/50 rounded-2xl"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600">
                        <Wallet className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-black text-indigo-900 uppercase tracking-widest">Wallet</span>
                    </div>
                    <span className="text-lg font-black text-indigo-900 font-display">₹{profile?.walletBalance.toFixed(2)}</span>
                  </Link>
                  
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-4 p-4 text-red-600 bg-red-50 rounded-2xl font-black uppercase tracking-widest text-sm"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
