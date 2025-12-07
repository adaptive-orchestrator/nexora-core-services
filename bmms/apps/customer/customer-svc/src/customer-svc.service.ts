import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Customer, CustomerSegment, LifecycleStage } from './customer.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientKafka } from '@nestjs/microservices';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { UpdateCustomerDto } from '../dto/update-customer.dto';
import { createBaseEvent, CustomerCreatedEvent, SegmentChangedEvent } from '@bmms/event';
import { debug } from '@bmms/common';

@Injectable()
export class CustomerSvcService {
  constructor(
    @InjectRepository(Customer)
    private readonly repo: Repository<Customer>,

    @Inject('KAFKA_SERVICE')
    private readonly kafka: ClientKafka,
  ) {}

  async create(dto: CreateCustomerDto): Promise<Customer> {
    const customer = await this.repo.save(this.repo.create(dto));

    // Emit event customer.created với đúng structure
    const event: CustomerCreatedEvent = {
      ...createBaseEvent('customer.created', 'customer-service'),
      eventType: 'customer.created',
      data: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        createdAt: customer.createdAt,
        role: customer.role,
      },
    };

    debug.log('Emitting customer.created event:', event);
    this.kafka.emit('customer.created', event);

    return customer;
  }

  async findAll(page: number = 1, limit: number = 10, segment?: string): Promise<Customer[]> {
    const query = this.repo.createQueryBuilder('customer')
      .select([
        'customer.id',
        'customer.name',
        'customer.email',
        'customer.phone',
        'customer.address',
        'customer.segment',
        'customer.status',
        'customer.lifecycleStage',
        'customer.tenantId',
        'customer.userId',
        'customer.totalSpent',
        'customer.orderCount',
        'customer.lastOrderDate',
        'customer.notes',
        'customer.role',
        'customer.createdAt',
        'customer.updatedAt',
      ]);
    
    if (segment) {
      query.where('customer.segment = :segment', { segment });
    }
    
    query.skip((page - 1) * limit).take(limit);
    
    return query.getMany();
  }

  async findOne(id: string): Promise<Customer> {
    const customer = await this.repo.findOne({ where: { id } });
    if (!customer) throw new NotFoundException(`Customer ${id} not found`);
    return customer;
  }

  async findByEmail(email: string): Promise<Customer> {
    const customer = await this.repo.findOne({ where: { email } });
    if (!customer) throw new NotFoundException(`Customer with email ${email} not found`);
    return customer;
  }

  async findByUserId(userId: string): Promise<Customer> {
    const customer = await this.repo.findOne({ where: { userId } });
    if (!customer) throw new NotFoundException(`Customer with userId ${userId} not found`);
    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.findOne(id);
    Object.assign(customer, dto);
    return this.repo.save(customer);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  async updateSegment(id: string, segment: CustomerSegment): Promise<Customer> {
    const customer = await this.findOne(id);
    const previousSegment = customer.segment;
    customer.segment = segment;
    const saved = await this.repo.save(customer);

    // Emit event segment.changed với đúng structure
    const event: SegmentChangedEvent = {
      ...createBaseEvent('segment.changed', 'customer-service'),
      eventType: 'segment.changed',
      data: {
        customerId: saved.id,
        segment: saved.segment,
      },
    };

    debug.log(`Emitting segment.changed event: ${previousSegment} -> ${segment}`);
    this.kafka.emit('segment.changed', event);

    return saved;
  }
}