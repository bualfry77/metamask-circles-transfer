import { BrowserProvider, Contract, parseUnits, formatUnits, JsonRpcProvider } from 'ethers';
import { CONFIG, USDC_ABI } from './config';
import { EthereumProvider, TransactionResult } from './types';

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

/**
 * Append a line to the on-page output element and also log to console
 */
let outputEl: HTMLElement | null = null;

function log(message: string): void {
  console.log(message);
  if (!outputEl) outputEl = document.getElementById('output');
  if (outputEl) {
    outputEl.textContent += message + '\n';
    outputEl.scrollTop = outputEl.scrollHeight;
  }
}

/**
 * Check if MetaMask is installed
 */
function isMetaMaskInstalled(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.ethereum !== 'undefined' &&
    window.ethereum.isMetaMask === true
  );
}

/**
 * Connect to MetaMask and get user account
 */
async function connectMetaMask(): Promise<string> {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed. Please install it from https://metamask.io');
  }

  const accounts = (await window.ethereum!.request({
    method: 'eth_requestAccounts',
  })) as string[];

  if (!accounts || accounts.length === 0) {
    throw new Error('No accounts found. Please unlock MetaMask.');
  }

  const account = accounts[0]!;
  log(`✅ Connected: ${account}`);

  return account;
}

/**
 * Get USDC balance for an address
 */
async function getUSDCBalance(address: string): Promise<string> {
  const provider = new JsonRpcProvider(CONFIG.TENDERLY_RPC);
  const usdcContract = new Contract(CONFIG.USDC_ADDRESS, USDC_ABI, provider);

  const balance = await usdcContract.balanceOf(address);
  const formattedBalance = formatUnits(balance, CONFIG.USDC_DECIMALS);

  log(`💰 USDC Balance: ${formattedBalance} USDC`);

  return formattedBalance;
}

/**
 * Transfer 19,800 USDC from MetaMask to Circles
 */
async function transferUSDCToCircles(fromAddress: string): Promise<TransactionResult> {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed.');
  }

  if (CONFIG.CIRCLES_RECIPIENT === '0xYourCirclesAddressHere') {
    throw new Error('❌ Please set CIRCLES_RECIPIENT in .env file');
  }

  log(`\n🚀 Initiating transfer of ${CONFIG.TRANSFER_AMOUNT} USDC...`);
  log(`📤 From: ${fromAddress}`);
  log(`📥 To (Circles): ${CONFIG.CIRCLES_RECIPIENT}`);

  // Create provider and signer from MetaMask
  const provider = new BrowserProvider(window.ethereum!);
  const signer = await provider.getSigner();

  // Create USDC contract instance with signer
  const usdcContract = new Contract(CONFIG.USDC_ADDRESS, USDC_ABI, signer);

  // Convert amount to Wei (USDC has 6 decimals)
  const amountInWei = parseUnits(CONFIG.TRANSFER_AMOUNT, CONFIG.USDC_DECIMALS);

  log(`\n⏳ Waiting for MetaMask confirmation...`);

  // Send transfer transaction
  const tx = await usdcContract.transfer(CONFIG.CIRCLES_RECIPIENT, amountInWei);

  log(`✅ Transaction submitted!`);
  log(`📋 Hash: ${tx.hash}`);

  log(`⏳ Waiting for confirmation...`);

  // Wait for confirmation
  const receipt = await tx.wait();

  if (!receipt) {
    throw new Error('Transaction receipt is null');
  }

  const result: TransactionResult = {
    hash: tx.hash,
    from: fromAddress,
    to: CONFIG.CIRCLES_RECIPIENT,
    amount: CONFIG.TRANSFER_AMOUNT,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
    status: receipt.status === 1 ? 'success' : 'failed',
  };

  log(`\n🎉 Transfer ${result.status.toUpperCase()}!`);
  log(`📊 Block: ${result.blockNumber}`);
  log(`⛽ Gas Used: ${result.gasUsed}`);

  return result;
}

/**
 * Setup MetaMask event listeners
 */
function setupEventListeners(): void {
  if (!isMetaMaskInstalled()) return;

  window.ethereum!.on('accountsChanged', (...args: unknown[]) => {
    if (Array.isArray(args[0])) {
      const accounts = args[0] as string[];
      log(`👤 Account changed to: ${accounts[0]}`);
    }
  });

  window.ethereum!.on('chainChanged', (chainId: unknown) => {
    log(`🔗 Network changed to Chain ID: ${parseInt(chainId as string, 16)}`);
  });
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  if (outputEl) outputEl.textContent = '';

  log('════════════════════════════════════════════════');
  log('  MetaMask → Circles USDC Transfer');
  log('  Amount: 19,800 USDC');
  log('════════════════════════════════════════════════\n');

  const btn = document.getElementById('transfer-btn') as HTMLButtonElement | null;
  if (btn) btn.disabled = true;

  try {
    // Setup listeners
    setupEventListeners();

    // Connect to MetaMask
    log('🔌 Connecting to MetaMask...');
    const userAccount = await connectMetaMask();

    // Check balance
    await getUSDCBalance(userAccount);

    // Perform transfer
    const result = await transferUSDCToCircles(userAccount);

    log('\n📄 Transaction Details:');
    log(`   Hash: ${result.hash}`);
    log(`   From: ${result.from}`);
    log(`   To: ${result.to}`);
    log(`   Amount: ${result.amount} USDC`);
    log(`   Status: ${result.status}\n`);
  } catch (error) {
    if (error instanceof Error) {
      log(`\n❌ Error: ${error.message}`);
      console.error(error);
    } else {
      log('❌ Unknown error occurred');
      console.error(error);
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Wire up the transfer button when the DOM is ready
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    outputEl = document.getElementById('output');
    const btn = document.getElementById('transfer-btn');
    if (btn) {
      btn.addEventListener('click', () => { main().catch(console.error); });
    }
  });
}