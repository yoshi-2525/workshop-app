"""API のエラー応答。よく使う状態コードの HTTPException をここで作る(raise は呼び出し側)"""

from fastapi import HTTPException, status

WORKSHOP_NOT_FOUND = "ワークショップが見つかりません"
RESERVATION_NOT_FOUND = "予約が見つかりません"
FACILITATOR_NOT_FOUND = "主催者が見つかりません"
PERMISSION_DENIED = "この操作を行う権限がありません"


def not_found(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def forbidden(detail: str = PERMISSION_DENIED) -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def conflict(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)
