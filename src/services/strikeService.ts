import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, updateDoc, increment, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Order, UserProfile } from '../types';

export const processOrderReturn = async (order: Order) => {
  try {
    const sellerRef = doc(db, 'users', order.sellerId);
    const sellerSnap = await getDoc(sellerRef);
    
    if (!sellerSnap.exists()) return;
    
    const sellerData = sellerSnap.data() as UserProfile;
    const currentStrikes = (sellerData.strikes || 0) + 1;
    
    let penaltyAmount = 0;
    let isSuspended = false;
    let notificationMessage = '';

    if (currentStrikes === 1) {
      notificationMessage = `Order #${order.id.slice(-8).toUpperCase()} has been returned. This is your first strike. Please ensure product quality to avoid penalties.`;
    } else if (currentStrikes === 2) {
      penaltyAmount = order.totalAmount * 0.6;
      notificationMessage = `Order #${order.id.slice(-8).toUpperCase()} has been returned. This is your second strike. A 60% penalty (₹${penaltyAmount.toFixed(2)}) has been applied.`;
      
      // Deduct from seller wallet
      await updateDoc(sellerRef, {
        walletBalance: increment(-penaltyAmount)
      });

      // Add transaction record for penalty in seller's wallet history
      const sellerWalletTxRef = collection(db, 'users', order.sellerId, 'walletTransactions');
      await addDoc(sellerWalletTxRef, {
        amount: penaltyAmount,
        type: 'debit',
        timestamp: serverTimestamp(),
        description: `60% penalty for 2nd strike on order #${order.id.slice(-8).toUpperCase()}`
      });

      // Add global transaction record for administrative logging
      await addDoc(collection(db, 'transactions'), {
        userId: order.sellerId,
        amount: -penaltyAmount,
        type: 'penalty',
        description: `60% penalty for 2nd strike on order #${order.id.slice(-8).toUpperCase()}`,
        timestamp: serverTimestamp()
      });
    } else if (currentStrikes >= 3) {
      isSuspended = true;
      notificationMessage = `Your account has been suspended due to 3 or more returned orders. Please contact an administrator to appeal.`;
    }

    // Update seller strikes and suspension status
    await updateDoc(sellerRef, {
      strikes: currentStrikes,
      isSuspended: isSuspended
    });

    // Update order status
    await updateDoc(doc(db, 'orders', order.id), {
      status: 'returned'
    });

    // Refund buyer
    const buyerRef = doc(db, 'users', order.buyerId);
    await updateDoc(buyerRef, {
      walletBalance: increment(order.totalAmount)
    });

    // Add transaction record for refund in buyer's wallet history
    const buyerWalletTxRef = collection(db, 'users', order.buyerId, 'walletTransactions');
    await addDoc(buyerWalletTxRef, {
      amount: order.totalAmount,
      type: 'credit',
      timestamp: serverTimestamp(),
      description: `Refund for returned order #${order.id.slice(-8).toUpperCase()}`
    });

    // Add global transaction record for refund
    await addDoc(collection(db, 'transactions'), {
      userId: order.buyerId,
      amount: order.totalAmount,
      type: 'refund',
      description: `Refund for returned order #${order.id.slice(-8).toUpperCase()}`,
      timestamp: serverTimestamp()
    });

    // Add notification for seller
    await addDoc(collection(db, 'notifications'), {
      userId: order.sellerId,
      title: isSuspended ? 'Account Suspended' : 'Order Returned - Strike Applied',
      message: notificationMessage,
      type: isSuspended ? 'error' : 'warning',
      read: false,
      timestamp: serverTimestamp()
    });

    return { success: true, strikes: currentStrikes, suspended: isSuspended };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'orders/return');
    return { success: false, error };
  }
};
