import { IsEnum, IsOptional, IsString } from 'class-validator';

enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  VIEWED = 'viewed',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

export class UpdateInvoiceStatusDto {
  @IsEnum(InvoiceStatus)
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled';
  
  @IsOptional()
  @IsString()
  notes?: string;
}