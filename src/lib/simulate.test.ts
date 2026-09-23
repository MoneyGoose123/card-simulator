import { describe, expect, it } from 'vitest'
import { DEFAULT_ASSUMPTIONS, PAYEES, type Goal, type Payee } from '../data/cards'
import { evaluateCombo, simulate, toggleGoal, type SimInput } from './simulate'

const MAN = 10_000

function input(spendMan: Partial<Record<Payee, number>>, goals: Goal[], over: Partial<SimInput['assumptions']> = {}): SimInput {
  const spend = Object.fromEntries(PAYEES.map((p) => [p, (spendMan[p] ?? 0) * MAN])) as Record<Payee, number>
  return {
    spend,
    goals,
    entity: 'corp',
    today: '2026-09-23',
    // 9章の前提：mileValue 2円、mercardRate 4%、ocBankTransfer オフ、airLimit 500万円
    assumptions: { ...DEFAULT_ASSUMPTIONS, mileValue: 2, mercardRate: 0.04, ocBankTransfer: false, airLimit: 5_000_000, ...over },
  }
}

const cardsOf = (r: { cardIds: string[] }) => [...r.cardIds].sort()
const hasWarning = (r: ReturnType<typeof simulate>, id: string) => r.warnings.some((w) => w.id === id)

describe('9章 テストケース', () => {
  it('#1 Amazon 200万・ana → ビジネス・グリーン、ANA上限の警告', () => {
    const r = simulate(input({ amazon: 200 }, ['ana']))
    expect(cardsOf(r.best)).toEqual(['bizGreen'])
    // 60,000pt中 ANA 40,000マイル（80,000円）＋ 20,000pt×0.8×2円（32,000円）
    // − 年会費13,200円・リワード・プラス3,300円・ANA移行参加費5,500円
    expect(r.best.net).toBe(80_000 + 32_000 - 22_000)
    expect(hasWarning(r, 'amexAnaCap')).toBe(true)
  })

  it('#2 Yahoo!フリマ 200万・ana → アメックスは採用されない', () => {
    const r = simulate(input({ yfurima: 200 }, ['ana']))
    expect(r.best.cardIds).not.toContain('bizGreen')
    expect(cardsOf(r.best)).toEqual(['anaJcb'])
  })

  it('#3 日本郵便 300万・hotel → 送料はマリオットに割り当てずAirカード', () => {
    const r = simulate(input({ jp: 300 }, ['hotel']))
    expect(cardsOf(r.best)).toEqual(['air'])
    expect(r.best.allocations.every((a) => a.cardId !== 'marriott')).toBe(true)
  })

  it('#4 Amazon 100万・cash → JCB Biz ONEで2%（20,000円）、年会費0円', () => {
    const r = simulate(input({ amazon: 100 }, ['cash']))
    expect(cardsOf(r.best)).toEqual(['bizOne'])
    expect(r.best.gross).toBe(20_000)
    expect(r.best.fees).toBe(0)
  })

  it('#5 その他仕入れ 300万・ana → ANA JCB法人カード、ANAダイナースは自動選択されない', () => {
    const r = simulate(input({ other: 300 }, ['ana']))
    expect(cardsOf(r.best)).toEqual(['anaJcb'])
    expect(r.candidates).not.toContain('anaDiners')
  })

  it('#6 その他仕入れ 1,720万・ana → ANA JCB法人カードとプレミアムの差がほぼ0', () => {
    const i = input({ other: 1720 }, ['ana'])
    const jcb = evaluateCombo(['anaJcb'], i)
    const premium = evaluateCombo(['anaDinersPremium'], i)
    expect(Math.abs(jcb.net - premium.net)).toBeLessThan(1_000)
    // B案（60,000pt単位の交換）でも、この額ではマリオットを含む組み合わせの方が得になる
    expect(simulate(i).best.cardIds).toContain('marriott')
  })

  it('#7 送料のみ 440万・jal → セゾンとAirカードの差がほぼ0', () => {
    const i = input({ jp: 440 }, ['jal'])
    const saison = evaluateCombo(['saison'], i)
    const air = evaluateCombo(['air'], i)
    expect(Math.abs(saison.net - air.net)).toBeLessThan(1_000)
  })

  it('#8 メルカリ 300万・cash → メルカード150万（60,000円）＋ Airカード150万', () => {
    const r = simulate(input({ mercari: 300 }, ['cash']))
    expect(cardsOf(r.best)).toEqual(['air', 'mercard'])
    const merc = r.best.allocations.find((a) => a.cardId === 'mercard')!
    const air = r.best.allocations.find((a) => a.cardId === 'air')!
    expect(merc.amount).toBe(1_500_000)
    expect(merc.value).toBe(60_000)
    expect(air.amount).toBe(1_500_000)
    expect(hasWarning(r, 'mercardCap')).toBe(true)
  })

  it('#9 その他仕入れ 2,000万・jal → セゾン1,500万、残り500万はAirカード、セゾン上限の警告', () => {
    const i = input({ other: 2000 }, ['jal'])
    const combo = evaluateCombo(['saison', 'air'], i)
    expect(combo.allocations.find((a) => a.cardId === 'saison')!.amount).toBe(15_000_000)
    expect(combo.allocations.find((a) => a.cardId === 'air')!.amount).toBe(5_000_000)
    expect(combo.warnings.some((w) => w.id === 'saisonCap')).toBe(true)
    // 全体の最適はマリオット（B案でも 10ブロック＝25万マイル）
    expect(cardsOf(simulate(i).best)).toEqual(['marriott'])
  })

  it('#10 送料 2,400万・airLimit 100万・cash → 利用枠の警告', () => {
    const r = simulate(input({ oc: 2400 }, ['cash'], { airLimit: 1_000_000 }))
    expect(cardsOf(r.best)).toEqual(['air'])
    expect(hasWarning(r, 'airLimit')).toBe(true)
  })

  it('#11 目的を3つ選ぼうとすると3つ目は選択できず案内が出る', () => {
    const res = toggleGoal(['ana', 'jal'], 'hotel')
    expect(res.goals).toEqual(['ana', 'jal'])
    expect(res.error).toBe('2つまで選べます')
    expect(toggleGoal(['ana', 'jal'], 'jal').goals).toEqual(['ana'])
  })

  it('#12 ana＋jal・その他仕入れ 600万 → 貯まるものの内訳が両方表示される', () => {
    const r = simulate(input({ other: 600 }, ['ana', 'jal']))
    const keys = r.best.breakdown.map((b) => b.key)
    expect(keys).toContain('ana')
    expect(keys).toContain('jal')
  })
})

