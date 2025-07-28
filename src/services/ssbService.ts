import { SignalRequest, RocketChatResponse, SignalTimeObject } from '../types';
import RedisService from './redisService';
import { CACHE_FIELDS, CACHE_KEY, SSB_LIST } from '../constants';
import MindsService from './mindsService';
import RocketChatService from './rocketChatService';
import { Request, Response } from 'express';
import LoggerService from './loggerService';
import { parseDate } from '../utils';

class SsbService {
    private readonly redisService: RedisService;
    private readonly mindsService: MindsService;
    private readonly rocketChatService: RocketChatService;
    private readonly loggerService: LoggerService;

    constructor() {
        this.redisService = RedisService.getInstance();
        this.mindsService = new MindsService();
        this.rocketChatService = new RocketChatService();
        this.loggerService = LoggerService.create.bind(SsbService)();
    }

    async clearSignalCaches(signalCode?: string): Promise<number> {
        if (!signalCode) {
            this.loggerService.log(`Clearing all signal caches`);
        }

        try {
            const targetSignalCodes = Object.keys(SSB_LIST);
            const keys = await this.redisService.getCacheKeysFromRedis(signalCode);
            const signalKeys = keys.filter(key => targetSignalCodes.includes(key.toLowerCase()));
            let clearedCount = 0;

            if (signalKeys.length) {
                clearedCount = await this.redisService.clearCaches(signalKeys);
            }

            this.loggerService.log(`Cleared ${clearedCount} signal caches`);
            return clearedCount;
        } catch (error) {
            console.error(`Error clearing caches for signalCode ${signalCode}:`, error);
            throw error;
        }
    }

    async getAllCacheData(req: Request, res: Response) {
        const keys = await this.redisService.getCacheKeysFromRedis();

        if (!keys.length) {
            this.loggerService.log('No cache keys found');
            return [];
        }

        const cacheData = await Promise.all(keys.map(key => this.redisService.getCacheData<SignalRequest>(key)));
        const filteredData = cacheData.filter((data) => !!data && typeof data !== 'string');

        const results = filteredData.sort((a, b) => {
            const dateA = a.creationTime?.['#content'] ? parseDate(a.creationTime['#content']) : new Date(0);
            const dateB = b.creationTime?.['#content'] ? parseDate(b.creationTime['#content']) : new Date(0);
            return dateB.getTime() - dateA.getTime();
        });
        const message = 'Retrieved all cache data';
        this.loggerService.log(message);
        res.status(200).json(results);
    }

    async enableExecute(req: Request, res: Response) {
        const enable = req.body.enable;
        this.loggerService.log(`enableExecute: ${enable}`);

        if (enable) {
            await this.redisService.clearCaches([CACHE_KEY.Disable_Execute]);
        } else {
            await this.redisService.addCache(CACHE_KEY.Disable_Execute, 'true');
        }

        const message = `Execution ${enable ? 'enabled' : 'disabled'}`;
        this.loggerService.log(message);
        res.status(200).json({ message: this.loggerService.getMessage(message) });
    }

    async executeSsbJob(req: Request, res: Response) {
        try {
            const disableCache = await this.redisService.getCacheData<SignalRequest>(CACHE_KEY.Disable_Execute);

            if (disableCache) {
                const message = 'Execution is disabled';
                this.loggerService.log(message);
                return res.status(220).json({ message: this.loggerService.getMessage(message) });
            }

            const sendRequest = async (request: SignalRequest, isRollback: boolean = false): Promise<RocketChatResponse | undefined> => {
                const _handleSendFail = (request: SignalRequest, error?: unknown) => {
                    const requestValues = CACHE_FIELDS.map(
                        (field) => `${field}: ${typeof request[field] === 'object' ? (request[field] as SignalTimeObject)['#content'] : request[field] || ''}`
                    ).join(', ');
                    const message = error ? `Error processing request: ${requestValues}, Error: ${error}` : `Error processing request: ${requestValues}`;
                    this.loggerService.log(message);
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
                    const requests = await this.mindsService.getSignalRequests();
                    this.loggerService.log(`Retrieved ${requests.length} signal requests`);
                    const rollbackRequests = await this.mindsService.getRollbackRequests(requests);
                    this.loggerService.log(`Retrieved ${rollbackRequests.length} rollback requests`);
                    const filteredRequests = await this.mindsService.getFilteredRequests(requests);
                    this.loggerService.log(`Filtered to ${filteredRequests.length} requests`);

                    await Promise.all(
                        filteredRequests.map(async (request) => {
                            const sendResponse = await sendRequest(request);

                            if (sendResponse?.data.success) {
                                await this.clearSignalCaches(request.signalCode);
                                await this.redisService.addCache(request.signalCode, request);
                                this.loggerService.log(`Successfully processed request with signalCode: ${request.signalCode}`);
                            }
                        })
                    );

                    await Promise.all(rollbackRequests.map((request) => sendRequest(request, true)));

                    return filteredRequests;
                } catch (error) {
                    this.loggerService.log(`Error in execute process: ${error}`);
                    return [];
                }
            };

            const result = await execute();
            const statusCode = result.length === 0 ? 200 : 210;
            const message = `Processed ${result.length} requests.`;
            this.loggerService.log(`Processed ${result.length} requests with status ${statusCode}`);
            res.status(statusCode).json({ message: this.loggerService.getMessage(message) });
        } catch (error) {
            const message = `Error in executeSsbJob: ${error}`;
            this.loggerService.log(message);
            res.status(500).json({ error: this.loggerService.getMessage('Internal server error') });
        }
    }
}

export default SsbService;