/// <reference types="vite/client" />

// Environment variables are exposed by Vite via import.meta.env (VITE_ prefix required)
export const CONFIG = {
  TENDERLY_RPC: import.meta.env.VITE_TENDERLY_RPC as string,
  USDC_ADDRESS: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  USDC_DECIMALS: 6,
  CIRCLES_RECIPIENT: import.meta.env.VITE_CIRCLES_RECIPIENT as string,
  CIRCLES_SEED_ADDRESS: import.meta.env.VITE_CIRCLES_SEED_ADDRESS as string,
  TRANSFER_AMOUNT: '19800',
};

export const USDC_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

export const CIRCLES_SEED_ABI = [
  'function deposit(uint256 amount) returns (bool)',
  'function withdraw(uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
];
