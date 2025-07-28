import { SignalResponse, SignalRequest, RollbackRequest } from '../types';
import RedisService from './redisService';
import customAxios from '../customAxios';
import axios from 'axios';
import { SSB_LIST } from '../constants';
import LoggerService from './loggerService';

class MindsService {
    private readonly apiUrl: string = 'https://api.f22services.hko.gov.hk/minds/ssb?site=prod';
    private readonly redisService: RedisService;
    private readonly loggerService: LoggerService;

    constructor() {
        this.redisService = RedisService.getInstance();
        this.loggerService = LoggerService.create.bind(MindsService)();
    }

    async getRecentCache(signalCode: string): Promise<SignalRequest | undefined> {
        try {
            const keys = await this.redisService.getCacheKeysFromRedis(signalCode);

            if (!keys.length) {
                return;
            }

            const caches = await Promise.all(
                keys.map(async (key) => await this.redisService.getCacheData<SignalRequest>(key))
            );

            const validCaches = caches.filter((cache): cache is SignalRequest => cache !== null);

            if (!validCaches.length) {
                return;
            }

            const mostRecentCache = validCaches.sort((a, b) => {
                const dateA = new Date(a.creationTime['#content']);
                const dateB = new Date(b.creationTime['#content']);
                return dateB.getTime() - dateA.getTime();
            })[0];

            return mostRecentCache;
        } catch (error) {
            console.error(`Error fetching caches for signalCode ${signalCode}:`, error);
            return;
        }
    }

    getTtlFromExpiryTime(request: SignalRequest): number | undefined {
        if (!request.expiryTime) {
            return;
        }

        try {
            const [datePart, timePart] = request.expiryTime.split(' ');
            const [day, month, year] = datePart.split('/').map(Number);
            const [hours, minutes] = timePart.split(':').map(Number);
            const expiryDate = new Date(year, month - 1, day, hours, minutes);
            const now = new Date();
            const diffInSeconds = Math.floor((expiryDate.getTime() - now.getTime()) / 1000);

            return diffInSeconds;
        } catch (error) {
            console.error('Error parsing expiry time:', error);
            return;
        }
    }

    async getSignalRequests(): Promise<SignalRequest[]> {
        try {
            const response = await customAxios.get(this.apiUrl);
            const data = response.data as SignalResponse;

            if (!data.SignalRequestList || !data.SignalRequestList.SignalRequest) {
                throw new Error('Invalid response format: SignalRequestList or SignalRequest missing');
            }

            this.loggerService.log(`Total fetch count: ${data.SignalRequestList.SignalRequest.length}`);

            const uniqueRequests = this.getUniqueRequests(data.SignalRequestList.SignalRequest);
            this.loggerService.log(`uniqueRequests count: ${uniqueRequests.length}`);

            const validRequests = uniqueRequests.filter(req => {
                const expiryTtl = this.getTtlFromExpiryTime(req);
                return !expiryTtl || expiryTtl > 0;
            });
            this.loggerService.log(`validRequests count: ${validRequests.length}`);

            return validRequests;
        } catch (error) {
            this.loggerService.log(`Error fetching signal requests from MINDS API: ${error}`);
            if (axios.isAxiosError(error)) {
                console.error('Axios error details:', {
                    message: error.message,
                    code: error.code,
                    response: error.response ? {
                        status: error.response.status,
                        statusText: error.response.statusText,
                        data: error.response.data,
                    } : null,
                });
            }
            throw error;
        }
    }

    async getRollbackRequests(requests: SignalRequest[]): Promise<RollbackRequest[]> {
        try {
            const rollbackRequests: RollbackRequest[] = [];

            for (const { id, signalCode } of requests) {
                const recentCache = await this.getRecentCache(signalCode);

                if (recentCache && parseInt(id) < parseInt(recentCache.id)) {
                    const rollbackRequest = { ...recentCache, rollbackBy: recentCache.createdBy };
                    rollbackRequests.push(rollbackRequest);
                }
            }

            this.loggerService.log(`Rollback request count: ${rollbackRequests.length}`);
            return rollbackRequests;
        } catch (error) {
            console.error('Error in getRollbackRequests:', error);
            throw error;
        }
    }

    async getFilteredRequests(requests: SignalRequest[]): Promise<SignalRequest[]> {
        try {
            const filteredRequests: SignalRequest[] = [];
            let cacheHit = 0;
            let cacheMiss = 0;

            for (const request of requests) {
                const recentCache = await this.getRecentCache(request.signalCode);

                if (recentCache && recentCache.id === request.id) {
                    cacheHit += 1;
                    continue;
                }

                cacheMiss += 1;
                filteredRequests.push(request);
            }

            this.loggerService.log(`Total count: ${requests.length}, Cache hits: ${cacheHit}, Cache misses: ${cacheMiss}`);
            return filteredRequests;
        } catch (error) {
            console.error('Error in getFilteredRequests:', error);
            throw error;
        }
    }

    getUniqueRequests(requests: SignalRequest[]): SignalRequest[] {
        const targetSignalCodes = Object.keys(SSB_LIST);
        const uniqueRequests = targetSignalCodes.map(signalCode => {
            const signalRequests = requests.filter(req => req.signalCode.toLowerCase() === signalCode.toLowerCase());

            if (!signalRequests.length) {
                return false;
            }

            const latestRequest = signalRequests.reduce((latest, current) => {
                return parseInt(current.id) > parseInt(latest.id) ? current : latest;
            });
            return latestRequest;
        }).filter(request => !!request) as SignalRequest[];

        return uniqueRequests;
    }
}

export default MindsService;