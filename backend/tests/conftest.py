import os
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

# Load frontend env to use public backend URL
load_dotenv(Path("/app/frontend/.env"))

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture()
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def device_key():
    return "TEST_device_sehat_01"
