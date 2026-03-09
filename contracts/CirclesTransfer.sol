// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CirclesTransfer
 * @notice On-chain helper for transferring USDC to a Circles network recipient.
 *         The sender must first approve this contract to spend their USDC, then
 *         call `transferToCircles`. A gas-payer may fund the sender's ETH balance
 *         via `fundGas` before the transfer is initiated.
 */
contract CirclesTransfer {
    // ─── Interfaces ──────────────────────────────────────────────────────────

    interface IERC20 {
        function transferFrom(address from, address to, uint256 amount) external returns (bool);
        function balanceOf(address account) external view returns (uint256);
        function allowance(address owner, address spender) external view returns (uint256);
    }

    // ─── State ────────────────────────────────────────────────────────────────

    address public owner;
    IERC20 public immutable usdc;
    address public circlesRecipient;

    // ─── Events ───────────────────────────────────────────────────────────────

    /// @notice Emitted when USDC is transferred to the Circles recipient.
    event USDCTransferred(
        address indexed from,
        address indexed to,
        uint256 amount,
        address gasPayerAddress
    );

    /// @notice Emitted when a gas payer forwards ETH to a sender.
    event GasFunded(address indexed gasPayer, address indexed sender, uint256 amount);

    /// @notice Emitted when the owner updates the Circles recipient address.
    event RecipientUpdated(address indexed newRecipient);

    /// @notice Emitted when ownership is transferred.
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error NotOwner();
    error ZeroAddress();
    error ZeroAmount();
    error RecipientNotSet();
    error USDCTransferFailed();
    error ETHTransferFailed();
    error InsufficientAllowance(uint256 required, uint256 actual);
    error InsufficientBalance(uint256 required, uint256 actual);

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    /**
     * @param _usdc             Address of the USDC ERC-20 token contract.
     * @param _circlesRecipient Initial Circles recipient address.
     */
    constructor(address _usdc, address _circlesRecipient) {
        if (_usdc == address(0)) revert ZeroAddress();
        if (_circlesRecipient == address(0)) revert ZeroAddress();
        owner = msg.sender;
        usdc = IERC20(_usdc);
        circlesRecipient = _circlesRecipient;
        emit RecipientUpdated(_circlesRecipient);
    }

    // ─── Owner Functions ─────────────────────────────────────────────────────

    /**
     * @notice Update the Circles recipient address.
     * @param _recipient New recipient address.
     */
    function setCirclesRecipient(address _recipient) external onlyOwner {
        if (_recipient == address(0)) revert ZeroAddress();
        circlesRecipient = _recipient;
        emit RecipientUpdated(_recipient);
    }

    /**
     * @notice Transfer ownership of this contract.
     * @param newOwner Address of the new owner.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ─── Gas-Payer Functions ──────────────────────────────────────────────────

    /**
     * @notice Gas-payer deposits ETH which is immediately forwarded to `sender`
     *         so the sender can cover transaction gas fees.
     * @param sender Address of the wallet that will execute the USDC transfer.
     */
    function fundGas(address sender) external payable {
        if (msg.value == 0) revert ZeroAmount();
        if (sender == address(0)) revert ZeroAddress();
        // Emit before external call (Checks-Effects-Interactions pattern)
        emit GasFunded(msg.sender, sender, msg.value);
        (bool success, ) = payable(sender).call{value: msg.value}("");
        if (!success) revert ETHTransferFailed();
    }

    // ─── Transfer Functions ───────────────────────────────────────────────────

    /**
     * @notice Transfer `amount` USDC from the caller to the Circles recipient.
     *         The caller must have previously approved this contract for at least
     *         `amount` USDC via the USDC token's `approve()` function.
     * @param amount Amount of USDC to transfer (in USDC's smallest unit, 6 decimals).
     */
    function transferToCircles(uint256 amount) external {
        _executeTransfer(amount, address(0));
    }

    /**
     * @notice Transfer `amount` USDC from the caller to the Circles recipient,
     *         recording the gas-payer address for transparency.
     * @param amount           Amount of USDC to transfer (6-decimal units).
     * @param gasPayerAddress  Address of the wallet that funded gas for this tx.
     */
    function transferToCirclesWithGasPayer(uint256 amount, address gasPayerAddress) external {
        if (gasPayerAddress == address(0)) revert ZeroAddress();
        _executeTransfer(amount, gasPayerAddress);
    }

    // ─── View Helpers ─────────────────────────────────────────────────────────

    /**
     * @notice Returns the USDC allowance that `owner` has granted this contract.
     */
    function allowanceForContract(address _owner) external view returns (uint256) {
        return usdc.allowance(_owner, address(this));
    }

    /**
     * @notice Returns the USDC balance of `account`.
     */
    function usdcBalanceOf(address account) external view returns (uint256) {
        return usdc.balanceOf(account);
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _executeTransfer(uint256 amount, address gasPayerAddress) internal {
        if (amount == 0) revert ZeroAmount();
        if (circlesRecipient == address(0)) revert RecipientNotSet();

        uint256 allowance = usdc.allowance(msg.sender, address(this));
        if (allowance < amount) revert InsufficientAllowance(amount, allowance);

        uint256 balance = usdc.balanceOf(msg.sender);
        if (balance < amount) revert InsufficientBalance(amount, balance);

        bool success = usdc.transferFrom(msg.sender, circlesRecipient, amount);
        if (!success) revert USDCTransferFailed();

        emit USDCTransferred(msg.sender, circlesRecipient, amount, gasPayerAddress);
    }

    // ─── Fallback ─────────────────────────────────────────────────────────────

    receive() external payable {}
}
