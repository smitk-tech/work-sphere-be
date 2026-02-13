import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SignupDto } from '../dtos/signup.dto';
import { StripeService } from '../../stripe/service/stripe.service';

/**
 * Handle authentication-related business logic
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  /**
   * Registers a new user in the database
   * @param signupDto The user's signup information
   * @returns The created user object
   */
  async signup(signupDto: SignupDto) {
    try {
      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email: signupDto.email },
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      // Create new user record
      const user = await this.prisma.user.create({
        data: {
          id: signupDto.id,
          email: signupDto.email,
          firstName: signupDto.firstName,
          lastName: signupDto.lastName,
          number: signupDto.number,
          address: signupDto.address,
          state: signupDto.state,
          city: signupDto.city,
          zipCode: signupDto.zipCode,
          role: signupDto.role,
        },
      });

      // Create Stripe Customer
      try {
        const customer = await this.stripeService.createCustomer(
          user.email,
          `${user.firstName} ${user.lastName}`,
        );

        // Update user with Stripe Customer ID
        return await this.prisma.user.update({
          where: { id: user.id },
          data: { customerId: customer.id },
        });
      } catch (stripeError) {
        console.error(
          'Failed to create Stripe customer for new user',
          stripeError,
        );
        return user;
      }
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      // Log error here if needed
      throw error;
    }
  }

  /**
   * Logout user (stateless)
   */
  logout() {
    return { message: 'Logged out successfully' };
  }
}
