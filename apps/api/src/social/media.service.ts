import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type pg from 'pg';
import type { Role } from '../auth/auth.service.js';
import { DatabaseService } from '../database/database.service.js';

export const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ImageMime = (typeof IMAGE_MIME)[number];
/** Limita unei fotografii salvate (aplicatia trimite imagini micsorate, de obicei sub 400 KB). */
export const MAX_IMAGE_BYTES = 4_500_000;

/** Verifica dupa primii octeti ca fisierul este chiar imaginea declarata (nu doar extensia). */
export function decodeImage(base64: string, mime: string): Buffer {
  const data = Buffer.from(base64, 'base64');
  if (data.length < 64 || data.length > MAX_IMAGE_BYTES) {
    throw new BadRequestException('Imaginea este prea mica sau prea mare.');
  }
  const ok =
    (mime === 'image/jpeg' && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) ||
    (mime === 'image/png' &&
      data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
    (mime === 'image/webp' &&
      data.subarray(0, 4).toString('ascii') === 'RIFF' &&
      data.subarray(8, 12).toString('ascii') === 'WEBP');
  if (!ok) throw new BadRequestException('Fisierul nu este o imagine valida.');
  return data;
}

@Injectable()
export class MediaService {
  constructor(private readonly db: DatabaseService) {}

  /** Salveaza imaginea in tranzactia utilizatorului (politica RLS: proprietarul este el). */
  async insert(c: pg.PoolClient, data: Buffer, mime: string): Promise<string> {
    const { rows } = await c.query<{ id: string }>(
      `insert into media (owner_id, mime, data, bytes) values (app_user_id(), $1, $2, $3)
       returning id`,
      [mime, data, data.length],
    );
    return rows[0].id;
  }

  /**
   * Imaginea ceruta, daca utilizatorul are dreptul sa o vada (verificat de politica RLS).
   * Administratorul vede si fotografiile care asteapta verificarea sau au fost raportate.
   */
  async read(userId: string, role: Role, id: string): Promise<{ mime: string; data: Buffer }> {
    const row =
      role === 'admin'
        ? (
            await this.db.auth.query<{ mime: string; data: Buffer }>(
              'select mime, data from media where id = $1',
              [id],
            )
          ).rows[0]
        : await this.db.asUser(userId, async (c) => {
            const { rows } = await c.query<{ mime: string; data: Buffer }>(
              'select mime, data from media where id = $1',
              [id],
            );
            return rows[0];
          });
    if (!row) throw new NotFoundException('Imaginea nu exista.');
    return row;
  }
}
