from dotenv import load_dotenv
from functools import wraps
import os

load_dotenv()

_langfuse_enabled = False

try:
    public_key = os.getenv("LANGFUSE_PUBLIC_KEY")
    secret_key = os.getenv("LANGFUSE_SECRET_KEY")
    if public_key and secret_key and not public_key.startswith("pk-lf-your"):
        os.environ.setdefault("LANGFUSE_PUBLIC_KEY", public_key)
        os.environ.setdefault("LANGFUSE_SECRET_KEY", secret_key)
        os.environ.setdefault("LANGFUSE_BASE_URL", os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com"))
        _langfuse_enabled = True
        print("Langfuse tracing enabled (v4)")
    else:
        print("Langfuse keys not configured – tracing disabled")
except Exception as e:
    print(f"Langfuse init failed – tracing disabled: {e}")


def is_enabled():
    return _langfuse_enabled


def create_trace(name, metadata=None):
    return None


def trace_agent(agent_name):
    def decorator(func):
        if _langfuse_enabled:
            try:
                from langfuse import observe
                return observe(name=agent_name)(func)
            except (ImportError, Exception):
                pass

        @wraps(func)
        def wrapper(*args, **kwargs):
            return func(*args, **kwargs)
        return wrapper
    return decorator


def flush():
    if _langfuse_enabled:
        try:
            from langfuse import get_client
            get_client().flush()
        except Exception:
            pass