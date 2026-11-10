import 'dotenv/config';
import type { StringValue } from 'ms';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;
const LOGIN_RATE_LIMIT = process.env.LOGIN_RATE_LIMIT;
const REGISTER_RATE_LIMIT = process.env.REGISTER_RATE_LIMIT;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined');
}

if (!JWT_EXPIRES_IN) {
  throw new Error('JWT_EXPIRES_IN is not defined');
}

if (!LOGIN_RATE_LIMIT) {
  throw new Error('LOGIN_RATE_LIMIT is not defined ');
}

const loginVal = Number(LOGIN_RATE_LIMIT);

if (!Number.isInteger(loginVal) || loginVal < 1) {
  throw new Error('LOGIN_RATE_LIMIT is invalid');
}

if (!REGISTER_RATE_LIMIT) {
  throw new Error('REGISTER_RATE_LIMIT is not defined');
}

const registerVal = Number(REGISTER_RATE_LIMIT);

if (!Number.isInteger(registerVal) || registerVal < 1) {
  throw new Error('REGISTER_RATE_LIMIT is invalid');
}

export const env = {
  JWT_SECRET,
  JWT_EXPIRES_IN: JWT_EXPIRES_IN as StringValue,
  LOGIN_RATE_LIMIT: Number(LOGIN_RATE_LIMIT),
  REGISTER_RATE_LIMIT: Number(REGISTER_RATE_LIMIT),
};
