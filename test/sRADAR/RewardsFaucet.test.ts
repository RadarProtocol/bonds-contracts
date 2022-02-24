import { expect } from 'chai';
import { ethers } from 'hardhat';

const snapshot = async () => {
    const [deployer, gelatoNetwork, staking, otherAddress1] = await ethers.getSigners();
    

    // CUSTOM
    const tokenFactory = await ethers.getContractFactory("MockToken");
    const mockToken = await tokenFactory.deploy();

    const rewardsFaucetFactory = await ethers.getContractFactory("RewardsFaucet");
    const rewardsFaucet = await rewardsFaucetFactory.deploy(
        mockToken.address,
        2419200, // 28 days
        gelatoNetwork.address,
        259200, // 3 days
        staking.address
    );

    return {
        deployer,
        otherAddress1,
        gelatoNetwork,
        staking,
        mockToken,
        rewardsFaucet
    }
}

describe("RewardsFaucet", () => {
    it("Initial State Getters", async () => {
        const {
            mockToken,
            rewardsFaucet,
            staking,
            deployer,
            gelatoNetwork
        } = await snapshot();

        // Check RADAR
        const getRadarCall = await rewardsFaucet.RADAR();
        expect(getRadarCall).to.eq(mockToken.address);

        const getStakingCall = await rewardsFaucet.staking();
        expect(getStakingCall).to.eq(staking.address);

        const getOwner = await rewardsFaucet.owner();
        expect(getOwner).to.eq(deployer.address);

        const getPOwner = await rewardsFaucet.pendingOwner();
        expect(getPOwner).to.eq(ethers.constants.AddressZero);

        const getPokeMe = await rewardsFaucet.pokeMe();
        expect(getPokeMe).to.eq(gelatoNetwork.address);
    });
    it("Access Control", async () => {
        const {
            rewardsFaucet,
            otherAddress1,
            gelatoNetwork
        } = await snapshot();

        await expect(rewardsFaucet.connect(otherAddress1).drip()).to.be.revertedWith("Unauthorized");
        await expect(rewardsFaucet.drip()).to.be.revertedWith("Cannot Drip Now");
        await expect(rewardsFaucet.connect(gelatoNetwork).drip()).to.be.revertedWith("Cannot Drip Now");

        await expect(rewardsFaucet.connect(otherAddress1).addedRewards(0)).to.be.revertedWith("Unauthorized");
        
        await expect(rewardsFaucet.connect(otherAddress1).withdrawTokens(ethers.constants.AddressZero, 0, ethers.constants.AddressZero)).to.be.revertedWith("Unauthorized");

        await expect(rewardsFaucet.connect(otherAddress1).changeStaking(ethers.constants.AddressZero)).to.be.revertedWith("Unauthorized");

        await expect(rewardsFaucet.connect(otherAddress1).changeDripInterval(0)).to.be.revertedWith("Unauthorized");

        await expect(rewardsFaucet.connect(otherAddress1).changeDuration(0)).to.be.revertedWith("Unauthorized");

        await expect(rewardsFaucet.connect(otherAddress1).transferOwnership(ethers.constants.AddressZero)).to.be.revertedWith("Unauthorized");

        await expect(rewardsFaucet.claimOwnership()).to.be.revertedWith("Unauthorized");
    });
    it("Pass Ownership", async () => {
        const {
            rewardsFaucet,
            otherAddress1,
            deployer
        } = await snapshot();

        await rewardsFaucet.transferOwnership(otherAddress1.address);

        const getPendingOwner = await rewardsFaucet.pendingOwner();
        const getOwner = await rewardsFaucet.owner();
        expect(getPendingOwner).to.eq(otherAddress1.address);
        expect(getOwner).to.eq(deployer.address);

        await expect(rewardsFaucet.claimOwnership()).to.be.revertedWith("Unauthorized");

        await rewardsFaucet.connect(otherAddress1).claimOwnership();

        const getPendingOwner2 = await rewardsFaucet.pendingOwner();
        const getOwner2 = await rewardsFaucet.owner();
        expect(getPendingOwner2).to.eq(ethers.constants.AddressZero);
        expect(getOwner2).to.eq(otherAddress1.address);

        await expect(rewardsFaucet.transferOwnership(ethers.constants.AddressZero)).to.be.revertedWith("Unauthorized");
        await rewardsFaucet.connect(otherAddress1).transferOwnership(ethers.constants.AddressZero);
    });
    it("Change Values", async () => {
        const {
            rewardsFaucet,
            otherAddress1
        } = await snapshot();

        await rewardsFaucet.changeStaking(otherAddress1.address);
        const getStaking = await rewardsFaucet.staking();
        expect(getStaking).to.eq(otherAddress1.address);

        await rewardsFaucet.changeDripInterval(3600);
        const getDripInt = await rewardsFaucet.dripInterval();
        expect(getDripInt).to.eq(3600);

        await rewardsFaucet.changeDuration(86400);
        const getDur = await rewardsFaucet.duration();
        expect(getDur).to.eq(86400);
    });
    it("Withdraw Tokens", async () => {
        const {
            mockToken,
            rewardsFaucet,
            otherAddress1
        } = await snapshot();

        const rBal1 = await mockToken.balanceOf(rewardsFaucet.address);
        const oBal1 = await mockToken.balanceOf(otherAddress1.address);
        expect(rBal1).to.eq(oBal1).to.eq(0);

        await mockToken.transfer(rewardsFaucet.address, ethers.utils.parseEther('1'));

        const rBal2 = await mockToken.balanceOf(rewardsFaucet.address);
        expect(rBal2).to.eq(ethers.utils.parseEther('1'));

        await rewardsFaucet.withdrawTokens(mockToken.address, ethers.utils.parseEther('1'), otherAddress1.address);

        const rBal3 = await mockToken.balanceOf(rewardsFaucet.address);
        const oBal2 = await mockToken.balanceOf(otherAddress1.address);

        expect(rBal3).to.eq(0);
        expect(oBal2).to.eq(ethers.utils.parseEther('1'));
    });
    it("Drip Limitation (canDrip)", async () => {
        // Can't drip if:
        // Schedule is finished
        // Interval not passed

        const {
            rewardsFaucet,
            gelatoNetwork,
            mockToken
        } = await snapshot();

        // Start and finish a schedule then check for drip
        await mockToken.transfer(rewardsFaucet.address, ethers.utils.parseEther('1'));
        await rewardsFaucet.addedRewards(ethers.utils.parseEther('1'));
        await (gelatoNetwork.provider as any).send("evm_increaseTime", [3024000]);
        await rewardsFaucet.connect(gelatoNetwork).drip();

        await expect(rewardsFaucet.drip()).to.be.revertedWith("Cannot Drip Now");

        // Interval of 1337 seconds
        await rewardsFaucet.changeDripInterval(1337);
        await mockToken.transfer(rewardsFaucet.address, ethers.utils.parseEther('1'));
        await rewardsFaucet.addedRewards(ethers.utils.parseEther('1'));
        await (gelatoNetwork.provider as any).send("evm_increaseTime", [1337]);
        // Now you can drip
        await rewardsFaucet.connect(gelatoNetwork).drip();
        // Now you cannot drip
        await expect(rewardsFaucet.drip()).to.be.revertedWith("Cannot Drip Now");
        await (gelatoNetwork.provider as any).send("evm_increaseTime", [1000]);
        await expect(rewardsFaucet.drip()).to.be.revertedWith("Cannot Drip Now");
    });
    it("Functionality", async () => {
        const {
            rewardsFaucet,
            gelatoNetwork,
            mockToken,
            staking
        } = await snapshot();

        // drip 28 tokens for 28 days
        await mockToken.transfer(rewardsFaucet.address, ethers.utils.parseEther('28'));
        await rewardsFaucet.addedRewards(ethers.utils.parseEther('28'));
        // Pass 3 days
        await (gelatoNetwork.provider as any).send("evm_increaseTime", [86400 * 3]);
        await rewardsFaucet.connect(gelatoNetwork).drip();
        const sb1 = await mockToken.balanceOf(staking.address);
        expect(sb1).to.be.closeTo(ethers.utils.parseEther('3'), 10**6);

        // Pass 5 days
        await (gelatoNetwork.provider as any).send("evm_increaseTime", [86400 * 5]);
        await rewardsFaucet.connect(gelatoNetwork).drip();
        const sb2 = await mockToken.balanceOf(staking.address);
        expect(sb2).to.be.closeTo(ethers.utils.parseEther('8'), 10**6);

        // Pass 10 days
        await (gelatoNetwork.provider as any).send("evm_increaseTime", [86400 * 10]);
        await rewardsFaucet.connect(gelatoNetwork).drip();
        const sb3 = await mockToken.balanceOf(staking.address);
        expect(sb3).to.be.closeTo(ethers.utils.parseEther('18'), 10**6);

        // Finish Schedule
        await (gelatoNetwork.provider as any).send("evm_increaseTime", [86400 * 35]);
        await rewardsFaucet.connect(gelatoNetwork).drip();
        const sb4 = await mockToken.balanceOf(staking.address);
        expect(sb4).to.be.closeTo(ethers.utils.parseEther('28'), 10**6);

        // Can't drip no mo'
        await expect(rewardsFaucet.drip()).to.be.revertedWith("Cannot Drip Now");
    });
    it("Schedule Overriding", async () => {
        const {
            rewardsFaucet,
            gelatoNetwork,
            mockToken,
            staking
        } = await snapshot();

        // drip 28 tokens for 28 days
        await mockToken.transfer(rewardsFaucet.address, ethers.utils.parseEther('28'));
        await rewardsFaucet.addedRewards(ethers.utils.parseEther('28'));

        // Pass 10 days and drip
        await (gelatoNetwork.provider as any).send("evm_increaseTime", [86400 * 10]);
        await rewardsFaucet.connect(gelatoNetwork).drip();
        const sb1 = await mockToken.balanceOf(staking.address);
        expect(sb1).to.be.closeTo(ethers.utils.parseEther('10'), 10**6);

        // We have 18 tokens left for 18 days
        // We add 10 more tokens
        // We should have back the original 28 tokens for 28 days, and when schedule ends, staking should have 38 tokens
        await mockToken.transfer(rewardsFaucet.address, ethers.utils.parseEther('10'));
        await rewardsFaucet.addedRewards(ethers.utils.parseEther('10'));

        // Pass 10 days and drip
        await (gelatoNetwork.provider as any).send("evm_increaseTime", [86400 * 10]);
        await rewardsFaucet.connect(gelatoNetwork).drip();
        const sb2 = await mockToken.balanceOf(staking.address);
        expect(sb2).to.be.closeTo(ethers.utils.parseEther('20'), 10**15);

        // Pass 10 days and drip
        await (gelatoNetwork.provider as any).send("evm_increaseTime", [86400 * 10]);
        await rewardsFaucet.connect(gelatoNetwork).drip();
        const sb3 = await mockToken.balanceOf(staking.address);
        expect(sb3).to.be.closeTo(ethers.utils.parseEther('30'), 10**15);

        // Finish Schedule
        await (gelatoNetwork.provider as any).send("evm_increaseTime", [86400 * 35]);
        await rewardsFaucet.connect(gelatoNetwork).drip();
        const sb4 = await mockToken.balanceOf(staking.address);
        expect(sb4).to.be.closeTo(ethers.utils.parseEther('38'), 10**15);
    });
});