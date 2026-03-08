import { Contract, parseUnits, formatUnits, parseEther, formatEther, JsonRpcProvider, isAddress, getAddress } from 'ethers';
import { AppConfig, TransactionResult } from './types';
import { getProvider } from './metamask';

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

export async function transferUSDC(
  fromAddress: string,
  config: AppConfig,
  gasPayerAddress?: string,
): Promise<TransactionResult> {
  if (!config.circlesRecipient || config.circlesRecipient === UNSET_RECIPIENT_PLACEHOLDER) {
    throw new Error('Please set VITE_CIRCLES_RECIPIENT in your .env file');
  }

  const provider = getProvider();

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

      // Request the gas payer to send ETH to the sender to cover gas fees
      const fundingTxHash = (await provider.send('eth_sendTransaction', [
        {
          from: gasPayerAddress,
          to: fromAddress,
          value: '0x' + GAS_FUNDING_AMOUNT.toString(16),
        },
      ])) as string;

      // Wait for the funding transaction to be confirmed before proceeding
      const fundingReceipt = await provider.waitForTransaction(fundingTxHash);
      if (!fundingReceipt || fundingReceipt.status !== 1) {
        throw new Error('Gas funding transaction from gas payer failed or was not confirmed');
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
  const usdcContract = new Contract(config.usdcAddress, USDC_ABI, signer);
  const amountInWei = parseUnits(config.transferAmount, config.usdcDecimals);

  const tx = await usdcContract.transfer(config.circlesRecipient, amountInWei);
  const receipt = await tx.wait();

  if (!receipt) {
    throw new Error('Transaction receipt is null');
  }

  return {
    hash: tx.hash,
    from: fromAddress,
    to: config.circlesRecipient,
    amount: config.transferAmount,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
    status: receipt.status === 1 ? 'success' : 'failed',
    timestamp: Date.now(),
  };
}
