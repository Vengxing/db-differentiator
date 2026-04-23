import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import routes from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

// Serve the frontend static files (+ up one level since we are in src/)
app.use(express.static(join(__dirname, '../public')));

// Mount all API routes
app.use(routes);

// Serve the frontend index.html
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, '../public/index.html'));
});

export default app;
