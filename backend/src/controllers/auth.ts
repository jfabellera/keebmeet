import axios from 'axios';
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

const signToken = (user: User): string => {
  const data: TokenData = {
    id: user.id,
    nick_name: user.nick_name,
    is_organizer: user.is_organizer,
    is_admin: user.is_admin,
  };

  return jwt.sign(data, config.jwtSecret);
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

  if (existingUser != null && existingUser.password_hash != null) {
    const isAuthenticated = await bcrypt.compare(
      password,
      existingUser.password_hash
    );

    if (isAuthenticated) {
      return res.status(201).json({ token: signToken(existingUser) });
    }
  }

  return res.status(401).json({ message: 'Invalid email or password.' });
};

interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  email: string | null;
}

/**
 * Exchanges a Discord OAuth2 authorization code for the user's Discord profile,
 * then logs them in by issuing an MMS JWT.
 *
 * The user is resolved in priority order:
 *   1. An existing account already linked to this Discord ID.
 *   2. An existing account with a matching email (auto-linked to Discord).
 *   3. A brand new account created from the Discord profile.
 */
export const discordLogin = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { code } = req.body;

  if (code == null) {
    return res.status(400).json({ message: 'Missing authorization code.' });
  }

  let discordUser: DiscordUser;
  try {
    const params = new URLSearchParams();
    params.append('client_id', config.discordClientId);
    params.append('client_secret', config.discordClientSecret);
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', config.discordRedirectUri);

    const tokenResponse = await axios.post(
      'https://discord.com/api/oauth2/token',
      params,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` },
    });

    discordUser = userResponse.data;
  } catch (error: any) {
    console.error(
      'Discord SSO failed:',
      error.response?.status,
      error.response?.data ?? error.message
    );
    return res
      .status(401)
      .json({ message: 'Failed to authenticate with Discord.' });
  }

  const discordId = String(discordUser.id);
  const email = discordUser.email;

  // 1. Already linked to this Discord account
  let user = await User.findOneBy({ discord_id: discordId });

  // 2. Auto-link to an existing account with the same email
  if (user == null && email != null) {
    user = await User.findOne({ where: { email: ILike(email) } });
    if (user != null) {
      user.discord_id = discordId;
      await user.save();
    }
  }

  // 3. Create a new account from the Discord profile
  if (user == null) {
    if (email == null) {
      return res
        .status(400)
        .json({ message: 'Discord account has no email address.' });
    }

    const displayName = (
      discordUser.global_name ??
      discordUser.username ??
      'Discord User'
    ).slice(0, 30);

    user = User.create({
      email,
      first_name: '',
      last_name: '',
      nick_name: displayName,
      discord_id: discordId,
    });
    await user.save();
  }

  return res.status(201).json({ token: signToken(user) });
};
