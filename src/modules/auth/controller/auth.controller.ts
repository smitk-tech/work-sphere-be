import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from '../service/auth.service';
import { SignupDto, SignupValidationPipe } from '../dtos/signup.dto';

/**
 * Authentication Controller
 * Handles user signup and other auth-related requests
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Endpoint for user signup
   * @param signupDto The user's signup details
   * @returns Success message and user data
   */
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: SignupDto })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 400, description: 'Bad Request - Validation failed' })
  @ApiResponse({ status: 409, description: 'Conflict - User already exists' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async signup(@Body(SignupValidationPipe) signupDto: SignupDto) {
    const user = await this.authService.signup(signupDto);
    return {
      message: 'User registered successfully',
      data: user,
    };
  }
}
