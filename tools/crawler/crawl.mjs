import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { RAW_DIR, ROOT } from '../paths.mjs';

const targetsPath = resolve(ROOT, 'tools/crawler/targets.json');
const targets = JSON.parse(readFileSync(targetsPath, 'utf8'));
const manifestPath = join(RAW_DIR, 'manifest.json');

const isDryRun = process.argv.includes('--dry-run');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let lastRequestFinishedAt = 0;

async function moexFetch(url, delayMs) {
  if (lastRequestFinishedAt > 0) {
    const waitMs = Math.max(0, lastRequestFinishedAt + delayMs - Date.now());
    if (waitMs > 0) await sleep(waitMs);
  }
  try {
    return await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,*/*;q=0.8',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
      },
    });
  } finally {
    lastRequestFinishedAt = Date.now();
  }
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
}

function stripTagsAndNormalize(html) {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSubjectName(betweenHtml, subjectRules) {
  const cleaned = betweenHtml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<(?:br|\/?(?:td|th|tr|div|li|p|h[1-6]|dt|dd|label|table|ul|ol|a))\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '');

  const lines = decodeHtmlEntities(cleaned)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0);

  for (let i = lines.length - 1; i >= 0; i--) {
    if (subjectRules.some((rule) => lines[i].startsWith(rule.startsWith))) {
      return lines[i];
    }
  }

  for (let i = lines.length - 1; i >= 0; i--) {
    if (!/^[\d\s.,、:：\-—/()（）]+$/.test(lines[i])) {
      return lines[i];
    }
  }

  return lines.at(-1) ?? '';
}

function parseClassLabels(html, examCode) {
  const labelRe = /<label\b[^>]*?\bfor\s*=\s*["']ctl00_holderContent_chk_(\d+)_([^"'_]+)["'][^>]*>([\s\S]*?)<\/label>/gi;
  const labels = [];
  let match;
  while ((match = labelRe.exec(html)) !== null) {
    if (match[1] !== examCode) continue;
    labels.push({
      examCode: match[1],
      classCode: match[2],
      classLabel: stripTagsAndNormalize(match[3]),
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }
  return labels;
}

function matchTargetClass(labels, exam, classNameTarget) {
  return labels.filter((item) => {
    const sepIdx = item.classLabel.indexOf('_');
    if (sepIdx === -1) return false;
    const levelText = item.classLabel.slice(0, sepIdx).trim();
    const className = item.classLabel.slice(sepIdx + 1).trim();
    const normalizedClassName = className.replace(/類科$/, '');
    return levelText.includes(exam.levelIncludes) && normalizedClassName === classNameTarget;
  });
}

function parseSubjectsInClass(classHtml, examCode, classCode, subjectRules) {
  const linkRe = /<a\b[^>]*?\bhref\s*=\s*["']([^"']*wHandExamQandA_File\.ashx[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const seenUrls = new Set();
  const subjectsByCode = new Map();
  const orderedSubjects = [];
  let lastAnchorEnd = 0;
  let match;

  while ((match = linkRe.exec(classHtml)) !== null) {
    const decodedHref = decodeHtmlEntities(match[1].trim());
    const fullUrl = new URL(decodedHref, targets.baseUrl).href;
    const parsedUrl = new URL(fullUrl);
    const t = parsedUrl.searchParams.get('t');
    const code = parsedUrl.searchParams.get('code');
    const c = parsedUrl.searchParams.get('c');
    const s = parsedUrl.searchParams.get('s');

    if (code !== examCode || c !== classCode || !s || !['Q', 'S', 'M'].includes(t ?? '')) {
      lastAnchorEnd = match.index + match[0].length;
      continue;
    }

    if (!subjectsByCode.has(s)) {
      const betweenHtml = classHtml.slice(lastAnchorEnd, match.index);
      const subjectName = extractSubjectName(betweenHtml, subjectRules);
      const entry = { subjectCode: s, subjectName, links: [] };
      subjectsByCode.set(s, entry);
      orderedSubjects.push(entry);
    }

    lastAnchorEnd = match.index + match[0].length;

    if (seenUrls.has(fullUrl)) continue;
    seenUrls.add(fullUrl);

    const subjectEntry = subjectsByCode.get(s);
    if (!subjectEntry.links.some((l) => l.type === t)) {
      subjectEntry.links.push({ type: t, url: fullUrl });
    }
  }

  return orderedSubjects;
}

function checkAntiBot(res, html, url) {
  if (res.status === 403) {
    throw new Error(`考選部回應 403 Forbidden（疑似擋爬）：${url}`);
  }
  if (res.status !== 200) {
    throw new Error(`考選部回應 HTTP ${res.status}：${url}`);
  }
  if (/(?:驗證碼|cf-turnstile|g-recaptcha|hcaptcha|Access Denied)/i.test(html)) {
    throw new Error(`考選部頁面疑似包含驗證碼或封鎖訊息：${url}`);
  }
}

async function fetchExamPlan(exam) {
  const searchUrl = `${targets.baseUrl}wFrmExamQandASearch.aspx?y=${exam.y}&e=${exam.code}`;
  const res = await moexFetch(searchUrl, targets.delayMs);
  const html = await res.text();
  checkAntiBot(res, html, searchUrl);

  const allLabels = parseClassLabels(html, exam.code);
  if (allLabels.length === 0) {
    throw new Error(
      `考試 ${exam.code}（${exam.y}）未解析到任何類科 <label for="ctl00_holderContent_chk_${exam.code}_...">，列表頁結構可能與 docs/moex-recon.md 不符。`
    );
  }

  const matched = matchTargetClass(allLabels, exam, targets.classMatch.className);
  if (matched.length === 0) {
    const sample = allLabels.slice(0, 10).map((l) => `${l.classCode}:${l.classLabel}`).join('、');
    throw new Error(
      `考試 ${exam.code} 找不到符合 levelIncludes="${exam.levelIncludes}" 且類科="${targets.classMatch.className}" 的類科（共 ${allLabels.length} 筆類科，前幾筆：${sample}）`
    );
  }
  if (matched.length > 1) {
    const list = matched.map((l) => `${l.classCode}:${l.classLabel}`).join('、');
    throw new Error(`考試 ${exam.code} 找到超過 1 個符合類科：${list}`);
  }

  const targetClass = matched[0];
  const labelIdx = allLabels.indexOf(targetClass);
  const nextLabelStart = labelIdx + 1 < allLabels.length ? allLabels[labelIdx + 1].startIndex : html.length;
  const classHtml = html.slice(targetClass.endIndex, nextLabelStart);

  const parsedSubjects = parseSubjectsInClass(classHtml, exam.code, targetClass.classCode, targets.subjects);
  const items = [];
  const drySubjects = [];

  for (const subjRule of targets.subjects) {
    const hits = parsedSubjects.filter((s) => s.subjectName.startsWith(subjRule.startsWith));
    if (hits.length === 0) {
      const foundList = parsedSubjects.map((s) => `${s.subjectCode}:${s.subjectName}`).join('、');
      throw new Error(
        `考試 ${exam.code} 類科 ${targetClass.classCode}（${targetClass.classLabel}）找不到科目「${subjRule.startsWith}」，實際解析到：${foundList || '(無)'}`
      );
    }
    if (hits.length > 1) {
      const hitList = hits.map((s) => `${s.subjectCode}:${s.subjectName}`).join('、');
      throw new Error(`考試 ${exam.code} 科目「${subjRule.startsWith}」比對到多個：${hitList}`);
    }

    const hit = hits[0];
    const types = hit.links.map((l) => l.type);
    if (!types.includes('Q')) {
      throw new Error(`考試 ${exam.code} 科目 ${subjRule.key}（${hit.subjectCode}）缺試題（Q）`);
    }
    if (!types.includes('S')) {
      throw new Error(`考試 ${exam.code} 科目 ${subjRule.key}（${hit.subjectCode}）缺答案（S）`);
    }

    drySubjects.push({
      key: subjRule.key,
      subjectCode: hit.subjectCode,
      subjectName: hit.subjectName,
      types,
    });

    for (const link of hit.links) {
      items.push({
        examCode: exam.code,
        year: exam.year,
        exam: exam.exam,
        classCode: targetClass.classCode,
        classLabel: targetClass.classLabel,
        subjectKey: subjRule.key,
        subjectCode: hit.subjectCode,
        subjectName: hit.subjectName,
        type: link.type,
        url: link.url,
        file: `data/raw/${exam.code}/${subjRule.key}-${link.type}.pdf`,
      });
    }
  }

  return {
    exam,
    classCode: targetClass.classCode,
    classLabel: targetClass.classLabel,
    drySubjects,
    parsedCount: parsedSubjects.length,
    items,
  };
}

function loadExistingManifest() {
  if (!existsSync(manifestPath)) return new Map();
  try {
    const data = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (!Array.isArray(data.files)) return new Map();
    const map = new Map();
    for (const entry of data.files) {
      if (entry && typeof entry.file === 'string') {
        map.set(entry.file, entry);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

function isValidCachedFile(item, existingEntry) {
  if (!existingEntry || existingEntry.url !== item.url || !existingEntry.sha256) return null;
  const absPath = resolve(ROOT, item.file);
  if (!existsSync(absPath)) return null;
  const buf = readFileSync(absPath);
  if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') return null;
  if (buf.length !== existingEntry.bytes) return null;
  const actualSha = createHash('sha256').update(buf).digest('hex');
  if (actualSha !== existingEntry.sha256) return null;
  return {
    bytes: buf.length,
    sha256: actualSha,
    downloadedAt: existingEntry.downloadedAt,
  };
}

async function downloadPdfWithRetry(url, delayMs) {
  let lastError = '未知錯誤';
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await moexFetch(url, delayMs);
      if (res.status === 403) {
        lastError = `HTTP 403 Forbidden（疑似擋爬）`;
        continue;
      }
      if (res.status !== 200) {
        lastError = `HTTP ${res.status}`;
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') {
        lastError = '回應開頭不是 %PDF-';
        continue;
      }
      return { ok: true, buf };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return { ok: false, reason: lastError };
}

async function main() {
  const allPlans = [];
  for (const exam of targets.exams) {
    const plan = await fetchExamPlan(exam);
    allPlans.push(plan);
    if (isDryRun) {
      console.log(`[${exam.code}] ${exam.year} ${exam.exam} | 類科代碼=${plan.classCode} | 類科標籤=${plan.classLabel}`);
      for (const s of plan.drySubjects) {
        console.log(`  - ${s.key} (${s.subjectCode}) ${s.subjectName}: ${s.types.join(', ')}`);
      }
    }
  }

  if (isDryRun) {
    const totalFiles = allPlans.reduce((sum, p) => sum + p.items.length, 0);
    console.log(`dry-run 完成：共 ${allPlans.length} 場考試、預計 ${totalFiles} 個檔案`);
    return;
  }

  const existingMap = loadExistingManifest();
  const manifestFiles = [];
  const failed = [];
  let downloaded = 0;
  let skipped = 0;

  for (const plan of allPlans) {
    for (const item of plan.items) {
      const cached = isValidCachedFile(item, existingMap.get(item.file));
      if (cached) {
        skipped++;
        manifestFiles.push({
          ...item,
          sha256: cached.sha256,
          bytes: cached.bytes,
          downloadedAt: cached.downloadedAt,
        });
        continue;
      }

      const result = await downloadPdfWithRetry(item.url, targets.delayMs);
      if (!result.ok) {
        failed.push({ file: item.file, url: item.url, reason: result.reason });
        continue;
      }

      const absPath = resolve(ROOT, item.file);
      mkdirSync(dirname(absPath), { recursive: true });
      writeFileSync(absPath, result.buf);

      const sha256 = createHash('sha256').update(result.buf).digest('hex');
      const bytes = result.buf.length;
      const downloadedAt = new Date().toISOString();
      downloaded++;
      manifestFiles.push({
        ...item,
        sha256,
        bytes,
        downloadedAt,
      });
    }
  }

  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        files: manifestFiles,
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  if (failed.length > 0) {
    console.error('failed:');
    for (const f of failed) {
      console.error(`  ${f.file} (${f.url}): ${f.reason}`);
    }
  }

  console.log(`下載 ${downloaded} 個、略過 ${skipped} 個、失敗 ${failed.length} 個`);
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
