import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Product, WishlistItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, ShoppingCart, Trash2, ArrowLeft, Package } from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';

const Wishlist: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const wishlistRef = collection(db, 'users', user.uid, 'wishlist');
    const unsubscribe = onSnapshot(wishlistRef, async (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WishlistItem));
      setWishlistItems(items);

      const productPromises = items.map(async (item) => {
        const prodSnap = await getDoc(doc(db, 'products', item.productId));
        if (prodSnap.exists()) {
          return { id: prodSnap.id, ...prodSnap.data() } as Product;
        }
        return null;
      });

      const fetchedProducts = (await Promise.all(productPromises)).filter(Boolean) as Product[];
      setProducts(fetchedProducts);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/wishlist`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const removeFromWishlist = async (wishlistId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'wishlist', wishlistId));
    } catch (error) {
      console.error('Error removing from wishlist:', error);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen space-y-6">
      <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-xs font-black text-gray-400 uppercase tracking-[0.4em] animate-pulse">Syncing Wishlist...</p>
    </div>
  );

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
              whileHover={{ scale: 1.1, rotate: -10 }}
              className="w-24 h-24 bg-red-50 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-red-100/50 group border-4 border-white"
            >
              <Heart className="text-red-500 w-12 h-12 fill-red-500 group-hover:scale-110 transition-transform" />
            </motion.div>
            <div>
              <h1 className="text-7xl font-black text-gray-900 tracking-tighter font-display uppercase leading-none">Wishlist<span className="text-red-500">.</span></h1>
              <p className="text-gray-400 font-bold text-sm uppercase tracking-[0.4em] mt-3">Items you've saved for later</p>
            </div>
          </div>
          <motion.button 
            whileHover={{ x: -8, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/')}
            className="flex items-center space-x-6 text-indigo-600 font-black text-xs uppercase tracking-[0.3em] hover:text-indigo-700 transition-all group glass-surface px-12 py-6 rounded-2xl border-white/60 shadow-xl"
          >
            <ArrowLeft className="w-6 h-6 group-hover:-translate-x-2 transition-transform" />
            <span>Continue Shopping</span>
          </motion.button>
        </div>

        {products.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-64 bg-white rounded-[4rem] border-2 border-dashed border-gray-100 shadow-2xl shadow-gray-50/50 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-red-50/30 to-transparent pointer-events-none" />
            <div className="w-40 h-40 bg-gray-50 rounded-[3rem] flex items-center justify-center mx-auto mb-10 group hover:rotate-12 transition-transform duration-500 relative z-10">
              <Heart className="w-16 h-16 text-gray-200 group-hover:text-red-200 transition-colors" />
            </div>
            <h2 className="text-5xl font-black text-gray-900 mb-6 uppercase tracking-tighter font-display relative z-10">Your wishlist is empty</h2>
            <p className="text-gray-400 font-bold text-xl mb-14 max-w-md mx-auto relative z-10">Start adding items you love to your wishlist and they'll appear here!</p>
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
          <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            <AnimatePresence mode="popLayout">
              {products.map((product, i) => {
                const wishlistItem = wishlistItems.find(item => item.productId === product.id);
                return (
                  <motion.div 
                    layout
                    key={product.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5, rotate: -10 }}
                    transition={{ delay: i * 0.1 }}
                    className="glossy-card group border-white/40 shadow-2xl shadow-gray-100/50"
                  >
                    <div className="aspect-square relative overflow-hidden bg-gray-50">
                      <motion.img 
                        whileHover={{ scale: 1.1 }}
                        transition={{ duration: 0.8 }}
                        src={product.images[0] || `https://picsum.photos/seed/${product.id}/400/400`} 
                        alt={product.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <motion.button 
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => wishlistItem && removeFromWishlist(wishlistItem.id)}
                        className="absolute top-8 right-8 p-5 bg-white/90 backdrop-blur-xl rounded-2xl text-red-500 shadow-2xl opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 border border-white/40"
                      >
                        <Trash2 className="w-7 h-7" />
                      </motion.button>
                    </div>
                    <div className="p-12 space-y-10">
                      <div className="space-y-3">
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.5em]">{product.category}</span>
                        <h3 className="text-3xl font-black text-gray-900 line-clamp-1 group-hover:text-indigo-600 transition-colors font-display tracking-tighter uppercase leading-tight">{product.title}</h3>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-baseline space-x-1">
                          <span className="text-xs font-black text-gray-400">₹</span>
                          <span className="text-5xl font-black text-gray-900 tracking-tighter font-display">{product.price.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center space-x-5">
                          <motion.button 
                            whileHover={{ scale: 1.1, y: -2 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => navigate(`/product/${product.id}`)}
                            className="w-16 h-16 bg-gray-50 text-gray-600 rounded-2xl hover:bg-gray-100 transition-colors border border-gray-100 shadow-xl flex items-center justify-center"
                          >
                            <Package className="w-7 h-7" />
                          </motion.button>
                          <motion.button 
                            whileHover={{ scale: 1.1, y: -2 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => navigate(`/product/${product.id}`)}
                            className="w-16 h-16 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-100 border border-indigo-500 flex items-center justify-center"
                          >
                            <ShoppingCart className="w-7 h-7" />
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default Wishlist;
