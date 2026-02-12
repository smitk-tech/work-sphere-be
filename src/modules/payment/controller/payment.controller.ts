import { Controller, Post, Body, UseGuards, Req, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { PaymentService } from '../service/payment.service';
import { InitiatePaymentDto } from '../dto/initiate-payment.dto';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user: {
    userId: string;
  };
}

@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Initiates a payment by creating records in DB and Stripe PaymentIntent
   */
  @UseGuards(JwtAuthGuard)
  @Post('initiate')
  async initiatePayment(
    @Req() req: RequestWithUser,
    @Body() dto: InitiatePaymentDto,
  ) {
    // req.user is populated by JwtAuthGuard/Strategy
    return this.paymentService.initiatePayment(req.user.userId, dto);
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
