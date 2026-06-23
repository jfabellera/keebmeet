import axios from 'axios';
import bcrypt from 'bcrypt';
import { type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { ILike } from 'typeorm';
import config from '../config';
import { User } from '../entity/User';
import { sendVerificationEmail } from '../util/email';
import {
  createUserSchema,
  editUserSchema,
  verifyUserSchema,
} from '../util/validator';

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

  await sendVerificationEmail(newUser.email);

  return res.status(201).json(newUser);
};

export const verifyUser = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const result = verifyUserSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json(result.error);
  }

  const { user_id } = req.params as Record<string, string>;

  const user = await User.findOneBy({
    id: parseInt(user_id),
  });

  if (user == null) {
    return res.status(404).json({ message: 'Invalid user ID.' });
  }

  // Verify OTP
  const otp = req.body.otp;
  // TODO(jan)

  if (false) {
    return res.status(400).json({ message: 'Invalid OTP.' });
  }

  user.is_verified = true;
  await user.save();

  return res.status(200).json({ message: 'User verified successfully.' });
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
 * Payload of the short-lived token issued when a Discord login matches an
 * existing (unlinked) account by email. It carries the server-verified Discord
 * ID through the round trip so the client cannot forge which Discord account is
 * being linked. The user must sign in (see {@link discordLink}) before the link
 * is committed.
 */
interface LinkTokenData {
  discord_id: string;
  email: string;
  nick_name: string;
  purpose: 'discord_link';
}

const LINK_TOKEN_TTL = '10m';

/**
 * Exchanges a Discord OAuth2 authorization code for the user's Discord profile.
 * Throws if the exchange or profile fetch fails (handled by the caller).
 */
const exchangeCodeForDiscordUser = async (
  code: string
): Promise<DiscordUser> => {
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

  return userResponse.data;
};

/**
 * Exchanges a Discord OAuth2 authorization code for the user's Discord profile,
 * then logs them in by issuing an MMS JWT.
 *
 * The user is resolved in priority order:
 *   1. An existing account already linked to this Discord ID.
 *   2. An existing account with a matching email — the caller is asked to
 *      confirm and sign in before linking (see {@link discordLink}); a signed
 *      link token is returned instead of a session.
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
    discordUser = await exchangeCodeForDiscordUser(code);
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
  const displayName = (
    discordUser.global_name ??
    discordUser.username ??
    'Discord User'
  ).slice(0, 30);

  // 1. Already linked to this Discord account
  let user = await User.findOneBy({ discord_id: discordId });

  // 2. An account with this email already exists but isn't linked to Discord.
  // Don't auto-link or log in: hand back a signed link token carrying the
  // verified Discord ID. The caller can either confirm + sign in to link (see
  // {@link discordLink}) or create a separate account with a different email
  // (see {@link discordRegister}).
  if (user == null && email != null) {
    const existingUser = await User.findOne({ where: { email: ILike(email) } });
    if (existingUser != null) {
      const linkTokenData: LinkTokenData = {
        discord_id: discordId,
        email: existingUser.email,
        nick_name: displayName,
        purpose: 'discord_link',
      };
      const linkToken = jwt.sign(linkTokenData, config.jwtSecret, {
        expiresIn: LINK_TOKEN_TTL,
      });

      return res.status(200).json({
        requiresLink: true,
        email: existingUser.email,
        linkToken,
      });
    }
  }

  // 3. Create a new account from the Discord profile
  if (user == null) {
    if (email == null) {
      return res
        .status(400)
        .json({ message: 'Discord account has no email address.' });
    }

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

/**
 * Completes Discord linking after the user confirms and signs in.
 *
 * Verifies the credentials (as in {@link login}), validates the signed link
 * token issued by {@link discordLogin}, and — only if the authenticated account
 * matches the token's email and the Discord ID isn't already claimed — links the
 * Discord ID and issues a session token.
 */
