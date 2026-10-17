"""動作確認用の主催者・参加者・ワークショップ・予約を投入する。

Usage: ./venv/Scripts/python scripts/seed_sample_data.py
"""

import shutil
import struct
import sys
import zlib
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.config import settings  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models.reservation import Reservation, ReservationStatus  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.models.workshop import LocationType, Workshop, WorkshopStatus  # noqa: E402
from app.services.notifications import send_participant_guide  # noqa: E402

PASSWORD = "password123"

# 主催者(メール、名前、自己紹介)。seed_bulk_workshops.py でも同じ主催者を使う
SAMPLE_FACILITATORS = {
    "shiraishi": (
        "shiraishi@example.com",
        "白石 透",
        "哲学対話歴10年。誰もが安心して話せる場づくりを大切にしています。普段は編集者として働いています。",
    ),
    "hayase": (
        "hayase@example.com",
        "早瀬 楓",
        "大学で哲学を専攻。卒業後は「日常に開かれた哲学」をテーマに対話イベントを主催しています。",
    ),
    "takahashi": (
        "takahashi@example.com",
        "高橋 誠",
        "IT企業で働きながら、仕事帰りに立ち寄れる対話の場を開いています。働き方やお金の話が得意です。",
    ),
    "nakamura": (
        "nakamura@example.com",
        "中村 さくら",
        "書店員。本や映画をきっかけに、人生や幸せについてゆっくり語り合う会を続けています。",
    ),
    "ogawa": (
        "ogawa@example.com",
        "小川 直樹",
        "カウンセラー。言葉にならない気持ちを、無理に結論づけずに一緒に見つめる場づくりをしています。",
    ),
}

# 主催者ごとの当日の緊急連絡先(架空の番号)
SAMPLE_EMERGENCY_CONTACTS = {
    "shiraishi": "090-0000-0001(白石)",
    "hayase": "090-0000-0002(早瀬)",
    "takahashi": "090-0000-0003(高橋)",
    "nakamura": "090-0000-0004(中村)",
    "ogawa": "090-0000-0005(小川)",
}

# 会場ごとの当日の案内。オンラインは配信に使うツール名(location)で引く
SAMPLE_VENUE_GUIDES = {
    "東京都渋谷区神宮前4丁目 表参道カフェスペース": (
        "表参道駅 A2 出口から徒歩3分です。1階のカフェの奥にある階段から2階へお上がりください。\n"
        "開始の15分前から受付をしています。ワンドリンク制で、飲み物は当日カフェでご注文いただけます。"
    ),
    "東京都渋谷区渋谷2丁目 渋谷コミュニティスペース": (
        "渋谷駅 B1 出口から徒歩5分です。ビルの3階、エレベーターを降りて右手のお部屋が会場です。\n"
        "開始の10分前から入室できます。筆記用具はこちらで用意しています。"
    ),
    "東京都千代田区神田神保町1丁目 神保町ブックカフェ": (
        "神保町駅 A7 出口から徒歩2分です。店内奥の貸切スペースで行います。入口で主催者の名前をお伝えください。\n"
        "店内の本は自由に手に取っていただけます。"
    ),
    "東京都新宿区西新宿1丁目 西新宿レンタルスペース": (
        "新宿駅 西口から徒歩7分です。ビルの5階、502号室が会場です。\n"
        "ビルの入口はオートロックです。1階のインターホンで「502」を呼び出してください。"
    ),
    "東京都渋谷区円山町 ミニシアター併設ラウンジ": (
        "渋谷駅 道玄坂口から徒歩8分です。ミニシアターの受付で対話会の参加者とお伝えいただくと、ラウンジへご案内します。\n"
        "上映作品の鑑賞は含まれていません。"
    ),
    "東京都渋谷区道玄坂2丁目 BAR しずく": (
        "渋谷駅 道玄坂口から徒歩4分です。地下1階の木の扉が入口です。\n"
        "当日は貸切のため、扉の前の札は「CLOSED」になっていますが、そのままお入りください。参加費にワンドリンクが含まれています。"
    ),
    "東京都中央区日本橋2丁目 日本橋ワークラウンジ": (
        "日本橋駅 B6 出口から徒歩1分です。1階の受付で名前をお伝えのうえ、6階のラウンジへお上がりください。\n"
        "館内は飲み物の持ち込みができます。"
    ),
    "Zoom": (
        "参加用の Zoom の URL は、開催の前日までにこのメッセージでお送りします。\n"
        "開始の5分前から入室できます。お名前は予約したときと同じ表示名にしてください。カメラのオンオフは自由です。"
    ),
    "Google Meet": (
        "参加用の Google Meet の URL は、開催の前日までにこのメッセージでお送りします。\n"
        "開始の5分前から入室できます。カメラのオンオフは自由です。"
    ),
}

