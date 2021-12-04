import { ethers } from 'ethers';
import { DeployFunction } from 'hardhat-deploy/types';

import { loadConfig } from '../utils/config';

const fn: DeployFunction = async function (hre) {
    const {
        deployments: { deploy, get, log },
        ethers: { getSigners, getContractFactory }
    } = hre;

    const deployer = (await getSigners())[0];
    const config = await loadConfig(hre);

    await deploy('RadarBond', {
        from: deployer.address,
        args: [
            config.CORE_TREASURY,
            config.PAYOUT_TOKEN,
            config.BOND_LP_ASSET,
            config.CORE_STAKING,
            config.MAX_REWARD_PAYOUT,
            config.BOND_VESTING_TIME,
            config.BOND_REWARD_DISCOUNT,
            config.BOND_INITIAL_MINPRICE
        ],
        log: true,
        skipIfAlreadyDeployed: true
    });

    // Register Bond
    const RadarBondsTreasuryFactory = await getContractFactory('RadarBondsTreasury');
    const treasury = new ethers.Contract(
        config.CORE_TREASURY,
        RadarBondsTreasuryFactory.interface,
        deployer
    );
    const treasuryOwner = await treasury.getOwner();

    if (treasuryOwner == deployer.address) {
        const deployedBond = await get('RadarBond');

        const receipt = await treasury.setBondData(
            deployedBond.address,
            true,
            config.BOND_INITIAL_ALLOWANCE,
            config.BOND_FEE
        );
        await receipt.wait();

        log("Registered BOND");
    } else {
        log("Couldn't register bond in treasury since I am not the owner. Please register bond manually");
    }
}

fn.tags = ['Bond', 'RadarBond'];
fn.dependencies = ['Config'];
fn.skip = async (hre) => {
  // Skip this on non-core deployments
  const config = await loadConfig(hre);
  return config.DEPLOYMENT_TYPE != "BOND"
};

export default fn;