describe('マリオット（B案：60,000pt単位でマイル交換）', () => {
  it('端数のポイントはマイルにならない', () => {
    // 送料以外 250万 → 75,000pt → 1ブロック（25,000マイル）＋ 端数15,000ptは0
    const r = evaluateCombo(['marriott'], input({ other: 250 }, ['ana']))
    expect(r.gross).toBe(25_000 * 2)
  })

  it('ホテルとマイルを両方選ぶと、端数はホテルで使う前提で評価', () => {
    const r = evaluateCombo(['marriott'], input({ other: 250 }, ['ana', 'hotel']))
    expect(r.gross).toBe(Math.max(75_000 * 1, 25_000 * 2 + 15_000 * 1))
  })

  it('送料以外が400万円以上なら無料宿泊の価値を足す', () => {
    const r = evaluateCombo(['marriott'], input({ other: 400 }, ['hotel']))
    expect(r.freeNight).toBe(60_000)
    expect(r.net).toBe(120_000 + 60_000 - 82_500)
  })

  it('端数が出ないよう、同じ支払い先を60,000pt分だけマリオットに寄せる', () => {
    // その他 300万：マリオット200万（60,000pt＝25,000マイル）＋ ANA JCB 100万
    const r = evaluateCombo(['marriott', 'anaJcb'], input({ other: 300 }, ['ana']))
    expect(r.allocations.map((a) => [a.cardId, a.amount])).toEqual([
      ['marriott', 2_000_000],
      ['anaJcb', 1_000_000],
    ])
  })

  it('ブロックがちょうど埋まるように支払い先を組み合わせる', () => {
    // メルカリ 200万（60,000pt＝1ブロック）はマリオット、その他 50万はANA JCB
    const r = evaluateCombo(['marriott', 'anaJcb'], input({ mercari: 200, other: 50 }, ['ana']))
    const byPayee = Object.fromEntries(r.allocations.map((a) => [a.payee, a.cardId]))
    expect(byPayee).toEqual({ mercari: 'marriott', other: 'anaJcb' })
  })
})

