import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LoggerService {
  private readonly logger = new Logger();

  info(message: string, context?: string, data?: any) {
    this.logger.log(message, context);
    if (data) this.logger.log(JSON.stringify(data), context);
  }

  error(message: string, context?: string, data?: any) {
    this.logger.error(message, undefined, context);
    if (data) this.logger.error(JSON.stringify(data), undefined, context);
  }

  warn(message: string, context?: string, data?: any) {
    this.logger.warn(message, context);
    if (data) this.logger.warn(JSON.stringify(data), context);
  }

  debug(message: string, context?: string, data?: any) {
    this.logger.debug(message, context);
    if (data) this.logger.debug(JSON.stringify(data), context);
  }
}
