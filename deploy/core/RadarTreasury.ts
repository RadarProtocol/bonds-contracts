import { DeployFunction } from 'hardhat-deploy/types';

import { loadConfig } from '../utils/config';

const fn: DeployFunction = async function (hre) {
    const {
        deployments: { deploy, get },
        ethers: { getSigners }
    } = hre;

    const deployer = (await getSigners())[0];
    const config = await loadConfig(hre);

    await deploy('RadarBondsTreasury', {
        from: deployer.address,
        args: [
            config.PAYOUT_TOKEN,
            config.DAO
        ],
        log: true,
        skipIfAlreadyDeployed: true
    });
}

fn.tags = ['Core', 'RadarBondsTreasury'];
fn.dependencies = ['Config'];
fn.skip = async (hre) => {
  // Skip this on non-core deployments
  const config = await loadConfig(hre);
  return config.DEPLOYMENT_TYPE != "CORE"
};

export default fn;
