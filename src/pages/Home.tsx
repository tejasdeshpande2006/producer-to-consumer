import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Product } from '../types';
import { Link } from 'react-router-dom';
import { Star, ShoppingCart, Search, Filter, WifiOff, RefreshCw, ChevronLeft, ChevronRight, Zap, ShieldCheck, Truck, ArrowRight, Leaf, Users, Heart, Mail, Shield, X, SlidersHorizontal } from 'lucide-react';
import { offlineDb } from '../services/offlineDb';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

const PRODUCTS_PER_PAGE = 8;

// Predefined categories
const CATEGORIES = [
  'All',
  'Vegetables',
  'Fruits',
  'Dairy',
  'Grains',
  'Spices',
  'Organic',
  'Beverages',
  'Snacks',
  'Other'
];

type SortOption = 'newest' | 'price-low' | 'price-high' | 'name-az' | 'name-za';

const Home: React.FC = () => {
  const { isAdmin, isProducer, isDelivery } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const isOnline = useOnlineStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Filter states
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);

  useEffect(() => {
    const loadOfflineData = async () => {
      const offlineProds = await offlineDb.getOfflineProducts();
      if (offlineProds.length > 0) {
        setProducts(offlineProds);
        setLoading(false);
      }
    };

    loadOfflineData();

    const q = query(collection(db, 'products'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(prods);
      setLoading(false);
      
      // Sync to offline DB
      setIsSyncing(true);
      await offlineDb.syncProducts(prods);
      setTimeout(() => setIsSyncing(false), 1000);
    }, (error) => {
      // If we're offline, onSnapshot might fail or just not fire.
      // handleFirestoreError will log it, but we already loaded offline data.
      if (!isOnline) {
        setLoading(false);
      } else {
        handleFirestoreError(error, OperationType.LIST, 'products');
      }
    });
    return () => unsubscribe();
  }, [isOnline]);

  // Get unique categories from products
  const availableCategories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return ['All', ...Array.from(cats).sort()];
  }, [products]);

  // Get price range from products
  const maxPrice = useMemo(() => {
    if (products.length === 0) return 10000;
    return Math.ceil(Math.max(...products.map(p => p.price * 1.05)) / 100) * 100;
  }, [products]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = products.filter(p => {
      // Search filter
      const matchesSearch = searchTerm === '' || 
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Category filter
      const matchesCategory = selectedCategory === 'All' || 
        p.category.toLowerCase() === selectedCategory.toLowerCase();
      
      // Price filter (using price with 5% fee)
      const priceWithFee = p.price * 1.05;
      const matchesPrice = priceWithFee >= priceRange[0] && priceWithFee <= priceRange[1];
      
      // Stock filter
      const matchesStock = !inStockOnly || p.stock > 0;

      return matchesSearch && matchesCategory && matchesPrice && matchesStock;
    });

    // Sort products
    switch (sortBy) {
      case 'price-low':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'name-az':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'name-za':
        result.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'newest':
      default:
        // Assuming products are already sorted by newest first
        break;
    }

    return result;
  }, [products, searchTerm, selectedCategory, priceRange, sortBy, inStockOnly]);

  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);
  const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const paginatedProducts = filteredProducts.slice(
    startIndex,
    startIndex + PRODUCTS_PER_PAGE
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, priceRange, sortBy, inStockOnly]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const clearFilters = () => {
    setSelectedCategory('All');
    setPriceRange([0, maxPrice]);
    setSortBy('newest');
    setInStockOnly(false);
    setSearchTerm('');
  };

  const activeFiltersCount = [
    selectedCategory !== 'All',
    priceRange[0] > 0 || priceRange[1] < maxPrice,
    sortBy !== 'newest',
    inStockOnly
  ].filter(Boolean).length;

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-20 pb-20">
      <AnimatePresence>
        {!isOnline && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center justify-between"
            >
              <div className="flex items-center space-x-3">
                <WifiOff className="text-amber-600 w-5 h-5" />
                <p className="text-sm font-bold text-amber-900">You are currently offline. Browsing cached products.</p>
              </div>
            </motion.div>
          </div>
        )}
        {isSyncing && isOnline && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-8 right-8 bg-indigo-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center space-x-2 z-50"
          >
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-xs font-bold uppercase tracking-widest">Syncing...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section - Full Width with Padding */}
      <div className="px-4 sm:px-6 lg:px-8 pt-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative min-h-[700px] rounded-[3rem] overflow-hidden bg-[#0a0a0a] flex items-center px-6 sm:px-12"
        >
          <div className="absolute inset-0">
            <motion.img 
              initial={{ scale: 1.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.4 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=1920" 
              alt="Fresh Produce" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent" />
          </div>
          
          <div className="relative z-10 max-w-3xl space-y-8">
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full"
            >
              <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="text-white text-[10px] font-black uppercase tracking-[0.2em]">Direct from Source</span>
            </motion.div>
            
            <motion.h1 
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-7xl sm:text-9xl font-black text-white leading-[0.8] tracking-tighter font-display uppercase"
            >
              FRESHNESS <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400 italic font-serif lowercase">redefined.</span>
            </motion.h1>
            
            <motion.p 
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-gray-300 text-xl font-medium max-w-xl leading-relaxed border-l-4 border-emerald-500 pl-8 py-2"
            >
              Connect directly with local producers and get the highest quality goods delivered to your doorstep.
            </motion.p>
            
            <motion.div 
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex flex-wrap gap-6 pt-4"
            >
              <button 
                onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-12 py-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-[0.2em] transition-all shadow-2xl shadow-emerald-500/40 flex items-center space-x-3 group"
              >
                <span>Start Shopping</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
              </button>
              {(isAdmin || isProducer || isDelivery) && (
                <Link to="/dashboard" className="px-12 py-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-[0.2em] transition-all shadow-2xl shadow-indigo-500/40 flex items-center space-x-3 group">
                  <ShieldCheck className="w-5 h-5" />
                  <span>Go to Dashboard</span>
                </Link>
              )}
              <button 
                onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-12 py-6 bg-white/5 hover:bg-white/10 backdrop-blur-xl text-white border border-white/20 rounded-[1.5rem] font-black text-sm uppercase tracking-[0.2em] transition-all"
              >
                Learn More
              </button>
            </motion.div>
          </div>
          
          {/* Floating Stats */}
          <div className="absolute bottom-12 right-12 hidden lg:flex space-x-8">
            {[
              { label: 'Producers', value: '500+' },
              { label: 'Products', value: '2k+' },
              { label: 'Happy Users', value: '10k+' }
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 + (i * 0.1) }}
                className="text-right"
              >
                <p className="text-3xl font-black text-white font-display">{stat.value}</p>
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-32">
        {/* Dashboard Access for Roles */}
        {(isAdmin || isProducer || isDelivery) && (
          <section className="py-12 bg-indigo-50/50 rounded-[3rem] border-2 border-indigo-100 px-12">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-indigo-900 tracking-tight font-display uppercase">Dashboard Access</h2>
                <p className="text-indigo-800/60 font-bold uppercase tracking-widest text-xs">Quickly jump to your management consoles</p>
              </div>
              <div className="flex flex-wrap gap-4">
                {isAdmin && (
                  <Link to="/admin" className="flex items-center space-x-3 px-6 py-4 bg-white rounded-2xl border border-indigo-100 shadow-xl shadow-indigo-100/20 hover:border-indigo-600 transition-all group">
                    <Shield className="w-5 h-5 text-indigo-600 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-black text-indigo-900 uppercase tracking-widest">Admin Console</span>
                  </Link>
                )}
                {isProducer && (
                  <Link to="/producer" className="flex items-center space-x-3 px-6 py-4 bg-white rounded-2xl border border-indigo-100 shadow-xl shadow-indigo-100/20 hover:border-indigo-600 transition-all group">
                    <Leaf className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-black text-indigo-900 uppercase tracking-widest">Producer Dashboard</span>
                  </Link>
                )}
                {isDelivery && (
                  <Link to="/delivery" className="flex items-center space-x-3 px-6 py-4 bg-white rounded-2xl border border-indigo-100 shadow-xl shadow-indigo-100/20 hover:border-indigo-600 transition-all group">
                    <Truck className="w-5 h-5 text-purple-600 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-black text-indigo-900 uppercase tracking-widest">Delivery Fleet</span>
                  </Link>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Categories Section */}
        <section>
          <div className="flex items-end justify-between mb-10">
            <div className="space-y-2">
              <span className="text-emerald-600 text-xs font-black uppercase tracking-[0.2em]">Explore</span>
              <h2 className="text-4xl font-black text-gray-900 tracking-tight font-display">Featured Categories</h2>
            </div>
            <button 
              onClick={() => {
                setSelectedCategory('All');
                document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-sm font-bold text-gray-400 hover:text-indigo-600 transition-colors flex items-center space-x-1"
            >
              <span>View All</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { name: 'Vegetables', icon: Leaf, color: 'bg-emerald-50 text-emerald-600' },
              { name: 'Fruits', icon: Heart, color: 'bg-rose-50 text-rose-600' },
              { name: 'Dairy', icon: ShoppingCart, color: 'bg-blue-50 text-blue-600' },
              { name: 'Grains', icon: Zap, color: 'bg-amber-50 text-amber-600' },
              { name: 'Spices', icon: Zap, color: 'bg-orange-50 text-orange-600' },
              { name: 'Organic', icon: Shield, color: 'bg-indigo-50 text-indigo-600' }
            ].map((cat, i) => (
              <motion.button
                key={i}
                whileHover={{ y: -5, scale: 1.02 }}
                onClick={() => {
                  setSelectedCategory(cat.name);
                  document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`p-6 bg-white rounded-[2rem] border shadow-sm hover:shadow-xl transition-all flex flex-col items-center space-y-4 group ${
                  selectedCategory === cat.name ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-gray-100'
                }`}
              >
                <div className={`w-14 h-14 ${cat.color} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <cat.icon className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold text-gray-900">{cat.name}</span>
              </motion.button>
            ))}
          </div>
        </section>

        {/* How it Works */}
        <section id="how-it-works" className="py-20 bg-white rounded-[3rem] border border-gray-100 px-12">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
            <h2 className="text-4xl font-black text-gray-900 tracking-tight font-display">How it Works</h2>
            <p className="text-gray-500 font-medium">We've simplified the process of getting high-quality goods directly from those who make them.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-gray-50 -translate-y-1/2 z-0" />
            {[
              { title: 'Browse & Discover', desc: 'Explore thousands of unique products from verified local producers.', icon: Search },
              { title: 'Direct Purchase', desc: 'Buy directly from the source with secure payments and fair pricing.', icon: ShoppingCart },
              { title: 'Live Tracking', desc: 'Track your delivery in real-time as it moves from source to your door.', icon: Truck }
            ].map((step, i) => (
              <div key={i} className="relative z-10 flex flex-col items-center text-center space-y-6">
                <div className="w-20 h-20 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center shadow-xl shadow-indigo-200">
                  <step.icon className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-gray-900">{step.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed max-w-[200px]">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="products">
          <div className="flex flex-col gap-6 mb-10">
            <div className="flex items-end justify-between">
              <div className="space-y-2">
                <span className="text-indigo-600 text-xs font-black uppercase tracking-[0.2em]">Marketplace</span>
                <h2 className="text-4xl font-black text-gray-900 tracking-tight font-display">Latest Products</h2>
              </div>
              
              {/* Search & Filter Toggle */}
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input 
                    type="text" 
                    placeholder="Search products..."
                    className="pl-10 pr-4 py-3 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all w-64"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center space-x-2 px-4 py-3 rounded-xl border transition-all ${
                    showFilters || activeFiltersCount > 0
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span className="text-sm font-bold">Filters</span>
                  {activeFiltersCount > 0 && (
                    <span className="bg-white text-indigo-600 text-xs font-bold px-2 py-0.5 rounded-full">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Filters Panel */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-gray-900">Filter Products</h3>
                      {activeFiltersCount > 0 && (
                        <button
                          onClick={clearFilters}
                          className="text-sm text-indigo-600 font-medium hover:underline flex items-center space-x-1"
                        >
                          <X className="w-4 h-4" />
                          <span>Clear all</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      {/* Category Filter */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Category</label>
                        <select
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          {availableCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      {/* Sort By */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sort By</label>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as SortOption)}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          <option value="newest">Newest First</option>
                          <option value="price-low">Price: Low to High</option>
                          <option value="price-high">Price: High to Low</option>
                          <option value="name-az">Name: A to Z</option>
                          <option value="name-za">Name: Z to A</option>
                        </select>
                      </div>

                      {/* Price Range */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Price Range: ₹{priceRange[0]} - ₹{priceRange[1]}
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            min={0}
                            max={priceRange[1]}
                            value={priceRange[0]}
                            onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                            className="w-full px-3 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="Min"
                          />
                          <span className="text-gray-400">-</span>
                          <input
                            type="number"
                            min={priceRange[0]}
                            max={maxPrice}
                            value={priceRange[1]}
                            onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                            className="w-full px-3 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="Max"
                          />
                        </div>
                      </div>

                      {/* In Stock Only */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Availability</label>
                        <label className="flex items-center space-x-3 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                          <input
                            type="checkbox"
                            checked={inStockOnly}
                            onChange={(e) => setInStockOnly(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                          />
                          <span className="text-sm font-medium text-gray-700">In Stock Only</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Active Filters Pills */}
            {activeFiltersCount > 0 && !showFilters && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Active:</span>
                {selectedCategory !== 'All' && (
                  <span className="inline-flex items-center space-x-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium">
                    <span>{selectedCategory}</span>
                    <button onClick={() => setSelectedCategory('All')} className="hover:text-indigo-900">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {(priceRange[0] > 0 || priceRange[1] < maxPrice) && (
                  <span className="inline-flex items-center space-x-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium">
                    <span>₹{priceRange[0]} - ₹{priceRange[1]}</span>
                    <button onClick={() => setPriceRange([0, maxPrice])} className="hover:text-indigo-900">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {sortBy !== 'newest' && (
                  <span className="inline-flex items-center space-x-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium">
                    <span>{sortBy === 'price-low' ? 'Price ↑' : sortBy === 'price-high' ? 'Price ↓' : sortBy === 'name-az' ? 'A-Z' : 'Z-A'}</span>
                    <button onClick={() => setSortBy('newest')} className="hover:text-indigo-900">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {inStockOnly && (
                  <span className="inline-flex items-center space-x-1 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium">
                    <span>In Stock</span>
                    <button onClick={() => setInStockOnly(false)} className="hover:text-emerald-900">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
            )}

            {/* Results Count */}
            <div className="text-sm text-gray-500">
              Showing <span className="font-bold text-gray-900">{paginatedProducts.length}</span> of <span className="font-bold text-gray-900">{filteredProducts.length}</span> products
            </div>
          </div>

          {/* Product Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1,2,3,4,5,6,7,8].map(i => (
                <div key={i} className="bg-white rounded-3xl p-4 animate-pulse border border-gray-50">
                  <div className="aspect-square bg-gray-100 rounded-2xl mb-4" />
                  <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <motion.div 
              layout
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              <AnimatePresence mode="popLayout">
                {paginatedProducts.map((product, index) => (
                  <motion.div
                    layout
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ 
                      duration: 0.4, 
                      delay: index * 0.05,
                      ease: "easeOut"
                    }}
                  >
                    <Link 
                      to={`/product/${product.id}`}
                      className="group block glossy-card p-4"
                    >
                      <div className="aspect-square rounded-2xl overflow-hidden bg-gray-50 mb-4 relative">
                        <motion.img 
                          whileHover={{ scale: 1.1 }}
                          transition={{ duration: 0.6 }}
                          src={product.images[0] || `https://picsum.photos/seed/${product.id}/400/400`} 
                          alt={product.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-2 py-1 rounded-lg flex items-center space-x-1 shadow-sm border border-white/20">
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                          <span className="text-[10px] font-black text-gray-900">4.9</span>
                        </div>
                        <div className="absolute bottom-3 left-3 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="p-2 bg-white/90 backdrop-blur-md rounded-lg shadow-sm border border-white/20">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          </div>
                          <div className="p-2 bg-white/90 backdrop-blur-md rounded-lg shadow-sm border border-white/20">
                            <Truck className="w-3 h-3 text-indigo-600" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.15em]">{product.category}</span>
                        <h3 className="font-bold text-gray-900 line-clamp-1 group-hover:text-emerald-600 transition-colors font-display">{product.title}</h3>
                        <div className="flex items-center justify-between pt-2">
                          <div className="flex flex-col">
                            <span className="text-2xl font-black text-gray-900 tracking-tighter font-display">₹{(product.price * 1.05).toFixed(2)}</span>
                            <span className="text-[10px] text-gray-400 font-bold line-through">₹{(product.price * 1.25).toFixed(0)}</span>
                          </div>
                          <motion.button 
                            whileHover={{ scale: 1.1, rotate: 5 }}
                            whileTap={{ scale: 0.9 }}
                            className="p-3 bg-gray-900 text-white rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-gray-200"
                          >
                            <ShoppingCart className="w-5 h-5" />
                          </motion.button>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Pagination Controls */}
          {!loading && totalPages > 1 && (
            <div className="flex flex-col items-center space-y-4 py-8">
              <div className="flex items-center justify-center space-x-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handlePageChange(Math.max(currentPage - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-3 bg-white border border-gray-100 rounded-2xl shadow-sm text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </motion.button>
                
                <div className="flex items-center space-x-1">
                  {[...Array(totalPages)].map((_, i) => {
                    const pageNum = i + 1;
                    if (
                      totalPages > 7 &&
                      pageNum !== 1 &&
                      pageNum !== totalPages &&
                      Math.abs(pageNum - currentPage) > 1
                    ) {
                      if (Math.abs(pageNum - currentPage) === 2) {
                        return <span key={pageNum} className="px-2 text-gray-400">...</span>;
                      }
                      return null;
                    }

                    return (
                      <motion.button
                        key={pageNum}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handlePageChange(pageNum)}
                        className={`w-12 h-12 rounded-2xl text-sm font-black transition-all ${
                          currentPage === pageNum
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                            : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </motion.button>
                    );
                  })}
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handlePageChange(Math.min(currentPage + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-3 bg-white border border-gray-100 rounded-2xl shadow-sm text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </motion.button>
              </div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Page {currentPage} of {totalPages}
              </p>
            </div>
          )}
        </section>

        {/* Newsletter Section */}
        <section className="relative rounded-[3rem] overflow-hidden bg-indigo-600 p-12 sm:p-20">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
          </div>
          <div className="relative z-10 flex flex-col items-center text-center space-y-8">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <div className="space-y-4 max-w-xl">
              <h2 className="text-4xl font-black text-white tracking-tight font-display">Join the Community</h2>
              <p className="text-indigo-100 font-medium">Get weekly updates on new producers, seasonal products, and exclusive offers delivered to your inbox.</p>
            </div>
            <form className="flex flex-col sm:flex-row gap-4 w-full max-w-md" onSubmit={(e) => e.preventDefault()}>
              <input 
                type="email" 
                placeholder="Enter your email" 
                className="flex-grow px-6 py-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white placeholder:text-indigo-200 focus:ring-2 focus:ring-white outline-none transition-all"
              />
              <button className="px-8 py-4 bg-white text-indigo-600 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-xl">
                Subscribe
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Home;
