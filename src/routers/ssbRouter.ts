import { Router, Request, Response } from 'express';
import SsbService from '../services/ssbService';
import LoggerService from '../services/loggerService';

class SsbRouter {
    private router: Router;
    private ssbService: SsbService;
    private loggerService: LoggerService;

    constructor() {
        this.router = Router();
        this.ssbService = new SsbService();
        this.loggerService = LoggerService.create.bind(SsbRouter)();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.get('/getAllCacheData', (req: Request, res: Response) =>
            this.ssbService.getAllCacheData(req, res)
        );
        this.router.post('/enableExecute', (req: Request, res: Response) =>
            this.ssbService.enableExecute(req, res)
        );
        this.router.post('/executeSsbJob', (req: Request, res: Response) =>
            this.ssbService.executeSsbJob(req, res)
        );
        this.router.post('/clearSignalCaches', async (req: Request, res: Response) => {
            const clearedCount = await this.ssbService.clearSignalCaches();
            const message = `Cleared ${clearedCount} caches`;
            this.loggerService.log(message);
            res.status(200).json({ message: this.loggerService.getMessage(message) });

        }
        );
    }

    public getRouter(): Router {
        return this.router;
    }
}

export default SsbRouter;