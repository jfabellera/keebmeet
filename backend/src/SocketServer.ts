import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import config from './config';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: config.webUrl } });

io.on('connection', (socket) => {
  const { meetupId } = socket.handshake.query;

  if (meetupId != null) {
    void socket.join(`meetup-${String(meetupId)}`);
  }

  socket.on('meetup:subscribe', (payload) => {
    void socket.join(`meetup-${String(payload.meetupId)}`);
  });

  socket.on('meetup:unsubscribe', (payload) => {
    void socket.leave(`meetup-${String(payload.meetupId)}`);
  });

  socket.on('meetup:update', (payload) => {
    io.to(`meetup-${String(payload.meetupId)}`).emit('meetup:update', {
      meetupId: payload.meetupId,
    });
  });

  socket.on('meetup:display', (payload) => {
    io.to(`meetup-${String(payload.meetupId)}`).emit('meetup:display', {
      winners: payload.winners,
      losers: payload.losers,
      isBatchRoll: payload.isBatchRoll,
    });
  });

  socket.on('disconnect', () => {});
});

httpServer.listen(parseInt(config.socketPort), config.socketHostname, () => {
  console.log(`Socket server running on port ${config.socketPort}`);
});
