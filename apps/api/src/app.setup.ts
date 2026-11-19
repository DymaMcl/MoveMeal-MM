import { ValidationPipe, type INestApplication } from '@nestjs/common';

/** Configurarea comuna pentru server si pentru testele de integrare. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
