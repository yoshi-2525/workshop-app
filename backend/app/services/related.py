"""ワークショップ詳細ページに出す「関連するワークショップ」を選ぶ。

- 同じ主催者: 同じ主催者の開催予定のもの
- 類似: タイトル・説明の文字の並びが似ているもの(文字 bigram の TF-IDF コサイン類似度)
- 近く: 会場の住所が近いもの(同じ会場 > 同じ市区町村 > 同じ都道府県)。
  オンライン開催には「近く」がないので、代わりに他のオンライン開催のもの(開催の近い順)

どれも公開中かつ開始前のものだけを対象にし、表示中のワークショップ自身は含めない。
また、同じワークショップが複数の欄に重複して出ないよう、上の欄で選んだものは下の欄から除く。
"""

import math
import re
from collections import Counter
from collections.abc import Iterable, Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.timeutil import utcnow_naive
from app.models.user import User
from app.models.workshop import LocationType, Workshop, WorkshopStatus
from app.schemas.workshop import RelatedWorkshops
from app.services.workshops import to_workshop_reads

# 各欄に出す件数の上限(詳細ページではスライドで表示する)
RELATED_LIMIT = 10
# 類似・近くの計算に使う候補の上限(開始日時の近い順)。全件を毎回読み込まないための安全弁
CANDIDATE_LIMIT = 500
# タイトルは説明より内容を端的に表すので、重みを大きくする
TITLE_WEIGHT = 3
# これより似ていないものは「類似」に出さない(0〜1)
MIN_SIMILARITY = 0.1

# 記号・空白で文字列を区切る(\W は日本語の文字を含まないので、漢字・かなは残る)
_SEPARATOR = re.compile(r"[\W_]+")
_WHITESPACE = re.compile(r"\s+")
_PREFECTURE = re.compile(r"^(北海道|東京都|(?:京都|大阪)府|.{2,3}県)")
# 都道府県の後ろの、最初の「市・区・町・村」まで(横浜市中区 → 横浜市、渋谷区神宮前 → 渋谷区)
_MUNICIPALITY = re.compile(r"^(.{1,6}?[市区町村])")


def _upcoming_published(exclude_id: int):
    return (
        select(Workshop)
        .options(selectinload(Workshop.facilitator))
        .where(
            Workshop.status == WorkshopStatus.published,
            Workshop.start_at > utcnow_naive(),
            Workshop.id != exclude_id,
        )
        .order_by(Workshop.start_at.asc(), Workshop.id.asc())
    )


# --- 類似 ---


def _bigrams(text: str) -> Counter[str]:
    grams: Counter[str] = Counter()
    for chunk in _SEPARATOR.split(text.lower()):
        if len(chunk) == 1:
            grams[chunk] += 1
        grams.update(chunk[i : i + 2] for i in range(len(chunk) - 1))
    return grams


def _term_counts(workshop: Workshop) -> Counter[str]:
    counts = _bigrams(workshop.description)
    for gram, n in _bigrams(workshop.title).items():
        counts[gram] += n * TITLE_WEIGHT
    return counts


def _tfidf(counts: Counter[str], idf: dict[str, float]) -> dict[str, float]:
    return {gram: n * idf[gram] for gram, n in counts.items()}


def _cosine(a: dict[str, float], b: dict[str, float]) -> float:
    if len(a) > len(b):
        a, b = b, a
    dot = sum(weight * b.get(gram, 0.0) for gram, weight in a.items())
    norm = math.sqrt(sum(w * w for w in a.values())) * math.sqrt(sum(w * w for w in b.values()))
    return dot / norm if norm else 0.0


