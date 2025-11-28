import { expect } from "chai";
import { ethers, deployments, fhevm } from "hardhat";
import { QuantumPredictor } from "../types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { FhevmType } from "@fhevm/hardhat-plugin";

describe("QuantumPredictorSepolia", function () {
  let predictor: QuantumPredictor;
  let predictorAddress: string;
  let signer: HardhatEthersSigner;

  before(async function () {
    if (fhevm.isMock) {
      this.skip();
    }

    try {
      const deployment = await deployments.get("QuantumPredictor");
      predictorAddress = deployment.address;
      predictor = await ethers.getContractAt("QuantumPredictor", deployment.address);
    } catch (error) {
      (error as Error).message += ". Deploy QuantumPredictor to sepolia before running this test.";
      throw error;
    }

    const signers = await ethers.getSigners();
    signer = signers[0];
  });

  it("creates, votes, closes and decrypts counts on Sepolia", async function () {
    this.timeout(5 * 60_000);

    const name = `Quantum Prediction ${Date.now()}`;
    const options = ["Alpha", "Beta"];

    const nextId = await predictor.callStatic.createPrediction(name, options);
    const createTx = await predictor.createPrediction(name, options);
    await createTx.wait();

    const encryptedInput = await fhevm.createEncryptedInput(predictorAddress, signer.address).add32(1).encrypt();
    const voteTx = await predictor
      .connect(signer)
      .submitChoice(nextId, encryptedInput.handles[0], encryptedInput.inputProof);
    await voteTx.wait();

    const closeTx = await predictor.closePrediction(nextId);
    await closeTx.wait();

    const encryptedCounts = await predictor.getEncryptedCounts(nextId);
    const decryptedCounts = await Promise.all(
      encryptedCounts.map((enc) =>
        fhevm.userDecryptEuint(FhevmType.euint32, enc, predictorAddress, signer),
      ),
    );

    expect(decryptedCounts[1]).to.be.greaterThanOrEqual(1);
  });
});
