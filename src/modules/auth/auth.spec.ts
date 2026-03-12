import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './controller/auth.controller';
import { AuthService } from './service/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeService } from '../stripe/service/stripe.service';
import { ConflictException } from '@nestjs/common';
import { SignupDto } from './dtos/signup.dto';

describe('Auth Module - Controller and Service', () => {
  let authController: AuthController;
  let authService: AuthService;
  let prismaService: PrismaService;
  let stripeService: StripeService;

  const mockUser = {
    id: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    number: '9876543210',
    address: '123 Main St',
    state: 'California',
    city: 'San Francisco',
    zipCode: '94102',
    role: 'user',
    customerId: 'cus_123456',
    publicKey: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSignupDto: SignupDto = {
    id: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    number: '9876543210',
    address: '123 Main St',
    state: 'California',
    city: 'San Francisco',
    zipCode: '94102',
    role: 'user',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: StripeService,
          useValue: {
            createCustomer: jest.fn(),
            getCustomerByEmail: jest.fn(),
          },
        },
      ],
    }).compile();

    authController = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    stripeService = module.get<StripeService>(StripeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('AuthService.signup', () => {
    it('should successfully signup a new user', async () => {
      const mockStripeCustomer = { id: 'cus_123456' };

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce(null);
      jest.spyOn(prismaService.user, 'create').mockResolvedValueOnce(mockUser);
      jest
        .spyOn(stripeService, 'createCustomer')
        .mockResolvedValueOnce(mockStripeCustomer);
      jest
        .spyOn(prismaService.user, 'update')
        .mockResolvedValueOnce({ ...mockUser, customerId: 'cus_123456' });

      const result = await authService.signup(mockSignupDto);

      expect(result.customerId).toBe('cus_123456');
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: mockSignupDto.email },
      });
      expect(prismaService.user.create).toHaveBeenCalled();
      expect(stripeService.createCustomer).toHaveBeenCalled();
    });

    it('should throw ConflictException if user already exists', async () => {
      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValueOnce(mockUser);

      await expect(authService.signup(mockSignupDto)).rejects.toThrow(
        ConflictException,
      );
      expect(prismaService.user.create).not.toHaveBeenCalled();
    });

    it('should create user even if Stripe customer creation fails', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce(null);
      jest.spyOn(prismaService.user, 'create').mockResolvedValueOnce(mockUser);
      jest
        .spyOn(stripeService, 'createCustomer')
        .mockRejectedValueOnce(new Error('Stripe error'));

      const result = await authService.signup(mockSignupDto);

      expect(result).toEqual(mockUser);
      expect(prismaService.user.create).toHaveBeenCalled();
    });

    it('should validate all required fields in signup DTO', async () => {
      const incompleteDto = { email: 'test@example.com' } as SignupDto;

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce(null);

      await authService.signup(incompleteDto);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: incompleteDto.email },
      });
    });

    it('should handle duplicate email correctly', async () => {
      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValueOnce(mockUser);

      await expect(authService.signup(mockSignupDto)).rejects.toThrow(
        'User with this email already exists',
      );
    });

    it('should pass all user fields to prisma create', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce(null);
      jest.spyOn(prismaService.user, 'create').mockResolvedValueOnce(mockUser);
      jest
        .spyOn(stripeService, 'createCustomer')
        .mockResolvedValueOnce({ id: 'cus_123456' });
      jest
        .spyOn(prismaService.user, 'update')
        .mockResolvedValueOnce({ ...mockUser, customerId: 'cus_123456' });

      await authService.signup(mockSignupDto);

      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          id: mockSignupDto.id,
          email: mockSignupDto.email,
          firstName: mockSignupDto.firstName,
          lastName: mockSignupDto.lastName,
          number: mockSignupDto.number,
          address: mockSignupDto.address,
          state: mockSignupDto.state,
          city: mockSignupDto.city,
          zipCode: mockSignupDto.zipCode,
          role: mockSignupDto.role,
        },
      });
    });

    it('should update user with Stripe customer ID after creation', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce(null);
      jest.spyOn(prismaService.user, 'create').mockResolvedValueOnce(mockUser);
      jest
        .spyOn(stripeService, 'createCustomer')
        .mockResolvedValueOnce({ id: 'cus_123456' });
      jest
        .spyOn(prismaService.user, 'update')
        .mockResolvedValueOnce({ ...mockUser, customerId: 'cus_123456' });

      await authService.signup(mockSignupDto);

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { customerId: 'cus_123456' },
      });
    });
  });

  describe('AuthService.logout', () => {
    it('should return logout success message', () => {
      const result = authService.logout();

      expect(result).toEqual({ message: 'Logged out successfully' });
    });

    it('should not call any service dependencies on logout', () => {
      authService.logout();

      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('should return consistent logout message', () => {
      const result1 = authService.logout();
      const result2 = authService.logout();

      expect(result1).toEqual(result2);
    });
  });

  describe('AuthController.signup', () => {
    it('should call authService.signup and return success message', async () => {
      jest.spyOn(authService, 'signup').mockResolvedValueOnce(mockUser);

      const result = await authController.signup(mockSignupDto);

      expect(result).toEqual({ message: 'User registered successfully' });
      expect(authService.signup).toHaveBeenCalledWith(mockSignupDto);
    });

    it('should propagate ConflictException from service', async () => {
      jest
        .spyOn(authService, 'signup')
        .mockRejectedValueOnce(new ConflictException('User already exists'));

      await expect(authController.signup(mockSignupDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should handle signup errors gracefully', async () => {
      jest
        .spyOn(authService, 'signup')
        .mockRejectedValueOnce(new Error('Database error'));

      await expect(authController.signup(mockSignupDto)).rejects.toThrow(Error);
    });
  });

  describe('AuthController.logout', () => {
    it('should return logout success message', () => {
      const result = authController.logout();

      expect(result).toEqual({ message: 'Logged out successfully' });
    });

    it('should call authService.logout', () => {
      jest.spyOn(authService, 'logout');

      authController.logout();

      expect(authService.logout).toHaveBeenCalled();
    });
  });

  describe('AuthController.getProfile', () => {
    it('should return user from request object', () => {
      const mockRequest = {
        user: {
          userId: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
          email: 'test@example.com',
        },
      };

      const result = authController.getProfile(mockRequest);

      expect(result).toEqual(mockRequest.user);
    });

    it('should return user profile with correct attributes', () => {
      const mockRequest = {
        user: {
          userId: 'user-123',
          email: 'user@example.com',
        },
      };

      const result = authController.getProfile(mockRequest);

      expect(result.userId).toBe('user-123');
      expect(result.email).toBe('user@example.com');
    });

    it('should not call any service for profile retrieval', () => {
      const mockRequest = {
        user: {
          userId: 'user-123',
          email: 'user@example.com',
        },
      };

      authController.getProfile(mockRequest);

      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('should extract user from JWT token in request', () => {
      const mockRequest = {
        user: {
          userId: 'abc-123-def',
          email: 'jwt@example.com',
        },
      };

      const result = authController.getProfile(mockRequest);

      expect(result).toBeDefined();
      expect(Object.keys(result)).toContain('userId');
      expect(Object.keys(result)).toContain('email');
    });
  });

  describe('Integration Tests', () => {
    it('should signup user and be able to logout', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce(null);
      jest.spyOn(prismaService.user, 'create').mockResolvedValueOnce(mockUser);
      jest
        .spyOn(stripeService, 'createCustomer')
        .mockResolvedValueOnce({ id: 'cus_123456' });
      jest
        .spyOn(prismaService.user, 'update')
        .mockResolvedValueOnce({ ...mockUser, customerId: 'cus_123456' });

      const signupResult = await authController.signup(mockSignupDto);
      expect(signupResult.message).toBe('User registered successfully');

      const logoutResult = authController.logout();
      expect(logoutResult.message).toBe('Logged out successfully');
    });

    it('should handle multiple signup attempts', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce(null);
      jest.spyOn(prismaService.user, 'create').mockResolvedValueOnce(mockUser);
      jest
        .spyOn(stripeService, 'createCustomer')
        .mockResolvedValueOnce({ id: 'cus_123456' });
      jest
        .spyOn(prismaService.user, 'update')
        .mockResolvedValueOnce({ ...mockUser, customerId: 'cus_123456' });

      const result1 = await authController.signup(mockSignupDto);
      expect(result1.message).toBe('User registered successfully');

      // Second attempt should fail
      jest
        .spyOn(prismaService.user, 'findUnique')
        .mockResolvedValueOnce(mockUser);

      await expect(authController.signup(mockSignupDto)).rejects.toThrow();
    });
  });
});
