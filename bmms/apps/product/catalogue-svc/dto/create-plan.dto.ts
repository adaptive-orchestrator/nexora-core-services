export class CreatePlanDto {
  name: string;
  description: string;
  price: number;
  billingCycle: 'monthly' | 'yearly';
  features: number[]; // Feature IDs
}