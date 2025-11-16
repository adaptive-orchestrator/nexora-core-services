import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';

import { CreateAddonDto } from './dto/create-addon.dto';
import { PurchaseAddonDto } from './dto/purchase-addon.dto';
import { AddonResponseDto, UserAddonResponseDto } from './dto/addon-response.dto';
import { AddonService } from './addon.service';

@ApiTags('Addons')
@Controller('addons')
// @ApiBearerAuth('accessToken')
// @UseGuards(JwtAuthGuard)
export class AddonController {
  constructor(private readonly addonService: AddonService) {}

  @Get()
  @ApiOperation({
    summary: 'List all available add-ons',
    description: 'Get a list of all active add-ons that can be purchased by users. These include extra storage, AI features, priority support, etc.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of add-ons retrieved successfully',
    type: [AddonResponseDto],
  })
  async listAddons(): Promise<AddonResponseDto[]> {
    return this.addonService.listAddons();
  }

  @Get(':key')
  @ApiOperation({
    summary: 'Get add-on details by key',
    description: 'Retrieve detailed information about a specific add-on by its unique key',
  })
  @ApiParam({ name: 'key', description: 'Add-on key', example: 'extra_storage' })
  @ApiResponse({
    status: 200,
    description: 'Add-on details retrieved successfully',
    type: AddonResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Add-on not found',
  })
  async getAddon(@Param('key') key: string): Promise<AddonResponseDto> {
    return this.addonService.getAddon(key);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create new add-on (Admin only)',
    description: 'Create a new add-on that users can purchase. This endpoint should be protected and only accessible by administrators.',
  })
  @ApiResponse({
    status: 201,
    description: 'Add-on created successfully',
    type: AddonResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid add-on data or add-on key already exists',
  })
  async createAddon(@Body() data: CreateAddonDto): Promise<AddonResponseDto> {
    return this.addonService.createAddon(data);
  }

  @Post('purchase')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Purchase add-ons',
    description: 'Purchase one or more add-ons for a subscription. The add-ons will be activated immediately and billing will start based on their billing period.',
  })
  @ApiResponse({
    status: 200,
    description: 'Add-ons purchased successfully',
    type: [UserAddonResponseDto],
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid purchase data or user already has add-on',
  })
  @ApiResponse({
    status: 404,
    description: 'Subscription or add-on not found',
  })
  async purchaseAddons(@Body() data: PurchaseAddonDto): Promise<UserAddonResponseDto[]> {
    return this.addonService.purchaseAddons(data);
  }

  @Get('user/:subscriptionId')
  @ApiOperation({
    summary: 'Get user active add-ons',
    description: 'Retrieve all active add-ons for a specific subscription. This shows what extra features the user currently has.',
  })
  @ApiParam({
    name: 'subscriptionId',
    description: 'Subscription ID',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'User add-ons retrieved successfully',
    type: [UserAddonResponseDto],
  })
  async getUserAddons(@Param('subscriptionId', ParseIntPipe) subscriptionId: number): Promise<UserAddonResponseDto[]> {
    return this.addonService.getUserAddons(subscriptionId);
  }

  @Delete('user/:id')
  @ApiOperation({
    summary: 'Cancel add-on',
    description: 'Cancel a specific add-on subscription. The add-on will be marked as cancelled and will expire at the end of the current billing period.',
  })
  @ApiParam({
    name: 'id',
    description: 'User add-on ID',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Add-on cancelled successfully',
    type: UserAddonResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Add-on not found',
  })
  async cancelAddon(@Param('id', ParseIntPipe) id: number): Promise<UserAddonResponseDto> {
    return this.addonService.cancelAddon(id);
  }
}
