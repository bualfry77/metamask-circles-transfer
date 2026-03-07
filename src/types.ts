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
}

export interface TransferConfig {
  tenderly_rpc: string;
  usdc_address: string;
  circles_recipient: string;
  transfer_amount: string;
}