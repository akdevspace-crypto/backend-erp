import express from 'express';
import routes from './src/routes/index';
const app = express();
app.use(express.json());
app.use('/api', routes);
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`✅ Test server running on port ${PORT}`);
    process.exit(0);
});
