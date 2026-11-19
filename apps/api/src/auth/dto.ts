import { Equals, IsBoolean, IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export const MIN_PASSWORD_LENGTH = 8;

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  @MaxLength(128)
  password!: string;
}

export class RegisterDto extends LoginDto {
  /** Acordul pentru prelucrarea datelor despre sanatate este obligatoriu la creare. */
  @IsBoolean()
  @Equals(true)
  healthDataConsent!: boolean;
}
