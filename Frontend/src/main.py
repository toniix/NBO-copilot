import os
import requests
from database import query_database

# Simple script to demonstrate model calling for a found customer by DNI.
MODEL_URL = os.environ.get('MODEL_URL', 'http://localhost:8000/predict')


def consultar_cliente_por_dni(dni: str):
    cliente = query_database(dni)
    if not cliente:
        print(f'Cliente con DNI {dni} no encontrado. Abra formulario para ingreso de variables.')
        return None

    # Build payload from client data (only numeric features)
    clientData = {k: v for k, v in cliente.items() if k not in ('dni', 'phone', 'name')}

    try:
        resp = requests.post(MODEL_URL, json={'phone': cliente.get('phone'), 'clientData': clientData}, timeout=10)
        resp.raise_for_status()
        print('Predicción recibida:', resp.json())
        return resp.json()
    except Exception as e:
        print('Error llamando al servidor de modelo:', e)
        return None


if __name__ == '__main__':
    # ejemplo
    consultar_cliente_por_dni('12345678')