# 開催日時は実行した日(日本時間)を基準にする。いつ投入しても、これからの場と終わった場がそろう
JST = timezone(timedelta(hours=9))

# サンプルのワークショップ用のバナー画像(1600×900)。ファイル名は sample_workshops の key に合わせる
SAMPLE_IMAGE_DIR = Path(__file__).resolve().parent / "sample_images"
SAMPLE_IMAGE_URL_PREFIX = "/api/uploads/workshops/sample-"

# 用意した画像がないとき(seed_bulk_workshops.py など)に使う単色の画像
SAMPLE_IMAGE_COLORS = [
    (217, 119, 6),  # amber
    (13, 148, 136),  # teal
    (190, 24, 93),  # pink
    (71, 85, 105),  # slate
    (161, 98, 7),  # yellow-brown
    (30, 64, 175),  # blue
    (185, 28, 28),  # red
    (4, 120, 87),  # emerald
]


def _png_chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))


def _make_placeholder_png(width: int, height: int, rgb: tuple[int, int, int]) -> bytes:
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    row = bytes([0]) + bytes(rgb) * width
    raw = row * height
    idat = zlib.compress(raw, 9)
    return (
        b"\x89PNG\r\n\x1a\n"
        + _png_chunk(b"IHDR", ihdr)
        + _png_chunk(b"IDAT", idat)
        + _png_chunk(b"IEND", b"")
    )


def _workshop_image_dir() -> Path:
    path = settings.upload_path / "workshops"
    path.mkdir(parents=True, exist_ok=True)
    return path


def ensure_sample_image(workshop: Workshop, color_index: int, key: str | None = None) -> None:
    """ワークショップにサンプルのバナー画像を設定する

    key に対応する画像が SAMPLE_IMAGE_DIR にあればそれを使い、なければ単色の画像を生成する。
    主催者がアップロードした画像は上書きしない。前にこのスクリプトが設定した画像(sample-*)は、
    用意した画像に置き換える。古いサンプルデータのまま再投入しても新しい画像になるようにするため。
    """
    if workshop.image_url and not workshop.image_url.startswith(SAMPLE_IMAGE_URL_PREFIX):
        return
    source = SAMPLE_IMAGE_DIR / f"{key}.png" if key else None
    if source is not None and source.exists():
        filename = f"sample-{workshop.id}-{key}.png"
        path = _workshop_image_dir() / filename
        if not path.exists():
            shutil.copyfile(source, path)
    else:
        if workshop.image_url:
            return
        filename = f"sample-{workshop.id}.png"
        path = _workshop_image_dir() / filename
        if not path.exists():
            color = SAMPLE_IMAGE_COLORS[color_index % len(SAMPLE_IMAGE_COLORS)]
            path.write_bytes(_make_placeholder_png(800, 450, color))
    workshop.image_url = f"/api/uploads/workshops/{filename}"


def dt(days: int, hour: int, minute: int = 0) -> datetime:
    """実行した日(JST)の days 日後の hour:minute(JST)を、DB に保存する naive な UTC で返す"""
    today = datetime.now(JST).replace(hour=0, minute=0, second=0, microsecond=0)
    local = today + timedelta(days=days, hours=hour, minutes=minute)
    return local.astimezone(timezone.utc).replace(tzinfo=None)


