# chat.py
import os
from flask import Blueprint, request, jsonify
import requests

chat_bp = Blueprint('chat', __name__)

OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

def get_api_key():
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set. Add it to your environment or .env (not committed).")
    return api_key

@chat_bp.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json() or {}
        messages = data.get('messages', [])
        if not messages:
            return jsonify({'error': 'Messages are required'}), 400

        if messages[0].get('role') != 'system':
            messages.insert(0, {
                'role': 'system',
                'content': 'You are a helpful assistant in ALLChat. Provide clear, concise, and friendly responses.'
            })

        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {get_api_key()}',
        }
        payload = {
            'model': 'gpt-4o-mini',   # keep your preferred model here
            'messages': messages,
            'temperature': 0.7,
            'max_tokens': 1000,
        }

        resp = requests.post(OPENAI_API_URL, headers=headers, json=payload, timeout=30)
        if not resp.ok:
            return jsonify({'success': False, 'error': resp.text}), resp.status_code

        j = resp.json()
        content = j.get('choices', [{}])[0].get('message', {}).get('content', '')
        return jsonify({'success': True, 'message': content})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
