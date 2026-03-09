import { ethers } from 'hardhat';

/**
 * Deploy the CirclesTransfer smart contract to the configured network.
 *
 * Required environment variables:
 *   CIRCLES_RECIPIENT  – Circles network recipient address
 *
 * Optional (defaults to Ethereum mainnet USDC if omitted):
 *   USDC_ADDRESS       – USDC ERC-20 token contract address
 *
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network sepolia
 */
async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying CirclesTransfer with account:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Deployer ETH balance:', ethers.formatEther(balance), 'ETH');

  // USDC on Ethereum mainnet; override via env for testnets (e.g. mock USDC)
  const usdcAddress =
    process.env.USDC_ADDRESS ?? '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

  const circlesRecipient = process.env.CIRCLES_RECIPIENT ?? '';
  if (!circlesRecipient || circlesRecipient === '0xYourCirclesAddressHere') {
    throw new Error(
      'Please set CIRCLES_RECIPIENT in your .env file before deploying.',
    );
  }

  console.log('USDC address:       ', usdcAddress);
  console.log('Circles recipient:  ', circlesRecipient);

  const CirclesTransfer = await ethers.getContractFactory('CirclesTransfer');
  const contract = await CirclesTransfer.deploy(usdcAddress, circlesRecipient);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log('\n✅ CirclesTransfer deployed to:', address);
  console.log(
    '\nAdd this to your .env:\n  VITE_CONTRACT_ADDRESS=' + address,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
