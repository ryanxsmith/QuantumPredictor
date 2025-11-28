import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-left">
        <div className="logo-mark">QP</div>
        <div>
          <p className="eyebrow">Fully Homomorphic | Sepolia</p>
          <h1>Quantum Predictor</h1>
        </div>
      </div>
      <div className="header-actions">
        <span className="network-badge">Encrypted votes</span>
        <ConnectButton showBalance={false} />
      </div>
    </header>
  );
}
