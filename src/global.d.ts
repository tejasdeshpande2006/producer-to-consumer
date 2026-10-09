declare const db: any;
declare function collection(...segments: any[]): any;
declare function doc(...segments: any[]): any;
declare function query(...parts: any[]): any;
declare function where(field: string, operator: string, value: any): any;
declare function orderBy(field: string, direction?: 'asc' | 'desc'): any;
declare function addDoc(collectionRef: any, payload: any): Promise<any>;
declare function getDoc(ref: any): Promise<any>;
declare function getDocs(queryRef: any): Promise<any>;
declare function updateDoc(ref: any, changes: any): Promise<void>;
declare function deleteDoc(ref: any): Promise<void>;
declare function onSnapshot(...args: any[]): () => void;
declare function serverTimestamp(): any;
declare const OperationType: {
  readonly CREATE: 'create';
  readonly UPDATE: 'update';
  readonly DELETE: 'delete';
  readonly LIST: 'list';
  readonly GET: 'get';
  readonly WRITE: 'write';
};
declare function handleFirestoreError(error: any, operationType: any, path: string | null): any;
declare const EmailAuthProvider: {
  credential(email: string, password: string): any;
};
declare function reauthenticateWithCredential(user: any, credential: any): Promise<void>;
declare function updatePassword(user: any, password: string): Promise<void>;
declare function runTransaction(dbRef: any, updateFn: any): Promise<any>;
