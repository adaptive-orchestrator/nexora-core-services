export class UpdatePlanDto {
  name?: string;
  description?: string;
  price?: number;
  billingCycle?: 'monthly' | 'yearly';
  features?: number[];
}