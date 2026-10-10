import { supabase, buildSupabaseProfilePayload, mapSupabaseProfile, type SupabaseProfileRow } from '../../supabase';

type AnyRecord = Record<string, any>;

type RefKind = 'collection' | 'doc';

interface BaseRef {
  kind: RefKind;
  path: string;
  id?: string;
}

interface QueryConstraint {
  type: 'where' | 'orderBy' | 'limit';
  field?: string;
  op?: string;
  value?: any;
  direction?: 'asc' | 'desc';
  count?: number;
}

interface QueryRef {
  collectionRef: BaseRef;
  constraints: QueryConstraint[];
}

const TABLE_MAP: Record<string, string> = {
  users: 'profiles',
  products: 'products',
  orders: 'orders',
  reviews: 'reviews',
  wishlist: 'wishlist',
  cart: 'cart',
  transactions: 'transactions',
  notifications: 'notifications',
  health_check: 'health_check',
};

export const db = {} as Record<string, never>;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export const handleFirestoreError = (error: unknown, operationType: OperationType | string, path: string | null) => {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: undefined,
      email: undefined,
      emailVerified: undefined,
      isAnonymous: undefined,
      tenantId: undefined,
      providerInfo: [],
    },
  };
  console.error('Supabase Shim Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

export function toDate(timestamp: any): Date | null {
  if (!timestamp) return null;
  if (typeof timestamp.toDate === 'function') return timestamp.toDate();
  if (typeof timestamp.seconds === 'number') return new Date(timestamp.seconds * 1000);
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'string' || typeof timestamp === 'number') return new Date(timestamp);
  return null;
}

const camelToSnake = (value: string) => value.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);

const snakeToCamel = (value: string) => value.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());

const normalizeRow = (table: string, row: AnyRecord): AnyRecord => {
  if (!row) return row;

  if (table === 'profiles') {
    return mapSupabaseProfile(row as SupabaseProfileRow);
  }

  const normalized: AnyRecord = {};
  Object.entries(row).forEach(([key, value]) => {
    const camelKey = snakeToCamel(key);
    normalized[camelKey] = value;
  });

  if (table === 'transactions') {
    normalized.type = row.transaction_type || row.type || 'credit';
  }

  if (table === 'orders' && row.return_request) {
    normalized.returnRequest = row.return_request;
  }

  return normalized;
};

const serializeRow = (table: string, data: AnyRecord): AnyRecord => {
  if (table === 'profiles') {
    return buildSupabaseProfilePayload({
      uid: data.uid || data.id,
      email: data.email || '',
      name: data.name,
      phoneNumber: data.phoneNumber,
      smsNotifications: data.smsNotifications,
      role: data.role,
      walletBalance: data.walletBalance,
      isVerified: data.isVerified,
      isOnline: data.isOnline,
      strikes: data.strikes,
      isSuspended: data.isSuspended,
      savedAddresses: data.savedAddresses,
      pendingProfileChanges: data.pendingProfileChanges,
      location: data.location,
    });
  }

  const payload: AnyRecord = {};
  Object.entries(data).forEach(([key, value]) => {
    if (key === 'id') return;
    if (key === 'type' && table === 'transactions') {
      payload.transaction_type = value;
      return;
    }
    if (key === 'returnRequest' && table === 'orders') {
      payload.return_request = value;
      return;
    }
    if (key === 'deliveryDetails' && table === 'orders') {
      payload.delivery_details = value;
      return;
    }
    if (key === 'buyerName' && table === 'orders') {
      payload.buyer_name = value;
      return;
    }
    if (key === 'shippingAddress' && table === 'orders') {
      payload.shipping_address = value;
      return;
    }
    if (key === 'deliveryBoyId' && table === 'orders') {
      payload.delivery_boy_id = value;
      return;
    }
    if (key === 'sellerId' && table === 'products') {
      payload.seller_id = value;
      return;
    }
    if (key === 'sellerId' && table === 'orders') {
      payload.seller_id = value;
      return;
    }
    if (key === 'buyerId' && table === 'orders') {
      payload.buyer_id = value;
      return;
    }
    if (key === 'productId' && ['reviews', 'wishlist', 'cart', 'order_items'].includes(table)) {
      payload.product_id = value;
      return;
    }
    payload[camelToSnake(key)] = value;
  });
  return payload;
};

