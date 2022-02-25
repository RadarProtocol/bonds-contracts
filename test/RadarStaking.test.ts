import { expect } from 'chai';
import { ethers } from 'hardhat';

const snapshot = async () => {
    const [deployer, staker, mockDAO, staker2] = await ethers.getSigners();
    

    // CUSTOM
    const tokenFactory = await ethers.getContractFactory("MockToken");
    const treasuryFactory = await ethers.getContractFactory("RadarBondsTreasury");
    const mockToken = await tokenFactory.deploy();
    const treasury = await treasuryFactory.deploy(mockToken.address, mockDAO.address);

    const stakerTreasury = await treasuryFactory.deploy(mockToken.address, mockDAO.address);
    await stakerTreasury.passOwnership(staker.address);
    await stakerTreasury.connect(staker).acceptOwnership();

    const stakingFactory = await ethers.getContractFactory("RadarStaking");
    const staking = await stakingFactory.deploy(
        mockToken.address,
        mockToken.address,
        60*60*24*28, // 1 MONTH
        treasury.address
    );

    return {
        deployer,
        staker,
        staker2,
        mockToken,
        treasury,
        staking,
        stakerTreasury
    }
}

describe("Radar Staking", () => {
    it("Access Control", async () => {
        const {
            deployer,
            staker,
            staking
        } = await snapshot();

        const a0 = ethers.constants.AddressZero;

        await expect(staking.connect(staker).changeTreasury(a0)).to.be.revertedWith(
            "Unauthorized"
        );

        await expect(staking.connect(staker).pushReward(a0)).to.be.revertedWith(
            "Unauthorized"
        );

        await expect(staking.connect(staker).addedReward(0)).to.be.revertedWith(
            "Unauthorized"
        );
    });
    it("State Getters", async () => {
        const {
            deployer,
            staking,
            staker,
            treasury
        } = await snapshot();

        const totalSupplyCall = await staking.totalSupply();
        expect(totalSupplyCall).to.equal(0);

        const getTreasury = await staking.treasury();
        expect(getTreasury).to.equal(treasury.address);

        const getOwnerCallStaking = await staking.getOwner();
        const getOwnerCallTreasury = await treasury.getOwner();
        expect(getOwnerCallStaking).to.equal(getOwnerCallTreasury).to.equal(deployer.address);

        const getDuration = await staking.duration();
        expect(getDuration).to.equal(60*60*24*28);

        const getRewardPerToken = await staking.rewardPerToken();
        expect(getRewardPerToken).to.equal(0);

        const getBalanceCall = await staking.balanceOf(staker.address);
        expect(getBalanceCall).to.equal(0);

        const getEarnedCall = await staking.earned(staker.address);
        expect(getEarnedCall).to.equal(0);
    });
    it("Change Treasury", async () => {
        const {
            deployer,
            treasury,
            staker,
            staking,
            stakerTreasury
        } = await snapshot();

        await expect(staking.connect(staker).changeTreasury(ethers.constants.AddressZero)).to.be.revertedWith(
            "Unauthorized"
        );

        await staking.connect(deployer).changeTreasury(stakerTreasury.address);

        const getOwnerCall = await staking.getOwner();
        expect(getOwnerCall).to.equal(staker.address);

        await expect(staking.connect(deployer).changeTreasury(ethers.constants.AddressZero)).to.be.revertedWith(
            "Unauthorized"
        );

        await staking.connect(staker).changeTreasury(ethers.constants.AddressZero);
    });
    it("Stake", async () => {
        const {
            deployer,
            staking,
            mockToken,
            staker,
            staker2
        } = await snapshot();

        await mockToken.connect(deployer).transfer(staker.address, ethers.utils.parseEther('100'));
        await mockToken.connect(deployer).transfer(staker2.address, ethers.utils.parseEther('200'));

        await mockToken.connect(staker).approve(staking.address, ethers.utils.parseEther('100'));
        await mockToken.connect(staker2).approve(staking.address, ethers.utils.parseEther('200'));

        await staking.connect(staker).stake(ethers.utils.parseEther('100'), staker.address);
        await staking.connect(staker2).stake(ethers.utils.parseEther('200'), staker2.address);

        const getStakerBalance = await staking.balanceOf(staker.address);
        const getStaker2Balance = await staking.balanceOf(staker2.address);
        expect(getStakerBalance).to.equal(ethers.utils.parseEther('100'));
        expect(getStaker2Balance).to.equal(ethers.utils.parseEther('200'));

        const getTotalSupply = await staking.totalSupply();
        expect(getTotalSupply).to.equal(ethers.utils.parseEther('300'));
    });
    it("Withdraw", async () => {
        const {
            deployer,
            staking,
            mockToken,
            staker,
            staker2
        } = await snapshot();

        await mockToken.connect(deployer).transfer(staker.address, ethers.utils.parseEther('100'));
        await mockToken.connect(deployer).transfer(staker2.address, ethers.utils.parseEther('200'));

        await mockToken.connect(staker).approve(staking.address, ethers.utils.parseEther('100'));
        await mockToken.connect(staker2).approve(staking.address, ethers.utils.parseEther('200'));

        await staking.connect(staker).stake(ethers.utils.parseEther('100'), staker.address);
        await staking.connect(staker2).stake(ethers.utils.parseEther('200'), staker2.address);

        const getStakerBalance = await staking.balanceOf(staker.address);
        const getStaker2Balance = await staking.balanceOf(staker2.address);
        expect(getStakerBalance).to.equal(ethers.utils.parseEther('100'));
        expect(getStaker2Balance).to.equal(ethers.utils.parseEther('200'));

        const getTotalSupply = await staking.totalSupply();
        expect(getTotalSupply).to.equal(ethers.utils.parseEther('300'));

        await staking.connect(staker).withdraw(ethers.utils.parseEther('100'));
        await staking.connect(staker2).withdraw(ethers.utils.parseEther('200'));

        const getStakerBalanceAfter = await mockToken.balanceOf(staker.address);
        const getStaker2BalanceAfter = await mockToken.balanceOf(staker2.address);
        expect(getStakerBalanceAfter).to.equal(ethers.utils.parseEther('100'));
        expect(getStaker2BalanceAfter).to.equal(ethers.utils.parseEther('200'));

        const getStakerStaked = await staking.balanceOf(staker.address);
        const getStaker2Staked = await staking.balanceOf(staker2.address);
        expect(getStakerStaked).to.equal(0);
        expect(getStaker2Staked).to.equal(0);

        const finalTotalSupply = await staking.totalSupply();
        expect(finalTotalSupply).to.equal(0);

        await expect(staking.connect(staker).withdraw(1)).to.be.revertedWith(
            "Withdraw overflow"
        );
    });
    it('Exit', async () => {
        const {
            deployer,
            staking,
            mockToken,
            staker,
            staker2
        } = await snapshot();

        await mockToken.connect(deployer).transfer(staker.address, ethers.utils.parseEther('100'));
        await mockToken.connect(deployer).transfer(staker2.address, ethers.utils.parseEther('200'));

        await mockToken.connect(staker).approve(staking.address, ethers.utils.parseEther('100'));
        await mockToken.connect(staker2).approve(staking.address, ethers.utils.parseEther('200'));

        await staking.connect(staker).stake(ethers.utils.parseEther('100'), staker.address);
        await staking.connect(staker2).stake(ethers.utils.parseEther('200'), staker2.address);

        const getStakerBalance = await staking.balanceOf(staker.address);
        const getStaker2Balance = await staking.balanceOf(staker2.address);
        expect(getStakerBalance).to.equal(ethers.utils.parseEther('100'));
        expect(getStaker2Balance).to.equal(ethers.utils.parseEther('200'));

        const getTotalSupply = await staking.totalSupply();
        expect(getTotalSupply).to.equal(ethers.utils.parseEther('300'));

        await staking.connect(staker).exit();
        await staking.connect(staker2).exit();

        const getStakerBalanceAfter = await mockToken.balanceOf(staker.address);
        const getStaker2BalanceAfter = await mockToken.balanceOf(staker2.address);
        expect(getStakerBalanceAfter).to.equal(ethers.utils.parseEther('100'));
        expect(getStaker2BalanceAfter).to.equal(ethers.utils.parseEther('200'));

        const getStakerStaked = await staking.balanceOf(staker.address);
        const getStaker2Staked = await staking.balanceOf(staker2.address);
        expect(getStakerStaked).to.equal(0);
        expect(getStaker2Staked).to.equal(0);

        const finalTotalSupply = await staking.totalSupply();
        expect(finalTotalSupply).to.equal(0);

        await expect(staking.connect(staker).withdraw(1)).to.be.revertedWith(
            "Withdraw overflow"
        );
    });
    it("Rewards", async () => {
        const {
            deployer,
            staking,
            mockToken,
            staker,
            staker2
        } = await snapshot();

        await mockToken.connect(deployer).transfer(staker.address, ethers.utils.parseEther('100'));
        await mockToken.connect(deployer).transfer(staker2.address, ethers.utils.parseEther('200'));

        await mockToken.connect(staker).approve(staking.address, ethers.utils.parseEther('100'));
        await mockToken.connect(staker2).approve(staking.address, ethers.utils.parseEther('200'));

        await staking.connect(staker).stake(ethers.utils.parseEther('100'), staker.address);

        const getStakerBalance = await staking.balanceOf(staker.address);
        expect(getStakerBalance).to.equal(ethers.utils.parseEther('100'));

        const getTotalSupply = await staking.totalSupply();
        expect(getTotalSupply).to.equal(ethers.utils.parseEther('100'));

        // Add rewards
        await mockToken.connect(deployer).transfer(staking.address, ethers.utils.parseEther('1000'));
        await staking.connect(deployer).addedReward(ethers.utils.parseEther('1000'));

        // Pass half a month
        await (deployer.provider as any).send("evm_increaseTime", [60*60*24*14]);

        // Stake staker2
        await staking.connect(staker2).stake(ethers.utils.parseEther('200'), staker2.address);
        const rewardsUntil = await staking.earned(staker.address);

        // Pass another half a month
        await (deployer.provider as any).send("evm_increaseTime", [60*60*24*14]);
        await mockToken.connect(deployer).approve(staking.address, 1);
        await staking.connect(deployer).stake(1, deployer.address)

        // Get rewards
        const expectedRewardStaker = ethers.utils.parseEther('1000').mul(ethers.BigNumber.from(((0.5 + (1/3)*0.5) * 10**18).toString())).div((10**18).toString());
        const expectedRewardStaker2 = ethers.utils.parseEther('1000').mul(ethers.BigNumber.from((((2/3)*0.5) * 10**18).toString())).div((10**18).toString());
        const expectedTotalStaker = ethers.BigNumber.from(expectedRewardStaker).add(ethers.utils.parseEther('100'));
        const expectedTotalStaker2 = ethers.BigNumber.from(expectedRewardStaker2).add(ethers.utils.parseEther('200'));
        const earnedStaker = await staking.earned(staker.address);
        const earnedStaker2 = await staking.earned(staker2.address);
        console.log(`Expected reward for 1: ${expectedRewardStaker} and for 2: ${expectedRewardStaker2}`);
        console.log(`Earned staker 1: ${earnedStaker} and 2: ${earnedStaker2}`)
        expect(earnedStaker.div(ethers.BigNumber.from((10**18).toString()))).to.equal(ethers.BigNumber.from(expectedRewardStaker).div(ethers.BigNumber.from((10**18).toString())));
        expect(earnedStaker2.div(ethers.BigNumber.from((10**18).toString()))).to.equal(expectedRewardStaker2.div(ethers.BigNumber.from((10**18).toString())));

        await staking.connect(staker).exit();
        await staking.connect(staker2).exit();

        const stakingTokenBalance = await mockToken.balanceOf(staking.address);
        expect(stakingTokenBalance.div(ethers.BigNumber.from((10**18).toString()))).to.equal(0);

        const balStaker = await mockToken.balanceOf(staker.address);
        const balStaker2 = await mockToken.balanceOf(staker2.address);
        expect(balStaker).to.be.closeTo(expectedTotalStaker, 10**10);
        expect(balStaker2).to.be.closeTo(expectedTotalStaker2, 10**10);
    });
});