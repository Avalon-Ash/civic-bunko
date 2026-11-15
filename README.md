# civic-bunko

[繁體中文](README.zh-TW.md)

A static, mobile-first study app for Taiwan's 2026 Local Government Civil Service Exam (Grade 4, General Civil Affairs). It turns official past exam questions into short, visual, five-question rounds for someone with no legal background and very little time.

**Status:** early development. The written exam is on 5–6 December 2026.

## What it does

- Five-question rounds drawn from official past papers, with instant feedback
- One mnemonic line per question, shown whether the answer was right or wrong
- Four-colour highlighting: red for trick wording, green for the correct answer, blue for statutes and key terms, orange for official answer corrections
- Picture cards for beginner concepts such as the hierarchy of laws
- Daily missions, an exam countdown, and stamp-style progress
- Works offline once added to the home screen; progress stays on the device

## Data sources

- Questions, answers and answer corrections come only from PDFs published by the Ministry of Examination (MOEX) on its past-papers platform. Under Article 9 of Taiwan's Copyright Act, national exam questions are not subject to copyright.
- Statute text comes from the Laws and Regulations Database of the Republic of China.
- Explanations, mnemonics and plain-language rewrites are AI-generated, kept in a separate layer from the official data, and labelled as such in the app. They may contain errors; the official answer always takes precedence.

## Repository layout

```
tools/crawler/   downloads official PDFs into data/raw/
docs/plans/      project plan and milestones
docs/dispatch/   work orders for coding agents
prototype/       clickable UI prototype
AGENTS.md        contract for all coding agents
```

## Development

The crawler has no dependencies and needs Node 18 or later:

```bash
node tools/crawler/crawl.mjs --dry-run
```

```bash
node tools/crawler/crawl.mjs
```

```bash
node tools/crawler/verify.mjs
```

The crawler waits at least two seconds between requests and skips files it already has.

## Disclaimer

This is a personal study aid and is not affiliated with the Ministry of Examination. Characters and illustrations are original.
