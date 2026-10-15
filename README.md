# いい感じカウンター（iikanji-counter）

「とりあえず」「いい感じに」…プロンプトに混ざった口癖を数えて、楽しく振り返れる Claude Code の mod です。

紹介サイト: https://iikanji.kazuumi.page/

## 紹介動画（1分）

<video src="docs/intro.mp4" controls width="720"></video>

動画が表示されない場合は、[docs/intro.mp4](docs/intro.mp4) を開いてください。画面は再現イメージです。

## できること

- 口癖を捕まえると、プロンプト上に虹色のバナーが出ます。掛け声は毎回ランダムです（「🎣 釣れた！」「🚨 いい感じセンサー反応！」など）
- 口癖ごとのキャラクターが現れます（「いい感じに」→ 🪄 ふんわり魔法使い、「とりあえず」→ 🏃 見切り発車の妖精）
- 口癖が出た箇所を、前後の文脈つきで引用します
- 言い換えのヒントを「前 → 後」で出します（例: 「いい感じにして」→「読みやすさ優先で、既存の書き方に合わせて」）
- ランキング・パネル（`/iikanji`）で、順位バー・次のランクまでの回数・直近 7 日の推移（先週比）・実績バッジを見られます
- 世界ランキング（任意）に参加すると、「4 位まであと 3 回」のように追い上げを見られます
- コードブロックとインラインコード内の語は数えません
- 累計は保存され、セッションをまたいで貯まります

最初から数える語: とりあえず / いい感じに / 良き感じに / よしなに / ちょっと / なんか / たぶん / 一応 / ざっくり / さくっと / 適当に / いったん

## インストール

ターミナルの Claude Code で次を入力します。

```
/plugin install iikanji-counter --marketplace KazuumiN/iikanji-counter
```

マーケットプレイスの追加を聞かれたら `y`、スコープは `user`（Enter）を選びます。

ローカルのフォルダから入れる場合:

```
claude plugin marketplace add /path/to/iikanji-counter
claude plugin install iikanji-counter@kazuumi-mods --scope user
```

## コマンド

| コマンド | 内容 |
| --- | --- |
| `/iikanji` | ランキング・パネルを開く |
| `/iikanji settings` | 設定パネルを開く |
| `/iikanji add 語` | 口癖を追加する |
| `/iikanji remove 語` | 口癖から外す（過去の回数は残る） |

## 世界ランキング（任意）

| コマンド | 内容 |
| --- | --- |
| `/iikanji join [名前]` | 参加する。名前を省略するとランダムな名前になる |
| `/iikanji rename 名前` | 表示名を変える |
| `/iikanji world` | 世界ランキングを更新してパネルを開く |
| `/iikanji leave` | 退会し、サーバー上のデータを削除する |

参加すると、名前・通算回数・既定語の種類数・一番多い既定語だけを送ります。プロンプトの文章や、自分で追加した語は送りません。参加するまでは、何も送りません。

名前は全員に公開されます。本名・会社名・連絡先は入れないでください。メールアドレス、URL、電話番号に見える名前は受け付けません。90 日更新がないと、自動で削除します。

## 設定（うるさいと感じたとき）

`/iikanji settings` で設定パネルを開けます。パネルとバナーの「⚙ 設定」ボタンからも開けます。数えること自体は、どの設定でも止まりません。

| 名前 | 内容 | 初期値 |
| --- | --- | --- |
| `celebrate` | お祝いバナー（all＝毎回 / milestone＝節目と実績だけ / off＝なし） | all |
| `quote` | バナー内の引用とキャラ | on |
| `hint` | バナー内の言い換えヒント | on |
| `band` | プロンプト上の小さな帯 | on |
| `auto-open` | 最初の口癖でパネルを自動で開く | on |
| `sync` | 世界ランキングへの自動送信（参加中のみ） | on |
| `daily` / `badges` / `world` | パネルの各セクション | on |

```
/iikanji settings quote off
/iikanji settings celebrate milestone
/iikanji settings reset
```

## 開発

```
claude plugin validate .
claude plugin test .
```
