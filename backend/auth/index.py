"""
Авторизация пользователей: регистрация/вход по номеру телефона (SMS-код) и через Google OAuth.
"""
import json
import os
import secrets
import random
import psycopg2
from datetime import datetime, timedelta

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id',
    }

def ok(data):
    return {'statusCode': 200, 'headers': {**cors_headers(), 'Content-Type': 'application/json'}, 'body': json.dumps(data)}

def err(msg, code=400):
    return {'statusCode': code, 'headers': {**cors_headers(), 'Content-Type': 'application/json'}, 'body': json.dumps({'error': msg})}

def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors_headers(), 'body': ''}

    method = event.get('httpMethod', 'GET')
    path = event.get('path', '/')
    body = {}
    if event.get('body'):
        try:
            body = json.loads(event['body'])
        except Exception:
            pass

    # POST /send-code — отправка кода на телефон
    if method == 'POST' and path.endswith('/send-code'):
        phone = body.get('phone', '').strip()
        if not phone or len(phone) < 7:
            return err('Введите корректный номер телефона')

        code = str(random.randint(1000, 9999))
        expires = datetime.utcnow() + timedelta(minutes=10)

        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"""
            INSERT INTO {SCHEMA}.users (phone, phone_code, phone_code_expires_at, auth_provider)
            VALUES (%s, %s, %s, 'phone')
            ON CONFLICT (phone) DO UPDATE
            SET phone_code = %s, phone_code_expires_at = %s
        """, (phone, code, expires, code, expires))
        conn.commit()
        cur.close()
        conn.close()

        # В production здесь была бы отправка SMS. Пока возвращаем код в ответе (для демо).
        return ok({'sent': True, 'demo_code': code, 'message': 'Код отправлен'})

    # POST /verify-code — верификация кода
    if method == 'POST' and path.endswith('/verify-code'):
        phone = body.get('phone', '').strip()
        code = body.get('code', '').strip()
        name = body.get('name', '').strip()

        if not phone or not code:
            return err('Укажите телефон и код')

        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"""
            SELECT id, phone_code, phone_code_expires_at, name
            FROM {SCHEMA}.users WHERE phone = %s
        """, (phone,))
        row = cur.fetchone()
        if not row:
            cur.close(); conn.close()
            return err('Пользователь не найден')

        user_id, db_code, expires_at, db_name = row
        if db_code != code:
            cur.close(); conn.close()
            return err('Неверный код')
        if expires_at and datetime.utcnow() > expires_at:
            cur.close(); conn.close()
            return err('Код устарел, запросите новый')

        token = secrets.token_hex(32)
        display_name = name if name else db_name if db_name else f'Пользователь {user_id}'

        cur.execute(f"""
            UPDATE {SCHEMA}.users
            SET session_token = %s, name = %s, phone_code = NULL, phone_code_expires_at = NULL, is_online = TRUE, last_seen_at = NOW()
            WHERE id = %s
        """, (token, display_name, user_id))
        conn.commit()
        cur.close(); conn.close()

        return ok({'token': token, 'user_id': user_id, 'name': display_name, 'phone': phone})

    # POST /google — авторизация через Google (id_token)
    if method == 'POST' and path.endswith('/google'):
        google_id = body.get('google_id', '').strip()
        email = body.get('email', '').strip()
        name = body.get('name', '').strip()
        avatar_url = body.get('avatar_url', '').strip()

        if not google_id or not email:
            return err('Данные Google не переданы')

        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"""
            INSERT INTO {SCHEMA}.users (google_id, email, name, avatar_url, auth_provider)
            VALUES (%s, %s, %s, %s, 'google')
            ON CONFLICT (google_id) DO UPDATE
            SET email = %s, name = CASE WHEN {SCHEMA}.users.name = '' THEN %s ELSE {SCHEMA}.users.name END, avatar_url = %s
            RETURNING id, name
        """, (google_id, email, name, avatar_url, email, name, avatar_url))
        row = cur.fetchone()
        user_id, display_name = row

        token = secrets.token_hex(32)
        cur.execute(f"""
            UPDATE {SCHEMA}.users SET session_token = %s, is_online = TRUE, last_seen_at = NOW()
            WHERE id = %s
        """, (token, user_id))
        conn.commit()
        cur.close(); conn.close()

        return ok({'token': token, 'user_id': user_id, 'name': display_name, 'email': email})

    # GET /me — получить профиль по токену
    if method == 'GET' and path.endswith('/me'):
        headers = event.get('headers', {})
        token = headers.get('X-Auth-Token') or headers.get('x-auth-token')
        if not token:
            return err('Не авторизован', 401)

        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"""
            SELECT id, name, phone, email, username, avatar_url, auth_provider, created_at
            FROM {SCHEMA}.users WHERE session_token = %s
        """, (token,))
        row = cur.fetchone()
        cur.close(); conn.close()
        if not row:
            return err('Сессия недействительна', 401)

        return ok({
            'id': row[0], 'name': row[1], 'phone': row[2], 'email': row[3],
            'username': row[4], 'avatar_url': row[5], 'auth_provider': row[6],
            'created_at': str(row[7])
        })

    # POST /logout
    if method == 'POST' and path.endswith('/logout'):
        headers = event.get('headers', {})
        token = headers.get('X-Auth-Token') or headers.get('x-auth-token')
        if token:
            conn = get_conn()
            cur = conn.cursor()
            cur.execute(f"UPDATE {SCHEMA}.users SET session_token = NULL, is_online = FALSE WHERE session_token = %s", (token,))
            conn.commit()
            cur.close(); conn.close()
        return ok({'ok': True})

    return err('Маршрут не найден', 404)
