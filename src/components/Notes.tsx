import { CARDS, EXCLUDED_CARDS, RULES, VERIFIED_AT, totalFee, type Assumptions } from '../data/cards'
import { yen } from '../lib/format'
import { Section } from './ui'

const d = (s: string) => s.replaceAll('-', '/')

function Item({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-3">
      <h3 className="text-sm font-bold">{title}</h3>
      <div className="mt-1 space-y-1 text-sm leading-relaxed text-stone-700 dark:text-stone-300">{children}</div>
    </div>
  )
}

export function Notes({ ocBankActive }: { ocBankActive: boolean }) {
  return (
    <Section id="notes" title="注意点">
      <div className="divide-y divide-stone-100 dark:divide-stone-800">
        <Item title="マリオットの事業用決済">
          <p>
            2025年10月28日から、運送関連費用・広告宣伝費・オフィス用品など事業用加盟店での支払いはポイントが付きません。2025年8月21日以降に入会した人は入会時から対象外です。
          </p>
          <p>
            このため送料（オレンジコネックス・日本郵便）はマリオットに割り当てていません。仕入れはポイントが付く前提で計算していますが、仕入れ先が事業用加盟店に登録されると0ポイントになる場合があります。0ポイントの支払いも無料宿泊の条件（年400万円）には数えられます。
          </p>
          <p>マイルへの交換は60,000ポイント単位（→25,000マイル）で計算しています。端数のポイントはマイルにしていません。</p>
        </Item>
        {ocBankActive && (
          <Item title="オレンジコネックスの銀行振込">
            <p>
              {d(RULES.ocBank.endDate)}まで、銀行振込で払うと送料・サーチャージ・関税の{RULES.ocBank.rate * 100}%が還元されます。前払いになる点に注意してください。
            </p>
          </Item>
        )}
        <Item title="各カードの上限">
          <ul className="list-disc space-y-1 pl-5">
            <li>アメックス（ビジネス・グリーン／ゴールド）：3倍は年500万円まで（9月1日〜翌8月31日）。ANAマイルへの移行は年4万マイルまで（1月1日〜12月31日、アメックスの全カード合算）で、移行には年間参加費5,500円がかかります（年会費に含めて計算）。Yahoo!フリマは3倍の対象外です。</li>
            <li>メルカード：メルカリでの還元は月5,000ポイントまで。計算は毎月均等に使う前提です（1か月に集中して払うと、その月は5,000ポイントで頭打ちになります）。メルカリ以外は通常1%（一部対象外の加盟店あり）。</li>
            <li>セゾンプラチナ・ビジネス：JALマイルの加算は年1,500万円まで。</li>
            <li>ANA JCB法人カード：年間の移行上限は記載なし。ANAダイナースは移行上限なし（公式明記）。</li>
            <li>Airカード：利用枠（総枠）は最大500万円で、入会時は最大100万円。利用枠は支払い前の残高も含むため、月の利用額が枠に近いと足りなくなります。この計算は利用枠を考慮しない参考計算です。送料が大きい場合は、UPSIDERやアメックス・ダイナースを受け皿に。</li>
          </ul>
        </Item>
        <Item title="候補から外したカード">
          <ul className="list-disc space-y-1 pl-5">
            {EXCLUDED_CARDS.map((c) => (
              <li key={c.name}>
                <span className="font-medium">{c.name}</span>：{c.reason}
              </li>
            ))}
          </ul>
        </Item>
        <Item title="申し込み前に">
          <p>カードの規約はよく変わります。申し込み前に中村へご相談ください。</p>
        </Item>
      </div>
    </Section>
  )
}

export function Footer({ assumptions: a }: { assumptions: Assumptions }) {
  const cards = Object.values(CARDS)
  return (
    <footer className="mt-8 space-y-4 border-t border-stone-200 pt-6 text-xs leading-relaxed text-stone-600 dark:border-stone-800 dark:text-stone-400">
      <div>
        <h2 className="font-bold text-stone-800 dark:text-stone-200">計算の前提</h2>
        <ul className="mt-1 list-disc pl-5">
          <li>1マイル＝{a.mileValue}円、マリオット1ポイント＝{a.marriottPointValue}円（ホテルで使う場合）、無料宿泊1泊＝{yen(a.freeNightValue)}</li>
          <li>メルカードのメルカリ還元率 {Math.round(a.mercardRate * 100)}%（毎月均等に利用）、Airカードの利用枠（総枠）{a.airLimit / 10_000}万円</li>
          <li>年会費は2年目以降の金額（税込）。継続ボーナスマイルは毎年もらえる前提</li>
          <li>
            アメックスのポイントはANAマイルで使う前提（年間参加費込み）。4万マイルを超えた分は、
            {a.useOtherAirlines ? `ANA以外の航空会社のマイル（1pt＝${RULES.amex.overflowMileRate}マイル）で評価` : '価値0円で計算'}
          </li>
        </ul>
      </div>
      <div>
        <h2 className="font-bold text-stone-800 dark:text-stone-200">掲載カード（確認日 {d(VERIFIED_AT)}）</h2>
        <ul className="mt-1 grid gap-x-4 sm:grid-cols-2">
          {cards.map((c) => (
            <li key={c.id}>
              <a className="underline decoration-stone-300 underline-offset-2 hover:text-teal-700" href={c.sourceUrl} target="_blank" rel="noopener noreferrer">
                {c.name}
              </a>
              ：年会費 {totalFee(c) === 0 ? '無料' : yen(totalFee(c))}・{c.summary}
            </li>
          ))}
        </ul>
      </div>
      <p>
        この計算は目安です。還元率・年会費・特典は各カード会社の規約改定で変わります。実際の還元は支払い先の加盟店区分や各社の判定によって異なる場合があります。最新の条件は各社の公式サイトで確認してください。
      </p>
      <p>© MoneyGoose</p>
    </footer>
  )
}
