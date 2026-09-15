"""
One-off CLI script to create the single Admin account.

This intentionally lives OUTSIDE the HTTP API surface - there is no
public /register endpoint, since only one Admin account should ever
exist for this system (PRD section 3). Run this once, locally or via
your deployment shell, never expose it as a web route.

Usage (run from the backend/ directory, with venv active):
    python scripts/create_admin.py --name "Your Name" --email admin@richykicks.com

You'll be prompted for a password interactively so it never ends up
in shell history or process listings.
"""
import argparse
import getpass
import sys

sys.path.insert(0, ".")

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import User, UserRole


def main() -> None:
    parser = argparse.ArgumentParser(description="Create the RichyKicks Admin account")
    parser.add_argument("--name", required=True)
    parser.add_argument("--email", required=True)
    args = parser.parse_args()

    db = SessionLocal()
    try:
        existing_admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
        if existing_admin is not None:
            print(f"An Admin account already exists: {existing_admin.email}")
            print("Only one Admin account is allowed (PRD section 3). Aborting.")
            sys.exit(1)

        if db.query(User).filter(User.email == args.email).first() is not None:
            print(f"A user with email {args.email} already exists. Aborting.")
            sys.exit(1)

        password = getpass.getpass("Set Admin password: ")
        confirm = getpass.getpass("Confirm password: ")
        if password != confirm:
            print("Passwords do not match. Aborting.")
            sys.exit(1)
        if len(password) < 8:
            print("Password must be at least 8 characters. Aborting.")
            sys.exit(1)

        admin = User(
            name=args.name,
            email=args.email,
            password_hash=hash_password(password),
            role=UserRole.ADMIN,
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print(f"Admin account created: {args.email}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