describe('その他のルール', () => {
  it('オレンジコネックス銀行振込（期間内・オン）は2.1%', () => {
    const r = simulate(input({ oc: 100 }, ['cash'], { ocBankTransfer: true }))
    expect(r.ocBankActive).toBe(true)
    expect(r.best.allocations[0].cardId).toBe('ocBank')
    expect(r.best.net).toBe(21_000)
  })

  it('還元期間終了後は銀行振込を使わない', () => {
    const i = { ...input({ oc: 100 }, ['cash'], { ocBankTransfer: true }), today: '2027-01-01' }
    const r = simulate(i)
    expect(r.ocBankActive).toBe(false)
    expect(r.best.allocations.some((a) => a.cardId === 'ocBank')).toBe(false)
  })

  it('目的が0個なら cash として計算', () => {
    const r = simulate(input({ amazon: 100 }, []))
    expect(cardsOf(r.best)).toEqual(['bizOne'])
  })

  it('入力がすべて0でも計算できる', () => {
    const r = simulate(input({}, ['ana']))
    expect(r.best.cardIds).toEqual([])
    expect(r.best.net).toBe(0)
  })

  it('ANA JCBを採用し個人事業主なら口座条件の警告', () => {
    const r = simulate({ ...input({ other: 300 }, ['ana']), entity: 'sole' })
    expect(r.best.cardIds).toEqual(['anaJcbPersonal'])
    expect(r.candidates).not.toContain('anaJcb')
    expect(r.best.net).toBe(54_300)
    expect(hasWarning(r, 'anaJcbPersonal')).toBe(true)
  })

  it('3倍対象が500万円超なら超過分は1倍', () => {
    const r = evaluateCombo(['bizGreen'], input({ amazon: 600 }, ['ana']))
    // 500万×3% ＋ 100万×1% ＝ 160,000pt
    expect(r.allocations[0].units).toBe(160_000)
    expect(r.warnings.some((w) => w.id === 'amexBonusCap')).toBe(true)
  })

  it('比較用に「全部Airカード」と「Air＋メルカード＋Biz ONE」を返す', () => {
    const r = simulate(input({ amazon: 100, mercari: 100 }, ['ana']))
    expect(r.allAir.net).toBe(30_000 - 5_500)
    expect(r.cashTrio.net).toBe(20_000 + 40_000)
  })

  it('目的のカードより現金派が得なら警告', () => {
    const r = simulate(input({ amazon: 10 }, ['jal']))
    expect(hasWarning(r, 'cashBetter')).toBe(true)
  })

  it('ANAに移せない分を他社マイルで使わない設定なら、超過分は0円', () => {
    const r = evaluateCombo(['bizGreen'], input({ amazon: 200 }, ['ana'], { useOtherAirlines: false }))
    expect(r.net).toBe(80_000 - 22_000)
  })
})

