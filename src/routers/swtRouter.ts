import { Router, Request, Response } from 'express';
import SwtService from '../services/swtService';

class SwtRouter {
    private router: Router;
    private swtService: SwtService;

    constructor() {
        this.router = Router();
        this.swtService = new SwtService();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.post('/getSpecialWeatherTips', async (req: Request, res: Response) => {
            const data = await this.swtService.getSpecialWeatherTips()
            return res.status(200).json(data);
        }
        );
    }

    public getRouter(): Router {
        return this.router;
    }
}

export default SwtRouter;