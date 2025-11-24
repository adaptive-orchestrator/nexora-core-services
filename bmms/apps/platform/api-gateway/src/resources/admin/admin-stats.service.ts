import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

interface IOrderGrpcService {
  getOrderStats(data: any): any;
}

interface ISubscriptionGrpcService {
  getSubscriptionStats(data: any): any;
}

interface ICustomerGrpcService {
  getAllCustomers(data: any): any;
}

@Injectable()
export class AdminStatsService implements OnModuleInit {
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

  async getDashboardStats() {
    try {
      // Get order statistics (retail)
      const orderStatsResponse: any = await firstValueFrom(
        this.orderService.getOrderStats({})
      );

      // Get customer count
      const customersResponse: any = await firstValueFrom(
        this.customerService.getAllCustomers({ page: 1, limit: 1 })
      );

      // Get subscription statistics
      const subscriptionStatsResponse: any = await firstValueFrom(
        this.subscriptionService.getSubscriptionStats({})
      );

      // Calculate retail stats
      const totalOrders = orderStatsResponse.totalOrders || 0;
      const totalRevenue = parseFloat(orderStatsResponse.totalRevenue || 0);
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Calculate subscription stats
      const activeSubscriptions = subscriptionStatsResponse.activeCount || 0;
      const mrr = parseFloat(subscriptionStatsResponse.monthlyRevenue || 0);
      const totalSubscriptionRevenue = parseFloat(subscriptionStatsResponse.totalRevenue || 0);
      const churnedSubscriptions = subscriptionStatsResponse.churnedCount || 0;
      const totalSubscriptions = activeSubscriptions + churnedSubscriptions;
      const churnRate = totalSubscriptions > 0 ? (churnedSubscriptions / totalSubscriptions) * 100 : 0;
      
      // Estimate LTV (simplified: MRR * 12 months / active subscriptions)
      const ltv = activeSubscriptions > 0 ? (mrr * 12) / activeSubscriptions : 0;

      // TODO: Freemium stats - implement when freemium service is ready
      const freemiumStats = {
        freeUsers: 0, // To be implemented with user segments
        paidAddOns: 0, // To be implemented with add-on purchases
        conversionRate: 0,
        addOnRevenue: 0,
      };

      const totalRevenueAllModels = totalRevenue + totalSubscriptionRevenue + freemiumStats.addOnRevenue;

      // Calculate percentage changes (compared to previous period)
      // TODO: Implement time-series comparison
      const revenueChange = '+20.1%'; // Placeholder
      const ordersChange = '+15.3%'; // Placeholder
      const subscriptionsChange = '+8.2%'; // Placeholder
      const freemiumChange = '+25.8%'; // Placeholder

      return {
        retail: {
          revenue: totalRevenue,
          orders: totalOrders,
          customers: customersResponse.total || 0,
          avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        },
        subscription: {
          mrr: Math.round(mrr * 100) / 100,
          activeSubscriptions,
          churnRate: Math.round(churnRate * 10) / 10,
          ltv: Math.round(ltv * 100) / 100,
        },
        freemium: freemiumStats,
        overall: [
          {
            title: 'Total Revenue (All Models)',
            value: `$${totalRevenueAllModels.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            change: revenueChange,
            icon: 'DollarSign',
            description: 'Retail + Subscription + Add-ons',
          },
          {
            title: 'Retail Orders',
            value: totalOrders.toLocaleString(),
            change: ordersChange,
            icon: 'ShoppingCart',
            description: 'One-time purchases',
          },
          {
            title: 'Active Subscriptions',
            value: activeSubscriptions.toString(),
            change: subscriptionsChange,
            icon: 'Calendar',
            description: 'Recurring revenue',
          },
          {
            title: 'Freemium Users',
            value: freemiumStats.freeUsers.toLocaleString(),
            change: freemiumChange,
            icon: 'Gift',
            description: `${freemiumStats.paidAddOns} paid add-ons`,
          },
        ],
        totalRevenue: Math.round(totalRevenueAllModels * 100) / 100,
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  }

  async getRevenueStats() {
    try {
      const dashboardStats = await this.getDashboardStats();
      
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
          retailPercentage: Math.round((dashboardStats.retail.revenue / dashboardStats.totalRevenue) * 100),
          subscriptionPercentage: Math.round(((dashboardStats.subscription.mrr * 12) / dashboardStats.totalRevenue) * 100),
          freemiumPercentage: Math.round((dashboardStats.freemium.addOnRevenue / dashboardStats.totalRevenue) * 100),
        },
      };
    } catch (error) {
      console.error('Error fetching revenue stats:', error);
      throw error;
    }
  }
}
