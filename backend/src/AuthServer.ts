import express, { type RequestHandler } from 'express';
import config from './config';
import {
  createUser,
  deleteUser,
  discordLink,
  discordLogin,
  discordRegister,
  linkDiscordAccount,
  login,
  updateUser,
  verifyUser,
} from './controllers/auth';
import { AppDataSource } from './datasource';
import { Rule, authChecker } from './middleware/authChecker';

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
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET,POST,PUT,DELETE,OPTIONS'
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Access-Control-Allow-Headers, Authorization'
      );
      next();
    });
  }

  private routes(): void {
    this.express.post('/', createUser as RequestHandler);
    this.express.post('/:user_id/verify', verifyUser as RequestHandler);
    this.express.put(
      '/:user_id',
      authChecker([Rule.overrideAdmin]) as RequestHandler,
      updateUser as RequestHandler
    );
    this.express.delete(
      '/:user_id',
      authChecker([Rule.overrideAdmin]) as RequestHandler,
      deleteUser as RequestHandler
    );

    this.express.post('/login', login as RequestHandler);
    this.express.post('/oauth2/discord', discordLogin as RequestHandler);
    this.express.post('/oauth2/discord/link', discordLink as RequestHandler);
    this.express.post(
      '/oauth2/discord/register',
      discordRegister as RequestHandler
    );
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
