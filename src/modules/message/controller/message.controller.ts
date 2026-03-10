import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { MessageService } from '../service/message.service';
import { SendMessageDto } from '../dtos/send-message.dto';

@ApiTags('messages')
@Controller('messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post('send')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a message to a user' })
  @ApiBody({ type: SendMessageDto })
  @ApiResponse({ status: 201, description: 'Message successfully sent' })
  async sendMessage(@Body() sendMessageDto: SendMessageDto) {
    return this.messageService.sendMessage(sendMessageDto);
  }
}
