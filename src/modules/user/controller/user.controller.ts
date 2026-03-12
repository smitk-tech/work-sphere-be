import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { UserService } from '../service/user.service';
import { UpdatePublicKeyDto } from '../dtos/update-public-key.dto';

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'Return all users' })
  async findAll() {
    return this.userService.findAll();
  }

  @Post('key')
  @ApiOperation({ summary: 'Update public key for user' })
  @ApiBody({ type: UpdatePublicKeyDto })
  @ApiResponse({ status: 200, description: 'Public key updated' })
  async updatePublicKey(@Body() updateKeyDto: UpdatePublicKeyDto) {
    return this.userService.updatePublicKey(
      updateKeyDto.email,
      updateKeyDto.publicKey,
    );
  }
}
