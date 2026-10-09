import fs from 'fs';
import crypto from 'crypto';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp as initializeClientApp, getApps as getClientApps } from 'firebase/app';
import {
  getFirestore as getClientFirestore,
  collection as getClientCollection,
  limit as getClientLimit,
  query as getClientQuery,
  getDocs as getClientDocs,
  doc as getClientDoc,
  getDoc as getClientGetDoc,
  setDoc as getClientSetDoc,
  serverTimestamp as getClientServerTimestamp,
  increment as getClientIncrement,
  runTransaction
} from 'firebase/firestore';

// Generate a unique ID similar to Firestore's auto-generated IDs
const generateUniqueId = (): string => {
  return crypto.randomBytes(10).toString('hex').substring(0, 20);
};

// ------------------------
// Logging Setup
// ------------------------
const debugLogPath = './debug.log';
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

const writeToLogFile = (msg: string) => {
  fs.appendFileSync(debugLogPath, msg + '\n');
};

console.log = (...args: any[]) => {
  const msg = `[LOG] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`;
  writeToLogFile(msg);
  originalLog(...args);
};
console.warn = (...args: any[]) => {
  const msg = `[WARN] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`;
  writeToLogFile(msg);
  originalWarn(...args);
};
console.error = (...args: any[]) => {
  const msg = `[ERROR] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`;
  writeToLogFile(msg);
  originalError(...args);
};

console.log('Logging system initialized');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------------------------
// Firebase Initialization
// ------------------------
let db: any = null;

const initializeDb = async () => {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    let firebaseConfig: any = {};
    if (fs.existsSync(configPath)) {
      firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.log('Firebase config loaded for project:', firebaseConfig.projectId);
    }

    const configProjectId = firebaseConfig.projectId;
    if (configProjectId) {
      process.env.GOOGLE_CLOUD_PROJECT = configProjectId;
      process.env.PROJECT_ID = configProjectId;
      console.log(`Forced GOOGLE_CLOUD_PROJECT to ${configProjectId}`);
    }

    const envProjectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID;
    console.log(`Firebase Project Detection: Env=${envProjectId}, Config=${configProjectId}`);

    // Helper to test Firestore connection
    const testConnection = async (app: any, dbId: string) => {
      try {
        const tDb = getFirestore(app, dbId);
        await tDb.collection('health_check').limit(1).get();
        await tDb.collection('health_check').doc('connection_test').set({
          lastChecked: FieldValue.serverTimestamp(),
          env: process.env.NODE_ENV || 'development'
        });
        return tDb;
      } catch (err: any) {
        console.warn(`Connection test failed for db "${dbId}" in project "${app.options.projectId}": ${err.message}`);
        return null;
      }
    };

    // ------------------------
    // Strategy 0: Admin SDK default
    // ------------------------
    try {
      const appDefault = initializeApp({}, 'default-ambient');
      let workingDb0 = await testConnection(appDefault, firebaseConfig.firestoreDatabaseId || '(default)');
      if (workingDb0) db = workingDb0;
      else workingDb0 = await testConnection(appDefault, '(default)');
      if (workingDb0) db = workingDb0;
    } catch (err: any) {
      console.warn('Strategy 0 failed:', err.message);
    }

    // ------------------------
    // Strategy 1/2: Config Project
    // ------------------------
    if (!db && configProjectId) {
      try {
        const appConfig = initializeApp({ projectId: configProjectId }, 'config-project');
        let workingDb1 = await testConnection(appConfig, firebaseConfig.firestoreDatabaseId || '(default)');
        if (workingDb1) db = workingDb1;
        else {
          let workingDb2 = await testConnection(appConfig, '(default)');
          if (workingDb2) db = workingDb2;
        }
      } catch (err: any) {
        console.warn('Strategy 1/2 failed:', err.message);
      }
    }

    // ------------------------
    // Strategy 3/4: Env Project
    // ------------------------
    if (!db && envProjectId && envProjectId !== configProjectId) {
      try {
        const appEnv = initializeApp({ projectId: envProjectId }, 'env-project');
        let workingDb3 = await testConnection(appEnv, firebaseConfig.firestoreDatabaseId || '(default)');
        if (workingDb3) db = workingDb3;
        else {
          let workingDb4 = await testConnection(appEnv, '(default)');
          if (workingDb4) db = workingDb4;
        }
      } catch (err: any) {
        console.warn('Strategy 3/4 failed:', err.message);
      }
    }

    // ------------------------
    // Strategy 5: Client SDK fallback
    // ------------------------
    if (!db) {
      try {
        const clientApp = getClientApps().length === 0 ? initializeClientApp(firebaseConfig) : getClientApps()[0];
        const clientDb = getClientFirestore(clientApp, firebaseConfig.firestoreDatabaseId || '(default)');

        // Fixed shim to support subcollections
        const createDocShim = (docRef: any) => {
          if (!docRef) return null;
          return {
            __isShim: true,
            _ref: docRef,
            id: docRef.id,
            path: docRef.path,
            get: () => getClientGetDoc(docRef).then(d => ({ exists: () => d.exists(), data: () => d.data() })),
            set: (data: any) => getClientSetDoc(docRef, data),
            update: (data: any) => getClientSetDoc(docRef, data, { merge: true }),
            delete: () => getClientSetDoc(docRef, {}, { merge: false }),
            collection: (subPath: string) => ({
              doc: (subId?: string) => createDocShim(getClientDoc(clientDb, `${docRef.path}/${subPath}`, subId || generateUniqueId()))
            })
          };
        };

        const getRealRef = (ref: any) => ref.__isShim && ref._ref ? ref._ref : ref;

        db = {
          collection: (path: string) => ({
            doc: (id?: string) => createDocShim(getClientDoc(clientDb, path, id || generateUniqueId())),
            limit: (n: number) => ({
              get: () => getClientDocs(getClientQuery(getClientCollection(clientDb, path), getClientLimit(n)))
            })
          }),
          runTransaction: async (updateFunction: any) => {
            return runTransaction(clientDb, async (transaction) => {
              return updateFunction({
                get: (ref: any) => transaction.get(getRealRef(ref)).then(d => ({ exists: () => d.exists(), data: () => d.data() })),
                set: (ref: any, data: any) => transaction.set(getRealRef(ref), data),
                update: (ref: any, data: any) => transaction.update(getRealRef(ref), data),
                delete: (ref: any) => transaction.delete(getRealRef(ref))
              });
            });
          },
          FieldValue: { serverTimestamp: () => getClientServerTimestamp(), increment: (n: number) => getClientIncrement(n) },
          projectId: firebaseConfig.projectId,
          databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
          isClientSDK: true
        };

        // Test write
        await db.collection('health_check').doc('strategy5_test').set({ lastChecked: getClientServerTimestamp() });
        console.log('Strategy 5 succeeded');
      } catch (err: any) {
        console.warn('Strategy 5 failed:', err.message);
      }
    }

    if (!db) console.error('ALL initialization strategies failed.');
  } catch (error) {
    console.error('Critical failure in initializeDb:', error);
  }
};

