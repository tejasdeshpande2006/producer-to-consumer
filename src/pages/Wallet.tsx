import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, orderBy, onSnapshot, runTransaction, doc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, toDate } from '../firebase';
import { CreditCard, Plus, ArrowUpRight, ArrowDownLeft, History, Wallet as WalletIcon, Search, X, CheckCircle2 } from 'lucide-react';
import { WalletTransaction } from '../types';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';

const WalletPage: React.FC = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const upiId = "vpk525252@okaxis"; // Placeholder UPI ID
  const upiName = "Producer To Consumer App";
  const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${amount}&cu=INR`;

  useEffect(() => {
    if (!user) return;
    const path = `users/${user.uid}/walletTransactions`;
    const q = query(collection(db, path), orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WalletTransaction)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    
    return () => unsubscribe();
  }, [user]);

  const handleAddMoney = async () => {
    if (!user || !profile || !amount || isNaN(Number(amount))) return;
    const addAmount = Number(amount);
    if (addAmount <= 0) return;

    setShowQRModal(true);
  };

  const confirmPayment = async () => {
    if (!user || !profile || !amount) return;
    const addAmount = Number(amount);

    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const transactionRef = doc(collection(userRef, 'walletTransactions'));
      
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw new Error("User profile does not exist!");
        }

        const currentBalance = userDoc.data().walletBalance || 0;
        const newBalance = currentBalance + addAmount;

        transaction.update(userRef, { 
          walletBalance: newBalance 
        });

        transaction.set(transactionRef, {
          amount: addAmount,
          type: 'credit',
          timestamp: serverTimestamp(),
          description: 'Money Added via UPI'
        });
      });
      
      setPaymentSuccess(true);
      setTimeout(() => {
        setShowQRModal(false);
        setPaymentSuccess(false);
        setAmount('');
      }, 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(tx => 
    tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tx.amount.toString().includes(searchQuery)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="max-w-4xl mx-auto space-y-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Balance Card */}
          <div className="md:col-span-2 rounded-[2rem] bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 p-12 text-white relative overflow-hidden shadow-2xl shadow-indigo-300/50 group border border-indigo-500/30">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-16">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-2xl rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500 border border-white/30">
                    <WalletIcon className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <span className="font-display font-black text-xl text-white tracking-tighter uppercase">Total Balance</span>
                    <p className="text-[10px] font-black text-white/70 uppercase tracking-[0.3em] mt-1">Digital Assets</p>
                  </div>
                </div>
                <CreditCard className="w-12 h-12 text-white/40 group-hover:text-white/60 transition-opacity" />
              </div>
              <div className="space-y-4">
                <div className="flex items-baseline space-x-3">
                  <span className="text-2xl font-black text-white/70">₹</span>
                  <span className="text-8xl font-black tracking-tighter font-display text-white drop-shadow-lg">{profile?.walletBalance?.toFixed(2) || '0.00'}</span>
                </div>
                <p className="text-white/80 text-xs font-black uppercase tracking-[0.4em]">Available for purchases</p>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-48 -mt-48 blur-3xl group-hover:scale-110 transition-transform duration-1000" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-400/30 rounded-full -ml-48 -mb-48 blur-3xl group-hover:scale-110 transition-transform duration-1000" />
          </div>

          {/* Quick Add */}
          <div className="glossy-card p-10 group border-white/40">
            <h3 className="text-2xl font-black text-gray-900 mb-8 font-display tracking-tighter uppercase">Add Funds<span className="text-indigo-600">.</span></h3>
            <div className="space-y-8">
              <div className="relative group/input">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 font-black text-2xl group-focus-within/input:text-indigo-600 transition-colors">₹</span>
                <input 
                  type="number" 
                  placeholder="0.00"
                  className="w-full pl-12 pr-6 py-6 bg-gray-50/50 border-2 border-transparent rounded-3xl focus:bg-white focus:border-indigo-600 outline-none font-black text-3xl text-gray-900 transition-all shadow-inner"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <motion.button 
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleAddMoney}
                disabled={loading || !amount || Number(amount) <= 0}
                className="w-full py-6 glossy-button rounded-2xl font-black uppercase tracking-[0.2em] text-sm flex items-center justify-center space-x-3 disabled:opacity-50 disabled:scale-100"
              >
                <Plus className="w-6 h-6" />
                <span>{loading ? 'Processing...' : 'Add Money'}</span>
              </motion.button>
              <div className="flex items-center justify-center space-x-4">
                <div className="h-px flex-1 bg-gray-100" />
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.4em]">Scan QR</p>
                <div className="h-px flex-1 bg-gray-100" />
              </div>
            </div>
          </div>
        </div>

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQRModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="bg-white rounded-[3rem] p-12 max-w-lg w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600" />
              <button 
                onClick={() => setShowQRModal(false)}
                className="absolute top-8 right-8 p-3 hover:bg-gray-100 rounded-2xl transition-all group"
              >
                <X className="w-6 h-6 text-gray-400 group-hover:rotate-90 transition-transform" />
              </button>

              <div className="text-center space-y-10">
                <div className="space-y-3">
                  <h2 className="text-4xl font-black text-gray-900 tracking-tighter font-display uppercase">Scan to Pay<span className="text-indigo-600">.</span></h2>
                  <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">Scan this QR code with any UPI app</p>
                </div>

                <div className="bg-gray-50 p-10 rounded-[2.5rem] flex flex-col items-center justify-center space-y-8 border border-gray-100 shadow-inner">
                  <div className="bg-white p-6 rounded-3xl shadow-2xl border border-gray-100 group hover:scale-105 transition-transform duration-500">
                    <QRCodeSVG 
                      value={upiUrl} 
                      size={240}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <div className="text-center">
                    <div className="flex items-baseline justify-center space-x-2">
                      <span className="text-xl font-black text-indigo-600">₹</span>
                      <span className="text-5xl font-black text-gray-900 tracking-tighter font-display">{Number(amount).toFixed(2)}</span>
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-2">Payable Amount</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-center space-x-6">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/UPI-Logo.png/640px-UPI-Logo.png" alt="UPI" className="h-6 object-contain opacity-40 grayscale hover:grayscale-0 transition-all" />
                    <div className="h-6 w-px bg-gray-200" />
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Secure UPI Gateway</p>
                  </div>

                  {paymentSuccess ? (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center space-y-4 text-green-600"
                    >
                      <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-12 h-12" />
                      </div>
                      <p className="font-black uppercase tracking-widest text-sm">Payment Successful!</p>
                    </motion.div>
                  ) : (
                    <motion.button 
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={confirmPayment}
                      disabled={loading}
                      className="w-full py-6 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-100 flex items-center justify-center space-x-3"
                    >
                      {loading ? (
                        <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>I have completed the payment</span>
                        </>
                      )}
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Recent Transactions */}
      <div className="bg-white rounded-[3rem] border border-gray-100 shadow-2xl shadow-gray-100/50 overflow-hidden">
        <div className="p-10 border-b border-gray-50 flex flex-col lg:flex-row lg:items-center justify-between gap-8 bg-gray-50/30">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-xl border border-gray-100">
              <History className="w-6 h-6 text-gray-400" />
            </div>
            <div>
              <h3 className="font-black text-gray-900 text-xl tracking-tighter uppercase">Recent Activity</h3>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Wallet Transactions</p>
            </div>
          </div>
          
          <div className="flex flex-1 max-w-2xl items-center space-x-6">
            <div className="relative flex-1 group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
              <input 
                type="text"
                placeholder="Search transactions..."
                className="w-full pl-14 pr-6 py-4 bg-white border border-gray-100 rounded-2xl focus:ring-4 focus:ring-indigo-50 focus:border-indigo-100 outline-none text-sm font-bold transition-all shadow-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <motion.button 
              whileHover={{ x: 4 }}
              onClick={() => navigate('/wallet/history')}
              className="text-xs font-black text-indigo-600 hover:text-indigo-700 whitespace-nowrap uppercase tracking-[0.2em] flex items-center space-x-2"
            >
              <span>View All</span>
              <ArrowUpRight className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
        <div className="divide-y divide-gray-50">
          {filteredTransactions.length > 0 ? (
            filteredTransactions.map((tx, i) => (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                key={tx.id} 
                className="p-10 flex items-center justify-between hover:bg-gray-50/50 transition-all group"
              >
                <div className="flex items-center space-x-6">
                  <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-xl transition-transform group-hover:scale-110 ${
                    tx.type === 'credit' ? 'bg-green-50 shadow-green-100/50' : 'bg-red-50 shadow-red-100/50'
                  }`}>
                    {tx.type === 'credit' ? (
                      <ArrowUpRight className="text-green-600 w-8 h-8" />
                    ) : (
                      <ArrowDownLeft className="text-red-600 w-8 h-8" />
                    )}
                  </div>
                  <div>
                    <p className="font-black text-gray-900 text-lg tracking-tight uppercase">{tx.description}</p>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">
                      {toDate(tx.timestamp)?.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) || 'Processing...'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`flex items-baseline justify-end space-x-1 font-display font-black text-3xl tracking-tighter ${
                    tx.type === 'credit' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    <span>{tx.type === 'credit' ? '+' : '-'}</span>
                    <span className="text-sm">₹</span>
                    <span>{tx.amount.toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] text-gray-300 font-black uppercase tracking-widest mt-1">Transaction ID: {tx.id.slice(0, 8)}</p>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="p-24 text-center">
              <div className="w-24 h-24 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <WalletIcon className="w-10 h-10 text-gray-200" />
              </div>
              <p className="text-gray-400 font-bold text-xl uppercase tracking-tighter">No transactions yet</p>
              <p className="text-gray-300 font-medium text-sm mt-2">Add some funds to get started!</p>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};

export default WalletPage;
