import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";

// ─── Config ───────────────────────────────────────────────────────────────────

const AUTH_URL = "https://functions.poehali.dev/cb5989ac-9018-49a9-8a6b-68504b8e3939";
const CHATS_URL = "https://functions.poehali.dev/be0b03ec-c190-482c-a46d-75ca0dc4d49d";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "chats" | "contacts" | "statuses" | "search" | "settings";
type Screen = "auth" | "list" | "chat" | "new_chat";

interface User {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  avatar_url?: string;
  auth_provider: string;
}

interface Chat {
  id: number;
  name: string;
  avatar_url?: string;
  last_msg: string;
  last_time: string;
  unread_count: number;
  other_user_id: number;
  other_online: boolean;
}

interface Message {
  id: number;
  sender_id: number;
  sender_name: string;
  text: string;
  is_read: boolean;
  created_at: string;
  out: boolean;
}

interface SearchUser {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  avatar_url?: string;
  is_online: boolean;
}

// ─── API ─────────────────────────────────────────────────────────────────────

function authHeaders(token: string) {
  return { 'Content-Type': 'application/json', 'X-Auth-Token': token };
}

async function apiPost(url: string, path: string, body: object, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['X-Auth-Token'] = token;
  const r = await fetch(url + path, { method: 'POST', headers, body: JSON.stringify(body) });
  return r.json();
}

async function apiGet(url: string, path: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['X-Auth-Token'] = token;
  const r = await fetch(url + path, { method: 'GET', headers });
  return r.json();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatTime(isoStr: string) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' });
}

// ─── Avatar component ─────────────────────────────────────────────────────────

