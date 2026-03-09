/// <reference types="vite/client" />

import { AppConfig, TransactionResult, WalletState } from './types';
import {
  connectWallet,
  isMetaMaskInstalled,
  setupAccountChangeListener,
  setupChainChangeListener,
  addNetworkToMetaMask,
} from './metamask';
import { getUSDCBalance, transferUSDC } from './transfer';
import { formatAddress, formatAmount, formatTimestamp } from './utils';

const DEFAULT_TRANSFER_AMOUNT = '19800';

const CONFIG: AppConfig = {
  tenderlyRpc: import.meta.env.VITE_TENDERLY_RPC as string,
  tenderlyChainId: (() => { const id = parseInt(import.meta.env.VITE_TENDERLY_CHAIN_ID as string, 10); return Number.isNaN(id) ? 1 : id; })(),
  usdcAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  usdcDecimals: 6,
  circlesRecipient: import.meta.env.VITE_CIRCLES_RECIPIENT as string,
  transferAmount: DEFAULT_TRANSFER_AMOUNT,
};

let walletState: WalletState = { address: null, usdcBalance: '0', isConnected: false };
const transactions: TransactionResult[] = [];

function log(message: string): void {
  console.log(message);
  const outputEl = document.getElementById('output');
  if (outputEl) {
    outputEl.textContent += message + '\n';
    outputEl.scrollTop = outputEl.scrollHeight;
  }
}

function updateWalletUI(): void {
  const walletInfo = document.getElementById('wallet-info');
  const addressEl = document.getElementById('wallet-address');
  const balanceEl = document.getElementById('wallet-balance');
  const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement | null;
  const transferBtn = document.getElementById('transfer-btn') as HTMLButtonElement | null;

  if (walletState.isConnected && walletState.address) {
    if (walletInfo) walletInfo.style.display = 'block';
    if (addressEl) addressEl.textContent = formatAddress(walletState.address);
    if (balanceEl) balanceEl.textContent = `${formatAmount(walletState.usdcBalance)} USDC`;
    if (connectBtn) connectBtn.textContent = 'Connected ✓';
    if (transferBtn) transferBtn.disabled = false;
  } else {
    if (walletInfo) walletInfo.style.display = 'none';
    if (connectBtn) connectBtn.textContent = 'Connect MetaMask';
    if (transferBtn) transferBtn.disabled = true;
  }
}

function updateTransactionHistory(): void {
  const historyEl = document.getElementById('tx-history');
  if (!historyEl) return;

  if (transactions.length === 0) {
    historyEl.innerHTML = '<p class="empty">No transactions yet.</p>';
    return;
  }

  historyEl.innerHTML = transactions
    .slice()
    .reverse()
    .map(
      (tx) => `
      <div class="tx-item ${tx.status}">
        <div class="tx-hash">
          <a href="https://etherscan.io/tx/${tx.hash}" target="_blank" rel="noopener noreferrer">
            ${tx.hash.slice(0, 20)}...
          </a>
        </div>
        <div class="tx-details">
          ${formatAmount(tx.amount)} USDC → Circles &nbsp;|&nbsp; Block ${tx.blockNumber} &nbsp;|&nbsp; <strong>${tx.status.toUpperCase()}</strong>
        </div>
        ${tx.gasPayerAddress ? `<div class="tx-details">⛽ Gas-Payer: ${formatAddress(tx.gasPayerAddress)}</div>` : ''}
        ${tx.approvalHash ? `<div class="tx-details">🔐 Approval: <a href="https://etherscan.io/tx/${tx.approvalHash}" target="_blank" rel="noopener noreferrer">${tx.approvalHash.slice(0, 20)}...</a></div>` : ''}
        <div class="tx-time">${formatTimestamp(tx.timestamp)}</div>
      </div>
    `,
    )
    .join('');
}

