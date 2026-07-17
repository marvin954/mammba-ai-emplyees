import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KnowledgeService } from './knowledge.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

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

  @Post('ingest/file')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  ingestFile(
    @Param('orgId') orgId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.knowledge.ingestFile(orgId, file.originalname, file.buffer, file.mimetype);
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
