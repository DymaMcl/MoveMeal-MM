import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Module,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { AuthGuard, UserId } from '../auth/auth.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { ProfileModule } from '../profile/profile.module.js';
import { ChatDto } from './assistant.dto.js';
import { AssistantService } from './assistant.service.js';

@Controller('me')
@UseGuards(AuthGuard)
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  /** Daca serviciul AI este configurat si cate cereri mai are utilizatorul azi. */
  @Get('ai')
  status(@UserId() userId: string) {
    return this.assistant.status(userId);
  }

  @Post('assistant/chat')
  @HttpCode(200)
  chat(@UserId() userId: string, @Body() body: ChatDto) {
    if (body.messages[body.messages.length - 1].role !== 'user') {
      throw new BadRequestException('Ultimul mesaj trebuie sa fie intrebarea utilizatorului.');
    }
    return this.assistant.chat(userId, body.messages, body.language);
  }
}

@Module({
  imports: [AuthModule, AiModule, ProfileModule],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}
