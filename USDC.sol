// SPDX-License-Identifier: MIT
// This is the USDC contract implementing mint and burn functionality.
// Este es el contrato de USDC que implementa la funcionalidad de acuñación y quema.
// Ce contrat USDC implémente la fonctionnalité de mint et burn.

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract USDC is ERC20, Ownable {
    constructor() ERC20("USD Coin", "USDC") {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}