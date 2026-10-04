from datetime import datetime, timedelta, timezone


def utcnow_naive() -> datetime:
    """DB と同じ「タイムゾーンなしの UTC」で現在時刻を返す"""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def hours_label(duration: timedelta) -> str:
    """「24時間」のように、時間単位でメッセージに出す表記"""
    return f"{int(duration.total_seconds() // 3600)}時間"
