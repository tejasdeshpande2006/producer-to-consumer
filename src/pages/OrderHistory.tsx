import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType, toDate } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { Order, UserProfile } from '../types';
import { Package, Clock, CheckCircle2, Truck, AlertCircle, MapPin, Calendar, Navigation, XCircle, WifiOff, RefreshCw, FileText, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { updateDoc, increment, addDoc, serverTimestamp } from 'firebase/firestore';
import { offlineDb } from '../services/offlineDb';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { motion, AnimatePresence } from 'motion/react';
import { processOrderReturn } from '../services/strikeService';
import Receipt from '../components/Receipt';

const RETURN_REASONS = [
  'Product damaged during delivery',
  'Wrong product delivered',
  'Product quality not as expected',
  'Product expired or near expiry',
  'Missing items in order',
  'Product not as described',
  'Other'
];

const OrderHistory: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveryBoys, setDeliveryBoys] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(true);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [returningOrderId, setReturningOrderId] = useState<string | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnOrderTarget, setReturnOrderTarget] = useState<Order | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [returnDescription, setReturnDescription] = useState('');
  const [processingReturn, setProcessingReturn] = useState(false);
  const isOnline = useOnlineStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [sellerInfo, setSellerInfo] = useState<{ [key: string]: { name: string; email?: string; phone?: string } }>({});

  useEffect(() => {
    if (!user) return;

    const loadOfflineData = async () => {
      const offlineOrders = await offlineDb.getOfflineOrders(user.uid);
      if (offlineOrders.length > 0) {
        setOrders(offlineOrders.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
        setLoading(false);
      }
    };

    loadOfflineData();

    const q = query(collection(db, 'orders'), where('buyerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      const sortedOrders = ordersData.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setOrders(sortedOrders);
      setLoading(false);

      // Sync to offline DB
      setIsSyncing(true);
      await offlineDb.syncOrders(sortedOrders);
      setTimeout(() => setIsSyncing(false), 1000);
    }, (error) => {
      if (!isOnline) {
        setLoading(false);
      } else {
        handleFirestoreError(error, OperationType.LIST, 'orders');
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [user, isOnline]);

  useEffect(() => {
    const fetchDeliveryBoys = async () => {
      const dbIds = Array.from(new Set(orders.map(o => o.deliveryBoyId).filter(Boolean))) as string[];
      const missingIds = dbIds.filter(id => !deliveryBoys[id]);
      
      if (missingIds.length === 0) return;

      const newNames: Record<string, string> = {};
      for (const id of missingIds) {
        try {
          const dSnap = await getDoc(doc(db, 'users', id));
          if (dSnap.exists()) {
            newNames[id] = dSnap.data().name;
          }
        } catch (error) {
          console.error("Error fetching delivery boy:", error);
        }
      }

      if (Object.keys(newNames).length > 0) {
        setDeliveryBoys(prev => ({ ...prev, ...newNames }));
      }
    };

    fetchDeliveryBoys();
  }, [orders]);

  const handleShowReceipt = async (order: Order) => {
    // Fetch seller info if not already cached
    if (!sellerInfo[order.sellerId]) {
      try {
        const sellerDoc = await getDoc(doc(db, 'users', order.sellerId));
        if (sellerDoc.exists()) {
          const data = sellerDoc.data();
          setSellerInfo(prev => ({
            ...prev,
            [order.sellerId]: {
              name: data.name || 'Producer Store',
              email: data.email,
              phone: data.phoneNumber
            }
          }));
        }
      } catch (error) {
        console.error("Error fetching seller info:", error);
      }
    }
    setReceiptOrder(order);
  };

  const getEstimatedDelivery = (timestamp: any) => {
    const date = toDate(timestamp);
    if (!date) return 'Calculating...';
    date.setDate(date.getDate() + 3); // Estimated 3 days for delivery
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'cancelled'
      });
      setCancellingOrderId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const openReturnModal = (order: Order) => {
    setReturnOrderTarget(order);
    setReturnReason('');
    setReturnDescription('');
    setShowReturnModal(true);
  };

  const handleSubmitReturnRequest = async () => {
    if (!returnOrderTarget || !returnReason) return;
    
    setProcessingReturn(true);
    try {
      // Update order with return request
      await updateDoc(doc(db, 'orders', returnOrderTarget.id), {
        status: 'return_requested',
        returnRequest: {
          reason: returnReason,
          description: returnDescription,
          requestedAt: serverTimestamp(),
          status: 'pending'
        }
      });

      // Add notification for seller
      await addDoc(collection(db, 'notifications'), {
        userId: returnOrderTarget.sellerId,
        title: 'Return Request Received',
        message: `A return request has been submitted for order #${returnOrderTarget.id.slice(-8).toUpperCase()}. Reason: ${returnReason}`,
        type: 'warning',
        read: false,
        timestamp: serverTimestamp()
      });

      setShowReturnModal(false);
      setReturnOrderTarget(null);
      alert('Return request submitted successfully! The seller will review your request.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${returnOrderTarget.id}`);
      alert('Failed to submit return request. Please try again.');
    } finally {
      setProcessingReturn(false);
    }
  };

  const handleReturnOrder = async (order: Order) => {
    try {
      await processOrderReturn(order);
      setReturningOrderId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${order.id}`);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-5 h-5 text-amber-500" />;
      case 'confirmed': return <Package className="w-5 h-5 text-blue-500" />;
      case 'shipped': return <Truck className="w-5 h-5 text-indigo-500" />;
      case 'delivered': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'cancelled': return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'returned': return <RefreshCw className="w-5 h-5 text-amber-500" />;
      case 'return_requested': return <RefreshCw className="w-5 h-5 text-orange-500" />;
      default: return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="space-y-16">
      <AnimatePresence>
        {!isOnline && (
          <motion.div 
            initial={{ height: 0, opacity: 0, y: -20 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -20 }}
            className="glass-surface border-amber-200/50 p-6 rounded-3xl flex items-center justify-between bg-amber-50/30 backdrop-blur-xl mb-8"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-100/50">
                <WifiOff className="text-amber-600 w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-black text-amber-900 uppercase tracking-widest">Offline Mode</p>
                <p className="text-xs font-bold text-amber-700/70 uppercase tracking-widest mt-1">Viewing cached order history</p>
              </div>
            </div>
          </motion.div>
        )}
        {isSyncing && isOnline && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-12 right-12 glass-surface bg-indigo-600/90 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center space-x-4 z-50 border-white/20 backdrop-blur-2xl"
          >
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-xs font-black uppercase tracking-[0.3em]">Syncing Data...</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-10">
        <div className="flex items-center space-x-8">
          <motion.div 
            whileHover={{ rotate: 15, scale: 1.1 }}
            className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-indigo-200/50 group border-4 border-white"
          >
            <Package className="text-white w-12 h-12 group-hover:scale-110 transition-transform" />
          </motion.div>
          <div>
            <h1 className="text-7xl font-black text-gray-900 tracking-tighter font-display uppercase leading-none">Orders<span className="text-indigo-600">.</span></h1>
            <p className="text-gray-400 font-bold text-sm uppercase tracking-[0.4em] mt-3">Track your purchases and delivery status</p>
          </div>
        </div>
      </div>

      <div className="space-y-10">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="glossy-card p-12 animate-pulse h-64 border-white/40" />
          ))
        ) : orders.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-56 text-center bg-white rounded-[4rem] border-2 border-dashed border-gray-100 shadow-2xl shadow-gray-50/50 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-50/30 to-transparent pointer-events-none" />
            <div className="w-40 h-40 bg-gray-50 rounded-[3rem] flex items-center justify-center mx-auto mb-10 group hover:rotate-12 transition-transform duration-500 relative z-10">
              <Package className="w-16 h-16 text-gray-200 group-hover:text-indigo-200 transition-colors" />
            </div>
            <h2 className="text-5xl font-black text-gray-900 mb-6 uppercase tracking-tighter font-display relative z-10">No orders yet</h2>
            <p className="text-gray-400 font-bold text-xl mb-14 max-w-md mx-auto relative z-10">Start shopping and your order history will appear here!</p>
            <motion.button 
              whileHover={{ scale: 1.05, y: -4 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/')}
              className="glossy-button px-16 py-6 rounded-2xl font-black text-sm uppercase tracking-[0.3em] relative z-10"
            >
              Explore Products
            </motion.button>
          </motion.div>
        ) : (
          orders.map((order, i) => (
            <motion.div 
              key={order.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glossy-card overflow-hidden border-white/40 group"
            >
              <div className="p-10 border-b border-white/40 flex flex-wrap items-center justify-between gap-8 bg-white/40 backdrop-blur-md">
                <div className="flex items-center space-x-6">
                  <div className="p-4 bg-white rounded-2xl shadow-xl shadow-gray-100/50 border border-white/60 group-hover:scale-110 transition-transform">
                    {getStatusIcon(order.status)}
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-1">Order Reference</p>
                    <p className="text-2xl font-black text-gray-900 tracking-tighter font-display uppercase">#{order.id.slice(-8)}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-12">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-1">Total Amount</p>
                    <div className="flex items-baseline space-x-1">
                      <span className="text-xs font-black text-indigo-600">₹</span>
                      <span className="text-4xl font-black text-gray-900 tracking-tighter font-display">{order.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] border shadow-sm ${
                    order.status === 'delivered' ? 'bg-green-50 text-green-600 border-green-100' : 
                    order.status === 'cancelled' ? 'bg-red-50 text-red-600 border-red-100' : 
                    order.status === 'returned' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                  }`}>
                    {order.status}
                  </div>
                </div>
              </div>

              <div className="p-12 grid grid-cols-1 lg:grid-cols-2 gap-16">
                <div className="space-y-8">
                  <div className="flex items-center space-x-3">
                    <div className="w-1 h-6 bg-indigo-600 rounded-full" />
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Order Items</p>
                  </div>
                  <div className="space-y-6">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between group/item">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center font-black text-xs text-indigo-600 border border-gray-100 group-hover/item:bg-indigo-50 transition-colors">
                            {item.quantity}x
                          </div>
                          <span className="text-lg font-bold text-gray-700 tracking-tight group-hover/item:text-indigo-600 transition-colors uppercase">{item.title}</span>
                        </div>
                        <span className="text-xl font-black text-gray-900 font-display tracking-tighter">₹{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-10">
                  <div className="flex items-center space-x-3">
                    <div className="w-1 h-6 bg-indigo-600 rounded-full" />
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Delivery Details</p>
                  </div>
                  <div className="space-y-6">
                    <div className="flex items-start space-x-6 glass-surface p-6 rounded-[2rem] border-white/60">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-xl border border-gray-50">
                        <MapPin className="w-6 h-6 text-indigo-600" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Shipping Address</p>
                        <p className="text-sm font-bold text-gray-700 leading-relaxed">{order.shippingAddress || '123 Main St, Suite 456, Metro City'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {order.status !== 'delivered' && order.status !== 'cancelled' && (
                        <div className="flex items-center space-x-4 glass-surface p-6 rounded-2xl border-white/60">
                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg border border-gray-50">
                            <Calendar className="w-5 h-5 text-indigo-600" />
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Est. Delivery</p>
                            <p className="text-sm font-black text-gray-900 uppercase tracking-tighter">{getEstimatedDelivery(order.timestamp)}</p>
                          </div>
                        </div>
                      )}
                      {order.deliveryBoyId && (
                        <div className="flex items-center space-x-4 glass-surface p-6 rounded-2xl border-white/60">
                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg border border-gray-50">
                            <Truck className="w-5 h-5 text-indigo-600" />
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Delivery Partner</p>
                            <p className="text-sm font-black text-gray-900 uppercase tracking-tighter">{deliveryBoys[order.deliveryBoyId] || 'Loading...'}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-6 pt-4">
                      {/* Receipt/Invoice Button - Available for all orders */}
                      <motion.button 
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleShowReceipt(order)}
                        className="flex items-center space-x-3 px-10 py-5 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-emerald-700 transition-all shadow-2xl shadow-emerald-100 border border-emerald-500"
                      >
                        <FileText className="w-5 h-5" />
                        <span>{order.status === 'delivered' ? 'Receipt' : 'Invoice'}</span>
                      </motion.button>
                      {(order.status === 'shipped' || order.status === 'delivered') && (
                        <motion.button 
                          whileHover={{ scale: 1.05, y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => navigate(`/order/track/${order.id}`)}
                          className="flex items-center space-x-3 px-10 py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-100 border border-indigo-500"
                        >
                          <Navigation className="w-5 h-5" />
                          <span>Track Order</span>
                        </motion.button>
                      )}
                      {order.status === 'delivered' && (
                        <motion.button 
                          whileHover={{ scale: 1.05, y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => openReturnModal(order)}
                          className="flex items-center space-x-3 px-10 py-5 bg-amber-50 text-amber-600 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-amber-100 transition-all border border-amber-100"
                        >
                          <RefreshCw className="w-5 h-5" />
                          <span>Return Order</span>
                        </motion.button>
                      )}
                      {order.status === 'return_requested' && (
                        <div className="flex items-center space-x-3 px-6 py-4 bg-orange-50 text-orange-600 rounded-2xl border border-orange-100">
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          <span className="text-xs font-black uppercase tracking-wider">Return Under Review</span>
                        </div>
                      )}
                      {order.status === 'returned' && (
                        <div className="flex items-center space-x-3 px-6 py-4 bg-green-50 text-green-600 rounded-2xl border border-green-100">
                          <CheckCircle2 className="w-5 h-5" />
                          <span className="text-xs font-black uppercase tracking-wider">Refund Credited</span>
                        </div>
                      )}
                      {order.status === 'pending' && (
                        <div className="flex-1">
                          {cancellingOrderId === order.id ? (
                            <div className="flex items-center space-x-4">
                              <button 
                                onClick={() => handleCancelOrder(order.id)}
                                className="px-8 py-4 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100"
                              >
                                Confirm Cancel
                              </button>
                              <button 
                                onClick={() => setCancellingOrderId(null)}
                                className="px-8 py-4 bg-gray-100 text-gray-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-gray-200 transition-all"
                              >
                                Keep Order
                              </button>
                            </div>
                          ) : (
                            <motion.button 
                              whileHover={{ scale: 1.05, y: -2 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setCancellingOrderId(order.id)}
                              className="flex items-center space-x-3 px-10 py-5 bg-red-50 text-red-600 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-red-100 transition-all border border-red-100"
                            >
                              <XCircle className="w-5 h-5" />
                              <span>Cancel Order</span>
                            </motion.button>
                          )}
                        </div>
                      )}
                      {!order.deliveryBoyId && order.status !== 'cancelled' && (
                        <div className="flex items-center space-x-4 glass-surface p-6 rounded-2xl border-amber-100/50 bg-amber-50/20">
                          <Clock className="w-5 h-5 text-amber-500 animate-pulse" />
                          <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Awaiting delivery assignment</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
      </div>

      {/* Receipt Modal */}
      {receiptOrder && (
        <Receipt
          order={receiptOrder}
          sellerName={sellerInfo[receiptOrder.sellerId]?.name}
          sellerEmail={sellerInfo[receiptOrder.sellerId]?.email}
          sellerPhone={sellerInfo[receiptOrder.sellerId]?.phone}
          onClose={() => setReceiptOrder(null)}
          type={receiptOrder.status === 'delivered' ? 'receipt' : 'invoice'}
        />
      )}

      {/* Return Request Modal */}
      <AnimatePresence>
        {showReturnModal && returnOrderTarget && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowReturnModal(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[2rem] p-8 max-w-lg w-full shadow-2xl"
            >
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center">
                  <RefreshCw className="w-7 h-7 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">Return Request</h2>
                  <p className="text-gray-400 text-sm">Order #{returnOrderTarget.id.slice(-8).toUpperCase()}</p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Order Summary */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Order Items</p>
                  {returnOrderTarget.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-700">{item.title} × {item.quantity}</span>
                      <span className="font-bold text-gray-900">₹{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between">
                    <span className="font-bold text-gray-700">Total Refund</span>
                    <span className="font-black text-emerald-600">₹{returnOrderTarget.totalAmount.toFixed(2)}</span>
                  </div>
                </div>

                {/* Reason Selection */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                    Reason for Return <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl font-medium focus:bg-white focus:border-amber-300 focus:ring-4 focus:ring-amber-50 outline-none transition-all"
                  >
                    <option value="">Select a reason</option>
                    {RETURN_REASONS.map(reason => (
                      <option key={reason} value={reason}>{reason}</option>
                    ))}
                  </select>
                </div>

                {/* Additional Details */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                    Additional Details (Optional)
                  </label>
                  <textarea
                    value={returnDescription}
                    onChange={(e) => setReturnDescription(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl font-medium focus:bg-white focus:border-amber-300 focus:ring-4 focus:ring-amber-50 outline-none transition-all resize-none"
                    rows={3}
                    placeholder="Please describe the issue in detail..."
                  />
                </div>

                {/* Refund Info */}
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                  <p className="text-sm text-emerald-800 font-medium">
                    <strong>Refund Policy:</strong> Once your return request is approved, the full amount (₹{returnOrderTarget.totalAmount.toFixed(2)}) will be credited to your wallet within 24-48 hours.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-2">
                  <button
                    onClick={() => setShowReturnModal(false)}
                    className="flex-1 py-4 px-6 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSubmitReturnRequest}
                    disabled={!returnReason || processingReturn}
                    className="flex-1 py-4 px-6 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processingReturn ? 'Submitting...' : 'Submit Request'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OrderHistory;
