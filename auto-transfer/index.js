import 'dotenv/config';
import { ethers } from 'ethers';

const {
  RPC_URL,
  PRIVATE_KEY,
  CIRCLES_RECIPIENT,
  USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  TRANSFER_AMOUNT = '19800',
} = process.env;

const USDC_DECIMALS = 6;
const USDC_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
];

async function main() {
  if (!RPC_URL) throw new Error('RPC_URL is not set in .env');
  if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY is not set in .env');
  if (!CIRCLES_RECIPIENT) throw new Error('CIRCLES_RECIPIENT is not set in .env');

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, wallet);

  const senderAddress = wallet.address;
  console.log(`Sender:    ${senderAddress}`);
  console.log(`Recipient: ${CIRCLES_RECIPIENT}`);
  console.log(`Amount:    ${TRANSFER_AMOUNT} USDC`);

  const balance = await usdcContract.balanceOf(senderAddress);
  const balanceFormatted = ethers.formatUnits(balance, USDC_DECIMALS);
  console.log(`Balance:   ${balanceFormatted} USDC`);

  const amountWei = ethers.parseUnits(TRANSFER_AMOUNT, USDC_DECIMALS);
  if (balance < amountWei) {
    throw new Error(
      `Insufficient USDC balance. Required: ${TRANSFER_AMOUNT}, Available: ${balanceFormatted}`,
    );
  }

  console.log('Submitting transfer...');
  const tx = await usdcContract.transfer(CIRCLES_RECIPIENT, amountWei);
  console.log(`Transaction hash: ${tx.hash}`);

  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error('Transaction failed or was reverted');
  }

  console.log('Transfer successful!');
  console.log(`  Block:    ${receipt.blockNumber}`);
  console.log(`  Gas used: ${receipt.gasUsed.toString()}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