const parsePath = (path: string) => {
  const segments = path.split('/').filter(Boolean);
  if (segments[0] === 'users' && segments.length >= 3) {
    if (segments[2] === 'cart') return { table: 'cart', filters: { user_id: segments[1] } };
    if (segments[2] === 'wishlist') return { table: 'wishlist', filters: { user_id: segments[1] } };
    if (segments[2] === 'walletTransactions') return { table: 'transactions', filters: { user_id: segments[1] } };
  }

  const table = TABLE_MAP[segments[0]] || segments[0];
  const filters: AnyRecord = {};
  if (segments.length >= 2) {
    filters.id = segments[1];
  }
  return { table, filters };
};

const applyConstraints = (rows: AnyRecord[], constraints: QueryConstraint[]) => {
  let filtered = [...rows];

  constraints.forEach((constraint) => {
    if (constraint.type === 'where' && constraint.field) {
      filtered = filtered.filter((row) => {
        const left = row[constraint.field!];
        const right = constraint.value;
        switch (constraint.op) {
          case '==': return left === right;
          case '!=': return left !== right;
          case '>': return left > right;
          case '>=': return left >= right;
          case '<': return left < right;
          case '<=': return left <= right;
          default: return true;
        }
      });
    }
  });

  constraints.forEach((constraint) => {
    if (constraint.type === 'orderBy' && constraint.field) {
      const direction = constraint.direction || 'asc';
      filtered.sort((a, b) => {
        const left = a[constraint.field!];
        const right = b[constraint.field!];
        if (left === right) return 0;
        if (left === undefined || left === null) return 1;
        if (right === undefined || right === null) return -1;
        return left > right ? (direction === 'asc' ? 1 : -1) : (direction === 'asc' ? -1 : 1);
      });
    }
  });

  const limitConstraint = constraints.find((constraint) => constraint.type === 'limit');
  if (limitConstraint?.count) {
    filtered = filtered.slice(0, limitConstraint.count);
  }

  return filtered;
};

const makeDocSnapshot = (id: string, data: AnyRecord | null) => ({
  id,
  exists: () => !!data,
  data: () => data,
});

const makeQuerySnapshot = (rows: AnyRecord[]) => ({
  docs: rows.map((row) => makeDocSnapshot(row.id, row)),
  empty: rows.length === 0,
  size: rows.length,
});

const getTableRows = async (ref: BaseRef | QueryRef) => {
  if (!supabase) return [] as AnyRecord[];

  const baseRef = 'collectionRef' in ref ? ref.collectionRef : ref;
  const { table, filters } = parsePath(baseRef.path);

  let queryBuilder = supabase.from(table).select('*');
  Object.entries(filters).forEach(([key, value]) => {
    queryBuilder = queryBuilder.eq(key, value);
  });

  if ('constraints' in ref) {
    ref.constraints.forEach((constraint) => {
      if (constraint.type === 'where' && constraint.field) {
        switch (constraint.op) {
          case '==': queryBuilder = queryBuilder.eq(constraint.field, constraint.value); break;
          case '!=': queryBuilder = queryBuilder.neq(constraint.field, constraint.value); break;
          case '>': queryBuilder = queryBuilder.gt(constraint.field, constraint.value); break;
          case '>=': queryBuilder = queryBuilder.gte(constraint.field, constraint.value); break;
          case '<': queryBuilder = queryBuilder.lt(constraint.field, constraint.value); break;
          case '<=': queryBuilder = queryBuilder.lte(constraint.field, constraint.value); break;
        }
      }
      if (constraint.type === 'orderBy' && constraint.field) {
        queryBuilder = queryBuilder.order(constraint.field, { ascending: constraint.direction !== 'desc' });
      }
      if (constraint.type === 'limit' && constraint.count) {
        queryBuilder = queryBuilder.limit(constraint.count);
      }
    });
  }

  const { data, error } = await queryBuilder;
  if (error) throw error;
  return (data || []).map((row) => normalizeRow(table, row as AnyRecord));
};

const getDocData = async (ref: BaseRef) => {
  const { table, filters } = parsePath(ref.path);
  if (!supabase) return null;

  let queryBuilder = supabase.from(table).select('*');
  Object.entries(filters).forEach(([key, value]) => {
    queryBuilder = queryBuilder.eq(key, value);
  });

  if (ref.id && !filters.id) {
    queryBuilder = queryBuilder.eq('id', ref.id);
  }

  const { data, error } = await queryBuilder.maybeSingle();
  if (error) throw error;
  return data ? normalizeRow(table, data as AnyRecord) : null;
};

export const collection = (_root: any, ...segments: string[]) => ({ kind: 'collection', path: segments.join('/') } as BaseRef);

export const doc = (_root: any, ...segments: string[]) => {
  const path = segments.join('/');
  const parts = path.split('/').filter(Boolean);
  return { kind: 'doc', path, id: parts[parts.length - 1] } as BaseRef;
};

