import { Request, Response } from "express";
import { registerUser, loginUser } from "../services/auth.services";
import { RegisterInput } from "../validators/auth.validator";
import { generateAccessToken } from "../utils/jwt.util";


export const register = async (req: Request<{}, {}, RegisterInput>, res: Response) => {

  const { name, email, password } = req.body;

  const user = await registerUser(name, email, password);

  res.jsend.success({ user }, 201);

};

export const login = async (req: Request, res: Response) => {

  const { email, password } = req.body;

  const user = await loginUser(email, password);

  const token = generateAccessToken(user.id, user.role);

  res.jsend.success({ user, token }, 200);

};