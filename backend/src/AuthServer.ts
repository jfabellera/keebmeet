import express, { type RequestHandler } from 'express';
import config from './config';
import {
  createUser,
  deleteUser,
  discordLink,
  discordLogin,
  linkDiscordAccount,
  login,
  resendVerificationEmail,
  updateUser,
  verifyUser,
} from './controllers/auth';
import { AppDataSource } from './datasource';
import { Rule, authChecker } from './middleware/authChecker';
import {
  loginLimiter,
  resendVerificationLimiter,
} from './middleware/rateLimiter';

void AppDataSource.initialize();

class AuthServer {
  private readonly express: express.Application;

  constructor() {
    this.express = express();
    this.config();
    this.routes();
  }

  private config(): void {
    this.express.use(express.json());
    this.express.use(express.urlencoded({ extended: false }));
    this.express.use(function (req, res, next) {
      // In production the frontend is same-origin (served under the same domain
      // as /api/auth), so these headers are a no-op. They only matter for local
      // dev, where the Vite server (config.webUrl) is a different origin.
      res.setHeader('Access-Control-Allow-Origin', config.webUrl);
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET,POST,PUT,DELETE,OPTIONS'
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization'
      );
      next();
    });
  }

  private routes(): void {
    this.express.post('/', createUser as RequestHandler);
    this.express.post('/verify-email', verifyUser as RequestHandler);
    this.express.post(
      '/:user_id/resend-verification',
      resendVerificationLimiter,
      resendVerificationEmail as RequestHandler
    );
    this.express.put(
      '/:user_id',
      loginLimiter,
      authChecker([Rule.overrideAdmin]) as RequestHandler,
      updateUser as RequestHandler
    );
    this.express.delete(
      '/:user_id',
      authChecker([Rule.overrideAdmin]) as RequestHandler,
      deleteUser as RequestHandler
    );

    this.express.post('/login', loginLimiter, login as RequestHandler);
    this.express.post('/oauth2/discord', discordLogin as RequestHandler);
    this.express.post('/oauth2/discord/link', discordLink as RequestHandler);
    this.express.post(
      '/oauth2/discord/link-account',
      authChecker() as RequestHandler,
      linkDiscordAccount as RequestHandler
    );

    this.express.use((req, res, next) => {
      res.send('Not a valid endpoint.');
    });
  }

  public start = (port: number, hostname: string): void => {
    this.express
      .listen(port, hostname, () => {
        console.log(`Running on port ${port}`);
      })
      .on('error', (err) => {
        console.log(err);
      });
  };
}

const port = parseInt(config.authPort);
const hostname = config.authHostname;
const server = new AuthServer();
server.start(port, hostname);
