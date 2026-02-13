import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { StripeService } from '../../stripe/service/stripe.service';
import { ApiError } from '../../../common/http/api-error';
import { ERROR_MESSAGES } from '../../../common/constants';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private prisma: PrismaService,
    private stripeService: StripeService,
  ) {}

  async getOrCreateStripeCustomer(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        ERROR_MESSAGES.PAYMENT.USER_NOT_FOUND,
      );
    }

    if (user.customerId) {
      return user.customerId;
    }

    // Check if customer exists in Stripe by email
    const existingCustomer = await this.stripeService.getCustomerByEmail(
      user.email,
    );

    if (existingCustomer) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { customerId: existingCustomer.id },
      });
      return existingCustomer.id;
    }

    // Create new customer if not found
    const newCustomer = await this.stripeService.createCustomer(
      user.email,
      `${user.firstName} ${user.lastName}`,
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { customerId: newCustomer.id },
    });

    return newCustomer.id;
  }

  async getPaymentHistoryByCustomerId(email: string) {
    if (!email) {
      return [];
    }

    const decodedEmail = decodeURIComponent(email);
    const user = await this.prisma.user.findUnique({
      where: { email: decodedEmail },
    });
    if (!user) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        ERROR_MESSAGES.PAYMENT.USER_NOT_FOUND,
      );
    }

    const paymentIntents = await this.stripeService.listPaymentIntents(
      user.customerId ?? '',
    );

    return paymentIntents.map((pi) => ({
      id: pi.id,
      amount: pi.amount / 100,
      currency: pi.currency,
      status: pi.status,
      createdAt: new Date(pi.created * 1000).toISOString(),
      description: pi.description || 'Stripe Payment',
    }));
  }

  async updatePaymentStatus(paymentIntentId: string, status: string) {
    this.logger.log(
      `Updating payment status for intent ${paymentIntentId} to ${status}`,
    );

    const transaction = await this.prisma.paymentTransaction.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
    });

    if (!transaction) {
      this.logger.error(
        `No transaction found for payment intent ${paymentIntentId}`,
      );
      return;
    }

    await this.prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: { status },
    });

    if (status === 'succeeded') {
      await this.prisma.userPayment.update({
        where: { id: transaction.userPaymentId },
        data: { status: 'COMPLETED' },
      });
    }
  }
}
