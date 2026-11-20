import {
  Body,
  Controller,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { AuthGuard, UserId } from '../auth/auth.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import {
  AnalyzePhotoDto,
  AnalyzeTextDto,
  EditPhotoItemDto,
  LogPhotoDto,
} from './food-photo.dto.js';
import { FoodPhotoService } from './food-photo.service.js';

@Controller('me/food-photo')
@UseGuards(AuthGuard)
export class FoodPhotoController {
  constructor(private readonly photos: FoodPhotoService) {}

  /** Recunoasterea alimentelor si estimarea gramajului; imaginea nu se salveaza. */
  @Post()
  @HttpCode(200)
  analyze(@UserId() userId: string, @Body() body: AnalyzePhotoDto) {
    return this.photos.analyze(userId, body.image, body.mimeType, body.language, body.hint);
  }

  /** Masa descrisa in cuvinte; rezultatul se verifica la fel ca cel al unei fotografii. */
  @Post('text')
  @HttpCode(200)
  analyzeText(@UserId() userId: string, @Body() body: AnalyzeTextDto) {
    return this.photos.analyzeText(userId, body.text, body.language);
  }

  /** Corecteaza sau adauga un aliment inainte de salvarea in jurnal. */
  @Post(':id/items')
  @HttpCode(200)
  editItem(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: EditPhotoItemDto,
  ) {
    return this.photos.editItem(userId, id, body);
  }

  @Post(':id/log')
  log(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: LogPhotoDto) {
    return this.photos.log(userId, id, body);
  }
}

@Module({
  imports: [AuthModule, AiModule],
  controllers: [FoodPhotoController],
  providers: [FoodPhotoService],
})
export class FoodPhotoModule {}
