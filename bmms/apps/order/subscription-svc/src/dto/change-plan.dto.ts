import { IsUUID } from 'class-validator';

export class ChangePlanDto {
  @IsUUID()
  newPlanId: string;

  // If true, change will take effect immediately
  // If false, change will take effect at the end of current billing period
  immediate?: boolean;
}
