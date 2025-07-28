import { parseStringPromise } from 'xml2js';
import RedisService from './redisService';
import customAxios from '../customAxios';
import LoggerService from './loggerService';
import { BulletinSubmit, RocketChatResponse, SpecialWeatherTip } from '../types';
import { Request, Response } from 'express';
import RocketChatService from './rocketChatService';
import { SWT_BULLETIN_CODE } from '../constants';

class SwtService {
    private readonly apiUrl: string = 'http://mindsdev1:8080/adminConsole/rest/bulletin/BulletinService/findStoppableSnapshotWithDetails'
    private readonly redisService: RedisService;
    private readonly loggerService: LoggerService;
    private readonly rocketChatService: RocketChatService;

    constructor() {
        this.redisService = RedisService.getInstance();
        this.loggerService = LoggerService.create.bind(SwtService)();
        this.rocketChatService = new RocketChatService();
    }

    async clearTipCaches(): Promise<number> {
        let clearCount = 0

        for (const bullCode of Object.values(SWT_BULLETIN_CODE)) {
            try {
                const keys = await this.redisService.getCacheKeysFromRedis(bullCode);

                if (!!keys.length) {
                    clearCount += await this.redisService.clearCaches(keys);
                }

                this.loggerService.log(`Cleared ${clearCount} tip caches`);
            } catch (error) {
                console.error(`Error clearing caches for bullCode ${bullCode}:`, error);
                throw error;
            }
        }

        return clearCount
    }

    async getFilteredTips(tips: SpecialWeatherTip[]): Promise<SpecialWeatherTip[]> {
        try {
            const filteredTips: SpecialWeatherTip[] = [];
            let cacheHit = 0;
            let cacheMiss = 0;

            for (const tip of tips) {
                const recentCache = await this.redisService.getCacheData<SpecialWeatherTip>(tip.BullCode);

                if (recentCache && recentCache.id >= tip.id) {
                    cacheHit += 1;
                    continue;
                }

                cacheMiss += 1;
                filteredTips.push(tip);
            }

            this.loggerService.log(`Total count: ${tips.length}, Cache hits: ${cacheHit}, Cache misses: ${cacheMiss}`);
            return filteredTips;
        } catch (error) {
            console.error('Error in getFilteredTips:', error);
            throw error;
        }
    }

    async executeSWTJob(req: Request, res: Response) {
        try {
            const sendRequest = async ({ BullCode, MsgContent, WeatherHeadline }: SpecialWeatherTip): Promise<RocketChatResponse | undefined> => {
                const _handleSendFail = (BullCode: SWT_BULLETIN_CODE, error?: unknown) => {
                    let message = `Error processing tip: ${BullCode}`

                    if (error) {
                        message += `, Error: ${error}`;
                    }

                    this.loggerService.log(message);
                };

                try {
                    const attachment = {
                        title: BullCode,
                        text: MsgContent,
                        color: WeatherHeadline ? '#FF0000' : '#0000FF',
                    }
                    const payload = {
                        text: '特別天氣提示',
                        attachments: [attachment],
                    }
                    const sendResponse = await this.rocketChatService.sendMessage(payload);

                    if (!sendResponse.data.success) {
                        _handleSendFail(BullCode);
                    }

                    return sendResponse;
                } catch (error) {
                    _handleSendFail(BullCode, error);
                }
            };

            const execute = async (): Promise<SpecialWeatherTip[]> => {
                try {
                    const tips = await this.getSpecialWeatherTips();
                    const filteredTips = await this.getFilteredTips(tips);

                    await Promise.all(
                        filteredTips.map(async (tip) => {
                            const sendResponse = await sendRequest(tip);

                            if (sendResponse?.data.success) {
                                const keys = await this.redisService.getCacheKeysFromRedis(tip.BullCode);
                                await this.redisService.clearCaches(keys);
                                await this.redisService.addCache<SpecialWeatherTip>(tip.BullCode, tip);
                                this.loggerService.log(`Successfully processed tip with BullCode: ${tip.BullCode}`);
                            }
                        })
                    );

                    return filteredTips;
                } catch (error) {
                    this.loggerService.log(`Error in execute process: ${error}`);
                    return [];
                }
            };

            const result = await execute();
            const statusCode = result.length === 0 ? 200 : 210;
            const message = `Processed ${result.length} tips.`;
            this.loggerService.log(`Processed ${result.length} tips with status ${statusCode}`);
            res.status(statusCode).json({ message: this.loggerService.getMessage(message) });
        } catch (error) {
            const message = `Error in executeSsbJob: ${error}`;
            this.loggerService.log(message);
            res.status(500).json({ error: this.loggerService.getMessage('Internal server error') });
        }
    }

