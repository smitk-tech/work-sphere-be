import { Test, TestingModule } from '@nestjs/testing';
import { MessageController } from './controller/message.controller';
import { MessageService } from './service/message.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { SendMessageDto } from './dtos/send-message.dto';

describe('Message Module - Controller and Service', () => {
  let messageController: MessageController;
  let messageService: MessageService;
  let prismaService: PrismaService;

  const mockSender = {
    id: 'sender-123',
    email: 'sender@example.com',
    firstName: 'John',
    lastName: 'Doe',
    number: '9876543210',
    address: '123 Main St',
    state: 'CA',
    city: 'San Francisco',
    zipCode: '94102',
    role: 'user',
    customerId: 'cus_123456',
    publicKey: 'public-key-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockReceiver = {
    id: 'receiver-123',
    email: 'receiver@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
    number: '8765432109',
    address: '456 Oak St',
    state: 'NY',
    city: 'New York',
    zipCode: '10001',
    role: 'user',
    customerId: 'cus_789012',
    publicKey: 'public-key-456',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMessage = {
    id: 'msg-123',
    senderId: 'sender-123',
    receiverId: 'receiver-123',
    ciphertext: 'encrypted_message_content',
    createdAt: new Date(),
  };

  const mockSendMessageDto: SendMessageDto = {
    receiverId: 'receiver-123',
    ciphertext: 'encrypted_message_content',
    senderEmail: 'sender@example.com',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessageController],
      providers: [
        MessageService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
            message: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    messageController = module.get<MessageController>(MessageController);
    messageService = module.get<MessageService>(MessageService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('MessageService.sendMessage', () => {
    it('should successfully send a message from sender to receiver', async () => {
      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValueOnce(mockSender);
      jest.spyOn(prismaService.message, 'create').mockResolvedValueOnce({
        id: mockMessage.id,
        senderId: mockMessage.senderId,
        receiverId: mockMessage.receiverId,
        ciphertext: mockMessage.ciphertext,
        createdAt: mockMessage.createdAt,
      });

      const result = await messageService.sendMessage(mockSendMessageDto);

      expect(result.id).toBe(mockMessage.id);
      expect(result.senderId).toBe(mockSender.id);
      expect(result.receiverId).toBe(mockSendMessageDto.receiverId);
      expect(result.ciphertext).toBe(mockSendMessageDto.ciphertext);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: mockSendMessageDto.senderEmail },
      });
    });

    it('should throw NotFoundException if sender does not exist', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce(null);

      await expect(
        messageService.sendMessage(mockSendMessageDto),
      ).rejects.toThrow(NotFoundException);
      expect(prismaService.message.create).not.toHaveBeenCalled();
    });

    it('should create message with correct data structure', async () => {
      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValueOnce(mockSender);
      jest.spyOn(prismaService.message, 'create').mockResolvedValueOnce({
        id: mockMessage.id,
        senderId: mockMessage.senderId,
        receiverId: mockMessage.receiverId,
        ciphertext: mockMessage.ciphertext,
        createdAt: mockMessage.createdAt,
      });

      await messageService.sendMessage(mockSendMessageDto);

      expect(prismaService.message.create).toHaveBeenCalledWith({
        data: {
          senderId: mockSender.id,
          receiverId: mockSendMessageDto.receiverId,
          ciphertext: mockSendMessageDto.ciphertext,
        },
        select: {
          id: true,
          senderId: true,
          receiverId: true,
          ciphertext: true,
          createdAt: true,
        },
      });
    });

    it('should handle encrypted message content correctly', async () => {
      const encryptedDto: SendMessageDto = {
        ...mockSendMessageDto,
        ciphertext:
          'U2FsdGVkX1+/vJZHwKxQU2FsdGVkX1+/vJZHwKxQU2FsdGVkX1+/vJZHwKxQ',
      };

      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValueOnce(mockSender);
      jest.spyOn(prismaService.message, 'create').mockResolvedValueOnce({
        id: mockMessage.id,
        senderId: mockSender.id,
        receiverId: encryptedDto.receiverId,
        ciphertext: encryptedDto.ciphertext,
        createdAt: mockMessage.createdAt,
      });

      const result = await messageService.sendMessage(encryptedDto);

      expect(result.ciphertext).toBe(encryptedDto.ciphertext);
    });

    it('should return message with all required fields', async () => {
      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValueOnce(mockSender);
      jest.spyOn(prismaService.message, 'create').mockResolvedValueOnce({
        id: 'msg-456',
        senderId: mockSender.id,
        receiverId: mockSendMessageDto.receiverId,
        ciphertext: mockSendMessageDto.ciphertext,
        createdAt: new Date(),
      });

      const result = await messageService.sendMessage(mockSendMessageDto);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('senderId');
      expect(result).toHaveProperty('receiverId');
      expect(result).toHaveProperty('ciphertext');
      expect(result).toHaveProperty('createdAt');
    });

    it('should not include unwanted fields in response', async () => {
      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValueOnce(mockSender);
      jest.spyOn(prismaService.message, 'create').mockResolvedValueOnce({
        id: mockMessage.id,
        senderId: mockMessage.senderId,
        receiverId: mockMessage.receiverId,
        ciphertext: mockMessage.ciphertext,
        createdAt: mockMessage.createdAt,
      });

      const result = await messageService.sendMessage(mockSendMessageDto);

      expect(result).not.toHaveProperty('sender');
      expect(result).not.toHaveProperty('receiver');
      expect(result).not.toHaveProperty('updatedAt');
    });

    it('should verify sender email is correctly used to find sender', async () => {
      const customEmail = 'custom@example.com';
      const dtoWithCustomEmail: SendMessageDto = {
        ...mockSendMessageDto,
        senderEmail: customEmail,
      };

      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValueOnce(mockSender);
      jest.spyOn(prismaService.message, 'create').mockResolvedValueOnce({
        id: mockMessage.id,
        senderId: mockSender.id,
        receiverId: dtoWithCustomEmail.receiverId,
        ciphertext: dtoWithCustomEmail.ciphertext,
        createdAt: mockMessage.createdAt,
      });

      await messageService.sendMessage(dtoWithCustomEmail);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: customEmail },
      });
    });

    it('should handle error when sender lookup fails', async () => {
      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockRejectedValueOnce(new Error('Database error'));

      await expect(
        messageService.sendMessage(mockSendMessageDto),
      ).rejects.toThrow('Database error');
    });

    it('should not proceed with message creation if sender not found', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce(null);

      try {
        await messageService.sendMessage(mockSendMessageDto);
      } catch {
        // Error expected
      }

      expect(prismaService.message.create).not.toHaveBeenCalled();
    });

    it('should handle multiple messages from same sender', async () => {
      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValue(mockSender);
      jest
        .spyOn(prismaService.message, 'create')
        .mockResolvedValueOnce({
          id: 'msg-1',
          senderId: mockSender.id,
          receiverId: 'receiver-1',
          ciphertext: 'message-1',
          createdAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: 'msg-2',
          senderId: mockSender.id,
          receiverId: 'receiver-2',
          ciphertext: 'message-2',
          createdAt: new Date(),
        });

      const result1 = await messageService.sendMessage({
        ...mockSendMessageDto,
        receiverId: 'receiver-1',
      });
      const result2 = await messageService.sendMessage({
        ...mockSendMessageDto,
        receiverId: 'receiver-2',
      });

      expect(result1.receiverId).toBe('receiver-1');
      expect(result2.receiverId).toBe('receiver-2');
      expect(prismaService.message.create).toHaveBeenCalledTimes(2);
    });

    it('should correctly map receiver ID from DTO to database', async () => {
      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValueOnce(mockSender);
      jest.spyOn(prismaService.message, 'create').mockResolvedValueOnce({
        id: mockMessage.id,
        senderId: mockSender.id,
        receiverId: 'specific-receiver-id',
        ciphertext: mockMessage.ciphertext,
        createdAt: mockMessage.createdAt,
      });

      const result = await messageService.sendMessage({
        ...mockSendMessageDto,
        receiverId: 'specific-receiver-id',
      });

      expect(result.receiverId).toBe('specific-receiver-id');
    });
  });

  describe('MessageController.sendMessage', () => {
    it('should call messageService.sendMessage with correct DTO', async () => {
      const mockResult = {
        id: 'msg-123',
        senderId: 'sender-123',
        receiverId: 'receiver-123',
        ciphertext: 'encrypted_content',
        createdAt: new Date(),
      };

      jest
        .spyOn(messageService, 'sendMessage')
        .mockResolvedValueOnce(mockResult);

      const result = await messageController.sendMessage(mockSendMessageDto);

      expect(result).toEqual(mockResult);
      expect(messageService.sendMessage).toHaveBeenCalledWith(
        mockSendMessageDto,
      );
    });

    it('should return message created response', async () => {
      const mockResult = {
        id: 'msg-456',
        senderId: 'sender-456',
        receiverId: 'receiver-456',
        ciphertext: 'encrypted_content_456',
        createdAt: new Date(),
      };

      jest
        .spyOn(messageService, 'sendMessage')
        .mockResolvedValueOnce(mockResult);

      const result = await messageController.sendMessage(mockSendMessageDto);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('senderId');
    });

    it('should propagate NotFoundException from service', async () => {
      jest
        .spyOn(messageService, 'sendMessage')
        .mockRejectedValueOnce(new NotFoundException('Sender not found'));

      await expect(
        messageController.sendMessage(mockSendMessageDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle service errors gracefully', async () => {
      jest
        .spyOn(messageService, 'sendMessage')
        .mockRejectedValueOnce(new Error('Service error'));

      await expect(
        messageController.sendMessage(mockSendMessageDto),
      ).rejects.toThrow('Service error');
    });
  });

  describe('Integration Tests', () => {
    it('should send message successfully from start to finish', async () => {
      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValueOnce(mockSender);
      jest.spyOn(prismaService.message, 'create').mockResolvedValueOnce({
        id: 'msg-integration',
        senderId: mockSender.id,
        receiverId: mockSendMessageDto.receiverId,
        ciphertext: mockSendMessageDto.ciphertext,
        createdAt: new Date(),
      });

      const result = await messageController.sendMessage(mockSendMessageDto);

      expect(result).toBeDefined();
      expect(result.id).toBe('msg-integration');
      expect(result.senderId).toBe(mockSender.id);
    });

    it('should handle message sending with various ciphertext formats', async () => {
      const testCiphertexts = [
        'simple-text',
        'U2FsdGVkX1+/vJZHwKxQU2FsdGVkX1+/vJZHwKxQ',
        '{encrypted: true}',
      ];

      for (const ciphertext of testCiphertexts) {
        jest
          .spyOn(prismaService.user, 'findUnique')
          .mockResolvedValueOnce(mockSender);
        jest.spyOn(prismaService.message, 'create').mockResolvedValueOnce({
          id: `msg-${ciphertext}`,
          senderId: mockSender.id,
          receiverId: mockSendMessageDto.receiverId,
          ciphertext,
          createdAt: new Date(),
        });

        const result = await messageService.sendMessage({
          ...mockSendMessageDto,
          ciphertext,
        });

        expect(result.ciphertext).toBe(ciphertext);
      }
    });
  });
});
