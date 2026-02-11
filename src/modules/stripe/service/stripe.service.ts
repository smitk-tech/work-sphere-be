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
            apiVersion: '2025-01-27' as any,
        });
        this.logger.log('Stripe Service Initialized');
    }

    async createCustomer(email: string, name?: string) {
        try {
            const customer = await this.stripe.customers.create({
                email,
                name,
            });
            this.logger.log(`Stripe customer created: ${customer.id}`);
            return customer;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Error creating Stripe customer: ${message}`);
            throw error;
        }
    }

    // Add more methods as needed (e.g., createPaymentIntent, etc.)
}
