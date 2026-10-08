"""Create an application user without exposing passwords in command arguments."""

from __future__ import annotations

import argparse
from getpass import getpass
import sys

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.core.security import hash_password
from app.db.database import get_session_factory
from app.models.user import User, UserRole


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a SevaAI application user.")
    parser.add_argument("--username", required=True)
    parser.add_argument("--full-name", required=True)
    parser.add_argument("--role", required=True, choices=[role.value for role in UserRole])
    parser.add_argument("--district")
    parser.add_argument("--block")
    args = parser.parse_args()

    if args.role == UserRole.STATE_ADMIN.value:
        if args.district or args.block:
            parser.error("STATE_ADMIN users must not have a district or block.")
    elif not args.district:
        parser.error("District and block officer users require --district.")
    if args.role == UserRole.BLOCK_OFFICER.value and not args.block:
        parser.error("BLOCK_OFFICER users require --block.")
    if args.role == UserRole.DISTRICT_OFFICER.value and args.block:
        parser.error("DISTRICT_OFFICER users cannot be assigned a block.")
    return args


def main() -> int:
    args = parse_args()
    password = getpass("Password (minimum 12 characters): ")
    confirmation = getpass("Confirm password: ")
    if len(password) < 12 or password != confirmation:
        print("Passwords must match and contain at least 12 characters.", file=sys.stderr)
        return 2

    try:
        with get_session_factory()() as db:
            existing = db.scalar(
                select(User.id).where(User.username == args.username.strip())
            )
            if existing is not None:
                print("That username is already in use.", file=sys.stderr)
                return 2
            user = User(
                username=args.username.strip(),
                password_hash=hash_password(password),
                full_name=args.full_name.strip(),
                role=UserRole(args.role),
                district=args.district,
                block=args.block,
                is_active=True,
            )
            db.add(user)
            db.commit()
            print(f"Created {user.role} account {user.username}.")
            return 0
    except IntegrityError:
        print("User creation failed because of a constraint violation.", file=sys.stderr)
        return 2
    except SQLAlchemyError:
        print("User creation failed because the database is unavailable.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
