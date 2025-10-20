import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class LlmChatRequestDto {
  @ApiProperty({
    example: 'Chuyển nhóm sản phẩm A sang subscription theo tháng',
    description: 'Câu lệnh hoặc yêu cầu nghiệp vụ người dùng nhập',
  })
  @IsString()
  message: string;

  @ApiProperty({ example: 'tenant-demo', required: false })
  @IsOptional()
  @IsString()
  tenant_id?: string;

  @ApiProperty({ example: 'admin', required: false })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiProperty({ example: 'vi', description: 'Mã ngôn ngữ, mặc định là vi', required: false })
  @IsOptional()
  @IsString()
  lang?: string;
}