function Avatar({ name, url, online, size = "md" }: { name: string; url?: string; online?: boolean; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-9 h-9 text-xs", md: "w-11 h-11 text-sm", lg: "w-16 h-16 text-xl" };
  return (
    <div className="relative flex-shrink-0">
      {url ? (
        <img src={url} alt={name} className={`${sizes[size]} rounded-full object-cover border border-[hsl(158,30%,22%)]`} />
      ) : (
        <div className={`${sizes[size]} rounded-full bg-gradient-to-br from-[hsl(158,40%,20%)] to-[hsl(158,30%,14%)] border border-[hsl(158,30%,22%)] flex items-center justify-center font-semibold text-[hsl(var(--primary))]`}>
          {getInitials(name || '?')}
        </div>
      )}
      {online && (
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[hsl(var(--primary))] rounded-full border-2 border-[hsl(var(--background))] pulse-glow" />
      )}
    </div>
  );
}

function EncryptBadge() {
  return (
    <span className="encrypt-badge">
      <Icon name="Lock" size={9} />
      E2E
    </span>
  );
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────

function AuthScreen({ onLogin }: { onLogin: (user: User, token: string) => void }) {
  const [step, setStep] = useState<"choose" | "phone_enter" | "phone_code" | "phone_name">("choose");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [demoCode, setDemoCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendCode() {
    if (!phone.trim()) return;
    setLoading(true); setError("");
    const res = await apiPost(AUTH_URL, '/send-code', { phone: phone.trim() });
    setLoading(false);
    if (res.sent) {
      setDemoCode(res.demo_code || '');
      setStep("phone_code");
    } else {
      setError(res.error || 'Ошибка отправки');
    }
  }

  async function verifyCode() {
    if (!code.trim()) return;
    setLoading(true); setError("");
    const res = await apiPost(AUTH_URL, '/verify-code', { phone: phone.trim(), code: code.trim(), name: name.trim() });
    setLoading(false);
    if (res.token) {
      localStorage.setItem('cipher_token', res.token);
      onLogin({ id: res.user_id, name: res.name, phone: res.phone, auth_provider: 'phone' }, res.token);
    } else {
      setError(res.error || 'Неверный код');
    }
  }

  // Google OAuth — упрощённая версия (popup с данными)
  function handleGoogleDemo() {
    setError("");
    // В реальном продукте здесь был бы Google OAuth SDK
    // Для демо — открываем диалог с вводом email
    const email = window.prompt('Введите email (демо Google входа):');
    if (!email) return;
    const gname = window.prompt('Введите имя:') || email.split('@')[0];
    loginWithGoogle('google_' + email, email, gname);
  }

  async function loginWithGoogle(gid: string, email: string, gname: string) {
    setLoading(true);
    const res = await apiPost(AUTH_URL, '/google', { google_id: gid, email, name: gname, avatar_url: '' });
    setLoading(false);
    if (res.token) {
      localStorage.setItem('cipher_token', res.token);
      onLogin({ id: res.user_id, name: res.name, email: res.email, auth_provider: 'google' }, res.token);
    } else {
      setError(res.error || 'Ошибка входа');
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 animate-fade-in">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[hsl(158,40%,20%)] to-[hsl(158,30%,14%)] border border-[hsl(158,30%,22%)] flex items-center justify-center mx-auto mb-4">
            <Icon name="Lock" size={28} className="text-[hsl(var(--primary))]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Cipher</h1>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 font-mono-cipher">Зашифрованный мессенджер</p>
        </div>

        {step === "choose" && (
          <div className="flex flex-col gap-3 animate-fade-up" style={{ opacity: 0, animationFillMode: 'forwards' }}>
            <button
              onClick={() => setStep("phone_enter")}
              className="flex items-center gap-3 w-full px-4 py-3.5 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-2xl font-medium hover:opacity-90 transition-opacity"
            >
              <Icon name="Phone" size={18} />
              <span>Войти по номеру телефона</span>
            </button>
            <button
              onClick={handleGoogleDemo}
              className="flex items-center gap-3 w-full px-4 py-3.5 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl font-medium hover:bg-[hsl(var(--accent))] transition-colors"
            >
              <div className="w-5 h-5 flex items-center justify-center text-sm">G</div>
              <span>Войти через Google</span>
            </button>
            {error && <p className="text-xs text-[hsl(var(--destructive))] text-center">{error}</p>}
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] text-center mt-2 font-mono-cipher">
              Все сообщения защищены E2E-шифрованием
            </p>
          </div>
        )}

        {step === "phone_enter" && (
          <div className="flex flex-col gap-3 animate-fade-up" style={{ opacity: 0, animationFillMode: 'forwards' }}>
            <div>
              <label className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider font-mono-cipher">Номер телефона</label>
              <input
                className="w-full mt-2 px-4 py-3 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl text-sm outline-none focus:border-[hsl(var(--primary))] transition-colors"
                placeholder="+7 999 000-00-00"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendCode()}
                type="tel"
                autoFocus
              />
            </div>
            {error && <p className="text-xs text-[hsl(var(--destructive))]">{error}</p>}
            <button
              onClick={sendCode}
              disabled={loading || !phone.trim()}
              className="w-full px-4 py-3.5 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-2xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Отправка...' : 'Получить код'}
            </button>
            <button onClick={() => setStep("choose")} className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] text-center transition-colors">
              Назад
            </button>
          </div>
        )}

        {step === "phone_code" && (
          <div className="flex flex-col gap-3 animate-fade-up" style={{ opacity: 0, animationFillMode: 'forwards' }}>
            <div className="text-center mb-2">
              <p className="text-sm">Код отправлен на</p>
              <p className="font-semibold font-mono-cipher text-[hsl(var(--primary))]">{phone}</p>
              {demoCode && (
                <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 font-mono-cipher">
                  Демо-код: <span className="text-[hsl(var(--primary))]">{demoCode}</span>
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider font-mono-cipher">Ваше имя</label>
              <input
                className="w-full mt-2 px-4 py-3 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl text-sm outline-none focus:border-[hsl(var(--primary))] transition-colors"
                placeholder="Как вас зовут?"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider font-mono-cipher">Код из SMS</label>
              <input
                className="w-full mt-2 px-4 py-3 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl text-sm outline-none focus:border-[hsl(var(--primary))] transition-colors text-center tracking-widest text-lg font-mono-cipher"
                placeholder="0000"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onKeyDown={e => e.key === 'Enter' && verifyCode()}
                type="tel"
                maxLength={4}
                autoFocus
              />
            </div>
            {error && <p className="text-xs text-[hsl(var(--destructive))]">{error}</p>}
            <button
              onClick={verifyCode}
              disabled={loading || code.length < 4}
              className="w-full px-4 py-3.5 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-2xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Проверка...' : 'Войти'}
            </button>
            <button onClick={() => setStep("phone_enter")} className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] text-center transition-colors">
              Изменить номер
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chat View ────────────────────────────────────────────────────────────────

function ChatView({ chat, token, currentUser, onBack }: {
  chat: Chat;
  token: string;
  currentUser: User;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<number | null>(null);

  const loadMessages = useCallback(async () => {
    const res = await apiGet(CHATS_URL, `/messages?chat_id=${chat.id}`, token);
    if (res.messages) setMessages(res.messages);
    setLoading(false);
  }, [chat.id, token]);

  useEffect(() => {
    loadMessages();
    pollRef.current = window.setInterval(loadMessages, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await apiPost(CHATS_URL, '/send', { chat_id: chat.id, text }, token);
    loadMessages();
  }

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border))] glass flex-shrink-0">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-[hsl(var(--accent))] transition-colors">
          <Icon name="ChevronLeft" size={20} className="text-[hsl(var(--primary))]" />
        </button>
        <Avatar name={chat.name} url={chat.avatar_url} online={chat.other_online} size="sm" />
        <div className="flex-1">
          <div className="font-semibold text-sm">{chat.name}</div>
          <div className="flex items-center gap-1">
            <EncryptBadge />
            {chat.other_online && <span className="text-[10px] text-[hsl(var(--primary))]">в сети</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-[hsl(var(--muted-foreground))] font-mono-cipher flex-shrink-0">
        <Icon name="ShieldCheck" size={10} className="text-[hsl(var(--primary))]" />
        Сообщения защищены end-to-end шифрованием
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-2">
        {loading && (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 py-12">
            <Icon name="MessageCircle" size={36} className="text-[hsl(var(--muted-foreground))] opacity-30" />
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Начните переписку</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.out ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[72%] px-3.5 py-2.5 text-sm ${msg.out ? "message-bubble-out" : "message-bubble-in"}`}>
              <p className="leading-relaxed">{msg.text}</p>
              <div className={`flex items-center gap-1 mt-1 ${msg.out ? "justify-end" : "justify-start"}`}>
                <span className="text-[9px] opacity-60 font-mono-cipher">{formatTime(msg.created_at)}</span>
                {msg.out && <Icon name={msg.is_read ? "CheckCheck" : "Check"} size={10} className={msg.is_read ? "opacity-90" : "opacity-50"} />}
                <Icon name="Lock" size={8} className="opacity-40" />
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-[hsl(var(--border))] glass flex-shrink-0">
        <div className="flex items-center gap-2 bg-[hsl(var(--accent))] rounded-2xl px-4 py-2.5">
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]"
            placeholder="Сообщение..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
          />
          <button
            onClick={send}
            disabled={!input.trim()}
            className="w-8 h-8 rounded-xl bg-[hsl(var(--primary))] flex items-center justify-center text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <Icon name="Send" size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── New Chat Screen ──────────────────────────────────────────────────────────

function NewChatScreen({ token, onChatCreated, onBack }: {
  token: string;
  onChatCreated: (chatId: number) => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length < 2) { setUsers([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await apiGet(CHATS_URL, `/users/search?q=${encodeURIComponent(query)}`, token);
      setLoading(false);
      if (res.users) setUsers(res.users);
    }, 400);
    return () => clearTimeout(t);
  }, [query, token]);

  async function startChat(userId: number) {
    const res = await apiPost(CHATS_URL, '/create', { user_id: userId }, token);
    if (res.chat_id) onChatCreated(res.chat_id);
  }

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[hsl(var(--border))] flex-shrink-0">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-[hsl(var(--accent))] transition-colors">
          <Icon name="ChevronLeft" size={20} className="text-[hsl(var(--primary))]" />
        </button>
        <h2 className="font-bold">Новый чат</h2>
      </div>
      <div className="px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-3 bg-[hsl(var(--accent))] rounded-2xl px-4 py-2.5">
          <Icon name="Search" size={16} className="text-[hsl(var(--muted-foreground))]" />
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]"
            placeholder="Поиск по имени, телефону, email..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && query.length >= 2 && users.length === 0 && (
          <div className="flex flex-col items-center py-12 gap-2">
            <Icon name="UserX" size={36} className="text-[hsl(var(--muted-foreground))] opacity-30" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Пользователи не найдены</p>
          </div>
        )}
        {!loading && query.length < 2 && (
          <div className="flex flex-col items-center py-12 gap-2 px-8 text-center">
            <Icon name="Users" size={36} className="text-[hsl(var(--muted-foreground))] opacity-20" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Введите имя или номер телефона для поиска</p>
          </div>
        )}
        {users.map((u, i) => (
          <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[hsl(var(--accent))] cursor-pointer transition-colors animate-fade-up" style={{ animationDelay: `${i * 40}ms`, opacity: 0, animationFillMode: 'forwards' }} onClick={() => startChat(u.id)}>
            <Avatar name={u.name} url={u.avatar_url} online={u.is_online} />
            <div className="flex-1">
              <div className="font-medium text-sm">{u.name}</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))] font-mono-cipher">{u.phone || u.email || ''}</div>
            </div>
            <Icon name="MessageCircle" size={18} className="text-[hsl(var(--primary))]" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Settings Screen ──────────────────────────────────────────────────────────

function SettingsView({ user, token, onLogout }: { user: User; token: string; onLogout: () => void }) {
  async function logout() {
    await apiPost(AUTH_URL, '/logout', {}, token);
    localStorage.removeItem('cipher_token');
    onLogout();
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 pt-6 pb-8 flex flex-col items-center">
        <div className="relative mb-4">
          <Avatar name={user.name} url={user.avatar_url} size="lg" />
          <button className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center">
            <Icon name="Camera" size={13} className="text-[hsl(var(--primary-foreground))]" />
          </button>
        </div>
        <h2 className="text-xl font-bold">{user.name}</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5 font-mono-cipher">{user.phone || user.email || ''}</p>
        <div className="flex items-center gap-1.5 mt-2">
          <Icon name="ShieldCheck" size={13} className="text-[hsl(var(--primary))]" />
          <span className="text-xs text-[hsl(var(--primary))]">Аккаунт защищён E2E</span>
        </div>
      </div>

      <div className="px-4 flex flex-col gap-2 pb-6">
        <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-widest font-mono-cipher mb-1 px-1">Аккаунт</div>
        <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
          {[
            { icon: "Phone", label: "Телефон", value: user.phone || '—' },
            { icon: "Mail", label: "Email", value: user.email || '—' },
          ].map((item, i) => (
            <div key={i} className={`flex items-center gap-4 px-4 py-3.5 ${i === 0 ? 'border-b border-[hsl(var(--border))]' : ''}`}>
              <div className="w-9 h-9 rounded-xl bg-[hsl(var(--accent))] flex items-center justify-center">
                <Icon name={item.icon} size={16} className="text-[hsl(var(--primary))]" />
              </div>
              <div>
                <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider font-mono-cipher">{item.label}</div>
                <div className="text-sm font-medium mt-0.5">{item.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-widest font-mono-cipher mb-1 px-1 mt-2">Безопасность</div>
        <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
          <div className="flex items-center gap-4 px-4 py-3.5">
            <div className="w-9 h-9 rounded-xl bg-[hsl(var(--accent))] flex items-center justify-center">
              <Icon name="ShieldCheck" size={16} className="text-[hsl(var(--primary))]" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">End-to-end шифрование</div>
              <div className="text-xs text-[hsl(var(--primary))] font-mono-cipher">Активно</div>
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-4 px-4 py-3.5 bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] mt-2 hover:bg-[hsl(var(--accent))] transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-[hsl(var(--accent))] flex items-center justify-center">
            <Icon name="LogOut" size={16} className="text-[hsl(var(--destructive))]" />
          </div>
          <span className="text-sm font-medium text-[hsl(var(--destructive))]">Выйти из аккаунта</span>
        </button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string>("");
  const [screen, setScreen] = useState<Screen>("auth");
  const [tab, setTab] = useState<Tab>("chats");
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [loadingChats, setLoadingChats] = useState(false);
  const pollRef = useRef<number | null>(null);

  // Проверяем сохранённую сессию при старте
  useEffect(() => {
    const savedToken = localStorage.getItem('cipher_token');
    if (savedToken) {
      apiGet(AUTH_URL, '/me', savedToken).then(res => {
        if (res.id) {
          setUser(res);
          setToken(savedToken);
          setScreen("list");
        }
      });
    }
  }, []);

  const loadChats = useCallback(async (t: string) => {
    const res = await apiGet(CHATS_URL, '/list', t);
    if (res.chats) setChats(res.chats);
    setLoadingChats(false);
  }, []);

  useEffect(() => {
    if (screen === "list" && token) {
      setLoadingChats(true);
      loadChats(token);
      pollRef.current = window.setInterval(() => loadChats(token), 4000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [screen, token, loadChats]);

  function handleLogin(u: User, t: string) {
    setUser(u);
    setToken(t);
    setScreen("list");
  }

  function handleLogout() {
    setUser(null);
    setToken("");
    setChats([]);
    setActiveChat(null);
    setScreen("auth");
  }

  async function handleChatCreated(chatId: number) {
    await loadChats(token);
    const res = await apiGet(CHATS_URL, '/list', token);
    if (res.chats) {
      setChats(res.chats);
      const found = res.chats.find((c: Chat) => c.id === chatId);
      if (found) {
        setActiveChat(found);
        setScreen("chat");
      }
    }
  }

  const navItems: { id: Tab; icon: string; label: string }[] = [
    { id: "chats", icon: "MessageCircle", label: "Чаты" },
    { id: "search", icon: "Search", label: "Найти" },
    { id: "settings", icon: "User", label: "Профиль" },
  ];

  const totalUnread = chats.reduce((acc, c) => acc + (c.unread_count || 0), 0);

  if (screen === "auth") {
    return (
      <div className="flex h-screen w-full bg-[hsl(var(--background))] overflow-hidden">
        <div className="flex flex-col w-full h-full max-w-md mx-auto">
          <AuthScreen onLogin={handleLogin} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[hsl(var(--background))] overflow-hidden">
      <div className="flex flex-col w-full h-full max-w-md mx-auto relative">

        {/* Top bar */}
        {screen === "list" && (
          <div className="flex items-center justify-between px-6 pt-5 pb-3 glass border-b border-[hsl(var(--border))] flex-shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight">Cipher</span>
                <span className="text-[9px] font-mono-cipher text-[hsl(var(--primary))] border border-[hsl(var(--primary))] rounded px-1 py-0.5 opacity-70">E2E</span>
              </div>
              <div className="text-[10px] text-[hsl(var(--muted-foreground))] font-mono-cipher">
                {user?.name || ''}
              </div>
            </div>
            {tab === "chats" && (
              <button
                onClick={() => setScreen("new_chat")}
                className="w-9 h-9 rounded-xl bg-[hsl(var(--primary))] flex items-center justify-center hover:opacity-90 transition-opacity"
              >
                <Icon name="Plus" size={18} className="text-[hsl(var(--primary-foreground))]" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {screen === "chat" && activeChat && user && (
            <ChatView
              chat={activeChat}
              token={token}
              currentUser={user}
              onBack={() => { setScreen("list"); setActiveChat(null); loadChats(token); }}
            />
          )}

          {screen === "new_chat" && (
            <NewChatScreen
              token={token}
              onChatCreated={handleChatCreated}
              onBack={() => setScreen("list")}
            />
          )}

          {screen === "list" && (
            <div className="h-full overflow-y-auto">
              {tab === "chats" && (
                <div className="py-2">
                  {loadingChats && chats.length === 0 && (
                    <div className="flex justify-center py-12">
                      <div className="w-5 h-5 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {!loadingChats && chats.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 gap-4 px-8 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] flex items-center justify-center">
                        <Icon name="MessageCircle" size={28} className="text-[hsl(var(--muted-foreground))] opacity-40" />
                      </div>
                      <div>
                        <p className="font-medium">Нет чатов</p>
                        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Нажмите <span className="text-[hsl(var(--primary))]">+</span> чтобы начать переписку</p>
                      </div>
                    </div>
                  )}
                  {chats.map((chat, i) => (
                    <div
                      key={chat.id}
                      className="chat-item animate-fade-up"
                      style={{ animationDelay: `${i * 40}ms`, opacity: 0, animationFillMode: "forwards" }}
                      onClick={() => { setActiveChat(chat); setScreen("chat"); }}
                    >
                      <Avatar name={chat.name} url={chat.avatar_url} online={chat.other_online} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-medium text-sm truncate text-[hsl(var(--foreground))]">{chat.name}</span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-[10px] text-[hsl(var(--muted-foreground))] font-mono-cipher">{formatTime(chat.last_time)}</span>
                            {chat.unread_count > 0 && (
                              <span className="w-4 h-4 rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-[9px] flex items-center justify-center font-bold">
                                {chat.unread_count}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[hsl(var(--muted-foreground))] truncate">{chat.last_msg || 'Начните переписку'}</span>
                          <EncryptBadge />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === "search" && (
                <NewChatScreen token={token} onChatCreated={handleChatCreated} onBack={() => setTab("chats")} />
              )}

              {tab === "settings" && user && (
                <SettingsView user={user} token={token} onLogout={handleLogout} />
              )}
            </div>
          )}
        </div>

        {/* Bottom Nav */}
        {screen === "list" && (
          <div className="flex-shrink-0 glass border-t border-[hsl(var(--border))] px-2">
            <div className="flex items-center justify-around py-2">
              {navItems.map(item => (
                <button
                  key={item.id}
                  className={`nav-item relative ${tab === item.id ? "active" : ""}`}
                  onClick={() => setTab(item.id)}
                >
                  <div className="relative">
                    <Icon name={item.icon} size={22} />
                    {item.id === "chats" && totalUnread > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-[8px] flex items-center justify-center font-bold">
                        {totalUnread}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
