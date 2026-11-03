import 'dotenv/config';
import type { StringValue } from 'ms';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined');
}

if (!JWT_EXPIRES_IN) {
  throw new Error('JWT_EXPIRES_IN is not defined');
}

export const env = {
  JWT_SECRET,
  JWT_EXPIRES_IN: JWT_EXPIRES_IN as StringValue,
};
