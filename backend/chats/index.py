"""
Управление чатами и сообщениями: получение списка чатов, создание чата, отправка и получение сообщений.
"""
import json
import os
import psycopg2

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
    return {'statusCode': 200, 'headers': {**cors_headers(), 'Content-Type': 'application/json'}, 'body': json.dumps(data, default=str)}

def err(msg, code=400):
    return {'statusCode': code, 'headers': {**cors_headers(), 'Content-Type': 'application/json'}, 'body': json.dumps({'error': msg})}

def get_user_id(event):
    headers = event.get('headers', {})
    token = headers.get('X-Auth-Token') or headers.get('x-auth-token')
    if not token:
        return None, None
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(f"SELECT id, name FROM {SCHEMA}.users WHERE session_token = %s", (token,))
    row = cur.fetchone()
    cur.close(); conn.close()
    if not row:
        return None, None
    return row[0], row[1]

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

    user_id, user_name = get_user_id(event)

    # GET /list — список чатов пользователя
    if method == 'GET' and path.endswith('/list'):
        if not user_id:
            return err('Не авторизован', 401)

        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"""
            SELECT
                c.id,
                c.type,
                COALESCE(c.name,
                    (SELECT u2.name FROM {SCHEMA}.chat_members cm2
                     JOIN {SCHEMA}.users u2 ON u2.id = cm2.user_id
                     WHERE cm2.chat_id = c.id AND cm2.user_id != %s LIMIT 1)
                ) AS display_name,
                (SELECT u2.avatar_url FROM {SCHEMA}.chat_members cm2
                 JOIN {SCHEMA}.users u2 ON u2.id = cm2.user_id
                 WHERE cm2.chat_id = c.id AND cm2.user_id != %s LIMIT 1) AS other_avatar,
                (SELECT m.text FROM {SCHEMA}.messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_msg,
                (SELECT m.created_at FROM {SCHEMA}.messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_time,
                (SELECT COUNT(*) FROM {SCHEMA}.messages m WHERE m.chat_id = c.id AND m.is_read = FALSE AND m.sender_id != %s) AS unread_count,
                (SELECT u2.id FROM {SCHEMA}.chat_members cm2
                 JOIN {SCHEMA}.users u2 ON u2.id = cm2.user_id
                 WHERE cm2.chat_id = c.id AND cm2.user_id != %s LIMIT 1) AS other_user_id,
                (SELECT u2.is_online FROM {SCHEMA}.chat_members cm2
                 JOIN {SCHEMA}.users u2 ON u2.id = cm2.user_id
                 WHERE cm2.chat_id = c.id AND cm2.user_id != %s LIMIT 1) AS other_online
            FROM {SCHEMA}.chats c
            JOIN {SCHEMA}.chat_members cm ON cm.chat_id = c.id AND cm.user_id = %s
            ORDER BY last_time DESC NULLS LAST
        """, (user_id, user_id, user_id, user_id, user_id, user_id))
        rows = cur.fetchall()
        cur.close(); conn.close()

        chats = []
        for row in rows:
            chats.append({
                'id': row[0],
                'type': row[1],
                'name': row[2] or 'Без имени',
                'avatar_url': row[3],
                'last_msg': row[4] or '',
                'last_time': str(row[5]) if row[5] else '',
                'unread_count': int(row[6]) if row[6] else 0,
                'other_user_id': row[7],
                'other_online': bool(row[8]) if row[8] is not None else False,
            })
        return ok({'chats': chats})

    # POST /create — создать или найти личный чат с пользователем
    if method == 'POST' and path.endswith('/create'):
        if not user_id:
            return err('Не авторизован', 401)
        other_id = body.get('user_id')
        if not other_id:
            return err('Укажите user_id собеседника')

        conn = get_conn()
        cur = conn.cursor()

        # Ищем существующий приватный чат между этими двумя
        cur.execute(f"""
            SELECT c.id FROM {SCHEMA}.chats c
            JOIN {SCHEMA}.chat_members cm1 ON cm1.chat_id = c.id AND cm1.user_id = %s
            JOIN {SCHEMA}.chat_members cm2 ON cm2.chat_id = c.id AND cm2.user_id = %s
            WHERE c.type = 'direct'
            LIMIT 1
        """, (user_id, other_id))
        existing = cur.fetchone()

        if existing:
            cur.close(); conn.close()
            return ok({'chat_id': existing[0], 'created': False})

        cur.execute(f"INSERT INTO {SCHEMA}.chats (type) VALUES ('direct') RETURNING id")
        chat_id = cur.fetchone()[0]
        cur.execute(f"INSERT INTO {SCHEMA}.chat_members (chat_id, user_id) VALUES (%s, %s), (%s, %s)", (chat_id, user_id, chat_id, other_id))
        conn.commit()
        cur.close(); conn.close()
        return ok({'chat_id': chat_id, 'created': True})

    # GET /messages?chat_id=X — получить сообщения чата
    if method == 'GET' and path.endswith('/messages'):
        if not user_id:
            return err('Не авторизован', 401)
        qs = event.get('queryStringParameters') or {}
        chat_id = qs.get('chat_id')
        if not chat_id:
            return err('Укажите chat_id')

        conn = get_conn()
        cur = conn.cursor()

        # Проверяем участие
        cur.execute(f"SELECT 1 FROM {SCHEMA}.chat_members WHERE chat_id = %s AND user_id = %s", (chat_id, user_id))
        if not cur.fetchone():
            cur.close(); conn.close()
            return err('Нет доступа', 403)

        cur.execute(f"""
            SELECT m.id, m.sender_id, u.name, m.text, m.is_read, m.created_at
            FROM {SCHEMA}.messages m
            JOIN {SCHEMA}.users u ON u.id = m.sender_id
            WHERE m.chat_id = %s
            ORDER BY m.created_at ASC
            LIMIT 100
        """, (chat_id,))
        rows = cur.fetchall()

        # Помечаем как прочитанные
        cur.execute(f"""
            UPDATE {SCHEMA}.messages SET is_read = TRUE
            WHERE chat_id = %s AND sender_id != %s AND is_read = FALSE
        """, (chat_id, user_id))
        conn.commit()
        cur.close(); conn.close()

        messages = []
        for row in rows:
            messages.append({
                'id': row[0],
                'sender_id': row[1],
                'sender_name': row[2],
                'text': row[3],
                'is_read': row[4],
                'created_at': str(row[5]),
                'out': row[1] == user_id,
            })
        return ok({'messages': messages})

    # POST /send — отправить сообщение
    if method == 'POST' and path.endswith('/send'):
        if not user_id:
            return err('Не авторизован', 401)
        chat_id = body.get('chat_id')
        text = (body.get('text') or '').strip()
        if not chat_id or not text:
            return err('Укажите chat_id и text')

        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"SELECT 1 FROM {SCHEMA}.chat_members WHERE chat_id = %s AND user_id = %s", (chat_id, user_id))
        if not cur.fetchone():
            cur.close(); conn.close()
            return err('Нет доступа', 403)

        cur.execute(f"""
            INSERT INTO {SCHEMA}.messages (chat_id, sender_id, text) VALUES (%s, %s, %s)
            RETURNING id, created_at
        """, (chat_id, user_id, text))
        row = cur.fetchone()
        conn.commit()
        cur.close(); conn.close()

        return ok({'id': row[0], 'created_at': str(row[1]), 'text': text, 'sender_id': user_id, 'out': True})

    # GET /users/search?q=... — поиск пользователей для начала чата
    if method == 'GET' and path.endswith('/users/search'):
        if not user_id:
            return err('Не авторизован', 401)
        qs = event.get('queryStringParameters') or {}
        q = (qs.get('q') or '').strip()
        if len(q) < 2:
            return ok({'users': []})

        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"""
            SELECT id, name, phone, email, avatar_url, is_online
            FROM {SCHEMA}.users
            WHERE id != %s AND (
                name ILIKE %s OR phone ILIKE %s OR email ILIKE %s OR username ILIKE %s
            )
            LIMIT 20
        """, (user_id, f'%{q}%', f'%{q}%', f'%{q}%', f'%{q}%'))
        rows = cur.fetchall()
        cur.close(); conn.close()

        users = [{'id': r[0], 'name': r[1], 'phone': r[2], 'email': r[3], 'avatar_url': r[4], 'is_online': r[5]} for r in rows]
        return ok({'users': users})

    return err('Маршрут не найден', 404)
