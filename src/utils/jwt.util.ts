import jwt from "jsonwebtoken";
import { env } from "../config/env";

export const generateAccessToken = (id: string, role: string) => {

  return jwt.sign(
    {
      sub: id, role
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN
    }
  );
};