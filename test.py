import requests

url = "http://localhost:8000/api/v1/ai/chat"
payload = {
    "messages": [
        {"role": "system", "content": "You are an expert infrastructure AI analyzing server: web2. The server is currently online."},
        {"role": "user", "content": "How many docker images ?"}
    ],
    "context": {
        "server_id": "3e598dbb-39f2-4568-96f5-be8dc0c02715",
        "page": "servers",
        "entity_type": "server",
        "entity_id": "3e598dbb-39f2-4568-96f5-be8dc0c02715"
    }
}
res = requests.post(url, json=payload)
print(res.status_code)
print(res.text)
