import { IsEmail, IsString, MinLength } from 'class-validator';

export class ForgotPasswordRequestDto {
  @IsEmail()
  email!: string;
}

export class ForgotPasswordResetDto {
  @IsEmail()
  email!: string;
  @IsString()
  code!: string;
  @IsString()
  @MinLength(8)
  newPassword!: string;
  @IsString()
  @MinLength(8)
  confirmPassword!: string;
}
