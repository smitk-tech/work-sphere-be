import { ApiProperty } from '@nestjs/swagger';
import { JoiValidationPipe } from '../../../common/pipes/joi-validation.pipe';
import * as Joi from 'joi';

/**
 * Data Transfer Object for Signup Request
 */
export class SignupDto {
  @ApiProperty({
    description: 'The unique identifier for the user (from Supabase Auth)',
    example: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
  })
  id: string;

  @ApiProperty({
    description: 'The email address of the user',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'The first name of the user',
    example: 'John',
    required: false,
  })
  firstName?: string;

  @ApiProperty({
    description: 'The last name of the user',
    example: 'Doe',
    required: false,
  })
  lastName?: string;

  @ApiProperty({
    description: 'The mobile number of the user',
    example: '+1234567890',
    required: false,
  })
  number?: string;

  @ApiProperty({
    description: 'The residential address of the user',
    example: '123 Main St',
    required: false,
  })
  address?: string;

  @ApiProperty({
    description: 'The state/province of the user',
    example: 'California',
    required: false,
  })
  state?: string;

  @ApiProperty({
    description: 'The city of the user',
    example: 'Los Angeles',
    required: false,
  })
  city?: string;

  @ApiProperty({
    description: 'The ZIP/Postal code of the user',
    example: '90001',
    required: false,
  })
  zipCode?: string;

  @ApiProperty({
    description: 'The role assigned to the user',
    example: 'employee',
    required: false,
  })
  role?: string;
}

export class SignupValidationPipe extends JoiValidationPipe {
  /**
   * Build Joi schema for signup validation
   * @returns Joi validation schema
   */
  public buildSchema(): Joi.Schema {
    return Joi.object<SignupDto>({
      id: Joi.string().required().messages({
        'string.empty': 'User ID is required',
        'any.required': 'User ID is required',
      }),
      email: Joi.string().email().required().messages({
        'string.email': 'Please provide a valid email address',
        'string.empty': 'Email is required',
        'any.required': 'Email is required',
      }),
      firstName: Joi.string().optional().allow('', null),
      lastName: Joi.string().optional().allow('', null),
      number: Joi.string().optional().allow('', null),
      address: Joi.string().optional().allow('', null),
      state: Joi.string().optional().allow('', null),
      city: Joi.string().optional().allow('', null),
      zipCode: Joi.string().optional().allow('', null),
      role: Joi.string().optional().allow('', null),
    });
  }
}
