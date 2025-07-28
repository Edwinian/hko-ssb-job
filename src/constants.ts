import { SignalRequest } from "./types";

export enum SIGNAL_ACTION {
    Issue = 'issue',
    Extend = 'extend',
    Cancel = 'cancel',
}

export const SSB_LIST = {
    wcold: { id: -1 },
    wfirer: { id: -1 },
    wfirey: { id: -1 },
    wfntsa: { id: -1 },
    wfrost: { id: -1 },
    whot: { id: -1 },
    whota: { id: -1 },
    rrain: { id: -1 },
    wl: { id: -1 },
    rhinf: { id: -1 },
    wraina: { id: -1 },
    wrainb: { id: -1 },
    wrainr: { id: -1 },
    tc1: { id: -1 },
    tc3: { id: -1 },
    tc10: { id: -1 },
    tcpre8up: { id: -1 },
    tc8ne: { id: -1 },
    tc8nw: { id: -1 },
    tc8se: { id: -1 },
    tc8sw: { id: -1 },
    tc9: { id: -1 },
    wts: { id: -1 },
    wtips: { id: -1 },
    wmsgnl_monsoon: { id: -1 },
    wtm: { id: -1 },
};

export const CACHE_FIELDS: (keyof SignalRequest)[] = ['action', 'active', 'activeTime', 'expiryTime', 'id', 'signalCode', 'creationTime']

export enum CACHE_KEY {
    Disable_Execute = 'disableExecute',
}

export enum SWT_BULLETIN_CODE {
    MHEAD_C = 'MHEAD_C',
    MHEAD_E = 'MHEAD_E',
}
