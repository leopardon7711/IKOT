# IKOT v6 — SNS共有→AI自動入力版

## できること

- Instagram / TikTok / YouTube / X / Web の共有先に IKOT を表示
- SNSからIKOTへ共有すると、URLを自動で追加画面へ取り込む
- Supabase Edge Function `ikot-ai` を呼び、Web検索も使って施設情報を整理
- 施設名 / カテゴリ / 場所 / 予算 / おすすめ年齢 / 所要時間 / メモ / 画像URL / 動画URLを可能な範囲で自動入力
- AIが特定できない投稿でもURLはそのまま手動保存可能
- 家族共有、状態変更、編集、削除、投票トグル、Realtime更新

## ファイル

- `index.html` : Webアプリ本体
- `manifest.webmanifest` : PWA / Android共有ターゲット
- `sw.js` : Service Worker
- `icon.svg` : アイコン
- `supabase_setup.sql` : DB/RLS/RPC。v6では `video_url` 列も追加
- `index.ts` : Supabase Edge Function `ikot-ai` 用コード

## v5からv6へ更新する場合

1. GitHubへこのフォルダのファイルを上書きアップロードする。
2. Supabase SQL Editorで `supabase_setup.sql` を実行する。既存データは削除しない設計。
3. Supabase Edge Functionsで `ikot-ai` を作成し、`index.ts` の内容を配置する。
4. Edge FunctionのSecretに `OPENAI_API_KEY` を登録する。
5. 任意で `OPENAI_MODEL` を登録する。未設定時は `gpt-5.6-luna`。
6. `ikot-ai` をDeployする。
7. PWAの更新が残る場合はIKOTを一度終了して再起動する。共有ターゲット設定を更新した場合は再インストールする。

## AI処理

フロントエンドはAIキーを保持しない。IKOTはログイン中のSupabaseクライアントから `sb.functions.invoke("ikot-ai")` を呼ぶ。OpenAI APIキーはSupabase Edge FunctionのSecretだけに保存する。

共有直後はAI整理を自動実行する。手動追加画面でも「✨ URLからAI自動入力」を押せる。

Web検索を使っても、非公開投稿・検索に出ない投稿・情報の少ない投稿では施設を特定できないことがある。その場合は勝手に施設名を作らず、URLだけ保存できる。
