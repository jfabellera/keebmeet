import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';
import axios, { AxiosError } from 'axios';
import { jwtDecode } from 'jwt-decode';
import { type TokenData } from '../../../backend/src/controllers/auth';
import config from '../config';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  firstName: string;
  lastName: string;
  nickName: string;
  password: string;
  requestOrganizer: boolean;
}

export interface DiscordLinkPayload {
  email: string;
  password: string;
  linkToken: string;
}

export interface SetUserAccessPayload {
  userId: number;
  isAdmin: boolean;
  isOrganizer: boolean;
}

export interface UpdateProfilePayload {
  userId: number;
  firstName: string;
  lastName: string;
  displayName: string;
  /** New password. Omit or leave empty to keep the current one. */
  password?: string;
}

/**
 * Returned by {@link discordLogin} when the Discord account's email matches an
 * existing, unlinked KeebMeet account. The user must confirm and sign in (via
 * {@link discordLink}) before the accounts are linked.
 */
export interface DiscordLinkRequired {
  requiresLink: true;
  email: string;
  linkToken: string;
}

interface User {
  token: string;
  id: number;
  displayName: string;
  isOrganizer: boolean;
  isAdmin: boolean;
}

interface AuthState {
  isLoggedIn: boolean;
  user: User | null;
  loading: boolean;
  error: number | null;
}

/**
 * Thunk for logging in.
 *
 * This will set the authentication token in local storage if successfully
 * authenticated.
 */
/**
 * Rejection payload from {@link login} when the credentials are valid but the
 * account's email hasn't been verified. Carries the user id so the UI can offer
 * to resend the verification email.
 */
export interface UnverifiedEmailError {
  unverified: true;
  userId: number;
}

export const login = createAsyncThunk<
  User | null,
  LoginPayload,
  { rejectValue: number | UnverifiedEmailError }
>('auth/login', async (payload: LoginPayload, { rejectWithValue }) => {
  try {
    const response = await axios.post(`${config.authUrl}/login`, payload);
    const { data } = response;

    localStorage.setItem('token', data.token);

    return getUserFromToken(data.token);
  } catch (err) {
    if (err instanceof AxiosError && err.response != null) {
      // Unverified email: surface it distinctly so the user can resend.
      if (err.response.status === 403 && err.response.data?.user_id != null) {
        return rejectWithValue({
          unverified: true,
          userId: err.response.data.user_id,
        } satisfies UnverifiedEmailError);
      }
      return rejectWithValue(err.response.status);
    } else {
      return rejectWithValue(500);
    }
  }
});

/**
 * Thunk for logging in via Discord SSO.
 *
 * Exchanges the Discord authorization code (from the OAuth2 redirect) for a KeebMeet
 * token. This will set the authentication token in local storage on success.
 */
