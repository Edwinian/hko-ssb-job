import { parseStringPromise } from 'xml2js';
import RedisService from './redisService';
import customAxios from '../customAxios';
import LoggerService from './loggerService';
import { BulletinSubmit, SpecialWeatherTip } from '../types';

class SwtService {
    private readonly apiUrl: string = 'http://mindsdev1:8080/adminConsole/rest/bulletin/BulletinService/findStoppableSnapshotWithDetails'
    private readonly redisService: RedisService;
    private readonly loggerService: LoggerService;

    constructor() {
        this.redisService = RedisService.getInstance();
        this.loggerService = LoggerService.create.bind(SwtService)();
    }

    async parseBulletinXml(
        base64String: string,
        xmlRootKey: string
    ): Promise<SpecialWeatherTip> {
        try {
            // Decode base64 to UTF-8 string
            const decodedString = Buffer.from(base64String, 'base64').toString('utf-8');

            // Parse XML
            const parsedXml = await parseStringPromise(decodedString, {
                explicitArray: false,
                trim: true,
            });

            const message1 = parsedXml[xmlRootKey]?.Message1;
            if (!message1) {
                throw new Error(`Message1 not found in XML under root key ${xmlRootKey}`);
            }

            return {
                IssueDate: message1.IssueDate || '',
                IssueTime: message1.IssueTime || '',
                ValidDate: message1.ValidDate || '',
                ValidTime: message1.ValidTime || '',
                MsgTag: message1.MsgTag || '',
                MsgUrl: message1.MsgUrl === 'true',
                MsgContent: message1.MsgContent || '',
                MsgSeq: parseInt(message1.MsgSeq, 10) || 0,
                WeatherHeadline: message1.WeatherHeadline === 'true',
                Action: message1.Action || '',
                TwitterPost: message1.TwitterPost || '',
                WeiboPost: message1.WeiboPost || '',
                MsgTwitter: message1.MsgTwitter || '',
                MsgWeibo: message1.MsgWeibo || '',
                TopMost: Array.isArray(message1.TopMost)
                    ? message1.TopMost.map((val: string) => val === 'true')
                    : [message1.TopMost === 'true'],
                IsPushNoti: Array.isArray(message1.IsPushNoti)
                    ? message1.IsPushNoti.map((val: string) => val === 'true')
                    : [message1.IsPushNoti === 'true'],
                Unchange: message1.Unchange || '',
            };
        } catch (error: any) {
            throw new Error(`Failed to decode base64 or parse XML: ${error.message}`);
        }
    }

    async getSpecialWeatherTips(): Promise<SpecialWeatherTip[]> {
        const data = new URLSearchParams();
        data.append('bulletinCodes', 'MHEAD_C');
        data.append('bulletinCodes', 'MHEAD_E');

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
                    .filter((bulletin) => bulletin.submitContent && bulletin.bullCode)
                    .map((bulletin) => this.parseBulletinXml(bulletin.submitContent, bulletin.bullCode))
            );

            return tips;
        } catch (error: any) {
            console.error('Error details:', error.response?.data, error.response?.status, error.response?.headers);
            throw error;
        }
    }

}

export default SwtService;