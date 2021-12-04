import { ethers, utils } from 'ethers';
import { DeployFunction } from 'hardhat-deploy/types';

import { DeploymentConfig, saveConfig } from '../utils/config';

const isDevDeploy = true;

// Deployment Metadata
const ENABLED = false;
const DEPLOYMENT_TYPE = "BOND";
const NETWORK = 56;

// Core & Bond Deployment
const PAYOUT_TOKEN = "0xf03a2dc374d494fbe894563fe22ee544d826aa50"; // Radar

// Core Deployment
const STAKING_DURATION = 0; // 28 days
const DAO = ""; // DAO timelock on BSC

// Bond Deployment
const CORE_TREASURY = "";
const BOND_LP_ASSET = "0x7ff4b96639acde103d4851956d85e6c6623d0948";
const CORE_STAKING = "";
const MAX_REWARD_PAYOUT = 0;
const BOND_VESTING_TIME = 0;
const BOND_REWARD_DISCOUNT = 0;
const BOND_INITIAL_MINPRICE = 0;
const BOND_INITIAL_ALLOWANCE = 0;
const BOND_FEE = 0;

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
    BOND_FEE
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