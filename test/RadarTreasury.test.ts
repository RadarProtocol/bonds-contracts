import { expect } from 'chai';
import { ethers } from 'ethers';
import { RadarBondsTreasury__factory, MockToken__factory } from "./../typechain";

const snapshot = async () => {
    const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
    const deployer = ethers.Wallet.fromMnemonic(
        "test test test test test test test test test test test junk",
        `m/44'/60'/0'/0/0`
    ).connect(provider);
    const mockBond = ethers.Wallet.fromMnemonic(
        "test test test test test test test test test test test junk",
        `m/44'/60'/0'/0/1`
    ).connect(provider);
    const mockDAO = ethers.Wallet.fromMnemonic(
        "test test test test test test test test test test test junk",
        `m/44'/60'/0'/0/2`
    ).connect(provider);
    const otherAddress1 = ethers.Wallet.fromMnemonic(
        "test test test test test test test test test test test junk",
        `m/44'/60'/0'/0/3`
    ).connect(provider);
    

    // CUSTOM
    const tokenFactory = new MockToken__factory(deployer);
    const treasuryFactory = new RadarBondsTreasury__factory(deployer);
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
    it.skip("Set Bond Data", async () => {});
    it.skip("Change DAO", async () => {});
    it.skip("Get Reward", async () => {});
    it.skip("Get Reward (with fee)", async () => {});
});