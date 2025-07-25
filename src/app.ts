import express, { Request, Response } from 'express';
import cors from 'cors';
import RedisService from './services/redisService';
import MindsService from './services/mindsService';
import RocketChatService from './services/rocketChatService';
import { CACHE_FIELDS } from './constants';
import { RocketChatResponse, SignalRequest, SignalTimeObject } from './types';

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());
// Parse JSON bodies
app.use(express.json());

// Initialize services
const redisService = new RedisService();
const mindsService = new MindsService();
const rocketChatService = new RocketChatService();

// Define the executeSsbJob route
app.post('/executeSsbJob', async (req: Request, res: Response) => {
    try {
        await redisService.clearRequestCaches(); // Clear all caches to send all messages

        const sendRequest = async (request: SignalRequest, isRollback: boolean = false): Promise<RocketChatResponse | undefined> => {
            const _handleSendFail = (request: SignalRequest, error?: unknown) => {
                const requestValues = CACHE_FIELDS.map((field) => `${field}: ${typeof request[field] === 'object' ? (request[field] as SignalTimeObject)['#content'] : request[field] || ''}`).join(', ');
                error ? console.error(`Error processing request: ${requestValues}`, error) : console.log(`Error processing request: ${requestValues}`);
            };

            try {
                const sendResponse = await rocketChatService.sendSignalMessage(request, isRollback);

                if (!sendResponse.data.success) {
                    _handleSendFail(request);
                }

                return sendResponse;
            } catch (error) {
                _handleSendFail(request, error);
            }
        };

        const execute = async () => {
            try {
                const requests = await mindsService.getSignalRequests();
                const rollbackRequests = await mindsService.getRollbackRequests(requests);
                const filteredRequests = await mindsService.getFilteredRequests(requests);

                await Promise.all(filteredRequests.map(async (request) => {
                    const sendResponse = await sendRequest(request);

                    if (sendResponse?.data.success) {
                        await redisService.clearRequestCaches(request.signalCode);
                        await redisService.addRequestCache(request);
                    }
                }));

                await Promise.all(rollbackRequests.map(request => sendRequest(request, true)));

                return `Processed ${filteredRequests.length} requests.`;
            } catch (error) {
                console.error('Error in execute process:', error);
                throw error;
            }
        };

        const result = await execute();
        res.status(200).json({ message: result });
    } catch (error) {
        console.error('Error in executeSsbJob:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});