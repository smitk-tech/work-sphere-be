import { Body, Controller, Post } from '@nestjs/common';
import { StripeService } from '../service/stripe.service';
import { CreatePaymentIntentDto } from '../dto/create-payment-intent.dto';
import { ConfirmPaymentDto } from '../dto/confirm-payment.dto';

@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  @Post('create-payment-intent')
  async createPaymentIntent(
    @Body() createPaymentIntentDto: CreatePaymentIntentDto,
  ) {
    const { amount, currency } = createPaymentIntentDto;
    const paymentIntent = await this.stripeService.createPaymentIntent(
      amount,
      currency,
    );
    return { clientSecret: paymentIntent.client_secret };
  }

  @Post('confirm-payment')
  async confirmPayment(@Body() confirmPaymentDto: ConfirmPaymentDto) {
    const { paymentIntentId, paymentMethodId } = confirmPaymentDto;
    const paymentIntent = await this.stripeService.confirmPayment(
      paymentIntentId,
      paymentMethodId,
    );
    return { status: paymentIntent.status, id: paymentIntent.id };
  }
}
