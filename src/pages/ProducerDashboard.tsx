import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, orderBy, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Product, Order } from '../types';
import { Plus, Package, Trash2, Edit3, CheckCircle, XCircle, AlertCircle, ShoppingBag, Truck, Clock, MapPin, Sparkles, Loader2, RefreshCw, Camera, Upload, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const ProducerDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'inventory' | 'orders'>('inventory');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [deliveryBoys, setDeliveryBoys] = useState<{ [key: string]: string }>({});
  const [statusFilter, setStatusFilter] = useState<Order['status'] | 'all'>('all');
  const [confirmAction, setConfirmAction] = useState<{ type: 'confirm' | 'cancel' | 'shipped', orderId: string } | null>(null);
  const [newProduct, setNewProduct] = useState({
    title: '',
    description: '',
    price: '',
    stock: '',
    category: 'Electronics',
    images: [] as string[],
    videoUrl: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{
    category?: string;
    price?: number;
    tags?: string[];
  } | null>(null);

  const generateAIDescription = async (isEdit: boolean = false) => {
    const targetProduct = isEdit ? editingProduct : newProduct;
    if (!targetProduct) return;

    setIsGenerating(true);
    setAiSuggestions(null);
    try {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        throw new Error("GROQ_API_KEY is not configured. Please add it to your .env.local file.");
      }
      
      const categories = [
        "Electronics", "Fashion", "Home & Living", "Groceries", 
        "Beauty", "Sports", "Books", "Toys", "Automotive", "Health"
      ];

      const prompt = `
        Analyze this product ${targetProduct.title ? `titled "${targetProduct.title}"` : ''}.
        
        Generate:
        1. A compelling, professional, and SEO-friendly product description (max 150 words).
        2. Suggest the best category from this list: ${categories.join(", ")}.
        3. Suggest a competitive price in Indian Rupees (₹).
        4. Generate 5 relevant search tags.

        Return ONLY valid JSON in this exact format:
        {"description": "...", "category": "...", "price": 123, "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]}
      `;

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || '{}';
      
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const result = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');
      
      if (result.description) {
        if (isEdit && editingProduct) {
          setEditingProduct({ 
            ...editingProduct, 
            description: result.description,
            category: result.category || editingProduct.category
          });
        } else {
          setNewProduct((prev: typeof newProduct) => ({ 
            ...prev, 
            description: result.description,
            category: result.category || prev.category
          }));
        }
        
        setAiSuggestions({
          category: result.category,
          price: result.price,
          tags: result.tags
        });
      }
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      alert(`Failed to generate smart suggestions: ${error?.message || error}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files) as File[];
    const uploadPromises = fileArray.map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(uploadPromises).then(base64Images => {
      if (isEdit && editingProduct) {
        setEditingProduct({
          ...editingProduct,
          images: [...editingProduct.images, ...base64Images]
        });
      } else {
        setNewProduct((prev: typeof newProduct) => ({
          ...prev,
          images: [...prev.images, ...base64Images]
        }));
      }
    });
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size - allowing up to 50MB
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      alert("Video file is too large. Please upload a video smaller than 50MB.");
      return;
    }

    setIsUploadingVideo(true);
    try {
      // Create a unique filename
      const timestamp = Date.now();
      const fileName = `product-videos/${profile?.uid || 'unknown'}/${timestamp}-${file.name}`;
      const storageRef = ref(storage, fileName);
      
      // Upload to Firebase Storage
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);

      if (isEdit && editingProduct) {
        setEditingProduct({
          ...editingProduct,
          videoUrl: downloadUrl
        });
      } else {
        setNewProduct((prev: typeof newProduct) => ({
          ...prev,
          videoUrl: downloadUrl
        }));
      }
    } catch (error) {
      console.error('Error uploading video:', error);
      alert('Failed to upload video. Please try again.');
    } finally {
      setIsUploadingVideo(false);
    }
  };

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'products'), where('sellerId', '==', profile.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });
    return () => unsubscribe();
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'orders'), 
      where('sellerId', '==', profile.uid),
      orderBy('timestamp', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });
    return () => unsubscribe();
  }, [profile]);

  useEffect(() => {
    const fetchDeliveryBoys = async () => {
      const dbIds = Array.from(new Set(orders.map((o: Order) => o.deliveryBoyId).filter(Boolean))) as string[];
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
        setDeliveryBoys((prev: Record<string, string>) => ({ ...prev, ...newNames }));
      }
    };

    fetchDeliveryBoys();
  }, [orders]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    try {
      const filteredImages = newProduct.images.filter((url: string) => url.trim() !== '');
      const finalImages = filteredImages.length > 0 
        ? filteredImages 
        : [`https://picsum.photos/seed/${Math.random()}/400/400`];

      await addDoc(collection(db, 'products'), {
        title: newProduct.title,
        description: newProduct.description,
        price: Number(newProduct.price),
        stock: Number(newProduct.stock),
        category: newProduct.category,
        sellerId: profile.uid,
        images: finalImages,
        videoUrl: newProduct.videoUrl || ''
      });
      setShowAddModal(false);
      setNewProduct({ title: '', description: '', price: '', stock: '', category: 'Electronics', images: [], videoUrl: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'products');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      const filteredImages = editingProduct.images.filter((url: string) => url.trim() !== '');
      const finalImages = filteredImages.length > 0 
        ? filteredImages 
        : [`https://picsum.photos/seed/${Math.random()}/400/400`];

      await updateDoc(doc(db, 'products', editingProduct.id), {
        title: editingProduct.title,
        description: editingProduct.description,
        price: Number(editingProduct.price),
        stock: Number(editingProduct.stock),
        category: editingProduct.category,
        images: finalImages,
        videoUrl: editingProduct.videoUrl || ''
      });
      setEditingProduct(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `products/${editingProduct.id}`);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const filteredOrders = statusFilter === 'all' 
    ? orders 
    : orders.filter((o: Order) => o.status === statusFilter);

  const lowStockProducts = products.filter((p: Product) => p.stock < 5);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="space-y-8">
        {/* Suspension Warning Banner */}
        <AnimatePresence>
          {profile?.isSuspended && (
            <motion.div 
              initial={{ height: 0, opacity: 0, y: -20 }}
              animate={{ height: 'auto', opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -20 }}
              className="overflow-hidden"
            >
              <div className="bg-red-50 border-2 border-red-100 rounded-[2.5rem] p-8 flex items-start space-x-6 mb-8 shadow-xl shadow-red-100/50">
                <div className="w-16 h-16 bg-red-100 rounded-3xl flex items-center justify-center flex-shrink-0 animate-pulse">
                  <XCircle className="text-red-600 w-8 h-8" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-black text-red-900 font-display tracking-tight">Account Suspended</h3>
                  <p className="text-red-800/70 text-base font-bold leading-relaxed mt-1">
                    Your account has been suspended due to excessive order returns (3 strikes). 
                    You cannot add new products or process orders.
                  </p>
                  <div className="mt-6">
                    <a 
                      href="mailto:admin@example.com" 
                      className="inline-flex items-center space-x-3 px-6 py-3 bg-red-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                    >
                      <span>Contact Administrator</span>
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Verification Warning Banner */}
        <AnimatePresence>
          {!profile?.isVerified && !profile?.isSuspended && (
            <motion.div 
              initial={{ height: 0, opacity: 0, y: -20 }}
              animate={{ height: 'auto', opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -20 }}
              className="overflow-hidden"
            >
              <div className="bg-amber-50 border-2 border-amber-100 rounded-[2.5rem] p-8 flex items-start space-x-6 mb-8 shadow-xl shadow-amber-100/50">
                <div className="w-16 h-16 bg-amber-100 rounded-3xl flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="text-amber-600 w-8 h-8" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-black text-amber-900 font-display tracking-tight">Verification Pending</h3>
                  <p className="text-amber-800/70 text-base font-bold leading-relaxed mt-1">
                    Your producer account is currently under review. 
                    You can view your dashboard and orders, but you cannot add new products until verified.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-5xl font-black text-gray-900 tracking-tighter font-display uppercase">Seller Dashboard<span className="text-indigo-600">.</span></h1>
            <p className="text-gray-400 font-bold uppercase tracking-[0.2em] text-sm mt-2">Manage your inventory and track sales</p>
          </div>
          <motion.button 
            whileHover={{ scale: 1.05, y: -4 }}
            whileTap={{ scale: 0.95 }}
            disabled={!profile?.isVerified || profile?.isSuspended}
            onClick={() => setShowAddModal(true)}
            className={`flex items-center space-x-3 px-10 py-5 rounded-[1.5rem] font-black text-sm transition-all shadow-2xl uppercase tracking-[0.2em] ${
              !profile?.isVerified || profile?.isSuspended
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none' 
                : 'glossy-button'
            }`}
          >
            <Plus className="w-6 h-6" />
            <span>Add Product</span>
          </motion.button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Total Products', value: products.length, color: 'blue' },
            { label: 'Active Orders', value: orders.filter((o: Order) => o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'returned').length, color: 'indigo' },
            { label: 'Total Earnings', value: `₹${orders.filter((o: Order) => o.status === 'delivered').reduce((acc: number, o: Order) => acc + o.totalAmount, 0).toFixed(2)}`, color: 'green' },
            { label: 'Returns / Strikes', value: `${profile?.strikes || 0} / 3`, color: profile?.strikes && profile.strikes >= 3 ? 'red' : profile?.strikes && profile.strikes > 0 ? 'amber' : 'gray' }
          ].map((stat, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glossy-card p-8 group"
            >
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-2">{stat.label}</p>
              <p className={`text-4xl font-black font-display tracking-tighter group-hover:scale-110 transition-transform origin-left duration-500 ${
                stat.color === 'green' ? 'text-green-600' : 
                stat.color === 'red' ? 'text-red-600' : 
                stat.color === 'amber' ? 'text-amber-600' : 'text-gray-900'
              }`}>{stat.value}</p>
            </motion.div>
          ))}
        </div>

      {/* Tabs */}
      <div className="glass-surface p-2 rounded-[2rem] flex space-x-2 w-fit">
        <button 
          onClick={() => setActiveTab('inventory')}
          className={`px-8 py-3 rounded-2xl font-black text-sm transition-all duration-500 uppercase tracking-widest ${
            activeTab === 'inventory' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          Inventory
        </button>
        <button 
          onClick={() => setActiveTab('orders')}
          className={`px-8 py-3 rounded-2xl font-black text-sm transition-all duration-500 uppercase tracking-widest ${
            activeTab === 'orders' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          Orders
        </button>
      </div>

      {activeTab === 'inventory' ? (
        /* Product List */
        <div className="glossy-card overflow-hidden">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
            <h3 className="font-bold text-gray-900">Your Inventory</h3>
            <div className="flex items-center space-x-2 text-xs font-bold text-gray-400">
              <Package className="w-4 h-4" />
              <span>{products.length} ITEMS</span>
            </div>
          </div>
          
          {lowStockProducts.length > 0 && (
            <div className="p-4 bg-amber-50 border-b border-amber-100 flex items-center justify-between animate-pulse">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <p className="text-sm font-bold text-amber-900">
                  {lowStockProducts.length} products are running low on stock (less than 5 units)!
                </p>
              </div>
              <div className="flex -space-x-2">
                {lowStockProducts.slice(0, 3).map(p => (
                  <div key={p.id} className="w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-gray-100">
                    <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="divide-y divide-gray-50">
            {products.map(product => (
              <div 
                key={product.id} 
                className={`p-6 flex items-center justify-between hover:bg-gray-50 transition-colors group ${
                  !profile?.isVerified ? 'opacity-75 grayscale-[0.5]' : ''
                }`}
              >
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-100">
                    <img 
                      src={product.images[0]} 
                      alt={product.title} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{product.title}</h4>
                    <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider">{product.category}</p>
                    <div className="flex items-center space-x-3 mt-1">
                      <span className="text-sm font-black text-gray-900">₹{product.price.toFixed(2)}</span>
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs font-medium ${product.stock < 5 ? 'text-red-600 font-bold' : 'text-gray-400'}`}>
                          • {product.stock} in stock
                        </span>
                        {product.stock < 5 && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[8px] font-black uppercase tracking-widest rounded-full animate-pulse">
                            Low Stock
                          </span>
                        )}
                        {!profile?.isVerified && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[8px] font-black uppercase tracking-widest rounded-full">
                            Verification Pending
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => setEditingProduct({ ...product, images: product.images || [] })}
                    className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                  >
                    <Edit3 className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => handleDeleteProduct(product.id)}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
            {products.length === 0 && (
              <div className="p-12 text-center">
                <p className="text-gray-400 font-medium">No products listed yet.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Orders List */
        <div className="glossy-card overflow-hidden">
          <div className="p-6 border-b border-gray-50 flex flex-col space-y-4 bg-gray-50/50">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Incoming Orders</h3>
              <div className="flex items-center space-x-2 text-xs font-bold text-gray-400">
                <ShoppingBag className="w-4 h-4" />
                <span>{filteredOrders.length} {statusFilter !== 'all' ? statusFilter.toUpperCase() : ''} ORDERS</span>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {['all', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned'].map((status) => {
                const count = status === 'all' ? orders.length : orders.filter(o => o.status === status).length;
                return (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status as any)}
                    className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center space-x-2 ${
                      statusFilter === status 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                        : 'bg-white text-gray-400 border border-gray-100 hover:border-indigo-200 hover:text-indigo-600'
                    }`}
                  >
                    <span>{status}</span>
                    {count > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-md text-[8px] ${
                        statusFilter === status ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {filteredOrders.map(order => (
              <div 
                key={order.id} 
                className="p-6 space-y-4 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => setSelectedOrder(order)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      order.status === 'delivered' ? 'bg-green-50 text-green-600' :
                      order.status === 'cancelled' ? 'bg-red-50 text-red-600' :
                      order.status === 'returned' ? 'bg-amber-50 text-amber-600' :
                      'bg-indigo-50 text-indigo-600'
                    }`}>
                      {order.status === 'delivered' ? <CheckCircle className="w-6 h-6" /> :
                       order.status === 'cancelled' ? <XCircle className="w-6 h-6" /> :
                       order.status === 'returned' ? <RefreshCw className="w-6 h-6" /> :
                       <Clock className="w-6 h-6" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Order ID</p>
                      <p className="font-bold text-gray-900">#{order.id.slice(-8).toUpperCase()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Status</p>
                    <span className={`text-xs font-black uppercase tracking-wider px-2 py-1 rounded-lg ${
                      order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                      order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      order.status === 'returned' ? 'bg-amber-100 text-amber-700' :
                      'bg-indigo-100 text-indigo-700'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50/50 p-4 rounded-2xl">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Items</p>
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-600 font-medium">{item.title} x{item.quantity}</span>
                        <span className="font-bold text-gray-900">₹{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col justify-end items-end space-y-3">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Amount</p>
                      <p className="text-xl font-black text-indigo-600">₹{order.totalAmount.toFixed(2)}</p>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2">
                      {order.status === 'pending' && (
                        <button 
                          disabled={profile?.isSuspended}
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmAction({ type: 'confirm', orderId: order.id });
                          }}
                          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                            profile?.isSuspended 
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                              : 'bg-indigo-600 text-white hover:bg-indigo-700'
                          }`}
                        >
                          Confirm Order
                        </button>
                      )}
                      {order.status === 'confirmed' && (
                        <button 
                          disabled={profile?.isSuspended}
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmAction({ type: 'shipped', orderId: order.id });
                          }}
                          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-2 ${
                            profile?.isSuspended 
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                              : 'bg-indigo-600 text-white hover:bg-indigo-700'
                          }`}
                        >
                          <Truck className="w-4 h-4" />
                          <span>Mark as Shipped</span>
                        </button>
                      )}
                      {(order.status === 'pending' || order.status === 'confirmed') && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmAction({ type: 'cancel', orderId: order.id });
                          }}
                          className="px-4 py-2 bg-red-50 text-red-600 text-xs font-bold rounded-xl hover:bg-red-100 transition-all"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <div className="p-12 text-center">
                <p className="text-gray-400 font-medium">No orders received yet.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-gray-900">Order Details</h2>
              <button 
                onClick={() => {
                  setSelectedOrder(null);
                  setConfirmAction(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-xl transition-all"
              >
                <XCircle className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Customer Information</p>
                  <p className="font-bold text-gray-900 text-lg">{selectedOrder.buyerName || 'Unknown Buyer'}</p>
                  <p className="text-sm text-gray-500 mt-2 flex items-start space-x-2">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{selectedOrder.shippingAddress || '123 Main St, Suite 456, Metro City'}</span>
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Order Status</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      selectedOrder.status === 'delivered' ? 'bg-green-100 text-green-700' : 
                      selectedOrder.status === 'cancelled' ? 'bg-red-100 text-red-700' : 
                      selectedOrder.status === 'returned' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      {selectedOrder.status}
                    </span>
                    <p className="text-xs text-gray-400 font-medium italic">
                      ID: #{selectedOrder.id.slice(-8).toUpperCase()}
                    </p>
                  </div>
                </div>

                {selectedOrder.deliveryBoyId && (
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Delivery Partner</p>
                    <div className="flex items-center space-x-2 mt-2">
                      <Truck className="w-4 h-4 text-indigo-500" />
                      <p className="text-sm font-bold text-gray-900">
                        {deliveryBoys[selectedOrder.deliveryBoyId] || 'Loading...'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Order Items</p>
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
                        <div>
                          <p className="text-sm font-bold text-gray-900">{item.title}</p>
                          <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                        </div>
                        <p className="font-black text-indigo-600">₹{(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex justify-between items-baseline">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Amount</p>
                  <p className="text-2xl font-black text-indigo-600">₹{selectedOrder.totalAmount.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center space-x-3">
              {selectedOrder.status === 'pending' && !profile?.isSuspended && (
                <>
                  <button 
                    onClick={() => setConfirmAction({ type: 'confirm', orderId: selectedOrder.id })}
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    Confirm Order
                  </button>
                  <button 
                    onClick={() => setConfirmAction({ type: 'cancel', orderId: selectedOrder.id })}
                    className="flex-1 py-3 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 transition-all"
                  >
                    Cancel Order
                  </button>
                </>
              )}
              {selectedOrder.status === 'confirmed' && !profile?.isSuspended && (
                <>
                  <button 
                    onClick={() => setConfirmAction({ type: 'shipped', orderId: selectedOrder.id })}
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center space-x-2"
                  >
                    <Truck className="w-5 h-5" />
                    <span>Mark as Shipped</span>
                  </button>
                  <button 
                    onClick={() => setConfirmAction({ type: 'cancel', orderId: selectedOrder.id })}
                    className="flex-1 py-3 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 transition-all"
                  >
                    Cancel Order
                  </button>
                </>
              )}
              {profile?.isSuspended && (selectedOrder.status === 'pending' || selectedOrder.status === 'confirmed') && (
                <div className="flex-1 py-3 bg-red-50 text-red-600 rounded-2xl font-bold text-center text-sm">
                  Account Suspended - Actions Disabled
                </div>
              )}
              <button 
                onClick={() => {
                  setSelectedOrder(null);
                  setConfirmAction(null);
                }}
                className="flex-1 py-3 border border-gray-100 rounded-2xl font-bold text-gray-500 hover:bg-gray-50 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900">Confirm Action</h3>
                <p className="text-gray-500 text-sm">This action cannot be undone.</p>
              </div>
            </div>
            
            <p className="text-gray-700 font-medium mb-8">
              {confirmAction.type === 'confirm' && 'Are you sure you want to confirm this order?'}
              {confirmAction.type === 'cancel' && 'Are you sure you want to cancel this order?'}
              {confirmAction.type === 'shipped' && 'Are you sure you want to mark this order as shipped?'}
            </p>

            <div className="flex items-center space-x-3">
              <button 
                onClick={() => {
                  const statusMap: Record<string, Order['status']> = {
                    confirm: 'confirmed',
                    cancel: 'cancelled',
                    shipped: 'shipped'
                  };
                  handleUpdateOrderStatus(confirmAction.orderId, statusMap[confirmAction.type]);
                  setConfirmAction(null);
                  setSelectedOrder(null);
                }}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
              >
                Yes, Proceed
              </button>
              <button 
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-3 border border-gray-100 rounded-2xl font-bold text-gray-500 hover:bg-gray-50 transition-all"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-gray-900">List New Product</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                <XCircle className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">Title</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                    value={newProduct.title}
                    onChange={e => setNewProduct({...newProduct, title: e.target.value})}
                  />
                </div>
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Description</label>
                    <button
                      type="button"
                      onClick={() => generateAIDescription(false)}
                      disabled={isGenerating}
                      className="flex items-center space-x-1 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-50 px-2 py-1 rounded-lg"
                    >
                      {isGenerating ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      <span>{isGenerating ? 'Analyzing...' : 'Smart AI Fill'}</span>
                    </button>
                  </div>
                  <textarea 
                    required
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-sm resize-none"
                    value={newProduct.description}
                    onChange={e => setNewProduct({...newProduct, description: e.target.value})}
                    placeholder="Describe your product in detail..."
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">Price (₹)</label>
                  <div className="relative">
                    <input 
                      required
                      type="number" 
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                      value={newProduct.price}
                      onChange={e => setNewProduct({...newProduct, price: e.target.value})}
                    />
                    {aiSuggestions?.price && (
                      <button
                        type="button"
                        onClick={() => setNewProduct({...newProduct, price: aiSuggestions.price!.toString()})}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black bg-indigo-100 text-indigo-600 px-2 py-1 rounded-lg hover:bg-indigo-200 transition-all"
                      >
                        Suggest: ₹{aiSuggestions.price}
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">Stock</label>
                  <input 
                    required
                    type="number" 
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                    value={newProduct.stock}
                    onChange={e => setNewProduct({...newProduct, stock: e.target.value})}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">Category</label>
                  <div className="relative">
                    <select 
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium appearance-none"
                      value={newProduct.category}
                      onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                    >
                      <option>Electronics</option>
                      <option>Fashion</option>
                      <option>Home & Living</option>
                      <option>Groceries</option>
                      <option>Beauty</option>
                      <option>Sports</option>
                      <option>Books</option>
                      <option>Toys</option>
                      <option>Automotive</option>
                      <option>Health</option>
                    </select>
                    {aiSuggestions?.category && aiSuggestions.category !== newProduct.category && (
                      <button
                        type="button"
                        onClick={() => setNewProduct({...newProduct, category: aiSuggestions.category!})}
                        className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] font-black bg-indigo-100 text-indigo-600 px-2 py-1 rounded-lg hover:bg-indigo-200 transition-all"
                      >
                        Suggest: {aiSuggestions.category}
                      </button>
                    )}
                  </div>
                </div>
                {aiSuggestions?.tags && (
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">AI Suggested Tags</label>
                    <div className="flex flex-wrap gap-2">
                      {aiSuggestions.tags.map((tag, i) => (
                        <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-wider rounded-full border border-indigo-100">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="col-span-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">Product Video (Max 50MB)</label>
                  <div className="flex items-center space-x-4">
                    <label className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50 transition-all ${isUploadingVideo ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}>
                      {isUploadingVideo ? (
                        <>
                          <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                          <span className="text-sm font-bold text-indigo-600">Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-bold text-gray-600">Upload Video</span>
                        </>
                      )}
                      <input 
                        type="file" 
                        accept="video/*" 
                        className="hidden" 
                        onChange={(e) => handleVideoUpload(e, false)}
                        disabled={isUploadingVideo}
                      />
                    </label>
                    {newProduct.videoUrl && (
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600">
                        <CheckCircle className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="col-span-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Product Images</label>
                    <label className="cursor-pointer text-indigo-600 hover:text-indigo-700 flex items-center space-x-1 text-xs font-bold">
                      <Plus className="w-3 h-3" />
                      <span>Upload Photos</span>
                      <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleImageUpload(e, false)}
                      />
                    </label>
                  </div>
                  
                  {/* Image Gallery Preview */}
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {newProduct.images.map((url, idx) => (
                      <div key={idx} className="aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-100 relative group">
                        <img 
                          src={url} 
                          alt={`Preview ${idx}`} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <button 
                          type="button"
                          onClick={() => {
                            const updatedImages = newProduct.images.filter((_, i) => i !== idx);
                            setNewProduct({...newProduct, images: updatedImages});
                          }}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {newProduct.images.length === 0 && (
                      <label className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-all">
                        <Upload className="w-6 h-6 text-gray-300 mb-1" />
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Add Photo</span>
                        <input 
                          type="file" 
                          multiple 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleImageUpload(e, false)}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3 pt-6">
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  Create Product
                </button>
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-4 border border-gray-100 rounded-2xl font-bold text-gray-500 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-gray-900">Edit Product</h2>
              <button onClick={() => setEditingProduct(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                <XCircle className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleUpdateProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">Title</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                    value={editingProduct.title}
                    onChange={e => setEditingProduct({...editingProduct, title: e.target.value})}
                  />
                </div>
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Description</label>
                    <button
                      type="button"
                      onClick={() => generateAIDescription(true)}
                      disabled={isGenerating}
                      className="flex items-center space-x-1 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-50 px-2 py-1 rounded-lg"
                    >
                      {isGenerating ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      <span>{isGenerating ? 'Analyzing...' : 'Smart AI Fill'}</span>
                    </button>
                  </div>
                  <textarea 
                    required
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-sm resize-none"
                    value={editingProduct.description}
                    onChange={e => setEditingProduct({...editingProduct, description: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">Price (₹)</label>
                  <div className="relative">
                    <input 
                      required
                      type="number" 
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                      value={editingProduct.price}
                      onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})}
                    />
                    {aiSuggestions?.price && (
                      <button
                        type="button"
                        onClick={() => setEditingProduct({...editingProduct, price: aiSuggestions.price!})}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black bg-indigo-100 text-indigo-600 px-2 py-1 rounded-lg hover:bg-indigo-200 transition-all"
                      >
                        Suggest: ₹{aiSuggestions.price}
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">Stock</label>
                  <input 
                    required
                    type="number" 
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                    value={editingProduct.stock}
                    onChange={e => setEditingProduct({...editingProduct, stock: Number(e.target.value)})}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">Category</label>
                  <div className="relative">
                    <select 
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium appearance-none"
                      value={editingProduct.category}
                      onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}
                    >
                      <option>Electronics</option>
                      <option>Fashion</option>
                      <option>Home & Living</option>
                      <option>Groceries</option>
                      <option>Beauty</option>
                      <option>Sports</option>
                      <option>Books</option>
                      <option>Toys</option>
                      <option>Automotive</option>
                      <option>Health</option>
                    </select>
                    {aiSuggestions?.category && aiSuggestions.category !== editingProduct.category && (
                      <button
                        type="button"
                        onClick={() => setEditingProduct({...editingProduct, category: aiSuggestions.category!})}
                        className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] font-black bg-indigo-100 text-indigo-600 px-2 py-1 rounded-lg hover:bg-indigo-200 transition-all"
                      >
                        Suggest: {aiSuggestions.category}
                      </button>
                    )}
                  </div>
                </div>
                {aiSuggestions?.tags && (
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">AI Suggested Tags</label>
                    <div className="flex flex-wrap gap-2">
                      {aiSuggestions.tags.map((tag, i) => (
                        <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-wider rounded-full border border-indigo-100">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="col-span-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">Product Video (Max 50MB)</label>
                  <div className="flex items-center space-x-4">
                    <label className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50 transition-all ${isUploadingVideo ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}>
                      {isUploadingVideo ? (
                        <>
                          <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                          <span className="text-sm font-bold text-indigo-600">Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-bold text-gray-600">Upload Video</span>
                        </>
                      )}
                      <input 
                        type="file" 
                        accept="video/*" 
                        className="hidden" 
                        onChange={(e) => handleVideoUpload(e, true)}
                        disabled={isUploadingVideo}
                      />
                    </label>
                    {editingProduct.videoUrl && (
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600">
                        <CheckCircle className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="col-span-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Product Images</label>
                    <label className="cursor-pointer text-indigo-600 hover:text-indigo-700 flex items-center space-x-1 text-xs font-bold">
                      <Plus className="w-3 h-3" />
                      <span>Upload Photos</span>
                      <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleImageUpload(e, true)}
                      />
                    </label>
                  </div>

                  {/* Image Gallery Preview */}
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {editingProduct.images.map((url, idx) => (
                      <div key={idx} className="aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-100 relative group">
                        <img 
                          src={url} 
                          alt={`Preview ${idx}`} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <button 
                          type="button"
                          onClick={() => {
                            const updatedImages = editingProduct.images.filter((_, i) => i !== idx);
                            setEditingProduct({...editingProduct, images: updatedImages});
                          }}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <label className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-all">
                      <Upload className="w-6 h-6 text-gray-300 mb-1" />
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Add Photo</span>
                      <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleImageUpload(e, true)}
                      />
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3 pt-6">
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  Save Changes
                </button>
                <button 
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="flex-1 py-4 border border-gray-100 rounded-2xl font-bold text-gray-500 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default ProducerDashboard;
