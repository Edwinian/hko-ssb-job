import { createClient, RedisClientType } from 'redis';
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

    async getCacheKeysFromRedis(likeQuery: string = ""): Promise<string[]> {
        try {
            const keys = await this.client.keys('*');
            const filteredKeys = likeQuery ? keys.filter(key => key.includes(likeQuery)) : keys;
            return filteredKeys;
        } catch (error) {
            console.error(`Error fetching keys for ${likeQuery}:`, error);
            return [];
        }
    }

    async getCacheData<CacheData>(key: string): Promise<CacheData | undefined> {
        try {
            const data = await this.client.get(key);

            if (data) {
                try {
                    const parsedData = JSON.parse(data)
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

    async addCache<Data>(key: string, data: Data, ttlSeconds?: number): Promise<void> {
        const stringifiedData = typeof data !== 'string' ? JSON.stringify(data) : data;

        if (ttlSeconds) {
            await this.client.setEx(key, ttlSeconds, stringifiedData);
        } else {
            await this.client.set(key, stringifiedData);
        }
    }

    async clearCaches(keys: string[]): Promise<number> {
        if (!keys.length) {
            this.loggerService.log('No keys provided for clearing caches');
            return 0;
        }
        return await this.client.del(keys);
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