import { Sdk, circlesConfig } from '@circles-sdk/sdk';
import { BrowserProviderContractRunner } from '@circles-sdk/adapter-ethers';
import { CirclesData } from '@circles-sdk/data';
import { CirclesAvatarStatus } from './types';

const GNOSIS_CHAIN_ID = 100;

// Read-only data client — queries the Circles RPC without requiring a wallet
const circlesData = new CirclesData(circlesConfig[GNOSIS_CHAIN_ID].circlesRpcUrl);

/**
 * Maps an AvatarRow type string to a human-readable label.
 */
function avatarTypeLabel(type: string): string {
  switch (type) {
    case 'CrcV2_RegisterHuman': return 'Human (v2)';
    case 'CrcV2_RegisterGroup': return 'Group (v2)';
    case 'CrcV2_RegisterOrganization': return 'Organization (v2)';
    case 'CrcV1_Signup': return 'Human (v1)';
    case 'CrcV1_OrganizationSignup': return 'Organization (v1)';
    default: return type;
  }
}

/**
 * Queries the Circles RPC to check whether `address` is registered and fetch its balances.
 * This is a read-only call and does NOT require MetaMask to be on Gnosis Chain.
 */
export async function checkCirclesStatus(address: string): Promise<CirclesAvatarStatus> {
  const avatarInfo = await circlesData.getAvatarInfo(address);

  if (!avatarInfo) {
    return { address, isRegistered: false };
  }

  const [v1Result, v2Result] = await Promise.allSettled([
    circlesData.getTotalBalance(address, true),
    circlesData.getTotalBalanceV2(address, true),
  ]);

  return {
    address,
    isRegistered: true,
    avatarType: avatarTypeLabel(avatarInfo.type),
    version: avatarInfo.version,
    hasV1: avatarInfo.hasV1,
    isHuman: avatarInfo.isHuman,
    balanceV1: v1Result.status === 'fulfilled' ? v1Result.value : '0',
    balanceV2: v2Result.status === 'fulfilled' ? v2Result.value : '0',
  };
}

/**
 * Initialises the Circles SDK using the MetaMask browser wallet.
 * MetaMask MUST be connected to Gnosis Chain (chainId 100) for write transactions.
 */
export async function initCirclesSdk(): Promise<Sdk> {
  const runner = new BrowserProviderContractRunner();
  await runner.init();
  return new Sdk(runner, circlesConfig[GNOSIS_CHAIN_ID]);
}

/**
 * Returns the amount of CRC currently available to mint for the connected avatar.
 * Requires an already-initialised SDK instance (MetaMask on Gnosis Chain).
 */
export async function getSdkMintableAmount(sdk: Sdk): Promise<number> {
  if (!sdk.contractRunner.address) return 0;
  const avatar = await sdk.getAvatar(sdk.contractRunner.address);
  return avatar.getMintableAmount();
}

/**
 * Mints all available CRC for the connected avatar.
 * Requires MetaMask to be on Gnosis Chain.
 */
export async function mintCirclesCRC(sdk: Sdk): Promise<string> {
  if (!sdk.contractRunner.address) {
    throw new Error('No wallet address found in the Circles SDK runner.');
  }
  const avatar = await sdk.getAvatar(sdk.contractRunner.address);
  const receipt = await avatar.personalMint();
  return receipt.hash;
}

/**
 * Adds Gnosis Chain to MetaMask so the user can use Circles write features.
 */
export async function addGnosisChainToMetaMask(): Promise<void> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask is not installed.');
  }
  await window.ethereum.request({
    method: 'wallet_addEthereumChain',
    params: [
      {
        chainId: '0x64',
        chainName: 'Gnosis Chain',
        nativeCurrency: { name: 'xDAI', symbol: 'XDAI', decimals: 18 },
        rpcUrls: ['https://rpc.gnosischain.com'],
        blockExplorerUrls: ['https://gnosisscan.io'],
      },
    ],
  });
}
