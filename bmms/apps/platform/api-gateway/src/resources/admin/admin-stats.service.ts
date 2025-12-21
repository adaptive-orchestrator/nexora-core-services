import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import { of } from 'rxjs';

interface IOrderGrpcService {
  getOrderStats(data: any): any;
}

interface ISubscriptionGrpcService {
  getSubscriptionStats(data: any): any;
}

interface ICustomerGrpcService {
  getAllCustomers(data: any): any;
}

type BusinessModel = 'retail' | 'subscription' | 'freemium' | 'multi';

// Define which services are needed for each business model
const MODEL_SERVICES: Record<BusinessModel, string[]> = {
  retail: ['order', 'customer'],
  subscription: ['subscription', 'customer'],
  freemium: ['customer'],
  multi: ['order', 'subscription', 'customer'],
};

@Injectable()
export class AdminStatsService implements OnModuleInit {
  private readonly logger = new Logger(AdminStatsService.name);
  private orderService: IOrderGrpcService;
  private subscriptionService: ISubscriptionGrpcService;
  private customerService: ICustomerGrpcService;

  constructor(
    @Inject('ORDER_PACKAGE') private orderClient: ClientGrpc,
    @Inject('SUBSCRIPTION_PACKAGE') private subscriptionClient: ClientGrpc,
    @Inject('CUSTOMER_PACKAGE') private customerClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.orderService = this.orderClient.getService<IOrderGrpcService>('OrderService');
    this.subscriptionService = this.subscriptionClient.getService<ISubscriptionGrpcService>('SubscriptionService');
    this.customerService = this.customerClient.getService<ICustomerGrpcService>('CustomerService');
  }

