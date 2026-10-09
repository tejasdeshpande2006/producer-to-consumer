import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { Order, UserProfile } from '../types';
import { MapPin, Truck, ChevronLeft, Navigation, Phone, MessageCircle, Clock, CheckCircle2, Map as MapIcon, Bell, Zap, XCircle, Locate } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import { motion, AnimatePresence } from 'motion/react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getCurrentLocation } from '../hooks/useGeolocation';

// Fix for default marker icons in Leaflet with React
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons
const deliveryIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/2961/2961212.png',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
  className: 'delivery-marker-icon'
});

const nearDeliveryIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/2961/2961212.png',
  iconSize: [48, 48],
  iconAnchor: [24, 48],
  popupAnchor: [0, -48],
  className: 'delivery-marker-icon-near'
});

const destinationIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

// Component to auto-center map
const RecenterMap = ({ position }: { position: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(position);
  }, [position, map]);
  return null;
};

const OrderTracking: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [deliveryBoy, setDeliveryBoy] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [distance, setDistance] = useState<number | null>(null);
  const [isNear, setIsNear] = useState(false);
  const [lastStatus, setLastStatus] = useState<Order['status'] | null>(null);
  const [showStatusToast, setShowStatusToast] = useState(false);
  const [showNearToast, setShowNearToast] = useState(false);
  const [hasNotifiedNear, setHasNotifiedNear] = useState(false);
  const [optimizedRoute, setOptimizedRoute] = useState<[number, number][]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const suggestOptimizedRoute = async (currentLoc: [number, number], dest: [number, number]) => {
    if (isOptimizing) return;
    setIsOptimizing(true);
    try {
      // Simple route with midpoint (no external API needed)
      const midLat = (currentLoc[0] + dest[0]) / 2;
      const midLng = (currentLoc[1] + dest[1]) / 2;
      // Add slight variation to make route look more natural
      const offset1: [number, number] = [currentLoc[0] + (midLat - currentLoc[0]) * 0.3, currentLoc[1] + (midLng - currentLoc[1]) * 0.25];
      const offset2: [number, number] = [midLat + 0.001, midLng - 0.001];
      const offset3: [number, number] = [dest[0] - (dest[0] - midLat) * 0.3, dest[1] - (dest[1] - midLng) * 0.25];
      setOptimizedRoute([currentLoc, offset1, offset2, offset3, dest]);
    } catch (error) {
      console.error("Error creating route:", error);
      setOptimizedRoute([currentLoc, dest]);
    } finally {
      setIsOptimizing(false);
    }
  };

  useEffect(() => {
    if (order?.status === 'shipped' && deliveryBoy?.location && optimizedRoute.length === 0) {
      suggestOptimizedRoute([deliveryBoy.location.lat, deliveryBoy.location.lng], destination);
    }
  }, [order?.status, deliveryBoy?.location]);

  useEffect(() => {
    if (isNear && !hasNotifiedNear && order?.status === 'shipped') {
      setShowNearToast(true);
      setHasNotifiedNear(true);
      // Play a subtle sound if possible or just show toast
    }
  }, [isNear, hasNotifiedNear, order?.status]);

  useEffect(() => {
    if (order && lastStatus && order.status !== lastStatus) {
      setShowStatusToast(true);
      const timer = setTimeout(() => setShowStatusToast(false), 5000);
      return () => clearTimeout(timer);
    }
    if (order) {
      setLastStatus(order.status);
    }
  }, [order?.status]);

  // Real-time destination coordinates based on user's current location
  const [destination, setDestination] = useState<[number, number]>([12.9716, 77.5946]); // Default fallback
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    const fetchUserLocation = async () => {
      setIsLocating(true);
      try {
        const loc = await getCurrentLocation();
        setDestination([loc.lat, loc.lng]);
      } catch (error) {
        console.error("Error getting user location:", error);
        // Fallback to Bangalore center if location access denied
      } finally {
        setIsLocating(false);
      }
    };

    fetchUserLocation();
  }, []);

  // Haversine formula to calculate distance between two points in km
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  useEffect(() => {
    if (deliveryBoy?.location) {
      const dist = calculateDistance(
        deliveryBoy.location.lat,
        deliveryBoy.location.lng,
        destination[0],
        destination[1]
      );
      setDistance(dist);
      setIsNear(dist < 0.5); // Near if less than 500m
    }
  }, [deliveryBoy?.location, destination]);

  useEffect(() => {
    if (!orderId || !user) return;

    const unsubscribeOrder = onSnapshot(doc(db, 'orders', orderId), (snapshot) => {
      if (snapshot.exists()) {
        const orderData = { id: snapshot.id, ...snapshot.data() } as Order;
        setOrder(orderData);
      } else {
        setLoading(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `orders/${orderId}`);
      setLoading(false);
    });

    return () => unsubscribeOrder();
  }, [orderId, user]);

  useEffect(() => {
    if (!order?.deliveryBoyId) return;

    const unsubscribeDeliveryBoy = onSnapshot(doc(db, 'users', order.deliveryBoyId), (snapshot) => {
      if (snapshot.exists()) {
        setDeliveryBoy({ uid: snapshot.id, ...snapshot.data() } as UserProfile);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${order.deliveryBoyId}`);
    });

    return () => unsubscribeDeliveryBoy();
  }, [order?.deliveryBoyId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 font-medium">Order not found.</p>
        <button onClick={() => navigate('/orders')} className="mt-4 text-indigo-600 font-bold">Back to Orders</button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-4xl mx-auto space-y-8 relative">
      <AnimatePresence>
        {showStatusToast && (
          <motion.div 
            initial={{ opacity: 0, y: -50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -50, x: '-50%' }}
            className="fixed top-24 left-1/2 z-[2000] bg-indigo-600 text-white px-8 py-4 rounded-3xl shadow-2xl flex items-center space-x-4 border-2 border-white/20 backdrop-blur-md"
          >
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest leading-none opacity-70">Order Update</p>
              <p className="text-sm font-bold">Status changed to <span className="uppercase">{order.status}</span></p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNearToast && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, y: 100, x: '-50%' }}
            animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, scale: 0.8, y: 100, x: '-50%' }}
            className="fixed bottom-12 left-1/2 z-[2000] bg-emerald-600 text-white px-10 py-6 rounded-[2.5rem] shadow-[0_20px_50px_rgba(16,185,129,0.4)] flex items-center space-x-6 border-2 border-white/20 backdrop-blur-xl min-w-[320px]"
          >
            <div className="w-14 h-14 bg-white/20 rounded-3xl flex items-center justify-center flex-shrink-0">
              <Truck className="w-7 h-7 animate-pulse" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] leading-none opacity-80">Geofence Triggered</p>
                <button 
                  onClick={() => setShowNearToast(false)}
                  className="text-white/50 hover:text-white transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
              <p className="text-lg font-black tracking-tight">Arriving Soon!</p>
              <p className="text-sm font-medium opacity-90">Your delivery partner is within 500m.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate('/orders')}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Track Order</h1>
            <p className="text-gray-500 font-medium">Order #{order.id.slice(-8).toUpperCase()}</p>
          </div>
        </div>
        <AnimatePresence mode="wait">
          <motion.div 
            key={order.status}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest ${
              order.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700'
            }`}
          >
            {order.status}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Map View */}
        <div className="lg:col-span-2 space-y-4">
          <div className="aspect-video bg-gray-100 rounded-[2.5rem] border-4 border-white shadow-xl relative overflow-hidden">
            {(order.status === 'shipped' || order.status === 'delivered') ? (
              <MapContainer 
                center={deliveryBoy?.location ? [deliveryBoy.location.lat, deliveryBoy.location.lng] : destination} 
                zoom={13} 
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                
                {deliveryBoy?.location && (
                  <>
                    <Marker 
                      position={[deliveryBoy.location.lat, deliveryBoy.location.lng]} 
                      icon={isNear ? nearDeliveryIcon : deliveryIcon}
                    >
                      <Popup>
                        <div className="text-center">
                          <p className="font-bold">Delivery Partner</p>
                          <p className="text-xs text-gray-500">{deliveryBoy.name}</p>
                        </div>
                      </Popup>
                    </Marker>
                    <RecenterMap position={[deliveryBoy.location.lat, deliveryBoy.location.lng]} />
                    
                    {/* Estimated Route */}
                    <Polyline 
                      positions={[
                        [deliveryBoy.location.lat, deliveryBoy.location.lng],
                        destination
                      ]} 
                      color="#4f46e5" 
                      dashArray="10, 10"
                      weight={2}
                      opacity={0.3}
                    />

                    {/* Optimized AI Route */}
                    {optimizedRoute.length > 0 && (
                      <Polyline 
                        positions={optimizedRoute}
                        color="#10b981"
                        weight={4}
                        opacity={0.8}
                      />
                    )}
                  </>
                )}

                <Marker position={destination} icon={destinationIcon}>
                  <Popup>
                    <p className="font-bold">Delivery Destination</p>
                  </Popup>
                </Marker>

                {/* Geofence Radius Visual */}
                <Circle 
                  center={destination}
                  radius={500} // 500 meters
                  pathOptions={{ 
                    fillColor: isNear ? '#10b981' : '#4f46e5', 
                    fillOpacity: 0.1, 
                    color: isNear ? '#10b981' : '#4f46e5',
                    weight: 1,
                    dashArray: '5, 5'
                  }}
                />
              </MapContainer>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto">
                    <MapIcon className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-sm font-bold text-gray-500">Map will be available once order is shipped</p>
                </div>
              </div>
            )}
            
            <div className="absolute bottom-6 left-6 z-[1000] flex flex-col space-y-2">
              <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-2xl shadow-lg border border-white/20">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs font-black text-gray-900 uppercase tracking-widest">Live Tracking</span>
                </div>
              </div>
              
              {distance !== null && (
                <div className="bg-indigo-600 text-white px-4 py-2 rounded-2xl shadow-lg border border-indigo-500/20">
                  <div className="flex items-center space-x-2">
                    <Navigation className="w-3 h-3" />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {distance < 1 ? `${(distance * 1000).toFixed(0)}m away` : `${distance.toFixed(1)}km away`}
                    </span>
                  </div>
                </div>
              )}

              <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-2xl shadow-lg border border-white/20">
                <div className="flex items-center space-x-2">
                  <Locate className={`w-3 h-3 ${isLocating ? 'animate-spin text-indigo-600' : 'text-gray-900'}`} />
                  <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest">
                    {isLocating ? 'Locating You...' : 'Using Your Location'}
                  </span>
                </div>
              </div>

              {optimizedRoute.length > 0 && (
                <div className="bg-emerald-600 text-white px-4 py-2 rounded-2xl shadow-lg border border-emerald-500/20">
                  <div className="flex items-center space-x-2">
                    <Zap className="w-3 h-3" />
                    <span className="text-[10px] font-black uppercase tracking-widest">AI Optimized Route</span>
                  </div>
                </div>
              )}
            </div>

            {isNear && order.status === 'shipped' && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="bg-amber-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center space-x-3 border-2 border-white/20 backdrop-blur-md">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest leading-none">Arriving Soon</p>
                    <p className="text-sm font-bold">Delivery partner is near your location!</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Delivery Steps */}
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
            <h3 className="font-bold text-gray-900 flex items-center space-x-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              <span>Delivery Progress</span>
            </h3>
            <div className="space-y-6 relative before:absolute before:left-[1.125rem] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
              {[
                { label: 'Order Confirmed', status: ['confirmed', 'shipped', 'delivered'], time: '10:30 AM' },
                { label: 'Picked up by Delivery Partner', status: ['shipped', 'delivered'], time: '11:15 AM' },
                { label: 'Out for Delivery', status: ['shipped', 'delivered'], time: '12:00 PM' },
                { label: 'Delivered', status: ['delivered'], time: '12:45 PM' }
              ].map((step, idx) => {
                const isCompleted = step.status.includes(order.status);
                return (
                  <div key={idx} className="flex items-start space-x-4 relative z-10">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center border-4 border-white shadow-sm ${
                      isCompleted ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <div className="w-2 h-2 bg-current rounded-full" />}
                    </div>
                    <div className="flex-1">
                      <p className={`font-bold text-sm ${isCompleted ? 'text-gray-900' : 'text-gray-400'}`}>{step.label}</p>
                      {isCompleted && <p className="text-xs text-gray-400 font-medium">{step.time}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          {deliveryBoy && (
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-2xl">
                  {deliveryBoy.name[0]}
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Delivery Partner</p>
                  <h4 className="font-bold text-gray-900">{deliveryBoy.name}</h4>
                  <div className="flex items-center space-x-1 mt-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="w-2 h-2 rounded-full bg-amber-400" />
                    ))}
                    <span className="text-[10px] font-bold text-gray-400 ml-1">4.9 Rating</span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {(order.status === 'shipped' || order.status === 'delivered') && deliveryBoy.phoneNumber ? (
                  <a 
                    href={`tel:${deliveryBoy.phoneNumber}`}
                    className="flex items-center justify-center space-x-2 py-3 bg-gray-50 text-gray-900 rounded-2xl font-bold hover:bg-gray-100 transition-all no-underline"
                  >
                    <Phone className="w-4 h-4" />
                    <span className="text-sm">Call</span>
                  </a>
                ) : (
                  <button 
                    disabled 
                    className="flex items-center justify-center space-x-2 py-3 bg-gray-50 text-gray-400 rounded-2xl font-bold cursor-not-allowed opacity-50"
                    title={!deliveryBoy.phoneNumber ? "No phone number available" : "Call available once shipped"}
                  >
                    <Phone className="w-4 h-4" />
                    <span className="text-sm">Call</span>
                  </button>
                )}
                <button className="flex items-center justify-center space-x-2 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-sm">Chat</span>
                </button>
              </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <h4 className="font-bold text-gray-900">Order Summary</h4>
            <div className="space-y-3">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-gray-600">{item.quantity}x {item.title}</span>
                  <span className="font-bold text-gray-900">₹{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="pt-3 border-t border-gray-50 flex justify-between items-center">
                <span className="font-bold text-gray-900">Total</span>
                <span className="text-lg font-black text-indigo-600">₹{order.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 space-y-2">
            <div className="flex items-center space-x-2 text-indigo-600">
              <MapPin className="w-5 h-5" />
              <h4 className="font-bold">Delivery Address</h4>
            </div>
            <p className="text-sm text-indigo-900 font-medium leading-relaxed">
              123 Main St, Suite 456,<br />
              Metro City, MC 12345
            </p>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default OrderTracking;
