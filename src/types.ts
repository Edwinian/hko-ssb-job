import { Bulletin_Status, SIGNAL_ACTION, SSB_LIST, SWT_BULLETIN_CODE } from './constants';

export interface SignalResponse {
  SignalRequestList: SignalRequestList
}

export interface SignalRequestList {
  SignalRequest: SignalRequest[];
}

export interface SignalTimeObject {
  '#content': string;
  '-class': string;
}

export type TargetCodeType = keyof typeof SSB_LIST

export interface SignalRequest {
  action: SIGNAL_ACTION;
  active: SignalActive;
  activeTime: string; // 15/07/2025 05:15;
  archiveStatus: string;
  createdBy: string;
  creationTime: SignalTimeObject; // 2025-07-24 06:21:18.0
  id: string;
  lastUpdatedBy: string;
  lastUpdatedTime: SignalTimeObject;
  signalCode: string;
  signalIcon?: string;
  signalName: string;
  signalType: string;
  syncStatus: string;
  expiryTime?: string; // 15/07/2025 12:09;
}

export interface RollbackRequest extends SignalRequest {
  rollbackBy: string
}

export type SignalActive = 'Y' | 'N'

export interface RocketChatResponse {
  status: number
  statusText: string
  data: {
    success: boolean
  }
}

export interface AttachmentField {
  short: boolean; // Whether the field should be displayed as a short field
  title: string; // Title of the field
  value: string; // Value of the field, displayed under the title
}

export interface Attachment {
  color: string; // e.g., "#ff0000"
  text: string; // Main text for the attachment
  ts: string; // Timestamp, e.g., "2016-12-09T16:53:06.761Z"
  thumb_url: string; // URL for a small image to the left of the text
  message_link: string; // Clickable link associated with the message
  collapsed: boolean; // If true, collapses image, audio, and video sections
  author_name: string; // Name of the author
  author_link: string; // URL for clickable author name
  author_icon: string; // URL for a tiny icon next to author’s name
  title: string; // Title of the attachment, displayed under author
  title_link: string; // URL for clickable title
  title_link_download: boolean; // If true, shows a download icon for title_link
  image_url: string; // URL for a large image
  audio_url: string; // URL for an audio file
  video_url: string; // URL for a video file
  fields: Partial<AttachmentField>[]; // Array of field objects for tables/columns
}

export interface SpecialWeatherTip {
  id: number;
  IssueDate: string; // e.g., "20250724"
  IssueTime: string; // e.g., "1820"
  ValidDate: string;
  ValidTime: string;
  MsgTag: string;
  MsgUrl: boolean; // e.g., false
  MsgContent: string; // e.g., "測試2"
  MsgSeq: number; // e.g., 1
  WeatherHeadline: boolean; // e.g., true
  Action: string; // e.g., "Update"
  TwitterPost: string;
  WeiboPost: string;
  MsgTwitter: string;
  MsgWeibo: string;
  TopMost: boolean[]; // e.g., [false, false]
  IsPushNoti: boolean[]; // e.g., [true, true]
  Unchange: string;
  BullCode: SWT_BULLETIN_CODE;
  sendTime: string;
  creationTime: string;
  createdBy: string;
}

export interface BulletinSubmit {
  sendTime: string;
  submitContent: string;
  status: Bulletin_Status;
  bullCode: SWT_BULLETIN_CODE;
  bullName: string;
  snapId: number;
  id: number;
  active: string;
  createdBy: string;
  lastUpdatedTime: string;
  creationTime: BulletinCreationTime;
  lastUpdatedBy: string;
}

export interface BulletinCreationTime {
  _: string; // e.g., '2025-07-28 15:27:50.0'
  $: {
    class: string; // e.g., 'sql-timestamp'
  };
}
