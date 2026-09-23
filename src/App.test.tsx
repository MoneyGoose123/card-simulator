import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

function renderAt(search: string) {
  vi.stubGlobal('window', { location: { search, pathname: '/' }, history: { replaceState: () => {} } })
  return renderToString(<App />)
}

afterEach(() => vi.unstubAllGlobals())

describe('画面のスモークテスト', () => {
  it('初期状態で全セクションが表示される', () => {
    const html = renderAt('')
    for (const s of ['カード選びシミュレーター', '支払い額を入れると結果が出ます', '損益分岐点', '利用枠・特典で選ぶカード', '目的別の答え', '注意点', '計算の前提']) {
      expect(html).toContain(s)
    }
  })

  it('URLの入力値から結果が出る（#1 Amazon 200万・ana）', () => {
    const html = renderAt('?amazon=200&g=ana&ob=0&al=500')
    expect(html).toContain('アメックス・ビジネス・グリーン')
    expect(html).toContain('95,500円')
    expect(html).toContain('ANAへ移行できるのは年4万マイルまで')
  })

  it('ana＋jal を選ぶと内訳に両方のマイルが出る', () => {
    const html = renderAt('?other=600&g=ana,jal&ob=0')
    expect(html).toContain('ANAマイル')
    expect(html).toContain('JALマイル')
  })

  it('文言ルール：審査・利用枠が上がりやすい等の表現がない', () => {
    const html = renderAt('?amazon=200&other=500&g=ana,hotel')
    expect(html).not.toMatch(/審査に通りやすい|上がりやすい|リクルートカード/)
    expect(html).toContain('申し込み前に中村へご相談ください')
  })
})
