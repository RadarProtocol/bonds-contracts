import { expect } from 'chai';
import { ethers } from 'hardhat';

const snapshot = async () => {
    const [deployer, otherAddress1, investor1, investor2] = await ethers.getSigners();
    

    // CUSTOM
    const tokenFactory = await ethers.getContractFactory("MockToken");
    const mockToken = await tokenFactory.deploy();

    const sRADARFactory = await ethers.getContractFactory("StakedRadar");
    const sRADAR = await sRADARFactory.deploy(
        mockToken.address,
        86400, // 24 hours
        "1.0"
    );

    return {
        deployer,
        otherAddress1,
        investor1,
        investor2,
        mockToken,
        sRADAR
    }
}

describe("sRADAR", () => {
    it("Initial State Getters", async () => {
        const {
            sRADAR,
            mockToken,
            deployer
        } = await snapshot();

        const getOwner = await sRADAR.owner();
        expect(getOwner).to.eq(deployer.address);

        const getPOwner = await sRADAR.pendingOwner();
        expect(getPOwner).to.eq(ethers.constants.AddressZero);

        const getRadar = await sRADAR.getRADAR();
        expect(getRadar).to.eq(mockToken.address);

        const getLockTime = await sRADAR.getLockTime();
        expect(getLockTime).to.eq(86400);

        const getPermitTypehash = await sRADAR.PERMIT_TYPEHASH();
        const constructedTypehash = ethers.utils.keccak256("0x5065726d69742861646472657373206f776e65722c61646472657373207370656e6465722c75696e743235362076616c75652c75696e74323536206e6f6e63652c75696e7432353620646561646c696e6529");
        expect(getPermitTypehash).to.eq(constructedTypehash);
    });
    it("DOMAIN_SEPARATOR deterministic construction", async () => {
        const {
            sRADAR
        } = await snapshot();

        const actualDS = await sRADAR.DOMAIN_SEPARATOR();

        const coder = new ethers.utils.AbiCoder();
        const expectedDS = ethers.utils.keccak256(coder.encode(
            ["bytes32", "bytes32", "bytes32", "uint", "address"],
            [
                ethers.utils.keccak256("0x454950373132446f6d61696e28737472696e67206e616d652c737472696e672076657273696f6e2c75696e7432353620636861696e49642c6164647265737320766572696679696e67436f6e747261637429"),
                ethers.utils.keccak256("0x735241444152"),
                ethers.utils.keccak256("0x312e30"),
                31337,
                sRADAR.address
            ]
        ));

        expect(actualDS).to.eq(expectedDS);
    });
    it("Access Control", async () => {
        const {
            sRADAR,
            otherAddress1
        } = await snapshot();

        await expect(sRADAR.connect(otherAddress1).changeLockTime(0)).to.be.revertedWith(
            "Unauthorized"
        );

        await expect(sRADAR.connect(otherAddress1).transferOwnership(ethers.constants.AddressZero)).to.be.revertedWith(
            "Unauthorized"
        );

        await expect(sRADAR.claimOwnership()).to.be.revertedWith(
            "Unauthorized"
        );
    });
    it("Pass Ownership", async () => {
        const {
            sRADAR,
            otherAddress1,
            deployer
        } = await snapshot();

        await sRADAR.transferOwnership(otherAddress1.address);

        const getPendingOwner = await sRADAR.pendingOwner();
        const getOwner = await sRADAR.owner();
        expect(getPendingOwner).to.eq(otherAddress1.address);
        expect(getOwner).to.eq(deployer.address);

        await expect(sRADAR.claimOwnership()).to.be.revertedWith("Unauthorized");

        await sRADAR.connect(otherAddress1).claimOwnership();

        const getPendingOwner2 = await sRADAR.pendingOwner();
        const getOwner2 = await sRADAR.owner();
        expect(getPendingOwner2).to.eq(ethers.constants.AddressZero);
        expect(getOwner2).to.eq(otherAddress1.address);

        await expect(sRADAR.transferOwnership(ethers.constants.AddressZero)).to.be.revertedWith("Unauthorized");
        await sRADAR.connect(otherAddress1).transferOwnership(ethers.constants.AddressZero);
    });
    it.skip("Share Price");
    it.skip("Stake and Withdraw");
    it.skip("Stake and Withdraw with Reward");
    it.skip("Withdraw for");
    it.skip("Token Locks");
    it.skip("ERC20 functions");
    it.skip("EIP-2612 permit() Implementation");
});