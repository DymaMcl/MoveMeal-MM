import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { ContentLanguage } from '@movemeal/shared';
import { LANGUAGES } from '../assistant/assistant.dto.js';
import { AuthGuard, Roles, UserId } from '../auth/auth.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { FollowDto, NewsDto, StepsDto } from './engagement.dto.js';
import { EngagementService } from './engagement.service.js';
import { TrophiesService } from './trophies.service.js';

function language(value?: string): ContentLanguage {
  if (value && !(LANGUAGES as readonly string[]).includes(value)) {
    throw new BadRequestException('Limba nu este acceptata.');
  }
  return (value as ContentLanguage) ?? 'ro';
}

/** Abonari, pasi, trofee si noutatile aplicatiei. */
@Controller()
@UseGuards(AuthGuard)
export class EngagementController {
  constructor(
    private readonly engagement: EngagementService,
    private readonly trophies: TrophiesService,
  ) {}

  @Put('users/:id/follow')
  follow(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: FollowDto,
  ) {
    return this.engagement.follow(userId, id, body.value);
  }

  @Get('users/:id/followers')
  followers(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.engagement.followList(userId, id, 'followers');
  }

  @Get('users/:id/following')
  following(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.engagement.followList(userId, id, 'following');
  }

  @Get('users/:id/trophies')
  userTrophies(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.trophies.list(userId, id);
  }

  @Get('me/trophies')
  myTrophies(@UserId() userId: string) {
    return this.trophies.list(userId, userId);
  }

  @Get('me/steps')
  steps(@UserId() userId: string, @Query('days') days?: string) {
    const n = days ? Number(days) : 7;
    if (!Number.isInteger(n) || n < 1 || n > 60) throw new BadRequestException('Interval invalid.');
    return this.engagement.steps(userId, n);
  }

  @Put('me/steps')
  setSteps(@UserId() userId: string, @Body() body: StepsDto) {
    return this.engagement.setSteps(userId, body.day, body.steps, body.source);
  }

  @Get('news')
  news(@UserId() userId: string, @Query('language') lang?: string) {
    return this.engagement.news(userId, language(lang));
  }
}

/** Administratorul publica noutatile din „Ce e nou?”. */
@Controller('admin/news')
@UseGuards(AuthGuard)
@Roles('admin')
export class AdminNewsController {
  constructor(private readonly engagement: EngagementService) {}

  @Post()
  create(@UserId() userId: string, @Body() body: NewsDto) {
    return this.engagement.createNews(userId, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.engagement.deleteNews(userId, id);
  }
}

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [EngagementController, AdminNewsController],
  providers: [EngagementService, TrophiesService],
  exports: [EngagementService, TrophiesService],
})
export class EngagementModule {}
