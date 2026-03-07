import { BrowserProvider, Contract, parseUnits, formatUnits, JsonRpcProvider } from 'ethers';
import { CONFIG, USDC_ABI, CIRCLES_SEED_ABI } from './config';
import { EthereumProvider, TransactionResult } from './types';

declare global {
  interface Window {
    ethereum?: EthereumProvider;
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

  console.log('🔌 Connecting to MetaMask...');

  const accounts = (await window.ethereum!.request({
    method: 'eth_requestAccounts',
  })) as string[];

  if (!accounts || accounts.length === 0) {
    throw new Error('No accounts found. Please unlock MetaMask.');
  }

  const account = accounts[0]!;
  console.log(`✅ Connected: ${account}`);

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

  console.log(`💰 USDC Balance: ${formattedBalance} USDC`);

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

  console.log(`\n🚀 Initiating transfer of ${CONFIG.TRANSFER_AMOUNT} USDC...`);
  console.log(`📤 From: ${fromAddress}`);
  console.log(`📥 To (Circles): ${CONFIG.CIRCLES_RECIPIENT}`);

  // Create provider and signer from MetaMask
  const provider = new BrowserProvider(window.ethereum!);
  const signer = await provider.getSigner();

  // Create USDC contract instance with signer
  const usdcContract = new Contract(CONFIG.USDC_ADDRESS, USDC_ABI, signer);

  // Convert amount to Wei (USDC has 6 decimals)
  const amountInWei = parseUnits(CONFIG.TRANSFER_AMOUNT, CONFIG.USDC_DECIMALS);

  console.log(`\n⏳ Waiting for MetaMask confirmation...`);

  // Send transfer transaction
  const tx = await usdcContract.transfer(CONFIG.CIRCLES_RECIPIENT, amountInWei);

  console.log(`✅ Transaction submitted!`);
  console.log(`📋 Hash: ${tx.hash}`);

  console.log(`⏳ Waiting for confirmation...`);

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

  console.log(`\n🎉 Transfer ${result.status.toUpperCase()}!`);
  console.log(`📊 Block: ${result.blockNumber}`);
  console.log(`⛽ Gas Used: ${result.gasUsed}`);

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
      console.log(`👤 Account changed to: ${accounts[0]}`);
    }
  });

  window.ethereum!.on('chainChanged', (chainId: unknown) => {
    console.log(`🔗 Network changed to Chain ID: ${parseInt(chainId as string, 16)}`);
  });
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  console.log('════════════════════════════════════════════════');
  console.log('  MetaMask → Circles USDC Transfer');
  console.log('  Amount: 19,800 USDC');
  console.log('════════════════════════════════════════════════\n');

  try {
    // Setup listeners
    setupEventListeners();

    // Connect to MetaMask
    const userAccount = await connectMetaMask();

    // Check balance
    await getUSDCBalance(userAccount);

    // Perform transfer
    const result = await transferUSDCToCircles(userAccount);

    console.log('\n📄 Transaction Details:');
    console.log(`   Hash: ${result.hash}`);
    console.log(`   From: ${result.from}`);
    console.log(`   To: ${result.to}`);
    console.log(`   Amount: ${result.amount} USDC`);
    console.log(`   Status: ${result.status}\n`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n❌ Error: ${error.message}`);
    } else {
      console.error('❌ Unknown error occurred');
    }
    if (typeof process !== 'undefined' && typeof process.exit === 'function') {
      process.exit(1);
    }
  }
}

// Run if in browser or Node.js
if (typeof window !== 'undefined') {
  main();
}