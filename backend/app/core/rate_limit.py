import threading
import time
from collections import defaultdict, deque


class FailureLimiter:
    """一定時間内の失敗回数をキーごとに数え、上限に達したキーを拒否する。

    状態はプロセスのメモリに持つ。ワーカーを複数起動する場合や再起動をまたいで
    数えたい場合は、Redis など共有のストアに置き換えること。
    """

    def __init__(self, max_failures: int, window_seconds: int) -> None:
        self._max_failures = max_failures
        self._window_seconds = window_seconds
        self._failures: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()
        self._last_sweep = time.monotonic()

    def _prune(self, key: str, now: float) -> deque[float]:
        failures = self._failures[key]
        while failures and failures[0] <= now - self._window_seconds:
            failures.popleft()
        if not failures:
            del self._failures[key]
            return deque()
        return failures

    def retry_after(self, *keys: str) -> int | None:
        """いずれかのキーが上限に達していれば、再試行できるまでの秒数を返す"""
        now = time.monotonic()
        waits: list[float] = []
        with self._lock:
            for key in keys:
                failures = self._prune(key, now)
                if len(failures) >= self._max_failures:
                    waits.append(failures[0] + self._window_seconds - now)
        if not waits:
            return None
        return max(1, int(max(waits)) + 1)

    def _sweep(self, now: float) -> None:
        """期限切れの記録をすべて消す。二度と確かめられないキー(使い捨てのメールアドレスなど)が溜まり続けないように"""
        if now - self._last_sweep < self._window_seconds:
            return
        self._last_sweep = now
        for key in list(self._failures):
            self._prune(key, now)

    def record_failure(self, *keys: str) -> None:
        now = time.monotonic()
        with self._lock:
            self._sweep(now)
            for key in keys:
                self._failures[key].append(now)

    def reset(self, *keys: str) -> None:
        with self._lock:
            for key in keys:
                self._failures.pop(key, None)
