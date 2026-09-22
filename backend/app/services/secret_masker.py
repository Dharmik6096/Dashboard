import re
from typing import Any

# Patterns that indicate a secret value
_SECRET_PATTERNS = re.compile(
    r"(password|passwd|pwd|secret|key|token|auth|credential|private|apikey|api_key|"
    r"access_key|aws_secret|db_pass|database_pass|smtp_pass|mail_pass)",
    re.IGNORECASE,
)

MASKED = "***MASKED***"


def mask_env_vars(env_vars: list[str] | None) -> dict[str, str]:
    """Convert list of KEY=VALUE env vars, masking secret values."""
    if not env_vars:
        return {}
    result = {}
    for item in env_vars:
        if "=" in item:
            key, _, value = item.partition("=")
            if _SECRET_PATTERNS.search(key):
                result[key] = MASKED
            else:
                result[key] = value
        else:
            result[item] = ""
    return result


def mask_dict(data: dict[str, Any]) -> dict[str, Any]:
    """Recursively mask secret keys in a dict."""
    if not data:
        return {}
    result = {}
    for key, value in data.items():
        if _SECRET_PATTERNS.search(str(key)):
            result[key] = MASKED
        elif isinstance(value, dict):
            result[key] = mask_dict(value)
        else:
            result[key] = value
    return result