  async getDashboardStats(model: BusinessModel = 'multi') {
    const requiredServices = MODEL_SERVICES[model];
    this.logger.log(`Getting dashboard stats for model: ${model}, services: ${requiredServices.join(', ')}`);

    // Initialize default stats
    let orderStats = { totalOrders: 0, totalRevenue: 0 };
    let subscriptionStats = { activeCount: 0, monthlyRevenue: 0, totalRevenue: 0, churnedCount: 0 };
    let customerCount = 0;
    const errors: string[] = [];

    // Fetch stats only for required services using Promise.allSettled
    const fetchPromises: Promise<any>[] = [];
    const fetchLabels: string[] = [];

    // Order stats (for retail and multi)
    if (requiredServices.includes('order')) {
      fetchLabels.push('order');
      fetchPromises.push(
        firstValueFrom(
          this.orderService.getOrderStats({}).pipe(
            timeout(5000),
            catchError((err) => {
              this.logger.warn(`Order service unavailable: ${err.message}`);
              return of({ totalOrders: 0, totalRevenue: 0 });
            }),
          ),
        ),
      );
    }

    // Subscription stats (for subscription and multi)
    if (requiredServices.includes('subscription')) {
      fetchLabels.push('subscription');
      fetchPromises.push(
        firstValueFrom(
          this.subscriptionService.getSubscriptionStats({}).pipe(
            timeout(5000),
            catchError((err) => {
              this.logger.warn(`Subscription service unavailable: ${err.message}`);
              return of({ activeCount: 0, monthlyRevenue: 0, totalRevenue: 0, churnedCount: 0 });
            }),
          ),
        ),
      );
    }

    // Customer stats (for all models)
    if (requiredServices.includes('customer')) {
      fetchLabels.push('customer');
      fetchPromises.push(
        firstValueFrom(
          this.customerService.getAllCustomers({ page: 1, limit: 1 }).pipe(
            timeout(5000),
            catchError((err) => {
              this.logger.warn(`Customer service unavailable: ${err.message}`);
              return of({ total: 0 });
            }),
          ),
        ),
      );
    }

    // Execute all fetches in parallel
    const results = await Promise.allSettled(fetchPromises);

    // Process results
    results.forEach((result, index) => {
      const label = fetchLabels[index];
      if (result.status === 'fulfilled') {
        const data = result.value;
        if (label === 'order') {
          orderStats = data;
        } else if (label === 'subscription') {
          subscriptionStats = data;
        } else if (label === 'customer') {
          customerCount = data.total || 0;
        }
      } else {
        errors.push(`${label}: ${result.reason?.message || 'Service unavailable'}`);
        this.logger.error(`Failed to fetch ${label} stats:`, result.reason);
      }
    });

    // Calculate retail stats
    const totalOrders = orderStats.totalOrders || 0;
    const totalRevenue = parseFloat(String(orderStats.totalRevenue || 0));
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Calculate subscription stats
    const activeSubscriptions = subscriptionStats.activeCount || 0;
    const mrr = parseFloat(String(subscriptionStats.monthlyRevenue || 0));
    const totalSubscriptionRevenue = parseFloat(String(subscriptionStats.totalRevenue || 0));
    const churnedSubscriptions = subscriptionStats.churnedCount || 0;
    const totalSubscriptions = activeSubscriptions + churnedSubscriptions;
    const churnRate = totalSubscriptions > 0 ? (churnedSubscriptions / totalSubscriptions) * 100 : 0;
    const ltv = activeSubscriptions > 0 ? (mrr * 12) / activeSubscriptions : 0;

    // Freemium stats (placeholder)
    const freemiumStats = {
      freeUsers: 0,
      paidAddOns: 0,
      conversionRate: 0,
      addOnRevenue: 0,
    };

    const totalRevenueAllModels = totalRevenue + totalSubscriptionRevenue + freemiumStats.addOnRevenue;

    // Build overall stats based on model
    const overall = this.buildOverallStats(model, {
      totalRevenue,
      totalOrders,
      customerCount,
      avgOrderValue,
      activeSubscriptions,
      mrr,
      churnRate,
      ltv,
      freemiumStats,
      totalRevenueAllModels,
    });

    return {
      model,
      retail: {
        revenue: totalRevenue,
        orders: totalOrders,
        customers: customerCount,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      },
      subscription: {
        mrr: Math.round(mrr * 100) / 100,
        activeSubscriptions,
        churnRate: Math.round(churnRate * 10) / 10,
        ltv: Math.round(ltv * 100) / 100,
      },
      freemium: freemiumStats,
      overall,
      totalRevenue: Math.round(totalRevenueAllModels * 100) / 100,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private buildOverallStats(model: BusinessModel, data: any) {
    const overall: any[] = [];

    // Retail stats (for retail and multi)
    if (model === 'retail' || model === 'multi') {
      overall.push(
        {
          title: 'Total Revenue',
          value: `$${data.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          change: '+20.1%',
          icon: 'DollarSign',
          description: 'From retail orders',
        },
        {
          title: 'Retail Orders',
          value: data.totalOrders.toLocaleString(),
          change: '+15.3%',
          icon: 'ShoppingCart',
          description: 'One-time purchases',
        },
      );
    }

    // Subscription stats (for subscription and multi)
    if (model === 'subscription' || model === 'multi') {
      overall.push(
        {
          title: 'Monthly Recurring Revenue',
          value: `$${data.mrr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          change: '+12.5%',
          icon: 'TrendingUp',
          description: 'From subscriptions',
        },
        {
          title: 'Active Subscriptions',
          value: data.activeSubscriptions.toString(),
          change: '+8.2%',
          icon: 'Calendar',
          description: 'Recurring revenue',
        },
      );
    }

    // Freemium stats (for freemium and multi)
    if (model === 'freemium' || model === 'multi') {
      overall.push({
        title: 'Freemium Users',
        value: data.freemiumStats.freeUsers.toLocaleString(),
        change: '+25.8%',
        icon: 'Gift',
        description: `${data.freemiumStats.paidAddOns} paid add-ons`,
      });
    }

    // Always show customers
    overall.push({
      title: 'Total Customers',
      value: data.customerCount.toLocaleString(),
      change: '+10.5%',
      icon: 'Users',
      description: 'All customers',
    });

    return overall;
  }

  async getRevenueStats(model: BusinessModel = 'multi') {
    try {
      const dashboardStats = await this.getDashboardStats(model);
      const totalRevenue = dashboardStats.totalRevenue || 1; // Avoid division by zero
      
      return {
        retail: {
          total: dashboardStats.retail.revenue,
          orders: dashboardStats.retail.orders,
          avgOrderValue: dashboardStats.retail.avgOrderValue,
        },
        subscription: {
          mrr: dashboardStats.subscription.mrr,
          total: dashboardStats.subscription.mrr * 12, // Annualized
          activeSubscriptions: dashboardStats.subscription.activeSubscriptions,
        },
        freemium: {
          addOnRevenue: dashboardStats.freemium.addOnRevenue,
          paidAddOns: dashboardStats.freemium.paidAddOns,
        },
        total: dashboardStats.totalRevenue,
        breakdown: {
          retailPercentage: Math.round((dashboardStats.retail.revenue / totalRevenue) * 100) || 0,
          subscriptionPercentage: Math.round(((dashboardStats.subscription.mrr * 12) / totalRevenue) * 100) || 0,
          freemiumPercentage: Math.round((dashboardStats.freemium.addOnRevenue / totalRevenue) * 100) || 0,
        },
      };
    } catch (error) {
      this.logger.error('Error fetching revenue stats:', error);
      throw error;
    }
  }
}
