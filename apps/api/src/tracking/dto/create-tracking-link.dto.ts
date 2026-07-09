import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DestinationMode, LinkMode } from '@cleartg/database';

export class CreateTrackingLinkDto {
  @IsString()
  channelId!: string;

  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(LinkMode)
  linkMode?: LinkMode;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  landingTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  landingDescription?: string;

  @IsOptional()
  @IsEnum(DestinationMode)
  destinationMode?: DestinationMode;

  @IsOptional()
  @IsUrl()
  landingPostUrl?: string;

  @IsOptional()
  @IsUrl()
  destinationUrl?: string;

  @IsOptional()
  @IsBoolean()
  autoRedirect?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  redirectDelayMs?: number;

  @IsOptional()
  @IsBoolean()
  usePerClickInvite?: boolean;

  @IsOptional()
  @IsString()
  utmSource?: string;

  @IsOptional()
  @IsString()
  utmMedium?: string;

  @IsOptional()
  @IsString()
  utmCampaign?: string;

  @IsOptional()
  @IsString()
  utmContent?: string;

  @IsOptional()
  @IsString()
  utmTerm?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  postNumber?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  creativeTag?: string;
}
