import { Controller, Get, UseGuards, Request, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
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
    description: 'Get comprehensive statistics for all business models (retail, subscription, freemium)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statistics retrieved successfully',
    type: AdminDashboardStatsDto,
  })
  async getDashboardStats(@Request() req: any) {
    return this.adminStatsService.getDashboardStats();
  }

  @Get('revenue')
  @ApiOperation({
    summary: 'Get revenue breakdown by model',
    description: 'Get detailed revenue statistics for retail, subscription, and freemium models',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Revenue statistics retrieved successfully',
  })
  async getRevenueStats() {
    return this.adminStatsService.getRevenueStats();
  }
}
