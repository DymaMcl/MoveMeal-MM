import { ValidationPipe, type INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

/** Configurarea comuna pentru server si pentru testele de integrare. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  // Fotografiile pentru recunoasterea alimentelor se trimit ca base64 (implicit limita este 100 KB).
  (app as NestExpressApplication).useBodyParser('json', { limit: '8mb' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
