import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SignupDto } from '../dtos/signup.dto';

/**
 * Handle authentication-related business logic
 */
@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

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
      return await this.prisma.user.create({
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
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      // Log error here if needed
      throw new InternalServerErrorException('Failed to create user profile');
    }
  }
}
