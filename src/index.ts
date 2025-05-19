import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import emailRoutes from './routes/email';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Parse allowed origins from environment variable
let allowedOrigins : string[] = []
if (process.env.ALLOWED_ORIGINS){
  allowedOrigins = process.env.ALLOWED_ORIGINS.split(',')
}

// CORS configuration
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps, curl, etc)
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

app.get('/', (_req, res) => {
  res.send('Server is up and running!');
});

app.use('/api/v1', emailRoutes);

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});