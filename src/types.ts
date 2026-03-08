export interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
}

export interface TransactionResult {
  hash: string;
  from: string;
  to: string;
  amount: string;
  blockNumber: number;
  gasUsed: string;
  status: 'success' | 'failed';
  timestamp: number;
}

export interface WalletState {
  address: string | null;
  usdcBalance: string;
  isConnected: boolean;
}

export interface AppConfig {
  usdcAddress: string;
  usdcDecimals: number;
  circlesRecipient: string;
  tenderlyRpc: string;
  transferAmount: string;
}