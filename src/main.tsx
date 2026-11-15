import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './theme.css';
import './ui/app.css';
import { createWorld, type World } from './core/world';
import { loadBankMeta, loadEnrichFiles, loadPapers } from './data/source';
import { loadBank } from './systems/bankLoader';
import { attachPersistence } from './systems/persistence';
import { attachSync } from './systems/sync';
import { App } from './ui/App';

const world = createWorld();
attachPersistence(world, window.localStorage);
attachSync(world, {
  fetch: window.fetch.bind(window),
  storage: window.localStorage,
  now: () => new Date(),
});

const { banks } = loadBankMeta();
loadBank(world, banks, []);

// 加工內容載入失敗不影響刷題：當作沒有。
const papersPromise = Promise.all([loadPapers(), loadEnrichFiles().catch(() => [])]).then(([files, enrich]) => {
  loadBank(world, banks, files, enrich);
});

function Root({ world: appWorld }: { world: World }) {
  const [papersLoading, setPapersLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    papersPromise
      .then(() => {
        if (active) {
          setPapersLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setLoadError(true);
          setPapersLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return <App world={appWorld} papersLoading={papersLoading} loadError={loadError} />;
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Missing #root element');
}

createRoot(rootEl).render(
  <StrictMode>
    <Root world={world} />
  </StrictMode>,
);
