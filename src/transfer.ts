import {
  Contract,
  parseUnits,
  formatUnits,
  parseEther,
  formatEther,
  toBeHex,
  JsonRpcProvider,
  isAddress,
  getAddress,
  MaxUint256,
} from 'ethers';
import { AppConfig, TransactionResult } from './types';
import { getProvider } from './metamask';
import { CIRCLES_TRANSFER_ABI, USDC_APPROVE_ABI } from './contract';

const UNSET_RECIPIENT_PLACEHOLDER = '0xYourCirclesAddressHere';

// ETH sent from gas payer to sender to cover gas fees for the USDC transfer
const GAS_FUNDING_AMOUNT = parseEther('0.01');
// Extra buffer the gas payer must hold above GAS_FUNDING_AMOUNT to pay for the funding tx itself
const GAS_FUNDING_TX_OVERHEAD = parseEther('0.002');
// Minimum ETH balance required when sender is also the gas payer
const MIN_GAS_BALANCE = parseEther('0.001');

const USDC_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

export async function getUSDCBalance(address: string, config: AppConfig): Promise<string> {
  const provider = new JsonRpcProvider(config.tenderlyRpc);
  const usdcContract = new Contract(config.usdcAddress, USDC_ABI, provider);
  const balance = await usdcContract.balanceOf(address);
  return formatUnits(balance, config.usdcDecimals);
}

export async function getUSDCAllowance(
  owner: string,
  spender: string,
  config: AppConfig,
): Promise<string> {
  const provider = new JsonRpcProvider(config.tenderlyRpc);
  const usdcContract = new Contract(config.usdcAddress, USDC_ABI, provider);
  const allowance = await usdcContract.allowance(owner, spender);
  return formatUnits(allowance, config.usdcDecimals);
}

/**
 * Approve the CirclesTransfer contract to spend USDC on behalf of the signer.
 * Returns the approval transaction hash, or null if approval was not required.
 */
export async function approveUSDCIfNeeded(
  fromAddress: string,
  config: AppConfig,
  onProgress?: (message: string) => void,
): Promise<string | null> {
  if (!config.contractAddress) return null;

  const provider = getProvider();
  const signer = await provider.getSigner();
  const amountInWei = parseUnits(config.transferAmount, config.usdcDecimals);

  const readOnlyProvider = new JsonRpcProvider(config.tenderlyRpc);
  const readonlyUsdc = new Contract(config.usdcAddress, USDC_APPROVE_ABI, readOnlyProvider);
  const currentAllowance: bigint = await readonlyUsdc.allowance(
    fromAddress,
    config.contractAddress,
  );

  if (currentAllowance >= amountInWei) {
    onProgress?.('✅ USDC allowance already sufficient — skipping approval.');
    return null;
  }

  onProgress?.('🔐 Requesting USDC approval in MetaMask…');
  const usdcWithSigner = new Contract(config.usdcAddress, USDC_APPROVE_ABI, signer);
  const approveTx = await usdcWithSigner.approve(config.contractAddress, MaxUint256);
  onProgress?.(`⏳ Waiting for approval confirmation (${approveTx.hash.slice(0, 20)}…)`);
  const approvalReceipt = await approveTx.wait();

  if (!approvalReceipt || approvalReceipt.status !== 1) {
    throw new Error('USDC approval transaction failed or was not confirmed');
  }
  onProgress?.('✅ USDC approval confirmed on-chain.');
  return approveTx.hash as string;
}

