"""API のエラー応答。よく使う状態コードの HTTPException をここで作る(raise は呼び出し側)"""

from fastapi import HTTPException, status

WORKSHOP_NOT_FOUND = "ワークショップが見つかりません"
RESERVATION_NOT_FOUND = "予約が見つかりません"
FACILITATOR_NOT_FOUND = "主催者が見つかりません"
PERMISSION_DENIED = "この操作を行う権限がありません"
ONLINE_PAYMENT_DISABLED = "現在、オンライン決済はご利用いただけません"
PAYMENT_SERVICE_UNAVAILABLE = "決済サービスに接続できませんでした。時間をおいてもう一度お試しください"


def bad_request(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def not_found(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def forbidden(detail: str = PERMISSION_DENIED) -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def conflict(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


def service_unavailable(detail: str = PAYMENT_SERVICE_UNAVAILABLE) -> HTTPException:
    """外部サービス(Stripe)の呼び出しに失敗した。入力ではなく相手側の問題なので 503 にする"""
    return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)
