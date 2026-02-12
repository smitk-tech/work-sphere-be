import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService implements OnModuleInit {
    private stripe: Stripe;
    private readonly logger = new Logger(StripeService.name);

    constructor(private configService: ConfigService) { }

    onModuleInit() {
        const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
        if (!secretKey) {
            this.logger.warn('STRIPE_SECRET_KEY is not defined in environment variables.');
            return;
        }

        this.stripe = new Stripe(secretKey, {
            apiVersion: '2026-01-28.clover' as any,
        });
        this.logger.log('Stripe Service Initialized');
    }

    async createPaymentIntent() {
        try {
            const paymentIntent = await this.stripe.paymentIntents.create({
                amount: 120000, // ₹1200.00
                currency: 'inr',
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
}
