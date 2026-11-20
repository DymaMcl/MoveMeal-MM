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
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { AuthGuard, UserId } from '../auth/auth.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { ProductsService } from './products.service.js';
import {
  BARCODE,
  CopyLogDto,
  LabelDto,
  LogProductDto,
  LogSavedMealDto,
  ProductDto,
  QuickAddDto,
  RenameMealDto,
  SaveMealDto,
} from './quick-log.dto.js';
import { QuickLogService } from './quick-log.service.js';

/** Produsele ambalate: cautarea dupa codul de bare si produsele proprii. */
@Controller()
@UseGuards(AuthGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get('products/barcode/:code')
  byBarcode(@UserId() userId: string, @Param('code') code: string) {
    if (!BARCODE.test(code)) throw new BadRequestException('Cod de bare invalid.');
    return this.products.byBarcode(userId, code);
  }

  @Get('me/products')
  lists(@UserId() userId: string) {
    return this.products.lists(userId);
  }

  @Post('me/products')
  create(@UserId() userId: string, @Body() body: ProductDto) {
    return this.products.create(userId, body);
  }

  /** Citeste valorile de pe eticheta (nu salveaza nimic). */
  @Post('me/products/label')
  @HttpCode(200)
  label(@UserId() userId: string, @Body() body: LabelDto) {
    return this.products.readLabel(userId, body.image, body.mimeType, body.language);
  }

  @Put('me/products/:id')
  update(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ProductDto,
  ) {
    return this.products.update(userId, id, body);
  }

  @Delete('me/products/:id')
  @HttpCode(204)
  async remove(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.products.remove(userId, id);
  }
}

/** Adaugarea rapida in jurnal: produse, calorii directe, copierea si mesele salvate. */
@Controller('me')
@UseGuards(AuthGuard)
export class QuickLogController {
  constructor(private readonly quick: QuickLogService) {}

  @Post('food-log/product')
  logProduct(@UserId() userId: string, @Body() body: LogProductDto) {
    return this.quick.logProduct(userId, body);
  }

  @Post('food-log/quick')
  quickAdd(@UserId() userId: string, @Body() body: QuickAddDto) {
    return this.quick.quickAdd(userId, body);
  }

  @Post('food-log/copy')
  copy(@UserId() userId: string, @Body() body: CopyLogDto) {
    return this.quick.copy(userId, body);
  }

  @Get('saved-meals')
  savedMeals(@UserId() userId: string) {
    return this.quick.savedMeals(userId);
  }

  @Post('saved-meals')
  saveMeal(@UserId() userId: string, @Body() body: SaveMealDto) {
    return this.quick.saveMeal(userId, body);
  }

  @Patch('saved-meals/:id')
  @HttpCode(204)
  async rename(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RenameMealDto,
  ): Promise<void> {
    await this.quick.renameMeal(userId, id, body.name);
  }

  @Delete('saved-meals/:id')
  @HttpCode(204)
  async deleteMeal(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.quick.deleteMeal(userId, id);
  }

  @Post('saved-meals/:id/log')
  logMeal(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: LogSavedMealDto,
  ) {
    return this.quick.logSavedMeal(userId, id, body.day, body.meal);
  }
}

@Module({
  imports: [AuthModule, AiModule],
  controllers: [ProductsController, QuickLogController],
  providers: [ProductsService, QuickLogService],
})
export class QuickLogModule {}
