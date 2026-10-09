import React from 'react';
import { Link } from 'react-router-dom';
import { Github, Twitter, Instagram, Mail, Phone, MapPin } from 'lucide-react';
import P2CLogo from './P2CLogo';
import { motion } from 'motion/react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-gray-100 pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-1">
            <Link to="/" className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                <P2CLogo className="w-6 h-6" />
              </div>
              <span className="text-2xl font-black tracking-tighter text-gray-900">P2C<span className="text-indigo-600">.</span></span>
            </Link>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              Connecting local producers directly with consumers. Fresh, authentic, and sustainable products delivered to your doorstep.
            </p>
            <div className="flex space-x-4">
              {[Github, Twitter, Instagram].map((Icon, i) => (
                <motion.a
                  key={i}
                  href="#"
                  whileHover={{ y: -3, color: '#4f46e5' }}
                  className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 transition-colors hover:bg-indigo-50"
                >
                  <Icon className="w-5 h-5" />
                </motion.a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-6">Quick Links</h4>
            <ul className="space-y-4">
              {['Browse Products', 'My Orders', 'Wallet', 'Wishlist'].map((item) => (
                <li key={item}>
                  <Link to="/" className="text-sm text-gray-500 hover:text-indigo-600 transition-colors font-medium">
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-6">Support</h4>
            <ul className="space-y-4">
              {['Help Center', 'Terms of Service', 'Privacy Policy', 'Contact Us'].map((item) => (
                <li key={item}>
                  <Link to="/" className="text-sm text-gray-500 hover:text-indigo-600 transition-colors font-medium">
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-6">Contact</h4>
            <ul className="space-y-4">
              <li className="flex items-start space-x-3 text-sm text-gray-500">
                <MapPin className="w-5 h-5 text-indigo-600 shrink-0" />
                <span>123 Market Street, City Center, IN 400001</span>
              </li>
              <li className="flex items-center space-x-3 text-sm text-gray-500">
                <Phone className="w-5 h-5 text-indigo-600 shrink-0" />
                <span>+91 98765 43210</span>
              </li>
              <li className="flex items-center space-x-3 text-sm text-gray-500">
                <Mail className="w-5 h-5 text-indigo-600 shrink-0" />
                <span>support@p2c.com</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-50 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <p className="text-xs font-medium text-gray-400">
            © 2026 P2C Marketplace. All rights reserved.
          </p>
          <div className="flex items-center space-x-6">
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Visa_Inc._logo.svg/2560px-Visa_Inc._logo.svg.png" alt="Visa" className="h-4 opacity-30 grayscale hover:grayscale-0 transition-all cursor-pointer" />
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/1280px-Mastercard-logo.svg.png" alt="Mastercard" className="h-6 opacity-30 grayscale hover:grayscale-0 transition-all cursor-pointer" />
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/PayPal.svg/1200px-PayPal.svg.png" alt="PayPal" className="h-4 opacity-30 grayscale hover:grayscale-0 transition-all cursor-pointer" />
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
