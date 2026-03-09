import { Contract, parseUnits, formatUnits, JsonRpcProvider, isAddress } from 'ethers';
import { AppConfig, TransactionResult } from './types';
import { getProvider } from './metamask';

const UNSET_RECIPIENT_PLACEHOLDER = '0xYourCirclesAddressHere';

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

export async function transferUSDC(
  fromAddress: string,
  config: AppConfig,
): Promise<TransactionResult> {
  if (!config.circlesRecipient || config.circlesRecipient === UNSET_RECIPIENT_PLACEHOLDER) {
    throw new Error('Please set VITE_CIRCLES_RECIPIENT in your .env file');
  }

  const provider = getProvider();
  const signer = await provider.getSigner();
  const usdcContract = new Contract(config.usdcAddress, USDC_ABI, signer);
  const amountInWei = parseUnits(config.transferAmount, config.usdcDecimals);

  // Read-only provider for pre-flight balance and allowance checks
  const readOnlyProvider = new JsonRpcProvider(config.tenderlyRpc);
  const readonlyContract = new Contract(config.usdcAddress, USDC_ABI, readOnlyProvider);

  // Check fromAddress has sufficient USDC balance
  const balance = await readonlyContract.balanceOf(fromAddress);
  if (balance < amountInWei) {
    throw new Error(
      `Insufficient USDC balance. Required: ${config.transferAmount}, Available: ${formatUnits(balance, config.usdcDecimals)}`,
    );
  }

  let approvalHash: string | undefined;

  // Handle optional gas-payer address
  if (config.gasPayerAddress) {
    if (!isAddress(config.gasPayerAddress)) {
      throw new Error(`Invalid gas-payer address: ${config.gasPayerAddress}`);
    }

    // Check existing allowance — approve if the gas payer is not yet authorised
    const currentAllowance = await readonlyContract.allowance(
      fromAddress,
      config.gasPayerAddress,
    );
    if (currentAllowance < amountInWei) {
      const approveTx = await usdcContract.approve(config.gasPayerAddress, amountInWei);
      const approveReceipt = await approveTx.wait();
      if (!approveReceipt || approveReceipt.status !== 1) {
        throw new Error('USDC approval transaction failed');
      }
      approvalHash = approveTx.hash;
    }
  }

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
    approvalHash,
    gasPayerAddress: config.gasPayerAddress,
  };
}
