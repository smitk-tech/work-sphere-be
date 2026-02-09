import { PipeTransform, Injectable, HttpStatus } from '@nestjs/common';
import { ApiError } from '@common/http';
import { ERROR_MESSAGES } from '@common/constants';
import type { Schema } from 'joi';

/**
 * Abstract Base Class for Joi Validation Pipes
 * Extend this class and implement buildSchema() to create custom validation pipes
 */
@Injectable()
export abstract class JoiValidationPipe implements PipeTransform {
  private schema: Schema;

  constructor() {
    this.schema = this.buildSchema();
  }

  /**
   * Build and return the Joi validation schema
   * @returns Joi schema for validation
   */
  public abstract buildSchema(): Schema;

  /**
   * Transforms and validates the input value against the Joi schema
   * @param value The value to validate
   * @param metadata Metadata about the current operation
   * @returns The validated value
   */
  public transform(value: unknown): unknown {
    // Handle empty/undefined values
    if (value === undefined || value === null || value === '') {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        ERROR_MESSAGES.COMMON.REQUEST_BODY_REQUIRED,
      );
    }

    const result = this.buildSchema().validate(value, {
      abortEarly: false, // Return all validation errors
      allowUnknown: false, // Don't allow unknown fields
    });

    if (result.error) {
      // Format error messages to be more user-friendly
      const errorMessages = result.error.details.map((detail) => {
        const message = detail.message
          .replace(/"/g, '') // Remove quotes
          .replace(/\.$/, '') // Remove trailing period
          .replace(/^[a-z]/, (char) => char.toUpperCase()); // Capitalize first letter

        return message;
      });

      const formattedMessage = errorMessages.join(', ');

      throw new ApiError(HttpStatus.BAD_REQUEST, formattedMessage);
    }

    return result.value;
  }
}
