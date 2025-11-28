// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title QuantumPredictor
/// @notice Encrypted prediction market where votes remain confidential until the market is closed.
/// @dev Counts are stored as encrypted values and made publicly decryptable when a prediction is closed.
contract QuantumPredictor is ZamaEthereumConfig {
    struct Prediction {
        string name;
        string[] options;
        euint32[] encryptedCounts;
        bool isOpen;
        uint256 createdAt;
    }

    Prediction[] private _predictions;
    mapping(uint256 => mapping(address => bool)) private _hasVoted;

    event PredictionCreated(uint256 indexed predictionId, address indexed creator, string name, string[] options);
    event VoteSubmitted(uint256 indexed predictionId, address indexed voter, bytes32 encryptedChoiceHandle);
    event PredictionClosed(uint256 indexed predictionId);

    /// @notice Create a new prediction with 2 to 4 options.
    /// @param name The human readable prediction title.
    /// @param options A list of option labels (must be between 2 and 4).
    /// @return predictionId The identifier of the newly created prediction.
    function createPrediction(string calldata name, string[] calldata options) external returns (uint256 predictionId) {
        require(bytes(name).length > 0, "Name required");
        require(options.length >= 2 && options.length <= 4, "Options must be 2-4");

        for (uint256 i = 0; i < options.length; i++) {
            require(bytes(options[i]).length > 0, "Empty option");
        }

        predictionId = _predictions.length;
        _predictions.push();
        Prediction storage prediction = _predictions[predictionId];

        prediction.name = name;
        prediction.isOpen = true;
        prediction.createdAt = block.timestamp;
        prediction.options = new string[](options.length);
        prediction.encryptedCounts = new euint32[](options.length);

        for (uint256 i = 0; i < options.length; i++) {
            prediction.options[i] = options[i];
            prediction.encryptedCounts[i] = FHE.asEuint32(0);
            FHE.allowThis(prediction.encryptedCounts[i]);
        }

        emit PredictionCreated(predictionId, msg.sender, name, options);
    }

    /// @notice Submit an encrypted option selection for a prediction.
    /// @param predictionId The id of the prediction to vote on.
    /// @param encryptedChoice The encrypted option index selected by the user.
    /// @param inputProof The proof for the encrypted input.
    function submitChoice(uint256 predictionId, externalEuint32 encryptedChoice, bytes calldata inputProof) external {
        require(predictionId < _predictions.length, "Invalid prediction");
        Prediction storage prediction = _predictions[predictionId];
        require(prediction.isOpen, "Prediction closed");
        require(!_hasVoted[predictionId][msg.sender], "Already voted");

        euint32 choice = FHE.fromExternal(encryptedChoice, inputProof);

        euint32 one = FHE.asEuint32(1);
        euint32 zero = FHE.asEuint32(0);

        for (uint256 i = 0; i < prediction.encryptedCounts.length; i++) {
            ebool matches = FHE.eq(choice, uint32(i));
            euint32 increment = FHE.select(matches, one, zero);
            prediction.encryptedCounts[i] = FHE.add(prediction.encryptedCounts[i], increment);
            FHE.allowThis(prediction.encryptedCounts[i]);
        }

        _hasVoted[predictionId][msg.sender] = true;

        emit VoteSubmitted(predictionId, msg.sender, euint32.unwrap(choice));
    }

    /// @notice Close a prediction and make encrypted counts publicly decryptable.
    /// @param predictionId The id of the prediction to close.
    function closePrediction(uint256 predictionId) external {
        require(predictionId < _predictions.length, "Invalid prediction");
        Prediction storage prediction = _predictions[predictionId];
        require(prediction.isOpen, "Already closed");

        prediction.isOpen = false;

        for (uint256 i = 0; i < prediction.encryptedCounts.length; i++) {
            prediction.encryptedCounts[i] = FHE.makePubliclyDecryptable(prediction.encryptedCounts[i]);
        }

        emit PredictionClosed(predictionId);
    }

    /// @notice Get details of a prediction.
    /// @param predictionId The id of the prediction to query.
    /// @return name The prediction name.
    /// @return options The option labels.
    /// @return encryptedCounts The encrypted vote counts per option.
    /// @return isOpen Whether the prediction is still accepting votes.
    /// @return createdAt The timestamp when the prediction was created.
    function getPrediction(
        uint256 predictionId
    )
        external
        view
        returns (string memory name, string[] memory options, euint32[] memory encryptedCounts, bool isOpen, uint256 createdAt)
    {
        require(predictionId < _predictions.length, "Invalid prediction");
        Prediction storage prediction = _predictions[predictionId];

        name = prediction.name;
        options = new string[](prediction.options.length);
        encryptedCounts = new euint32[](prediction.encryptedCounts.length);

        for (uint256 i = 0; i < prediction.options.length; i++) {
            options[i] = prediction.options[i];
        }
        for (uint256 i = 0; i < prediction.encryptedCounts.length; i++) {
            encryptedCounts[i] = prediction.encryptedCounts[i];
        }

        isOpen = prediction.isOpen;
        createdAt = prediction.createdAt;
    }

    /// @notice Returns the encrypted counts for a prediction.
    /// @param predictionId The id of the prediction.
    /// @return encryptedCounts The encrypted vote counts per option.
    function getEncryptedCounts(uint256 predictionId) external view returns (euint32[] memory encryptedCounts) {
        require(predictionId < _predictions.length, "Invalid prediction");
        Prediction storage prediction = _predictions[predictionId];
        encryptedCounts = new euint32[](prediction.encryptedCounts.length);
        for (uint256 i = 0; i < prediction.encryptedCounts.length; i++) {
            encryptedCounts[i] = prediction.encryptedCounts[i];
        }
    }

    /// @notice Check whether an address has voted on a prediction.
    /// @param predictionId The id of the prediction.
    /// @param user The address to check.
    /// @return hasVoted Whether the address has already submitted a choice.
    function hasAddressVoted(uint256 predictionId, address user) external view returns (bool hasVoted) {
        require(predictionId < _predictions.length, "Invalid prediction");
        hasVoted = _hasVoted[predictionId][user];
    }

    /// @notice Get the total number of predictions created.
    /// @return count Number of predictions.
    function getPredictionCount() external view returns (uint256 count) {
        count = _predictions.length;
    }
}
