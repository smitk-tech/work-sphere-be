import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService implements OnModuleInit {
  private stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      this.logger.warn(
        'STRIPE_SECRET_KEY is not defined in environment variables.',
      );
      return;
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2026-01-28.clover',
    } as unknown as Stripe.StripeConfig);
    this.logger.log('Stripe Service Initialized');
  }

  async createPaymentIntent(amount: number, currency: string = 'inr') {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to smallest currency unit
        currency: currency.toLowerCase(),
        automatic_payment_methods: {
          enabled: true,
        },
      });
      this.logger.log(`Stripe payment intent created: ${paymentIntent.id}`);
      return paymentIntent;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error creating Payment Intent: ${message}`);
      throw error;
    }
  }

  async confirmPayment(paymentIntentId: string, paymentMethodId: string) {
    try {
      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:5173';
      const paymentIntent = await this.stripe.paymentIntents.confirm(
        paymentIntentId,
        {
          payment_method: paymentMethodId,
          return_url: `${frontendUrl}/dashboard?payment=success`,
        },
      );
      this.logger.log(
        `Explicitly confirmed Stripe payment intent: ${paymentIntent.id} - ${paymentIntent.status}`,
      );
      return paymentIntent;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error during explicit payment confirmation: ${message}`,
      );
      throw error;
    }
  }
}
