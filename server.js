import 'dotenv/config';
import app from './src/app.js';
import { initPools } from './src/config/db.js';

const PORT = process.env.PORT || 3000;

initPools();

app.listen(PORT, () => {
  console.log(`\n🔍 DB Differentiator running at http://localhost:${PORT}\n`);
});
