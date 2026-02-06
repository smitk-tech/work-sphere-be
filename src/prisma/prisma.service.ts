import { ERROR_MESSAGES } from '@common/constants';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { LoggerService } from './logger.service';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private readonly logger: LoggerService) {
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      log: ['warn', 'error', 'info'],
    });
  }

  public async onModuleInit() {
    try {
      this.logger.info('Connecting to database...', 'PrismaService');
      await this.$connect();
      this.logger.info('Successfully connected to database', 'PrismaService', {
        databaseUrl: process.env.DATABASE_URL ? 'configured' : 'missing',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : ERROR_MESSAGES.COMMON.SOMETHING_WENT_WRONG;
      this.logger.error(
        `Failed to connect to database: ${errorMessage}`,
        'PrismaService',
        {
          error: error instanceof Error ? error.stack : String(error),
          errorMessage,
        },
      );
    }
  }

  public async onModuleDestroy() {
    try {
      this.logger.info('Disconnecting from database...', 'PrismaService');
      await this.$disconnect();
      this.logger.info(
        'Successfully disconnected from database',
        'PrismaService',
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : ERROR_MESSAGES.COMMON.SOMETHING_WENT_WRONG;
      this.logger.error(
        `Error disconnecting from database: ${errorMessage}`,
        'PrismaService',
        {
          error: error instanceof Error ? error.stack : String(error),
          errorMessage,
        },
      );
    }
  }

  // Add a method to test database connectivity
  public async testConnection(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      this.logger.debug('Database connection test successful', 'PrismaService');
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : ERROR_MESSAGES.COMMON.SOMETHING_WENT_WRONG;
      this.logger.error(
        `Database connection test failed: ${errorMessage}`,
        'PrismaService',
        {
          error: error instanceof Error ? error.stack : String(error),
          errorMessage,
        },
      );
      return false;
    }
  }
}
