"""ユーザーの役割を変える。使い方: python scripts/set_role.py user@example.com admin|facilitator|participant"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402


def main() -> None:
    if len(sys.argv) != 3:
        print("usage: python scripts/set_role.py <email> <admin|facilitator|participant>")
        sys.exit(1)

    email = sys.argv[1].lower()
    try:
        role = UserRole(sys.argv[2])
    except ValueError:
        print(f"invalid role: {sys.argv[2]}")
        sys.exit(1)

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user is None:
            print(f"user not found: {email}")
            sys.exit(1)
        user.role = role
        db.commit()
        print(f"set {email} role to {role.value}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
