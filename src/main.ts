/// <reference types="vite/client" />

import { AppConfig, TransactionResult, WalletState } from './types';
import {
  connectWallet,
  isMetaMaskInstalled,
  setupAccountChangeListener,
  setupChainChangeListener,
  addNetworkToMetaMask,
} from './metamask';
import { getETHBalance, getUSDCBalance, transferUSDC } from './transfer';
import { formatAddress, formatAmount, formatTimestamp } from './utils';

const DEFAULT_TRANSFER_AMOUNT = '19980';

const CONFIG: AppConfig = {
  tenderlyRpc: import.meta.env.VITE_TENDERLY_RPC as string,
  tenderlyChainId: (() => { const id = parseInt(import.meta.env.VITE_TENDERLY_CHAIN_ID as string, 10); return Number.isNaN(id) || id === 1 ? 73571 : id; })(),
  usdcAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  usdcDecimals: 6,
  circlesRecipient: import.meta.env.VITE_CIRCLES_RECIPIENT as string,
  transferAmount: DEFAULT_TRANSFER_AMOUNT,
};

let walletState: WalletState = { address: null, usdcBalance: '0', ethBalance: '0', isConnected: false };
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
  const ethBalanceEl = document.getElementById('wallet-eth-balance');
  const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement | null;
  const transferBtn = document.getElementById('transfer-btn') as HTMLButtonElement | null;

  if (walletState.isConnected && walletState.address) {
    if (walletInfo) walletInfo.style.display = 'block';
    if (addressEl) addressEl.textContent = formatAddress(walletState.address);
    if (balanceEl) balanceEl.textContent = `${formatAmount(walletState.usdcBalance)} USDC`;
    if (ethBalanceEl) ethBalanceEl.textContent = `${parseFloat(walletState.ethBalance).toFixed(4)} ETH`;
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
    log('⟳ Fetching wallet balances...');
    [walletState.ethBalance, walletState.usdcBalance] = await Promise.all([
      getETHBalance(walletState.address!, CONFIG),
      getUSDCBalance(walletState.address!, CONFIG),
    ]);
    log(`⚡ ETH Balance: ${parseFloat(walletState.ethBalance).toFixed(4)} ETH`);
    log(`💰 USDC Balance: ${formatAmount(walletState.usdcBalance)} USDC`);
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
    walletState.ethBalance = await getETHBalance(walletState.address, CONFIG);
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

  // Pre-fill gas payer address from environment if configured
  const defaultGasPayer = import.meta.env.VITE_GAS_PAYER_ADDRESS as string | undefined;
  if (defaultGasPayer) {
    const gasPayerInput = document.getElementById('gas-payer-address') as HTMLInputElement | null;
    if (gasPayerInput) gasPayerInput.value = defaultGasPayer;
  }

  updateWalletUI();
  updateTransactionHistory();

  setupAccountChangeListener((accounts) => {
    if (accounts.length === 0) {
      walletState = { address: null, usdcBalance: '0', ethBalance: '0', isConnected: false };
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

  // Add Recipient modal
  const modal = document.getElementById('add-wallet-modal') as HTMLElement | null;

  document.getElementById('add-recipient-btn')?.addEventListener('click', () => {
    if (modal) modal.style.display = 'flex';
  });

  document.getElementById('modal-close-btn')?.addEventListener('click', () => {
    if (modal) modal.style.display = 'none';
  });

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  // Tab switching
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = (btn as HTMLElement).dataset.tab;
      tabBtns.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const apiTab = document.getElementById('tab-api');
      const fileTab = document.getElementById('tab-file');
      if (apiTab) apiTab.style.display = tab === 'api' ? 'block' : 'none';
      if (fileTab) fileTab.style.display = tab === 'file' ? 'block' : 'none';
    });
  });

  // Enable upload button when file selected
  document.getElementById('wallet-file-input')?.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    const uploadBtn = document.getElementById('upload-wallet-btn') as HTMLButtonElement | null;
    if (uploadBtn) uploadBtn.disabled = !(input.files && input.files.length > 0);
  });

  // "Add Circles Wallet" — save the entered address as the recipient
  document.getElementById('add-wallet-btn')?.addEventListener('click', () => {
    const addressInput = document.getElementById('recipient-address-input') as HTMLInputElement | null;
    const nameInput = document.getElementById('wallet-name-input') as HTMLInputElement | null;
    const amountInput = document.getElementById('advanced-amount-input') as HTMLInputElement | null;
    const address = addressInput?.value.trim() ?? '';
    const name = nameInput?.value.trim() ?? '';
    const amount = amountInput?.value.trim() ?? '';

    if (!address) {
      log('⚠️  Please enter a wallet address.');
      return;
    }

    CONFIG.circlesRecipient = address;
    const parsedAmount = Number(amount);
    if (amount && !Number.isNaN(parsedAmount) && parsedAmount > 0) {
      CONFIG.transferAmount = amount;
      const transferBtn = document.getElementById('transfer-btn') as HTMLButtonElement | null;
      if (transferBtn) transferBtn.textContent = `Transfer ${formatAmount(amount)} USDC`;
    }

    log(`✅ Recipient updated${name ? ` (${name})` : ''}: ${address}`);
    if (modal) modal.style.display = 'none';
    if (addressInput) addressInput.value = '';
    if (nameInput) nameInput.value = '';
    if (amountInput) amountInput.value = '';
  });
});
