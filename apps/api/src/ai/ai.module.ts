import { Module } from '@nestjs/common';
import { AiUsageService } from './ai-usage.service.js';
import { GeminiService } from './gemini.service.js';

@Module({
  providers: [GeminiService, AiUsageService],
  exports: [GeminiService, AiUsageService],
})
export class AiModule {}
