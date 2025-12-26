import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Service to manage multiple database connections for Text-to-SQL queries
 */
@Injectable()
export class MultiDatabaseService {
  private readonly logger = new Logger(MultiDatabaseService.name);
  private dataSources: Map<string, DataSource> = new Map();

  /**
   * Register a database connection
   */
  registerDataSource(name: string, dataSource: DataSource): void {
    this.dataSources.set(name, dataSource);
    this.logger.log(`Registered DataSource: ${name}`);
  }

  /**
   * Get a specific database connection by name
   */
  getDataSource(name: string): DataSource | undefined {
    return this.dataSources.get(name);
  }

  /**
   * Get all registered database connections
   */
  getAllDataSources(): Map<string, DataSource> {
    return this.dataSources;
  }

  /**
   * Detect which database to use based on the question keywords
   * @param question Natural language question
   * @returns Best matching database name
   */
  detectDatabase(question: string): string {
    const normalizedQuestion = question.toLowerCase();

    // Order related keywords - PRIORITY 1 (revenue/sales are calculated from orders)
    if (
      normalizedQuestion.includes('đơn hàng') ||
      normalizedQuestion.includes('order') ||
      normalizedQuestion.includes('doanh thu') ||  // Revenue = Orders
      normalizedQuestion.includes('revenue') ||
      normalizedQuestion.includes('doanh số') ||
      normalizedQuestion.includes('sales') ||
      normalizedQuestion.includes('bán được') ||
      normalizedQuestion.includes('purchase') ||
      normalizedQuestion.includes('mua')
    ) {
      return 'order';
    }

    // Payment related keywords - ONLY for payment-specific queries
    if (
      normalizedQuestion.includes('thanh toán') ||
      normalizedQuestion.includes('payment') ||
      normalizedQuestion.includes('giao dịch') ||
      normalizedQuestion.includes('transaction') ||
      normalizedQuestion.includes('chuyển khoản') ||
      normalizedQuestion.includes('nạp tiền')
    ) {
      return 'payment';
    }

    // Billing/Invoice related keywords (for actual invoices)
    if (
      normalizedQuestion.includes('hóa đơn') ||
      normalizedQuestion.includes('invoice') ||
      normalizedQuestion.includes('bill')
    ) {
      return 'billing';
    }

    // Customer related keywords
    if (
      normalizedQuestion.includes('khách hàng') ||
      normalizedQuestion.includes('customer') ||
      normalizedQuestion.includes('client') ||
      normalizedQuestion.includes('user')
    ) {
      return 'customer';
    }

    // Product/Catalogue related keywords
    if (
      normalizedQuestion.includes('sản phẩm') ||
      normalizedQuestion.includes('product') ||
      normalizedQuestion.includes('catalogue') ||
      normalizedQuestion.includes('item')
    ) {
      return 'catalogue';
    }

    // Subscription related keywords
    if (
      normalizedQuestion.includes('subscription') ||
      normalizedQuestion.includes('gói') ||
      normalizedQuestion.includes('plan')
    ) {
      return 'subscription';
    }

    // Inventory related keywords
    if (
      normalizedQuestion.includes('inventory') ||
      normalizedQuestion.includes('kho') ||
      normalizedQuestion.includes('stock')
    ) {
      return 'inventory';
    }

    // Default to order for financial/revenue queries
    return 'order';
  }

  /**
   * Check if any database is available
   */
  hasAnyDataSource(): boolean {
    return this.dataSources.size > 0;
  }

  /**
   * Get list of available database names
   */
  getAvailableDatabases(): string[] {
    return Array.from(this.dataSources.keys());
  }

  /**
   * Detect database from SQL query by analyzing table names
   * @param sql SQL query string
   * @returns Database name that likely contains the queried tables
   */
  detectDatabaseFromSQL(sql: string): string | null {
    const sqlLower = sql.toLowerCase();
    
    // Check for common table names in each database
    // Order database - check for orders, order_items, order_history
    if (sqlLower.includes('from `orders`') || sqlLower.includes('from orders') || 
        sqlLower.includes('join `orders`') || sqlLower.includes('join orders') ||
        sqlLower.includes('from `order_items`') || sqlLower.includes('from order_items') ||
        sqlLower.includes('from `order_history`') || sqlLower.includes('from order_history')) {
      return 'order';
    }
    
    // Payment database - check for payments, payment_methods, transactions
    if (sqlLower.includes('from `payments`') || sqlLower.includes('from payments') ||
        sqlLower.includes('join `payments`') || sqlLower.includes('join payments') ||
        sqlLower.includes('from `transactions`') || sqlLower.includes('from transactions')) {
      return 'payment';
    }
    
    // Billing database - check for invoices, bills
    if (sqlLower.includes('from `billing`') || sqlLower.includes('from billing') ||
        sqlLower.includes('from `invoices`') || sqlLower.includes('from invoices') ||
        sqlLower.includes('from `bills`') || sqlLower.includes('from bills')) {
      return 'billing';
    }
    
    // Customer database - check for customers, users
    if (sqlLower.includes('from `customers`') || sqlLower.includes('from customers') ||
        sqlLower.includes('from `users`') || sqlLower.includes('from users') ||
        sqlLower.includes('join `customers`') || sqlLower.includes('join customers')) {
      return 'customer';
    }
    
    // Catalogue database - check for products, catalogue items
    if (sqlLower.includes('from `products`') || sqlLower.includes('from products') ||
        sqlLower.includes('from `catalogue`') || sqlLower.includes('from catalogue') ||
        sqlLower.includes('from `items`') || sqlLower.includes('from items')) {
      return 'catalogue';
    }
    
    if (sqlLower.includes('from `subscription`') || sqlLower.includes('from subscription')) {
      return 'subscription';
    }
    
    if (sqlLower.includes('from `inventory`') || sqlLower.includes('from inventory') ||
        sqlLower.includes('from `stock`') || sqlLower.includes('from stock')) {
      return 'inventory';
    }
    
    return null;
  }
}