export const discordLogin = createAsyncThunk(
  'auth/discordLogin',
  async (code: string, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${config.authUrl}/oauth2/discord`, {
        code,
      });
      const { data } = response;

      // An account with this email already exists but isn't linked to Discord.
      // Surface the link request instead of logging in.
      if (data.requiresLink === true) {
        return {
          requiresLink: true,
          email: data.email,
          linkToken: data.linkToken,
        } satisfies DiscordLinkRequired;
      }

      localStorage.setItem('token', data.token);

      return getUserFromToken(data.token);
    } catch (err) {
      if (err instanceof AxiosError && err.response != null) {
        return rejectWithValue(err.response?.status);
      } else {
        return rejectWithValue(500);
      }
    }
  }
);

/**
 * Thunk for linking a Discord account to an existing KeebMeet account.
 *
 * Called after the user confirms linking and signs in. Sends the credentials
 * along with the link token from {@link discordLogin}; on success the accounts
 * are linked and a session token is stored.
 */
export const discordLink = createAsyncThunk(
  'auth/discordLink',
  async (payload: DiscordLinkPayload, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        `${config.authUrl}/oauth2/discord/link`,
        payload
      );
      const { data } = response;

      localStorage.setItem('token', data.token);

      return getUserFromToken(data.token);
    } catch (err) {
      if (err instanceof AxiosError && err.response != null) {
        return rejectWithValue(err.response?.status);
      } else {
        return rejectWithValue(500);
      }
    }
  }
);

/**
 * Thunk for registering.
 */
export const register = createAsyncThunk(
  'auth/register',
  async (payload: RegisterPayload, { rejectWithValue }) => {
    try {
      await axios.post(`${config.authUrl}/`, {
        email: payload.email,
        first_name: payload.firstName,
        last_name: payload.lastName,
        nick_name: payload.nickName,
        password: payload.password,
        is_organizer_requested: payload.requestOrganizer,
      });
    } catch (err: any) {
      if (err instanceof AxiosError && err.response != null) {
        return rejectWithValue(err.response?.status);
      } else {
        return rejectWithValue(500);
      }
    }
  }
);

/**
 * Thunk for verifying an email address.
 *
 * Sends the signed token from the verification link (see the auth server's
 * email-verification flow) to the auth server, which validates the signature and
 * embedded expiry and marks the account verified. No session is involved.
 */
export const verifyEmail = createAsyncThunk(
  'auth/verifyEmail',
  async (token: string, { rejectWithValue }) => {
    try {
      await axios.post(`${config.authUrl}/verify-email`, { token });
    } catch (err) {
      if (err instanceof AxiosError && err.response != null) {
        return rejectWithValue(err.response?.status);
      } else {
        return rejectWithValue(500);
      }
    }
  }
);

/**
 * Thunk for resending the verification email.
 *
 * Used when a verification link has expired; the auth server issues a fresh
 * link for the given user. No-ops server-side if the user is already verified.
 */
export const resendVerification = createAsyncThunk(
  'auth/resendVerification',
  async (userId: number, { rejectWithValue }) => {
    try {
      await axios.post(`${config.authUrl}/${userId}/resend-verification`);
    } catch (err) {
      if (err instanceof AxiosError && err.response != null) {
        return rejectWithValue(err.response?.status);
      } else {
        return rejectWithValue(500);
      }
    }
  }
);

/**
 * Thunk for an admin to change another user's access (admin/organizer flags).
 *
 * Sends the role flags to the auth server, which only honours them for an admin
 * requestor. The affected user's own session token keeps its old flags until
 * they next sign in.
 */
export const setUserAccess = createAsyncThunk(
  'auth/setUserAccess',
  async (payload: SetUserAccessPayload, { getState, rejectWithValue }) => {
    try {
      const token = (getState() as { user: AuthState }).user.user?.token;

      await axios.put(
        `${config.authUrl}/${payload.userId}`,
        {
          is_admin: payload.isAdmin,
          is_organizer: payload.isOrganizer,
        },
        { headers: { Authorization: `Bearer ${token ?? ''}` } }
      );
    } catch (err) {
      if (err instanceof AxiosError && err.response != null) {
        return rejectWithValue(err.response?.status);
      } else {
        return rejectWithValue(500);
      }
    }
  }
);

/**
 * Thunk for updating the logged-in user's profile.
 *
 * Sends the editable profile fields to the auth server. The display name is
 * also reflected in local auth state so the UI updates without a re-login (the
 * JWT itself keeps the old value until the next sign in).
 */
export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (payload: UpdateProfilePayload, { getState, rejectWithValue }) => {
    try {
      const token = (getState() as { user: AuthState }).user.user?.token;

      await axios.put(
        `${config.authUrl}/${payload.userId}`,
        {
          first_name: payload.firstName,
          last_name: payload.lastName,
          nick_name: payload.displayName,
          // Only send a password when the user actually entered a new one.
          ...(payload.password != null && payload.password !== ''
            ? { password: payload.password }
            : {}),
        },
        { headers: { Authorization: `Bearer ${token ?? ''}` } }
      );

      return payload.displayName;
    } catch (err) {
      if (err instanceof AxiosError && err.response != null) {
        return rejectWithValue(err.response?.status);
      } else {
        return rejectWithValue(500);
      }
    }
  }
);

/**
 * Thunk for linking a Discord account to the currently logged-in user.
 *
 * Called from the account page's Discord OAuth callback. Sends the Discord
 * authorization code with the user's session token; the server attaches the
 * Discord ID to the authenticated account.
 */
export const linkDiscord = createAsyncThunk(
  'auth/linkDiscord',
  async (code: string, { getState, rejectWithValue }) => {
    try {
      const token = (getState() as { user: AuthState }).user.user?.token;

      await axios.post(
        `${config.authUrl}/oauth2/discord/link-account`,
        { code },
        { headers: { Authorization: `Bearer ${token ?? ''}` } }
      );
    } catch (err) {
      if (err instanceof AxiosError && err.response != null) {
        return rejectWithValue(err.response?.status);
      } else {
        return rejectWithValue(500);
      }
    }
  }
);

/**
 * Gets user object from JWT. If the JWT cannot be decoded, this function will
 * return null.
 *
 *
 * @param token The JWT to decode
 * @returns User object if valid token
 */
const getUserFromToken = (token: string): User | null => {
  try {
    const decoded = jwtDecode<TokenData>(token);

    const user: User = {
      token,
      id: decoded.id,
      displayName: decoded.nick_name,
      isOrganizer: decoded.is_organizer,
      isAdmin: decoded.is_admin,
    };

    return user;
  } catch (err) {
    return null;
  }
};

/**
 * Gets user object from local storage token. If there is no token in local
 * storage, this function will return null.
 *
 * @returns User object if valid token
 */
const getUserFromLocalStorage = (): User | null => {
  const token = localStorage.getItem('token');
  if (token == null) return null;
  return getUserFromToken(token);
};

const initialState: AuthState = {
  isLoggedIn: getUserFromLocalStorage() != null,
  user: getUserFromLocalStorage(),
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.isLoggedIn = false;
      state.user = null;
      localStorage.removeItem('token');
    },
  },
  extraReducers(builder) {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
      })
      .addCase(login.fulfilled, (state, action: PayloadAction<any>) => {
        state.loading = false;
        state.user = action.payload;
        state.isLoggedIn = true;
        state.error = null;
      })
      .addCase(login.rejected, (state, action: PayloadAction<any>) => {
        state.loading = false;
        state.user = null;
        state.isLoggedIn = false;
        state.error = action.payload;
      })
      .addCase(discordLogin.pending, (state) => {
        state.loading = true;
      })
      .addCase(discordLogin.fulfilled, (state, action: PayloadAction<any>) => {
        state.loading = false;
        state.error = null;
        // Linking required: not logged in yet, the user must sign in to confirm.
        if (action.payload?.requiresLink === true) {
          return;
        }
        state.user = action.payload;
        state.isLoggedIn = true;
      })
      .addCase(discordLogin.rejected, (state, action: PayloadAction<any>) => {
        state.loading = false;
        state.user = null;
        state.isLoggedIn = false;
        state.error = action.payload;
      })
      .addCase(discordLink.pending, (state) => {
        state.loading = true;
      })
      .addCase(discordLink.fulfilled, (state, action: PayloadAction<any>) => {
        state.loading = false;
        state.user = action.payload;
        state.isLoggedIn = true;
        state.error = null;
      })
      .addCase(discordLink.rejected, (state, action: PayloadAction<any>) => {
        state.loading = false;
        state.user = null;
        state.isLoggedIn = false;
        state.error = action.payload;
      })
      .addCase(register.pending, (state) => {
        state.loading = true;
      })
      .addCase(register.fulfilled, (state) => {
        state.loading = false;
        state.error = null;
      })
      .addCase(register.rejected, (state, action: PayloadAction<any>) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(updateProfile.pending, (state) => {
        state.loading = true;
      })
      .addCase(
        updateProfile.fulfilled,
        (state, action: PayloadAction<string>) => {
          state.loading = false;
          state.error = null;
          if (state.user != null) {
            state.user.displayName = action.payload;
          }
        }
      )
      .addCase(updateProfile.rejected, (state, action: PayloadAction<any>) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;
