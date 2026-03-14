/// <reference types="vite/client" />

// StearCode integration module
// Connects this MetaMask transfer app to the StearCode platform (stearcode.com)
// to enable remote configuration sync and transfer reporting.

export interface StearCodeConfig {
  apiKey: string;
  endpoint: string;
}

export interface StearCodeRemoteConfig {
  circlesRecipient?: string;
  transferAmount?: string;
  gasPayerAddress?: string;
}

export interface StearCodeTransferReport {
  hash: string;
  from: string;
  to: string;
  amount: string;
  status: 'success' | 'failed';
  timestamp: number;
  blockNumber: number;
  gasUsed: string;
}

export type StearCodeStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

type StatusCallback = (status: StearCodeStatus, message?: string) => void;
type ConfigCallback = (config: StearCodeRemoteConfig) => void;

export const STEARCODE_DEFAULT_ENDPOINT = 'https://api.stearcode.com';

export class StearCodeConnector {
  private config: StearCodeConfig;
  private status: StearCodeStatus = 'disconnected';
  private statusCallbacks: StatusCallback[] = [];
  private configCallbacks: ConfigCallback[] = [];

  constructor(config: StearCodeConfig) {
    this.config = {
      ...config,
      endpoint: config.endpoint || STEARCODE_DEFAULT_ENDPOINT,
    };
  }

  getStatus(): StearCodeStatus {
    return this.status;
  }

  onStatusChange(callback: StatusCallback): void {
    this.statusCallbacks.push(callback);
  }

  onConfigUpdate(callback: ConfigCallback): void {
    this.configCallbacks.push(callback);
  }

  private setStatus(status: StearCodeStatus, message?: string): void {
    this.status = status;
    for (const cb of this.statusCallbacks) {
      cb(status, message);
    }
  }

  async connect(): Promise<StearCodeRemoteConfig | null> {
    if (!this.config.apiKey) {
      this.setStatus('error', 'No API key provided');
      return null;
    }

    this.setStatus('connecting');

    try {
      const url = `${this.config.endpoint}/v1/connect`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-StearCode-Key': this.config.apiKey,
        },
        body: JSON.stringify({ app: 'metamask-circles-transfer', version: '1.0.0' }),
      });

      if (!response.ok) {
        throw new Error(`StearCode connect failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { config?: StearCodeRemoteConfig };
      this.setStatus('connected');

      if (data.config) {
        for (const cb of this.configCallbacks) {
          cb(data.config);
        }
        return data.config;
      }

      return null;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Connection failed';
      this.setStatus('error', msg);
      return null;
    }
  }

  async fetchConfig(): Promise<StearCodeRemoteConfig | null> {
    if (this.status !== 'connected') return null;

    try {
      const url = `${this.config.endpoint}/v1/config`;
      const response = await fetch(url, {
        headers: { 'X-StearCode-Key': this.config.apiKey },
      });

      if (!response.ok) {
        console.error(`StearCode: fetchConfig failed with status ${response.status}`);
        return null;
      }

      const remoteConfig = (await response.json()) as StearCodeRemoteConfig;
      for (const cb of this.configCallbacks) {
        cb(remoteConfig);
      }
      return remoteConfig;
    } catch (error) {
      console.error('StearCode: fetchConfig error', error);
      return null;
    }
  }

  async reportTransfer(report: StearCodeTransferReport): Promise<void> {
    if (this.status !== 'connected') return;

    try {
      const url = `${this.config.endpoint}/v1/transfer`;
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-StearCode-Key': this.config.apiKey,
        },
        body: JSON.stringify(report),
      });
    } catch (error) {
      // Log to console for debugging but do not interrupt the user flow
      console.error('StearCode: reportTransfer error', error);
    }
  }

  disconnect(): void {
    this.setStatus('disconnected');
  }
}

export function createStearCodeConnector(apiKey: string, endpoint?: string): StearCodeConnector {
  return new StearCodeConnector({
    apiKey,
    endpoint: endpoint ?? STEARCODE_DEFAULT_ENDPOINT,
  });
}
