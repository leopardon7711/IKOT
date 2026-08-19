# IKOT 最終形 Webアプリ v1

## 目標
「いつか行きたいを、みんなで。」を、家族共有のおでかけブックマークとして実用化する。

### 実装済み
- Android / iPhone PWA
- 家族共有（招待コード）
- リアルタイム更新の土台
- 状態: 行きたい / 候補 / 行く予定 / 行った
- カテゴリ
- 家族投票
- Googleマップ
- 元URL
- 写真URL / 動画URL
- 予算 / 年齢 / 所要時間 / メモ
- OS共有からIKOTへ受け取るShare Target
- AI整理用Supabase Edge Function

### SNS共有について
PWAのWeb Share Targetで、OSが共有ダイアログから渡すtitle/text/url（対応環境では画像・動画ファイル）を受け取る設計。
ただし、Instagram/TikTok/YouTube/Xが毎回同じ情報を外部アプリへ渡す保証はない。SNS内部の投稿画像・動画を無断でスクレイピングして保存する設計にはしていない。
共有されたURLをサーバー側で解析する場合は、各サービスのAPI・利用規約に従う。

## セットアップ
1. Supabaseプロジェクトを作成
2. 前バージョンの `supabase_setup.sql` を実行（このZIPには互換版を含める）
3. Authentication > Providers > Anonymous Sign-InsをON
4. Database > Replicationで `ikot_places` のRealtimeをON
5. `supabase_functions/ikot-ai/index.ts` をEdge Functionとしてデプロイ
6. Edge Functionに `OPENAI_API_KEY` をSecretとして設定（ブラウザには絶対に置かない）
7. index.html等をHTTPSの静的ホスティングへ公開
8. IKOTをAndroid/iPhoneにインストール
9. 「家族」から家族を作成→招待コードを奥さんへ送る

## AI
AI機能は「URL/タイトル/本文→構造化JSON」を担当。SNSの非公開データ取得やログイン突破はしない。
画像・動画ファイルを本当にIKOTへ保存する場合は、Supabase Storageを追加し、共有POSTのfilesをStorageへアップロードする拡張が必要。

## 本番運用で追加推奨
- 匿名ユーザーからGoogle/Apple/メールへのアカウント引継ぎ
- 画像/動画のStorage
- URLメタデータ取得のサーバー処理
- 削除・家族退会・バックアップ
- 利用規約・プライバシーポリシー
- レート制限 / ログ / エラー監視


## v2 共有受け取り修正
- Share TargetのPOST先 `/share` をService Workerで受信してトップページへリダイレクト。
- 共有された title / text / url をIKOTの追加画面へ自動入力。
- `/share` を直接開いた場合の404も回避。
- 更新後はPWA/Service Workerを一度更新してから共有をテストすること。
