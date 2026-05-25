# Home Kakeibo Frontend EXE

このフォルダーはデスクトップ EXE 用のフロントエンド専用コードです。バックエンドコードや SQLite DB は含めません。

## API 設定

`run_frontend.py` と `HomeKakeiboFrontend.exe` は、同じフォルダーにある `frontend-config.json` を読み込みます。

```json
{
  "apiBaseUrl": "https://your-api-id.execute-api.ap-northeast-1.amazonaws.com",
  "apiKey": "same-value-as-KAKEIBO_API_KEY",
  "port": 32178
}
```

- `apiBaseUrl`: CloudFormation output の `ApiUrl`
- `apiKey`: バックエンド側の `KAKEIBO_API_KEY` と同じ値
- `port`: EXE がローカル画面を開くポート

## 起動

```bat
run_frontend_dev.bat
```

## EXE ビルド

```bat
build_frontend_exe.bat
```

出力先:

```text
dist\HomeKakeiboFrontend.exe
```

EXE を別フォルダーへ移動して使う場合は、`frontend-config.json` も EXE と同じフォルダーに置いてください。

## S3 / CloudFront

EXE 利用時は S3 / CloudFront は不要です。EXE がローカルで画面を配信し、Lambda API を直接呼びます。

Web 版として公開する場合だけ、`frontend-react/dist` の中身を S3 に置き、CloudFront で配信します。
