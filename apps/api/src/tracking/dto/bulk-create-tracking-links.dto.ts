import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateTrackingLinkDto } from './create-tracking-link.dto';

export const BULK_LINKS_LIMIT = 50;

export class BulkLinkItemDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  creativeTag?: string;

  @IsOptional()
  @IsString()
  utmContent?: string;
}

/**
 * S2-09: пачка посилань під одну кампанію однією операцією.
 * Спільні налаштування — у `base`, відмінності (назва, креатив) — у `items`.
 */
export class BulkCreateTrackingLinksDto {
  @ValidateNested()
  @Type(() => CreateTrackingLinkDto)
  base!: CreateTrackingLinkDto;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_LINKS_LIMIT)
  @ValidateNested({ each: true })
  @Type(() => BulkLinkItemDto)
  items!: BulkLinkItemDto[];
}