export const query = (collectionRef: BaseRef, ...constraints: QueryConstraint[]) => ({ collectionRef, constraints } as QueryRef);

export const where = (field: string, op: string, value: any) => ({ type: 'where', field, op, value } as QueryConstraint);
export const orderBy = (field: string, direction: 'asc' | 'desc' = 'asc') => ({ type: 'orderBy', field, direction } as QueryConstraint);
export const limit = (count: number) => ({ type: 'limit', count } as QueryConstraint);

export const getDoc = async (ref: BaseRef) => ({ ...makeDocSnapshot(ref.id || ref.path.split('/').pop() || '', await getDocData(ref)) });
export const getDocs = async (ref: BaseRef | QueryRef) => makeQuerySnapshot(applyConstraints(await getTableRows(ref), 'constraints' in ref ? ref.constraints : []));

export const onSnapshot = (ref: BaseRef | QueryRef, next: (snapshot: any) => void, error?: (err: unknown) => void) => {
  let cancelled = false;

  const run = async () => {
    try {
      const snapshot = 'constraints' in ref ? await getDocs(ref) : await getDoc(ref);
      if (!cancelled) {
        next(snapshot);
      }
    } catch (err) {
      if (!cancelled && error) {
        error(err);
      }
    }
  };

  void run();

  return () => {
    cancelled = true;
  };
};

export const serverTimestamp = () => new Date().toISOString();
export const increment = (amount: number) => ({ __increment: amount });
export const arrayUnion = (...values: any[]) => ({ __arrayUnion: values });
export const arrayRemove = (...values: any[]) => ({ __arrayRemove: values });

const applyIncrement = (existing: AnyRecord, update: AnyRecord) => {
  const result = { ...existing };
  Object.entries(update).forEach(([key, value]) => {
    if (value && typeof value === 'object' && '__increment' in value) {
      result[key] = Number(result[key] || 0) + Number(value.__increment || 0);
      return;
    }
    result[key] = value;
  });
  return result;
};

const upsertByPath = async (ref: BaseRef, data: AnyRecord, merge = true) => {
  if (!supabase) return;
  const { table, filters } = parsePath(ref.path);
  const existing = await getDocData(ref);
  const payload = serializeRow(table, data);

  if (existing && merge) {
    const merged = applyIncrement(existing, payload);
    const { error } = await supabase.from(table).upsert(merged);
    if (error) throw error;
    return;
  }

  const row = { ...payload };
  if (!row.id) row.id = ref.id || crypto.randomUUID();
  Object.entries(filters).forEach(([key, value]) => {
    if (row[key] === undefined) row[key] = value;
  });
  const { error } = await supabase.from(table).upsert(row);
  if (error) throw error;
};

export const setDoc = async (ref: BaseRef, data: AnyRecord, options?: { merge?: boolean }) => upsertByPath(ref, data, options?.merge ?? false);

export const updateDoc = async (ref: BaseRef, data: AnyRecord) => upsertByPath(ref, data, true);

export const addDoc = async (collectionRef: BaseRef, data: AnyRecord) => {
  const id = crypto.randomUUID();
  await setDoc({ ...collectionRef, kind: 'doc', id, path: `${collectionRef.path}/${id}` }, data, { merge: false });
  return { id };
};

export const deleteDoc = async (ref: BaseRef) => {
  if (!supabase) return;
  const { table, filters } = parsePath(ref.path);
  let queryBuilder = supabase.from(table).delete();
  Object.entries(filters).forEach(([key, value]) => {
    queryBuilder = queryBuilder.eq(key, value);
  });
  if (ref.id && !filters.id) queryBuilder = queryBuilder.eq('id', ref.id);
  const { error } = await queryBuilder;
  if (error) throw error;
};

export const runTransaction = async (_db: any, updateFunction: any) => updateFunction({
  get: async (ref: BaseRef) => getDoc(ref),
  set: async (ref: BaseRef, data: AnyRecord) => setDoc(ref, data),
  update: async (ref: BaseRef, data: AnyRecord) => updateDoc(ref, data),
  delete: async (ref: BaseRef) => deleteDoc(ref),
});

export const writeBatch = () => {
  const ops: Array<() => Promise<void>> = [];
  return {
    set: (ref: BaseRef, data: AnyRecord, options?: { merge?: boolean }) => ops.push(() => setDoc(ref, data, options)),
    update: (ref: BaseRef, data: AnyRecord) => ops.push(() => updateDoc(ref, data)),
    delete: (ref: BaseRef) => ops.push(() => deleteDoc(ref)),
    commit: async () => {
      for (const op of ops) await op();
    },
  };
};
