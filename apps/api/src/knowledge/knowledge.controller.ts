import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { KnowledgeService } from './knowledge.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';

class SearchDto {
  query!: string;
  topK?: number;
}

class IngestTextDto {
  name!: string;
  text!: string;
}

@Controller('orgs/:orgId/knowledge')
@UseGuards(JwtAuthGuard)
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get('sources')
  listSources(@Param('orgId') orgId: string) {
    return this.knowledge.listSources(orgId);
  }

  @Get('sources/:sourceId')
  getSource(@Param('orgId') orgId: string, @Param('sourceId') sourceId: string) {
    return this.knowledge.getSource(orgId, sourceId);
  }

  @Delete('sources/:sourceId')
  deleteSource(@Param('orgId') orgId: string, @Param('sourceId') sourceId: string) {
    return this.knowledge.deleteSource(orgId, sourceId);
  }

  @Post('ingest/text')
  ingestText(@Param('orgId') orgId: string, @Body() dto: IngestTextDto) {
    return this.knowledge.ingestText(orgId, dto.name, dto.text);
  }

  @Get('search')
  search(
    @Param('orgId') orgId: string,
    @Query('query') query: string,
    @Query('topK') topK?: string,
  ) {
    if (!query) throw new BadRequestException('query is required');
    return this.knowledge.search(orgId, query, topK ? Number(topK) : undefined);
  }

  @Post('search')
  searchPost(@Param('orgId') orgId: string, @Body() dto: SearchDto) {
    return this.knowledge.search(orgId, dto.query, dto.topK);
  }
}
