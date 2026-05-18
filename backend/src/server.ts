import express, { Request, Response } from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware để parse JSON
app.use(express.json());

// Route Hello World đơn giản
app.get('/', (req: Request, res: Response) => {
  res.send('Hello World!');
});

// Route với JSON response
app.get('/api/hello', (req: Request, res: Response) => {
  res.json({
    message: 'Hello World!',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});