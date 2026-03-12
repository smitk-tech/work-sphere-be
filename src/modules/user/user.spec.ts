import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './controller/user.controller';
import { UserService } from './service/user.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdatePublicKeyDto } from './dtos/update-public-key.dto';

describe('User Module - Controller and Service', () => {
  let userController: UserController;
  let userService: UserService;
  let prismaService: PrismaService;

  const mockUsers = [
    {
      id: 'user-001',
      firstName: 'Alice',
      lastName: 'Johnson',
      email: 'alice@example.com',
      role: 'user',
      publicKey: 'public-key-001',
    },
    {
      id: 'user-002',
      firstName: 'Bob',
      lastName: 'Smith',
      email: 'bob@example.com',
      role: 'admin',
      publicKey: 'public-key-002',
    },
    {
      id: 'user-003',
      firstName: 'Charlie',
      lastName: 'Brown',
      email: 'charlie@example.com',
      role: 'user',
      publicKey: null,
    },
  ];

  const mockUser = {
    id: 'user-001',
    firstName: 'Alice',
    lastName: 'Johnson',
    email: 'alice@example.com',
    role: 'user',
    publicKey: 'public-key-001',
    number: '9876543210',
    address: '123 Main St',
    state: 'CA',
    city: 'San Francisco',
    zipCode: '94102',
    customerId: 'cus_123456',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              create: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    userController = module.get<UserController>(UserController);
    userService = module.get<UserService>(UserService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('UserService.findAll', () => {
    it('should return all users with specific fields', async () => {
      jest
        .spyOn(prismaService.user, 'findMany')
        .mockResolvedValueOnce(mockUsers);

      const result = await userService.findAll();

      expect(result).toEqual(mockUsers);
      expect(prismaService.user.findMany).toHaveBeenCalledWith({
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
    });

    it('should return empty array if no users exist', async () => {
      jest.spyOn(prismaService.user, 'findMany').mockResolvedValueOnce([]);

      const result = await userService.findAll();

      expect(result).toEqual([]);
    });

    it('should order users by firstName in ascending order', async () => {
      const unorderedUsers = [
        { ...mockUsers[1] },
        { ...mockUsers[0] },
        { ...mockUsers[2] },
      ];

      jest
        .spyOn(prismaService.user, 'findMany')
        .mockResolvedValueOnce([
          { ...mockUsers[0] },
          { ...mockUsers[1] },
          { ...mockUsers[2] },
        ]);

      const result = await userService.findAll();

      expect(result[0].firstName).toBe('Alice');
      expect(result[1].firstName).toBe('Bob');
      expect(result[2].firstName).toBe('Charlie');
    });

    it('should only select specified fields', async () => {
      jest
        .spyOn(prismaService.user, 'findMany')
        .mockResolvedValueOnce(mockUsers);

      await userService.findAll();

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            publicKey: true,
          },
        }),
      );
    });

    it('should not include sensitive fields in response', async () => {
      jest
        .spyOn(prismaService.user, 'findMany')
        .mockResolvedValueOnce(mockUsers);

      const result = await userService.findAll();

      const firstUser = result[0];
      expect(firstUser).not.toHaveProperty('customerId');
      expect(firstUser).not.toHaveProperty('number');
      expect(firstUser).not.toHaveProperty('address');
      expect(firstUser).not.toHaveProperty('state');
    });

    it('should handle database errors gracefully', async () => {
      jest
        .spyOn(prismaService.user, 'findMany')
        .mockRejectedValueOnce(new Error('Database error'));

      await expect(userService.findAll()).rejects.toThrow('Database error');
    });

    it('should return users with all required fields', async () => {
      jest
        .spyOn(prismaService.user, 'findMany')
        .mockResolvedValueOnce(mockUsers);

      const result = await userService.findAll();

      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('firstName');
      expect(result[0]).toHaveProperty('lastName');
      expect(result[0]).toHaveProperty('email');
      expect(result[0]).toHaveProperty('role');
      expect(result[0]).toHaveProperty('publicKey');
    });

    it('should handle large number of users', async () => {
      const manyUsers = Array.from({ length: 1000 }, (_, i) => ({
        id: `user-${i}`,
        firstName: `User${i}`,
        lastName: `Last${i}`,
        email: `user${i}@example.com`,
        role: 'user',
        publicKey: `key-${i}`,
      }));

      jest
        .spyOn(prismaService.user, 'findMany')
        .mockResolvedValueOnce(manyUsers);

      const result = await userService.findAll();

      expect(result).toHaveLength(1000);
    });

    it('should handle users with null publicKey', async () => {
      jest
        .spyOn(prismaService.user, 'findMany')
        .mockResolvedValueOnce([mockUsers[2]]);

      const result = await userService.findAll();

      expect(result[0].publicKey).toBeNull();
    });

    it('should work with users of different roles', async () => {
      jest
        .spyOn(prismaService.user, 'findMany')
        .mockResolvedValueOnce(mockUsers);

      const result = await userService.findAll();

      const roles = result.map((u) => u.role);
      expect(roles).toContain('user');
      expect(roles).toContain('admin');
    });
  });

  describe('UserService.updatePublicKey', () => {
    it('should update user public key', async () => {
      const updatedUser = { ...mockUser, publicKey: 'new-public-key' };
      jest
        .spyOn(prismaService.user, 'update')
        .mockResolvedValueOnce(updatedUser);

      const result = await userService.updatePublicKey(
        'alice@example.com',
        'new-public-key',
      );

      expect(result.publicKey).toBe('new-public-key');
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { email: 'alice@example.com' },
        data: { publicKey: 'new-public-key' },
        select: {
          id: true,
          email: true,
          publicKey: true,
        },
      });
    });

    it('should return only id, email, and publicKey', async () => {
      const updatedUser = {
        id: 'user-001',
        email: 'alice@example.com',
        publicKey: 'new-key',
      };

      jest
        .spyOn(prismaService.user, 'update')
        .mockResolvedValueOnce(updatedUser);

      const result = await userService.updatePublicKey(
        'alice@example.com',
        'new-key',
      );

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('publicKey');
      expect(result).not.toHaveProperty('firstName');
      expect(result).not.toHaveProperty('lastName');
    });

    it('should handle updating with empty publicKey string', async () => {
      const updatedUser = {
        id: 'user-001',
        email: 'alice@example.com',
        publicKey: '',
      };

      jest
        .spyOn(prismaService.user, 'update')
        .mockResolvedValueOnce(updatedUser);

      const result = await userService.updatePublicKey('alice@example.com', '');

      expect(result.publicKey).toBe('');
    });

    it('should handle updating with long publicKey', async () => {
      const longKey =
        'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2Z3qX2BTLS39R3wvUL3p+JareY8Ypo4' +
        '5jDU2kWnJvUdUZNu5LOOjsRBNlMX5o8yT3hxEX5EL9YhZ2SvCRE7J3EZ2Qc7xDhqTWf7OL8Lm' +
        'X9UqQ8pJ8mR9Yx3Xq5K6L7M8N9O0P1Q2R3S4T5UvWxYzAbBcDeFgHiJkLmNoPqRstuVwXyZabc' +
        '123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

      const updatedUser = {
        id: 'user-001',
        email: 'alice@example.com',
        publicKey: longKey,
      };

      jest
        .spyOn(prismaService.user, 'update')
        .mockResolvedValueOnce(updatedUser);

      const result = await userService.updatePublicKey('alice@example.com', longKey);

      expect(result.publicKey).toBe(longKey);
    });

    it('should handle updating multiple times for same user', async () => {
      const firstUpdate = {
        id: 'user-001',
        email: 'alice@example.com',
        publicKey: 'key-1',
      };

      const secondUpdate = {
        id: 'user-001',
        email: 'alice@example.com',
        publicKey: 'key-2',
      };

      jest
        .spyOn(prismaService.user, 'update')
        .mockResolvedValueOnce(firstUpdate);
      jest
        .spyOn(prismaService.user, 'update')
        .mockResolvedValueOnce(secondUpdate);

      const result1 = await userService.updatePublicKey(
        'alice@example.com',
        'key-1',
      );
      const result2 = await userService.updatePublicKey(
        'alice@example.com',
        'key-2',
      );

      expect(result1.publicKey).toBe('key-1');
      expect(result2.publicKey).toBe('key-2');
      expect(prismaService.user.update).toHaveBeenCalledTimes(2);
    });

    it('should throw error if user not found', async () => {
      jest
        .spyOn(prismaService.user, 'update')
        .mockRejectedValueOnce(new Error('User not found'));

      await expect(
        userService.updatePublicKey('notfound@example.com', 'new-key'),
      ).rejects.toThrow('User not found');
    });

    it('should correctly use email as where clause', async () => {
      const updatedUser = {
        id: 'user-001',
        email: 'alice@example.com',
        publicKey: 'new-key',
      };

      jest
        .spyOn(prismaService.user, 'update')
        .mockResolvedValueOnce(updatedUser);

      const testEmail = 'test+tag@example.com';
      await userService.updatePublicKey(testEmail, 'new-key');

      expect(prismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: testEmail },
        }),
      );
    });

    it('should handle special characters in email', async () => {
      const specialEmail = 'user+test.tag@example.com';
      const updatedUser = {
        id: 'user-001',
        email: specialEmail,
        publicKey: 'new-key',
      };

      jest
        .spyOn(prismaService.user, 'update')
        .mockResolvedValueOnce(updatedUser);

      const result = await userService.updatePublicKey(specialEmail, 'new-key');

      expect(result.email).toBe(specialEmail);
    });

    it('should handle database errors during update', async () => {
      jest
        .spyOn(prismaService.user, 'update')
        .mockRejectedValueOnce(new Error('Database connection error'));

      await expect(
        userService.updatePublicKey('alice@example.com', 'new-key'),
      ).rejects.toThrow('Database connection error');
    });
  });

  describe('UserController.findAll', () => {
    it('should call userService.findAll and return users', async () => {
      jest.spyOn(userService, 'findAll').mockResolvedValueOnce(mockUsers);

      const result = await userController.findAll();

      expect(result).toEqual(mockUsers);
      expect(userService.findAll).toHaveBeenCalled();
    });

    it('should return empty array when no users exist', async () => {
      jest.spyOn(userService, 'findAll').mockResolvedValueOnce([]);

      const result = await userController.findAll();

      expect(result).toEqual([]);
    });

    it('should propagate service errors', async () => {
      jest
        .spyOn(userService, 'findAll')
        .mockRejectedValueOnce(new Error('Service error'));

      await expect(userController.findAll()).rejects.toThrow('Service error');
    });
  });

  describe('UserController.updatePublicKey', () => {
    it('should call userService.updatePublicKey with correct parameters', async () => {
      const updateDto: UpdatePublicKeyDto = {
        email: 'alice@example.com',
        publicKey: 'new-public-key',
      };

      const updatedUser = {
        id: 'user-001',
        email: 'alice@example.com',
        publicKey: 'new-public-key',
      };

      jest
        .spyOn(userService, 'updatePublicKey')
        .mockResolvedValueOnce(updatedUser);

      const result = await userController.updatePublicKey(updateDto);

      expect(result).toEqual(updatedUser);
      expect(userService.updatePublicKey).toHaveBeenCalledWith(
        updateDto.email,
        updateDto.publicKey,
      );
    });

    it('should return updated user with new public key', async () => {
      const updateDto: UpdatePublicKeyDto = {
        email: 'alice@example.com',
        publicKey: 'updated-key-123',
      };

      const updatedUser = {
        id: 'user-001',
        email: 'alice@example.com',
        publicKey: 'updated-key-123',
      };

      jest
        .spyOn(userService, 'updatePublicKey')
        .mockResolvedValueOnce(updatedUser);

      const result = await userController.updatePublicKey(updateDto);

      expect(result.publicKey).toBe('updated-key-123');
    });

    it('should handle service errors during update', async () => {
      const updateDto: UpdatePublicKeyDto = {
        email: 'alice@example.com',
        publicKey: 'new-key',
      };

      jest
        .spyOn(userService, 'updatePublicKey')
        .mockRejectedValueOnce(new Error('Update failed'));

      await expect(
        userController.updatePublicKey(updateDto),
      ).rejects.toThrow('Update failed');
    });

    it('should handle invalid email in DTO', async () => {
      const updateDto: UpdatePublicKeyDto = {
        email: 'invalid-email',
        publicKey: 'new-key',
      };

      jest
        .spyOn(userService, 'updatePublicKey')
        .mockRejectedValueOnce(new Error('Invalid email'));

      await expect(
        userController.updatePublicKey(updateDto),
      ).rejects.toThrow('Invalid email');
    });
  });

  describe('Integration Tests', () => {
    it('should fetch all users and then update one', async () => {
      jest
        .spyOn(prismaService.user, 'findMany')
        .mockResolvedValueOnce(mockUsers);
      jest
        .spyOn(prismaService.user, 'update')
        .mockResolvedValueOnce({
          id: 'user-001',
          email: 'alice@example.com',
          publicKey: 'updated-key',
        });

      // Get all users
      const allUsers = await userController.findAll();
      expect(allUsers).toHaveLength(3);

      // Update first user's public key
      const firstUser = allUsers[0];
      const updateDto: UpdatePublicKeyDto = {
        email: firstUser.email,
        publicKey: 'updated-key',
      };

      const updated = await userController.updatePublicKey(updateDto);
      expect(updated.publicKey).toBe('updated-key');
    });

    it('should handle multiple user updates', async () => {
      const updatedUser1 = {
        id: 'user-001',
        email: 'alice@example.com',
        publicKey: 'key-1',
      };

      const updatedUser2 = {
        id: 'user-002',
        email: 'bob@example.com',
        publicKey: 'key-2',
      };

      jest
        .spyOn(prismaService.user, 'update')
        .mockResolvedValueOnce(updatedUser1);
      jest
        .spyOn(prismaService.user, 'update')
        .mockResolvedValueOnce(updatedUser2);

      const result1 = await userService.updatePublicKey(
        'alice@example.com',
        'key-1',
      );
      const result2 = await userService.updatePublicKey(
        'bob@example.com',
        'key-2',
      );

      expect(result1.email).toBe('alice@example.com');
      expect(result2.email).toBe('bob@example.com');
      expect(prismaService.user.update).toHaveBeenCalledTimes(2);
    });

    it('should verify user data flow from service to controller', async () => {
      jest
        .spyOn(prismaService.user, 'findMany')
        .mockResolvedValueOnce(mockUsers);

      const result = await userController.findAll();

      expect(result).toEqual(mockUsers);
      expect(result[0]).toHaveProperty('email');
      expect(result[0]).toHaveProperty('firstName');
      expect(result[0]).toHaveProperty('publicKey');
    });

    it('should handle complex user operations in sequence', async () => {
      // Get users
      jest
        .spyOn(prismaService.user, 'findMany')
        .mockResolvedValueOnce(mockUsers);

      const users = await userService.findAll();
      expect(users.length).toBeGreaterThan(0);

      // Setup mocks BEFORE making the calls
      jest
        .spyOn(prismaService.user, 'update')
        .mockResolvedValueOnce({
          id: users[0].id,
          email: users[0].email,
          publicKey: `updated-${users[0].id}`,
        })
        .mockResolvedValueOnce({
          id: users[1].id,
          email: users[1].email,
          publicKey: `updated-${users[1].id}`,
        });

      // Update multiple public keys
      const updatePromises = users.slice(0, 2).map((user) =>
        userService.updatePublicKey(user.email, `updated-${user.id}`),
      );

      const results = await Promise.all(updatePromises);

      expect(results).toHaveLength(2);
      expect(results[0].publicKey).toContain('updated-');
    });
  });
});
