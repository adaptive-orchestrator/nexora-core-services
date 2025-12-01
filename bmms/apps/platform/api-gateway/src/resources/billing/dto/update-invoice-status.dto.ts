import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  VIEWED = 'viewed',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

export class UpdateInvoiceStatusDto {
  @ApiProperty({ 
    description: 'Invoice status', 
    enum: InvoiceStatus,
    example: InvoiceStatus.PAID 
  })
  @IsEnum(InvoiceStatus)
  status: InvoiceStatus;
}