async function handleAddNetwork(): Promise<void> {
  const addNetworkBtn = document.getElementById('add-network-btn') as HTMLButtonElement | null;
  if (addNetworkBtn) addNetworkBtn.disabled = true;

  try {
    log('🌐 Adding Tenderly Virtual Network to MetaMask...');
    await addNetworkToMetaMask(CONFIG.tenderlyChainId, CONFIG.tenderlyRpc, 'Tenderly Virtual Network');
    log('✅ Network added / switched successfully!');
  } catch (error) {
    if (error instanceof Error) {
      log(`❌ Error: ${error.message}`);
    }
  } finally {
    if (addNetworkBtn) addNetworkBtn.disabled = false;
  }
}

async function handleConnect(): Promise<void> {
  const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement | null;
  if (connectBtn) connectBtn.disabled = true;

  try {
    log('🔌 Connecting to MetaMask...');
    walletState = await connectWallet();
    log(`✅ Connected: ${walletState.address}`);
    log('💰 Fetching USDC balance...');
    walletState.usdcBalance = await getUSDCBalance(walletState.address!, CONFIG);
    log(`💰 Balance: ${formatAmount(walletState.usdcBalance)} USDC`);
    updateWalletUI();
  } catch (error) {
    if (error instanceof Error) {
      log(`❌ Error: ${error.message}`);
    }
  } finally {
    if (connectBtn) connectBtn.disabled = false;
  }
}

async function handleTransfer(): Promise<void> {
  const transferBtn = document.getElementById('transfer-btn') as HTMLButtonElement | null;
  if (transferBtn) transferBtn.disabled = true;

  try {
    if (!walletState.isConnected || !walletState.address) {
      throw new Error('Please connect MetaMask first.');
    }

    const gasPayerInput = document.getElementById('gas-payer-address') as HTMLInputElement | null;
    const gasPayerAddress = gasPayerInput?.value.trim() || undefined;

    log(`\n🚀 Initiating transfer of ${CONFIG.transferAmount} USDC...`);
    log(`📤 From: ${walletState.address}`);
    log(`📥 To (Circles): ${CONFIG.circlesRecipient}`);

    if (gasPayerAddress) {
      log(`⛽ Gas Payer: ${gasPayerAddress}`);
    }

    log('⏳ Waiting for MetaMask confirmation...');

    const result = await transferUSDC(walletState.address, CONFIG, gasPayerAddress);
    transactions.push(result);

    log(`✅ Transfer ${result.status.toUpperCase()}!`);
    log(`📋 Hash: ${result.hash}`);
    log(`📊 Block: ${result.blockNumber}`);
    log(`⛽ Gas Used: ${result.gasUsed}`);

    walletState.usdcBalance = await getUSDCBalance(walletState.address, CONFIG);
    updateWalletUI();
    updateTransactionHistory();
  } catch (error) {
    if (error instanceof Error) {
      log(`❌ Error: ${error.message}`);
    }
  } finally {
    if (transferBtn) transferBtn.disabled = false;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  if (!isMetaMaskInstalled()) {
    log('⚠️  MetaMask is not installed. Please install it from https://metamask.io');
  }

  updateWalletUI();
  updateTransactionHistory();

  setupAccountChangeListener((accounts) => {
    if (accounts.length === 0) {
      walletState = { address: null, usdcBalance: '0', isConnected: false };
      log('👤 Wallet disconnected');
    } else {
      walletState.address = accounts[0]!;
      log(`👤 Account changed to: ${formatAddress(accounts[0]!)}`);
    }
    updateWalletUI();
  });

  setupChainChangeListener((chainId) => {
    log(`🔗 Network changed to Chain ID: ${chainId}`);
  });

  document.getElementById('add-network-btn')?.addEventListener('click', () => {
    handleAddNetwork().catch(console.error);
  });

  document.getElementById('connect-btn')?.addEventListener('click', () => {
    handleConnect().catch(console.error);
  });

  document.getElementById('transfer-btn')?.addEventListener('click', () => {
    handleTransfer().catch(console.error);
  });
});
