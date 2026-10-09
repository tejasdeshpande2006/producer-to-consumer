import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, deleteDoc, doc, addDoc, serverTimestamp, updateDoc, increment, getDocs, writeBatch } from 'firebase/firestore';
import { Trash2, ShoppingBag, ArrowRight, Wallet as WalletIcon, CheckCircle2, Minus, Plus, MapPin, Phone, User, Home, Briefcase, Star, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SavedAddress } from '../types';

import { motion, AnimatePresence } from 'motion/react';

interface CartItem {
  id: string;
  productId: string;
  title: string;
  price: number;
  quantity: number;
  image: string;
  sellerId: string;
}

interface DeliveryDetails {
  fullName: string;
  phoneNumber: string;
  alternatePhone: string;
  pincode: string;
  city: string;
  state: string;
  address: string;
  landmark: string;
}

const CartPage: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [deliveryDetails, setDeliveryDetails] = useState<DeliveryDetails>({
    fullName: '',
    phoneNumber: '',
    alternatePhone: '',
    pincode: '',
    city: '',
    state: '',
    address: '',
    landmark: ''
  });
  const [formErrors, setFormErrors] = useState<Partial<DeliveryDetails>>({});

  // Get saved addresses from profile - memoize to prevent reference changes
  const savedAddresses = useMemo(() => profile?.savedAddresses || [], [profile?.savedAddresses]);

  // Select default address on load
  useEffect(() => {
    if (savedAddresses.length > 0 && !selectedAddressId) {
      const defaultAddr = savedAddresses.find(a => a.isDefault) || savedAddresses[0];
      setSelectedAddressId(defaultAddr.id);
    }
  }, [savedAddresses, selectedAddressId]);

  // Prefill delivery details from selected saved address
  useEffect(() => {
    if (selectedAddressId && savedAddresses.length > 0) {
      const addr = savedAddresses.find(a => a.id === selectedAddressId);
      if (addr) {
        setDeliveryDetails({
          fullName: addr.fullName,
          phoneNumber: addr.phoneNumber,
          alternatePhone: addr.alternatePhone || '',
          pincode: addr.pincode,
          city: addr.city,
          state: addr.state,
          address: addr.address,
          landmark: addr.landmark || ''
        });
      }
    } else if (profile && !selectedAddressId) {
      // Fallback to profile info if no saved address
      setDeliveryDetails(prev => ({
        ...prev,
        fullName: profile.name || '',
        phoneNumber: profile.phoneNumber || ''
      }));
    }
  }, [selectedAddressId, savedAddresses, profile]);

  useEffect(() => {
    if (!user) return;
    const path = `users/${user.uid}/cart`;
    const unsubscribe = onSnapshot(collection(db, 'users', user.uid, 'cart'), (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CartItem)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return () => unsubscribe();
  }, [user]);

  // Cart prices already include 5% platform fee
  const subtotalWithFee = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const baseAmount = subtotalWithFee / 1.05;
  const platformFee = subtotalWithFee - baseAmount;
  const total = subtotalWithFee; // For compatibility with existing code

  const validateDeliveryDetails = (): boolean => {
    const errors: Partial<DeliveryDetails> = {};
    
    if (!deliveryDetails.fullName.trim()) {
      errors.fullName = 'Full name is required';
    }
    if (!deliveryDetails.phoneNumber.trim()) {
      errors.phoneNumber = 'Phone number is required';
    } else if (!/^[6-9]\d{9}$/.test(deliveryDetails.phoneNumber.trim())) {
      errors.phoneNumber = 'Enter valid 10-digit mobile number';
    }
    if (deliveryDetails.alternatePhone && !/^[6-9]\d{9}$/.test(deliveryDetails.alternatePhone.trim())) {
      errors.alternatePhone = 'Enter valid 10-digit mobile number';
    }
    if (!deliveryDetails.pincode.trim()) {
      errors.pincode = 'Pincode is required';
    } else if (!/^\d{6}$/.test(deliveryDetails.pincode.trim())) {
      errors.pincode = 'Enter valid 6-digit pincode';
    }
    if (!deliveryDetails.city.trim()) {
      errors.city = 'City is required';
    }
    if (!deliveryDetails.state.trim()) {
      errors.state = 'State is required';
    }
    if (!deliveryDetails.address.trim()) {
      errors.address = 'Address is required';
    } else if (deliveryDetails.address.trim().length < 10) {
      errors.address = 'Please enter complete address';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const getFullShippingAddress = (): string => {
    const parts = [
      deliveryDetails.fullName,
      deliveryDetails.address,
      deliveryDetails.landmark ? `Near: ${deliveryDetails.landmark}` : '',
      `${deliveryDetails.city}, ${deliveryDetails.state} - ${deliveryDetails.pincode}`,
      `Phone: ${deliveryDetails.phoneNumber}`,
      deliveryDetails.alternatePhone ? `Alt: ${deliveryDetails.alternatePhone}` : ''
    ].filter(Boolean);
    return parts.join('\n');
  };

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (!user || newQuantity < 1) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'cart', itemId), {
        quantity: newQuantity
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/cart/${itemId}`);
    }
  };

  const handleProceedToCheckout = () => {
    if (items.length === 0) return;
    setShowDeliveryForm(true);
  };

  const handleCheckout = async () => {
    if (!user || !profile || items.length === 0) return;

    if (!validateDeliveryDetails()) {
      return;
    }
    
    if (profile.walletBalance < total * 1.18) {
      alert('Insufficient wallet balance! Please top up your wallet.');
      navigate('/wallet');
      return;
    }

    setCheckingOut(true);
    try {
      const payload = {
        userId: user.uid,
        cartItemIds: items.map(i => i.id),
        orderDetails: {
          totalAmount: total * 1.18,
          shippingAddress: getFullShippingAddress(),
          deliveryDetails: deliveryDetails,
          sellerId: items[0]?.sellerId,
          items: items.map(i => ({ productId: i.productId, title: i.title, price: i.price, quantity: i.quantity }))
        }
      };

      const requestInit: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      };

      let response: Response;
      try {
        response = await fetch('/api/wallet/purchase', requestInit);
      } catch {
        response = await fetch('http://localhost:3000/api/wallet/purchase', requestInit);
      }

      if (!response.ok) {
        let message = 'Checkout failed';
        try {
          const err = await response.json();
          message = err.error || message;
        } catch {
          const text = await response.text();
          if (text) message = text;
        }
        throw new Error(message);
      }

      setSuccess(true);
      setTimeout(() => navigate('/orders'), 3000);
    } catch (error: any) {
      console.error('Checkout error:', error);
      alert(error.message);
    } finally {
      setCheckingOut(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-3xl flex items-center justify-center mb-6 animate-bounce">
          <CheckCircle2 className="text-green-600 w-10 h-10" />
        </div>
        <h1 className="text-3xl font-black text-gray-900 mb-2">Order Placed!</h1>
        <p className="text-gray-500">Your order has been successfully created and paid for via Wallet.</p>
        <p className="text-gray-400 text-sm mt-4">Redirecting to orders...</p>
        <button 
          onClick={() => navigate('/orders')}
          className="mt-6 px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
        >
          View Order & Download Invoice
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-16"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-10">
          <div className="flex items-center space-x-8">
            <motion.div 
              whileHover={{ rotate: 15, scale: 1.1 }}
              className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-indigo-200/50 border-4 border-white group"
            >
              <ShoppingBag className="text-white w-12 h-12 group-hover:scale-110 transition-transform" />
            </motion.div>
            <div>
              <h1 className="text-7xl font-black text-gray-900 tracking-tighter font-display uppercase leading-none">Your Cart<span className="text-indigo-600">.</span></h1>
              <p className="text-gray-400 font-bold text-sm uppercase tracking-[0.4em] mt-3">Review items before checkout</p>
            </div>
          </div>
          <div className="glass-surface px-10 py-5 rounded-2xl flex items-center space-x-6 border-white/60 shadow-xl">
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-indigo-600" />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.3em] text-gray-600">{items.length} Items</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-20">
        {/* Items List */}
        <div className="lg:col-span-2 space-y-10">
          <motion.div layout className="space-y-8">
            <AnimatePresence mode="popLayout">
              {items.map((item, i) => (
                <motion.div 
                  layout
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100, scale: 0.9 }}
                  transition={{ delay: i * 0.05 }}
                  className="glossy-card p-12 flex flex-col sm:flex-row items-center justify-between gap-12 group relative overflow-hidden border-white/40 shadow-2xl shadow-gray-100/50"
                >
                  <div className="absolute top-0 left-0 w-3 h-full bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-indigo-50 rounded-full blur-[100px] opacity-0 group-hover:opacity-60 transition-opacity" />
                  
                  <div className="flex flex-col sm:flex-row items-center gap-12 w-full relative z-10">
                    <div className="w-48 h-48 rounded-[3rem] overflow-hidden bg-gray-50 shadow-2xl shadow-gray-200/50 group-hover:rotate-3 transition-transform duration-500 border-4 border-white">
                      <img 
                        src={item.image || `https://picsum.photos/seed/${item.productId}/300/300`} 
                        alt={item.title} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex-1 space-y-8 text-center sm:text-left">
                      <div>
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.5em] mb-3 block">Premium Selection</span>
                        <h4 className="font-black text-gray-900 text-4xl tracking-tighter font-display line-clamp-1 group-hover:text-indigo-600 transition-colors uppercase leading-tight">{item.title}</h4>
                      </div>
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-10">
                        <div className="space-y-2">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] block">Unit Price</span>
                          <p className="text-4xl font-black text-gray-900 tracking-tighter font-display">₹{item.price.toFixed(2)}</p>
                        </div>
                        <div className="h-12 w-px bg-gray-100 hidden sm:block" />
                        <div className="space-y-3">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] block ml-1">Quantity</span>
                          <div className="flex items-center space-x-6 glass-surface p-2.5 rounded-[1.5rem] border border-white/60 shadow-lg">
                            <motion.button 
                              whileHover={{ scale: 1.1, rotate: -10 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="w-14 h-14 flex items-center justify-center bg-white text-gray-600 rounded-2xl shadow-xl hover:bg-red-50 hover:text-red-500 transition-all border border-gray-50"
                            >
                              <Minus className="w-6 h-6" />
                            </motion.button>
                            <span className="text-3xl font-black text-gray-900 w-10 text-center font-display">{item.quantity}</span>
                            <motion.button 
                              whileHover={{ scale: 1.1, rotate: 10 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="w-14 h-14 flex items-center justify-center bg-white text-gray-600 rounded-2xl shadow-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-gray-50"
                            >
                              <Plus className="w-6 h-6" />
                            </motion.button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-row sm:flex-col items-center gap-8 relative z-10">
                    <div className="text-right hidden sm:block">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] block mb-2">Subtotal</span>
                      <p className="text-5xl font-black text-indigo-600 tracking-tighter font-display">₹{(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                    <motion.button 
                      whileHover={{ scale: 1.1, rotate: 8, backgroundColor: '#fee2e2', color: '#ef4444' }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => deleteDoc(doc(db, 'users', user!.uid, 'cart', item.id))}
                      className="w-20 h-20 flex items-center justify-center text-gray-300 bg-gray-50/50 rounded-[2rem] transition-all sm:opacity-0 group-hover:opacity-100 shadow-xl hover:shadow-red-100"
                    >
                      <Trash2 className="w-8 h-8" />
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
          
          {items.length === 0 && !loading && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-64 text-center bg-white rounded-[4rem] border-2 border-dashed border-gray-100 shadow-2xl shadow-gray-50/50"
            >
              <div className="w-40 h-40 bg-gray-50 rounded-[3rem] flex items-center justify-center mx-auto mb-10 group hover:rotate-12 transition-transform duration-500">
                <ShoppingBag className="text-gray-200 w-16 h-16 group-hover:text-indigo-200 transition-colors" />
              </div>
              <h2 className="text-5xl font-black text-gray-900 mb-6 uppercase tracking-tighter font-display">Your cart is empty</h2>
              <p className="text-gray-400 font-bold text-xl mb-14 max-w-md mx-auto">Looks like you haven't added anything to your cart yet.</p>
              <motion.button 
                whileHover={{ scale: 1.05, y: -4 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/')} 
                className="glossy-button px-16 py-6 rounded-2xl font-black text-sm uppercase tracking-[0.3em]"
              >
                Start Shopping
              </motion.button>
            </motion.div>
          )}
        </div>

        {/* Summary */}
        <div className="space-y-10">
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white p-14 rounded-[4rem] border border-gray-100 shadow-2xl shadow-indigo-100/30 space-y-12 sticky top-28 overflow-hidden relative"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50 rounded-full -mr-24 -mt-24 blur-[80px] opacity-60" />
            
            <div className="flex items-center space-x-6 relative">
              <div className="w-16 h-16 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-indigo-100">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-black text-gray-900 text-4xl tracking-tighter font-display uppercase">Summary</h3>
            </div>

            <div className="space-y-8 relative">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 font-black text-xs uppercase tracking-[0.3em]">Base Amount</span>
                <span className="text-xl font-black text-gray-600 font-display tracking-tight">₹{baseAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 font-black text-xs uppercase tracking-[0.3em]">Platform Fee (5%)</span>
                <span className="text-xl font-black text-gray-600 font-display tracking-tight">₹{platformFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-gray-100 pt-4">
                <span className="text-gray-400 font-black text-xs uppercase tracking-[0.3em]">Subtotal</span>
                <span className="text-2xl font-black text-gray-900 font-display tracking-tight">₹{subtotalWithFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 font-black text-xs uppercase tracking-[0.3em]">Shipping</span>
                <div className="flex items-center space-x-3">
                  <span className="text-[10px] font-black text-green-600 bg-green-50 px-4 py-1.5 rounded-full uppercase tracking-widest">Free</span>
                  <span className="text-2xl font-black text-gray-900 font-display tracking-tight">₹0.00</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 font-black text-xs uppercase tracking-[0.3em]">Tax (GST 18%)</span>
                <span className="text-2xl font-black text-gray-900 font-display tracking-tight">₹{(subtotalWithFee * 0.18).toFixed(2)}</span>
              </div>
              
              <div className="h-px bg-gray-100 my-10" />
              
              <div className="flex justify-between items-end">
                <div className="space-y-2">
                  <span className="font-black text-gray-900 text-sm uppercase tracking-[0.4em]">Total Amount</span>
                  <p className="text-xs text-gray-400 font-bold">Including all taxes & fees</p>
                </div>
                <span className="text-7xl font-black text-indigo-600 tracking-tighter font-display">₹{(subtotalWithFee * 1.18).toFixed(2)}</span>
              </div>
            </div>

            <div className="p-10 bg-gray-50/50 rounded-[2.5rem] border border-gray-100 flex items-center justify-between group hover:bg-white hover:shadow-2xl transition-all duration-500 relative">
              <div className="flex items-center space-x-6">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform group-hover:rotate-6">
                  <WalletIcon className="w-8 h-8 text-indigo-600" />
                </div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Wallet Balance</span>
              </div>
              <span className="font-black text-gray-900 text-2xl tracking-tighter">₹{profile?.walletBalance.toFixed(2)}</span>
            </div>

            <motion.button 
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleProceedToCheckout}
              disabled={items.length === 0}
              className="w-full py-8 glossy-button rounded-[2rem] font-black text-2xl flex items-center justify-center space-x-4 disabled:opacity-50 uppercase tracking-[0.2em] shadow-2xl shadow-indigo-200"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-8 h-8" />
            </motion.button>
          </motion.div>
        </div>
      </div>
      </motion.div>

      {/* Delivery Details Modal */}
      <AnimatePresence>
        {showDeliveryForm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDeliveryForm(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[2rem] p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center">
                  <MapPin className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-gray-900 tracking-tight">Delivery Address</h2>
                  <p className="text-gray-400 text-sm font-medium">Select or enter delivery address</p>
                </div>
              </div>

              {/* Saved Addresses Section */}
              {savedAddresses.length > 0 && !showAddressForm && (
                <div className="mb-6 space-y-3">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                    Saved Addresses
                  </label>
                  <div className="space-y-3">
                    {savedAddresses.map(addr => (
                      <div 
                        key={addr.id}
                        onClick={() => {
                          setSelectedAddressId(addr.id);
                          setShowAddressForm(false);
                        }}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          selectedAddressId === addr.id 
                            ? 'border-indigo-500 bg-indigo-50' 
                            : 'border-gray-100 hover:border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              addr.label === 'Home' ? 'bg-blue-100' : addr.label === 'Work' ? 'bg-amber-100' : 'bg-gray-100'
                            }`}>
                              {addr.label === 'Home' ? <Home className="w-5 h-5 text-blue-600" /> : 
                               addr.label === 'Work' ? <Briefcase className="w-5 h-5 text-amber-600" /> : 
                               <MapPin className="w-5 h-5 text-gray-600" />}
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-gray-900">{addr.label}</span>
                                {addr.isDefault && (
                                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full uppercase">
                                    Default
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">{addr.fullName} • {addr.phoneNumber}</p>
                            </div>
                          </div>
                          {selectedAddressId === addr.id && (
                            <CheckCircle2 className="w-6 h-6 text-indigo-600" />
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-2 ml-13">
                          {addr.address}, {addr.city}, {addr.state} - {addr.pincode}
                        </p>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setShowAddressForm(true);
                      setSelectedAddressId(null);
                      setDeliveryDetails({
                        fullName: profile?.name || '',
                        phoneNumber: profile?.phoneNumber || '',
                        alternatePhone: '',
                        pincode: '',
                        city: '',
                        state: '',
                        address: '',
                        landmark: ''
                      });
                    }}
                    className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-indigo-600 font-bold text-sm hover:border-indigo-300 hover:bg-indigo-50 transition-all flex items-center justify-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add New Address</span>
                  </button>
                </div>
              )}

              {/* Address Form (shown if no saved addresses or adding new) */}
              {(savedAddresses.length === 0 || showAddressForm) && (
                <>
                  {showAddressForm && savedAddresses.length > 0 && (
                    <button
                      onClick={() => {
                        setShowAddressForm(false);
                        if (savedAddresses.length > 0) {
                          const defaultAddr = savedAddresses.find(a => a.isDefault) || savedAddresses[0];
                          setSelectedAddressId(defaultAddr.id);
                        }
                      }}
                      className="mb-4 text-sm text-indigo-600 font-medium hover:underline"
                    >
                      ← Back to saved addresses
                    </button>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Full Name */}
                    <div className="md:col-span-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          value={deliveryDetails.fullName}
                          onChange={(e) => setDeliveryDetails(prev => ({ ...prev, fullName: e.target.value }))}
                          className={`w-full pl-12 pr-4 py-4 bg-gray-50 border-2 rounded-xl font-medium focus:bg-white focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 outline-none transition-all ${formErrors.fullName ? 'border-red-300 bg-red-50' : 'border-transparent'}`}
                          placeholder="Enter your full name"
                        />
                      </div>
                  {formErrors.fullName && <p className="text-red-500 text-xs mt-1 font-medium">{formErrors.fullName}</p>}
                </div>

                {/* Phone Number */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      value={deliveryDetails.phoneNumber}
                      onChange={(e) => setDeliveryDetails(prev => ({ ...prev, phoneNumber: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                      className={`w-full pl-12 pr-4 py-4 bg-gray-50 border-2 rounded-xl font-medium focus:bg-white focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 outline-none transition-all ${formErrors.phoneNumber ? 'border-red-300 bg-red-50' : 'border-transparent'}`}
                      placeholder="10-digit mobile number"
                    />
                  </div>
                  {formErrors.phoneNumber && <p className="text-red-500 text-xs mt-1 font-medium">{formErrors.phoneNumber}</p>}
                </div>

                {/* Alternate Phone */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                    Alternate Mobile (Optional)
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      value={deliveryDetails.alternatePhone}
                      onChange={(e) => setDeliveryDetails(prev => ({ ...prev, alternatePhone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                      className={`w-full pl-12 pr-4 py-4 bg-gray-50 border-2 rounded-xl font-medium focus:bg-white focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 outline-none transition-all ${formErrors.alternatePhone ? 'border-red-300 bg-red-50' : 'border-transparent'}`}
                      placeholder="Alternate number (optional)"
                    />
                  </div>
                  {formErrors.alternatePhone && <p className="text-red-500 text-xs mt-1 font-medium">{formErrors.alternatePhone}</p>}
                </div>

                {/* Pincode */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                    Pincode <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={deliveryDetails.pincode}
                    onChange={(e) => setDeliveryDetails(prev => ({ ...prev, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                    className={`w-full px-4 py-4 bg-gray-50 border-2 rounded-xl font-medium focus:bg-white focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 outline-none transition-all ${formErrors.pincode ? 'border-red-300 bg-red-50' : 'border-transparent'}`}
                    placeholder="6-digit pincode"
                  />
                  {formErrors.pincode && <p className="text-red-500 text-xs mt-1 font-medium">{formErrors.pincode}</p>}
                </div>

                {/* City */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={deliveryDetails.city}
                    onChange={(e) => setDeliveryDetails(prev => ({ ...prev, city: e.target.value }))}
                    className={`w-full px-4 py-4 bg-gray-50 border-2 rounded-xl font-medium focus:bg-white focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 outline-none transition-all ${formErrors.city ? 'border-red-300 bg-red-50' : 'border-transparent'}`}
                    placeholder="Enter city"
                  />
                  {formErrors.city && <p className="text-red-500 text-xs mt-1 font-medium">{formErrors.city}</p>}
                </div>

                {/* State */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                    State <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={deliveryDetails.state}
                    onChange={(e) => setDeliveryDetails(prev => ({ ...prev, state: e.target.value }))}
                    className={`w-full px-4 py-4 bg-gray-50 border-2 rounded-xl font-medium focus:bg-white focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 outline-none transition-all ${formErrors.state ? 'border-red-300 bg-red-50' : 'border-transparent'}`}
                  >
                    <option value="">Select State</option>
                    <option value="Andhra Pradesh">Andhra Pradesh</option>
                    <option value="Arunachal Pradesh">Arunachal Pradesh</option>
                    <option value="Assam">Assam</option>
                    <option value="Bihar">Bihar</option>
                    <option value="Chhattisgarh">Chhattisgarh</option>
                    <option value="Goa">Goa</option>
                    <option value="Gujarat">Gujarat</option>
                    <option value="Haryana">Haryana</option>
                    <option value="Himachal Pradesh">Himachal Pradesh</option>
                    <option value="Jharkhand">Jharkhand</option>
                    <option value="Karnataka">Karnataka</option>
                    <option value="Kerala">Kerala</option>
                    <option value="Madhya Pradesh">Madhya Pradesh</option>
                    <option value="Maharashtra">Maharashtra</option>
                    <option value="Manipur">Manipur</option>
                    <option value="Meghalaya">Meghalaya</option>
                    <option value="Mizoram">Mizoram</option>
                    <option value="Nagaland">Nagaland</option>
                    <option value="Odisha">Odisha</option>
                    <option value="Punjab">Punjab</option>
                    <option value="Rajasthan">Rajasthan</option>
                    <option value="Sikkim">Sikkim</option>
                    <option value="Tamil Nadu">Tamil Nadu</option>
                    <option value="Telangana">Telangana</option>
                    <option value="Tripura">Tripura</option>
                    <option value="Uttar Pradesh">Uttar Pradesh</option>
                    <option value="Uttarakhand">Uttarakhand</option>
                    <option value="West Bengal">West Bengal</option>
                    <option value="Delhi">Delhi</option>
                  </select>
                  {formErrors.state && <p className="text-red-500 text-xs mt-1 font-medium">{formErrors.state}</p>}
                </div>

                {/* Full Address */}
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                    Full Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={deliveryDetails.address}
                    onChange={(e) => setDeliveryDetails(prev => ({ ...prev, address: e.target.value }))}
                    className={`w-full px-4 py-4 bg-gray-50 border-2 rounded-xl font-medium focus:bg-white focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 outline-none transition-all resize-none ${formErrors.address ? 'border-red-300 bg-red-50' : 'border-transparent'}`}
                    rows={3}
                    placeholder="House/Flat No., Building Name, Street, Area"
                  />
                  {formErrors.address && <p className="text-red-500 text-xs mt-1 font-medium">{formErrors.address}</p>}
                </div>

                {/* Landmark */}
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                    Landmark (Optional)
                  </label>
                  <input
                    type="text"
                    value={deliveryDetails.landmark}
                    onChange={(e) => setDeliveryDetails(prev => ({ ...prev, landmark: e.target.value }))}
                    className="w-full px-4 py-4 bg-gray-50 border-2 border-transparent rounded-xl font-medium focus:bg-white focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
                    placeholder="Nearby landmark (e.g., Near City Mall)"
                  />
                </div>
                  </div>
                </>
              )}

              {/* Order Summary in Modal */}
              <div className="mt-8 p-6 bg-gray-50 rounded-2xl">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-gray-600 font-bold">Order Total</span>
                  <span className="text-2xl font-black text-indigo-600">₹{(subtotalWithFee * 1.18).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm text-gray-400">
                  <span>Wallet Balance</span>
                  <span className={profile && profile.walletBalance < subtotalWithFee * 1.18 ? 'text-red-500' : 'text-green-600'}>
                    ₹{profile?.walletBalance.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 mt-8">
                <button
                  onClick={() => setShowDeliveryForm(false)}
                  className="flex-1 py-4 px-6 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  Back to Cart
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCheckout}
                  disabled={checkingOut}
                  className="flex-1 py-4 px-6 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  <span>{checkingOut ? 'Processing...' : 'Place Order'}</span>
                  {!checkingOut && <CheckCircle2 className="w-5 h-5" />}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CartPage;
