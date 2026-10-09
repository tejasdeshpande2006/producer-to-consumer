import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import GeolocationTracker from './components/GeolocationTracker';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ProducerDashboard from './pages/ProducerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import DeliveryDashboard from './pages/DeliveryDashboard';
import WalletPage from './pages/Wallet';
import CartPage from './pages/Cart';
import ProductDetails from './pages/ProductDetails';
import TransactionHistory from './pages/TransactionHistory';

import OrderHistory from './pages/OrderHistory';
import OrderTracking from './pages/OrderTracking';
import Wishlist from './pages/Wishlist';
import Profile from './pages/Profile';

const ProtectedRoute: React.FC<{ children: React.ReactNode; role?: string }> = ({ children, role }) => {
  const { user, profile, loading, isAdmin } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (role && profile?.role !== role && !isAdmin) return <Navigate to="/" />;

  return <>{children}</>;
};

const DashboardRedirect: React.FC = () => {
  const { profile, loading, isAdmin, isProducer, isDelivery } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (isAdmin) return <Navigate to="/admin" />;
  if (isProducer) return <Navigate to="/producer" />;
  if (isDelivery) return <Navigate to="/delivery" />;
  return <Navigate to="/" />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <GeolocationTracker />
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex flex-col">
          <Navbar />
          <main className="flex-grow w-full">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/product/:id" element={<ProductDetails />} />
              <Route path="/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
              <Route path="/wallet/history" element={<ProtectedRoute><TransactionHistory /></ProtectedRoute>} />
              <Route path="/cart" element={<ProtectedRoute><CartPage /></ProtectedRoute>} />
              <Route path="/wishlist" element={<ProtectedRoute><Wishlist /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/orders" element={<ProtectedRoute><OrderHistory /></ProtectedRoute>} />
              <Route path="/order/track/:orderId" element={<ProtectedRoute><OrderTracking /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><DashboardRedirect /></ProtectedRoute>} />
              <Route path="/producer" element={<ProtectedRoute role="producer"><ProducerDashboard /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
              <Route path="/delivery" element={<ProtectedRoute role="delivery"><DeliveryDashboard /></ProtectedRoute>} />
            </Routes>
          </main>
          <Footer />
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;
