import { expect } from 'chai';
import { ethers } from 'hardhat';
import { signERC2612Permit } from 'eth-permit';

const snapshot = async () => {
    const [deployer, otherAddress1, investor1, investor2, investor3] = await ethers.getSigners();
    

    // CUSTOM
    const tokenFactory = await ethers.getContractFactory("MockToken");
    const mockToken = await tokenFactory.deploy();

    const sRADARFactory = await ethers.getContractFactory("StakedRadar");
    const sRADAR = await sRADARFactory.deploy(
        mockToken.address,
        86400 // 24 hours
    );

    return {
        deployer,
        otherAddress1,
        investor1,
        investor2,
        investor3,
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
                ethers.utils.keccak256("0x5374616b6564205261646172"),
                ethers.utils.keccak256("0x31"),
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
    it("Share Price", async () => {
        const {
            sRADAR,
            mockToken,
            investor1
        } = await snapshot();

        await mockToken.transfer(investor1.address, ethers.utils.parseEther('1'));
        // Share price should be 1e18
        const sp1 = await sRADAR.sharePrice();
        expect(sp1).to.eq(ethers.utils.parseEther("1"));

        // Share price should be 1e18
        await mockToken.connect(investor1).approve(sRADAR.address, ethers.utils.parseEther("1"));
        await sRADAR.connect(investor1).stake(ethers.utils.parseEther("1"));

        const sp2 = await sRADAR.sharePrice();
        expect(sp2).to.eq(ethers.utils.parseEther("1"));

        // Share price should be 2*1e18
        await mockToken.transfer(sRADAR.address, ethers.utils.parseEther("1"));

        const sp3 = await sRADAR.sharePrice();
        expect(sp3).to.eq(ethers.utils.parseEther("2"));
    });
    it("Stake and Withdraw", async () => {
        const {
            sRADAR,
            mockToken,
            investor1,
            investor2
        } = await snapshot();

        await mockToken.transfer(investor1.address, ethers.utils.parseEther("10"));
        await mockToken.transfer(investor2.address, ethers.utils.parseEther("40"));

        const ts1 = await sRADAR.totalSupply();
        expect(ts1).to.eq(0);

        const mt11 = await mockToken.balanceOf(investor1.address);
        const mt21 = await mockToken.balanceOf(investor2.address);
        expect(mt11).to.eq(ethers.utils.parseEther("10"));
        expect(mt21).to.eq(ethers.utils.parseEther("40"));

        await mockToken.connect(investor1).approve(sRADAR.address, ethers.utils.parseEther("10"));
        await mockToken.connect(investor2).approve(sRADAR.address, ethers.utils.parseEther("40"));

        await sRADAR.connect(investor1).stake(ethers.utils.parseEther("10"));
        await sRADAR.connect(investor2).stake(ethers.utils.parseEther("40"));

        const ts2 = await sRADAR.totalSupply();
        expect(ts2).to.eq(ethers.utils.parseEther("50"));

        const mt12 = await mockToken.balanceOf(investor1.address);
        const mt22 = await mockToken.balanceOf(investor2.address);
        expect(mt12).to.eq(0);
        expect(mt22).to.eq(0);

        const i1b1 = await sRADAR.balanceOf(investor1.address);
        const i2b1 = await sRADAR.balanceOf(investor2.address);
        expect(i1b1).to.eq(ethers.utils.parseEther("10"));
        expect(i2b1).to.eq(ethers.utils.parseEther("40"));

        // Pass lock period
        await (investor1.provider as any).send("evm_increaseTime", [86400]);

        await sRADAR.connect(investor1).withdraw(investor1.address, ethers.utils.parseEther("10"));
        await sRADAR.connect(investor2).withdraw(investor2.address, ethers.utils.parseEther("40"));

        const mt13 = await mockToken.balanceOf(investor1.address);
        const mt23 = await mockToken.balanceOf(investor2.address);
        expect(mt13).to.eq(ethers.utils.parseEther("10"));
        expect(mt23).to.eq(ethers.utils.parseEther("40"));

        const i1b2 = await sRADAR.balanceOf(investor1.address);
        const i2b2 = await sRADAR.balanceOf(investor2.address);
        expect(i1b2).to.eq(0);
        expect(i2b2).to.eq(0);

        const ts3 = await sRADAR.totalSupply();
        expect(ts3).to.eq(0);
    });
    it("Stake and Withdraw with Reward", async () => {
        const {
            sRADAR,
            mockToken,
            investor1,
            investor2,
            investor3
        } = await snapshot();

        await mockToken.transfer(investor1.address, ethers.utils.parseEther("10"));
        await mockToken.transfer(investor2.address, ethers.utils.parseEther("40"));
        await mockToken.transfer(investor3.address, ethers.utils.parseEther("100"));

        const ts1 = await sRADAR.totalSupply();
        expect(ts1).to.eq(0);

        const mt11 = await mockToken.balanceOf(investor1.address);
        const mt21 = await mockToken.balanceOf(investor2.address);
        expect(mt11).to.eq(ethers.utils.parseEther("10"));
        expect(mt21).to.eq(ethers.utils.parseEther("40"));

        await mockToken.connect(investor1).approve(sRADAR.address, ethers.utils.parseEther("10"));
        await mockToken.connect(investor2).approve(sRADAR.address, ethers.utils.parseEther("40"));
        await mockToken.connect(investor3).approve(sRADAR.address, ethers.utils.parseEther("100"));

        await sRADAR.connect(investor1).stake(ethers.utils.parseEther("10"));
        await sRADAR.connect(investor2).stake(ethers.utils.parseEther("40"));

        const ts2 = await sRADAR.totalSupply();
        expect(ts2).to.eq(ethers.utils.parseEther("50"));

        await mockToken.transfer(sRADAR.address, ethers.utils.parseEther("100"));

        await sRADAR.connect(investor3).stake(ethers.utils.parseEther("100"));

        const mt12 = await mockToken.balanceOf(investor1.address);
        const mt22 = await mockToken.balanceOf(investor2.address);
        expect(mt12).to.eq(0);
        expect(mt22).to.eq(0);

        const i1b1 = await sRADAR.balanceOf(investor1.address);
        const i2b1 = await sRADAR.balanceOf(investor2.address);
        const i3b1 = await sRADAR.balanceOf(investor3.address);
        expect(i1b1).to.eq(ethers.utils.parseEther("10"));
        expect(i2b1).to.eq(ethers.utils.parseEther("40"));
        expect(i3b1).to.eq(ethers.utils.parseEther("100").div(3));

        const sp = await sRADAR.sharePrice();
        expect(sp).to.eq(ethers.utils.parseEther("3"));

        // Pass lock period
        await (investor1.provider as any).send("evm_increaseTime", [86400]);

        await sRADAR.connect(investor1).withdraw(investor1.address, ethers.utils.parseEther("10"));
        await sRADAR.connect(investor2).withdraw(investor2.address, ethers.utils.parseEther("40"));
        await sRADAR.connect(investor3).withdraw(investor3.address, ethers.utils.parseEther("100"));

        const mt13 = await mockToken.balanceOf(investor1.address);
        const mt23 = await mockToken.balanceOf(investor2.address);
        const mt33 = await mockToken.balanceOf(investor3.address);
        expect(mt13).to.eq(ethers.utils.parseEther("30"));
        expect(mt23).to.eq(ethers.utils.parseEther("120"));
        expect(mt33).to.eq(ethers.utils.parseEther("100"));

        const i1b2 = await sRADAR.balanceOf(investor1.address);
        const i2b2 = await sRADAR.balanceOf(investor2.address);
        const i3b2 = await sRADAR.balanceOf(investor3.address);
        expect(i1b2).to.eq(0);
        expect(i2b2).to.eq(0);
        expect(i3b2).to.eq(0);

        const ts3 = await sRADAR.totalSupply();
        expect(ts3).to.eq(0);
    });
    it("Withdraw for", async () => {
        const {
            sRADAR,
            mockToken,
            investor1,
            investor2
        } = await snapshot();
        const amount = ethers.utils.parseEther("10");

        await mockToken.transfer(investor1.address, amount);

        await mockToken.connect(investor1).approve(sRADAR.address, amount);
        await sRADAR.connect(investor1).stake(amount);

        // Pass lock period
        await (investor1.provider as any).send("evm_increaseTime", [86400]);

        const bbefore = await mockToken.balanceOf(investor2.address);
        expect(bbefore).to.eq(0);

        await expect(sRADAR.connect(investor2).withdrawFor(investor1.address, investor2.address, amount)).to.be.revertedWith(
            "ERC20: transfer amount exceeds allowance"
        );

        // Do approve
        await sRADAR.connect(investor1).approve(investor2.address, amount);
        const a1 = await sRADAR.allowance(investor1.address, investor2.address);
        expect(a1).to.eq(amount);

        // withdrawFor and check balances
        await sRADAR.connect(investor2).withdrawFor(investor1.address, investor2.address, amount);
        const b = await mockToken.balanceOf(investor2.address);
        expect(b).to.eq(amount);
        const bi1 = await sRADAR.balanceOf(investor1.address);
        const bii1 = await mockToken.balanceOf(investor1.address);
        expect(bi1).to.eq(bii1).to.eq(0);

        // check allowance
        const a2 = await sRADAR.allowance(investor1.address, investor2.address);
        expect(a2).to.eq(0);
    });
    it("Token Locks", async () => {
        const {
            sRADAR,
            investor1,
            investor2,
            mockToken
        } = await snapshot();

        const amount = ethers.utils.parseEther("10")

        await mockToken.transfer(investor1.address, amount.mul(2));
        await mockToken.transfer(investor2.address, amount.mul(4));
        await mockToken.connect(investor1).approve(sRADAR.address, ethers.utils.parseEther("100000"));
        await mockToken.connect(investor2).approve(sRADAR.address, ethers.utils.parseEther("100000"));

        // Deposit and check locks and user unlock time
        await sRADAR.connect(investor1).stake(amount);
        var lblock = await (investor1.provider as any).getBlock('latest');
        var unlockTime = lblock.timestamp + 86400;
        const getUT = await sRADAR.getUserUnlockTime(investor1.address);
        expect(getUT).to.be.closeTo(ethers.BigNumber.from(unlockTime), 5);

        await expect(sRADAR.connect(investor1).withdraw(investor1.address, amount)).to.be.revertedWith(
            "Tokens Locked"
        );
        await expect(sRADAR.connect(investor1).transfer(investor2.address, amount)).to.be.revertedWith(
            "Tokens Locked"
        );
        await sRADAR.connect(investor1).approve(investor2.address, amount);
        await expect(sRADAR.connect(investor2).transferFrom(investor1.address, investor2.address, amount)).to.be.revertedWith(
            "Tokens Locked"
        );
        await expect(sRADAR.connect(investor2).withdrawFor(investor1.address, investor2.address, amount)).to.be.revertedWith(
            "Tokens Locked"
        );

        // Pass time to still locked and check only 1 lock
        await (investor1.provider as any).send("evm_increaseTime", [86000]);
        await expect(sRADAR.connect(investor1).withdraw(investor1.address, amount)).to.be.revertedWith(
            "Tokens Locked"
        );
        await (investor1.provider as any).send("evm_increaseTime", [500]);
        await sRADAR.connect(investor2).withdrawFor(investor1.address, investor2.address, amount);

        // Deposit again and change lock time and check user's already deposited unlock time
        await sRADAR.connect(investor1).stake(amount);
        lblock = await (investor1.provider as any).getBlock('latest');
        unlockTime = lblock.timestamp + 86400;
        await sRADAR.changeLockTime(86400*2); // 2 days
        const getUT2 = await sRADAR.getUserUnlockTime(investor1.address);
        expect(getUT2).to.be.closeTo(ethers.BigNumber.from(unlockTime), 5);
        await (investor1.provider as any).send("evm_increaseTime", [86400]);
        await sRADAR.connect(investor1).withdraw(investor1.address, amount);

        // Deposit new user with new lock time
        await sRADAR.connect(investor2).stake(amount);
        var lblock = await (investor1.provider as any).getBlock('latest');
        var unlockTime = lblock.timestamp + 86400*2;
        const getUT3 = await sRADAR.getUserUnlockTime(investor2.address);
        expect(getUT3).to.be.closeTo(ethers.BigNumber.from(unlockTime), 5);

        await expect(sRADAR.connect(investor2).withdraw(investor2.address, amount)).to.be.revertedWith(
            "Tokens Locked"
        );
        await (investor1.provider as any).send("evm_increaseTime", [86400]);
        await expect(sRADAR.connect(investor2).withdraw(investor2.address, amount)).to.be.revertedWith(
            "Tokens Locked"
        );
        await (investor1.provider as any).send("evm_increaseTime", [86400]);
        await sRADAR.connect(investor2).withdraw(investor1.address, amount);

        // Deposit, check lock time, then deposit again and check lock time (and lock)
        await sRADAR.connect(investor2).stake(amount);
        lblock = await (investor1.provider as any).getBlock('latest');
        unlockTime = lblock.timestamp + 86400*2;
        const getUT4 = await sRADAR.getUserUnlockTime(investor2.address);
        expect(getUT4).to.be.closeTo(ethers.BigNumber.from(unlockTime), 5);

        await (investor1.provider as any).send("evm_increaseTime", [86400/2]);

        await sRADAR.connect(investor2).stake(amount);
        lblock = await (investor1.provider as any).getBlock('latest');
        unlockTime = lblock.timestamp + 86400*2;
        const getUT5 = await sRADAR.getUserUnlockTime(investor2.address);
        expect(getUT5).to.be.closeTo(ethers.BigNumber.from(unlockTime), 5);

        await (investor1.provider as any).send("evm_increaseTime", [86400/2]);

        await expect(sRADAR.connect(investor2).withdraw(investor2.address, amount)).to.be.revertedWith(
            "Tokens Locked"
        );
    });
    it("ERC20 functions", async () => {
        const {
            sRADAR,
            mockToken,
            investor1,
            investor2
        } = await snapshot();

        const amount = ethers.utils.parseEther("10");
        await mockToken.transfer(investor1.address, amount);
        await mockToken.connect(investor1).approve(sRADAR.address, amount);

        await sRADAR.connect(investor1).stake(amount);
        await (investor1.provider as any).send("evm_increaseTime", [86400]);

        // transfer
        const bb1 = await sRADAR.balanceOf(investor1.address);
        const bb2 = await sRADAR.balanceOf(investor2.address);
        expect(bb1).to.eq(amount);
        expect(bb2).to.eq(0);

        await sRADAR.connect(investor1).transfer(investor2.address, amount);

        const bb3 = await sRADAR.balanceOf(investor1.address);
        const bb4 = await sRADAR.balanceOf(investor2.address);
        expect(bb3).to.eq(0);
        expect(bb4).to.eq(amount);

        // approve
        const ab = await sRADAR.allowance(investor2.address, investor1.address);
        expect(ab).to.eq(0);

        await sRADAR.connect(investor2).approve(investor1.address, amount);

        const aa = await sRADAR.allowance(investor2.address, investor1.address);
        expect(aa).to.eq(amount);

        // transferFrom & allowance
        await sRADAR.connect(investor1).transferFrom(investor2.address, investor1.address, amount);

        const aaa = await sRADAR.allowance(investor2.address, investor1.address);
        expect(aaa).to.eq(0);

        const bb5 = await sRADAR.balanceOf(investor1.address);
        const bb6 = await sRADAR.balanceOf(investor2.address);
        expect(bb5).to.eq(amount);
        expect(bb6).to.eq(0);
    });
    it("EIP-2612 permit() Implementation", async () => {
        const {
            mockToken,
            sRADAR,
            investor1,
            investor2
        } = await snapshot();

        // Deposit for investor1
        const amount = ethers.utils.parseEther("10");
        await mockToken.transfer(investor1.address, amount);
        await mockToken.connect(investor1).approve(sRADAR.address, amount);

        await sRADAR.connect(investor1).stake(amount);
        await (investor1.provider as any).send("evm_increaseTime", [86400]);

        // Construct permit() message from investor1
        const sig1 = await signERC2612Permit(
            investor1,
            sRADAR.address,
            investor1.address,
            investor2.address,
            amount.toString()
        );
        await sRADAR.connect(investor2).permit(
            investor1.address,
            investor2.address,
            amount,
            sig1.deadline,
            sig1.v,
            sig1.r,
            sig1.s
        );

        // Check allowance
        const a1 = await sRADAR.allowance(investor1.address, investor2.address);
        expect(a1).to.eq(amount);

        // tranferFrom()
        await sRADAR.connect(investor2).transferFrom(investor1.address, investor2.address, amount);

        // Check allowance
        const a2 = await sRADAR.allowance(investor1.address, investor2.address);
        expect(a2).to.eq(0);

        // Construct permit() from investor2 (small deadline)
        var lblock = await (investor1.provider as any).getBlock('latest');
        var ddl = lblock.timestamp + 100;
        await (investor1.provider as any).send("evm_increaseTime", [500]);

        const sig2 = await signERC2612Permit(
            investor2,
            sRADAR.address,
            investor2.address,
            investor1.address,
            amount.toString(),
            ddl
        );
        await expect(
            sRADAR.connect(investor2).permit(
                investor2.address,
                investor1.address,
                amount,
                sig2.deadline,
                sig2.v,
                sig2.r,
                sig2.s
            )
        )
        .to.be.revertedWith(
            "Permit: EXPIRED"
        );

        // Forged signature (reuse nonce)
        await expect(
            sRADAR.connect(investor2).permit(
                investor1.address,
                investor2.address,
                amount,
                sig1.deadline,
                sig1.v,
                sig1.r,
                sig1.s
            )
        )
        .to.be.revertedWith(
            "Permit: INVALID_SIGNATURE"
        );

        // Signature investor 2
        const sig3 = await signERC2612Permit(
            investor2,
            sRADAR.address,
            investor2.address,
            investor1.address,
            amount.toString()
        );
        await sRADAR.permit(
            investor2.address,
            investor1.address,
            amount,
            sig3.deadline,
            sig3.v,
            sig3.r,
            sig3.s
        );
        await sRADAR.connect(investor1).transferFrom(investor2.address, investor1.address, amount);

        // Second signature investor 1
        const sig4 = await signERC2612Permit(
            investor1,
            sRADAR.address,
            investor1.address,
            investor2.address,
            amount.toString()
        );
        await sRADAR.connect(investor2).permit(
            investor1.address,
            investor2.address,
            amount,
            sig4.deadline,
            sig4.v,
            sig4.r,
            sig4.s
        );

        await sRADAR.connect(investor2).transferFrom(investor1.address, investor2.address, amount);
    });
});