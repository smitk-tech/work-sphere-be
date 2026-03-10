import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object for sending an anonymous message
 */
export class SendMessageDto {
  /**
   * The unique identifier of the user who will receive the message
   */
  @ApiProperty({
    example: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
    description: 'The UUID of the receiving user',
    required: true,
    type: String,
  })
  receiverId: string;

  /**
   * The encrypted or plain text content of the message
   */
  @ApiProperty({
    example: 'Hello, this is a secret message',
    description: 'The content of the anonymous message',
    required: true,
    type: String,
  })
  ciphertext: string;

  /**
   * The email of the sending user (used since JWT auth is disabled)
   */
  @ApiProperty({
    example: 'sender@example.com',
    description: 'The email of the sender',
    required: true,
    type: String,
  })
  senderEmail: string;
}
