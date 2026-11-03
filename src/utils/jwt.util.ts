import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export const generateAccessToken = (id: string) => {
  return jwt.sign(
    {
      sub: id,
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN,
    },
  );
};
