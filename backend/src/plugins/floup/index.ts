import express from 'express';
import floupRoutes from './routes';

const app = express();

app.use(express.json());
app.use('/plugins/floup', floupRoutes);

export default app;


