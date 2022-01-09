import { ethers, utils } from 'ethers';
import { DeployFunction } from 'hardhat-deploy/types';

import { DeploymentConfig, saveConfig } from '../utils/config';

const isDevDeploy = false;

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
const CORE_TREASURY = "0xD9DaA6Ff0e26Fe43e1Ebdc692B11abbAD527ecaB";
const BOND_LP_ASSET = "0x0e01758152b1949f5a98fa871499a7a4914bcb33";
const CORE_STAKING = "0xeb7B13B3ceBa1B833e56510cBC8463285Ff7Ec6d";
const MAX_REWARD_PAYOUT = "1000000000000000000000000000000000";
const BOND_VESTING_TIME = "432000";
const BOND_REWARD_DISCOUNT = "650";
const BOND_INITIAL_MINPRICE = "300000000000000000";
const BOND_INITIAL_ALLOWANCE = "0";
const BOND_FEE = "100";
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