/// <reference types="vite/client" />

import { AppConfig, TransactionResult, WalletState } from './types';
import {
  connectWallet,
  isMetaMaskInstalled,
  setupAccountChangeListener,
  setupChainChangeListener,
  addNetworkToMetaMask,
} from './metamask';
import { getETHBalance, getUSDCBalance, transferUSDC, getUSDCOwner, transferUSDCOwnership } from './transfer';
import { formatAddress, formatAmount, formatTimestamp } from './utils';
import {
  checkCirclesStatus,
  initCirclesSdk,
  getSdkMintableAmount,
  mintCirclesCRC,
  addGnosisChainToMetaMask,
} from './circles';
import type { Sdk } from '@circles-sdk/sdk';

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
let circlesSdk: Sdk | null = null;

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
  const claimOwnershipBtn = document.getElementById('claim-ownership-btn') as HTMLButtonElement | null;

  if (walletState.isConnected && walletState.address) {
    if (walletInfo) walletInfo.style.display = 'block';
    if (addressEl) addressEl.textContent = formatAddress(walletState.address);
    if (balanceEl) balanceEl.textContent = `${formatAmount(walletState.usdcBalance)} USDC`;
    if (ethBalanceEl) ethBalanceEl.textContent = `${parseFloat(walletState.ethBalance).toFixed(4)} ETH`;
    if (connectBtn) connectBtn.textContent = 'Connected ✓';
    if (transferBtn) transferBtn.disabled = false;
    if (claimOwnershipBtn) claimOwnershipBtn.disabled = false;
  } else {
    if (walletInfo) walletInfo.style.display = 'none';
    if (connectBtn) connectBtn.textContent = 'Connect MetaMask';
    if (transferBtn) transferBtn.disabled = true;
    if (claimOwnershipBtn) claimOwnershipBtn.disabled = true;
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

async function handleCheckCircles(): Promise<void> {
  const checkCirclesBtn = document.getElementById('check-circles-btn') as HTMLButtonElement | null;
  if (checkCirclesBtn) checkCirclesBtn.disabled = true;

  try {
    if (!walletState.isConnected || !walletState.address) {
      throw new Error('Please connect MetaMask first.');
    }

    log('\n🔵 Checking Circles status on Gnosis Chain...');
    const status = await checkCirclesStatus(walletState.address);

    const circlesInfoEl = document.getElementById('circles-info');
    const circlesStatusEl = document.getElementById('circles-status');

    if (!status.isRegistered) {
      log('ℹ️  Address is not registered on Circles.');
      if (circlesStatusEl) circlesStatusEl.textContent = 'Not registered on Circles';
      if (circlesInfoEl) {
        circlesInfoEl.style.display = 'block';
        circlesInfoEl.innerHTML = `
          <div>🔴 <strong>Status:</strong> Not registered on Circles</div>
          <div style="margin-top:0.4rem; color:#a0a0b0; font-size:0.85rem;">
            Visit <a href="https://aboutcircles.com" target="_blank" rel="noopener noreferrer" style="color:#6ab0f5;">aboutcircles.com</a> to sign up.
          </div>`;
      }
    } else {
      log(`✅ Registered on Circles!`);
      log(`   Type: ${status.avatarType}`);
      log(`   CRC v1 balance: ${status.balanceV1} CRC`);
      log(`   CRC v2 balance: ${status.balanceV2} CRC`);

      if (circlesInfoEl) {
        circlesInfoEl.style.display = 'block';
        circlesInfoEl.innerHTML = `
          <div>🟢 <strong>Status:</strong> Registered &nbsp;|&nbsp; ${status.avatarType}</div>
          <div>🪙 <strong>CRC v1:</strong> ${parseFloat(status.balanceV1 ?? '0').toFixed(2)} CRC</div>
          <div>🪙 <strong>CRC v2:</strong> ${parseFloat(status.balanceV2 ?? '0').toFixed(2)} CRC</div>`;

        if (status.isHuman) {
          const mintBtn = document.getElementById('mint-crc-btn') as HTMLButtonElement | null;
          if (mintBtn) mintBtn.style.display = 'inline-block';
        }
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      log(`❌ Circles check error: ${error.message}`);
    }
  } finally {
    if (checkCirclesBtn) checkCirclesBtn.disabled = false;
  }
}

async function handleAddGnosisChain(): Promise<void> {
  const addGnosisBtn = document.getElementById('add-gnosis-btn') as HTMLButtonElement | null;
  if (addGnosisBtn) addGnosisBtn.disabled = true;

  try {
    log('🌿 Adding Gnosis Chain to MetaMask...');
    await addGnosisChainToMetaMask();
    log('✅ Gnosis Chain added / switched successfully!');
  } catch (error) {
    if (error instanceof Error) {
      log(`❌ Error: ${error.message}`);
    }
  } finally {
    if (addGnosisBtn) addGnosisBtn.disabled = false;
  }
}

async function handleClaimOwnership(): Promise<void> {
  const claimBtn = document.getElementById('claim-ownership-btn') as HTMLButtonElement | null;
  if (claimBtn) claimBtn.disabled = true;

  try {
    if (!walletState.isConnected || !walletState.address) {
      throw new Error('Please connect MetaMask first.');
    }

    log('\n🔑 Fetching current USDC contract owner...');
    const currentOwner = await getUSDCOwner(CONFIG);
    log(`👤 Current owner: ${currentOwner}`);

    log(`⏳ Transferring USDC contract ownership to ${walletState.address}...`);
    log('⏳ Waiting for MetaMask confirmation...');
    const txHash = await transferUSDCOwnership(walletState.address, CONFIG);
    log(`✅ Ownership transferred! Tx hash: ${txHash}`);

    const ownerInfoEl = document.getElementById('ownership-info');
    if (ownerInfoEl) {
      ownerInfoEl.textContent = `Owner: ${walletState.address}`;
      ownerInfoEl.style.display = 'block';
    }
  } catch (error) {
    if (error instanceof Error) {
      log(`❌ Ownership transfer error: ${error.message}`);
    }
  } finally {
    if (claimBtn) claimBtn.disabled = false;
  }
}

async function handleMintCRC(): Promise<void> {  const mintCrcBtn = document.getElementById('mint-crc-btn') as HTMLButtonElement | null;
  if (mintCrcBtn) mintCrcBtn.disabled = true;

  try {
    if (!walletState.isConnected) {
      throw new Error('Please connect MetaMask first.');
    }

    log('\n🌱 Initialising Circles SDK (MetaMask must be on Gnosis Chain)...');
    circlesSdk = await initCirclesSdk();

    const mintable = await getSdkMintableAmount(circlesSdk);
    if (mintable <= 0) {
      log('ℹ️  No CRC available to mint right now.');
      return;
    }

    log(`⏳ Minting ${mintable.toFixed(2)} CRC — waiting for MetaMask confirmation...`);
    const txHash = await mintCirclesCRC(circlesSdk);
    log(`✅ CRC minted! Tx hash: ${txHash}`);
  } catch (error) {
    if (error instanceof Error) {
      log(`❌ Mint error: ${error.message}`);
    }
  } finally {
    if (mintCrcBtn) mintCrcBtn.disabled = false;
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

  document.getElementById('add-gnosis-btn')?.addEventListener('click', () => {
    handleAddGnosisChain().catch(console.error);
  });

  document.getElementById('check-circles-btn')?.addEventListener('click', () => {
    handleCheckCircles().catch(console.error);
  });

  document.getElementById('mint-crc-btn')?.addEventListener('click', () => {
    handleMintCRC().catch(console.error);
  });

  document.getElementById('claim-ownership-btn')?.addEventListener('click', () => {
    handleClaimOwnership().catch(console.error);
  });
});
