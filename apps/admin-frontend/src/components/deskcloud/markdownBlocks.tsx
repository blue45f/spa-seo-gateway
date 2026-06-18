/**
 * 최소 마크다운 → React 노드 렌더러.
 * ──────────────────────────────────────────────────────────────────────────
 * ChangelogDesk 가 돌려주는 bodyMarkdown 을 HTML 주입 없이(=dangerouslySetInnerHTML 없이)
 * 안전하게 React 엘리먼트로 렌더한다. 인라인 마크업은 굵게(**)·인라인코드(`)만 다루며
 * 나머지는 텍스트 노드 그대로다 — 앱의 정책 본문 파서와 동일한 "HTML 미주입" 원칙.
 *
 * 지원: 문단 / 불릿(- *) / 번호(1.) 리스트 / 인라인 **굵게** · `코드`.
 * (제목·코드블록 등은 변경 이력 본문에선 드물어 문단으로 흡수한다.)
 */
import { Fragment, type ReactNode } from 'react'

type Block =
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }

const BULLET_RE = /^[-*]\s+(.+)$/
const ORDERED_RE = /^\d+\.\s+(.+)$/

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let para: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null

  const flushPara = () => {
    if (para.length > 0) {
      blocks.push({ kind: 'p', text: para.join(' ') })
      para = []
    }
  }
  const flushList = () => {
    if (list) {
      blocks.push(
        list.ordered ? { kind: 'ol', items: list.items } : { kind: 'ul', items: list.items }
      )
      list = null
    }
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (line === '') {
      flushPara()
      flushList()
      continue
    }
    const bullet = BULLET_RE.exec(line)
    if (bullet) {
      flushPara()
      if (!list || list.ordered) {
        flushList()
        list = { ordered: false, items: [] }
      }
      list.items.push(bullet[1]!)
      continue
    }
    const ordered = ORDERED_RE.exec(line)
    if (ordered) {
      flushPara()
      if (!list || !list.ordered) {
        flushList()
        list = { ordered: true, items: [] }
      }
      list.items.push(ordered[1]!)
      continue
    }
    flushList()
    // 제목(#) 표식은 텍스트에서 떼고 문단으로 흡수.
    para.push(line.replace(/^#{1,6}\s+/, ''))
  }
  flushPara()
  flushList()
  return blocks
}

/** 인라인 **굵게** 와 `코드` 만 React 노드로. 그 외는 평문 텍스트. */
function inline(text: string, keyBase: string): ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter((t) => t !== '')
  return tokens.map((tok, i) => {
    const key = `${keyBase}-${i}`
    if (tok.startsWith('**') && tok.endsWith('**')) {
      return (
        <strong key={key} className="font-semibold text-ink">
          {tok.slice(2, -2)}
        </strong>
      )
    }
    if (tok.startsWith('`') && tok.endsWith('`')) {
      return (
        <code key={key} className="rounded bg-panel-2 px-1 py-0.5 font-mono text-[0.85em]">
          {tok.slice(1, -1)}
        </code>
      )
    }
    return <Fragment key={key}>{tok}</Fragment>
  })
}

export function MarkdownBlocks({ markdown }: { markdown: string }): ReactNode {
  const blocks = parseBlocks(markdown)
  if (blocks.length === 0) return null
  return (
    <div className="space-y-1.5 text-sm text-ink-muted">
      {blocks.map((block, i) => {
        if (block.kind === 'p') {
          return <p key={i}>{inline(block.text, `p${i}`)}</p>
        }
        if (block.kind === 'ul') {
          return (
            <ul key={i} className="list-disc space-y-0.5 pl-5">
              {block.items.map((item, j) => (
                <li key={j}>{inline(item, `ul${i}-${j}`)}</li>
              ))}
            </ul>
          )
        }
        return (
          <ol key={i} className="list-decimal space-y-0.5 pl-5">
            {block.items.map((item, j) => (
              <li key={j}>{inline(item, `ol${i}-${j}`)}</li>
            ))}
          </ol>
        )
      })}
    </div>
  )
}

export default MarkdownBlocks
