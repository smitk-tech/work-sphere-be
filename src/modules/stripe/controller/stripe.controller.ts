import { Controller, Post } from '@nestjs/common';
import { StripeService } from '../service/stripe.service';

@Controller('stripe')
export class StripeController {
    constructor(private readonly stripeService: StripeService) { }

    @Post('create-payment-intent')
    async createPaymentIntent() {
        const paymentIntent = await this.stripeService.createPaymentIntent();
        return { clientSecret: paymentIntent.client_secret };
    }
}
