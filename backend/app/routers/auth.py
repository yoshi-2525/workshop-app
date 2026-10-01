from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.core.deps import get_current_user, require_roles
from app.core.rate_limit import FailureLimiter
from app.core.security import burn_password_check, create_access_token, hash_password, verify_password
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.auth import Token
from app.schemas.user import UserRead, UserRegister, UserUpdate
from app.services.uploads import delete_avatar_image, reject_oversized_upload, save_avatar_image

router = APIRouter(prefix="/auth", tags=["auth"])

# パスワードの総当たり対策。同じ IP から・同じアカウントへの失敗をそれぞれ数える
_login_limiter = FailureLimiter(settings.login_max_failures, settings.login_failure_window_seconds)


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)) -> User:
    user = User(
        email=payload.email.lower(),
        name=payload.name,
        hashed_password=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="このメールアドレスは既に登録されています",
        ) from exc
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> Token:
    email = form_data.username.lower()
    client_host = request.client.host if request.client else "unknown"
    limiter_keys = (f"ip:{client_host}", f"email:{email}")

    retry_after = _login_limiter.retry_after(*limiter_keys)
    if retry_after is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="ログインの失敗が続いたため、しばらく時間をおいてから再度お試しください",
            headers={"Retry-After": str(retry_after)},
        )

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        burn_password_check(form_data.password)
    if user is None or not verify_password(form_data.password, user.hashed_password):
        _login_limiter.record_failure(*limiter_keys)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="メールアドレスまたはパスワードが正しくありません",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # 本人がログインできたら、そのアカウントへの失敗回数は消す(IP 側は残す)
    _login_limiter.reset(f"email:{email}")
    token = create_access_token(subject=str(user.id))
    return Token(access_token=token)


@router.get("/me", response_model=UserRead)
def read_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.patch("/me", response_model=UserRead)
def update_me(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    if payload.name is not None:
        current_user.name = payload.name
    if payload.bio is not None:
        current_user.bio = payload.bio
    db.commit()
    db.refresh(current_user)
    return current_user


# 主催者アイコンはワークショップ詳細・主催者ページに出すものなので、主催者と運営だけが設定できる。
# ワークショップ画像と同じく、同期処理としてスレッドプールで動かし、大きすぎる送信は本文の受け取り前に断る
@router.post("/me/avatar", response_model=UserRead, dependencies=[Depends(reject_oversized_upload)])
def upload_my_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.facilitator)),
) -> User:
    new_avatar_url = save_avatar_image(file)
    old_avatar_url = current_user.avatar_url
    current_user.avatar_url = new_avatar_url
    try:
        db.commit()
    except Exception:
        db.rollback()
        # DB に記録できなかった画像はどこからも参照されないので消す
        delete_avatar_image(new_avatar_url)
        raise
    db.refresh(current_user)
    if old_avatar_url:
        delete_avatar_image(old_avatar_url)
    return current_user


@router.delete("/me/avatar", response_model=UserRead)
def remove_my_avatar(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.facilitator)),
) -> User:
    old_avatar_url = current_user.avatar_url
    current_user.avatar_url = ""
    db.commit()
    db.refresh(current_user)
    if old_avatar_url:
        delete_avatar_image(old_avatar_url)
    return current_user
