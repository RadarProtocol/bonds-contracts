import { expect } from 'chai';
import { ethers } from 'hardhat';

const snapshot = async () => {
    const [deployer, mockBond, mockDAO, otherAddress1] = await ethers.getSigners();

    const tokenFactory = await ethers.getContractFactory("MockToken");
    const treasuryFactory = await ethers.getContractFactory("RadarBondsTreasury");
    const mockToken = await tokenFactory.deploy();
    const treasury = await treasuryFactory.deploy(mockToken.address, mockDAO.address);

    return {
        deployer,
        otherAddress1,
        mockBond,
        mockDAO,
        mockToken,
        treasury
    }
}

describe("Radar Treasury", () => {
    it("Access Control", async () => {
        const {
            deployer,
            otherAddress1,
            treasury
        } = await snapshot();

        await expect(treasury.connect(otherAddress1).withdrawToken(ethers.constants.AddressZero, 100, ethers.constants.AddressZero)).to.be.revertedWith(
            "Unauthorized"
        );

        await expect(treasury.connect(otherAddress1).setBondData(ethers.constants.AddressZero, true, 100, 100)).to.be.revertedWith(
            "Unauthorized"
        );

        await expect(treasury.connect(otherAddress1).passOwnership(ethers.constants.AddressZero)).to.be.revertedWith(
            "Unauthorized"
        );

        await expect(treasury.connect(otherAddress1).acceptOwnership()).to.be.revertedWith(
            "Unauthorized"
        );

        await expect(treasury.connect(otherAddress1).changeDAO(ethers.constants.AddressZero)).to.be.revertedWith(
            "Unauthorized"
        );

        await expect(treasury.connect(otherAddress1).getReward(100)).to.be.revertedWith(
            "Unauthorized"
        );
    });
    it("State Getters", async () => {
        const {
            treasury,
            mockToken,
            mockBond,
            mockDAO,
            deployer,
            otherAddress1
        } = await snapshot();

        const getOwnerCall = await treasury.getOwner();
        expect(getOwnerCall).to.equal(deployer.address);

        const getPendingOwnerCall = await treasury.getPendingOwner();
        expect(getPendingOwnerCall).to.equal(ethers.constants.AddressZero);

        const getDAOCall = await treasury.getDAO();
        expect(getDAOCall).to.equal(mockDAO.address);

        const getTokenCall = await treasury.getToken();
        expect(getTokenCall).to.equal(mockToken.address);

        // Bond not registered by default

        const getIsRegisteredBondCall = await treasury.getIsRegisteredBond(mockBond.address);
        expect(getIsRegisteredBondCall).to.equal(false);

        const getBondTokenAllowanceCall = await treasury.getBondTokenAllowance(mockBond.address);
        expect(getBondTokenAllowanceCall).to.equal(0);

        const getBondFeeCall = await treasury.getBondFee(mockBond.address);
        expect(getBondFeeCall).to.equal(0);
    });
    it("Pass Ownership", async () => {
        const {
            deployer,
            otherAddress1,
            treasury
        } = await snapshot();

        await expect(treasury.connect(otherAddress1).passOwnership(otherAddress1.address)).to.be.revertedWith(
            "Unauthorized"
        );

        await treasury.connect(deployer).passOwnership(otherAddress1.address);

        const getPendingOwnerCall = await treasury.getPendingOwner();
        expect(getPendingOwnerCall).to.equal(otherAddress1.address);

        await expect(treasury.connect(deployer).acceptOwnership()).to.be.revertedWith(
            "Unauthorized"
        );

        await treasury.connect(otherAddress1).acceptOwnership();

        const getPendingOwnerCall2 = await treasury.getPendingOwner();
        const getOwnerCall = await treasury.getOwner();
        expect(getPendingOwnerCall2).to.equal(ethers.constants.AddressZero);
        expect(getOwnerCall).to.equal(otherAddress1.address);

        await expect(treasury.connect(deployer).passOwnership(otherAddress1.address)).to.be.revertedWith(
            "Unauthorized"
        );

        await treasury.connect(otherAddress1).passOwnership(deployer.address);
    });
    it("withdraw tokens", async () => {
        const {
            deployer,
            mockToken,
            treasury,
            otherAddress1
        } = await snapshot();

        const getBalanceBeforeTransfer = await mockToken.balanceOf(treasury.address);
        expect(getBalanceBeforeTransfer).to.equal(0);

        const getOABalanceBeforeTransfer = await mockToken.balanceOf(otherAddress1.address);
        expect(getOABalanceBeforeTransfer).to.equal(0);

        await mockToken.connect(deployer).transfer(treasury.address, ethers.utils.parseEther('100'));

        const getBalanceAfterTransfer = await mockToken.balanceOf(treasury.address);
        expect(getBalanceAfterTransfer).to.equal(ethers.utils.parseEther('100'));

        await treasury.connect(deployer).withdrawToken(mockToken.address, ethers.utils.parseEther('100'), otherAddress1.address);

        const getOABalanceAfterTransfer = await mockToken.balanceOf(otherAddress1.address);
        expect(getOABalanceAfterTransfer).to.equal(ethers.utils.parseEther('100'));

        const getTresBalAfter = await mockToken.balanceOf(treasury.address);
        expect(getTresBalAfter).to.equal(0);
    });
    it("Set Bond Data", async () => {
        const {
            mockBond,
            deployer,
            treasury
        } = await snapshot();

        await treasury.connect(deployer).setBondData(
            mockBond.address,
            false,
            0,
            0
        );

        const getEnabledBeforeCall = await treasury.getIsRegisteredBond(mockBond.address);
        expect(getEnabledBeforeCall).to.equal(false);

        const getAllowanceBeforeCall = await treasury.getBondTokenAllowance(mockBond.address);
        expect(getAllowanceBeforeCall).to.equal(0);

        const getFeeBeforeCall = await treasury.getBondFee(mockBond.address);
        expect(getFeeBeforeCall).to.equal(0);

        await treasury.connect(deployer).setBondData(
            mockBond.address,
            true,
            ethers.utils.parseEther('1000000'), // 1,000,000 RADAR
            100 // 1% fee
        );

        const getEnabledAfterCall = await treasury.getIsRegisteredBond(mockBond.address);
        expect(getEnabledAfterCall).to.equal(true);

        const getAllowanceAfterCall = await treasury.getBondTokenAllowance(mockBond.address);
        expect(getAllowanceAfterCall).to.equal(ethers.utils.parseEther('1000000'));

        const getFeeAfterCall = await treasury.getBondFee(mockBond.address);
        expect(getFeeAfterCall).to.equal(100);
    });
    it("Change DAO", async () => {
        const {
            treasury,
            mockDAO,
            otherAddress1,
            deployer
        } = await snapshot();

        const getDAOBefore = await treasury.getDAO();
        expect(getDAOBefore).to.equal(mockDAO.address);

        await treasury.connect(deployer).changeDAO(otherAddress1.address);

        const getDAOAfter = await treasury.getDAO();
        expect(getDAOAfter).to.equal(otherAddress1.address);
    });
    it("Get Reward", async () => {
        const {
            treasury,
            deployer,
            mockDAO,
            mockToken,
            mockBond
        } = await snapshot();

        // Register Bond
        await treasury.connect(deployer).setBondData(
            mockBond.address,
            true,
            ethers.utils.parseEther('10'), // 10 RADAR
            0
        );

        const getAllowanceBefore = await treasury.getBondTokenAllowance(mockBond.address);
        expect(getAllowanceBefore).to.equal(ethers.utils.parseEther('10'));

        // Get reward (no tokens)
        await expect(treasury.connect(mockBond).getReward(ethers.utils.parseEther('2'))).to.be.revertedWith(
            "Not enough tokens for reward"
        );

        // Transfer tokens
        await mockToken.connect(deployer).transfer(treasury.address, ethers.utils.parseEther('50'));

        // Get reward
        await treasury.connect(mockBond).getReward(ethers.utils.parseEther('6'));

        // Get reward (no allowance)
        await expect(treasury.connect(mockBond).getReward(ethers.utils.parseEther('6'))).to.be.revertedWith(
            "Bond Sold Out"
        );

        // States after
        const getAllowanceAfter = await treasury.getBondTokenAllowance(mockBond.address);
        expect(getAllowanceAfter).to.equal(ethers.utils.parseEther('4'));
        const getTreasuryTokenBalanceAfter = await mockToken.balanceOf(treasury.address);
        expect(getTreasuryTokenBalanceAfter).to.equal(ethers.utils.parseEther('44'));
        const getBondBalanceAfter = await mockToken.balanceOf(mockBond.address);
        expect(getBondBalanceAfter).to.equal(ethers.utils.parseEther('6'));

        await treasury.connect(deployer).setBondData(
            mockBond.address,
            true,
            ethers.utils.parseEther('44'),
            0
        );

        await treasury.connect(mockBond).getReward(ethers.utils.parseEther('44'));

        const getAllowanceAfter2 = await treasury.getBondTokenAllowance(mockBond.address);
        expect(getAllowanceAfter2).to.equal(0);
        const getTreasuryTokenBalanceAfter2 = await mockToken.balanceOf(treasury.address);
        expect(getTreasuryTokenBalanceAfter2).to.equal(0);
        const getBondBalanceAfter2 = await mockToken.balanceOf(mockBond.address);
        expect(getBondBalanceAfter2).to.equal(ethers.utils.parseEther('50'));
    });
    it("Get Reward (with fee)", async () => {
        const {
            treasury,
            deployer,
            mockDAO,
            mockToken,
            mockBond
        } = await snapshot();

        // Register Bond
        await treasury.connect(deployer).setBondData(
            mockBond.address,
            true,
            ethers.utils.parseEther('10'), // 10 RADAR
            1000 // 10%
        );

        const getAllowanceBefore = await treasury.getBondTokenAllowance(mockBond.address);
        expect(getAllowanceBefore).to.equal(ethers.utils.parseEther('10'));

        // Get reward (no tokens)
        await expect(treasury.connect(mockBond).getReward(ethers.utils.parseEther('2'))).to.be.revertedWith(
            "Not enough tokens for reward"
        );

        // Transfer tokens
        await mockToken.connect(deployer).transfer(treasury.address, ethers.utils.parseEther('50'));

        // Get reward
        await treasury.connect(mockBond).getReward(ethers.utils.parseEther('6'));

        // Get reward (no allowance)
        await expect(treasury.connect(mockBond).getReward(ethers.utils.parseEther('6'))).to.be.revertedWith(
            "Bond Sold Out"
        );

        // States after
        const getAllowanceAfter = await treasury.getBondTokenAllowance(mockBond.address);
        expect(getAllowanceAfter).to.equal(ethers.utils.parseEther('4'));
        const getTreasuryTokenBalanceAfter = await mockToken.balanceOf(treasury.address);
        expect(getTreasuryTokenBalanceAfter).to.equal(ethers.utils.parseEther('44'));
        const getBondBalanceAfter = await mockToken.balanceOf(mockBond.address);
        expect(getBondBalanceAfter).to.equal(ethers.utils.parseEther('5.4'));
        const getDAOBalanceAfter = await mockToken.balanceOf(mockDAO.address);
        expect(getDAOBalanceAfter).to.equal(ethers.utils.parseEther('0.6'));

        await treasury.connect(deployer).setBondData(
            mockBond.address,
            true,
            ethers.utils.parseEther('44'),
            1000 // 10%
        );

        await treasury.connect(mockBond).getReward(ethers.utils.parseEther('44'));

        const getAllowanceAfter2 = await treasury.getBondTokenAllowance(mockBond.address);
        expect(getAllowanceAfter2).to.equal(0);
        const getTreasuryTokenBalanceAfter2 = await mockToken.balanceOf(treasury.address);
        expect(getTreasuryTokenBalanceAfter2).to.equal(0);
        const getBondBalanceAfter2 = await mockToken.balanceOf(mockBond.address);
        expect(getBondBalanceAfter2).to.equal(ethers.utils.parseEther('45'));
        const getDAOBalanceAfter2 = await mockToken.balanceOf(mockDAO.address);
        expect(getDAOBalanceAfter2).to.equal(ethers.utils.parseEther('5'));
    });
});