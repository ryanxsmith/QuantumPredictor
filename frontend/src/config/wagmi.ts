import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Quantum Predictor',
  projectId: '8023f9b0f9774d7a8bde2b87d8ab5a1f',
  chains: [sepolia],
  ssr: false,
});
