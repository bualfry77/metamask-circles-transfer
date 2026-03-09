/**
 * On-chain ABI for the CirclesTransfer smart contract.
 * Keep in sync with contracts/CirclesTransfer.sol.
 */
export const CIRCLES_TRANSFER_ABI = [
  // ─── Events ────────────────────────────────────────────────────────────────
  'event USDCTransferred(address indexed from, address indexed to, uint256 amount, address gasPayerAddress)',
  'event GasFunded(address indexed gasPayer, address indexed sender, uint256 amount)',
  'event RecipientUpdated(address indexed newRecipient)',
  'event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)',

  // ─── View / Pure ───────────────────────────────────────────────────────────
  'function owner() view returns (address)',
  'function usdc() view returns (address)',
  'function circlesRecipient() view returns (address)',
  'function allowanceForContract(address owner) view returns (uint256)',
  'function usdcBalanceOf(address account) view returns (uint256)',

  // ─── State-Changing ────────────────────────────────────────────────────────
  'function setCirclesRecipient(address recipient)',
  'function transferOwnership(address newOwner)',
  'function fundGas(address sender) payable',
  'function transferToCircles(uint256 amount)',
  'function transferToCirclesWithGasPayer(uint256 amount, address gasPayerAddress)',
] as const;

/** ABI fragment for the USDC ERC-20 approve call. */
export const USDC_APPROVE_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
] as const;
