import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        publicKey: true,
      },
      orderBy: {
        firstName: 'asc',
      },
    });
  }

  async updatePublicKey(email: string, publicKey: string) {
    return this.prisma.user.update({
      where: { email },
      data: { publicKey },
      select: {
        id: true,
        email: true,
        publicKey: true,
      },
    });
  }
}
