import { ethers, utils } from 'ethers';
import { DeployFunction } from 'hardhat-deploy/types';

import { DeploymentConfig, saveConfig } from '../utils/config';

const isDevDeploy = false;

// Deployment Metadata
const ENABLED = false;
const DEPLOYMENT_TYPE = "BOND_SA";
const NETWORK = 250;

// Core & Bond Deployment
const PAYOUT_TOKEN = "0x44d2B67187d539E83328aDe72A1b5f9512a74444"; // Radar

// Core Deployment
const STAKING_DURATION = 0; // 28 days
const DAO = ""; // DAO timelock on BSC

// Bond Deployment
const CORE_TREASURY = "0x65E6590eb3488a2830031e14bf8C36ABf5E455C8";
const BOND_LP_ASSET = "0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83";
const CORE_STAKING = "0xff71Ae535ED1f11998b7234868D48E3FCB8806F9";
const MAX_REWARD_PAYOUT = "1000000000000000000000000000000000";
const BOND_VESTING_TIME = "432000";
const BOND_REWARD_DISCOUNT = "600";
const BOND_INITIAL_MINPRICE = "103806228400000000";
const BOND_INITIAL_ALLOWANCE = "0";
const BOND_FEE = "100";
const BOND_MINPRICELP = "0xcba7C7E6AadA38614c1a679c3B2Cfe82617aBda2"; // For Single Asset Bonds

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