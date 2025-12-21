import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { CustomerSegmentationService } from './services/customer-segmentation.service';
import { CustomerLifecycleService } from './services/customer-lifecycle.service';
import { firstValueFrom } from 'rxjs';

interface ICustomerGrpcService {
  getCustomerById(data: { id: number }): any;
  updateCustomer(data: any): any;
}

@Injectable()
export class crmOrchestratorService implements OnModuleInit {
  private readonly logger = new Logger(crmOrchestratorService.name);
  private customerService: ICustomerGrpcService;

  constructor(
    @Inject('CUSTOMER_SERVICE') private client: ClientGrpc,
    private segmentationService: CustomerSegmentationService,
    private lifecycleService: CustomerLifecycleService,
  ) {}

  onModuleInit() {
    this.customerService = this.client.getService<ICustomerGrpcService>('CustomerService');
  }

  getHello(): string {
    return 'CRM Orchestrator - Customer Intelligence Engine';
  }

  /**
   * Get customer insights and recommendations
   */
  async getCustomerInsights(customerId: number) {
    try {
      const customerResponse: any = await firstValueFrom(
        this.customerService.getCustomerById({ id: customerId })
      );
      const customer = customerResponse.customer;

      const totalSpent = Number(customer.totalSpent || 0);
      const orderCount = customer.orderCount || 0;
      const lastOrderDate = customer.lastOrderDate ? new Date(customer.lastOrderDate) : null;

      // Calculate insights
      const currentSegment = this.segmentationService.calculateSegment(totalSpent);
      const segmentBenefits = this.segmentationService.getSegmentBenefits(currentSegment);
      
      const lifecycleStage = this.lifecycleService.calculateLifecycleStage(
        orderCount,
        lastOrderDate,
        totalSpent
      );
      const recommendedActions = this.lifecycleService.getRecommendedActions(lifecycleStage);
      const isAtRisk = this.lifecycleService.isAtRiskOfChurning(lastOrderDate, orderCount);

      // Calculate CLV
      const daysSinceFirstOrder = customer.createdAt 
        ? Math.ceil((new Date().getTime() - new Date(customer.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const estimatedCLV = this.lifecycleService.estimateLifetimeValue(
        totalSpent,
        orderCount,
        daysSinceFirstOrder
      );

      return {
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          currentSegment: customer.segment,
          currentLifecycleStage: customer.lifecycleStage,
        },
        insights: {
          calculatedSegment: currentSegment,
          segmentBenefits,
          lifecycleStage,
          isAtRiskOfChurning: isAtRisk,
          estimatedLifetimeValue: Math.round(estimatedCLV * 100) / 100,
          recommendedActions,
        },
        metrics: {
          totalSpent,
          orderCount,
          lastOrderDate,
          daysSinceFirstOrder,
          avgOrderValue: orderCount > 0 ? Math.round((totalSpent / orderCount) * 100) / 100 : 0,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get insights for customer ${customerId}:`, error);
      throw error;
    }
  }

  /**
   * Manually trigger segment recalculation for a customer
   */
  async recalculateCustomerSegment(customerId: number) {
    const customerResponse: any = await firstValueFrom(
      this.customerService.getCustomerById({ id: customerId })
    );
    const customer = customerResponse.customer;

    const newSegment = this.segmentationService.calculateSegment(Number(customer.totalSpent || 0));
    
    if (customer.segment !== newSegment) {
      await firstValueFrom(
        this.customerService.updateCustomer({
          id: customerId,
          segment: newSegment,
        })
      );
      
      this.logger.log(`Customer ${customerId} segment updated: ${customer.segment} to ${newSegment}`);
      return { updated: true, oldSegment: customer.segment, newSegment };
    }

    return { updated: false, segment: customer.segment };
  }
}
