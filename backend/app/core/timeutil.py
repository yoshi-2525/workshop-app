from datetime import datetime, timezone


def utcnow_naive() -> datetime:
    """DB と同じ「タイムゾーンなしの UTC」で現在時刻を返す"""
    return datetime.now(timezone.utc).replace(tzinfo=None)
