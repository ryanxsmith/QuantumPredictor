import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { QuantumPredictor, QuantumPredictor__factory } from "../types";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

describe("QuantumPredictor", function () {
  let signers: Signers;
  let predictor: QuantumPredictor;
  let predictorAddress: string;

  before(async function () {
    const accounts: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: accounts[0], alice: accounts[1], bob: accounts[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      this.skip();
    }

    const factory = (await ethers.getContractFactory("QuantumPredictor")) as QuantumPredictor__factory;
    predictor = (await factory.deploy()) as QuantumPredictor;
    predictorAddress = await predictor.getAddress();
  });

  async function decryptCounts(handles: string[]) {
    const values: bigint[] = [];
    for (const enc of handles) {
      values.push(await fhevm.publicDecryptEuint(FhevmType.euint32, enc));
    }
    return values;
  }

  it("creates a prediction with encrypted zeroed counts", async function () {
    await predictor.createPrediction("BTC price", ["Up", "Down"]);
    await predictor.closePrediction(0);

    const counts = await predictor.getEncryptedCounts(0);
    const clearCounts = await decryptCounts(counts);
    expect(clearCounts[0]).to.eq(0);
    expect(clearCounts[1]).to.eq(0);
  });

  it("accepts a vote and increments the encrypted counter", async function () {
    await predictor.createPrediction("Weather", ["Sunny", "Rain"]);

    const encryptedInput = await fhevm
      .createEncryptedInput(predictorAddress, signers.alice.address)
      .add32(1)
      .encrypt();

    await predictor
      .connect(signers.alice)
      .submitChoice(0, encryptedInput.handles[0], encryptedInput.inputProof);

    await predictor.closePrediction(0);

    const counts = await predictor.getEncryptedCounts(0);
    const clearCounts = await decryptCounts(counts);

    expect(clearCounts[0]).to.eq(0);
    expect(clearCounts[1]).to.eq(1);
  });

  it("prevents duplicate votes from the same address", async function () {
    await predictor.createPrediction("Launch", ["On time", "Delayed", "Cancelled"]);

    const encryptedInput = await fhevm
      .createEncryptedInput(predictorAddress, signers.bob.address)
      .add32(0)
      .encrypt();

    await predictor
      .connect(signers.bob)
      .submitChoice(0, encryptedInput.handles[0], encryptedInput.inputProof);

    await expect(
      predictor.connect(signers.bob).submitChoice(0, encryptedInput.handles[0], encryptedInput.inputProof),
    ).to.be.revertedWith("Already voted");
  });
});