def _similar(source: Workshop, candidates: Sequence[Workshop]) -> list[Workshop]:
    if not candidates:
        return []
    counts = {w.id: _term_counts(w) for w in [source, *candidates]}
    # どのワークショップにも出てくる語(「ワークショップ」「対話」など)ほど重みを小さくする
    document_frequency: Counter[str] = Counter()
    for c in counts.values():
        document_frequency.update(c.keys())
    total = len(counts)
    idf = {gram: math.log((total + 1) / (df + 1)) + 1 for gram, df in document_frequency.items()}

    source_vector = _tfidf(counts[source.id], idf)
    scored = [(_cosine(source_vector, _tfidf(counts[w.id], idf)), w) for w in candidates]
    scored = [(score, w) for score, w in scored if score >= MIN_SIMILARITY]
    # 似ている順。同じくらいなら開催の近い順(候補は開始日時順に並んでいる)
    scored.sort(key=lambda item: item[0], reverse=True)
    return [w for _, w in scored[:RELATED_LIMIT]]


# --- 近く ---


def _normalize_location(location: str) -> str:
    return _WHITESPACE.sub("", location)


def _area(location: str) -> tuple[str | None, str | None]:
    """住所の先頭から(都道府県, 市区町村)を取り出す。読み取れない部分は None"""
    text = _normalize_location(location)
    prefecture_match = _PREFECTURE.match(text)
    if prefecture_match is None:
        return None, None
    rest = text[prefecture_match.end() :]
    municipality_match = _MUNICIPALITY.match(rest)
    return prefecture_match.group(1), municipality_match.group(1) if municipality_match else None


def _nearness(source: Workshop, candidate: Workshop) -> int:
    """近さの段階。3: 同じ会場 / 2: 同じ市区町村 / 1: 同じ都道府県 / 0: 近くない(住所が読み取れない場合も含む)"""
    if _normalize_location(source.location) == _normalize_location(candidate.location):
        return 3
    source_prefecture, source_municipality = _area(source.location)
    prefecture, municipality = _area(candidate.location)
    if source_prefecture is None or source_prefecture != prefecture:
        return 0
    if source_municipality is not None and source_municipality == municipality:
        return 2
    return 1


def _nearby(source: Workshop, candidates: Sequence[Workshop]) -> list[Workshop]:
    # オンライン開催には「近く」がないので、他のオンライン開催のものを開催の近い順に出す
    if source.location_type == LocationType.online:
        return [w for w in candidates if w.location_type == LocationType.online][:RELATED_LIMIT]
    scored = [
        (_nearness(source, w), w) for w in candidates if w.location_type == LocationType.offline
    ]
    scored = [(score, w) for score, w in scored if score > 0]
    # 近い順。同じ段階なら開催の近い順(候補は開始日時順に並んでいる)
    scored.sort(key=lambda item: item[0], reverse=True)
    return [w for _, w in scored[:RELATED_LIMIT]]


# --- まとめ ---


def _exclude(workshops: Iterable[Workshop], used_ids: set[int]) -> list[Workshop]:
    return [w for w in workshops if w.id not in used_ids]


def related_workshops(db: Session, workshop: Workshop, current_user: User | None) -> RelatedWorkshops:
    same_facilitator = db.scalars(
        _upcoming_published(workshop.id)
        .where(Workshop.facilitator_id == workshop.facilitator_id)
        .limit(RELATED_LIMIT)
    ).all()
    used_ids = {w.id for w in same_facilitator}

    candidates = db.scalars(_upcoming_published(workshop.id).limit(CANDIDATE_LIMIT)).all()
    similar = _similar(workshop, _exclude(candidates, used_ids))
    used_ids |= {w.id for w in similar}
    nearby = _nearby(workshop, _exclude(candidates, used_ids))

    # 予約数などの集計はまとめて1回で行う
    reads = {r.id: r for r in to_workshop_reads(db, [*same_facilitator, *similar, *nearby], current_user)}
    return RelatedWorkshops(
        same_facilitator=[reads[w.id] for w in same_facilitator],
        similar=[reads[w.id] for w in similar],
        nearby=[reads[w.id] for w in nearby],
    )
