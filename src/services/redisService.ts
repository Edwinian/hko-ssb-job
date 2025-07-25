import { createClient, RedisClientType } from 'redis';
import { SignalRequest } from '../types';
import { parseDate } from '../utils';
import { SSB_LIST } from '../constants';
import LoggerService from './loggerService';

class RedisService {
    private static instance: RedisService; // Static instance to hold the singleton
    private readonly loggerService: LoggerService;
    private client: RedisClientType;
    private isReady = false;

    // Private constructor to prevent direct instantiation
    constructor() {
        this.loggerService = LoggerService.create.bind(RedisService)();
        this.client = createClient({
            url: 'redis://localhost:6379',
        });
        this.client.on('error', (err) => {
            this.loggerService.log(`Redis Client Error: ${err}`);
        });
        this.client.on('connect', () => {
            this.loggerService.log('Redis client connected');
        });
        this.client.on('ready', () => {
            this.isReady = true;
            this.loggerService.log('Redis client ready');
        });
        this.client.on('end', () => {
            this.isReady = false;
            this.loggerService.log('Redis client disconnected');
        });
        this.connect();
    }

    // Static method to get the singleton instance
    public static getInstance(): RedisService {
        if (!RedisService.instance) {
            RedisService.instance = new RedisService();
        }
        return RedisService.instance;
    }

    // Rest of the RedisService methods remain unchanged
    private async connect(): Promise<void> {
        const retry = async () => {
            await new Promise(resolve => setTimeout(resolve, 2000));
            return this.connect();
        }

        if (!this.client.isOpen || !this.isReady) {
            try {
                this.loggerService.log('Attempting to connect to Redis...');
                await this.client.connect();
                this.loggerService.log('Connected to Redis');
            } catch (error) {
                this.loggerService.log(`Failed to connect to Redis: ${error}`);
                await retry();
            }

            if (!this.client.isOpen || !this.isReady) {
                await retry();
            }
        }
    }

    async getCacheKeysFromRedis(signalCode: string = ""): Promise<string[]> {
        try {
            const keys = await this.client.keys('*');
            const signalKeys = signalCode ? keys.filter(key => key.includes(signalCode)) : keys;
            return signalKeys;
        } catch (error) {
            console.error(`Error fetching keys for signalCode ${signalCode}:`, error);
            return [];
        }
    }

    async getAllCacheData(): Promise<SignalRequest[]> {
        const keys = await this.getCacheKeysFromRedis();

        if (!keys.length) {
            this.loggerService.log('No cache keys found');
            return [];
        }

        const cacheData = await Promise.all(keys.map(key => this.getCacheData(key)));
        const filteredData = cacheData.filter((data): data is SignalRequest => !!data && typeof data !== 'string');

        return filteredData.sort((a, b) => {
            const dateA = a.creationTime?.['#content'] ? parseDate(a.creationTime['#content']) : new Date(0);
            const dateB = b.creationTime?.['#content'] ? parseDate(b.creationTime['#content']) : new Date(0);
            return dateB.getTime() - dateA.getTime();
        });
    }

    async getCacheData(key: string): Promise<SignalRequest | undefined> {
        try {
            const data = await this.client.get(key);

            if (data) {
                try {
                    const parsedData = JSON.parse(data) as SignalRequest;
                    return parsedData;
                } catch (parseError) {
                    console.error(`Error parsing JSON for key ${key}:`, parseError);
                    return;
                }
            }
            return;
        } catch (error) {
            console.error(`Error getting cache for key ${key}:`, error);
            return;
        }
    }

    async getRecentCache(signalCode: string): Promise<SignalRequest | undefined> {
        try {
            const keys = await this.getCacheKeysFromRedis(signalCode);

            if (!keys.length) {
                return;
            }

            const caches = await Promise.all(
                keys.map(async (key) => await this.getCacheData(key))
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

    async addCache(key: string, data: string, ttlSeconds?: number): Promise<void> {
        if (ttlSeconds) {
            await this.client.setEx(key, ttlSeconds, data);
        } else {
            await this.client.set(key, data);
        }
    }

    async clearCaches(keys: string[]): Promise<number> {
        return await this.client.del(keys);
    }

    async addRequestCache(request: SignalRequest, ttlSeconds?: number): Promise<void> {
        const key = request.signalCode;
        const data = JSON.stringify(request);

        try {
            await this.addCache(key, data, ttlSeconds);
            this.loggerService.log(`Cache added for key: ${key}`);
        } catch (error) {
            this.loggerService.log(`Error adding cache for key ${key}: ${error}`);
            throw error;
        }
    }

    async clearSignalCaches(signalCode?: string): Promise<number> {
        if (!signalCode) {
            this.loggerService.log(`Clearing all signal caches`);
        }

        try {
            const targetSignalCodes = Object.keys(SSB_LIST);
            const keys = await this.getCacheKeysFromRedis(signalCode);
            const signalKeys = keys.filter(key => targetSignalCodes.includes(key.toLowerCase()));
            let clearedCount = 0;

            if (signalKeys.length) {
                clearedCount = await this.clearCaches(signalKeys);
            }

            this.loggerService.log(`Cleared ${clearedCount} signal caches`);
            return clearedCount;
        } catch (error) {
            console.error(`Error clearing caches for signalCode ${signalCode}:`, error);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        try {
            if (this.client.isOpen) {
                await this.client.quit();
                this.loggerService.log('Disconnected from Redis');
            }
        } catch (error) {
            console.error('Error disconnecting from Redis:', error);
            throw error;
        }
    }
}

export default RedisService;