import express from 'express';
import cors from 'cors';
import SsbRouter from './routers/ssbRouter';

const app = express();
const port = process.env.PORT || 3000;

const ssbRouter = new SsbRouter();

app.use(cors());
app.use(express.json());

// Routes
app.use('/', ssbRouter.getRouter());

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});