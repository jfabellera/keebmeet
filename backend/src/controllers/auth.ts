import bcrypt from 'bcrypt';
import { type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { ILike } from 'typeorm';
import config from '../config';
import { User } from '../entity/User';
import { createUserSchema, editUserSchema } from '../util/validator';

export interface TokenData {
  id: number;
  nick_name: string;
  is_organizer: boolean;
  is_admin: boolean;
}

const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);
  return passwordHash;
};

export const createUser = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const result = createUserSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json(result.error);
  }

  // Check if email is taken
  const existingUser = await User.findOne({
    where: {
      email: ILike(req.body.email),
    },
  });

  if (existingUser != null) {
    return res.status(409).json({ message: 'Email is taken.' });
  }

  // Hash password and create
  const password_hash = await hashPassword(req.body.password);

  const newUser = User.create({
    email: req.body.email,
    first_name: req.body.first_name,
    last_name: req.body.last_name,
    nick_name: req.body.nick_name,
    password_hash,
  });
  await newUser.save();

  return res.status(201).json(newUser);
};

export const updateUser = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { user_id } = req.params as Record<string, string>;

  const result = editUserSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json(result.error);
  }

  // Check if user exists
  const user = await User.findOneBy({
    id: parseInt(user_id),
  });

  if (user == null) {
    return res.status(404).json({ message: 'Invalid user ID.' });
  }

  // Check if email is taken
  const existingUser = await User.findOne({
    where: {
      email: ILike(req.body.email),
    },
  });

  if (existingUser != null) {
    return res.status(409).json({ message: 'Email is taken.' });
  }

  user.email = req.body.email ?? user.email;
  user.first_name = req.body.first_name ?? user.first_name;
  user.last_name = req.body.last_name ?? user.last_name;
  user.nick_name = req.body.nick_name ?? user.nick_name;

  // Require admin
  if ((res.locals.requestor as User).is_admin) {
    user.is_organizer = req.body.is_organizer ?? user.is_organizer;
    user.is_admin = req.body.is_admin ?? user.is_admin;
  }

  if (req.body.password != null) {
    user.password_hash = await hashPassword(req.body.password);
  }

  await user.save();

  return res.status(201).json(user);
};

export const deleteUser = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { user_id } = req.params as Record<string, string>;

  const user = await User.findOneBy({
    id: parseInt(user_id),
  });

  if (user == null) {
    return res.status(404).json({ message: 'Invalid user ID.' });
  }

  await user.remove();

  return res.status(204).end();
};

export const login = async (req: Request, res: Response): Promise<Response> => {
  const { email, password } = req.body;

  const existingUser = await User.findOne({
    where: {
      email: ILike(email),
    },
  });

  if (existingUser != null) {
    const isAuthenticated = await bcrypt.compare(
      password,
      existingUser.password_hash
    );

    if (isAuthenticated) {
      const data: TokenData = {
        id: existingUser.id,
        nick_name: existingUser.nick_name,
        is_organizer: existingUser.is_organizer,
        is_admin: existingUser.is_admin,
      };

      const token = jwt.sign(data, config.jwtSecret);

      return res.status(201).json({ token });
    }
  }

  return res.status(401).json({ message: 'Invalid email or password.' });
};
