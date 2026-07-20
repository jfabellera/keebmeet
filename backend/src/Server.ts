import express from 'express';
import { io } from 'socket.io-client';
import config from './config';
import { AppDataSource } from './datasource';
import discordRoutes from './routes/discord';
import eventbriteRoutes from './routes/eventbrite';
import groupRoutes from './routes/groups';
import meetupRoutes from './routes/meetups';
import oauth2Routes from './routes/oauth2';
import organizerRequestRoutes from './routes/organizerRequests';
import raffleRoutes from './routes/raffles';
import ticketRoutes from './routes/tickets';
import userRoutes from './routes/users';

void AppDataSource.initialize();
export const socket = io(config.socketUrl);

class Server {
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
      // as /api), so these headers are a no-op. They only matter for local dev,
      // where the Vite server (config.webUrl) is a different origin.
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
    this.express.use('/users', userRoutes);
    this.express.use('/organizer-requests', organizerRequestRoutes);
    this.express.use('/meetups', meetupRoutes);
    this.express.use('/tickets', ticketRoutes);
    this.express.use('/oauth2/', oauth2Routes);
    this.express.use('/eventbrite', eventbriteRoutes);
    this.express.use('/raffles', raffleRoutes);
    this.express.use('/discord', discordRoutes);
    this.express.use('/groups', groupRoutes);

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

const port = parseInt(config.apiPort);
const hostname = config.apiHostname;
const server = new Server();
server.start(port, hostname);
