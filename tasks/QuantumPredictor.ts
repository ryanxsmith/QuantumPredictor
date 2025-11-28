import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:predictor-address", "Prints the QuantumPredictor address").setAction(async function (_taskArgs, hre) {
  const contract = await hre.deployments.get("QuantumPredictor");
  console.log(`QuantumPredictor address: ${contract.address}`);
});

task("task:create-prediction", "Create a new encrypted prediction")
  .addParam("name", "Prediction title")
  .addVariadicPositionalParam("options", "Prediction options (2 to 4 labels)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;
    const contractDeployment = await deployments.get("QuantumPredictor");
    const signer = (await ethers.getSigners())[0];
    const predictor = await ethers.getContractAt("QuantumPredictor", contractDeployment.address);

    const options: string[] = taskArguments.options as string[];
    if (options.length < 2 || options.length > 4) {
      throw new Error("You must provide between 2 and 4 options");
    }

    const tx = await predictor.connect(signer).createPrediction(taskArguments.name as string, options);
    console.log(`Waiting for tx ${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`Prediction created in tx ${tx.hash} (status=${receipt?.status})`);
  });

task("task:vote", "Submit an encrypted vote for a prediction")
  .addParam("prediction", "Prediction id")
  .addParam("option", "Zero-based option index to encrypt")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const contractDeployment = await deployments.get("QuantumPredictor");
    const signer = (await ethers.getSigners())[0];
    const predictor = await ethers.getContractAt("QuantumPredictor", contractDeployment.address);

    const optionIndex = parseInt(taskArguments.option as string, 10);
    if (!Number.isInteger(optionIndex)) {
      throw new Error("Option must be an integer");
    }

    const encryptedInput = await fhevm
      .createEncryptedInput(contractDeployment.address, signer.address)
      .add32(optionIndex)
      .encrypt();

    const tx = await predictor
      .connect(signer)
      .submitChoice(taskArguments.prediction, encryptedInput.handles[0], encryptedInput.inputProof);
    console.log(`Waiting for tx ${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`Vote submitted (status=${receipt?.status})`);
  });

task("task:decrypt-counts", "Decrypt the counts for a prediction (requires it to be closed)")
  .addParam("prediction", "Prediction id")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const contractDeployment = await deployments.get("QuantumPredictor");
    const signer = (await ethers.getSigners())[0];
    const predictor = await ethers.getContractAt("QuantumPredictor", contractDeployment.address);

    const encryptedCounts = await predictor.getEncryptedCounts(taskArguments.prediction);
    console.log("Encrypted counts:", encryptedCounts);

    const clearCounts = await Promise.all(
      encryptedCounts.map((enc: string) =>
        fhevm.userDecryptEuint(FhevmType.euint32, enc, contractDeployment.address, signer),
      ),
    );

    clearCounts.forEach((count, index) => {
      console.log(`Option ${index}: ${count.toString()}`);
    });
  });
