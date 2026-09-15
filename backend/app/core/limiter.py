"""
Shared slowapi Limiter instance. Defined separately from main.py so
route files can import it without a circular import (main.py wires
routes, and routes need the limiter decorator).
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
