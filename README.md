# MoneyGoose カード選びシミュレーター

eBayスクール会員向けに、事業の支払いをどのクレジットカードで払うと一番得かを年間の支払い額から計算するアプリ。

- カードの数値・規約の前提：`src/data/cards.ts`（ここだけ直せば計算に反映される）
- 計算ロジック：`src/lib/allocate.ts`（組み合わせ内の割り当て）、`src/lib/simulate.ts`（組み合わせの総当たり・警告）、`src/lib/breakeven.ts`（損益分岐点）
- マリオットのマイル交換は60,000pt単位（端数はマイルにしない）

```bash
npm install
npm test        # Vitest
npm run dev
npm run build
```

main へ push すると GitHub Actions でテスト→ビルド→GitHub Pages に公開されます。
