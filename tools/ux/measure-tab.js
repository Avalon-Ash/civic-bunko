// UX 量測片段（docs/plans/ux-cleanup.md §4）。不進 build。
// 用法：在預覽（.claude/launch.json 的 civic-bunko）裡、切到要量的分頁後，把整段貼進
// 瀏覽器的 JavaScript 執行。回傳目前分頁的高度、幾個螢幕、看得到的按鈕數、直屬區塊，
// 以及每個 data-guide 錨點是否完全在視窗內。捲動容器是 .cb-main（src/ui/styles/base.css）。
(() => {
  const main = document.querySelector('.cb-main');
  if (!main) return { error: '找不到 .cb-main' };
  // 往下走到第一層有多個子元素的容器（分頁外面常包一層 section）。
  let box = main.firstElementChild;
  while (box && box.children.length === 1) box = box.firstElementChild;
  const inView = (el) => {
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  return {
    viewport: [innerWidth, innerHeight],
    scrollHeight: main.scrollHeight,
    screens: +(main.scrollHeight / innerHeight).toFixed(1),
    buttons: [...main.querySelectorAll('button:not([disabled])')].filter(visible).length,
    blocks: box
      ? [...box.children].map((el) => [Math.round(el.getBoundingClientRect().height), el.textContent.trim().slice(0, 12)])
      : [],
    anchors: [...document.querySelectorAll('[data-guide]')].map((el) => [el.dataset.guide, inView(el)]),
  };
})();
