import { Controller, Get, HttpCode, Module, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, UserId } from '../auth/auth.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsService } from './notifications.service.js';

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
  async read(@UserId() userId: string): Promise<void> {
    await this.notifications.markAllRead(userId);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
