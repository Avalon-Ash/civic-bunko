// 漫畫上方的「登場角色」：這套漫畫有誰、各演什麼。名字、說明、穿著都只讀 COMIC_CASTS。
import { COMIC_CASTS } from '../../../core/constants/comic';
import type { CardComic } from '../../../core/types';
import { comicCasts } from '../../../systems/comic';
import { Cat } from '../Cat';

/** 頭像邊長（px）：跟一行說明（名字＋一句）差不多高 */
const CAST_FACE_PX = 34;

export function ComicCastList({ comic }: { comic: Pick<CardComic, 'panels'> }) {
  const casts = comicCasts(comic);
  if (casts.length === 0) return null;
  return (
    <ul className="cb-comic-cast" aria-label="登場角色">
      {casts.map((id) => {
        const cast = COMIC_CASTS[id];
        return (
          <li key={id} className="cb-comic-cast-item">
            <Cat size={CAST_FACE_PX} interactive={false} outfit={cast.outfit} />
            <span className="cb-comic-cast-text">
              <b>{cast.tag === cast.name ? cast.name : `${cast.name}（${cast.tag}）`}</b>
              <span>{cast.role}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
