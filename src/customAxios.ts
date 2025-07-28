import axios from 'axios';
import { Agent } from 'https';
import * as fs from 'fs';
import * as path from 'path';

const caCertPath = path.join(__dirname, '../hko-root-ca.crt');
const caCert = fs.readFileSync(caCertPath, 'utf-8');

if (!caCert) {
    throw new Error('CA certificate file is empty or invalid');
}

const agent = new Agent({
    ca: caCert,
});

const customAxios = axios.create({
    headers: { 'Content-Type': 'application/json' },
    httpsAgent: agent,
    timeout: 10000, // 10-second timeout
});

export default customAxios;