def get_or_create_user(db, email: str, name: str, role: UserRole, bio: str = "") -> User:
    user = db.query(User).filter(User.email == email).first()
    if user is not None:
        return user
    user = User(email=email, name=name, hashed_password=hash_password(PASSWORD), role=role, bio=bio)
    db.add(user)
    db.flush()
    return user


def get_or_create_workshop(db, **kwargs) -> Workshop:
    existing = db.query(Workshop).filter(Workshop.title == kwargs["title"]).first()
    if existing is not None:
        return existing
    workshop = Workshop(**kwargs)
    db.add(workshop)
    db.flush()
    return workshop


def ensure_participant_guide(workshop: Workshop, facilitator_key: str) -> bool:
    """当日の案内・緊急連絡先がどちらも空なら、サンプルの内容を入れる。入れたら True

    主催者が書いた内容は上書きしない。案内のなかった頃のサンプルデータに再投入したときにも入るようにするため、
    作成時だけでなく既存のワークショップにも入れる
    """
    if workshop.participant_guide or workshop.emergency_contact:
        return False
    workshop.participant_guide = SAMPLE_VENUE_GUIDES.get(workshop.location, "")
    workshop.emergency_contact = SAMPLE_EMERGENCY_CONTACTS[facilitator_key]
    return True


def get_or_create_reservation(db, workshop_id: int, user_id: int, status: ReservationStatus) -> bool:
    """予約を作る。作ったら True(既にあれば何もしない)"""
    existing = (
        db.query(Reservation)
        .filter(Reservation.workshop_id == workshop_id, Reservation.user_id == user_id)
        .first()
    )
    if existing is not None:
        return False
    db.add(Reservation(workshop_id=workshop_id, user_id=user_id, status=status))
    return True


