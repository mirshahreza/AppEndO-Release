import bcrypt from 'bcryptjs';
import { promisify } from 'node:util';

const BCRYPT_ROUNDS = 10;

const hashImpl = promisify(bcrypt.hash) as (password: string, rounds: number) => Promise<string>;
const compareImpl = promisify(bcrypt.compare) as (password: string, hash: string) => Promise<boolean>;

export const hashPassword = (password: string): Promise<string> => hashImpl(password, BCRYPT_ROUNDS);

export const comparePassword = (password: string, hash: string): Promise<boolean> => compareImpl(password, hash);
