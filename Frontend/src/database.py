import json
import os
from typing import Optional, Dict, Any

# Mock database loader: reads from src/mock/customers.json
MOCK_PATH = os.path.join(os.path.dirname(__file__), 'mock', 'customers.json')

def _load_mock():
    try:
        with open(MOCK_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return []


def query_database(dni: str) -> Optional[Dict[str, Any]]:
    """Query mock customers by DNI. Returns a dict or None if not found."""
    if not dni:
        return None
    customers = _load_mock()
    for c in customers:
        if str(c.get('dni')) == str(dni):
            return c
    return None