export const discordLink = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { email, password, linkToken } = req.body;

  if (linkToken == null) {
    return res.status(400).json({ message: 'Missing link token.' });
  }

  let linkTokenData: LinkTokenData;
  try {
    linkTokenData = jwt.verify(linkToken, config.jwtSecret) as LinkTokenData;
  } catch {
    return res
      .status(401)
      .json({ message: 'Link request has expired. Please try again.' });
  }

  if (linkTokenData.purpose !== 'discord_link') {
    return res.status(401).json({ message: 'Invalid link token.' });
  }

  // Authenticate the user with their existing credentials.
  const existingUser = await User.findOne({
    where: { email: ILike(email) },
  });

  if (existingUser == null || existingUser.password_hash == null) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const isAuthenticated = await bcrypt.compare(
    password,
    existingUser.password_hash
  );

  if (!isAuthenticated) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  // The signed-in account must be the one the link token was issued for.
  if (existingUser.email.toLowerCase() !== linkTokenData.email.toLowerCase()) {
    return res
      .status(401)
      .json({ message: 'This Discord account cannot be linked to this user.' });
  }

  // Don't steal a Discord ID already linked to another account.
  const discordOwner = await User.findOneBy({
    discord_id: linkTokenData.discord_id,
  });
  if (discordOwner != null && discordOwner.id !== existingUser.id) {
    return res.status(409).json({
      message: 'This Discord account is already linked to another user.',
    });
  }

  existingUser.discord_id = linkTokenData.discord_id;
  await existingUser.save();

  return res.status(201).json({ token: signToken(existingUser) });
};

/**
 * Creates a brand new account from a Discord login whose email already belongs
 * to another account.
 *
 * Reached when {@link discordLogin} returns `requiresLink` and the user chooses
 * to create a separate account instead of linking. The signed link token proves
 * the Discord ID (and display name) were verified by Discord; the caller must
 * supply a different, unused email for the new account.
 */
export const discordRegister = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { email, linkToken } = req.body;

  if (linkToken == null) {
    return res.status(400).json({ message: 'Missing link token.' });
  }

  if (email == null) {
    return res.status(400).json({ message: 'An email address is required.' });
  }

  let linkTokenData: LinkTokenData;
  try {
    linkTokenData = jwt.verify(linkToken, config.jwtSecret) as LinkTokenData;
  } catch {
    return res
      .status(401)
      .json({ message: 'Link request has expired. Please try again.' });
  }

  if (linkTokenData.purpose !== 'discord_link') {
    return res.status(401).json({ message: 'Invalid link token.' });
  }

  // The new account needs an email that isn't already in use.
  const existingUser = await User.findOne({ where: { email: ILike(email) } });
  if (existingUser != null) {
    return res.status(409).json({ message: 'Email is taken.' });
  }

  // Don't steal a Discord ID already linked to another account.
  const discordOwner = await User.findOneBy({
    discord_id: linkTokenData.discord_id,
  });
  if (discordOwner != null) {
    return res.status(409).json({
      message: 'This Discord account is already linked to another user.',
    });
  }

  const user = User.create({
    email,
    first_name: '',
    last_name: '',
    nick_name: linkTokenData.nick_name,
    discord_id: linkTokenData.discord_id,
  });
  await user.save();

  return res.status(201).json({ token: signToken(user) });
};

/**
 * Links a Discord account to the already-authenticated requestor.
 *
 * Unlike {@link discordLink} (which links during sign-in for a matched email),
 * this is called by a logged-in user from their account page. The requestor is
 * taken from the auth middleware; the Discord ID is rejected if another account
 * already owns it.
 */
export const linkDiscordAccount = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { code } = req.body;
  const user = res.locals.requestor as User;

  if (code == null) {
    return res.status(400).json({ message: 'Missing authorization code.' });
  }

  let discordUser: DiscordUser;
  try {
    discordUser = await exchangeCodeForDiscordUser(code);
  } catch (error: any) {
    console.error(
      'Discord link failed:',
      error.response?.status,
      error.response?.data ?? error.message
    );
    return res
      .status(401)
      .json({ message: 'Failed to authenticate with Discord.' });
  }

  const discordId = String(discordUser.id);

  // Don't steal a Discord ID already linked to another account.
  const discordOwner = await User.findOneBy({ discord_id: discordId });
  if (discordOwner != null && discordOwner.id !== user.id) {
    return res.status(409).json({
      message: 'This Discord account is already linked to another user.',
    });
  }

  user.discord_id = discordId;
  await user.save();

  return res.status(201).json({ token: signToken(user) });
};
