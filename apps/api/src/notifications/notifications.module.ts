import { Body, Controller, Get, HttpCode, Module, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';
import { AuthGuard, UserId } from '../auth/auth.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import {
  NotificationsService,
  SECTIONS,
  type NotificationSection,
} from './notifications.service.js';

export class ReadNotificationsDto {
  /** Lipsa = toate sectiunile. */
  @IsOptional()
  @IsIn(SECTIONS)
  section?: NotificationSection;
}

@Controller('me/notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@UserId() userId: string) {
    return this.notifications.list(userId);
  }

  @Post('read')
  @HttpCode(204)
  async read(@UserId() userId: string, @Body() body: ReadNotificationsDto): Promise<void> {
    await this.notifications.markRead(userId, body?.section);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
