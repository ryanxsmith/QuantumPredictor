import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedPredictor = await deploy("QuantumPredictor", {
    from: deployer,
    log: true,
  });

  console.log(`QuantumPredictor contract: `, deployedPredictor.address);
};
export default func;
func.id = "deploy_quantumPredictor"; // id required to prevent reexecution
func.tags = ["QuantumPredictor"];