// ------------------------
// Firestore Error Handler
// ------------------------
const handleFirestoreError = (error: any, operationType: string, path: string | null) => {
  const errInfo = {
    error: error.message || String(error),
    operationType,
    path,
    projectId: db?.projectId || 'unknown',
    databaseId: db?.databaseId || 'unknown',
    code: error.code || 'unknown'
  };
  console.error('Firestore Error Details:', JSON.stringify(errInfo, null, 2));
  return errInfo;
};

// ------------------------
// Server
// ------------------------
async function startServer() {
  console.log('Starting server...');
  await initializeDb();

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get('/api/health', async (req, res) => {
    let dbStatus = 'not_initialized';
    let dbTest = 'not_tested';
    let dbError = null;
    let currentDbId = 'unknown';

    if (db) {
      dbStatus = 'initialized';
      currentDbId = db.databaseId || 'unknown';
      try {
        await db.collection('health_check').limit(1).get();
        dbTest = 'success';
      } catch (error: any) {
        dbTest = 'failed';
        dbError = error.message;
      }
    }

    res.json({
      status: 'ok',
      dbStatus,
      dbTest,
      dbError,
      currentDbId,
      projectId: db?.projectId || 'unknown',
      env: {
        GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
        PROJECT_ID: process.env.PROJECT_ID,
        NODE_ENV: process.env.NODE_ENV
      },
      timestamp: new Date().toISOString()
    });
  });

  const SERVER_KEY = "ai-studio-server-key-123";

  // Add Money
  app.post('/api/wallet/addMoney', async (req, res) => {
    if (!db) return res.status(500).json({ error: 'Database not initialized' });
    const { userId, amount } = req.body;
    if (!userId || !amount || amount <= 0) return res.status(400).json({ error: 'Invalid parameters' });

    try {
      const fv = db.FieldValue || FieldValue;
      const userRef = db.collection('users').doc(userId);
      const transactionRef = userRef.collection('walletTransactions').doc();

      await db.runTransaction(async (t: any) => {
        const userDoc = await t.get(userRef);
        if (!userDoc.exists) throw new Error('User not found');
        const currentBalance = userDoc.data()?.walletBalance || 0;

        t.update(userRef, { walletBalance: currentBalance + Number(amount), serverKey: SERVER_KEY });
        t.set(transactionRef, {
          amount: Number(amount),
          type: 'credit',
          timestamp: fv.serverTimestamp(),
          description: 'Money Added',
          serverKey: SERVER_KEY
        });
      });

      res.json({ success: true });
    } catch (error: any) {
      const errInfo = handleFirestoreError(error, 'addMoney', `users/${req.body.userId}`);
      res.status(500).json({ error: errInfo.error, details: errInfo });
    }
  });

  // Purchase
  app.post('/api/wallet/purchase', async (req, res) => {
    if (!db) return res.status(500).json({ error: 'Database not initialized' });

    const { userId, orderDetails, cartItemIds } = req.body;
    const { totalAmount, items, sellerId } = orderDetails;

    if (!userId || !totalAmount || !items) return res.status(400).json({ error: 'Invalid parameters' });

    // Calculate platform fee (5% of total before GST)
    // totalAmount already includes 5% fee from cart
    // Base amount = totalAmount / 1.05
    const baseAmount = totalAmount / 1.05;
    const platformFee = totalAmount - baseAmount;

    try {
      const userRef = db.collection('users').doc(userId);
      let userSnap;
      try { userSnap = await userRef.get(); } catch (err: any) {
        const errInfo = handleFirestoreError(err, 'get_user', `users/${userId}`);
        if (err.message.includes('PERMISSION_DENIED')) return res.status(500).json({ error: 'Permission denied', details: errInfo });
        throw err;
      }

      if (!userSnap.exists) return res.status(404).json({ error: `User profile not found for ID: ${userId}` });

      // Find admin user to credit platform fee
      let adminId: string | null = null;
      try {
        const usersCollection = db.collection('users');
        const adminQuery = await usersCollection.limit(100).get();
        for (const doc of adminQuery.docs) {
          const data = doc.data();
          if (data.role === 'admin' || data.email === 'vpk525252@gmail.com') {
            adminId = doc.id;
            break;
          }
        }
      } catch (err) {
        console.warn('Could not find admin user for fee credit:', err);
      }

      const orderRef = db.collection('orders').doc();
      const transactionRef = userRef.collection('walletTransactions').doc();
      const fv = db.FieldValue || FieldValue;

      await db.runTransaction(async (t: any) => {
        const userDoc = await t.get(userRef);
        const currentBalance = userDoc.data()?.walletBalance || 0;
        if (currentBalance < totalAmount) throw new Error(`Insufficient funds`);
        let adminRef: any = null;
        let adminBalance = 0;

        // Firestore transactions require all reads to happen before writes.
        if (adminId) {
          adminRef = db.collection('users').doc(adminId);
          const adminDoc = await t.get(adminRef);
          adminBalance = adminDoc.data()?.walletBalance || 0;
        }

        // Deduct full amount from buyer
        t.update(userRef, { walletBalance: currentBalance - totalAmount, serverKey: SERVER_KEY });
        t.set(transactionRef, {
          amount: totalAmount,
          type: 'debit',
          timestamp: fv.serverTimestamp(),
          description: `Purchase of ${items.length} item(s) (includes ₹${platformFee.toFixed(2)} platform fee)`,
          serverKey: SERVER_KEY
        });

        // Credit admin wallet with platform fee (5%)
        if (adminRef) {
          t.update(adminRef, { 
            walletBalance: adminBalance + platformFee, 
            serverKey: SERVER_KEY 
          });
          
          const adminTransRef = adminRef.collection('walletTransactions').doc();
          t.set(adminTransRef, {
            amount: platformFee,
            type: 'credit',
            timestamp: fv.serverTimestamp(),
            description: `Platform fee (5%) from order ${orderRef.id.slice(0, 8)}`,
            serverKey: SERVER_KEY
          });
        }

        // Create order record
        t.set(orderRef, {
          buyerId: userId,
          buyerName: userDoc.data()?.name || 'Unknown Buyer',
          shippingAddress: orderDetails.shippingAddress || '123 Main St, Suite 456, Metro City',
          deliveryDetails: orderDetails.deliveryDetails || null,
          sellerId: sellerId || 'demo_seller',
          status: 'pending',
          totalAmount: totalAmount,
          baseAmount: baseAmount,
          platformFee: platformFee,
          timestamp: fv.serverTimestamp(),
          items: items,
          serverKey: SERVER_KEY
        });

        if (cartItemIds && Array.isArray(cartItemIds)) {
          for (const itemId of cartItemIds) {
            const cartItemRef = userRef.collection('cart').doc(itemId);
            t.delete(cartItemRef);
          }
        }
      });

      res.json({ success: true, orderId: orderRef.id });
    } catch (error: any) {
      const errInfo = handleFirestoreError(error, 'purchase_transaction', `users/${userId}`);
      res.status(500).json({ error: errInfo.error, details: errInfo });
    }
  });

  // Vite dev
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ 
      server: { 
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true' ? {
          overlay: false,
        } : false,
      }, 
      appType: 'spa' 
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://localhost:${PORT}`));
}

startServer().catch(err => console.error('Failed to start server:', err));