describe('検証レポート（2026-09-23）の再現ケース', () => {
  it('2: メルカリ500万・ホテル → マリオット400万＋メルカード100万（137,500円）', () => {
    const r = simulate(input({ mercari: 500 }, ['hotel']))
    expect(r.best.net).toBe(137_500)
    expect(r.best.allocations.find((a) => a.cardId === 'marriott')!.amount).toBe(4_000_000)
  })

  it('2: Amazon 1,000万・ANA → グリーン500万＋ANA JCB 500万（参加費込みで328,025円）', () => {
    const r = simulate(input({ amazon: 1000 }, ['ana']))
    expect(cardsOf(r.best)).toEqual(['anaJcb', 'bizGreen'])
    expect(r.best.allocations.find((a) => a.cardId === 'bizGreen')!.amount).toBe(5_000_000)
    expect(r.best.net).toBe(333_525 - 5_500)
  })

  it('3: その他10万・ANA → 年会費無料のメルカード（通常1%）になり、現金派の警告が出る', () => {
    const r = simulate(input({ other: 10 }, ['ana']))
    expect(r.best.cardIds).toEqual(['mercard'])
    expect(r.best.net).toBe(1_000)
    expect(hasWarning(r, 'cashBetter')).toBe(true)
  })

  it('3: 還元のあるカードがない支払いも「還元なし」として金額を残す', () => {
    const r = evaluateCombo([], input({ other: 10 }, ['ana']))
    expect(r.allocations).toEqual([expect.objectContaining({ payee: 'other', cardId: 'none', amount: 100_000 })])
  })

  it('4: 「全部Airカード」に銀行振込が混ざらない', () => {
    const r = simulate(input({ oc: 300 }, ['cash'], { ocBankTransfer: true }))
    expect(r.best.net).toBe(63_000)
    expect(r.allAir.net).toBe(45_000 - 5_500)
  })

  it('5: 上限超過分の送り先でもセゾンの上限を超えない', () => {
    const r = evaluateCombo(['mercard', 'saison', 'air'], input({ mercari: 200, other: 1500 }, ['jal']))
    const saison = r.allocations.filter((a) => a.cardId === 'saison').reduce((s, a) => s + a.amount, 0)
    expect(saison).toBeLessThanOrEqual(15_000_000)
    expect(r.allocations.reduce((s, a) => s + a.amount, 0)).toBe(17_000_000)
  })
})


describe('追加機能と配分の回帰テスト', () => {
  it('メルカリ600万＋Amazon100万では高還元の150万円をメルカードに残す', () => {
    const r = simulate(input({ mercari: 600, amazon: 100 }, ['hotel']))
    expect(r.best.net).toBe(202_500)
    expect(r.best.allocations.filter(a => a.cardId === 'mercard').reduce((sum, a) => sum + a.amount, 0)).toBe(1_500_000)
  })
  it('メルカードに100万円だけ割り当てた場合は上限到達と誤表示しない', () => {
    const r = simulate(input({ mercari: 500 }, ['hotel']))
    expect(hasWarning(r, 'mercardCap')).toBe(false)
  })
  it('1か月に集中する場合はメルカードの還元を5,000円までにする', () => {
    const r = simulate(input({ mercari: 300 }, ['cash'], { mercariMonths: 1 }))
    const merc = r.best.allocations.find(a => a.cardId === 'mercard')!
    expect(merc.amount).toBe(125_000)
    expect(merc.value).toBe(5_000)
    expect(r.best.allocations.reduce((sum, a) => sum + a.amount, 0)).toBe(3_000_000)
  })
  it('カード枚数の制限を守り、比較用の現金派にも適用する', () => {
    const full = simulate(input({ amazon: 200, mercari: 300, jp: 200 }, ['ana', 'hotel']))
    for (const maxCards of [1, 2, 3]) {
      const r = simulate(input({ amazon: 200, mercari: 300, jp: 200 }, ['ana', 'hotel'], { maxCards }))
      expect(r.best.cardIds.length).toBeLessThanOrEqual(maxCards)
      expect(r.cashTrio.cardIds.length).toBeLessThanOrEqual(maxCards)
      expect(r.best.net).toBeLessThanOrEqual(full.best.net)
      expect(r.best.allocations.reduce((sum, a) => sum + a.amount, 0)).toBe(7_000_000)
    }
  })
  it('招待制は明示した場合だけ候補に入り、法人では個人向けJCBを除く', () => {
    const r = simulate(input({ other: 2000 }, ['ana']))
    expect(r.candidates).not.toContain('anaDinersPremium')
    expect(r.candidates).not.toContain('anaJcbPersonal')
    expect(simulate(input({ other: 2000 }, ['ana'], { allowInviteOnly: true })).candidates).toContain('anaDinersPremium')
  })
})
