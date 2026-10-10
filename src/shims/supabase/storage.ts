import { supabase } from '../../supabase';

const DEFAULT_BUCKET = 'product-media';

interface StorageRef {
  bucket: string;
  path: string;
}

export const storage = {} as Record<string, never>;

export const ref = (_storage: any, path: string): StorageRef => ({ bucket: DEFAULT_BUCKET, path });

export const uploadBytes = async (storageRef: StorageRef, file: Blob | File) => {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.storage.from(storageRef.bucket).upload(storageRef.path, file, { upsert: true });
  if (error) throw error;
  return { ref: storageRef };
};

export const getDownloadURL = async (storageRef: StorageRef) => {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data } = supabase.storage.from(storageRef.bucket).getPublicUrl(storageRef.path);
  return data.publicUrl;
};
