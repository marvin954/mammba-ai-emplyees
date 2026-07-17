import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, Req,
} from '@nestjs/common';
import { FinanceService, CreateTransactionInput, UpdateTransactionInput } from './finance.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller('orgs/:orgId/finance')
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('summary')
  getSummary(@Param('orgId') orgId: string, @Query('month') month?: string) {
    return this.finance.getSummary(orgId, { month });
  }

  @Get('transactions')
  listTransactions(
    @Param('orgId') orgId: string,
    @Query('type') type?: string,
    @Query('category') category?: string,
    @Query('flagged') flagged?: string,
    @Query('reconciled') reconciled?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.finance.listTransactions(orgId, {
      type,
      category,
      flagged: flagged !== undefined ? flagged === 'true' : undefined,
      reconciled: reconciled !== undefined ? reconciled === 'true' : undefined,
      from,
      to,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('transactions/:txId')
  getTransaction(@Param('orgId') orgId: string, @Param('txId') txId: string) {
    return this.finance.getTransaction(orgId, txId);
  }

  @Post('transactions')
  createTransaction(
    @Param('orgId') orgId: string,
    @Body() dto: CreateTransactionInput,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.finance.createTransaction(orgId, dto, req.user?.sub ?? '');
  }

  @Patch('transactions/:txId')
  updateTransaction(
    @Param('orgId') orgId: string,
    @Param('txId') txId: string,
    @Body() dto: UpdateTransactionInput,
  ) {
    return this.finance.updateTransaction(orgId, txId, dto);
  }

  @Delete('transactions/:txId')
  deleteTransaction(@Param('orgId') orgId: string, @Param('txId') txId: string) {
    return this.finance.deleteTransaction(orgId, txId);
  }

  @Post('transactions/reconcile')
  bulkReconcile(@Param('orgId') orgId: string, @Body() dto: { txIds: string[] }) {
    return this.finance.bulkReconcile(orgId, dto.txIds);
  }
}
