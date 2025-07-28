import express from 'express';
import cors from 'cors';
import SsbRouter from './routers/ssbRouter';
import SwtRouter from './routers/swtRouter';

const app = express();
const port = process.env.PORT || 3000;

const ssbRouter = new SsbRouter();
const swtRouter = new SwtRouter();

app.use(cors());
app.use(express.json());

// Routes
app.use('/ssb', ssbRouter.getRouter());
app.use('/swt', swtRouter.getRouter());

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});