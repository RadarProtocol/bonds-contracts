import { ethers, utils } from 'ethers';
import { DeployFunction } from 'hardhat-deploy/types';

import { DeploymentConfig, saveConfig } from '../utils/config';

const isDevDeploy = false;

// Deployment Metadata
const ENABLED = false;
const DEPLOYMENT_TYPE = "CORE";
const NETWORK = 250;

// Core & Bond Deployment
const PAYOUT_TOKEN = "0x44d2B67187d539E83328aDe72A1b5f9512a74444"; // Radar

// Core Deployment
const STAKING_DURATION = 60*60*24*28; // 28 days
const DAO = "0xd24B1fFBDCc0dbaf0d6aA7422e10b05208aBe71b"; // DAO timelock on BSC

// Bond Deployment
const CORE_TREASURY = ethers.constants.AddressZero;
const BOND_LP_ASSET = ethers.constants.AddressZero;
const CORE_STAKING = ethers.constants.AddressZero;
const MAX_REWARD_PAYOUT = "0";
const BOND_VESTING_TIME = "0";
const BOND_REWARD_DISCOUNT = "0";
const BOND_INITIAL_MINPRICE = "0";
const BOND_INITIAL_ALLOWANCE = "0";
const BOND_FEE = "0";
const BOND_MINPRICELP = ""; // For Single Asset Bonds

const configuration: DeploymentConfig = {
    ENABLED,
    DEPLOYMENT_TYPE,
    NETWORK,
    PAYOUT_TOKEN,
    STAKING_DURATION,
    DAO,
    CORE_TREASURY,
    BOND_LP_ASSET,
    CORE_STAKING,
    MAX_REWARD_PAYOUT,
    BOND_VESTING_TIME,
    BOND_REWARD_DISCOUNT,
    BOND_INITIAL_MINPRICE,
    BOND_INITIAL_ALLOWANCE,
    BOND_FEE,
    BOND_MINPRICELP
}

const fn: DeployFunction = async (hre) => {
    await saveConfig(hre, configuration);
};
  
fn.tags = ['Config'];
fn.skip = async (hre) => {
    // Run this only for mainnet & mainnet forks.
    const chain = parseInt(await hre.getChainId());
    return (chain !== NETWORK && !isDevDeploy) || !ENABLED
};
  
export default fn;