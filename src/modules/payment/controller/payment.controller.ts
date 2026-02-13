import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Logger,
  Get,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { PaymentService } from '../service/payment.service';
import { Request } from 'express';

@Controller('payment')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @Get('history')
  async getPaymentHistory(@Query('email') email?: string) {
    console.log('email from payment controller', email);
    if (email) {
      return this.paymentService.getPaymentHistoryByCustomerId(email);
    }
  }

  /**
   * Handles Stripe Webhooks for payment status updates
   * Note: Signature verification is recommended for production using stripe.webhooks.constructEvent
   */
  @Post('webhook')
  async handleWebhook(@Req() req: Request) {
    this.logger.log(`Received Webhook: ${(req.body as { type: string }).type}`);

    const event = req.body as {
      type: string;
      data: { object: { id: string } };
    };

    try {
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const succeededIntent = event.data.object;
          await this.paymentService.updatePaymentStatus(
            succeededIntent.id,
            'succeeded',
          );
          break;
        }
        case 'payment_intent.payment_failed': {
          const failedIntent = event.data.object;
          await this.paymentService.updatePaymentStatus(
            failedIntent.id,
            'failed',
          );
          break;
        }
        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Webhook handler failed: ${message}`);
    }

    return { received: true };
  }
}