    async parseBulletinXml(
        { id, submitContent, bullCode }: BulletinSubmit
    ): Promise<SpecialWeatherTip> {
        try {
            // Decode base64 to UTF-8 string
            const decodedString = Buffer.from(submitContent, 'base64').toString('utf-8');

            // Parse XML
            const parsedXml = await parseStringPromise(decodedString, {
                explicitArray: false,
                trim: true,
            });
            const bullCodeMessages: Record<string, string>[] = Object.values(parsedXml[bullCode])
            const validMessages = bullCodeMessages.filter((({ MsgContent }: Record<string, string>) => !!MsgContent));
            const targetMessage = validMessages
                .reduce((latest: Record<string, string>, message: Record<string, string>) => {
                    if (!message.MsgContent) {
                        return latest;
                    }

                    // Combine IssueDate and IssueTime into Date objects for comparison
                    const latestDateTime = new Date(
                        `${latest.IssueDate} ${latest.IssueTime.replace(/(\d{2})(\d{2})/, '$1:$2')}`
                    );
                    const messageDateTime = new Date(
                        `${message.IssueDate} ${message.IssueTime.replace(/(\d{2})(\d{2})/, '$1:$2')}`
                    );

                    if (
                        !isNaN(latestDateTime.getTime()) &&
                        !isNaN(messageDateTime.getTime()) &&
                        messageDateTime > latestDateTime
                    ) {
                        return message;
                    }

                    return latest;
                }, validMessages[0]);

            return {
                id,
                BullCode: bullCode,
                IssueDate: targetMessage.IssueDate || '',
                IssueTime: targetMessage.IssueTime || '',
                ValidDate: targetMessage.ValidDate || '',
                ValidTime: targetMessage.ValidTime || '',
                MsgTag: targetMessage.MsgTag || '',
                MsgUrl: targetMessage.MsgUrl === 'true',
                MsgContent: targetMessage.MsgContent || '',
                MsgSeq: parseInt(targetMessage.MsgSeq, 10) || 0,
                WeatherHeadline: targetMessage.WeatherHeadline === 'true',
                Action: targetMessage.Action || '',
                TwitterPost: targetMessage.TwitterPost || '',
                WeiboPost: targetMessage.WeiboPost || '',
                MsgTwitter: targetMessage.MsgTwitter || '',
                MsgWeibo: targetMessage.MsgWeibo || '',
                TopMost: Array.isArray(targetMessage.TopMost)
                    ? targetMessage.TopMost.map((val: string) => val === 'true')
                    : [targetMessage.TopMost === 'true'],
                IsPushNoti: Array.isArray(targetMessage.IsPushNoti)
                    ? targetMessage.IsPushNoti.map((val: string) => val === 'true')
                    : [targetMessage.IsPushNoti === 'true'],
                Unchange: targetMessage.Unchange || '',
            }
        } catch (error: any) {
            throw new Error(`Failed to decode base64 or parse XML: ${error.message}`);
        }
    }

    async getSpecialWeatherTips(): Promise<SpecialWeatherTip[]> {
        const data = new URLSearchParams();

        for (const code of Object.values(SWT_BULLETIN_CODE)) {
            data.append('bulletinCodes', code);
        }

        try {
            const response = await customAxios.post(this.apiUrl, data, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            // Parse top-level XML response
            const parsedResponse = await parseStringPromise(response.data, {
                explicitArray: false,
                trim: true,
            });

            // Normalize bulletinList to an array
            const bulletinList: BulletinSubmit[] = Array.isArray(parsedResponse.bulletinList.BulletinSubmit)
                ? parsedResponse.bulletinList.BulletinSubmit
                : [parsedResponse.bulletinList.BulletinSubmit].filter(Boolean);

            // Process each BulletinSubmit to extract SpecialWeatherTip
            const tips = await Promise.all(
                bulletinList
                    .map((bulletin) => this.parseBulletinXml(bulletin))
            );

            return tips
        } catch (error: any) {
            console.error('Error details:', error);
            throw error;
        }
    }

}

export default SwtService;