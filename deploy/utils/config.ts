import { constants } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

export async function saveConfig(hre: HardhatRuntimeEnvironment, data: DeploymentConfig) {
  await hre.deployments.save('Config', {
    abi: [],
    address: constants.AddressZero,
    linkedData: data,
  });
}

export async function loadConfig(hre: HardhatRuntimeEnvironment) {
  const deployment = await hre.deployments.get('Config');
  return deployment.linkedData as DeploymentConfig;
}

export async function hasConfig(hre: HardhatRuntimeEnvironment): Promise<boolean> {
  return !!(await hre.deployments.getOrNull('Config'));
}

export interface DeploymentConfig {
  // Deployment Metadata
  ENABLED: boolean,
  DEPLOYMENT_TYPE: string,
  NETWORK: Number,

  // Core & Bond Deployment
  PAYOUT_TOKEN: string,
  
  // Core Deployment
  STAKING_DURATION: Number,
  DAO: string,

  // Bond Deployment
  CORE_TREASURY: string,
  BOND_LP_ASSET: string,
  CORE_STAKING: string,
  MAX_REWARD_PAYOUT: string,
  BOND_VESTING_TIME: string,
  BOND_REWARD_DISCOUNT: string,
  BOND_INITIAL_MINPRICE: string,
  BOND_INITIAL_ALLOWANCE: string,
  BOND_FEE: string,
  BOND_MINPRICELP: string
}

const fn: DeployFunction = async () => {
  // Nothing to do here.
};

fn.tags = ['Config'];

export default fn;
