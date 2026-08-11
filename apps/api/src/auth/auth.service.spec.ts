import { JwtService } from '@nestjs/jwt';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { AuthService } from './auth.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuditContextService } from '../audit/audit-context.service';
import type { EmailVerificationService } from './email-verification.service';
import type { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcrypt';

const mockVerifyIdToken = jest.fn();

jest.mock('google-auth-library', () => {
  return {
    OAuth2Client: jest.fn().mockImplementation(() => {
      return {
        verifyIdToken: mockVerifyIdToken,
      };
    }),
  };
});

describe('AuthService', () => {
  let prisma: PrismaService;
  let jwt: JwtService;
  let auditContext: AuditContextService;
  let emailVerificationService: EmailVerificationService;
  let mailService: MailService;
  let service: AuthService;

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-test-refresh-secret';
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';

    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
      },
      organizationApplication: {
        findFirst: jest.fn(),
      },
    } as unknown as PrismaService;

    jwt = {
      signAsync: jest.fn().mockResolvedValue('jwt-token'),
      verifyAsync: jest.fn(),
    } as unknown as JwtService;

    auditContext = {
      get: jest.fn(),
    } as unknown as AuditContextService;

    emailVerificationService = {} as unknown as EmailVerificationService;
    mailService = {} as unknown as MailService;

    service = new AuthService(prisma, jwt, auditContext, emailVerificationService, mailService);
    mockVerifyIdToken.mockReset();
  });

  describe('Local Login', () => {
    it('succeeds with correct password', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 12);
      const mockUser = {
        id: 'user-uuid',
        email: 'test@example.com',
        passwordHash,
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        sessionVersion: 0,
        emailVerified: true,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.organizationApplication.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.login({ email: 'test@example.com', password: 'correct-password' });
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('test@example.com');
    });

    it('fails when user has no passwordHash (Google-only user)', async () => {
      const mockUser = {
        id: 'user-uuid',
        email: 'test@example.com',
        passwordHash: null,
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        sessionVersion: 0,
        emailVerified: true,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(service.login({ email: 'test@example.com', password: 'some-password' })).rejects.toThrow(
        new UnauthorizedException('E-posta veya parola geçersiz.'),
      );
    });
  });

  describe('Google Login', () => {
    it('verifies token and returns session tokens for existing Google user', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-sub-id',
          email: 'test@example.com',
          email_verified: true,
          given_name: 'John',
          family_name: 'Doe',
        }),
      });

      const mockUser = {
        id: 'user-uuid',
        email: 'test@example.com',
        passwordHash: null,
        googleId: 'google-sub-id',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        sessionVersion: 0,
        emailVerified: true,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.organizationApplication.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.loginWithGoogle({ token: 'valid-google-token' });

      expect(mockVerifyIdToken).toHaveBeenCalledWith({
        idToken: 'valid-google-token',
        audience: 'test-google-client-id',
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { googleId: 'google-sub-id' },
        include: expect.any(Object),
      });
      expect(result).toHaveProperty('accessToken');
      expect(result.user.email).toBe('test@example.com');
    });

    it('links Google identity when user exists by email but has no googleId', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-sub-id',
          email: 'test@example.com',
          email_verified: true,
          given_name: 'John',
          family_name: 'Doe',
        }),
      });

      const mockUser = {
        id: 'user-uuid',
        email: 'test@example.com',
        passwordHash: 'some-hash',
        googleId: null,
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        sessionVersion: 0,
        emailVerified: false,
      };

      const updatedUser = { ...mockUser, googleId: 'google-sub-id', emailVerified: true };

      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // first find by googleId
        .mockResolvedValueOnce(mockUser); // second find by email

      (prisma.user.update as jest.Mock).mockResolvedValue(updatedUser);
      (prisma.organizationApplication.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.loginWithGoogle({ token: 'valid-google-token' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid' },
        data: {
          googleId: 'google-sub-id',
          emailVerified: true,
        },
        include: expect.any(Object),
      });
      expect(result.user.email).toBe('test@example.com');
    });

    it('creates new user when no account matches googleId or email', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'new-google-sub-id',
          email: 'new@example.com',
          email_verified: true,
          given_name: 'New',
          family_name: 'User',
        }),
      });

      const createdUser = {
        id: 'new-user-uuid',
        email: 'new@example.com',
        passwordHash: null,
        googleId: 'new-google-sub-id',
        firstName: 'New',
        lastName: 'User',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        sessionVersion: 0,
        emailVerified: true,
      };

      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // googleId lookup
        .mockResolvedValueOnce(null); // email lookup

      (prisma.user.create as jest.Mock).mockResolvedValue(createdUser);
      (prisma.organizationApplication.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.loginWithGoogle({ token: 'valid-google-token' });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'new@example.com',
          firstName: 'New',
          lastName: 'User',
          googleId: 'new-google-sub-id',
          emailVerified: true,
          status: UserStatus.ACTIVE,
          role: UserRole.USER,
        },
        include: expect.any(Object),
      });
      expect(result.user.email).toBe('new@example.com');
    });

    it('fails when token verification throws', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid signature'));

      await expect(service.loginWithGoogle({ token: 'invalid-token' })).rejects.toThrow(
        new UnauthorizedException('Google kimlik doğrulaması başarısız oldu.'),
      );
    });

    it('fails when email is not verified on Google side', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-sub-id',
          email: 'unverified@example.com',
          email_verified: false,
        }),
      });

      await expect(service.loginWithGoogle({ token: 'unverified-token' })).rejects.toThrow(
        new UnauthorizedException('Google hesabındaki e-posta doğrulanmamış.'),
      );
    });

    it('fails when user status is SUSPENDED', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-sub-id',
          email: 'suspended@example.com',
          email_verified: true,
        }),
      });

      const mockUser = {
        id: 'user-uuid',
        email: 'suspended@example.com',
        passwordHash: null,
        googleId: 'google-sub-id',
        firstName: 'Suspended',
        lastName: 'User',
        role: UserRole.USER,
        status: UserStatus.SUSPENDED,
        sessionVersion: 0,
        emailVerified: true,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(service.loginWithGoogle({ token: 'valid-token' })).rejects.toThrow(
        new ForbiddenException('Bu hesap askıya alınmış.'),
      );
    });

    it('fails when user status is DELETED', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-sub-id',
          email: 'deleted@example.com',
          email_verified: true,
        }),
      });

      const mockUser = {
        id: 'user-uuid',
        email: 'deleted@example.com',
        passwordHash: null,
        googleId: 'google-sub-id',
        firstName: 'Deleted',
        lastName: 'User',
        role: UserRole.USER,
        status: UserStatus.DELETED,
        sessionVersion: 0,
        emailVerified: true,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(service.loginWithGoogle({ token: 'valid-token' })).rejects.toThrow(
        new ForbiddenException('Bu hesap silinmiş.'),
      );
    });
  });
});
