import logging
import sys

from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.database import get_session_factory
from app.models.auth import AuthUser

logger = logging.getLogger(__name__)


def main() -> int:
    settings = get_settings()
    user_id = settings.admin_user_id.strip().lower()
    password = settings.admin_password
    if not user_id or not password:
        logger.error("Set ADMIN_USER_ID and ADMIN_PASSWORD before bootstrapping.")
        return 1

    try:
        db = get_session_factory()()
    except RuntimeError as exc:
        logger.error("Could not connect to the database: %s", exc)
        return 1
    try:
        if db.get(AuthUser, user_id) is not None:
            logger.error("Admin account %s already exists; no changes were made.", user_id)
            return 1

        db.add(
            AuthUser(
                user_id=user_id,
                password_hash=hash_password(password),
                is_active=True,
            )
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        logger.error("Admin account %s already exists; no changes were made.", user_id)
        return 1
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Could not create the admin account.")
        return 1
    finally:
        db.close()

    logger.info("Admin account %s created.", user_id)
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    sys.exit(main())
