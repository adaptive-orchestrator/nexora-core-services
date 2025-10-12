export class AdjustInventoryDto {
  adjustment: number;
  reason: 'restock' | 'damage' | 'loss' | 'adjustment' | 'correction';
  notes?: string;
}