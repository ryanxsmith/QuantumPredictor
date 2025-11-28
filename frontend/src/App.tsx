import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';

import { config } from './config/wagmi';
import { Header } from './components/Header';
import { PredictionApp } from './components/PredictionApp';

const queryClient = new QueryClient();

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider locale="en">
          <div style={{ minHeight: '100vh' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '18px 16px 48px' }}>
              <Header />
              <PredictionApp />
            </div>
          </div>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App
