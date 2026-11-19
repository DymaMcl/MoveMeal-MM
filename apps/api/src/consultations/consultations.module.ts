import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AuthGuard, UserId } from '../auth/auth.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ConsultationsService } from './consultations.service.js';

export class BookDto {
  @IsUUID()
  nutritionistId!: string;

  @IsISO8601()
  startsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  /** Acordul ca nutritionistul sa vada planul si progresul (poate fi retras oricand). */
  @IsOptional()
  @IsBoolean()
  shareData?: boolean;
}

export class AccessDto {
  @IsBoolean()
  granted!: boolean;
}

@Controller()
@UseGuards(AuthGuard)
export class ConsultationsController {
  constructor(private readonly consultations: ConsultationsService) {}

  @Get('nutritionists')
  nutritionists() {
    return this.consultations.nutritionists();
  }

  @Get('nutritionists/:id')
  nutritionist(@Param('id', ParseUUIDPipe) id: string) {
    return this.consultations.nutritionist(id);
  }

  @Get('nutritionists/:id/slots')
  slots(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.consultations.slots(userId, id);
  }

  @Get('me/consultation-offer')
  offer(@UserId() userId: string) {
    return this.consultations.offer(userId);
  }

  @Get('me/appointments')
  mine(@UserId() userId: string) {
    return this.consultations.mine(userId);
  }

  @Post('me/appointments')
  book(@UserId() userId: string, @Body() body: BookDto) {
    return this.consultations.book(userId, body);
  }

  @Post('me/appointments/:id/cancel')
  cancel(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.consultations.cancel(userId, id);
  }

  @Get('me/nutritionist-access')
  access(@UserId() userId: string) {
    return this.consultations.access(userId);
  }

  @Put('me/nutritionist-access/:id')
  setAccess(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AccessDto,
  ) {
    return this.consultations.setAccess(userId, id, body.granted);
  }
}

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [ConsultationsController],
  providers: [ConsultationsService],
  exports: [ConsultationsService],
})
export class ConsultationsModule {}
