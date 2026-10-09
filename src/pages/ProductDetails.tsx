import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, serverTimestamp, updateDoc, increment, onSnapshot, query, orderBy, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, toDate } from '../firebase';
import { Product, Review } from '../types';
import { useAuth } from '../context/AuthContext';
import { ShoppingCart, ArrowLeft, ShieldCheck, Truck, Star, Heart, Send, User, CheckCircle, Trash2, MessageCircle, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';

const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [hoveredStar, setHoveredStar] = useState(0);
  const [isVerifiedBuyer, setIsVerifiedBuyer] = useState(false);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [wishlistId, setWishlistId] = useState<string | null>(null);
  const [sellerName, setSellerName] = useState<string>('');

  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => {
    setSelectedImage(0);
  }, [id]);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      const docSnap = await getDoc(doc(db, 'products', id));
      if (docSnap.exists()) {
        setProduct({ id: docSnap.id, ...docSnap.data() } as Product);
      }
      setLoading(false);
    };
    fetchProduct();
  }, [id]);

  useEffect(() => {
    const fetchSellerName = async () => {
      if (product?.sellerId) {
        try {
          const sellerDoc = await getDoc(doc(db, 'users', product.sellerId));
          if (sellerDoc.exists()) {
            setSellerName(sellerDoc.data().name);
          }
        } catch (error) {
          console.error("Error fetching seller name:", error);
        }
      }
    };
    fetchSellerName();
  }, [product?.sellerId]);

  useEffect(() => {
    const checkVerifiedBuyer = async () => {
      if (!user || !id) return;
      const q = query(
        collection(db, 'orders'),
        where('buyerId', '==', user.uid),
        where('status', '==', 'delivered')
      );
      const snapshot = await getDocs(q);
      const hasPurchased = snapshot.docs.some(doc => {
        const orderData = doc.data();
        return orderData.items.some((item: any) => item.productId === id);
      });
      setIsVerifiedBuyer(hasPurchased);
    };
    checkVerifiedBuyer();
  }, [user, id]);

  useEffect(() => {
    const checkWishlist = async () => {
      if (!user || !id) return;
      const wishlistRef = collection(db, 'users', user.uid, 'wishlist');
      const q = query(wishlistRef, where('productId', '==', id));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          setIsInWishlist(true);
          setWishlistId(snapshot.docs[0].id);
        } else {
          setIsInWishlist(false);
          setWishlistId(null);
        }
      });
      return () => unsubscribe();
    };
    checkWishlist();
  }, [user, id]);

  useEffect(() => {
    if (!id) return;
    const reviewsRef = collection(db, 'products', id, 'reviews');
    const q = query(reviewsRef, orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReviews(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `products/${id}/reviews`);
    });
    return () => unsubscribe();
  }, [id]);

  const addToCart = async () => {
    if (!user || !product) {
      navigate('/login');
      return;
    }
    setAdding(true);
    try {
      // Check if product already exists in cart
      const cartRef = collection(db, 'users', user.uid, 'cart');
      const q = query(cartRef, where('productId', '==', product.id));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // Update existing item quantity
        const cartItemDoc = querySnapshot.docs[0];
        const existingQuantity = cartItemDoc.data().quantity || 0;
        await updateDoc(doc(db, 'users', user.uid, 'cart', cartItemDoc.id), {
          quantity: existingQuantity + quantity
        });
      } else {
        // Add new item to cart (price includes 5% platform fee)
        await addDoc(cartRef, {
          productId: product.id,
          title: product.title,
          price: product.price * 1.05,
          quantity: quantity,
          image: product.images[0],
          sellerId: product.sellerId,
          timestamp: serverTimestamp()
        });
      }
      navigate('/cart');
    } catch (error) {
      console.error('Cart error:', error);
    } finally {
      setAdding(false);
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !id) return;
    setSubmittingReview(true);
    try {
      const reviewsRef = collection(db, 'products', id, 'reviews');
      await addDoc(reviewsRef, {
        userId: user.uid,
        userName: profile.name,
        rating: newReview.rating,
        comment: newReview.comment,
        timestamp: serverTimestamp()
      });
      setNewReview({ rating: 5, comment: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `products/${id}/reviews`);
    } finally {
      setSubmittingReview(false);
    }
  };

  const deleteReview = async (reviewId: string) => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'products', id, 'reviews', reviewId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${id}/reviews/${reviewId}`);
    }
  };

  const toggleWishlist = async () => {
    if (!user || !id) {
      navigate('/login');
      return;
    }
    try {
      const wishlistRef = collection(db, 'users', user.uid, 'wishlist');
      if (isInWishlist && wishlistId) {
        await deleteDoc(doc(db, 'users', user.uid, 'wishlist', wishlistId));
      } else {
        await addDoc(wishlistRef, {
          userId: user.uid,
          productId: id,
          timestamp: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Wishlist error:', error);
    }
  };

  const averageRating = reviews.length > 0 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : 'New';

  const ratingBreakdown = [5, 4, 3, 2, 1].map(star => {
    const count = reviews.filter(r => r.rating === star).length;
    const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
    return { star, count, percentage };
  });

  if (loading) return <div className="flex items-center justify-center h-64">Loading...</div>;
  if (!product) return <div className="text-center py-20">Product not found.</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-100 rounded-full blur-[120px] opacity-30" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-100 rounded-full blur-[120px] opacity-30" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-7xl mx-auto space-y-12 relative z-10"
      >
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center space-x-3 text-gray-400 hover:text-indigo-600 transition-all font-black text-[10px] uppercase tracking-[0.3em] group bg-white/50 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/20 shadow-sm w-fit"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Browse</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Images Section */}
          <div className="space-y-8">
            <motion.div 
              layoutId={`product-image-${product.id}`}
              className="relative aspect-square rounded-[3rem] overflow-hidden glossy-card group shadow-2xl shadow-indigo-100/50"
            >
              <AnimatePresence mode="wait">
                <motion.img 
                  key={selectedImage}
                  initial={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
                  transition={{ duration: 0.5, ease: "circOut" }}
                  src={product.images[selectedImage] || `https://picsum.photos/seed/${product.id}/800/800`} 
                  alt={product.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </AnimatePresence>
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              {product.images.length > 1 && (
                <>
                  <motion.button 
                    whileHover={{ scale: 1.1, x: -5 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setSelectedImage((prev) => (prev === 0 ? product.images.length - 1 : prev - 1))}
                    className="absolute left-8 top-1/2 -translate-y-1/2 p-5 bg-white/90 backdrop-blur-2xl rounded-[1.5rem] text-gray-900 shadow-2xl opacity-0 group-hover:opacity-100 transition-all hover:bg-white border border-white/50"
                  >
                    <ArrowLeft className="w-6 h-6" />
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.1, x: 5 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setSelectedImage((prev) => (prev === product.images.length - 1 ? 0 : prev + 1))}
                    className="absolute right-8 top-1/2 -translate-y-1/2 p-5 bg-white/90 backdrop-blur-2xl rounded-[1.5rem] text-gray-900 shadow-2xl opacity-0 group-hover:opacity-100 transition-all hover:bg-white rotate-180 border border-white/50"
                  >
                    <ArrowLeft className="w-6 h-6" />
                  </motion.button>
                </>
              )}

              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex space-x-3 bg-black/20 backdrop-blur-md px-4 py-2 rounded-full">
                {product.images.map((_, i) => (
                  <motion.div 
                    key={i}
                    animate={{ 
                      width: selectedImage === i ? 32 : 8,
                      backgroundColor: selectedImage === i ? '#ffffff' : 'rgba(255,255,255,0.4)'
                    }}
                    className="h-2 rounded-full cursor-pointer"
                    onClick={() => setSelectedImage(i)}
                  />
                ))}
              </div>
            </motion.div>

            {product.images.length > 1 && (
              <div className="flex items-center space-x-6 overflow-x-auto pb-6 no-scrollbar px-2">
                {product.images.map((img, i) => (
                  <motion.div 
                    key={i} 
                    whileHover={{ scale: 1.1, y: -5 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedImage(i)}
                    className={`flex-shrink-0 w-28 h-28 rounded-[2rem] overflow-hidden bg-white cursor-pointer transition-all border-4 shadow-lg ${
                      selectedImage === i ? 'border-indigo-500 shadow-indigo-200 scale-110' : 'border-transparent hover:border-indigo-200'
                    }`}
                  >
                    <img 
                      src={img} 
                      alt={`Gallery ${i}`} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </motion.div>
                ))}
              </div>
            )}

            {product.videoUrl && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="mt-12 space-y-6"
              >
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] px-2">Product Showcase</h3>
                <div className="aspect-video rounded-[2.5rem] overflow-hidden bg-black shadow-2xl border-8 border-white group relative">
                  <video 
                    src={product.videoUrl} 
                    controls 
                    className="w-full h-full object-contain"
                    poster={product.images[0]}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              </motion.div>
            )}
          </div>

          {/* Product Info Section */}
          <div className="space-y-10 py-4">
            <div className="space-y-6">
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="flex items-center space-x-4"
              >
                <span className="px-6 py-2 bg-indigo-600 text-white text-[10px] font-black rounded-full uppercase tracking-[0.3em] shadow-lg shadow-indigo-200">{product.category}</span>
                <div className="flex items-center space-x-2 text-yellow-500 bg-white px-4 py-2 rounded-full border border-gray-100 shadow-sm">
                  <Star className="w-4 h-4 fill-yellow-500" />
                  <span className="text-sm font-black text-gray-900">{averageRating}</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{reviews.length} Reviews</span>
                </div>
              </motion.div>

              <motion.h1 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="text-6xl font-black text-gray-900 tracking-tighter leading-[0.9] uppercase"
              >
                {product.title}
              </motion.h1>

              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-4"
              >
                <p className="text-gray-500 text-xl leading-relaxed font-medium max-w-xl">
                  {product.description || 'Experience the best quality with our handpicked products delivered straight from the producer to your doorstep.'}
                </p>
                {sellerName && (
                  <div className="flex items-center space-x-3 bg-white/50 backdrop-blur-md p-4 rounded-2xl border border-white/20 w-fit">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-black">
                      {sellerName[0]}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sold by</p>
                      <p className="text-sm font-black text-gray-900">{sellerName}</p>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
              className="flex items-baseline space-x-6 bg-white/50 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/20 shadow-sm w-fit"
            >
              <span className="text-7xl font-black text-gray-900 tracking-tighter">₹{(product.price * 1.05).toLocaleString()}</span>
              <span className="text-2xl text-gray-300 font-bold line-through decoration-red-500/40 decoration-4">₹{(product.price * 1.25).toLocaleString()}</span>
            </motion.div>

            <div className="grid grid-cols-2 gap-6">
              {[
                { icon: ShieldCheck, label: 'Verified', value: sellerName || 'Producer', color: 'green' },
                { icon: Truck, label: 'Fast', value: 'Delivery', color: 'blue' }
              ].map((item, i) => (
                <motion.div 
                  key={i}
                  whileHover={{ y: -8, scale: 1.02 }}
                  className={`p-8 bg-white rounded-[2rem] border border-gray-100 shadow-sm flex items-center space-x-6 group transition-all hover:shadow-2xl hover:shadow-${item.color}-100/50`}
                >
                  <div className={`w-16 h-16 bg-${item.color}-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <item.icon className={`text-${item.color}-600 w-8 h-8`} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">{item.label}</p>
                    <p className="text-lg font-black text-gray-900 leading-tight">{item.value}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Quantity Selector */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className="space-y-6 bg-white/50 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/20 shadow-sm"
            >
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Select Quantity</h3>
              <div className="flex items-center space-x-8">
                <div className="flex items-center space-x-4 bg-white p-2 rounded-2xl shadow-inner border border-gray-100">
                  <motion.button 
                    whileHover={{ scale: 1.1, backgroundColor: '#f3f4f6' }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-14 h-14 flex items-center justify-center text-gray-600 rounded-xl transition-all"
                  >
                    <Minus className="w-6 h-6" />
                  </motion.button>
                  <span className="text-2xl font-black text-gray-900 w-12 text-center">{quantity}</span>
                  <motion.button 
                    whileHover={{ scale: 1.1, backgroundColor: '#f3f4f6' }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    className="w-14 h-14 flex items-center justify-center text-gray-600 rounded-xl transition-all"
                  >
                    <Plus className="w-6 h-6" />
                  </motion.button>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Availability</span>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${product.stock > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-sm font-black text-gray-700">{product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}</span>
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="flex items-center space-x-6 pt-4">
              <motion.button 
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={addToCart}
                disabled={adding || product.stock === 0}
                className="flex-1 flex items-center justify-center space-x-4 glossy-button py-6 rounded-[2rem] font-black text-2xl disabled:opacity-50 shadow-2xl shadow-indigo-200"
              >
                <ShoppingCart className="w-8 h-8" />
                <span>{adding ? 'Adding...' : 'Add to Cart'}</span>
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.1, y: -4 }}
                whileTap={{ scale: 0.9 }}
                onClick={toggleWishlist}
                className={`p-6 border-2 rounded-[2rem] transition-all shadow-xl ${
                  isInWishlist 
                    ? 'bg-red-500 border-red-500 text-white shadow-red-200' 
                    : 'bg-white border-gray-100 text-gray-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50'
                }`}
              >
                <Heart className={`w-8 h-8 ${isInWishlist ? 'fill-white' : ''}`} />
              </motion.button>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="pt-24 border-t border-gray-100">
          <div className="flex flex-col lg:flex-row gap-16">
            {/* Review Summary */}
            <div className="lg:w-1/3 space-y-8">
              <div className="space-y-2">
                <h2 className="text-4xl font-black text-gray-900 tracking-tighter uppercase">Reviews<span className="text-indigo-600">.</span></h2>
                <p className="text-gray-400 font-bold text-xs uppercase tracking-[0.3em]">What our customers say</p>
              </div>
              
              <div className="glossy-card p-10 space-y-8 shadow-2xl shadow-indigo-100/30">
                <div className="text-center space-y-4">
                  <p className="text-7xl font-black text-gray-900 tracking-tighter leading-none">{averageRating}</p>
                  <div className="flex justify-center space-x-1 text-yellow-500">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-6 h-6 ${
                          star <= Math.round(Number(averageRating)) ? 'fill-yellow-500' : 'text-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">{reviews.length} Verified Reviews</p>
                </div>

                <div className="space-y-4">
                  {ratingBreakdown.map(({ star, percentage, count }) => (
                    <div key={star} className="flex items-center space-x-6">
                      <div className="flex items-center space-x-1 w-8">
                        <span className="text-xs font-black text-gray-900">{star}</span>
                        <Star className="w-3 h-3 fill-gray-400 text-gray-400" />
                      </div>
                      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          whileInView={{ width: `${percentage}%` }}
                          transition={{ duration: 1, ease: "circOut" }}
                          className="h-full bg-indigo-600 rounded-full" 
                        />
                      </div>
                      <span className="text-[10px] font-black text-gray-400 w-8 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Review List & Form */}
            <div className="flex-1 space-y-12">
              {user ? (
                <motion.form 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  onSubmit={submitReview} 
                  className="glossy-card p-10 space-y-8 shadow-2xl shadow-indigo-100/30"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-widest">Write a Review</h3>
                    {isVerifiedBuyer && (
                      <div className="flex items-center space-x-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Verified Buyer</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Overall Rating</p>
                    <div className="flex items-center space-x-4">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <motion.button
                          key={star}
                          type="button"
                          whileHover={{ scale: 1.2, rotate: 15 }}
                          whileTap={{ scale: 0.9 }}
                          onMouseEnter={() => setHoveredStar(star)}
                          onMouseLeave={() => setHoveredStar(0)}
                          onClick={() => setNewReview({ ...newReview, rating: star })}
                          className="focus:outline-none"
                        >
                          <Star
                            className={`w-12 h-12 transition-all duration-300 ${
                              star <= (hoveredStar || newReview.rating) 
                                ? 'fill-yellow-500 text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.4)]' 
                                : 'text-gray-200'
                            }`}
                          />
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Your Experience</p>
                    <textarea
                      required
                      value={newReview.comment}
                      onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                      placeholder="Tell us about the quality, delivery, or anything else..."
                      className="w-full px-8 py-8 bg-gray-50/50 border-2 border-transparent rounded-[2rem] focus:bg-white focus:border-indigo-600 outline-none transition-all font-bold text-gray-900 placeholder:text-gray-300 min-h-[180px] resize-none"
                    />
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={submittingReview}
                    className="w-full flex items-center justify-center space-x-4 glossy-button py-6 rounded-[2rem] font-black text-xl disabled:opacity-50 shadow-xl shadow-indigo-100"
                  >
                    <Send className="w-6 h-6" />
                    <span>{submittingReview ? 'Posting...' : 'Post Review'}</span>
                  </motion.button>
                </motion.form>
              ) : (
                <div className="glossy-card p-12 text-center space-y-6">
                  <div className="w-20 h-20 bg-gray-50 rounded-[2rem] flex items-center justify-center mx-auto">
                    <User className="w-10 h-10 text-gray-300" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xl font-black text-gray-900 uppercase tracking-tight">Join the Conversation</p>
                    <p className="text-gray-400 font-medium">Log in to share your experience with this product.</p>
                  </div>
                  <button
                    onClick={() => navigate('/login')}
                    className="glossy-button px-12 py-4 rounded-2xl font-black uppercase tracking-widest text-sm"
                  >
                    Login to Review
                  </button>
                </div>
              )}

              <div className="space-y-10">
                {reviews.map((review, i) => (
                  <motion.div 
                    key={review.id}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="group space-y-6 pb-10 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-5">
                        <div className="w-16 h-16 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-indigo-100">
                          {review.userName[0]}
                        </div>
                        <div>
                          <div className="flex items-center space-x-3">
                            <span className="font-black text-gray-900 text-lg uppercase tracking-tight">{review.userName}</span>
                            <div className="flex items-center space-x-1 text-yellow-500">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-3 h-3 ${
                                    star <= review.rating ? 'fill-yellow-500' : 'text-gray-200'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">
                            {toDate(review.timestamp)?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) || 'Processing...'}
                          </p>
                        </div>
                      </div>
                      {user?.uid === review.userId && (
                        <motion.button 
                          whileHover={{ scale: 1.1, backgroundColor: '#fee2e2', color: '#ef4444' }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => deleteReview(review.id)}
                          className="p-3 text-gray-300 bg-gray-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-5 h-5" />
                        </motion.button>
                      )}
                    </div>
                    <p className="text-gray-600 text-lg leading-relaxed font-medium pl-21">
                      {review.comment}
                    </p>
                  </motion.div>
                ))}
                {reviews.length === 0 && (
                  <div className="text-center py-20 bg-white/50 backdrop-blur-md rounded-[3rem] border border-white/20">
                    <div className="w-24 h-24 bg-gray-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6">
                      <MessageCircle className="w-12 h-12 text-gray-200" />
                    </div>
                    <p className="text-gray-400 font-black uppercase tracking-[0.3em] text-xs">No reviews yet</p>
                    <p className="text-gray-300 font-medium mt-2">Be the first to share your thoughts!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ProductDetails;
