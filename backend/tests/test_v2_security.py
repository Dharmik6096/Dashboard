import hashlib
import hmac
import time

import pytest
from pydantic import ValidationError

from app.api.v1.auth import SignupRequest
from app.api.v1.billing import PLANS, safe_return_url, verify_stripe_signature
from app.config import settings
from app.core.security import create_access_token, create_refresh_token, decode_token


def test_signup_requires_strong_password():
    with pytest.raises(ValidationError):
        SignupRequest(name="Test User", email="test@example.com", company="Example", password="weakpassword")
    signup = SignupRequest(name="Test User", email="TEST@example.com", company="Example", password="StrongPassword9")
    assert signup.email == "test@example.com"


def test_return_urls_are_origin_allowlisted():
    assert safe_return_url("http://localhost:3000/app/billing") == "http://localhost:3000/app/billing"
    with pytest.raises(Exception):
        safe_return_url("https://attacker.example/steal")


def test_stripe_signature_is_verified(monkeypatch):
    monkeypatch.setattr(settings, "STRIPE_WEBHOOK_SECRET", "whsec_test")
    payload = b'{"id":"evt_test"}'
    timestamp = int(time.time())
    digest = hmac.new(b"whsec_test", f"{timestamp}.".encode() + payload, hashlib.sha256).hexdigest()
    verify_stripe_signature(payload, f"t={timestamp},v1={digest}")
    with pytest.raises(Exception):
        verify_stripe_signature(payload, f"t={timestamp},v1=invalid")


def test_access_and_refresh_tokens_are_separated():
    access = decode_token(create_access_token("user-1", "viewer"))
    refresh = decode_token(create_refresh_token("user-1"))
    assert access["type"] == "access"
    assert refresh["type"] == "refresh"
    assert access["jti"] != refresh["jti"]


def test_plan_contract_is_stable():
    assert [plan["id"] for plan in PLANS] == ["starter", "scale", "enterprise"]
    assert PLANS[0]["host_limit"] == 5
    assert PLANS[1]["price_monthly"] == 49

