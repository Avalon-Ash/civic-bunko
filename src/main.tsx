import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './theme.css';
import './ui/app.css';
import { createWorld } from './core/world';
import { loadDataSource } from './data/source';
import { loadBank } from './systems/bankLoader';
import { attachPersistence } from './systems/persistence';
import { App } from './ui/App';

const world = createWorld();
attachPersistence(world, window.localStorage);

const { banks, files } = loadDataSource();
loadBank(world, banks, files);

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Missing #root element');
}

createRoot(rootEl).render(
  <StrictMode>
    <App world={world} />
  </StrictMode>,
);
