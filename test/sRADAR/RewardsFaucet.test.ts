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
            staking
        } = await snapshot();

        // Check RADAR
        const getRadarCall = await rewardsFaucet.RADAR();
        expect(getRadarCall).to.eq(mockToken.address);

        const getStakingCall = await rewardsFaucet.staking();
        expect(getStakingCall).to.eq(staking.address);
    });
    it.skip("Access Control", async () => {});

});