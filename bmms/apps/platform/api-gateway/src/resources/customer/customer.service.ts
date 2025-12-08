import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

interface ICustomerGrpcService {
  getAllCustomers(data: any): any;
  getCustomerById(data: { id: string }): any;
  getCustomerByEmail(data: { email: string }): any;
  getCustomerByUserId(data: { userId: string }): any;
  updateCustomer(data: any): any;
  deleteCustomer(data: { id: string }): any;
}

@Injectable()
export class CustomerService implements OnModuleInit {
  private customerService: ICustomerGrpcService;

  constructor(@Inject('CUSTOMER_PACKAGE') private client: ClientGrpc) {}

  onModuleInit() {
    this.customerService = this.client.getService<ICustomerGrpcService>('CustomerService');
  }

  async getAllCustomers(page: number = 1, limit: number = 10, segment?: string) {
    return firstValueFrom(
      this.customerService.getAllCustomers({ page, limit, segment }),
    );
  }

  async getCustomerById(id: string) {
    return firstValueFrom(
      this.customerService.getCustomerById({ id }),
    );
  }

  async getCustomerByEmail(email: string) {
    return firstValueFrom(
      this.customerService.getCustomerByEmail({ email }),
    );
  }

  async getCustomerByUserId(userId: string) {
    return firstValueFrom(
      this.customerService.getCustomerByUserId({ userId }),
    );
  }

  async updateCustomer(id: string, updateData: any) {
    return firstValueFrom(
      this.customerService.updateCustomer({ id, ...updateData }),
    );
  }

  async updateCustomerByUserId(userId: string, updateData: any) {
    // First get customer by userId
    const customerResult: any = await this.getCustomerByUserId(userId);
    const customerId = customerResult.customer.id;
    
    // Then update the customer
    return this.updateCustomer(customerId, updateData);
  }

  async deleteCustomer(id: string) {
    return firstValueFrom(
      this.customerService.deleteCustomer({ id }),
    );
  }

  /**
   * Calculate customer insights (CRM logic)
   */
  async getCustomerInsights(id: string) {
    const response: any = await this.getCustomerById(id);
    const customer = response.customer;

    const totalSpent = Number(customer.totalSpent || 0);
    const orderCount = customer.orderCount || 0;
    const lastOrderDate = customer.lastOrderDate ? new Date(customer.lastOrderDate) : null;

    // Calculate segment
    const calculatedSegment = this.calculateSegment(totalSpent);
    const segmentBenefits = this.getSegmentBenefits(calculatedSegment);

    // Calculate lifecycle stage
    const lifecycleStage = this.calculateLifecycleStage(orderCount, lastOrderDate, totalSpent);
    const recommendedActions = this.getRecommendedActions(lifecycleStage);
    const isAtRisk = this.isAtRiskOfChurning(lastOrderDate, orderCount);

    // Calculate CLV
    const daysSinceFirstOrder = customer.createdAt
      ? Math.ceil((new Date().getTime() - new Date(customer.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const estimatedCLV = this.estimateLifetimeValue(totalSpent, orderCount, daysSinceFirstOrder);

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        currentSegment: customer.segment,
        currentLifecycleStage: customer.lifecycleStage,
      },
      insights: {
        calculatedSegment,
        segmentBenefits,
        lifecycleStage,
        isAtRiskOfChurning: isAtRisk,
        estimatedLifetimeValue: Math.round(estimatedCLV * 100) / 100,
        recommendedActions,
      },
      metrics: {
        totalSpent,
        orderCount,
        lastOrderDate: lastOrderDate?.toISOString() || null,
        daysSinceFirstOrder,
        avgOrderValue: orderCount > 0 ? Math.round((totalSpent / orderCount) * 100) / 100 : 0,
      },
    };
  }

  /**
   * Get segment calculation thresholds
   */
  getSegmentThresholds() {
    return {
      segment: 'bronze',
      benefits: this.getSegmentBenefits('bronze'),
      thresholds: {
        bronze: { min: 0, max: 999 },
        silver: { min: 1000, max: 4999 },
        gold: { min: 5000, max: 19999 },
        platinum: { min: 20000, max: null },
      },
    };
  }

  // ============ CRM Business Logic (Duplicated for API Gateway) ============

  private calculateSegment(totalSpent: number): string {
    if (totalSpent >= 20000) return 'platinum';
    if (totalSpent >= 5000) return 'gold';
    if (totalSpent >= 1000) return 'silver';
    return 'bronze';
  }

  private getSegmentBenefits(segment: string): string[] {
    const benefits: Record<string, string[]> = {
      bronze: ['Standard support', 'Basic discounts'],
      silver: ['Priority support', '5% discount on all orders', 'Early access to new products'],
      gold: ['Premium support 24/7', '10% discount on all orders', 'Free shipping', 'Exclusive promotions'],
      platinum: [
        'Dedicated account manager',
        '15% discount on all orders',
        'Free express shipping',
        'VIP events access',
        'Custom solutions',
      ],
    };
    return benefits[segment] || [];
  }

  private calculateLifecycleStage(orderCount: number, lastOrderDate: Date | null, totalSpent: number): string {
    if (orderCount > 0 && lastOrderDate) {
      const daysSinceLastOrder = this.getDaysSince(lastOrderDate);
      if (daysSinceLastOrder > 90) return 'churned';
    }

    if (orderCount === 0) return 'lead';
    if (orderCount === 1 || orderCount === 2) return 'customer';
    if (orderCount >= 5 || totalSpent >= 5000) return 'loyal';
    return 'customer';
  }

  private getRecommendedActions(stage: string): string[] {
    const actions: Record<string, string[]> = {
      lead: ['Send welcome email', 'Offer first-time discount', 'Show popular products'],
      prospect: ['Send abandoned cart reminder', 'Offer limited-time discount', 'Show product reviews'],
      customer: ['Send thank you email', 'Request product review', 'Suggest complementary products'],
      loyal: ['Upgrade to premium segment', 'Invite to VIP program', 'Send exclusive offers'],
      churned: ['Send win-back campaign', 'Offer special discount', 'Ask for feedback'],
    };
    return actions[stage] || [];
  }

  private isAtRiskOfChurning(lastOrderDate: Date | null, orderCount: number): boolean {
    if (!lastOrderDate || orderCount === 0) return false;
    const daysSinceLastOrder = this.getDaysSince(lastOrderDate);
    return daysSinceLastOrder >= 60 && daysSinceLastOrder < 90;
  }

  private estimateLifetimeValue(totalSpent: number, orderCount: number, daysSinceFirstOrder: number): number {
    if (orderCount === 0 || daysSinceFirstOrder === 0) return 0;

    const avgOrderValue = totalSpent / orderCount;
    const avgDaysBetweenOrders = daysSinceFirstOrder / orderCount;
    const ordersPerYear = 365 / avgDaysBetweenOrders;
    const estimatedYearsAsCustomer = 3;

    return avgOrderValue * ordersPerYear * estimatedYearsAsCustomer;
  }

  private getDaysSince(date: Date): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - new Date(date).getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}
