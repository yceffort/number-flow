// 구형 Chromium을 "창을 띄워서" 열어 사람이 직접 비교 데모를 조작해볼 수 있게 한다.
//
// 사용법: node scripts/open-old-chrome.mjs [milestone] [경로]
//   node scripts/open-old-chrome.mjs            # Chrome 87로 비교 데모 열기
//   node scripts/open-old-chrome.mjs 100        # Chrome 100으로 (87 이상 아무 마일스톤 가능)
//   node scripts/open-old-chrome.mjs 87 /selftest.html   # 셀프테스트 페이지 열기
//
// 브라우저 창을 닫으면 스크립트도 종료된다.
// 주의: Chrome 80~86은 x64+Rosetta의 GPU 초기화 크래시로 창 모드 불가
// (headless 검증은 pnpm test:old-chrome 80 으로 가능).

import {spawn} from 'node:child_process'
import {rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {
  buildDistIfNeeded,
  ensureChromium,
  chromiumVersion,
  serveDist,
} from './snapshot-utils.mjs'

const milestone = Number(process.argv[2] ?? 87)
if (milestone < 87) {
  console.warn(
    `주의: M${milestone}은 창 모드에서 크래시할 수 있습니다 (Rosetta GPU 이슈). headless 검증은 pnpm test:old-chrome ${milestone}`,
  )
}
const path = process.argv[3] ?? '/'
const PORT = 5297

buildDistIfNeeded()
const browser = await ensureChromium(milestone)
if (browser.error) {
  console.error(`실행 불가: ${browser.error}`)
  process.exit(1)
}
const server = await serveDist(PORT)

const profile = join(tmpdir(), `nf-open-chrome-m${milestone}`)
const url = `http://localhost:${PORT}${path}`
console.log(`${chromiumVersion(browser.bin)} 창을 엽니다 → ${url}`)
console.log(
  '(창을 닫으면 종료됩니다. 데모 빌드 산출물 기준이라 소스 수정 반영은 pnpm --filter demo build 후에)',
)

const child = spawn(
  browser.bin,
  [
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${profile}`,
    url,
  ],
  {stdio: 'ignore'},
)
child.on('close', () => {
  server.close()
  rmSync(profile, {recursive: true, force: true})
  process.exit(0)
})
