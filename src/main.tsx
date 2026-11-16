import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './theme.css';
import './ui/app.css';
import { createWorld, type World } from './core/world';
import { loadBankMeta, loadCardFiles, loadEnrichFiles, loadPapers, loadTopics, loadZhFiles } from './data/source';
import { loadBank, loadTopicList } from './systems/bankLoader';
import { loadCards } from './systems/cardLoader';
import { attachPersistence } from './systems/persistence';
import { attachSync } from './systems/sync';
import { loadZh } from './systems/zhLoader';
import { App } from './ui/App';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => undefined);
}

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
// 卡片與考點清單載入失敗也不影響刷題。
const papersPromise = Promise.all([
  loadPapers(),
  loadEnrichFiles().catch(() => []),
  loadCardFiles().catch(() => []),
  loadTopics().catch(() => []),
  loadZhFiles().catch(() => []),
]).then(([files, enrich, cards, topics, zhFiles]) => {
  loadBank(world, banks, files, enrich);
  loadCards(world, cards, files);
  loadTopicList(world, topics);
  loadZh(world, zhFiles);
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