def main() -> None:
    db = SessionLocal()
    try:
        admin = get_or_create_user(db, "admin@example.com", "運営 花子", UserRole.admin)

        facilitators = {
            key: get_or_create_user(db, email, name, UserRole.facilitator, bio=bio)
            for key, (email, name, bio) in SAMPLE_FACILITATORS.items()
        }
        shiraishi, hayase, takahashi, nakamura, ogawa = (
            facilitators[key] for key in ("shiraishi", "hayase", "takahashi", "nakamura", "ogawa")
        )
        facilitator_keys = {user.id: key for key, user in facilitators.items()}

        sato = get_or_create_user(db, "sato@example.com", "佐藤 次郎", UserRole.participant)
        tanaka = get_or_create_user(db, "tanaka@example.com", "田中 三郎", UserRole.participant)
        ito = get_or_create_user(db, "ito@example.com", "伊藤 陽子", UserRole.participant)
        watanabe = get_or_create_user(db, "watanabe@example.com", "渡辺 健", UserRole.participant)
        kobayashi = get_or_create_user(db, "kobayashi@example.com", "小林 美咲", UserRole.participant)

        db.flush()

        # 動作確認用のワークショップ。主催者5人で分け、一覧で各状態(満員・残席僅か・無料・下書き・中止・終了済み)が見られるようにする
        omotesando = "東京都渋谷区神宮前4丁目 表参道カフェスペース"
        shibuya = "東京都渋谷区渋谷2丁目 渋谷コミュニティスペース"
        jimbocho = "東京都千代田区神田神保町1丁目 神保町ブックカフェ"
        sample_workshops = [
            dict(
                key="adult_relations",
                title="夜のカフェで、大人の付き合いについて考える対話会",
                description=(
                    "社会人になると、職場の飲み会や仕事上の付き合いなど、人と関わる機会が増えていきます。"
                    "でも、その場を楽しく過ごすことと、本当に人とつながることは同じなのでしょうか。"
                    "この対話会では、普段の人付き合いで感じる違和感を持ち寄りながら、大人の付き合いのあり方について一緒に考えてみます。"
                ),
                facilitator=shiraishi,
                location_type=LocationType.offline,
                location=omotesando,
                day=5,
                start=(19, 30),
                end=(21, 30),
                capacity=10,
                price=1500,
            ),
            dict(
                key="ordinary_life",
                title="「普通に生きる」ということについて語り合いませんか？",
                description=(
                    "就職して働き、休日を楽しみ、安定した生活を送る。"
                    "私たちが当たり前だと思っている人生の形は、本当に誰にとっても望ましいものなのでしょうか。"
                    "この対話会では、社会に根づいた「普通」という価値観を見つめ直し、自分にとっての生き方について語り合います。"
                ),
                facilitator=hayase,
                location_type=LocationType.online,
                location="Zoom",
                day=8,
                start=(20, 0),
                end=(21, 30),
                capacity=12,
                price=0,
            ),
            dict(
                key="honest_dialogue",
                title="表面的な会話から一歩踏み込み、本音の対話を実践する場",
                description=(
                    "仕事の雑談や飲み会では、相手に合わせて会話を弾ませることが求められる場面があります。"
                    "一方で、会話が盛り上がることと、お互いを理解することは必ずしも同じではありません。"
                    "この場では、普段のコミュニケーションを振り返りながら、本音で話すことや、誰かの話を聴くことの意味について考えます。"
                ),
                facilitator=ogawa,
                location_type=LocationType.offline,
                location=shibuya,
                day=12,
                start=(19, 0),
                end=(21, 0),
                capacity=8,
                price=1000,
            ),
            dict(
                key="meaning_of_work",
                title="仕事帰りに、働くことの意味について対話しませんか？",
                description=(
                    "お金を稼ぐため、社会に貢献するため、自分の能力を発揮するため。"
                    "働く理由は人それぞれです。"
                    "しかし、生活の大部分を占める仕事に、私たちは何を求めているのでしょうか。"
                    "この対話会では、働くことの意味や、自分にとっての理想的な働き方について、それぞれの経験を交えながら語り合います。"
                ),
                facilitator=takahashi,
                location_type=LocationType.offline,
                location="東京都新宿区西新宿1丁目 西新宿レンタルスペース",
                day=3,
                start=(19, 30),
                end=(21, 0),
                capacity=6,
                price=1500,
            ),
            dict(
                key="being_yourself",
                title="「自分らしさ」と他者との関係について考える対話会",
                description=(
                    "自分らしく生きたいと思う一方で、私たちは周囲の人の考え方や期待から少なからず影響を受けています。"
                    "では、他人の影響を受けている自分は、本当の自分ではないのでしょうか。"
                    "この対話会では、自分らしさとは何か、他者との関わりが自分の価値観にどう影響するのかを掘り下げます。"
                ),
                facilitator=hayase,
                location_type=LocationType.online,
                location="Zoom",
                day=15,
                start=(20, 0),
                end=(21, 30),
                capacity=15,
                price=500,
            ),
            dict(
                key="loneliness",
                title="人とつながること、孤独であることについて語り合う夜",
                description=(
                    "友人や同僚に囲まれていても、自分の考えや気持ちを理解してもらえていないと感じることがあります。"
                    "反対に、一人で過ごしていても満たされた気持ちになることがあります。"
                    "この対話会では、孤独とは何か、人とつながるとはどういうことかについて、それぞれの経験を持ち寄りながら考えます。"
                ),
                facilitator=ogawa,
                location_type=LocationType.offline,
                location=omotesando,
                day=18,
                start=(19, 0),
                end=(21, 0),
                capacity=10,
                price=1500,
            ),
            dict(
                key="movie_justice",
                title="映画をきっかけに、「正しさ」について深く考える対話会",
                description=(
                    "映画の中では、登場人物それぞれに譲れない信念や事情があります。"
                    "ある人物にとっての正義が、別の人物を傷つけてしまうこともあります。"
                    "この対話会では、映画の物語や登場人物の選択を題材に、正しさの基準や異なる価値観を理解することの難しさについて語り合います。"
                ),
                facilitator=nakamura,
                location_type=LocationType.offline,
                location="東京都渋谷区円山町 ミニシアター併設ラウンジ",
                day=21,
                start=(19, 0),
                end=(21, 30),
                capacity=12,
                price=2000,
            ),
            dict(
                key="novel_happiness",
                title="小説から広がる「幸せな人生」についての対話会",
                description=(
                    "小説には、さまざまな境遇の人々や、異なる幸せの形が描かれています。"
                    "物語の登場人物が選んだ人生を、自分ならどう考えるでしょうか。"
                    "この対話会では、小説や文学作品をきっかけに、成功、自由、愛情、満足といった言葉の意味を掘り下げ、自分にとっての幸せについて語り合います。"
                ),
                facilitator=nakamura,
                location_type=LocationType.offline,
                location=jimbocho,
                day=25,
                start=(14, 0),
                end=(16, 0),
                capacity=10,
                price=1500,
            ),
            dict(
                key="efficiency",
                title="効率よく生きることと、人生の豊かさについて考える場",
                description=(
                    "仕事では、短い時間で成果を出すことや、無駄を省くことが重視されます。"
                    "しかし、寄り道や試行錯誤、目的のない時間から生まれる発見もあります。"
                    "この対話会では、効率化によって得られるものと失われるかもしれないものを見つめ直し、合理性だけでは測れない時間の価値について考えます。"
                ),
                facilitator=takahashi,
                location_type=LocationType.online,
                location="Zoom",
                day=10,
                start=(21, 0),
                end=(22, 0),
                capacity=20,
                price=0,
            ),
            dict(
                key="sns_comparison",
                title="SNS時代の幸せと他人との比較について語り合いませんか？",
                description=(
                    "SNSでは、他人の成功や楽しそうな日常を簡単に知ることができます。"
                    "一方で、誰かの人生と自分を比べ、自分の幸せがわからなくなることもあります。"
                    "私たちが幸せだと感じる基準は、どこから生まれるのでしょうか。"
                    "この対話会では、他人の評価や社会の価値観との関係から、自分なりの幸せについて考えます。"
                ),
                facilitator=hayase,
                location_type=LocationType.online,
                location="Google Meet",
                day=28,
                start=(20, 0),
                end=(21, 30),
                capacity=15,
                price=500,
            ),
            dict(
                key="drinking_party",
                title="静かなBARで「飲み会の楽しさ」について考える会",
                description=(
                    "お酒を飲みながら盛り上がること、普段話せない人と交流すること、仲間意識を深めること。"
                    "飲み会にはさまざまな楽しみ方があります。"
                    "しかし、誰もが同じように楽しめるわけではありません。"
                    "この対話会では、飲み会が好きな人も苦手な人も、それぞれの経験を持ち寄り、社交の場における楽しさや居心地のよさについて考えます。"
                ),
                facilitator=shiraishi,
                location_type=LocationType.offline,
                location="東京都渋谷区道玄坂2丁目 BAR しずく",
                day=6,
                start=(20, 0),
                end=(22, 0),
                capacity=4,
                price=2500,
            ),
            dict(
                key="money_happiness",
                title="お金と幸せの関係について、一緒に考えてみませんか？",
                description=(
                    "好きなものを買う、旅行に出かける、快適な暮らしを手に入れる。"
                    "お金は生活を豊かにする大切な手段です。"
                    "しかし、安心感や人とのつながり、日々の充実感もお金だけで得られるのでしょうか。"
                    "この対話会では、お金で得られる幸せとそうではない幸せについて、さまざまな価値観を交えながら考えます。"
                ),
                facilitator=takahashi,
                location_type=LocationType.offline,
                location="東京都中央区日本橋2丁目 日本橋ワークラウンジ",
                day=32,
                start=(19, 0),
                end=(21, 0),
                capacity=12,
                price=1000,
            ),
            dict(
                key="unspoken_feelings",
                title="言葉にならないモヤモヤを、仲間と一緒に掬い上げる対話会",
                description=(
                    "理由はわからないけれど、何となく落ち着かない。"
                    "誰かの言葉が心に引っかかっているのに、うまく説明できない。"
                    "そんな感情は、日常の中で誰にでも生まれるものです。"
                    "この対話会では、言葉にならない気持ちを無理に結論づけず、参加者同士で少しずつ表現しながら、自分の内面にある感覚を一緒に見つめていきます。"
                ),
                facilitator=ogawa,
                location_type=LocationType.online,
                location="Zoom",
                day=2,
                start=(21, 0),
                end=(22, 30),
                capacity=8,
                price=0,
            ),
            dict(
                key="understanding",
                title="人とわかり合うことの可能性と限界を考える対話会",
                description=(
                    "自分の考えを丁寧に説明しても、相手にすべてが伝わるとは限りません。"
                    "一方で、言葉にしなくても気持ちが通じたと感じる瞬間もあります。"
                    "人を理解するためには、何をどこまで伝えればよいのでしょうか。"
                    "この対話会では、言葉の限界や相手の話を聴くことの意味について、身近な経験をもとに語り合います。"
                ),
                facilitator=ogawa,
                location_type=LocationType.offline,
                location=omotesando,
                day=36,
                start=(19, 0),
                end=(21, 0),
                capacity=10,
                price=1500,
            ),
            dict(
                key="speaking_up",
                title="周囲に合わせながら自分の意見を主張することの難しさについて語り合う場",
                description=(
                    "会議で反対意見があっても発言を控えたり、周囲が盛り上がっている場面で違和感を口にできなかったり。"
                    "私たちは、人と違うことを表明するのにためらいを感じることがあります。"
                    "この対話会では、なぜ周囲に合わせてしまうのか、集団の中で自分の意見を持つことにはどんな意味があるのかを考えます。"
                ),
                facilitator=takahashi,
                location_type=LocationType.online,
                location="Zoom",
                day=40,
                start=(20, 0),
                end=(21, 30),
                capacity=10,
                price=1000,
            ),
            dict(
                key="leisure",
                title="読書や映画を楽しみながら育まれる心の豊かさについて語り合う場",
                description=(
                    "読書や映画、音楽、散歩。"
                    "すぐに成果が出るわけではなくても、私たちの心を豊かにしてくれる時間があります。"
                    "一方で、趣味でさえスキルアップや自己投資につなげようとすることがあります。"
                    "この対話会では、何かの役に立つことと、自分が心から楽しむことの違いを考え、余暇の意味について語り合います。"
                ),
                facilitator=nakamura,
                location_type=LocationType.offline,
                location=jimbocho,
                day=45,
                start=(14, 0),
                end=(16, 0),
                capacity=10,
                price=1000,
            ),
            dict(
                key="own_life",
                title="「自分の人生を生きる」とは何かを深める対話会",
                description=(
                    "家族や職場、社会から期待される役割を担いながら、私たちは日々を過ごしています。"
                    "その中で、自分の選択は本当に自分の意思によるものなのかと考えることはないでしょうか。"
                    "この対話会では、他者の期待と自分の望みの関係を見つめ直し、自分の人生を生きることの意味を、それぞれの経験から探ります。"
                ),
                facilitator=hayase,
                location_type=LocationType.offline,
                location=shibuya,
                day=52,
                start=(19, 0),
                end=(21, 0),
                capacity=10,
                price=2000,
                status=WorkshopStatus.draft,
            ),
            dict(
                key="tokyo_life",
                title="東京で働き、暮らすことの豊かさと虚しさについて考える会",
                description=(
                    "便利な交通網、多くの店や娯楽、さまざまな人との出会い。"
                    "東京には多くの魅力がある一方で、忙しさや人との距離感に疲れることもあります。"
                    "便利で刺激的な暮らしが、必ずしも心の豊かさにつながるとは限りません。"
                    "この対話会では、都会で暮らす日常を振り返りながら、自分にとって心地よい生活のあり方を考えます。"
                ),
                facilitator=nakamura,
                location_type=LocationType.offline,
                location=omotesando,
                day=-20,
                start=(19, 0),
                end=(21, 0),
                capacity=12,
                price=1000,
                status=WorkshopStatus.canceled,
            ),
            dict(
                key="philosophy_night",
                title="答えを急がず、問いを深める哲学対話の夜",
                description=(
                    "日常では、問題を解決したり、相手を説得したりすることが重視されがちです。"
                    "しかし、答えの出ない問いを誰かと考え続けることで、今まで気づかなかった考え方や感覚に出会えることもあります。"
                    "この対話会では、正解を出すことを目的とせず、お互いの言葉に耳を傾けながら、身近な疑問や人生についての問いをゆっくり深めていきます。"
                ),
                facilitator=shiraishi,
                location_type=LocationType.offline,
                location=omotesando,
                day=-10,
                start=(19, 0),
                end=(21, 0),
                capacity=12,
                price=1500,
            ),
            dict(
                key="recognition",
                title="他人に認められたい気持ちについて語り合う対話会",
                description=(
                    "仕事で成果を評価されたり、誰かに褒められたりすると、嬉しい気持ちになるものです。"
                    "一方で、周囲からどう見られているかが気になり、自分の本当の気持ちを後回しにしてしまうこともあります。"
                    "私たちはなぜ他人から認められたいのでしょうか。"
                    "承認されることと、自分らしく生きることの関係について、一緒に考えてみませんか。"
                ),
                facilitator=ogawa,
                location_type=LocationType.online,
                location="Zoom",
                day=14,
                start=(20, 0),
                end=(21, 30),
                capacity=10,
                price=1000,
            ),
            dict(
                key="competition",
                title="競争することと、自分なりの豊かさについて考える対話会",
                description=(
                    "学歴や年収、仕事での成果など、社会には人と人を比較するさまざまな基準があります。"
                    "競争が努力するきっかけになることもあれば、他人の成功によって焦りを感じることもあるでしょう。"
                    "誰かに勝つことと、自分が満足できる人生を送ることは、どのようにつながっているのでしょうか。"
                    "競争社会の中で大切にしたい価値観について語り合います。"
                ),
                facilitator=takahashi,
                location_type=LocationType.offline,
                location="東京都中央区日本橋2丁目 日本橋ワークラウンジ",
                day=23,
                start=(19, 0),
                end=(21, 0),
                capacity=12,
                price=1500,
            ),
            dict(
                key="words_and_feelings",
                title="言葉にすることで、気持ちは変わるのか？",
                description=(
                    "何となく感じていたことを誰かに話した途端、自分でも思いがけない考えに気づくことがあります。"
                    "反対に、言葉にしたことで、かえって自分の気持ちが違うものになってしまうこともあるかもしれません。"
                    "言葉は、心の中にあるものを伝えるための道具なのでしょうか。"
                    "それとも、自分の感情や考えそのものを形づくるものなのでしょうか。"
                    "言葉と思考の関係を探ります。"
                ),
                facilitator=shiraishi,
                location_type=LocationType.online,
                location="Zoom",
                day=9,
                start=(21, 0),
                end=(22, 30),
                capacity=8,
                price=500,
            ),
            dict(
                key="doing_right",
                title="正しいことをするのは、いつでも正しいのか？",
                description=(
                    "ルールを守ること、嘘をつかないこと、困っている人を助けること。"
                    "私たちは日頃、正しいとされる行動を選ぼうとします。"
                    "しかし、正しいことをした結果、誰かを傷つけてしまう場合はどうでしょうか。"
                    "規則を守ることと、目の前の人を思いやることが両立しないとき、何を基準に判断すればよいのでしょうか。"
                    "身近な事例を通して、正義や倫理について対話します。"
                ),
                facilitator=hayase,
                location_type=LocationType.offline,
                location=shibuya,
                day=30,
                start=(19, 0),
                end=(21, 0),
                capacity=10,
                price=1500,
            ),
            dict(
                key="past_self",
                title="昔の自分と今の自分、どちらが本当の自分なのか？",
                description=(
                    "昔は大切にしていた考え方が、今ではしっくりこなくなることがあります。"
                    "好きだったものに興味がなくなったり、以前なら許せなかったことを受け入れられるようになったり。"
                    "人は変わっていくものですが、変化する自分をどのように理解すればよいのでしょうか。"
                    "過去の自分との向き合い方や、変わり続ける自分を受け入れることについて語り合います。"
                ),
                facilitator=shiraishi,
                location_type=LocationType.offline,
                location=omotesando,
                day=38,
                start=(19, 30),
                end=(21, 30),
                capacity=10,
                price=1500,
            ),
            dict(
                key="sense_of_beauty",
                title="美しいと感じる心について、夜のカフェで語り合いませんか？",
                description=(
                    "同じ映画や風景を見ても、心を動かされる場面は人によって異なります。"
                    "誰かにとっては何気ない景色が、自分にとっては忘れられないものになることもあります。"
                    "私たちは何に美しさを感じ、なぜ心を動かされるのでしょうか。"
                    "映画や小説、日常の風景などをきっかけに、それぞれの感性や心に残るものについて語り合う夜を過ごしてみませんか。"
                ),
                facilitator=nakamura,
                location_type=LocationType.offline,
                location=omotesando,
                day=27,
                start=(19, 30),
                end=(21, 30),
                capacity=12,
                price=1500,
            ),
        ]

        workshops: dict[str, Workshop] = {}
        # 今回、当日の案内を入れたワークショップ。既にある確定済みの予約にも案内のメッセージを送る
        guide_added: set[int] = set()
        for index, item in enumerate(sample_workshops):
            workshop = get_or_create_workshop(
                db,
                title=item["title"],
                description=item["description"],
                location_type=item["location_type"],
                location=item["location"],
                start_at=dt(item["day"], *item["start"]),
                end_at=dt(item["day"], *item["end"]),
                capacity=item["capacity"],
                price=item["price"],
                status=item.get("status", WorkshopStatus.published),
                facilitator_id=item["facilitator"].id,
            )
            ensure_sample_image(workshop, index, item["key"])
            if ensure_participant_guide(workshop, facilitator_keys[workshop.facilitator_id]):
                guide_added.add(workshop.id)
            workshops[item["key"]] = workshop

        db.flush()

        confirmed, canceled = ReservationStatus.confirmed, ReservationStatus.canceled
        sample_reservations = [
            ("adult_relations", sato, confirmed),
            ("adult_relations", tanaka, confirmed),
            ("adult_relations", ito, confirmed),
            ("ordinary_life", sato, confirmed),
            ("ordinary_life", watanabe, confirmed),
            ("honest_dialogue", tanaka, confirmed),
            ("honest_dialogue", kobayashi, confirmed),
            # 定員6に5名で「残席僅か」
            ("meaning_of_work", sato, confirmed),
            ("meaning_of_work", tanaka, confirmed),
            ("meaning_of_work", ito, confirmed),
            ("meaning_of_work", watanabe, confirmed),
            ("meaning_of_work", kobayashi, confirmed),
            ("loneliness", kobayashi, confirmed),
            ("movie_justice", sato, confirmed),
            ("movie_justice", ito, canceled),
            # 定員4に4名で「満員」
            ("drinking_party", sato, confirmed),
            ("drinking_party", tanaka, confirmed),
            ("drinking_party", ito, confirmed),
            ("drinking_party", watanabe, confirmed),
            ("unspoken_feelings", watanabe, confirmed),
            ("unspoken_feelings", kobayashi, confirmed),
            # 終了済み(開催履歴)
            ("philosophy_night", sato, confirmed),
            ("philosophy_night", tanaka, confirmed),
            ("philosophy_night", ito, confirmed),
        ]
        for key, user, status in sample_reservations:
            workshop = workshops[key]
            created = get_or_create_reservation(db, workshop.id, user.id, status)
            # アプリでは予約の確定時に当日の案内を主催者からのメッセージで送るので、サンプルでも同じ状態にする
            if status == confirmed and (created or workshop.id in guide_added):
                send_participant_guide(db, workshop, user.id)

        db.commit()
        print("seed complete")
        print(f"  admin:       admin@example.com / {PASSWORD}")
        for email, _, _ in SAMPLE_FACILITATORS.values():
            print(f"  facilitator: {email} / {PASSWORD}")
        print(f"  participant: sato@example.com / {PASSWORD}")
        print(f"  participant: tanaka@example.com / {PASSWORD}")
        print(f"  participant: ito@example.com / {PASSWORD}")
        print(f"  participant: watanabe@example.com / {PASSWORD}")
        print(f"  participant: kobayashi@example.com / {PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
