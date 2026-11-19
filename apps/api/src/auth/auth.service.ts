import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseService } from '../database/database.service.js';
import { hashPassword, verifyPassword } from './password.js';

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;
const SESSION_DAYS = 30;

export interface AuthResult {
  token: string;
  user: { id: string; email: string };
}

const sha256 = (value: string) => createHash('sha256').update(value).digest();

// Hash folosit cand e-mailul nu exista, ca timpul de raspuns sa nu dezvaluie conturile existente.
const DUMMY_HASH = await hashPassword(randomBytes(16).toString('hex'));

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService) {}

  async register(email: string, password: string): Promise<AuthResult> {
    const passwordHash = await hashPassword(password);
    let userId: string;
    try {
      const { rows } = await this.db.auth.query<{ id: string }>(
        'insert into users (email, password_hash) values ($1, $2) returning id',
        [email, passwordHash],
      );
      userId = rows[0].id;
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('Exista deja un cont cu acest e-mail.');
      }
      throw error;
    }
    await this.db.asUser(userId, (c) =>
      c.query(`insert into consents (user_id, kind) values ($1, 'health_data')`, [userId]),
    );
    return { token: await this.createSession(userId), user: { id: userId, email } };
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const { rows } = await this.db.auth.query<{
      id: string;
      email: string;
      password_hash: string;
      locked_until: Date | null;
    }>('select id, email, password_hash, locked_until from users where email = $1', [email]);
    const user = rows[0];

    if (!user) {
      await verifyPassword(password, DUMMY_HASH);
      throw new UnauthorizedException('E-mail sau parola gresita.');
    }
    if (user.locked_until && user.locked_until > new Date()) {
      throw new HttpException(
        { statusCode: 423, message: 'Contul este blocat temporar dupa prea multe incercari.' },
        HttpStatus.LOCKED,
      );
    }
    if (!(await verifyPassword(password, user.password_hash))) {
      await this.db.auth.query(
        `update users set
           failed_logins = case when failed_logins + 1 >= $2 then 0 else failed_logins + 1 end,
           locked_until = case when failed_logins + 1 >= $2
                               then now() + make_interval(mins => $3) else locked_until end
         where id = $1`,
        [user.id, MAX_FAILED_LOGINS, LOCK_MINUTES],
      );
      throw new UnauthorizedException('E-mail sau parola gresita.');
    }

    await this.db.auth.query(
      'update users set failed_logins = 0, locked_until = null where id = $1',
      [user.id],
    );
    return { token: await this.createSession(user.id), user: { id: user.id, email: user.email } };
  }

  /** Returneaza id-ul utilizatorului pentru un token valid sau null. */
  async userIdForToken(token: string): Promise<string | null> {
    const { rows } = await this.db.auth.query<{ user_id: string }>(
      'select user_id from sessions where token_hash = $1 and expires_at > now()',
      [sha256(token)],
    );
    return rows[0]?.user_id ?? null;
  }

  async logout(token: string): Promise<void> {
    await this.db.auth.query('delete from sessions where token_hash = $1', [sha256(token)]);
  }

  async me(userId: string) {
    const { rows } = await this.db.auth.query<{ id: string; email: string }>(
      'select id, email from users where id = $1',
      [userId],
    );
    const consent = await this.db.asUser(userId, (c) =>
      c.query(`select 1 from consents where kind = 'health_data' and revoked_at is null`),
    );
    return { ...rows[0], healthDataConsent: consent.rowCount === 1 };
  }

  /** Tokenul este returnat o singura data; in baza de date se pastreaza doar amprenta lui. */
  private async createSession(userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.db.auth.query(
      `insert into sessions (user_id, token_hash, expires_at)
       values ($1, $2, now() + make_interval(days => $3))`,
      [userId, sha256(token), SESSION_DAYS],
    );
    return token;
  }
}
