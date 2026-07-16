import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AgencyService } from './agency.service';
import { CurrentUser } from '../common/decorators/user.decorator';

class CreateClientDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  ownerEmail!: string;
}

@Controller('api/agency')
export class AgencyController {
  constructor(private agency: AgencyService) {}

  @Get('clients')
  listClients(@CurrentUser() user: { id: string; email: string }) {
    this.agency.assertAgencyAdmin(user.email);
    return this.agency.listClientWorkspaces(user.id);
  }

  @Post('clients')
  createClient(
    @Body() dto: CreateClientDto,
    @CurrentUser() user: { id: string; email: string },
  ) {
    this.agency.assertAgencyAdmin(user.email);
    return this.agency.createClientWorkspace(user.id, dto.ownerEmail, dto.name);
  }

  @Delete('clients/:workspaceId')
  deleteClient(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: { id: string; email: string },
  ) {
    this.agency.assertAgencyAdmin(user.email);
    return this.agency.deleteClientWorkspace(user.id, workspaceId);
  }

  /** Alias for hosts/proxies that block HTTP DELETE. */
  @Post('clients/:workspaceId/delete')
  deleteClientPost(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: { id: string; email: string },
  ) {
    this.agency.assertAgencyAdmin(user.email);
    return this.agency.deleteClientWorkspace(user.id, workspaceId);
  }
}
