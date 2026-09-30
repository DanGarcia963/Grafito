import 'dotenv/config';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { integerEnv } from './config/runtime';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ transactionOptions: {
      maxWait: integerEnv('PRISMA_TRANSACTION_MAX_WAIT_MS', 10000),
      timeout: integerEnv('PRISMA_TRANSACTION_TIMEOUT_MS', 30000),
    } });
  }
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
