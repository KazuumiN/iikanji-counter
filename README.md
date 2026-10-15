# kuchiguse-counter

プロンプトに混ざった口癖（「とりあえず」「いい感じに」など）を数えて、楽しく振り返れる Claude Code の mod です。

## 紹介動画（1分）

<video src="docs/intro.mp4" controls muted width="720"></video>

動画が表示されない場合は、[docs/intro.mp4](docs/intro.mp4) を開いてください。画面は再現イメージで、音楽が入っています。

## できること

- 口癖を検知すると、プロンプト上に虹色のお祝いバナーが出ます（5 回ごとの節目は特別メッセージ）
- バナーに「言い換えヒント」が出ます（例:「いい感じに」→ 基準を書くヒント）
- ランキング・パネル（`/kuchiguse`）で、順位バー・直近 7 日の推移（先週比）・実績バッジを見られます
- コードブロックとインラインコード内の語は数えません
- 累計は保存され、セッションをまたいで貯まります

最初から数える語: とりあえず / いい感じに / 良き感じに / よしなに / ちょっと / なんか / たぶん / 一応 / ざっくり / さくっと / 適当に / いったん

## インストール

ターミナルの Claude Code で次を入力します。

```
/plugin install kuchiguse-counter --marketplace <owner>/<repo>
```

マーケットプレイスの追加を聞かれたら `y`、スコープは `user`（Enter）を選びます。

ローカルのフォルダから入れる場合:

```
claude plugin marketplace add /path/to/kuchiguse-counter
claude plugin install kuchiguse-counter@kazuumi-mods --scope user
```

## コマンド

| コマンド | 内容 |
| --- | --- |
| `/kuchiguse` | ランキング・パネルを開く |
| `/kuchiguse add 語` | 口癖を追加する |
| `/kuchiguse remove 語` | 口癖から外す（過去の回数は残る） |

## 開発

```
claude plugin validate .
claude plugin test .
```

## 世界ランキング（任意）

| コマンド | 内容 |
| --- | --- |
| `/kuchiguse join [名前]` | 参加する。名前を省略するとランダムな名前になる |
| `/kuchiguse rename 名前` | 表示名を変える |
| `/kuchiguse world` | 世界ランキングを更新してパネルを開く |
| `/kuchiguse leave` | 退会し、サーバー上のデータを削除する |

参加すると、名前・通算回数・既定語の種類数・一番多い既定語だけを送ります。プロンプトの文章や、自分で追加した語は送りません。参加するまでは、何も送りません。

## 設定（うるさいと感じたとき）

`/kuchiguse settings` で設定パネルを開けます。パネルとバナーの「⚙ 設定」ボタンからも開けます。数えること自体は、どの設定でも止まりません。

| 名前 | 内容 | 初期値 |
| --- | --- | --- |
| `celebrate` | お祝いバナー（all＝毎回 / milestone＝節目と実績だけ / off＝なし） | all |
| `quote` | バナー内の引用 | on |
| `hint` | バナー内の言い換えヒント | on |
| `band` | プロンプト上の小さな帯 | on |
| `auto-open` | 最初の口癖でパネルを自動で開く | on |
| `sync` | 世界ランキングへの自動送信（参加中のみ） | on |
| `daily` / `badges` / `world` | パネルの各セクション | on |

```
/kuchiguse settings quote off
/kuchiguse settings celebrate milestone
/kuchiguse settings reset
```
