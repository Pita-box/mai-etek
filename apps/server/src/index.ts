import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import superadminRoutes from './routes/superadmin';
import userRoutes from './routes/user';
import chatRoutes from './routes/chat';
import { initSocketIO } from './socket';

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/chat', chatRoutes);

// HTTP server + Socket.IO
const httpServer = createServer(app);
initSocketIO(httpServer);

httpServer.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});