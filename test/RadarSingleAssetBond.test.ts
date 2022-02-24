import { expect } from 'chai';
import { ethers } from 'hardhat';
import UniswapV2Pair from "./../utils/UniswapV2Pair.json";
import UniswapV2Router02 from "./../utils/UniswapV2Router02.json";
import UniswapV2Factory from "./../utils/UniswapV2Factory.json";
import IWeth from './../utils/IWeth.json';

const snapshot = async () => {
    const [deployer, mockDAO, otherAddress1, investor1, investor2] = await ethers.getSigners();

    const tokenFactory = await ethers.getContractFactory("MockToken");
    const treasuryFactory = await ethers.getContractFactory("RadarBondsTreasury");
    const bondFactory = await ethers.getContractFactory("RadarSingleAssetBond");
    const stakingFactory = await ethers.getContractFactory("RadarStaking");
    const flasherFactory = await ethers.getContractFactory("Flasher");

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
    const priceLPAddress = await uniswapFactory.getPair(WETH, mockToken.address);
    const priceLPAsset = new ethers.Contract(
        priceLPAddress,
        uniswapPairInterface,
        deployer
    );
    const bond = await bondFactory.deploy(
        treasury.address,
        mockToken.address,
        WETH,
        staking.address,
        ethers.utils.parseEther('100'), // Max reward of 100 RADAR
        432000, // 5 days
        1000, // 10%
        priceLPAddress,
        ethers.utils.parseEther('0.05') // 50% of initial price
    );

    const wethInterface = new ethers.utils.Interface(
        JSON.parse(JSON.stringify(IWeth.abi))
    );

    const bondAsset = new ethers.Contract(
        WETH,
        wethInterface,
        deployer
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
        WETH,
        priceLPAddress
    }
    
}

