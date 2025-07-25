import { SIGNAL_ACTION } from './constants';

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