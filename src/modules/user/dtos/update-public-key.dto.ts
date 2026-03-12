import { ApiProperty } from '@nestjs/swagger';

export class UpdatePublicKeyDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'The email of the user',
  })
  email: string;

  @ApiProperty({
    example: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...',
    description: 'The base64 encoded RSA-OAEP public key',
  })
  publicKey: string;
}
