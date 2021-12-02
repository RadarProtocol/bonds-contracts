import { expect } from 'chai';
import { ethers } from 'ethers';
import {
    RadarBondsTreasury__factory,
    MockToken__factory,
    RadarBond__factory,
    RadarStaking__factory,
    Flasher__factory
} from "./../typechain";
import UniswapV2Pair from "./../utils/UniswapV2Pair.json";
import UniswapV2Router02 from "./../utils/UniswapV2Router02.json";
import UniswapV2Factory from "./../utils/UniswapV2Factory.json";

const snapshot = async () => {
    const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
    const deployer = ethers.Wallet.fromMnemonic(
        "test test test test test test test test test test test junk",
        `m/44'/60'/0'/0/0`
    ).connect(provider);
    const mockDAO = ethers.Wallet.fromMnemonic(
        "test test test test test test test test test test test junk",
        `m/44'/60'/0'/0/1`
    ).connect(provider);
    const otherAddress1 = ethers.Wallet.fromMnemonic(
        "test test test test test test test test test test test junk",
        `m/44'/60'/0'/0/2`
    ).connect(provider);
    const investor1 = ethers.Wallet.fromMnemonic(
        "test test test test test test test test test test test junk",
        `m/44'/60'/0'/0/3`
    ).connect(provider);
    const investor2 = ethers.Wallet.fromMnemonic(
        "test test test test test test test test test test test junk",
        `m/44'/60'/0'/0/4`
    ).connect(provider);
    

    // CUSTOM
    const tokenFactory = new MockToken__factory(deployer);
    const treasuryFactory = new RadarBondsTreasury__factory(deployer);
    const bondFactory = new RadarBond__factory(deployer);
    const stakingFactory = new RadarStaking__factory(deployer);
    const flasherFactory = new Flasher__factory(deployer);

    const mockToken = await tokenFactory.deploy();
    const treasury = await treasuryFactory.deploy(mockToken.address, mockDAO.address);
    const staking = await stakingFactory.deploy(
        mockToken.address,
        mockToken.address,
        2419200, // 28 days
        treasury.address
    );

    const uniswapRouterInterface = new ethers.utils.Interface(
        JSON.parse(JSON.stringify(UniswapV2Router02.abi))
    );
    const uniswapPairInterface = new ethers.utils.Interface(
        JSON.parse(JSON.stringify(UniswapV2Pair.abi))
    );
    const uniswapFactoryInterface = new ethers.utils.Interface(
        JSON.parse(JSON.stringify(UniswapV2Factory.abi))
    );

    const uniswapRouter = new ethers.Contract(
        UniswapV2Router02.address,
        uniswapRouterInterface,
        deployer
    );
    const uniswapFactory = new ethers.Contract(
        UniswapV2Factory.address,
        uniswapFactoryInterface,
        deployer
    );
    const WETH = await uniswapRouter.WETH();
    await uniswapFactory.createPair(WETH, mockToken.address);
    await mockToken.approve(uniswapRouter.address, ethers.utils.parseEther('1000'));
    await uniswapRouter.addLiquidityETH(
        mockToken.address,
        ethers.utils.parseEther('1000'),
        0,
        0,
        deployer.address,
        1000000000000000,
        {
            value: ethers.utils.parseEther('100')
        }
    );
    const bondAssetAddress = await uniswapFactory.getPair(WETH, mockToken.address);
    const bondAsset = new ethers.Contract(
        bondAssetAddress,
        uniswapPairInterface,
        deployer
    );
    const bond = await bondFactory.deploy(
        treasury.address,
        mockToken.address,
        bondAssetAddress,
        staking.address,
        ethers.utils.parseEther('100'), // Max reward of 100 RADAR
        432000, // 5 days
        1000, // 10%
        ethers.utils.parseEther('0.05') // 50% of initial price
    );
    const flasher = await flasherFactory.deploy(bond.address, UniswapV2Router02.address);

    // Register bond in treasury
    await mockToken.transfer(treasury.address, ethers.utils.parseEther('500'));
    await treasury.setBondData(
        bond.address,
        true,
        ethers.utils.parseEther('500'),
        100
    );

    return {
        deployer,
        otherAddress1,
        mockDAO,
        mockToken,
        investor1,
        investor2,
        treasury,
        bond,
        uniswapRouter,
        bondAsset,
        staking,
        flasher,
        WETH
    }
}

