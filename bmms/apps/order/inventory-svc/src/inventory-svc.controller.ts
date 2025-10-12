import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { InventoryService } from './inventory-svc.service';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}
  @Post()
  create(@Body() dto: any) {
    return this.service.create(dto);
  }
  @Get(':productId')
  getByProduct(@Param('productId') productId: number) {
    return this.service.getByProduct(productId);
  }
  @Patch(':productId/adjust')
  adjust(@Param('productId') productId: number, @Body('adjustment') adj: AdjustInventoryDto) {
    return this.service.adjust(productId, adj);
  }
  @Post('reserve')
  reserve(@Body() dto: any) {
    return this.service.reserve(dto);
  }
  @Post('release')
  release(@Body() dto: any) {
    return this.service.release(dto);
  }
}
