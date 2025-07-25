import { SignalRequest, RocketChatResponse, SignalTimeObject } from './types';
import RedisService from './redisService';

import { CACHE_FIELDS, CACHE_KEY } from './constants';
import DataService from './dataService';
import RocketChatService from './rocketChatService';
import { Request, Response } from 'express';

class ApiService {
    private readonly redisService: RedisService;
    private readonly dataService: DataService;
    private readonly rocketChatService: RocketChatService;

    constructor() {
        this.redisService = new RedisService();
        this.dataService = new DataService(this.redisService);
        this.rocketChatService = new RocketChatService();
    }

    async clearRequestCaches(req: Request, res: Response) {
        const clearedCount = await this.redisService.clearRequestCaches();
        res.status(200).json({ message: `Cleared ${clearedCount} caches` });
    }

    async getAllCacheData(req: Request, res: Response) {
        const results = await this.redisService.getAllCacheData();
        res.status(200).json(results);
    }

    async enableExecute(req: Request, res: Response) {
        const enable = req.body.enable;
        console.log('enableExecute', enable);

        if (enable) {
            await this.redisService.clearCaches([CACHE_KEY.Disable_Execute]);
        } else {
            await this.redisService.addCache(CACHE_KEY.Disable_Execute, 'true');
        }

        res.status(200).json({ message: `Execution ${enable ? 'enabled' : 'disabled'}` });
    }

    async executeSsbJob(req: Request, res: Response) {
        try {
            const disableCache = await this.redisService.getCacheData(CACHE_KEY.Disable_Execute)

            if (disableCache) {
                return res.status(220).json({ message: 'Execution is disabled' });
            }

            const sendRequest = async (request: SignalRequest, isRollback: boolean = false): Promise<RocketChatResponse | undefined> => {
                const _handleSendFail = (request: SignalRequest, error?: unknown) => {
                    const requestValues = CACHE_FIELDS.map((field) => `${field}: ${typeof request[field] === 'object' ? (request[field] as SignalTimeObject)['#content'] : request[field] || ''}`).join(', ');
                    error ? console.error(`Error processing request: ${requestValues}`, error) : console.log(`Error processing request: ${requestValues}`);
                };

                try {
                    const sendResponse = await this.rocketChatService.sendSignalMessage(request, isRollback);

                    if (!sendResponse.data.success) {
                        _handleSendFail(request);
                    }

                    return sendResponse;
                } catch (error) {
                    _handleSendFail(request, error);
                }
            };

            const execute = async (): Promise<SignalRequest[]> => {
                try {
                    const requests = await this.dataService.getSignalRequests();
                    const rollbackRequests = await this.dataService.getRollbackRequests(requests);
                    const filteredRequests = await this.dataService.getFilteredRequests(requests);

                    await Promise.all(filteredRequests.map(async (request) => {
                        const sendResponse = await sendRequest(request);

                        if (sendResponse?.data.success) {
                            await this.redisService.clearRequestCaches(request.signalCode);
                            await this.redisService.addRequestCache(request);
                        }
                    }));

                    await Promise.all(rollbackRequests.map(request => sendRequest(request, true)));

                    return filteredRequests
                } catch (error) {
                    console.error('Error in execute process:', error);
                    return []
                }
            };

            // Execute the logic
            const result = await execute();
            const statusCode = result.length === 0 ? 200 : 210
            res.status(statusCode).json({ message: `Processed ${result.length} requests.` });
        } catch (error) {
            console.error('Error in execute:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

export default ApiService;