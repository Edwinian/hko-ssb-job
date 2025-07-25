import express, { Request, Response } from 'express';
import cors from 'cors';
import SsbService from './ssbService';

const app = express();
const port = process.env.PORT || 3000;
const ssbService = new SsbService()

app.use(cors());
app.use(express.json());

// Routes
app.get('/getAllCacheData', (req: Request, res: Response) => ssbService.getAllCacheData(req, res));
app.post('/enableExecute', (req: Request, res: Response) => ssbService.enableExecute(req, res));
app.post('/executeSsbJob', async (req: Request, res: Response) => ssbService.executeSsbJob(req, res));
app.post('/clearRequestCaches', async (req: Request, res: Response) => ssbService.clearRequestCaches(req, res));

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

