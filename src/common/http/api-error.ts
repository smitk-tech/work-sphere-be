import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Custom API Error class for consistent error handling
 */
export class ApiError extends HttpException {
  constructor(
    statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    message: string = 'An error occurred',
  ) {
    super(message, statusCode);
  }
}
