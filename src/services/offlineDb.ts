import Dexie, { type Table } from 'dexie';
import { Product, Order } from '../types';

export class OfflineDatabase extends Dexie {
  products!: Table<Product>;
  orders!: Table<Order>;

  constructor() {
    super('P2COfflineDB');
    this.version(1).stores({
      products: 'id, title, category, price, sellerId',
      orders: 'id, buyerId, sellerId, status, timestamp'
    });
  }

  async syncProducts(products: Product[]) {
    await this.products.bulkPut(products);
  }

  async syncOrders(orders: Order[]) {
    await this.orders.bulkPut(orders);
  }

  async getOfflineProducts() {
    return await this.products.toArray();
  }

  async getOfflineOrders(userId: string) {
    return await this.orders.where('buyerId').equals(userId).toArray();
  }
}

export const offlineDb = new OfflineDatabase();
