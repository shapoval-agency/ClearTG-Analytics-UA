import { Controller, Post } from '@nestjs/common';
import { RetentionService } from './retention.service';

@Controller('api/retention')
export class RetentionController {
  constructor(private retention: RetentionService) {}

  @Post('run')
  runNow() {
    return this.retention.runRetentionCheck();
  }
}
