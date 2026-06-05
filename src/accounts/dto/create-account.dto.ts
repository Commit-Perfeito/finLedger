import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType } from '../../common/enums/index.js';

export class CreateAccountDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ enum: AccountType, example: AccountType.WALLET })
  @IsEnum(AccountType)
  type: AccountType;

  @ApiPropertyOptional({ example: 'BRL', default: 'BRL' })
  @IsString()
  @IsOptional()
  currency?: string = 'BRL';
}
