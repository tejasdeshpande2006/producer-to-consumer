import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, toDate } from '../firebase';
import { History, ArrowUpRight, ArrowDownLeft, ChevronLeft, Search } from 'lucide-react';
import { WalletTransaction } from '../types';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';

const TransactionHistory: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!user) return;
    const path = `users/${user.uid}/walletTransactions`;
    const q = query(collection(db, path), orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WalletTransaction)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [user]);

  const filteredTransactions = transactions.filter(tx => 
    tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tx.amount.toString().includes(searchQuery)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="max-w-4xl mx-auto space-y-16">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-10">
        <div className="flex items-center space-x-8">
          <motion.button 
            whileHover={{ scale: 1.1, x: -4 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/wallet')}
            className="w-16 h-16 glass-surface border-white/60 rounded-2xl flex items-center justify-center shadow-xl hover:bg-white transition-all"
          >
            <ChevronLeft className="w-8 h-8 text-gray-600" />
          </motion.button>
          <div>
            <h1 className="text-7xl font-black text-gray-900 tracking-tighter font-display uppercase leading-none">History<span className="text-indigo-600">.</span></h1>
            <p className="text-gray-400 font-bold text-sm uppercase tracking-[0.4em] mt-3">Full record of your wallet activity</p>
          </div>
        </div>
        <motion.div 
          whileHover={{ rotate: 15, scale: 1.1 }}
          className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-indigo-200/50 border-4 border-white"
        >
          <History className="text-white w-12 h-12" />
        </motion.div>
      </div>

      <div className="relative group">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
        <input 
          type="text"
          placeholder="Search all transactions by description or amount..."
          className="w-full pl-16 pr-8 py-6 bg-white border border-gray-100 rounded-[2rem] shadow-2xl shadow-gray-100/50 focus:ring-8 focus:ring-indigo-50 focus:border-indigo-100 outline-none font-bold text-lg transition-all"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-[3rem] border border-gray-100 shadow-2xl shadow-gray-100/50 overflow-hidden">
        <div className="divide-y divide-gray-50">
          {filteredTransactions.length > 0 ? (
            filteredTransactions.map((tx, i) => (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                key={tx.id} 
                className="p-10 flex items-center justify-between hover:bg-gray-50/50 transition-all group"
              >
                <div className="flex items-center space-x-8">
                  <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-2xl transition-transform group-hover:scale-110 ${
                    tx.type === 'credit' ? 'bg-green-50 shadow-green-100/50' : 'bg-red-50 shadow-red-100/50'
                  }`}>
                    {tx.type === 'credit' ? (
                      <ArrowUpRight className="text-green-600 w-10 h-10" />
                    ) : (
                      <ArrowDownLeft className="text-red-600 w-10 h-10" />
                    )}
                  </div>
                  <div>
                    <p className="font-black text-gray-900 text-2xl tracking-tight uppercase">{tx.description}</p>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.3em] mt-2">
                      {toDate(tx.timestamp)?.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) || 'Processing...'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`flex items-baseline justify-end space-x-1 font-display font-black text-4xl tracking-tighter ${
                    tx.type === 'credit' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    <span>{tx.type === 'credit' ? '+' : '-'}</span>
                    <span className="text-lg">₹</span>
                    <span>{tx.amount.toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] text-gray-300 font-black uppercase tracking-widest mt-2">
                    Transaction ID: {tx.id.toUpperCase()}
                  </p>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="p-32 text-center">
              <div className="w-32 h-32 bg-gray-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 group hover:rotate-12 transition-transform duration-500">
                <History className="w-16 h-16 text-gray-200 group-hover:text-indigo-200 transition-colors" />
              </div>
              <h2 className="text-4xl font-black text-gray-900 mb-4 uppercase tracking-tighter font-display">No records found</h2>
              <p className="text-gray-400 font-bold text-lg">Try searching for something else or check back later.</p>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};

export default TransactionHistory;
