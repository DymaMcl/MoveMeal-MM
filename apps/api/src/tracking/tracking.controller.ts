import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, UserId } from '../auth/auth.guard.js';
import { MeasurementDto, WaterDto } from './tracking.dto.js';
import { TrackingService } from './tracking.service.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

@Controller('me')
@UseGuards(AuthGuard)
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Put('measurements')
  @HttpCode(204)
  async saveMeasurement(@UserId() userId: string, @Body() body: MeasurementDto): Promise<void> {
    await this.tracking.saveMeasurement(userId, body.day, body.weightKg, body.waistCm);
  }

  /** Masuratorile pentru 4, 8 sau 12 saptamani, cu media mobila pe 7 zile. */
  @Get('measurements')
  measurements(@UserId() userId: string, @Query('weeks') weeks = '4') {
    const w = Number(weeks);
    if (![4, 8, 12].includes(w))
      throw new BadRequestException('Perioada poate fi 4, 8 sau 12 saptamani.');
    return this.tracking.measurements(userId, w);
  }

  @Put('water')
  @HttpCode(204)
  async setWater(@UserId() userId: string, @Body() body: WaterDto): Promise<void> {
    await this.tracking.setWater(userId, body.day, body.ml);
  }

  @Get('water')
  water(@UserId() userId: string, @Query('day') day: string) {
    if (!DAY.test(day ?? '')) throw new BadRequestException('Data invalida.');
    return this.tracking.water(userId, day);
  }

  @Get('progress')
  progress(@UserId() userId: string) {
    return this.tracking.progress(userId);
  }

  @Post('progress/adjustment/accept')
  @HttpCode(200)
  accept(@UserId() userId: string) {
    return this.tracking.accept(userId);
  }

  @Post('progress/adjustment/reject')
  @HttpCode(204)
  async reject(@UserId() userId: string): Promise<void> {
    await this.tracking.reject(userId);
  }
}
