import { Body, Controller, Get, Put } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { CONVERSION_DELAY_HOURS } from '@cleartg/shared';
import { RequiresWorkspace } from '../common/decorators/auth.decorator';
import { WorkspaceId } from '../common/decorators/user.decorator';
import { ConversionService } from './conversion.service';

class UpdateConversionSettingsDto {
  /** S3-09 */
  @IsOptional()
  @IsIn([...CONVERSION_DELAY_HOURS])
  conversionDelayHours?: number;

  /** S3-10 */
  @IsOptional()
  @IsBoolean()
  skipQuickUnsubscribes?: boolean;

  /** S3-12 */
  @IsOptional()
  @IsBoolean()
  sendReachEvent?: boolean;

  /** S3-16 */
  @IsOptional()
  @IsBoolean()
  sendGiftEvent?: boolean;
}

/** Налаштування того, що й коли йде в рекламні кабінети (етап 03). */
@Controller('api/conversion-settings')
export class ConversionSettingsController {
  constructor(private conversion: ConversionService) {}

  @RequiresWorkspace()
  @Get()
  get(@WorkspaceId() workspaceId: string) {
    return this.conversion.getSettings(workspaceId);
  }

  @RequiresWorkspace()
  @Put()
  update(@Body() dto: UpdateConversionSettingsDto, @WorkspaceId() workspaceId: string) {
    return this.conversion.updateSettings(workspaceId, dto);
  }
}
