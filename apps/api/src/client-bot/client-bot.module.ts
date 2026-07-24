import { Module } from '@nestjs/common';
import { ClientBotConnectionController } from './client-bot-connection.controller';
import { ClientBotConnectionService } from './client-bot-connection.service';
import { ClientBotRuntimeService } from './client-bot-runtime.service';

@Module({
  controllers: [ClientBotConnectionController],
  providers: [ClientBotConnectionService, ClientBotRuntimeService],
  exports: [ClientBotConnectionService],
})
export class ClientBotModule {}
