export type UserRole = 'admin' | 'producer' | 'consumer' | 'delivery';

export interface SavedAddress {
  id: string;
  label: string;
  fullName: string;
  phoneNumber: string;
  alternatePhone?: string;
  pincode: string;
  city: string;
  state: string;
  address: string;
  landmark?: string;
  isDefault?: boolean;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phoneNumber?: string;
  smsNotifications?: boolean;
  role: UserRole;
  walletBalance: number;
  isVerified: boolean;
  savedAddresses?: SavedAddress[];
  pendingProfileChanges?: {
    name: string;
    email: string;
    phoneNumber?: string;
    timestamp: any;
  };
  isOnline?: boolean;
  strikes?: number;
  isSuspended?: boolean;
  location?: {
    lat: number;
    lng: number;
    lastUpdated: any;
  };
}

export interface Product {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  images: string[];
  videoUrl?: string;
}

export interface DeliveryDetails {
  fullName: string;
  phoneNumber: string;
  alternatePhone?: string;
  pincode: string;
  city: string;
  state: string;
  address: string;
  landmark?: string;
}

export interface Order {
  id: string;
  buyerId: string;
  buyerName?: string;
  shippingAddress?: string;
  deliveryDetails?: DeliveryDetails;
  sellerId: string;
  deliveryBoyId?: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'returned' | 'return_requested';
  totalAmount: number;
  timestamp: any;
  items: {
    productId: string;
    title: string;
    price: number;
    quantity: number;
  }[];
  returnRequest?: {
    reason: string;
    description: string;
    requestedAt: any;
    status: 'pending' | 'approved' | 'rejected';
    processedAt?: any;
    rejectionReason?: string;
  };
}

export interface WalletTransaction {
  id: string;
  amount: number;
  type: 'credit' | 'debit';
  timestamp: any;
  description: string;
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  timestamp: any;
}

export interface WishlistItem {
  id: string;
  userId: string;
  productId: string;
  timestamp: any;
}
