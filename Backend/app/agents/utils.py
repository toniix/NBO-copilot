"""
utils.py
--------
Utilidades compartidas entre nodos y módulos de ML.
"""

from __future__ import annotations


def is_mt_offer(offer: dict) -> bool:
    """¿Es la oferta de tipo Movistar Total?"""
    return str(offer.get("es_movistar_total", "False")).lower() == "true"
