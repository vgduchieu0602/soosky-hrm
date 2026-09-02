import mongoose from 'mongoose';
import { env } from '@infra/config';
import { logger } from '@infra/logger/logger';

export async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGO_URI);
  logger.info('MongoDB connected');
}

export async function disconnectDB() {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}
