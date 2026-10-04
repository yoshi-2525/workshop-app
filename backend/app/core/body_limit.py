from fastapi import HTTPException, status
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class BodySizeLimitMiddleware:
    """リクエスト本文の大きさを制限する。

    FastAPI はフォームの本文をすべて受け取ってから依存関係を評価するので、ルートの依存関係では
    大きすぎる送信を受け取る前に断れない。ここで Content-Length を確かめ、Content-Length のない
    (chunked の)送信も受け取った量を数えて、上限を超えた時点で 413 にする。
    """

    def __init__(self, app: ASGIApp, max_body_bytes: int, detail: str) -> None:
        self.app = app
        self.max_body_bytes = max_body_bytes
        self.detail = detail

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        content_length = dict(scope["headers"]).get(b"content-length")
        if content_length is not None and content_length.isdigit() and int(content_length) > self.max_body_bytes:
            response = JSONResponse({"detail": self.detail}, status_code=status.HTTP_413_CONTENT_TOO_LARGE)
            await response(scope, receive, send)
            return

        received = 0

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_body_bytes:
                    # FastAPI は本文の読み取り中の HTTPException をそのまま返す(他の例外は 400 になる)
                    raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail=self.detail)
            return message

        await self.app(scope, limited_receive, send)
