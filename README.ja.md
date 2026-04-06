> **注意：** これは README.md の翻訳版です。原文の英語版の方が最新の内容を含んでいる場合があります。

# AS Notes（パーソナルナレッジマネジメント VS Code 拡張機能）

ウェブサイト：[asnotes.io](https://www.asnotes.io) | 開発者：[App Software Ltd](https://www.appsoftware.com) | [Discord](https://discord.gg/QmwY57ts) | [Reddit](https://www.reddit.com/r/AS_Notes/) | [X](https://x.com/AppSoftwareLtd)

[![VS Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/appsoftwareltd.as-notes?label=VS%20Marketplace&color=blue)](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/appsoftwareltd.as-notes)](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/appsoftwareltd.as-notes)](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/appsoftwareltd.as-notes)](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes)
[![License](https://img.shields.io/badge/license-Elastic--2.0-lightgrey)](https://github.com/appsoftwareltd/as-notes/blob/main/LICENSE)
[![CI](https://github.com/appsoftwareltd/as-notes/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/appsoftwareltd/as-notes/actions/workflows/ci.yml)

|||
|--|--|
|インストール | [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=appsoftwareltd.as-notes) / [Open VSX](https://open-vsx.org/extension/appsoftwareltd/as-notes)|
|Pro 機能 | [asnotes.io/pricing](https://www.asnotes.io?attr=src_readme)|
|ドキュメント | [docs.asnotes.io](https://docs.asnotes.io)|
|ブログ | [blog.asnotes.io](https://blog.asnotes.io)|
|ロードマップ / プロジェクトボード| [docs.asnotes.io/development-roadmap](https://docs.asnotes.io/development-roadmap.html) / [github.com](https://github.com/orgs/appsoftwareltd/projects/16)|

## AS Notes とは？

**AS Notes は、Markdown と `[[wikilink]]` 編集機能を [VS Code](https://code.visualstudio.com/) および互換エディタ（[Antigravity](https://antigravity.google/)、[Cursor](https://cursor.com/)、[Windsurf](https://windsurf.com/) など）に直接統合し、ノート、ドキュメント、ブログ、Wiki の作成を可能にします。**

**アイデアを記録し、概念をリンクし、執筆に集中 - エディタを離れることなく。**

AS Notes は、お気に入りの IDE をパーソナルナレッジマネジメントシステム（PKMS）に変える生産性ツールを提供します。バックリンクビュー、タスク管理、ジャーナル、カンバンボード、Markdown 編集ツール、Mermaid 図表、LaTeX 数式サポート、Jekyll / Hugo 風の静的サイト公開機能を含みます。

（1 分間の紹介動画）

[![AS Notes デモ](https://img.youtube.com/vi/bwYopQ1Sc5o/maxresdefault.jpg)](https://www.youtube.com/watch?v=bwYopQ1Sc5o)

（1 分間のデモ動画）

[![AS Notes デモ](https://img.youtube.com/vi/liRULtb8Rm8/maxresdefault.jpg)](https://youtu.be/liRULtb8Rm8)

## なぜ VS Code なのか？

私たちの多くは VS Code やその互換エディタを毎日使用しており、ノートやナレッジマネジメントに別のツールを使っている場合でも、ドキュメント、ブログ、Wiki は IDE で書くことが多いです。AS Notes は IDE ですべてを完結させるツールを提供します。

AS Notes が直接提供する機能に加えて、VS Code でノートを管理する主な利点：

- クロスプラットフォーム互換性 + Web（Workspaces 経由）
- 他のナレッジマネジメントツールでは許可されない可能性がある制限された作業環境での受容性
- AS Notes と組み合わせて機能をさらに拡張できる豊富な拡張機能ライブラリ
- ノートの作業に使用できる組み込み AI エージェントハーネス（GitHub CoPilot / Claude など）
- 最先端のテキスト編集および UI 機能
- シンタックスハイライト
- VS Code が持つその他のすべての機能

## AS Notes の機能

### 一般機能

- プライバシー重視 - AS Notes はデータやテレメトリを一切送信しません
- バージョン管理フレンドリー（Git & GitOps）
- 軽量なノートインデックス（ローカル sqlite3 WASM）

- 大規模（約 2 万の Markdown ファイル）なナレッジベースでも高いパフォーマンス

### Wiki リンク

- Logseq / Roam / Obsidian 風の `[[wikilinks]]` とネストリンクサポート（例：`[[[[AS Notes]] Page]]`）
- リンクはワークスペース内の任意の場所のターゲットページに解決されます。ネスト Wiki リンクは複数のターゲットを解決可能
- リンクの名前変更でターゲットファイルとすべてのマッチする参照が更新されます
- 自動 Wiki リンク / ファイル名変更追跡

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/wikilinks.png" alt="AS Notes backlinks wikilinks" style="max-height:200px; margin-top: 10px">

Wiki リンクの詳細については、[Wiki リンクドキュメント](https://docs.asnotes.io/wikilinks.html) を参照してください。

### タスク管理

`Ctrl+Shift+Enter`（Windows/Linux）/ `Cmd+Shift+Enter`（macOS）で Markdown TODO の切り替え：

```
- [ ] TODO マーカーを追加
- [x] TODO を完了としてマーク
TODO マーカーを削除
```

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/task-management-panel.png" alt="AS Notes todo panel" style="max-height:260px; margin-top: 10px; margin-bottom: 10px;">

#### タスクメタデータタグ

タスク行の任意の位置に構造化ハッシュタグメタデータを追加して、タスクを分類・整理します。タグは表示されるタスクテキストから除去され、クリーンな説明のみが表示されます。

| タグ | 説明 |
|---|---|
| `#P1` | 優先度 1 - クリティカル |
| `#P2` | 優先度 2 - 高 |
| `#P3` | 優先度 3 - 通常 |
| `#W` | 待機中 - タスクがブロックされているか、誰か/何かを待っている |
| `#D-YYYY-MM-DD` | 期限日 - 例：`#D-2026-03-15` |
| `#C-YYYY-MM-DD` | 完了日 - 例：`#C-2026-03-15` |

使用例：

```markdown
- [ ] #P1 本番環境の重大なバグを修正する
- [ ] #P2 #W 新しいダッシュボードのデザイン承認待ち
- [x] #D-2026-03-10 四半期レポートを提出
```

複数のタグを組み合わせることが可能です。優先度タグは 1 つのみ使用されます - 複数ある場合、最初のものが優先されます。

#### タスク管理

**AS Notes** アクティビティバーアイコンからタスクサイドバーを開き、ワークスペース全体のすべてのタスクを表示します。

**グループ化** - タスクのグループ化方法を選択：

| ビュー | 説明 |
|---|---|
| **ページ** | タスクをソースページのアルファベット順にグループ化 |
| **優先度** | タスクを優先度レベル別にグループ化（P1 → P2 → P3 → 優先度なし）、各グループ内は期限日でソート |
| **期限日** | タスクを期限日別にグループ化 |
| **完了日** | タスクを完了日別にグループ化 |

**フィルター：**

- **TODO のみ** - 未完了のタスクのみ表示（デフォルトでオン）
- **待機中のみ** - `#W` タグ付きのタスクのみ表示
- **ページでフィルター** - テキストを入力して、名前に検索テキストを含むページに絞り込み（大文字小文字を区別しない）

### バックリンクパネル

バックリンクパネルはページへの参照を表示します。参照はページへの言及、アウトライナー形式での他の Wiki リンク下のインデント、または他の Wiki リンク内のネストによって捕捉されます。バックリンク追跡は周囲のコンテキストを捕捉し、フォワードリファレンス（Wiki リンクはあるがまだ作成されていないページ）に対応し、インデックスの変更時にリアルタイムで更新されます。

次のショートカットで現在のタブの横にバックリンクエディタータブを開く：`Ctrl+Alt+B`（Windows/Linux）/ `Cmd+Alt+B`（macOS）

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/as-notes-backlink-panel.png" alt="AS Notes backlinks panel" style="max-height:400px; margin-top: 10px">

#### ビューモード

パネルは 2 つのビューモードをサポートし、パネルヘッダーのボタンで切り替え可能：

- **ページ別フラット表示**（デフォルト）- すべてのバックリンクインスタンスをソースページ名のアルファベット順に表示。ジャーナルファイルが時系列に並ぶ線形タイムラインビュー。
- **チェーン別グループ表示** - バックリンクをチェーンパターン（ページ名の並び）でグループ化し、折りたたみ可能なヘッダー付き。概念ベースの探索に便利。

デフォルトモードは `as-notes.backlinkGroupByChain`（デフォルト `false`）で設定。

別のトグルで**コンテキストの詳細度**を制御 - コンパクト（1 行、切り詰め）またはラップ（全文表示）。デフォルトは `as-notes.backlinkWrapContext`（デフォルト `false`）で設定。

#### チェーン優先表示

- **パターングループ化** - バックリンクがチェーンパターンでグループ化されます（例：異なるファイルからの `[[Project]] → [[Tasks]] → [[NGINX]]` がすべて 1 つのグループに表示）。
- **単独の言及** - 直接の `[[wikilink]]` 参照は単一リンクチェーンとして表示され、最初にソート。
- **アウトラインコンテキスト** - Wiki リンクが別の Wiki リンクの下にインデントされている場合、完全な階層がチェーンとして表示（例：`Page A → Page B → Page C`）、各リンクはクリック可能。
- **リンクごとの行番号** - 各チェーンリンクに行番号を表示（例：`[L12]`）、正確なナビゲーション用。
- **行コンテキスト** - 各チェーンインスタンスは周囲の行テキストを表示し、Wiki リンクがハイライトされ、ファイルを開かずに即座にコンテキストを把握可能。
- **大文字小文字を区別しないグループ化** - `[[server]]` と `[[Server]]` は同じチェーンパターンとなります。

#### コンテキストメニュー - バックリンクを表示

エディタ内の任意の Wiki リンクを右クリックして、その特定ページのバックリンクを開く：

- エイリアスに対応 - Wiki リンクがエイリアスをターゲットにしている場合、正規ページのバックリンクが表示されます。
- フォワードリファレンスに対応 - まだ存在しないページでも、受信リンクが表示されます。

### カンバンボード

AS Notes には Markdown ファイルで管理される組み込みカンバンボードがあり、AS Notes の他のページと同様に使用・編集できます。

カンバンボードを使用して長期プロジェクトを追跡します。標準タスクは、AS Notes の他のノートと同様にカンバンカードファイルで使用できます。

### デイリージャーナル

**Ctrl+Alt+J**（macOS では Cmd+Alt+J）を押して、今日のデイリージャーナルページを作成または開きます。

ジャーナルファイルは専用の `journals/` フォルダ（設定可能）に `YYYY-MM-DD.md` として作成されます。新しいページはテンプレートフォルダ（デフォルト：`templates/`）の `Journal.md` テンプレートから生成されます。`Journal.md` を編集して独自のセクションやプロンプトを追加できます。すべてのテンプレートプレースホルダーがサポートされています - [テンプレート](#テンプレートpro) を参照。

サイドバーの**カレンダー**パネルは、ジャーナルインジケーター付きの当月を表示します。任意の日をクリックしてジャーナルエントリを開きます。詳細は[カレンダー](#カレンダー)を参照。

> **注意：** デイリージャーナルには初期化済みのワークスペース（`.asnotes/` ディレクトリ）が必要です。[はじめに](#はじめに) を参照してください。

### 他の Markdown PKMS との互換性

AS Notes は、類似のファイル構造のため、Obsidian や Logseq で作成されたナレッジベースと共存できます。ただし、フォーマットや動作の違いがあることにご注意ください。

### スラッシュコマンド

任意の Markdown ファイルで `/` を入力してクイックコマンドメニューを開きます。続けて入力してリストをフィルタリングし、Enter でコマンドを実行、Escape で閉じて `/` をそのまま残します。フェンスコードブロック、インラインコードスパン、YAML フロントマター内ではスラッシュコマンドは抑制されます。

#### 標準コマンド

| コマンド | アクション |
|---|---|
| **Today** | 今日の日付の Wiki リンクを挿入（例：`[[2026-03-06]]`） |
| **Date Picker** | 今日の日付が入力された日付入力ボックスを開く。日付を編集するか Enter を押して Wiki リンクとして挿入 |
| **Code (inline)** | `` ` `` `` ` `` を挿入し、バッククォートの間にカーソルを配置 |
| **Code (multiline)** | フェンスコードブロックを挿入し、開始 ` ``` ` の後にカーソルを配置 - 言語識別子（例：`js`）を入力して Enter を押す |

#### パブリッシュコマンド *（フロントマター）*

これらのコマンドは、ファイルの YAML フロントマターのパブリッシュ関連フィールドを切り替えまたは循環させます。詳細は[静的サイトの公開](#静的サイトの公開)を参照。

| コマンド | アクション |
|---|---|
| **Public** | フロントマターで `public: true` / `public: false` を切り替え |
| **Layout** | フロントマターで `layout` を `docs`、`blog`、`minimal` で循環 |
| **Retina** | フロントマターで `retina: true` / `retina: false` を切り替え |
| **Assets** | フロントマターで `assets: true` / `assets: false` を切り替え |

#### カンバンカードコマンド *（カンバンカードファイルのみ）*

以下のコマンドはカンバンカードファイル（`kanban/card_*.md`）の編集時のみ表示されます。

| コマンド | アクション |
|---|---|
| **Card: Entry Date** | カーソル位置に `## entry YYYY-MM-DD` 見出しを挿入（今日の日付が入力済み） |

#### タスクコマンド *（タスク行のみ）*

これらのコマンドはカーソルがタスク行（`- [ ]` または `- [x]`）にある場合のみ表示されます。タグはチェックボックスの後、行内の既存ハッシュタグの後に挿入されます。

| コマンド | アクション |
|---|---|
| **Task: Priority 1** | タスクテキストの先頭に `#P1` を挿入。行内の既存の優先度タグ（`#P1`-`#P9`）を置換 |
| **Task: Priority 2** | `#P2` を挿入、既存の優先度タグを置換 |
| **Task: Priority 3** | `#P3` を挿入、既存の優先度タグを置換 |
| **Task: Waiting** | タスクテキストの先頭で `#W` を切り替え（存在しなければ挿入、存在すれば削除） |
| **Task: Due Date** | 今日（YYYY-MM-DD）が入力された日付入力を開く。タスクテキストの先頭に `#D-YYYY-MM-DD` を挿入。既存の期限日タグを置換 |
| **Task: Completion Date** | 今日（YYYY-MM-DD）が入力された日付入力を開く。タスクテキストの先頭に `#C-YYYY-MM-DD` を挿入。既存の完了日タグを置換 |
| **Convert to Kanban Card** *(Pro)* | タスクを完了としてマークし、**TODO** レーンにタスクタイトル（タグ除去済み）、対応する優先度と期限日、**Waiting** フラグ付きのカンバンカードを作成。未チェックのタスクでのみ利用可能 |

優先度と待機タグは切り替え式：同じタグを再度使用すると削除されます。異なる優先度を使用すると既存のものが置換されます。期限日と完了日タグは同じタイプの既存タグを置換します。

#### Pro コマンド

Pro コマンドには Pro ライセンスが必要です。無料ユーザーにはメニューに **(Pro)** が付いた状態で表示されます。

| コマンド | アクション |
|---|---|
| **Template** | テンプレートフォルダからテンプレートのクイックピックリストを開き、選択したテンプレートをカーソル位置に挿入。プレースホルダーをサポート（[テンプレート](#テンプレートpro) を参照） |
| **Table** | 列数と行数の入力を求め、フォーマット済み Markdown テーブルを挿入 |
| **Table: Format** | 周囲のテーブルのすべての列幅を最長のセル内容に正規化 |
| **Table: Add Column(s)** | 数を入力し、カーソルの現在の列の後に列を追加 |
| **Table: Add Row(s)** | 数を入力し、カーソルの現在の行の後に行を追加 |
| **Table: Remove Row (Current)** | カーソルの行を削除（ヘッダー/セパレーターは拒否） |
| **Table: Remove Column (Current)** | カーソルの列を削除（単一列テーブルは拒否） |
| **Table: Remove Row(s) Above** | 数を入力し、カーソルの上のデータ行を削除（利用可能な範囲に制限） |
| **Table: Remove Row(s) Below** | 数を入力し、カーソルの下の行を削除（利用可能な範囲に制限） |
| **Table: Remove Column(s) Right** | 数を入力し、カーソルの右の列を削除（利用可能な範囲に制限） |
| **Table: Remove Column(s) Left** | 数を入力し、カーソルの左の列を削除（利用可能な範囲に制限、インデント保持） |

### ファイルドラッグ＆ドロップ / コピー + ペースト

ファイルマネージャーから Markdown エディタにファイルをドラッグ、またはクリップボードから画像をペースト - VS Code の組み込み Markdown エディタが自動でコピーとリンク挿入を処理します。

AS Notes は組み込みの `markdown.copyFiles.destination` ワークスペース設定を構成し、ドラッグ/ペーストされたファイルが Markdown ファイルの隣ではなく、専用のアセットフォルダに保存されるようにします。

| 設定 | デフォルト | 説明 |
|---|---|---|
| `as-notes.assetPath` | `assets/images` | ドラッグ/ペーストされたファイルが保存されるワークスペース相対フォルダ |

この設定は AS Notes の初期化時または値の変更時に自動的に適用されます。保存先フォルダは VS Code が初回使用時に作成します。

**ヒント：**

- **ドラッグ位置インジケーター：** ファイルをドラッグ中に **Shift** を押し続けると、リリース前にカーソル位置ガイドが表示されます - テキスト内にリンクを正確に配置するのに便利です。

### 画像ホバープレビュー

Markdown ファイル内の任意の画像リンクにマウスを乗せると、画像のインラインプレビューが表示されます。標準実装は VS Code の組み込み Markdown 拡張機能により提供され、設定不要 - 標準の `![alt](path)` リンクとドラッグ/ペーストした画像の両方で動作します。インライン Markdown エディタモードには拡張画像表示が含まれます。

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/image-preview.png" alt="AS Notes Image Preview" style="max-height:300px; margin-top: 10px; margin-bottom: 10px;">

#### コードブロック補完

コードブロック補完は**すべての** Markdown ファイルで機能します - アウトライナーモードは不要です。

`` ``` ``（オプションで言語指定、例：`` ```javascript ``）を入力して **Enter** を押すと、AS Notes が自動的に閉じの `` ``` `` を挿入し、ブロック内にカーソルを配置します。バレット行では、Markdown リストの続行に合わせて内容がインデントされます。

拡張機能は既存のフェンスペアを認識します：バッククォートが既にバランスしている場合（同じインデントにマッチする閉じフェンスがある場合）、Enter は 2 つ目のスケルトンではなく単に改行を挿入します。

アウトライナーモードでは、バレットコードブロックに属する閉じ `` ``` `` 行で Enter を押すと、親のインデントに新しいバレットが挿入されます。

## AS Notes Pro 機能

**Pro ライセンス**でプレミアム機能がアンロックされます。有効なキーがアクティブな場合、ステータスバーに **AS Notes (Pro)** と表示されます。

ライセンスキーを取得するには、[asnotes.io](https://www.asnotes.io/pricing) にアクセスしてください。

**ライセンスキーの入力：**

- コマンドパレット（`Ctrl+Shift+P`）から **AS Notes: Enter Licence Key** を実行 - 最も簡単な方法です。
- または VS Code 設定（`Ctrl+,`）を開き、`as-notes.licenceKey` を検索してキーをペーストします。

### インラインエディタ Markdown スタイリング、Mermaid & LaTeX レンダリング（Pro）

AS Notes Pro には、VS Code（または互換エディタ）のエディタタブ内で Typora 風のオプショナルなインライン Markdown スタイリング、Mermaid 図表および LaTeX レンダリングが含まれます。標準の Markdown 構文文字（`**`、`##`、`[]()` など）は入力時に視覚的な等価物に置き換えられます。

<img src="https://raw.githubusercontent.com/appsoftwareltd/as-notes/main/images/readme/asnotes-inline-editor-markdown-styling-mermaid-andlatex-rendering.png" alt="Inline Editor Markdown Styling, Mermaid and LaTeX Rendering" style="max-height:400px; margin-top: 10px">

詳細は [インラインエディタ Markdown スタイリング、Mermaid & LaTeX レンダリング](https://docs.asnotes.io/inline-markdown-editing-mermaid-and-latex-rendering.html) を参照してください。

AS Notes には組み込みのインライン Markdown エディタがあり、Typora と同様にテキストエディタ内で直接フォーマットをレンダリングします。

**3 段階の可視性：**

| 状態 | タイミング | 表示内容 |
|---|---|---|
| **レンダリング** | カーソルが別の場所 | クリーンなフォーマット済みテキスト（構文非表示） |
| **ゴースト** | カーソルがその行にある | 透明度を下げた構文文字 |
| **ロー** | カーソルが構造内にある | 完全な Markdown ソース |

**サポートされる構造：**

太字、斜体、取り消し線、見出し（H1-H6）、インラインコード、リンク、画像、引用ブロック、水平線、順不同/タスクリスト、コードブロック（言語ラベル付き）、YAML フロントマター、GFM テーブル、絵文字ショートコード（`:smile:` 等）、Mermaid 図表（インライン SVG）、LaTeX/数式（KaTeX/MathJax）、GitHub メンションとイシュー参照。

**切り替え：** **AS Notes: Toggle Inline Editor** コマンドまたはエディタタイトルバーの目のアイコンをクリック。切り替え状態はワークスペースごとに保持されます。

**アウトライナーモード認識：** アウトライナーモードがアクティブな場合、バレットマーカーとチェックボックス構文はアウトライナー構造と並んでインラインでスタイリングされます（バレットはスタイリングされたバレットとして、チェックボックスはバレットとチェックボックスグラフィックとしてレンダリング）。

| 設定 | デフォルト | 説明 |
|---|---|---|
| `as-notes.inlineEditor.enabled` | `true` | インラインレンダリングの有効化/無効化 |
| `as-notes.inlineEditor.decorations.ghostFaintOpacity` | `0.3` | ゴースト状態の構文文字の透明度 |
| `as-notes.inlineEditor.links.singleClickOpen` | `false` | シングルクリックでリンクを開く（Ctrl+Click の代わり） |

インラインエディタ設定の完全なリストについては、[設定](#設定) を参照してください。

### テンプレート（Pro）

専用テンプレートフォルダ（デフォルト：`templates/`）に Markdown ファイルとして再利用可能なノートテンプレートを作成します。`/Template` スラッシュコマンドで任意の場所に挿入可能。

**セットアップ：** ワークスペースの初期化時にテンプレートが自動作成されます。デイリージャーナルエントリ用のデフォルト `Journal.md` テンプレートが含まれます。

**テンプレートの作成：** テンプレートフォルダに任意の `.md` ファイルを追加します。サブディレクトリがサポートされ、サブフォルダ内のテンプレートはピッカーで `folder/name` として表示されます。

**テンプレートの挿入：** 任意の Markdown ファイルで `/` を入力し、**Template** を選択してリストから選びます。テンプレートの内容はすべてのプレースホルダーが置換された状態でカーソル位置に挿入されます。

**プレースホルダー：**

| プレースホルダー        | 説明                                                    | 例                               |
|--------------------|----------------------------------------------------------------|---------------------------------------|
| `{{date}}`         | 現在の日付（YYYY-MM-DD）                                      | `2026-03-18`                          |
| `{{time}}`         | 現在の時刻（HH:mm:ss）                                        | `14:30:45`                            |
| `{{datetime}}`     | 完全な日時（YYYY-MM-DD HH:mm:ss）                       | `2026-03-18 14:30:45`                 |
| `{{filename}}`     | 拡張子なしの現在のファイル名                            | `My Page`                             |
| `{{title}}`        | `{{filename}}` のエイリアス                                       | `My Page`                             |
| `{{cursor}}`       | 挿入後のカーソル位置                                | *（カーソルはここ）*                 |
| カスタム日付形式 | `YYYY`、`MM`、`DD`、`HH`、`mm`、`ss` トークンの任意の組み合わせ | `{{DD/MM/YYYY}}` は `18/03/2026` に |

テンプレート内でリテラル `{{date}}` を出力するには、バックスラッシュでエスケープ：`\{{date}}`。

**ジャーナルテンプレート：** テンプレートフォルダの `Journal.md` ファイルが新しいデイリージャーナルエントリのテンプレートとして使用されます。編集して将来のジャーナルページをカスタマイズできます。

### テーブルコマンド

スラッシュコマンドメニュー（`/`）のすべてのテーブル操作は Pro 機能です。無料ユーザーには **(Pro)** 付きでリスト表示されますが、ライセンスがアクティブになるまでブロックされます。

テーブルコマンドの完全なリストについては、[スラッシュコマンド](#スラッシュコマンド) を参照してください。

### 暗号化ノート（Pro）

Pro ユーザーは機密ノートを暗号化ファイルに保存できます。`.enc.md` 拡張子を持つファイルは暗号化ノートとして扱われ、検索インデックスから除外され、拡張機能がプレーンテキストとして読み取ることはありません。

**暗号化の開始：**

1. コマンドパレットから **AS Notes: Set Encryption Key** を実行します。パスフレーズは OS キーチェーン（VS Code SecretStorage）に安全に保存され、ディスクや設定ファイルに書き込まれることはありません。
2. **AS Notes: Create Encrypted Note**（または日付付きジャーナルエントリの場合は **AS Notes: Create Encrypted Journal Note**）で暗号化ノートを作成します。
3. エディタでノートを作成します。ロックしたい場合は **AS Notes: Encrypt [All|Current] Note(s)** を実行 - すべてのプレーンテキスト `.enc.md` ファイルがその場で暗号化されます。
4. ノートを読むには **AS Notes: [All|Current] Note(s)** を実行 - 保存されたパスフレーズを使用してファイルがその場で復号化されます。

**暗号化の詳細：**

- アルゴリズム：AES-256-GCM、暗号化ごとにランダムな 12 バイト nonce
- 鍵導出：PBKDF2-SHA256（100,000 回反復）、パスフレーズから
- ファイル形式：単一行の `ASNOTES_ENC_V1:<base64url payload>` マーカー - Git pre-commit hook による誤ったコミットの防止に使用。

**コマンド：**

- `AS Notes: Set Encryption Key` - パスフレーズを OS キーチェーンに保存
- `AS Notes: Clear Encryption Key` - 保存されたパスフレーズを削除
- `AS Notes: Create Encrypted Note` - ノートフォルダに新しい名前付き `.enc.md` ファイルを作成
- `AS Notes: Create Encrypted Journal Note` - 今日のジャーナルエントリを `.enc.md` として作成
- `AS Notes: Encrypt All Notes` - すべてのプレーンテキスト `.enc.md` ファイルを暗号化
- `AS Notes: Decrypt All Notes` - すべての暗号化 `.enc.md` ファイルを復号化
- `AS Notes: Encrypt Current Note` - アクティブな `.enc.md` ファイルを暗号化（未保存のエディタ内容を読み取り）
- `AS Notes: Decrypt Current Note` - アクティブな `.enc.md` ファイルを復号化（ディスクから読み取り）

### アウトライナーモード

**アウトライナーモード**（`as-notes.outlinerMode` 設定または **AS Notes: Toggle Outliner Mode** コマンド）を有効にして、エディタをバレット優先のアウトライナーに変換します。すべての行が `-` から始まり、カスタムキーバインドで効率を維持：

| キー | アクション |
|---|---|
| **Enter** | 同じインデントに新しいバレットを挿入。TODO 行（`- [ ]`）は未チェックの TODO として続行。 |
| **Tab** | バレットを 1 レベルインデント（上のバレットより 1 レベル深いまで）。 |
| **Shift+Tab** | バレットを 1 レベルアウトデント。 |
| **Ctrl+Shift+Enter** | 循環：プレーンバレット → `- [ ]` → `- [x]` → プレーンバレット。 |
| **Ctrl+V / Cmd+V** | 複数行ペースト：クリップボードの各行が個別のバレットに。 |

## はじめに

サンプルナレッジベースについては、<https://github.com/appsoftwareltd/as-notes-demo-notes> をクローンし、そこの指示に従って初期化してください。

### ワークスペースの初期化

AS Notes はワークスペースルートまたは設定された `rootDirectory` サブディレクトリに `.asnotes/` ディレクトリがある場合にアクティブになります（`.git/` や `.obsidian/` と同様）。これがないと、拡張機能は**パッシブモード**で動作します - コマンドは初期化を促すフレンドリーな通知を表示し、ステータスバーがセットアップを案内します。

初期化するには：

1. コマンドパレットを開く（`Ctrl+Shift+P`）
2. **AS Notes: Initialise Workspace** を実行

これにより `.asnotes/` ディレクトリが作成され、すべての Markdown ファイルの SQLite インデックスが構築され、すべての機能がアクティブになります。インデックスファイル（`.asnotes/index.db`）は自動生成された `.gitignore` によって Git から除外されます。

### ソースコードと併用する

AS Notes はソフトウェアプロジェクト内のナレッジベースとして適しています。ノート、ジャーナル、ドキュメントをサブディレクトリ（例：`docs/` や `notes/`）に保存し、リポジトリの残りにはソースコードを配置できます。ルートディレクトリが設定されている場合、すべての AS Notes 機能（Wiki リンクのハイライト、補完、ホバーツールチップ、スラッシュコマンド）はそのディレクトリにスコープされます。その外部の Markdown ファイル（ワークスペースルートの `README.md` など）は完全に影響を受けません。

初期化時に、**Initialise Workspace** コマンドは場所の選択を求めます：

- **ワークスペースルート** - デフォルト、ワークスペース全体を使用
- **サブディレクトリを選択** - ワークスペースにスコープされたフォルダピッカーを開く

選択されたパスは `as-notes.rootDirectory` ワークスペース設定として保存されます。設定すると、すべての AS Notes データはそのディレクトリ内に存在します：`.asnotes/`、`.asnotesignore`、ジャーナル、テンプレート、ノート、カンバンボード、インデックス。スキャン、ファイル監視、インデックスはこのディレクトリにスコープされるため、外部のファイルは影響を受けません。

**Initialise Workspace** を実行する前に `as-notes.rootDirectory` が既に設定されている場合、コマンドは設定済みのパスを直接使用します。

> **警告：** 初期化後に `rootDirectory` を変更する場合、ノートディレクトリ（`.asnotes/` を含む）を新しい場所に手動で移動し、ウィンドウをリロードする必要があります。設定が変更されると拡張機能が警告を表示します。

### インデックスの再構築

インデックスが古くなったり破損した場合、コマンドパレットから **AS Notes: Rebuild Index** を実行します。進行状況インジケーター付きでインデックス全体を削除・再作成します。

### ワークスペースのクリーン

拡張機能が異常状態にある場合（例：クラッシュ後の WASM エラーの持続）、コマンドパレットから **AS Notes: Clean Workspace** を実行します。これにより：

- `.asnotes/` ディレクトリを削除（インデックスデータベース、ログ、Git hook 設定）
- すべてのメモリ内状態を解放し、パッシブモードに切り替え

AS Notes ルートの `.asnotesignore` は意図的に保持されます。その後 **AS Notes: Initialise Workspace** を実行して再開してください。

### インデックスからファイルを除外する

AS Notes がワークスペースを初期化すると、AS Notes ルートディレクトリに `.asnotesignore` ファイルが作成されます。このファイルは [`.gitignore` パターン構文](https://git-scm.com/docs/gitignore) を使用し、AS Notes インデックスから除外されるファイルとディレクトリを制御します。

**デフォルトの内容：**

```
# Logseq metadata and backup directories
logseq/

# Obsidian metadata and trash directories
.obsidian/
.trash/
```

先頭に `/` がないパターンは任意の深さでマッチします - `logseq/` は `logseq/pages/foo.md` と `vaults/work/logseq/pages/foo.md` を等しく除外します。`/` プレフィックスで AS Notes ルートのみにパターンをアンカーします（例：`/logseq/`）。

いつでも `.asnotesignore` を編集できます。AS Notes はファイルを監視し、変更時に自動的にインデックスを再スキャンします - 新しく無視されたファイルはインデックスから削除され、無視解除されたファイルが追加されます。

> **注意：** `.asnotesignore` はユーザーが編集可能で、バージョン管理されるファイルです。AS Notes は初回作成後に上書きすることはありません。

---

## トラブルシューティング

### ファイル同期ツール管理下でのパフォーマンス低下

一部の同期ツール（MS OneDrive、Google Drive、Dropbox など）でディレクトリが管理されている場合、VS Code エディタが遅く感じることが観察されています。

AS Notes ディレクトリは同期で管理可能ですが、同期ツールのようにファイルを監視せず、完全な競合解決機能を持つ Git の使用を推奨します。

### "このファイルはまだインデックスされていません"

現在のファイルが AS Notes インデックスにない場合、バックリンクパネルにこのメッセージが表示されます。一般的な原因：

- **VS Code `files.exclude` / `search.exclude` 設定** - AS Notes は `vscode.workspace.findFiles()` を使用して Markdown ファイルを検出しますが、これは VS Code の設定に従います。除外フォルダ内のファイル（例：`logseq/version-files/`）はスキャンから暗黙的に除外され、インデックスされません。インデックスされるべきファイルが欠落している場合は、**Settings → Files: Exclude** と **Settings → Search: Exclude** を確認してください。
- **`.asnotesignore` パターン** - AS Notes ルートの `.asnotesignore` のパターンにマッチするファイルはインデックスから除外されます。上記の [インデックスからファイルを除外する](#インデックスからファイルを除外する) を参照してください。
- **ファイルがまだ保存されていない** - 新しい未保存ファイルは、初めてディスクに保存されるまでインデックスされません。

解決するには、ワークスペース設定と `.asnotesignore` ファイルを確認してください。ファイルがインデックスされるべき場合は、除外パターンにマッチしていないことを確認し、コマンドパレットから **AS Notes: Rebuild Index** を実行してください。

## 開発

リポジトリは 3 つのパッケージを含む monorepo として構成されています：

| パッケージ | 説明 |
|---|---|
| `common/` | 共有 Wiki リンクパースライブラリ（`Wikilink`、`WikilinkService`、`MarkdownItWikilinkPlugin`） |
| `vs-code-extension/` | VS Code 拡張機能 |
| `publish/` | AS Notes ノートブック（Markdown + Wiki リンク）を静的 HTML に変換する CLI ユーティリティ |

ドキュメントソースは `docs-src/`（AS Notes ワークスペース）にあります。`publish` ツールがそれを `docs/` に変換します。

### VS Code 拡張機能

```bash
cd vs-code-extension
npm install
npm run build    # 拡張機能をビルド
npm run watch    # ウォッチモード（変更時に再ビルド）
npm test         # ユニットテストを実行
npm run lint     # 型チェック
```

### AS Notes から HTML への公開（HTML 変換）

コンバーターは npm パッケージとして公開されています：

```bash
npx asnotes-publish --config ./asnotes-publish.json
```

完全なドキュメントについては [静的サイトの公開](https://docs.asnotes.io/publishing-a-static-site.html) を参照してください。

### デバッグ

VS Code で **F5** を押して、拡張機能がロードされた拡張機能開発ホストを起動します。

デバッグバージョンは Marketplace インストールより優先されるため、両方が共存できます。

VS Code は拡張機能開発ホストで最後に開いたフォルダを記憶します。[デモナレッジベース](https://github.com/appsoftwareltd/as-notes-demo-notes) は一般的な使用シナリオをカバーするように設計されています。

### テスト

ユニットテストは [vitest](https://vitest.dev/) を使用し、Wiki リンクパーサー、オフセットベースのルックアップ、セグメント計算、インデックスサービス CRUD、タイトル抽出、名前変更検出データフロー、ネストリンクのインデックスをカバーします。`npm test` で実行します。

### パブリッシング

リリースは VS Code Marketplace に手動で公開され、その後バージョンタグがプッシュされると GitHub Release が自動的に作成されます。

**ステップ 1 - バージョンの更新**

`package.json` の `version` を更新し、`CHANGELOG.md` にエントリを追加します。

**ステップ 2 - VS Code Marketplace に公開**

```bash
cd .\vs-code-extension\
npm run build
npx @vscode/vsce package
npx @vscode/vsce login appsoftwareltd   # 認証が期限切れの場合は PAT トークンを入力
npx @vscode/vsce publish
```

**ステップ 3 - タグ付けとプッシュ**

```bash
cd ..
git add .
git commit -m "Release v2.3.2"   # バージョンを変更
git tag v2.3.2                   # バージョンを変更
git push origin main --tags
```

タグのプッシュにより [Release ワークフロー](.github/workflows/release.yml) がトリガーされ、自動生成されたリリースノートと VS Code Marketplace インストールリンク付きの GitHub Release が自動的に作成されます。

### npm CLI（`asnotes-publish`）の公開

**ステップ 1 - バージョンの更新**

`publish/package.json` の `version` を更新します。

**ステップ 2 - ビルドと公開**

```bash
cd publish
npm run build
npm login
npm publish
```

**ステップ 3 - 検証**

```bash
npx asnotes-publish --help
```

## Agent Skills

AS Notes 用の [agent skill](https://skills.sh/) が利用可能です。インストールすると、AI アシスタント（GitHub Copilot、Claude など）に拡張機能の完全な知識 - Wiki リンク構文、コマンド、設定、キーボードショートカットなどを提供できます。

```bash
npx skills add appsoftwareltd/as-notes/skills/as-notes-agent-use
```

インストール後、AI アシスタントは AS Notes に関する質問に答え、設定の構成を支援し、機能を説明し、ノートワークフローをサポートできます。

## 免責事項

本ソフトウェアは「現状有姿」で提供され、明示的または暗黙的を問わず、いかなる種類の保証もありません。著者および貢献者は、本拡張機能の使用または誤用に起因するデータ、ファイル、またはシステムの損失、破損、損害について一切の責任を負いません。これには、ワークスペース内でファイルを作成、名前変更、移動、または変更する操作を含みますが、これに限定されません。

**データのバックアップを維持する責任はお客様にあります。** この拡張機能で管理するノートやファイルには、バージョン管理（例：Git）やその他のバックアップ戦略の使用を強く推奨します。

本拡張機能は [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License (CC BY-NC-SA 4.0)](LICENSE) に基づいてライセンスされています。

**非商用目的**での使用、共有、改変は、帰属表示付きで自由に行えます。商用利用には別途商用ライセンスが必要です。完全な条件については [LICENSE](LICENSE) を参照するか、<https://www.appsoftware.com/contact> までお問い合わせください。
