import { SIGNAL_ACTION, SWT_BULLETIN_CODE } from '../constants';
import { Attachment, RocketChatResponse, SignalRequest, SpecialWeatherTip } from '../types';
import axios from 'axios';
import customAxios from '../customAxios';

class RocketChatService {
    private readonly webhookUrl: string = 'https://chat.services.hko.gov.hk/hooks/6875c5252849f79b09e8113d/N6LK6YY5hTYk8MNSyeZfHPEuZGuJ2MF7z56bjPrSgyztDjhC';
    private readonly SIGNAL_DESCRIPTION: Record<string, string> = {
        [SIGNAL_ACTION.Issue]: '出',
        [SIGNAL_ACTION.Cancel]: '取消',
        [SIGNAL_ACTION.Extend]: '延長',
        'Cold Weather Warning': '寒冷天氣警告',
        'Red Fire Danger Warning': '紅色火災危險警告',
        'Yellow Fire Danger Warning': '黃色火災危險警告',
        'Flooding in Northern NT': '新界北區水浸特別報告',
        'Frost Warning': '霜凍警告',
        'Hot Weather Warning': '酷熱天氣警告',
        'Hot Weather Special Advisory': '炎熱天氣特別提示',
        'Localized Heavy Rain Alert': '局部地區大雨提示',
        'Landslip Warning': '山泥傾瀉警告',
        'Additional Information': 'SitRep',
        'Amber Rainstorm Warning': '黃色暴雨警告信號',
        'Black Rainstorm Warning': '黑色暴雨警告信號',
        'Red Rainstorm Warning': '紅色暴雨警告信號',
        'StandBy Signal No.1': '一號戒備信號',
        'Hurricane Signal, No.10': '十號颶風信號',
        'Strong Wind Signal No.3': '三號強風信號',
        'TC Pre-No.8 Signal': '預警八號',
        'No.8 Northeast Gale or Storm Signal': '八號東北烈風或暴風信號',
        'No.8 Northwest Gale or Storm Signal': '八號西北烈風或暴風信號',
        'No.8 Southeast Gale or Storm Signal': '八號東南烈風或暴風信號',
        'No.8 Southwest Gale or Storm Signal': '八號西南烈風或暴風信號',
        'Increasing Gale or Storm Signal, No.9': '九號烈風或暴風風力增強信號',
        'Thunderstorm Warning': '雷暴警告',
        'Special Weather Tips': '特別天氣提示',
        'Strong Monsoon Signal': '強烈季候風信號',
        'Tsunami Warning': '海嘯警告',
    };

    private convertDate2(datestr?: string): Date | undefined {
        if (!datestr) {
            return;
        }

        const re1 = /^(\d{2})\/(\d{2})\/(\d{4})\s(\d{2}:\d{2})$/;
        const re2 = /^(\d{4})-(\d{2})-(\d{2})\s(\d{2}:\d{2}:\d{2})/;

        if (re1.test(datestr)) {
            const u = datestr.replace(re1, '$3-$2-$1T$4:00');
            return new Date(u);
        }

        if (re2.test(datestr)) {
            const u = datestr.replace(' ', 'T');
            return new Date(u);
        }

        return;
    }

    private getExpiryTimeDesc(date?: Date): string {
        return date ? `，有效時間至${this.getTimeDesc(date)}` : '';
    }

