import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  ParseIntPipe,
  HttpStatus,
  Request,
  UseGuards,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CustomerService } from './customer.service';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerResponseDto, CustomersListResponseDto } from './dto/customer-response.dto';
import { CustomerInsightsDto, SegmentCalculationDto } from './dto/customer-insights.dto';
import { JwtGuard } from '../../guards/jwt.guard';

@ApiTags('Customer')
@Controller('customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all customers',
    description: 'Retrieve a paginated list of customers with optional filtering by segment',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({
    name: 'segment',
    required: false,
    type: String,
    example: 'gold',
    description: 'Filter by customer segment (bronze, silver, gold, platinum)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of customers retrieved successfully',
    type: CustomersListResponseDto,
  })
  async getAllCustomers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('segment') segment?: string,
  ) {
    return this.customerService.getAllCustomers(page, limit, segment);
  }

  // ============ Static routes MUST come before dynamic :id route ============

  @Get('segments/thresholds')
  @ApiOperation({
    summary: 'Get segment calculation thresholds',
    description: 'Get the spending thresholds for each customer segment (bronze, silver, gold, platinum)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Segment thresholds retrieved successfully',
    type: SegmentCalculationDto,
  })
  getSegmentThresholds() {
    return this.customerService.getSegmentThresholds();
  }

  @Get('email/:email')
  @ApiOperation({
    summary: 'Get customer by email',
    description: 'Find a customer using their email address',
  })
  @ApiParam({ name: 'email', type: String, example: 'john.doe@example.com' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer found',
    type: CustomerResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Customer not found',
  })
  async getCustomerByEmail(@Param('email') email: string) {
    try {
      const result: any = await this.customerService.getCustomerByEmail(email);
      return result.customer;
    } catch (error: any) {
      // Handle gRPC NOT_FOUND error (code 5)
      if (error?.code === 5 || error?.details?.includes('not found')) {
        throw new NotFoundException(`Customer with email ${email} not found`);
      }
      throw new InternalServerErrorException(error?.details || 'Internal server error');
    }
  }

  // ============ Dynamic :id route MUST come after static routes ============

  @Get(':id')
  @ApiOperation({
    summary: 'Get customer by ID',
    description: 'Retrieve detailed information about a specific customer',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer details retrieved successfully',
    type: CustomerResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Customer not found',
  })
  async getCustomerById(@Param('id', ParseIntPipe) id: number) {
    const result: any = await this.customerService.getCustomerById(id);
    return result.customer;
  }

  @Get(':id/insights')
  @ApiOperation({
    summary: 'Get customer insights and intelligence',
    description: 'Get AI-powered customer insights including segment analysis, lifecycle stage, churn risk, CLV estimation, and recommended actions',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer insights retrieved successfully',
    type: CustomerInsightsDto,
  })
  async getCustomerInsights(@Param('id', ParseIntPipe) id: number) {
    return this.customerService.getCustomerInsights(id);
  }

  @UseGuards(JwtGuard)
  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update current user profile',
    description: 'Update the profile of the currently authenticated user (name, email). Requires JWT authentication.',
  })
  @ApiBody({ type: UpdateCustomerDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile updated successfully',
    type: CustomerResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Customer not found for the authenticated user',
  })
  async updateCurrentCustomer(
    @Body() updateDto: UpdateCustomerDto,
    @Request() req: any,
  ) {
    const userId = req.user?.sub || req.user?.id;
    const result: any = await this.customerService.updateCustomerByUserId(userId, updateDto);
    return result.customer;
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update customer',
    description: 'Update customer profile information (name, email, segment, tenantId)',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer updated successfully',
    type: CustomerResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Customer not found',
  })
  async updateCustomer(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateCustomerDto,
  ) {
    const result: any = await this.customerService.updateCustomer(id, updateDto);
    return result.customer;
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete customer',
    description: 'Permanently delete a customer from the system',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer deleted successfully',
    schema: {
      example: {
        success: true,
        message: 'Customer deleted successfully',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Customer not found',
  })
  async deleteCustomer(@Param('id', ParseIntPipe) id: number) {
    return this.customerService.deleteCustomer(id);
  }
}
