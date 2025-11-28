import { useCallback, useEffect, useMemo, useState } from 'react';
import { Contract } from 'ethers';
import { useAccount, usePublicClient } from 'wagmi';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import '../styles/PredictionApp.css';

type Prediction = {
  id: number;
  name: string;
  options: string[];
  encryptedCounts: string[];
  isOpen: boolean;
  createdAt: number;
  hasVoted: boolean;
  decryptedCounts?: number[];
};

export function PredictionApp() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const signerPromise = useEthersSigner();
  const { instance, isLoading: zamaLoading } = useZamaInstance();

  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formOptions, setFormOptions] = useState<string[]>(['', '']);

  const readyForActions = useMemo(
    () => Boolean(instance) && Boolean(address) && Boolean(signerPromise),
    [instance, address, signerPromise]
  );

  const loadPredictions = useCallback(async () => {
    if (!publicClient) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const count = (await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getPredictionCount',
      })) as bigint;

      if (count === 0n) {
        setPredictions([]);
        return;
      }

      const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i));

      const items = await Promise.all(
        ids.map(async (idBig) => {
          const [name, options, encryptedCounts, isOpen, createdAt] = (await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'getPrediction',
            args: [idBig],
          })) as [string, string[], string[], boolean, bigint];

          let hasVoted = false;

          if (address) {
            hasVoted = (await publicClient.readContract({
              address: CONTRACT_ADDRESS,
              abi: CONTRACT_ABI,
              functionName: 'hasAddressVoted',
              args: [idBig, address],
            })) as boolean;
          }

          return {
            id: Number(idBig),
            name,
            options: options.map(String),
            encryptedCounts: (encryptedCounts as string[]).map(String),
            isOpen,
            createdAt: Number(createdAt),
            hasVoted: Boolean(hasVoted),
          };
        })
      );

      setPredictions(items);
    } catch (error) {
      console.error('Failed to load predictions', error);
      setErrorMessage('Unable to load predictions from the chain.');
    } finally {
      setIsLoading(false);
    }
  }, [address, publicClient]);

  useEffect(() => {
    loadPredictions();
  }, [loadPredictions, refreshIndex]);

  const resetForm = () => {
    setFormTitle('');
    setFormOptions(['', '']);
  };

  const handleAddOption = () => {
    if (formOptions.length >= 4) return;
    setFormOptions((prev) => [...prev, '']);
  };

  const handleRemoveOption = (index: number) => {
    if (formOptions.length <= 2) return;
    setFormOptions((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleCreatePrediction = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedTitle = formTitle.trim();
    const cleanedOptions = formOptions.map((opt) => opt.trim()).filter(Boolean);

    if (!trimmedTitle) {
      setErrorMessage('Please provide a prediction name.');
      return;
    }
    if (cleanedOptions.length < 2 || cleanedOptions.length > 4) {
      setErrorMessage('Provide between 2 and 4 options.');
      return;
    }

    try {
      const signer = await signerPromise;
      if (!signer) {
        setErrorMessage('Connect your wallet to launch a prediction.');
        return;
      }

      setPendingAction('create');
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.createPrediction(trimmedTitle, cleanedOptions);
      await tx.wait();

      resetForm();
      setRefreshIndex((prev) => prev + 1);
    } catch (error) {
      console.error('Create prediction failed', error);
      setErrorMessage('Transaction failed while creating the prediction.');
    } finally {
      setPendingAction(null);
    }
  };

  const handleVote = async (predictionId: number, optionIndex: number) => {
    setErrorMessage(null);
    try {
      if (!instance || !address) {
        setErrorMessage('Encryption service or wallet is not ready.');
        return;
      }

      const signer = await signerPromise;
      if (!signer) {
        setErrorMessage('Connect your wallet to vote.');
        return;
      }

      setPendingAction(`vote-${predictionId}`);

      const buffer = instance.createEncryptedInput(CONTRACT_ADDRESS, address);
      buffer.add32(optionIndex);
      const encrypted = await buffer.encrypt();

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.submitChoice(predictionId, encrypted.handles[0], encrypted.inputProof);
      await tx.wait();

      setRefreshIndex((prev) => prev + 1);
    } catch (error) {
      console.error('Vote failed', error);
      setErrorMessage('Could not submit your encrypted vote.');
    } finally {
      setPendingAction(null);
    }
  };

  const handleClosePrediction = async (predictionId: number) => {
    setErrorMessage(null);
    try {
      const signer = await signerPromise;
      if (!signer) {
        setErrorMessage('Connect your wallet to reveal a prediction.');
        return;
      }
      setPendingAction(`close-${predictionId}`);
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.closePrediction(predictionId);
      await tx.wait();
      setRefreshIndex((prev) => prev + 1);
    } catch (error) {
      console.error('Close prediction failed', error);
      setErrorMessage('Unable to reveal this prediction.');
    } finally {
      setPendingAction(null);
    }
  };

  const handleDecrypt = async (target: Prediction) => {
    setErrorMessage(null);
    if (!instance) {
      setErrorMessage('Encryption service is still initializing.');
      return;
    }

    try {
      setPendingAction(`decrypt-${target.id}`);
      const { clearValues } = await instance.publicDecrypt(target.encryptedCounts);
      const counts = target.encryptedCounts.map((handle: string) => {
        const value = (clearValues as Record<string, number | string | bigint | boolean>)[handle];
        return Number(value ?? 0);
      });

      setPredictions((prev) =>
        prev.map((item) => (item.id === target.id ? { ...item, decryptedCounts: counts } : item))
      );
    } catch (error) {
      console.error('Decrypt failed', error);
      setErrorMessage('Public decryption failed. Try again shortly.');
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="prediction-app">
      <section className="hero">
        <div>
          <p className="eyebrow">Quantum Predictor</p>
          <h1>Launch encrypted predictions and reveal totals on-chain.</h1>
          <p className="subhead">
            Votes stay private with Zama FHE. Anyone can close a prediction and make the tallies publicly decryptable.
          </p>
          <div className="hero-status">
            <span className={`status-dot ${isConnected ? 'online' : 'offline'}`} />
            {isConnected ? 'Wallet connected' : 'Connect a wallet to participate'}
            <span className="divider">•</span>
            {zamaLoading ? 'Initializing encryption' : instance ? 'Encryption ready' : 'Encryption unavailable'}
          </div>
        </div>
        <div className="hero-card">
          <h3>Quick start</h3>
          <ul>
            <li>Set a prediction name with 2-4 options</li>
            <li>Cast an encrypted vote—only handles touch the chain</li>
            <li>Anyone can close and decrypt totals with the relayer</li>
          </ul>
        </div>
      </section>

      <section className="grid">
        <div className="panel create-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">New prediction</p>
              <h2>Shape the next forecast</h2>
            </div>
            <span className="badge">Encrypted</span>
          </div>

          <form className="form" onSubmit={handleCreatePrediction}>
            <label>
              <span>Prediction name</span>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Will the launch happen this week?"
              />
            </label>

            <div className="options-row">
              <span>Options (2-4)</span>
              <div className="options-editor">
                {formOptions.map((option, idx) => (
                  <div key={idx} className="option-input">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) =>
                        setFormOptions((prev) => prev.map((val, index) => (index === idx ? e.target.value : val)))
                      }
                      placeholder={`Option ${idx + 1}`}
                    />
                    {formOptions.length > 2 && (
                      <button type="button" onClick={() => handleRemoveOption(idx)} className="ghost-button">
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="option-actions">
                <button type="button" onClick={handleAddOption} disabled={formOptions.length >= 4} className="ghost-button">
                  Add option
                </button>
              </div>
            </div>

            <button type="submit" className="primary-button" disabled={pendingAction === 'create'}>
              {pendingAction === 'create' ? 'Launching...' : 'Create prediction'}
            </button>
            <p className="helper-text">Writes use ethers; reads and decryption use viem + relayer.</p>
          </form>
        </div>

        <div className="panel feed-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Live markets</p>
              <h2>Encrypted vote streams</h2>
            </div>
            <button className="ghost-button" onClick={() => setRefreshIndex((prev) => prev + 1)}>
              Refresh
            </button>
          </div>

          {isLoading ? (
            <div className="empty">Loading predictions...</div>
          ) : predictions.length === 0 ? (
            <div className="empty">
              <h3>No predictions yet</h3>
              <p>Be the first to publish one and invite encrypted votes.</p>
            </div>
          ) : (
            <div className="prediction-list">
              {predictions.map((prediction) => {
                const isVoting = pendingAction === `vote-${prediction.id}`;
                const isClosing = pendingAction === `close-${prediction.id}`;
                const isDecrypting = pendingAction === `decrypt-${prediction.id}`;
                const orderLocked = prediction.hasVoted || !prediction.isOpen;

                return (
                  <div key={prediction.id} className="prediction-card">
                    <div className="card-top">
                      <div>
                        <p className="eyebrow">#{prediction.id}</p>
                        <h3>{prediction.name}</h3>
                        <p className="timestamp">
                          Created {new Date(prediction.createdAt * 1000).toLocaleString()}
                        </p>
                      </div>
                      <div className={`pill ${prediction.isOpen ? 'pill-open' : 'pill-closed'}`}>
                        {prediction.isOpen ? 'Open for votes' : 'Closed'}
                      </div>
                    </div>

                    <div className="options-grid">
                      {prediction.options.map((option, idx) => {
                        const count = prediction.decryptedCounts?.[idx];
                        return (
                          <button
                            key={`${prediction.id}-${idx}`}
                            className="option-card"
                            type="button"
                            disabled={!prediction.isOpen || orderLocked || !isConnected || isVoting || !readyForActions}
                            onClick={() => handleVote(prediction.id, idx)}
                          >
                            <div className="option-label">
                              <span>{option}</span>
                              <small>Index {idx}</small>
                            </div>
                            <div className="option-meta">
                              {prediction.isOpen ? (
                                <span className="encrypted-chip">Encrypted count</span>
                              ) : (
                                <span className="tally">{count !== undefined ? `Total: ${count}` : 'Awaiting reveal'}</span>
                              )}
                              {prediction.hasVoted && <span className="you-voted">You voted</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="card-actions">
                      {prediction.isOpen ? (
                        <button
                          className="secondary-button"
                          onClick={() => handleClosePrediction(prediction.id)}
                          disabled={isClosing}
                        >
                          {isClosing ? 'Revealing...' : 'Close & make public'}
                        </button>
                      ) : (
                        <button
                          className="secondary-button"
                          onClick={() => handleDecrypt(prediction)}
                          disabled={isDecrypting}
                        >
                          {isDecrypting ? 'Decrypting...' : 'Decrypt totals'}
                        </button>
                      )}
                      <p className="helper-text">
                        Votes are submitted via ethers writes; counts are decrypted through the Zama relayer.
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {errorMessage && <div className="error-banner">{errorMessage}</div>}
    </div>
  );
}
