import { Request, Response } from 'express';
import { registerUser, loginUser } from '../services/auth.services';
import { RegisterInput } from '../schemas/auth.schema';
import { generateAccessToken } from '../utils/jwt.util';

export const register = async (
  req: Request<Record<string, never>, Record<string, never>, RegisterInput>,
  res: Response,
) => {
  const { name, email, password } = req.body;

  const user = await registerUser(name, email, password);

  res.jsend.success({ user }, 201);
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await loginUser(email, password);

  const token = generateAccessToken(user.id);

  res.jsend.success({ user, token }, 200);
};
