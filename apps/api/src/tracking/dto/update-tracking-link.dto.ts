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
import { DestinationMode } from '@cleartg/database';

/**
 * S2-07 / S2-18: редагування посилання без втрати історії.
 *
 * `undefined` — поле не змінюється, `null` — очистити значення.
 * Свідомо НЕМАЄ `channelId`, `slug` і `linkMode`: адреса посилання вже стоїть
 * у запущеній рекламі, а канал визначає, до кого належать історичні кліки й
 * підписки. Їх зміна зламала б і рекламу, і звіти.
 *
 * Історія при цьому не губиться: кожен ClickEvent зберігає власну копію UTM і
 * campaignId на момент кліку, а атрибуція посилається на id посилання.
 */
export class UpdateTrackingLinkDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string | null;

  @IsOptional()
  @IsString()
  campaignId?: string | null;

  @IsOptional()
  @IsString()
  botConnectionId?: string | null;

  @IsOptional()
  @IsEnum(DestinationMode)
  destinationMode?: DestinationMode;

  @IsOptional()
  @IsUrl()
  landingPostUrl?: string | null;

  @IsOptional()
  @IsUrl()
  destinationUrl?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  postNumber?: number | null;

  /** S2-11: false — сторінка з кнопкою, перехід у Telegram вимірюється. */
  @IsOptional()
  @IsBoolean()
  autoRedirect?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  redirectDelayMs?: number;

  @IsOptional()
  @IsString()
  utmSource?: string | null;

  @IsOptional()
  @IsString()
  utmMedium?: string | null;

  @IsOptional()
  @IsString()
  utmCampaign?: string | null;

  @IsOptional()
  @IsString()
  utmContent?: string | null;

  @IsOptional()
  @IsString()
  utmTerm?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  creativeTag?: string | null;
}
