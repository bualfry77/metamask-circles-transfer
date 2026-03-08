import { BrowserProvider } from 'ethers';
import { EthereumProvider, WalletState } from './types';

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export function isMetaMaskInstalled(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.ethereum !== 'undefined' &&
    window.ethereum.isMetaMask === true
  );
}

export async function connectWallet(): Promise<WalletState> {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed. Please install it from https://metamask.io');
  }

  const accounts = (await window.ethereum!.request({
    method: 'eth_requestAccounts',
  })) as string[];

  if (!accounts || accounts.length === 0) {
    throw new Error('No accounts found. Please unlock MetaMask.');
  }

  return {
    address: accounts[0]!,
    usdcBalance: '0',
    isConnected: true,
  };
}

export function getProvider(): BrowserProvider {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed.');
  }
  return new BrowserProvider(window.ethereum!);
}

export function setupAccountChangeListener(callback: (accounts: string[]) => void): void {
  if (!isMetaMaskInstalled()) return;
  window.ethereum!.on('accountsChanged', (...args: unknown[]) => {
    if (Array.isArray(args[0])) {
      callback(args[0] as string[]);
    }
  });
}

export function setupChainChangeListener(callback: (chainId: number) => void): void {
  if (!isMetaMaskInstalled()) return;
  window.ethereum!.on('chainChanged', (chainId: unknown) => {
    callback(parseInt(chainId as string, 16));
  });
}