describe("Radar Bond", () => {
    it.skip("Access Control", async () => {
        const {
            otherAddress1,
            bond
        } = await snapshot();

        await expect(bond.connect(otherAddress1).changeTerms(
            0,
            0,
            0,
            0
        )).to.be.revertedWith(
            "Unauthorized"
        );

        await expect(bond.connect(otherAddress1).changeTreasury(
            ethers.constants.AddressZero
        )).to.be.revertedWith(
            "Unauthorized"
        );

        await expect(bond.connect(otherAddress1).changeStaking(
            ethers.constants.AddressZero
        )).to.be.revertedWith(
            "Unauthorized"
        );

        await expect(bond.connect(otherAddress1).setTrustedOrigin(
            ethers.constants.AddressZero,
            true
        )).to.be.revertedWith(
            "Unauthorized"
        );
    });
    it.skip("State Getters", async () => {
        const {
            bond,
            deployer,
            treasury,
            staking,
            mockToken,
            bondAsset
        } = await snapshot();

        const getManager = await bond.getManager();
        expect(getManager).to.equal(deployer.address);

        const getBondingTerms = await bond.getBondingTerms();
        expect(getBondingTerms.bondPayoutLimit).to.equal(ethers.utils.parseEther('100'));
        expect(getBondingTerms.vestingTime).to.equal(432000);
        expect(getBondingTerms.bondDiscount).to.equal(1000);
        expect(getBondingTerms.minPrice).to.equal(ethers.utils.parseEther('0.05'));

        const getTreasury = await bond.getTreasury();
        expect(getTreasury).to.equal(treasury.address);

        const getStaking = await bond.getStaking();
        expect(getStaking).to.equal(staking.address);

        const getPayoutAsset = await bond.getPayoutAsset();
        expect(getPayoutAsset).to.equal(mockToken.address);

        const getBondAsset = await bond.getBondAsset();
        expect(getBondAsset).to.equal(bondAsset.address);

        const getIsTrustedOrigin = await bond.getIsTrustedOrigin(ethers.constants.AddressZero);
        expect(getIsTrustedOrigin).to.equal(false);
    });
    it.skip("Change manager", async () => {
        const {
            bond,
            deployer,
            treasury,
            otherAddress1
        } = await snapshot();

        const getBondOwnerBefore = await bond.getManager();
        const getTreasuryOwnerBefore = await treasury.getOwner();
        expect(getBondOwnerBefore).to.equal(getTreasuryOwnerBefore).to.equal(deployer.address);

        await treasury.passOwnership(otherAddress1.address);
        await treasury.connect(otherAddress1).acceptOwnership();

        const getBondOwnerAfter = await bond.getManager();
        const getTreasuryOwnerAfter = await treasury.getOwner();
        expect(getBondOwnerAfter).to.equal(getTreasuryOwnerAfter).to.equal(otherAddress1.address);
    });
    it.skip("Flash Locking", async () => {
        const {
            otherAddress1,
            flasher,
            mockToken,
            uniswapRouter,
            bondAsset
        } = await snapshot();

        // Add liquidity
        await mockToken.transfer(otherAddress1.address, ethers.utils.parseEther('10'));
        await mockToken.connect(otherAddress1).approve(uniswapRouter.address, ethers.utils.parseEther('10'));

        await uniswapRouter.connect(otherAddress1).addLiquidityETH(
            mockToken.address,
            ethers.utils.parseEther('10'),
            0,
            0,
            otherAddress1.address,
            1000000000000000,
            {
                value: ethers.utils.parseEther('1')
            }
        );

        const baBalance = await bondAsset.balanceOf(otherAddress1.address);
        expect(baBalance).to.not.equal(0);

        await bondAsset.connect(otherAddress1).transfer(flasher.address, baBalance);

        await expect(flasher.connect(otherAddress1).doDoubleDeposit()).to.be.revertedWith(
            "Flash Protection"
        );

    });
    it.skip("Trusted Origin", async () => {
        const {
            deployer,
            otherAddress1,
            flasher,
            mockToken,
            uniswapRouter,
            bondAsset,
            bond
        } = await snapshot();

        // Add liquidity
        await mockToken.transfer(otherAddress1.address, ethers.utils.parseEther('10'));
        await mockToken.connect(otherAddress1).approve(uniswapRouter.address, ethers.utils.parseEther('10'));

        await uniswapRouter.connect(otherAddress1).addLiquidityETH(
            mockToken.address,
            ethers.utils.parseEther('10'),
            0,
            0,
            otherAddress1.address,
            1000000000000000,
            {
                value: ethers.utils.parseEther('1')
            }
        );

        const baBalance = await bondAsset.balanceOf(otherAddress1.address);
        expect(baBalance).to.not.equal(0);

        await bondAsset.connect(otherAddress1).transfer(flasher.address, baBalance);

        await bond.connect(deployer).setTrustedOrigin(otherAddress1.address, true);
        await flasher.connect(otherAddress1).doDoubleDeposit();
    });
    it.skip("Max bond calculation", async () => {
        const {
            bond,
            bondAsset,
            treasury,
            mockToken
        } = await snapshot();

        const lpTotalSupply = await bondAsset.totalSupply();
        const maxBondAmount = await bond.getMaxBondAmount();

        // Calculate how much LP for 100 RADAR payout
        // Deposit LP that is worth 90.9090909091 RADAR
        const token0 = await bondAsset.token0();
        const getReserves = await bondAsset.getReserves();
        const reserve = token0 == mockToken.address ? getReserves._reserve0 : getReserves._reserve1;
        const lpTokensRequired = ethers.utils.parseEther((90.9090909091 / 2).toString()).mul(lpTotalSupply).div(reserve);

        expect(lpTokensRequired).to.be.closeTo(maxBondAmount, 10**10);

        // Set allowance to 10 RADAR
        await treasury.setBondData(
            bond.address,
            true,
            ethers.utils.parseEther('2'),
            100
        );

        const maxBondAmount2 = await bond.getMaxBondAmount();

        // Deposit LP that is worth 1.8181818182 RADAR
        const lpTokensRequired2 = ethers.utils.parseEther((1.8181818182 / 2).toString()).mul(lpTotalSupply).div(reserve);

        expect(lpTokensRequired2).to.be.closeTo(maxBondAmount2, 10**10);
    });
    it.skip("Sandwich attack (minPrice)", async () => {
        const {
            mockToken,
            flasher,
            uniswapRouter
        } = await snapshot();

        // Add some liquidity
        await mockToken.approve(uniswapRouter.address, ethers.utils.parseEther('2'))
        await uniswapRouter.addLiquidityETH(
            mockToken.address,
            ethers.utils.parseEther('1'),
            0,
            0,
            flasher.address,
            100000000000000,
            {
                value: ethers.utils.parseEther('0.1')
            }
        );

        // Send tokens for price crash
        await mockToken.transfer(flasher.address, ethers.utils.parseEther('1'))

        await flasher.doFlashDeposit();

        // Add some liquidity
        await uniswapRouter.addLiquidityETH(
            mockToken.address,
            ethers.utils.parseEther('1'),
            0,
            0,
            flasher.address,
            100000000000000,
            {
                value: ethers.utils.parseEther('0.1')
            }
        );

        // Send tokens for price crash
        await mockToken.transfer(flasher.address, ethers.utils.parseEther('1020'))

        await expect(flasher.doFlashDeposit()).to.be.revertedWith(
            "Price too low for bond minting"
        );
    });
    it.skip("Change Terms", async () => {
        const {
            bond
        } = await snapshot();

        await bond.changeTerms(
            1000,
            4200,
            500,
            100000000
        );

        const getBondingTerms = await bond.getBondingTerms();
        expect(getBondingTerms.bondPayoutLimit).to.equal(1000);
        expect(getBondingTerms.vestingTime).to.equal(4200);
        expect(getBondingTerms.bondDiscount).to.equal(500);
        expect(getBondingTerms.minPrice).to.equal(100000000);
    });
    it.skip("Change Treasury", async () => {
        const {
            bond
        } = await snapshot();

        await bond.changeTreasury(ethers.constants.AddressZero);

        const getTreasury = await bond.getTreasury();
        expect(getTreasury).to.equal(ethers.constants.AddressZero);
    });
    it.skip("Change Staking", async () => {
        const {
            bond
        } = await snapshot();

        await bond.changeStaking(ethers.constants.AddressZero);

        const getStaking = await bond.getStaking();
        expect(getStaking).to.equal(ethers.constants.AddressZero);
    });
    it.skip("Reward calculation", async () => {
        const {
            bond,
            mockToken,
            otherAddress1,
            uniswapRouter,
            bondAsset
        } = await snapshot();

        // default 10% reward
        // if I deposit 10 RADAR into LP and 1 ETH I should get rewarded 22 RADAR

        const mustBeZero = await bondAsset.balanceOf(otherAddress1.address);
        expect(mustBeZero).to.equal(0);

        await mockToken.transfer(otherAddress1.address, ethers.utils.parseEther('10'));

        await mockToken.connect(otherAddress1).approve(uniswapRouter.address, ethers.utils.parseEther('10'));
        await uniswapRouter.connect(otherAddress1).addLiquidityETH(
            mockToken.address,
            ethers.utils.parseEther('10'),
            0,
            0,
            otherAddress1.address,
            100000000000000,
            {
                value: ethers.utils.parseEther('1')
            }
        );

        const lpBalance = await bondAsset.balanceOf(otherAddress1.address);
        const estimatedReward = await bond.estimateReward(lpBalance);

        expect(estimatedReward).to.be.closeTo(ethers.utils.parseEther('22'), 10);
    });
    it.skip("Bond slippage protection", async () => {
        const {
            otherAddress1,
            mockToken,
            bondAsset,
            uniswapRouter,
            bond,
            WETH,
            deployer
        } = await snapshot();

        const SLIPPAGE_TOLERANCE = 1; // 1%

        await mockToken.transfer(otherAddress1.address, ethers.utils.parseEther('10'));

        await mockToken.connect(otherAddress1).approve(uniswapRouter.address, ethers.utils.parseEther('10'));
        await uniswapRouter.connect(otherAddress1).addLiquidityETH(
            mockToken.address,
            ethers.utils.parseEther('10'),
            0,
            0,
            otherAddress1.address,
            100000000000000,
            {
                value: ethers.utils.parseEther('1')
            }
        );

        const lpBalance = await bondAsset.balanceOf(otherAddress1.address);
        const estimatedReward = await bond.estimateReward(lpBalance);

        const minReward = estimatedReward.sub(estimatedReward.div(ethers.BigNumber.from((100 / SLIPPAGE_TOLERANCE).toString())));
        console.log(`
        expected reward: ${estimatedReward}
        min reward slip: ${minReward}
        `);
        await bondAsset.connect(otherAddress1).approve(bond.address, lpBalance);
        await bond.connect(otherAddress1).bond(lpBalance, minReward);


        // Slippage fail
        await mockToken.transfer(otherAddress1.address, ethers.utils.parseEther('10'));

        await mockToken.connect(otherAddress1).approve(uniswapRouter.address, ethers.utils.parseEther('10'));
        await uniswapRouter.connect(otherAddress1).addLiquidityETH(
            mockToken.address,
            ethers.utils.parseEther('10'),
            0,
            0,
            otherAddress1.address,
            100000000000000,
            {
                value: ethers.utils.parseEther('1')
            }
        );

        const lpBalance2 = await bondAsset.balanceOf(otherAddress1.address);
        const estimatedReward2 = await bond.estimateReward(lpBalance);

        const minReward2 = estimatedReward2.sub(estimatedReward2.div(ethers.BigNumber.from((100 / SLIPPAGE_TOLERANCE).toString())));

        // Buy so reward is smaller
        await uniswapRouter.swapExactETHForTokens(
            0,
            [WETH, mockToken.address],
            deployer.address,
            1000000000000000,
            {
                value: ethers.utils.parseEther('10')
            }
        );

        const newEstimatedReward = await bond.estimateReward(lpBalance);

        console.log(`
        expected reward (before): ${estimatedReward2}
        min reward slip (before): ${minReward2}
        expected reward (after) : ${newEstimatedReward}
        `);

        await bondAsset.connect(otherAddress1).approve(bond.address, lpBalance2);
        await expect(bond.connect(otherAddress1).bond(lpBalance2, minReward2)).to.be.revertedWith(
            "Slippage minReward"
        );
    });
    it.skip("Bond maxBond revert", async () => {
        const {
            bond,
            bondAsset,
            treasury,
            mockToken,
            otherAddress1
        } = await snapshot();

        const lpTotalSupply = await bondAsset.totalSupply();
        const maxBondAmount = await bond.getMaxBondAmount();

        // Calculate how much LP for 100 RADAR payout
        // Deposit LP that is worth 90.9090909091 RADAR
        const token0 = await bondAsset.token0();
        const getReserves = await bondAsset.getReserves();
        const reserve = token0 == mockToken.address ? getReserves._reserve0 : getReserves._reserve1;
        const lpTokensRequired = ethers.utils.parseEther((90.9090909091 / 2).toString()).mul(lpTotalSupply).div(reserve);

        await expect(bond.connect(otherAddress1).bond(
            lpTokensRequired.add(ethers.utils.parseEther('1')),
            0
        )).to.be.revertedWith(
            "Bond too big"
        );

        // Set allowance to 10 RADAR
        await treasury.setBondData(
            bond.address,
            true,
            ethers.utils.parseEther('2'),
            100
        );

        const maxBondAmount2 = await bond.getMaxBondAmount();

        // Deposit LP that is worth 1.8181818182 RADAR
        const lpTokensRequired2 = ethers.utils.parseEther((1.8181818182 / 2).toString()).mul(lpTotalSupply).div(reserve);

        await expect(bond.connect(otherAddress1).bond(
            lpTokensRequired2.add(ethers.utils.parseEther('1')),
            0
        )).to.be.revertedWith(
            "Bond too big"
        );
    });
    it("Bonding and Redeeming (non-stake + stake)", async () => {
        const {
            bond,
            mockToken,
            WETH,
            uniswapRouter,
            investor1,
            investor2,
            staking,
            bondAsset
        } = await snapshot();

        // Buy tokens
        await uniswapRouter.connect(investor1).swapExactETHForTokens(
            0,
            [WETH, mockToken.address],
            investor1.address,
            10000000000000,
            {
                value: ethers.utils.parseEther('1')
            }
        );
        await uniswapRouter.connect(investor2).swapExactETHForTokens(
            0,
            [WETH, mockToken.address],
            investor2.address,
            10000000000000,
            {
                value: ethers.utils.parseEther('2')
            }
        );

        // Get balances
        const investor1TokenBal = await mockToken.balanceOf(investor1.address);
        const investor2TokenBal = await mockToken.balanceOf(investor2.address);

        // Approve
        await mockToken.connect(investor1).approve(uniswapRouter.address, investor1TokenBal);
        await mockToken.connect(investor2).approve(uniswapRouter.address, investor2TokenBal);

        const reserves = await bondAsset.getReserves();
        const token0 = await bondAsset.token0();
        const price = token0 == mockToken.address ? 
            reserves._reserve1.mul(ethers.utils.parseEther('1')).div(reserves._reserve0) : 
            reserves._reserve0.mul(ethers.utils.parseEther('1')).div(reserves._reserve1);

        // Add Liquidity
        await uniswapRouter.connect(investor1).addLiquidityETH(
            mockToken.address,
            investor1TokenBal,
            0,
            0,
            investor1.address,
            100000000000,
            {
                value: investor1TokenBal.mul(price).div(ethers.utils.parseEther('1'))
            }
        );
        await uniswapRouter.connect(investor2).addLiquidityETH(
            mockToken.address,
            investor2TokenBal,
            0,
            0,
            investor2.address,
            100000000000,
            {
                value: investor2TokenBal.mul(price).div(ethers.utils.parseEther('1'))
            }
        );

        // Bond Assets
        const SLIPPAGE_TOLERANCE = 5; // 1%

        const investor1LpBal = await bondAsset.balanceOf(investor1.address);
        const investor2LpBal = await bondAsset.balanceOf(investor2.address);

        await bondAsset.connect(investor1).approve(bond.address, investor1LpBal);
        await bondAsset.connect(investor2).approve(bond.address, investor2LpBal);

        const estimatedRewardInvestor1 = ethers.utils.parseEther('22');
        const estimatedRewardInvestor2 = ethers.utils.parseEther('44');

        const actualRewardInvestor1 = await bond.estimateReward(investor1LpBal);
        const actualRewardInvestor2 = await bond.estimateReward(investor2LpBal);

        const minSlipInvestor1 = estimatedRewardInvestor1.sub(estimatedRewardInvestor1.div(ethers.BigNumber.from((100 / SLIPPAGE_TOLERANCE).toString())));
        const minSlipInvestor2 = estimatedRewardInvestor2.sub(estimatedRewardInvestor2.div(ethers.BigNumber.from((100 / SLIPPAGE_TOLERANCE).toString())));

        console.log(`
        Est. Reward Investor1: ${estimatedRewardInvestor1}
        Act. Reward Investor1: ${actualRewardInvestor1}
        Min. Reward Investor1: ${minSlipInvestor1}

        Est. Reward Investor2: ${estimatedRewardInvestor2}
        Act. Reward Investor2: ${actualRewardInvestor2}
        Min. Reward Investor2: ${minSlipInvestor2}
        `);

        const bondTxInvestor1 = await bond.connect(investor1).bond(investor1LpBal, minSlipInvestor1);
        const bondTxInvestor2 = await bond.connect(investor2).bond(investor2LpBal, minSlipInvestor2);

        const bondReceiptInvestor1 = await bondTxInvestor1.wait();
        const bondReceiptInvestor2 = await bondTxInvestor2.wait();

        const bondCreatedEventInvestor1 = bond.interface.parseLog(bondReceiptInvestor1.logs[bondReceiptInvestor1.logs.length - 1]);
        const bondCreatedEventInvestor2 = bond.interface.parseLog(bondReceiptInvestor2.logs[bondReceiptInvestor2.logs.length - 1]);

        const lblock = await investor1.provider.getBlock('latest');
        const finishVesting = lblock.timestamp + 432000;

        // args: [
        //     '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
        //     BigNumber { _hex: '0x2c9e195462a0bd68', _isBigNumber: true },
        //     BigNumber { _hex: '0x012a606abee3fb9849', _isBigNumber: true },
        //     BigNumber { _hex: '0x61ea01fe', _isBigNumber: true },
        //     owner: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
        //     bondedAssets: BigNumber { _hex: '0x2c9e195462a0bd68', _isBigNumber: true },
        //     payout: BigNumber { _hex: '0x012a606abee3fb9849', _isBigNumber: true },
        //     vestingDate: BigNumber { _hex: '0x61ea01fe', _isBigNumber: true }
        //   ]

        expect(bondCreatedEventInvestor1.args.vestingDate).to.be.closeTo(ethers.BigNumber.from(finishVesting.toString()), 10);
        expect(bondCreatedEventInvestor2.args.vestingDate).to.be.closeTo(ethers.BigNumber.from(finishVesting.toString()), 10);

        expect(bondCreatedEventInvestor1.args.owner).to.equal(investor1.address);
        expect(bondCreatedEventInvestor2.args.owner).to.equal(investor2.address);

        expect(bondCreatedEventInvestor1.args.bondedAssets).to.equal(investor1LpBal);
        expect(bondCreatedEventInvestor2.args.bondedAssets).to.equal(investor2LpBal);

        expect(bondCreatedEventInvestor1.args.payout.div(10**10)).to.be.closeTo(actualRewardInvestor1.div(10**10), 10**8);
        expect(bondCreatedEventInvestor2.args.payout.div(10**10)).to.be.closeTo(actualRewardInvestor2.div(10**10), 10**8);

        // TODO: CHECK REDEEMING
        // TODO: REMOVE SKIPS
    });
});