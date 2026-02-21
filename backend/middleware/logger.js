import { v4 as uuidv4 } from 'uuid';

export const logger = (req, res, next) => {
  req.id = uuidv4();
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] [${req.id}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });

  next();
};
