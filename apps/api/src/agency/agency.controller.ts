import {
  Controller, Get, Post, Patch, Body, Param, UseGuards, Req,
} from '@nestjs/common';
import { AgencyService, type ProvisionOrgInput } from './agency.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller('orgs/:agencyOrgId/agency')
@UseGuards(JwtAuthGuard)
export class AgencyController {
  constructor(private readonly agency: AgencyService) {}

  @Get('dashboard')
  getDashboard(
    @Param('agencyOrgId') agencyOrgId: string,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.agency.getDashboard(agencyOrgId, req.user?.sub ?? '');
  }

  @Get('orgs')
  listChildOrgs(
    @Param('agencyOrgId') agencyOrgId: string,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.agency.listChildOrgs(agencyOrgId, req.user?.sub ?? '');
  }

  @Get('orgs/:childOrgId')
  getChildOrg(
    @Param('agencyOrgId') agencyOrgId: string,
    @Param('childOrgId') childOrgId: string,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.agency.getChildOrg(agencyOrgId, childOrgId, req.user?.sub ?? '');
  }

  @Post('orgs')
  provisionOrg(
    @Param('agencyOrgId') agencyOrgId: string,
    @Body() dto: ProvisionOrgInput,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.agency.provisionChildOrg(agencyOrgId, dto, req.user?.sub ?? '');
  }

  @Patch('orgs/:childOrgId/settings')
  updateSettings(
    @Param('agencyOrgId') agencyOrgId: string,
    @Param('childOrgId') childOrgId: string,
    @Body() body: { settings: Record<string, unknown> },
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.agency.updateChildOrgSettings(
      agencyOrgId, childOrgId, body.settings, req.user?.sub ?? '',
    );
  }

  @Post('orgs/:childOrgId/suspend')
  suspend(
    @Param('agencyOrgId') agencyOrgId: string,
    @Param('childOrgId') childOrgId: string,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.agency.suspendChildOrg(agencyOrgId, childOrgId, req.user?.sub ?? '');
  }

  @Post('orgs/:childOrgId/reactivate')
  reactivate(
    @Param('agencyOrgId') agencyOrgId: string,
    @Param('childOrgId') childOrgId: string,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.agency.reactivateChildOrg(agencyOrgId, childOrgId, req.user?.sub ?? '');
  }
}
