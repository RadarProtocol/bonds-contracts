import { DeployFunction } from 'hardhat-deploy/types';

import { loadConfig } from '../utils/config';

const fn: DeployFunction = async function (hre) {
    const {
        deployments: { deploy, get },
        ethers: { getSigners }
    } = hre;

    const deployer = (await getSigners())[0];
    const config = await loadConfig(hre);
    const treasury = await get('RadarBondsTreasury');

    await deploy('RadarStaking', {
        from: deployer.address,
        args: [
            config.PAYOUT_TOKEN,
            config.PAYOUT_TOKEN,
            config.STAKING_DURATION,
            treasury.address
        ],
        log: true,
        skipIfAlreadyDeployed: true
    });
}

fn.tags = ['Core', 'RadarStaking'];
fn.dependencies = ['Config', 'RadarBondsTreasury'];
fn.skip = async (hre) => {
  // Skip this on non-core deployments
  const config = await loadConfig(hre);
  return config.DEPLOYMENT_TYPE != "CORE"
};

export default fn;
