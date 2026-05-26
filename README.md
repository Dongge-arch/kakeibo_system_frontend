# Home Kakeibo フロントエンド

このフォルダは、家計簿アプリのフロントエンドだけを独立して実行・ビルド・配布するためのフォルダです。React の画面、ローカル起動用 Python ランナー、Windows exe 化用の設定を含みます。バックエンド処理は Lambda 側 API を呼び出します。

## 役割

- React で作られた家計簿 UI を表示します。
- `frontend-config.json` または `frontend-react/public/config.js` から API 接続先を読み込みます。
- Windows では `run_frontend.py` を使ってローカルサーバーを起動できます。
- `build_frontend_exe.bat` で exe 配布用ファイルを作成できます。
- CloudFront に載せる場合は、`frontend-react/dist` の静的ファイルを S3 にアップロードします。exe は S3/CloudFront にはアップロードしません。

## フォルダ構成

```text
home_kakeibo_frontend_exe/
  frontend-react/              React アプリ本体
    src/                       画面、API クライアント、型定義、CSS
    public/config.js           CloudFront 用の公開時設定
  run_frontend.py              ローカル実行用ランナー
  run_frontend_dev.bat         開発起動
  build_frontend_exe.bat       exe 作成
  frontend-config.example.json ローカル設定例
  frontend-config.json         ローカル設定ファイル、Git 管理対象外
```

## 必要な設定

`frontend-config.example.json` を参考にして `frontend-config.json` を作成します。

```json
{
  "apiBaseUrl": "https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/Prod",
  "apiKey": "必要な場合だけ設定",
  "port": 5173
}
```

CloudFront/S3 で公開する場合は、`frontend-react/public/config.js` に公開環境用の API URL を入れます。このファイルには API key などの秘密情報を入れない運用を推奨します。どうしても必要な場合は CloudFront Functions、WAF、API Gateway 側の認証と組み合わせてください。

## 開発起動

```powershell
cd C:\Users\董 昊哲\Desktop\home_kakeibo_frontend_exe
.\run_frontend_dev.bat
```

起動後、表示された URL をブラウザで開きます。前回のログイン情報はブラウザの保存領域に保持されるため、同じ端末では再ログインを減らせます。

## exe の作成

```powershell
cd C:\Users\董 昊哲\Desktop\home_kakeibo_frontend_exe
.\build_frontend_exe.bat
```

成果物は `dist` または `build` 配下に作成されます。配布前に `frontend-config.json` が正しい API URL を指していることを確認してください。

## CloudFront/S3 への公開

1. `frontend-react` で本番ビルドを作成します。
2. `frontend-react/dist` の中身だけを S3 バケットにアップロードします。
3. CloudFront の Default root object は `index.html` にします。
4. S3 バケットはパブリック公開せず、CloudFront OAC だけを許可します。
5. 更新後は CloudFront のキャッシュ削除で `/*` を無効化します。

```powershell
cd C:\Users\董 昊哲\Desktop\home_kakeibo_frontend_exe\frontend-react
npm install
npm run build
```

S3 には `index.html`、`config.js`、`assets/` が入っていれば基本的に動きます。

## レスポンシブレイアウト

アプリは起動時と画面サイズ変更時に端末を判定します。

- スマートフォンまたはタッチ端末: モバイル用の縦並びレイアウト
- PC 横画面: 12 カラムの横長ダッシュボード
- 画面回転・リサイズ時: 自動で再判定

判定結果は `html` 要素の `data-device` と `data-orientation` に反映されます。

## 入力画面の注意

レシート明細の数量・単価・割引・金額欄は、入力前に不要な `0` を表示しないようにしています。これにより、`2` を入力したつもりが `20` になる問題を避けます。

## ダッシュボード小组件

カレンダー小组件を追加できます。カレンダーは日ごとの入金・支出を表示しますが、初期レイアウトには入れていません。ダッシュボードの「ウィジェット」から必要な人だけ追加できます。

## 秘密情報

次のようなファイルは Git に入れないでください。

- `frontend-config.json`
- `.env`、`.env.*`
- API key、認証情報、秘密鍵、証明書を含む JSON/KEY/PEM/PFX/P12
- AWS 認証情報ファイル

`.gitignore` に登録済みですが、コミット前に `git status` で必ず確認してください。

## よくある問題

### 画面が真っ白になる

- `frontend-react/public/config.js` または `frontend-config.json` の API URL を確認してください。
- CloudFront にアップロードした `assets/` が不足していないか確認してください。
- CloudFront の Default root object が `index.html` になっているか確認してください。

### fetch failed が出る

- API Gateway の URL が正しいか確認してください。
- Lambda がデプロイ済みか確認してください。
- CORS で CloudFront ドメインが許可されているか確認してください。
- API key を使っている場合、フロントエンド設定と API Gateway の設定が一致しているか確認してください。

### 更新しても画面が変わらない

CloudFront のキャッシュ削除で `/*` を指定して無効化してください。
