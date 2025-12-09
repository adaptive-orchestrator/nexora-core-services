import { Controller, Get, UseGuards, Request, HttpStatus, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtGuard } from '../../guards/jwt.guard';
import { AdminGuard } from '../../guards/admin.guard';
import { AdminStatsService } from './admin-stats.service';
import { AdminDashboardStatsDto } from './dto/admin-stats.dto';

@ApiTags('Admin Statistics')
@ApiBearerAuth()
@UseGuards(JwtGuard, AdminGuard)
@Controller('admin/stats')
export class AdminStatsController {
  constructor(private readonly adminStatsService: AdminStatsService) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'Get admin dashboard statistics',
    description: 'Get statistics for a specific business model. Only calls services that are available for the selected model.',
  })
  @ApiQuery({
    name: 'model',
    required: false,
    enum: ['retail', 'subscription', 'freemium', 'multi'],
    description: 'Business model to get stats for. Defaults to "multi" (all services).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statistics retrieved successfully',
    type: AdminDashboardStatsDto,
  })
  async getDashboardStats(
    @Query('model') model?: 'retail' | 'subscription' | 'freemium' | 'multi',
  ) {
    return this.adminStatsService.getDashboardStats(model || 'multi');
  }

  @Get('revenue')
  @ApiOperation({
    summary: 'Get revenue breakdown by model',
    description: 'Get detailed revenue statistics for the specified business model',
  })
  @ApiQuery({
    name: 'model',
    required: false,
    enum: ['retail', 'subscription', 'freemium', 'multi'],
    description: 'Business model to get revenue stats for. Defaults to "multi" (all).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Revenue statistics retrieved successfully',
  })
  async getRevenueStats(
    @Query('model') model?: 'retail' | 'subscription' | 'freemium' | 'multi',
  ) {
    return this.adminStatsService.getRevenueStats(model || 'multi');
  }
}
