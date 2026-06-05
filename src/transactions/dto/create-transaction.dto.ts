import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  ArrayMinSize,
  IsArray,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType } from '../../common/enums/index.js';
import { EntryType } from '../../common/enums/index.js';

export class CreateEntryDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsNotEmpty()
  accountId: string;

  @ApiProperty({ example: 100.5, minimum: 0.01 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: EntryType, example: EntryType.DEBIT })
  @IsEnum(EntryType)
  type: EntryType;
}

export class CreateTransactionDto {
  @ApiProperty({ enum: TransactionType, example: TransactionType.TRANSFER })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({ example: 'txn-abc-123' })
  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;

  @ApiPropertyOptional({ example: { description: 'Pagamento de aluguel' } })
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiProperty({ type: [CreateEntryDto], minItems: 2 })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateEntryDto)
  entries: CreateEntryDto[];
}
