import { Router, Request, Response } from 'express';
import SsbService from '../services/ssbService';

class SsbRouter {
    private router: Router;
    private ssbService: SsbService;

    constructor() {
        this.router = Router();
        this.ssbService = new SsbService();
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
        this.router.post('/clearSignalCaches', (req: Request, res: Response) =>
            this.ssbService.clearSignalCaches(req, res)
        );
    }

    public getRouter(): Router {
        return this.router;
    }
}

export default SsbRouter;