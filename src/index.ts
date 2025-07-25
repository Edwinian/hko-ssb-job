import express, { Request, Response } from 'express';
import cors from 'cors';
import ApiService from './apiService';

const app = express();
const port = process.env.PORT || 3000;
const apiService = new ApiService()

app.use(cors());
app.use(express.json());

// Routes
app.get('/getAllCacheData', (req: Request, res: Response) => apiService.getAllCacheData(req, res));
app.post('/enableExecute', (req: Request, res: Response) => apiService.enableExecute(req, res));
app.post('/executeSsbJob', async (req: Request, res: Response) => apiService.executeSsbJob(req, res));
app.post('/clearRequestCaches', async (req: Request, res: Response) => apiService.clearRequestCaches(req, res));

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

