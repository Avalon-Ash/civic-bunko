import { useCallback, useRef, type ReactNode } from 'react';
import type { CatMemory, CatVoice } from '../../core/types';
import type { World } from '../../core/world';
import { EMPTY_CAT_MEMORY, catSays } from '../../selectors/cat';
import { CatVoiceContext } from '../kit/catVoice';

/**
 * 把「小貓說什麼」接到本機的大腦（selectors/cat 的 catSays）。整個 App 共用一份記憶（最近說過的、連點幾下），
 * 只在記憶體、不存檔。之後要換說話的來源，換掉這個 Provider 給的函式就好，小貓的元件不用動。
 */
export function CatVoiceProvider({ world, children }: { world: World; children: ReactNode }) {
  const memory = useRef<CatMemory>(EMPTY_CAT_MEMORY);
  const voice = useCallback<CatVoice>(
    (tap) => {
      const result = catSays(world, tap, memory.current, new Date(), Math.random);
      memory.current = result.memory;
      return result.line;
    },
    [world],
  );
  return <CatVoiceContext.Provider value={voice}>{children}</CatVoiceContext.Provider>;
}
