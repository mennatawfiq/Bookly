import { Request, Response } from "express";
import { registerUser } from "../services/auth.services";
import { RegisterInput } from "../validators/auth.validator";


export const register = async (req: Request<{}, {}, RegisterInput>, res: Response) => {

  const { name, email, password } = req.body;

  const user = await registerUser(name, email, password);

  res.status(201).json({ user });

};