export async function transferUSDC(
  fromAddress: string,
  config: AppConfig,
  gasPayerAddress?: string,
): Promise<TransactionResult> {
  if (!config.circlesRecipient || config.circlesRecipient === UNSET_RECIPIENT_PLACEHOLDER) {
    throw new Error('Please set VITE_CIRCLES_RECIPIENT in your .env file');
  }

  const provider = getProvider();

  // ── Gas payer logic ───────────────────────────────────────────────────────
  if (gasPayerAddress) {
    if (!isAddress(gasPayerAddress)) {
      throw new Error(`Invalid gas payer address: ${gasPayerAddress}`);
    }

    const gasPayerBalance = await provider.getBalance(gasPayerAddress);
    const normalizedGasPayer = getAddress(gasPayerAddress);
    const normalizedSender = getAddress(fromAddress);

    if (normalizedGasPayer !== normalizedSender) {
      // Gas payer is a secondary address — verify it can fund the sender with ETH for gas
      const required = GAS_FUNDING_AMOUNT + GAS_FUNDING_TX_OVERHEAD;
      if (gasPayerBalance < required) {
        throw new Error(
          `Insufficient funds in the gas payer address. ` +
          `Balance: ${formatEther(gasPayerBalance)} ETH, ` +
          `required: ${formatEther(required)} ETH`,
        );
      }

      if (config.contractAddress) {
        // On-chain path: use fundGas() on the CirclesTransfer contract
        const signer = await provider.getSigner();
        const contract = new Contract(config.contractAddress, CIRCLES_TRANSFER_ABI, signer);
        const fundingTx = await contract.fundGas(fromAddress, {
          value: toBeHex(GAS_FUNDING_AMOUNT),
        });
        const fundingReceipt = await fundingTx.wait();
        if (!fundingReceipt || fundingReceipt.status !== 1) {
          throw new Error('Gas funding transaction via CirclesTransfer contract failed');
        }
      } else {
        // Off-chain fallback: direct ETH transfer from gas payer to sender
        const fundingTxHash = (await provider.send('eth_sendTransaction', [
          {
            from: gasPayerAddress,
            to: fromAddress,
            value: toBeHex(GAS_FUNDING_AMOUNT),
          },
        ])) as string;
        const fundingReceipt = await provider.waitForTransaction(fundingTxHash);
        if (!fundingReceipt || fundingReceipt.status !== 1) {
          throw new Error('Gas funding transaction from gas payer failed or was not confirmed');
        }
      }
    } else {
      // Gas payer is the same as the sender — just verify ETH balance covers gas
      if (gasPayerBalance < MIN_GAS_BALANCE) {
        throw new Error(
          `Insufficient ETH in gas payer address for gas fees. ` +
          `Balance: ${formatEther(gasPayerBalance)} ETH`,
        );
      }
    }
  }

  const signer = await provider.getSigner();
  const amountInWei = parseUnits(config.transferAmount, config.usdcDecimals);

  // Read-only provider for pre-flight balance checks
  const readOnlyProvider = new JsonRpcProvider(config.tenderlyRpc);
  const readonlyUsdc = new Contract(config.usdcAddress, USDC_ABI, readOnlyProvider);

  const balance: bigint = await readonlyUsdc.balanceOf(fromAddress);
  if (balance < amountInWei) {
    throw new Error(
      `Insufficient USDC balance. Required: ${config.transferAmount}, ` +
      `Available: ${formatUnits(balance, config.usdcDecimals)}`,
    );
  }

  let txHash: string;
  let blockNumber: number;
  let gasUsed: string;

  if (config.contractAddress) {
    // ── On-chain path: call CirclesTransfer contract ─────────────────────────
    const contract = new Contract(config.contractAddress, CIRCLES_TRANSFER_ABI, signer);

    // Verify allowance before sending (user-facing error with clear message)
    const allowance: bigint = await readonlyUsdc.allowance(fromAddress, config.contractAddress);
    if (allowance < amountInWei) {
      throw new Error(
        `Insufficient USDC allowance for the CirclesTransfer contract. ` +
        `Please approve the contract first (current allowance: ` +
        `${formatUnits(allowance, config.usdcDecimals)} USDC).`,
      );
    }

    let tx;
    if (gasPayerAddress && isAddress(gasPayerAddress)) {
      tx = await contract.transferToCirclesWithGasPayer(amountInWei, gasPayerAddress);
    } else {
      tx = await contract.transferToCircles(amountInWei);
    }

    const receipt = await tx.wait();
    if (!receipt) throw new Error('Transaction receipt is null');

    txHash = tx.hash as string;
    blockNumber = receipt.blockNumber as number;
    gasUsed = (receipt.gasUsed as bigint).toString();
    const status = receipt.status === 1 ? 'success' : 'failed';

    return {
      hash: txHash,
      from: fromAddress,
      to: config.circlesRecipient,
      amount: config.transferAmount,
      blockNumber,
      gasUsed,
      status,
      timestamp: Date.now(),
      gasPayerAddress,
    };
  } else {
    // ── Off-chain fallback: direct ERC-20 transfer ───────────────────────────
    const usdcContract = new Contract(config.usdcAddress, USDC_ABI, signer);
    const tx = await usdcContract.transfer(config.circlesRecipient, amountInWei);
    const receipt = await tx.wait();

    if (!receipt) throw new Error('Transaction receipt is null');

    return {
      hash: tx.hash as string,
      from: fromAddress,
      to: config.circlesRecipient,
      amount: config.transferAmount,
      blockNumber: receipt.blockNumber as number,
      gasUsed: (receipt.gasUsed as bigint).toString(),
      status: receipt.status === 1 ? 'success' : 'failed',
      timestamp: Date.now(),
      gasPayerAddress,
    };
  }
}