    private getTimeDesc(date?: Date): string {
        if (!date) {
            return '';
        }

        const nowdate = new Date();
        const n = new Date(nowdate.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
        let tmrtoday = '';
        let n1 = n.getDay();
        if (n1 === 0) {
            n1 = 7;
        }
        let n2 = date.getDay();
        if (n2 === 0) {
            n2 = 7;
        }
        if (n1 < n2) {
            tmrtoday = '明日';
        }
        const h = date.getHours().toString().padStart(2, '0');
        const m = date.getMinutes().toString().padStart(2, '0');
        return `${tmrtoday}${h}:${m}`;
    }

    private get_signal_title(signalRequest: SignalRequest, isRollback: boolean = false): string {
        const signalAction = signalRequest.action.toLowerCase();
        const signaldesc = this.SIGNAL_DESCRIPTION[signalRequest.signalName] || signalRequest.signalName;
        const signalactiondesc = this.SIGNAL_DESCRIPTION[signalAction] || signalAction;
        const signalactivetime = this.convertDate2(signalRequest.activeTime);
        const signalexpirytime = this.convertDate2(signalRequest.expiryTime);
        const signalcreationtime = this.convertDate2(signalRequest.creationTime['#content']);
        const creationTimeDesc = this.getTimeDesc(signalcreationtime);
        const ct = creationTimeDesc ? `(${creationTimeDesc})` : '';
        const followutterMap: Record<string, string> = {
            [SIGNAL_ACTION.Issue]: this.getTimeDesc(signalactivetime),
            [SIGNAL_ACTION.Cancel]: '要',
            [SIGNAL_ACTION.Extend]: this.getTimeDesc(signalexpirytime),
        };
        const followsignaldescMap: Record<string, string> = {
            [SIGNAL_ACTION.Issue]: this.getExpiryTimeDesc(signalexpirytime),
            [SIGNAL_ACTION.Cancel]: '',
            [SIGNAL_ACTION.Extend]: this.getExpiryTimeDesc(signalexpirytime),
        };

        let utter = "話﹕"
        let followUtter = followutterMap[signalAction] || ''
        let followsignaldesc = followsignaldescMap[signalAction] || ''

        if (isRollback) {
            utter = "話﹕搞錯了:sob:。";
            followUtter = "**唔**";
            followsignaldesc = '';
        }

        return `預報員${ct}${utter}${followUtter}${signalactiondesc}${signaldesc}${followsignaldesc}。\n`;
    }

    private mapSwtTimeToTitleTime(time: string, bullCode: SWT_BULLETIN_CODE): string | undefined {
        try {
            if (!time) {
                return "";
            }

            if (!/^\d{4}$/.test(time)) {
                throw new Error(`Invalid IssueTime format: ${time}. Expected HHMM.`);
            }

            const hours = parseInt(time.slice(0, 2), 10);
            const minutes = time.slice(2, 4);

            const am = {
                [SWT_BULLETIN_CODE.MHEAD_C]: '上午',
                [SWT_BULLETIN_CODE.MHEAD_E]: 'AM',
            }
            const pm = {
                [SWT_BULLETIN_CODE.MHEAD_C]: '下午',
                [SWT_BULLETIN_CODE.MHEAD_E]: 'PM',
            }
            const period = hours < 12 ? am[bullCode] : pm[bullCode];
            const formattedHours = (hours % 12 || 12).toString().padStart(2, '0');

            switch (bullCode) {
                case SWT_BULLETIN_CODE.MHEAD_C:
                    return `${period}${formattedHours}:${minutes}`;
                case SWT_BULLETIN_CODE.MHEAD_E:
                    return `${formattedHours}:${minutes} ${period}`;
                default:
                    return ""
            }
        } catch (error: any) {
            console.warn(`Failed to convert to Chinese time format: ${error.message}`);
            return "";
        }
    }

    private get_tip_title(tip: SpecialWeatherTip): string {
        const activeTime = this.mapSwtTimeToTitleTime(tip.IssueTime, tip.BullCode);
        const expiryTime = this.mapSwtTimeToTitleTime(tip.ValidTime, tip.BullCode);
        const tipcreationtime = this.convertDate2(tip.creationTime);
        const creationTimeDesc = this.getTimeDesc(tipcreationtime);
        const ct = creationTimeDesc ? `(${creationTimeDesc})` : '';
        const followTipDescMap = {
            [SWT_BULLETIN_CODE.MHEAD_C]: '，有效時間至expiryTime',
            [SWT_BULLETIN_CODE.MHEAD_E]: ', valid until expiryTime'
        }
        const followTipDesc = expiryTime ? followTipDescMap[tip.BullCode].replace('expiryTime', expiryTime) : '';

        switch (tip.BullCode) {
            case SWT_BULLETIN_CODE.MHEAD_C:
                return `預報員${ct}話﹕${activeTime}出以下特別天氣提示${followTipDesc}:`;
            case SWT_BULLETIN_CODE.MHEAD_E:
                return `Forecaster${ct} said the following special weather tip will be issued at ${activeTime}${followTipDesc}:`;
            default:
                return ""
        }
    }

    async sendMessage(payload: {
        text: string;
        attachments?: Partial<Attachment>[];
    }): Promise<RocketChatResponse> {
        try {
            const response = await customAxios.post(this.webhookUrl, payload);
            return {
                status: response.status,
                statusText: response.statusText,
                data: response.data,
            };
        } catch (error) {
            console.error('Error sending message to Rocket.Chat:', error);
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

    async sendTipMessage(tip: SpecialWeatherTip): Promise<RocketChatResponse> {
        const attachment: Partial<Attachment> = {
            title: tip.BullCode,
            text: tip.MsgContent,
            color: tip.WeatherHeadline ? '#FF0000' : '#0000FF',
        }
        const payload = {
            text: this.get_tip_title(tip),
            attachments: [attachment],
        }
        return await this.sendMessage(payload);
    }

    async sendSignalMessage(signalRequest: SignalRequest, isRollback: boolean = false): Promise<RocketChatResponse> {
        const attachment: Partial<Attachment> = {
            title: signalRequest.signalName,
            text: `Action: ${signalRequest.action} (${signalRequest.createdBy}:${signalRequest.lastUpdatedBy})\n${signalRequest.activeTime}`,
            color: 'red',
        };

        if (signalRequest.signalIcon && !signalRequest.signalIcon.startsWith('no_cartoon')) {
            attachment.thumb_url = `https://demo.f22services.hko.gov.hk/minds/signalimage/${signalRequest.signalIcon}`;
        }

        const payload = {
            text: this.get_signal_title(signalRequest, isRollback),
            attachments: [attachment],
        };

        return await this.sendMessage(payload);
    }
}

export default RocketChatService;