import {
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
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AiModule } from '../ai/ai.module.js';
import { AuthGuard, Roles, UserId, UserRole } from '../auth/auth.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { EngagementModule } from '../engagement/engagement.module.js';
import type { Role } from '../auth/auth.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { BlogService } from './blog.service.js';
import { CommunityService } from './community.service.js';
import { MediaService } from './media.service.js';
import {
  BlogPostDto,
  BlogQueryDto,
  CreatePostDto,
  FeedQueryDto,
  ImageDto,
  ReportDto,
  SocialProfileDto,
  ToggleDto,
  UpdatePostDto,
  TipDto,
} from './social.dto.js';

/** Fotografiile; accesul este verificat la fiecare cerere (politica RLS sau rolul de administrator). */
@Controller('media')
@UseGuards(AuthGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get(':id')
  async read(
    @UserId() userId: string,
    @UserRole() role: Role,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const image = await this.media.read(userId, role, id);
    // Fisierul nu se schimba niciodata (o imagine noua primeste alt id).
    res.setHeader('Content-Type', image.mime);
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(image.data);
  }
}

@Controller()
@UseGuards(AuthGuard)
export class CommunityController {
  constructor(
    private readonly community: CommunityService,
    private readonly blog: BlogService,
  ) {}

  // ------------------------------------------------------------- profil

  @Get('me/social')
  me(@UserId() userId: string) {
    return this.community.myProfile(userId);
  }

  @Put('me/social')
  updateMe(@UserId() userId: string, @Body() body: SocialProfileDto) {
    return this.community.updateProfile(userId, body);
  }

  @Put('me/social/avatar')
  avatar(@UserId() userId: string, @Body() body: ImageDto) {
    return this.community.setAvatar(userId, body.image, body.mimeType);
  }

  @Delete('me/social/avatar')
  removeAvatar(@UserId() userId: string) {
    return this.community.removeAvatar(userId);
  }

  /** Salvate: postarile din comunitate si articolele din blog. */
  @Get('me/saved')
  async saved(@UserId() userId: string) {
    const [posts, articles] = [
      await this.community.savedPosts(userId),
      await this.blog.saved(userId),
    ];
    return { posts, articles };
  }

  @Get('users/:id/profile')
  profile(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.community.profile(userId, id);
  }

  @Get('users/:id/posts')
  userPosts(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: FeedQueryDto,
  ) {
    return this.community.userPosts(userId, id, query.cursor);
  }

  // ------------------------------------------------------------- postari

  @Get('feed')
  feed(@UserId() userId: string, @Query() query: FeedQueryDto) {
    return this.community.feed(userId, query);
  }

  @Post('posts')
  create(@UserId() userId: string, @Body() body: CreatePostDto) {
    return this.community.create(userId, body);
  }

  /** Sfaturile echipei: doar nutritionistii si administratorii. */
  @Post('posts/tip')
  @Roles('nutritionist', 'admin')
  createTip(@UserId() userId: string, @Body() body: TipDto) {
    return this.community.createTip(userId, body);
  }

  @Get('posts/:id')
  get(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.community.get(userId, id);
  }

  @Patch('posts/:id')
  update(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdatePostDto,
  ) {
    return this.community.update(userId, id, body);
  }

  @Delete('posts/:id')
  @HttpCode(204)
  async remove(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.community.remove(userId, id);
  }

  @Put('posts/:id/like')
  like(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: ToggleDto) {
    return this.community.like(userId, id, body.value);
  }

  @Put('posts/:id/save')
  save(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: ToggleDto) {
    return this.community.save(userId, id, body.value);
  }

  @Post('posts/:id/report')
  @HttpCode(204)
  async report(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReportDto,
  ) {
    await this.community.report(userId, id, body);
  }
}

@Controller('blog')
@UseGuards(AuthGuard)
export class BlogController {
  constructor(private readonly blog: BlogService) {}

  @Get()
  list(@UserId() userId: string, @Query() query: BlogQueryDto) {
    return this.blog.list(userId, query);
  }

  /** Articolele autorului, inclusiv ciornele. */
  @Get('authored')
  @Roles('nutritionist', 'admin')
  authored(@UserId() userId: string, @Query() query: BlogQueryDto) {
    return this.blog.authored(userId, false, query.cursor);
  }

  @Get('authored/:id')
  @Roles('nutritionist', 'admin')
  editable(
    @UserId() userId: string,
    @UserRole() role: Role,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.blog.editable(userId, role, id);
  }

  @Post()
  @Roles('nutritionist', 'admin')
  create(@UserId() userId: string, @Body() body: BlogPostDto) {
    return this.blog.create(userId, body);
  }

  @Put(':id')
  @Roles('nutritionist', 'admin')
  update(
    @UserId() userId: string,
    @UserRole() role: Role,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: BlogPostDto,
  ) {
    return this.blog.update(userId, role, id, body);
  }

  @Delete(':id')
  @Roles('nutritionist', 'admin')
  @HttpCode(204)
  async remove(
    @UserId() userId: string,
    @UserRole() role: Role,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.blog.remove(userId, role, id);
  }

  @Get(':id')
  get(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.blog.get(userId, id);
  }

  @Put(':id/like')
  like(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: ToggleDto) {
    return this.blog.toggle(userId, id, 'blog_likes', body.value);
  }

  @Put(':id/save')
  save(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: ToggleDto) {
    return this.blog.toggle(userId, id, 'blog_saves', body.value);
  }
}

@Module({
  imports: [AuthModule, AiModule, NotificationsModule, EngagementModule],
  controllers: [MediaController, CommunityController, BlogController],
  providers: [MediaService, CommunityService, BlogService],
  exports: [CommunityService, BlogService],
})
export class SocialModule {}
