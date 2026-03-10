import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SendMessageDto } from '../dtos/send-message.dto';

@Injectable()
export class MessageService {
  constructor(private readonly prisma: PrismaService) {}

  async sendMessage(sendMessageDto: SendMessageDto) {
    const { receiverId, ciphertext, senderEmail } = sendMessageDto;

    const sender = await this.prisma.user.findUnique({
      where: { email: senderEmail },
    });

    if (!sender) {
      throw new NotFoundException('Sender not found');
    }

    return this.prisma.message.create({
      data: {
        senderId: sender.id,
        receiverId,
        ciphertext,
      },
      select: {
        id: true,
        senderId: true,
        receiverId: true,
        ciphertext: true,
        createdAt: true,
      },
    });
  }
}
