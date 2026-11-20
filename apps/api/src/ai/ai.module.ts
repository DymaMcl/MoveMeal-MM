import { Module } from '@nestjs/common';
import { AiUsageService } from './ai-usage.service.js';
import { GeminiService } from './gemini.service.js';
import { ModerationService } from './moderation.service.js';

@Module({
  providers: [GeminiService, AiUsageService, ModerationService],
  exports: [GeminiService, AiUsageService, ModerationService],
})
export class AiModule {}