describe("Radar Single Asset Bond", () => {
    it("Access Control", async () => {
        const {
            otherAddress1,
            bond
        } = await snapshot();

        await expect(bond.connect(otherAddress1).changeTerms(
            0,
            0,
            0,
            0,
            ethers.constants.AddressZero
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
    it("State Getters", async () => {
        const {
            bond,
            deployer,
            treasury,
            staking,
            mockToken,
            bondAsset,
            priceLPAddress
        } = await snapshot();

        const getManager = await bond.getManager();
        expect(getManager).to.equal(deployer.address);

        const getBondingTerms = await bond.getBondingTerms();
        expect(getBondingTerms.bondPayoutLimit).to.equal(ethers.utils.parseEther('100'));
        expect(getBondingTerms.vestingTime).to.equal(432000);
        expect(getBondingTerms.bondDiscount).to.equal(1000);
        expect(getBondingTerms.minPriceLP).to.equal(ethers.utils.parseEther('0.05'));
        expect(getBondingTerms.priceLP).to.equal(priceLPAddress);

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
    it("Change manager", async () => {
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
    it("Flash Locking", async () => {
        const {
            otherAddress1,
            flasher,
            mockToken,
            uniswapRouter,
            bondAsset
        } = await snapshot();

        // Get some WETH
        await bondAsset.connect(otherAddress1).deposit({
            value: ethers.utils.parseEther('1')
        });

        const baBalance = await bondAsset.balanceOf(otherAddress1.address);
        expect(baBalance).to.not.equal(0);

        await bondAsset.connect(otherAddress1).transfer(flasher.address, baBalance);

        await expect(flasher.connect(otherAddress1).doDoubleDeposit()).to.be.revertedWith(
            "Flash Protection"
        );
    });
    it("Trusted Origin", async () => {
        const {
            deployer,
            otherAddress1,
            flasher,
            mockToken,
            uniswapRouter,
            bondAsset,
            bond
        } = await snapshot();

        // Get some WETH
        await bondAsset.connect(otherAddress1).deposit({
            value: ethers.utils.parseEther('1')
        });

        const baBalance = await bondAsset.balanceOf(otherAddress1.address);
        expect(baBalance).to.not.equal(0);

        await bondAsset.connect(otherAddress1).transfer(flasher.address, baBalance);

        await bond.connect(deployer).setTrustedOrigin(otherAddress1.address, true);
        await flasher.connect(otherAddress1).doDoubleDeposit();
    });
    it("Max bond calculation", async () => {
        const {
            bond,
            bondAsset,
            treasury,
            mockToken
        } = await snapshot();

        const maxBondAmount = await bond.getMaxBondAmount();

        // Calculate how much WETH for 100 RADAR payout
        // 1 RADAR = 0.1 WETH
        // So: x WETH + 10% REWARD WETH = 10 WETH
        // 1.1x = 10
        const bondAssetRequired = ethers.utils.parseEther((10 / 1.1).toString())
        expect(bondAssetRequired).to.be.closeTo(maxBondAmount, 10**10);

        // Set allowance to 10 RADAR
        await treasury.setBondData(
            bond.address,
            true,
            ethers.utils.parseEther('10'),
            100
        );

        const maxBondAmount2 = await bond.getMaxBondAmount();
        const bondAssetRequired2 = ethers.utils.parseEther((1 / 1.1).toString())
        expect(bondAssetRequired2).to.be.closeTo(maxBondAmount2, 10**10);
    });
    it("Sandwich attack (minPrice)", async () => {
        const {
            mockToken,
            flasher,
            uniswapRouter,
            bondAsset
        } = await snapshot();

        await bondAsset.deposit({value: ethers.utils.parseEther('2')});
        await bondAsset.transfer(flasher.address, ethers.utils.parseEther('1'));

        // Send tokens for price crash
        await mockToken.transfer(flasher.address, ethers.utils.parseEther('1'))

        await flasher.doFlashDeposit();

        // Send tokens for price crash
        await bondAsset.transfer(flasher.address, ethers.utils.parseEther('1'));
        await mockToken.transfer(flasher.address, ethers.utils.parseEther('1020'))

        await expect(flasher.doFlashDeposit()).to.be.revertedWith(
            "Price too low for bond minting"
        );
    });
    it("Change Terms", async () => {
        const {
            bond,
            priceLPAddress
        } = await snapshot();

        await bond.changeTerms(
            1000,
            4200,
            500,
            100000000,
            priceLPAddress
        );

        const getBondingTerms = await bond.getBondingTerms();
        expect(getBondingTerms.bondPayoutLimit).to.equal(1000);
        expect(getBondingTerms.vestingTime).to.equal(4200);
        expect(getBondingTerms.bondDiscount).to.equal(500);
        expect(getBondingTerms.minPriceLP).to.equal(100000000);
        expect(getBondingTerms.priceLP).to.equal(priceLPAddress);
    });
    it("Change Treasury", async () => {
        const {
            bond
        } = await snapshot();

        await bond.changeTreasury(ethers.constants.AddressZero);

        const getTreasury = await bond.getTreasury();
        expect(getTreasury).to.equal(ethers.constants.AddressZero);
    });
    it("Change Staking", async () => {
        const {
            bond
        } = await snapshot();

        await bond.changeStaking(ethers.constants.AddressZero);

        const getStaking = await bond.getStaking();
        expect(getStaking).to.equal(ethers.constants.AddressZero);
    });
    it("Reward calculation", async () => {
        const {
            bond,
            mockToken,
            otherAddress1,
            uniswapRouter,
            bondAsset
        } = await snapshot();

        // default 10% reward
        // if I deposit 10 WETH it means 100 RADAR with 10% 110 RADAR

        const mustBeZero = await bondAsset.balanceOf(otherAddress1.address);
        expect(mustBeZero).to.equal(0);

        await bondAsset.connect(otherAddress1).deposit({value: ethers.utils.parseEther('10')});

        const lpBalance = await bondAsset.balanceOf(otherAddress1.address);
        const estimatedReward = await bond.estimateReward(lpBalance);

        expect(estimatedReward).to.be.closeTo(ethers.utils.parseEther('110'), 10);
    });
    it("Bond slippage protection", async () => {
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

        await bondAsset.connect(otherAddress1).deposit({value: ethers.utils.parseEther('1')});

        const lpBalance = ethers.utils.parseEther('1');
        const estimatedReward = await bond.estimateReward(lpBalance);

        const minReward = estimatedReward.sub(estimatedReward.div(ethers.BigNumber.from((100 / SLIPPAGE_TOLERANCE).toString())));
        console.log(`
        expected reward: ${estimatedReward}
        min reward slip: ${minReward}
        `);
        await bondAsset.connect(otherAddress1).approve(bond.address, lpBalance);
        await bond.connect(otherAddress1).bond(lpBalance, minReward);


        // Slippage fail
        await bondAsset.connect(otherAddress1).deposit({value: ethers.utils.parseEther('1')});

        const lpBalance2 = ethers.utils.parseEther('1');
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
    it("Bond maxBond revert", async () => {
        const {
            bond,
            bondAsset,
            treasury,
            mockToken,
            otherAddress1
        } = await snapshot();

        const lpTotalSupply = await bondAsset.totalSupply();
        const maxBondAmount = await bond.getMaxBondAmount();

        // Calculate how much WETH for 100 RADAR payout
        // 1 WETH = 10 RADAR
        // 1.1x WETH = 10 WETH
        // Deposit LP that is worth 90.9090909091 RADAR
        const lpTokensRequired = ethers.utils.parseEther((10 / 1.1).toString());

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

        // Deposit WETH that is worth 10 RADAR
        const lpTokensRequired2 = ethers.utils.parseEther((1 / 1.1).toString());

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
            bondAsset,
            treasury
        } = await snapshot();

        console.log(`==== Used for this test ====
        Bond Address: ${bond.address}
        Mock Token Address: ${mockToken.address}
        Staking: ${staking.address}
        Bond LP Asset: ${bondAsset.address}
        Treasury: ${treasury.address}
        `);

        // Buy tokens
        await bondAsset.connect(investor1).deposit({value: ethers.utils.parseEther('10')});
        await bondAsset.connect(investor2).deposit({value: ethers.utils.parseEther('10')});

        // Bond Assets
        const SLIPPAGE_TOLERANCE = 5; // 1%

        const investor1LpBal = ethers.utils.parseEther('2')
        const investor2LpBal = ethers.utils.parseEther('4');

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

        const lblock = await (investor1.provider as any).getBlock('latest');
        const finishVesting = lblock.timestamp + 432000;

        expect(bondCreatedEventInvestor1.args.vestingDate).to.be.closeTo(ethers.BigNumber.from(finishVesting.toString()), 10);
        expect(bondCreatedEventInvestor2.args.vestingDate).to.be.closeTo(ethers.BigNumber.from(finishVesting.toString()), 10);

        expect(bondCreatedEventInvestor1.args.owner).to.equal(investor1.address);
        expect(bondCreatedEventInvestor2.args.owner).to.equal(investor2.address);

        expect(bondCreatedEventInvestor1.args.bondedAssets).to.equal(investor1LpBal);
        expect(bondCreatedEventInvestor2.args.bondedAssets).to.equal(investor2LpBal);

        expect(bondCreatedEventInvestor1.args.payout.div(10**10)).to.be.closeTo(actualRewardInvestor1.div(10**10), 10**8);
        expect(bondCreatedEventInvestor2.args.payout.div(10**10)).to.be.closeTo(actualRewardInvestor2.div(10**10), 10**8);

        const payoutInvestor1 = bondCreatedEventInvestor1.args.payout;
        const payoutInvestor2 = bondCreatedEventInvestor2.args.payout;

        // Pass 2.5 days
        await (investor1.provider as any).send("evm_increaseTime", [216000]);
        const investor1BalanceBefore = await mockToken.balanceOf(investor1.address);

        // Redeem half both
        const redeemInvestor1Tx1 = await bond.connect(investor1).redeem(false);
        const redeemInvestor2Tx1 = await bond.connect(investor2).redeem(true);

        const redeemInvestor1Receipt1 = await redeemInvestor1Tx1.wait();
        const redeemInvestor2Receipt1 = await redeemInvestor2Tx1.wait();

        const bondRedeemed1Investor1 = bond.interface.parseLog(redeemInvestor1Receipt1.logs[redeemInvestor1Receipt1.logs.length - 1]);
        const bondRedeemed1Investor2 = bond.interface.parseLog(redeemInvestor2Receipt1.logs[redeemInvestor2Receipt1.logs.length - 1]);

        expect(bondRedeemed1Investor1.args.owner).to.equal(investor1.address);
        expect(bondRedeemed1Investor2.args.owner).to.equal(investor2.address);

        expect(bondRedeemed1Investor1.args.payoutRedeemed.div(10**10)).to.be.closeTo(payoutInvestor1.div(2).div(10**10), 10**6);
        expect(bondRedeemed1Investor2.args.payoutRedeemed.div(10**10)).to.be.closeTo(payoutInvestor2.div(2).div(10**10), 10**6);

        expect(bondRedeemed1Investor1.args.payoutRemaining.div(10**10)).to.be.closeTo(payoutInvestor1.div(2).div(10**10), 10**6);
        expect(bondRedeemed1Investor2.args.payoutRemaining.div(10**10)).to.be.closeTo(payoutInvestor2.div(2).div(10**10), 10**6);

        expect(ethers.BigNumber.from(bondRedeemed1Investor1.args.vestingRemaining)).to.be.closeTo(ethers.BigNumber.from(216000), 10);
        expect(ethers.BigNumber.from(bondRedeemed1Investor2.args.vestingRemaining)).to.be.closeTo(ethers.BigNumber.from(216000), 10);

        expect(bondRedeemed1Investor1.args.tokensStaked).to.equal(false);
        expect(bondRedeemed1Investor2.args.tokensStaked).to.equal(true);

        const investor1Balance1 = await mockToken.balanceOf(investor1.address);
        const investor2Balance1 = await staking.balanceOf(investor2.address);
        expect(investor1Balance1.sub(investor1BalanceBefore)).to.equal(bondRedeemed1Investor1.args.payoutRedeemed);
        expect(investor2Balance1).to.equal(bondRedeemed1Investor2.args.payoutRedeemed);

        // Pass 2.5 days
        await (investor1.provider as any).send("evm_increaseTime", [216000]);

        // Redeem everything both
        const redeemInvestor1Tx2 = await bond.connect(investor1).redeem(false);
        const redeemInvestor2Tx2 = await bond.connect(investor2).redeem(true);

        const redeemInvestor1Receipt2 = await redeemInvestor1Tx2.wait();
        const redeemInvestor2Receipt2 = await redeemInvestor2Tx2.wait();

        const bondRedeemed2Investor1 = bond.interface.parseLog(redeemInvestor1Receipt2.logs[redeemInvestor1Receipt2.logs.length - 1]);
        const bondRedeemed2Investor2 = bond.interface.parseLog(redeemInvestor2Receipt2.logs[redeemInvestor2Receipt2.logs.length - 1]);

        expect(bondRedeemed2Investor1.args.owner).to.equal(investor1.address);
        expect(bondRedeemed2Investor2.args.owner).to.equal(investor2.address);

        expect(bondRedeemed2Investor1.args.payoutRedeemed.div(10**10)).to.be.closeTo(payoutInvestor1.div(2).div(10**10), 10**6);
        expect(bondRedeemed2Investor2.args.payoutRedeemed.div(10**10)).to.be.closeTo(payoutInvestor2.div(2).div(10**10), 10**6);

        expect(bondRedeemed2Investor1.args.payoutRemaining).to.equal(0);
        expect(bondRedeemed2Investor2.args.payoutRemaining).to.equal(0);

        expect(bondRedeemed2Investor1.args.vestingRemaining).to.equal(0);
        expect(bondRedeemed2Investor2.args.vestingRemaining).to.equal(0);

        expect(bondRedeemed2Investor1.args.tokensStaked).to.equal(false);
        expect(bondRedeemed2Investor2.args.tokensStaked).to.equal(true);

        const investor1Balance2 = await mockToken.balanceOf(investor1.address);
        const investor2Balance2 = await staking.balanceOf(investor2.address);
        expect(investor1Balance2.sub(investor1Balance1)).to.equal(bondRedeemed2Investor1.args.payoutRedeemed);
        expect(investor2Balance2.sub(investor2Balance1)).to.equal(bondRedeemed2Investor2.args.payoutRedeemed);
    });
    it("Double Deposit", async () => {
        const {
            bond,
            mockToken,
            WETH,
            uniswapRouter,
            investor1,
            bondAsset
        } = await snapshot();

        // Bond Assets
        const SLIPPAGE_TOLERANCE = 5; // 1%

        await bondAsset.connect(investor1).deposit({value: ethers.utils.parseEther('10')});

        const investor1LpBal = ethers.utils.parseEther('2');
        const deposit1 = investor1LpBal.div(2);
        const deposit2 = investor1LpBal.sub(deposit1);

        await bondAsset.connect(investor1).approve(bond.address, investor1LpBal);

        const estimatedRewardInvestor1 = ethers.utils.parseEther('11');

        const actualRewardInvestor1 = await bond.estimateReward(deposit1);

        const minSlipInvestor1 = estimatedRewardInvestor1.sub(estimatedRewardInvestor1.div(ethers.BigNumber.from((100 / SLIPPAGE_TOLERANCE).toString())));

        console.log(`
        Est. Reward Investor1: ${estimatedRewardInvestor1}
        Act. Reward Investor1: ${actualRewardInvestor1}
        Min. Reward Investor1: ${minSlipInvestor1}
        `);

        const bondTxInvestor1 = await bond.connect(investor1).bond(deposit1, minSlipInvestor1);

        const bondReceiptInvestor1 = await bondTxInvestor1.wait();

        const bondCreatedEventInvestor1 = bond.interface.parseLog(bondReceiptInvestor1.logs[bondReceiptInvestor1.logs.length - 1]);

        const lblock = await (investor1.provider as any).getBlock('latest');
        const finishVesting = lblock.timestamp + 432000;

        expect(bondCreatedEventInvestor1.args.vestingDate).to.be.closeTo(ethers.BigNumber.from(finishVesting.toString()), 10);
        expect(bondCreatedEventInvestor1.args.owner).to.equal(investor1.address);
        expect(bondCreatedEventInvestor1.args.bondedAssets).to.equal(deposit1);
        expect(bondCreatedEventInvestor1.args.payout.div(10**10)).to.be.closeTo(actualRewardInvestor1.div(10**10), 10**8);

        const payoutInvestor1 = bondCreatedEventInvestor1.args.payout;

        // Pass 2.5 days
        await (investor1.provider as any).send("evm_increaseTime", [216000]);
        const investor1BalanceBefore = await mockToken.balanceOf(investor1.address);

        // Redeem half both
        const redeemInvestor1Tx1 = await bond.connect(investor1).redeem(false);

        const redeemInvestor1Receipt1 = await redeemInvestor1Tx1.wait();

        const bondRedeemed1Investor1 = bond.interface.parseLog(redeemInvestor1Receipt1.logs[redeemInvestor1Receipt1.logs.length - 1]);

        expect(bondRedeemed1Investor1.args.owner).to.equal(investor1.address);

        expect(bondRedeemed1Investor1.args.payoutRedeemed.div(10**10)).to.be.closeTo(payoutInvestor1.div(2).div(10**10), 10**6);

        expect(bondRedeemed1Investor1.args.payoutRemaining.div(10**10)).to.be.closeTo(payoutInvestor1.div(2).div(10**10), 10**6);

        expect(ethers.BigNumber.from(bondRedeemed1Investor1.args.vestingRemaining)).to.be.closeTo(ethers.BigNumber.from(216000), 10);

        expect(bondRedeemed1Investor1.args.tokensStaked).to.equal(false);

        const investor1Balance1 = await mockToken.balanceOf(investor1.address);
        expect(investor1Balance1.sub(investor1BalanceBefore)).to.equal(bondRedeemed1Investor1.args.payoutRedeemed);

        // Deposit again
        const estimatedRewardInvestor2 = ethers.utils.parseEther('11');

        const actualRewardInvestor2 = await bond.estimateReward(deposit2);

        const minSlipInvestor2 = estimatedRewardInvestor2.sub(estimatedRewardInvestor2.div(ethers.BigNumber.from((100 / SLIPPAGE_TOLERANCE).toString())));

        console.log(`
        Est. Reward Investor2: ${estimatedRewardInvestor2}
        Act. Reward Investor2: ${actualRewardInvestor2}
        Min. Reward Investor2: ${minSlipInvestor2}
        `);

        const bondTxInvestor2 = await bond.connect(investor1).bond(deposit2, minSlipInvestor2);

        const bondReceiptInvestor2 = await bondTxInvestor2.wait();

        const bondCreatedEventInvestor2 = bond.interface.parseLog(bondReceiptInvestor2.logs[bondReceiptInvestor2.logs.length - 1]);

        const lblock2 = await (investor1.provider as any).getBlock('latest');
        const finishVesting2 = lblock2.timestamp + 432000;

        expect(bondCreatedEventInvestor2.args.vestingDate).to.be.closeTo(ethers.BigNumber.from(finishVesting2.toString()), 10);
        expect(bondCreatedEventInvestor2.args.owner).to.equal(investor1.address);
        expect(bondCreatedEventInvestor2.args.bondedAssets).to.equal(deposit2);
        expect(bondCreatedEventInvestor2.args.payout.div(10**10)).to.be.closeTo((actualRewardInvestor2.add(actualRewardInvestor1.div(2))).div(10**10), 10**8);

        const payoutInvestor2 = bondCreatedEventInvestor2.args.payout.sub(actualRewardInvestor1.div(2));

        // Pass 2.5 days
        await (investor1.provider as any).send("evm_increaseTime", [216000]);

        // Check redeem 25% of deposit1 + 50% of deposit 2
        const redeemInvestor1Tx2 = await bond.connect(investor1).redeem(false);

        const redeemInvestor1Receipt2 = await redeemInvestor1Tx2.wait();

        const bondRedeemed1Investor2 = bond.interface.parseLog(redeemInvestor1Receipt2.logs[redeemInvestor1Receipt2.logs.length - 1]);

        expect(bondRedeemed1Investor2.args.owner).to.equal(investor1.address);

        expect(bondRedeemed1Investor2.args.payoutRedeemed.div(10**10)).to.be.closeTo((payoutInvestor1.div(4).add(payoutInvestor2.div(2))).div(10**10), 10**8);

        expect(bondRedeemed1Investor2.args.payoutRemaining.div(10**10)).to.be.closeTo((payoutInvestor1.div(4).add(payoutInvestor2.div(2))).div(10**10), 10**8);

        expect(ethers.BigNumber.from(bondRedeemed1Investor2.args.vestingRemaining)).to.be.closeTo(ethers.BigNumber.from(216000), 10);

        expect(bondRedeemed1Investor2.args.tokensStaked).to.equal(false);

        const investor1Balance2 = await mockToken.balanceOf(investor1.address);
        expect(investor1Balance2.sub(investor1BalanceBefore).sub(investor1Balance1)).to.be.closeTo(bondRedeemed1Investor2.args.payoutRedeemed, 10**5);

        // Pass 2.5 days
        await (investor1.provider as any).send("evm_increaseTime", [216000]);

        // Check redeem 25% of deposit1 + 50% of deposit 2
        const redeemInvestor1Tx3 = await bond.connect(investor1).redeem(false);

        const redeemInvestor1Receipt3 = await redeemInvestor1Tx3.wait();

        const bondRedeemed1Investor3 = bond.interface.parseLog(redeemInvestor1Receipt3.logs[redeemInvestor1Receipt3.logs.length - 1]);

        expect(bondRedeemed1Investor3.args.owner).to.equal(investor1.address);

        expect(bondRedeemed1Investor3.args.payoutRedeemed.div(10**10)).to.be.closeTo((payoutInvestor1.div(4).add(payoutInvestor2.div(2))).div(10**10), 10**8);

        expect(bondRedeemed1Investor3.args.payoutRemaining.div(10**10)).to.equal(0);

        expect(bondRedeemed1Investor3.args.vestingRemaining).to.equal(0);

        expect(bondRedeemed1Investor3.args.tokensStaked).to.equal(false);

        const investor1Balance3 = await mockToken.balanceOf(investor1.address);
        expect(investor1Balance3.div(10**10)).to.be.closeTo(ethers.utils.parseEther('22').div(10**10), 10**8);
    });
});