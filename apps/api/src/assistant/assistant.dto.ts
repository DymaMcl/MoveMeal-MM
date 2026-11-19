import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const LANGUAGES = ['ro', 'en', 'ru'] as const;

export class ChatMessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text!: string;
}

/** Conversatia nu se salveaza pe server; aplicatia trimite ultimele mesaje la fiecare intrebare. */
export class ChatDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];

  @IsIn(LANGUAGES)
  language!: (typeof LANGUAGES)[number];
}
