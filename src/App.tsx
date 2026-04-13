import { useState } from "react";
import Icon from "@/components/ui/icon";

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = "chats" | "contacts" | "statuses" | "search" | "profile" | "settings";
type Screen = "list" | "chat" | "hidden" | "archive";

interface Chat {
  id: number;
  name: string;
  avatar: string;
  lastMsg: string;
  time: string;
  unread?: number;
  online?: boolean;
  encrypted?: boolean;
  archived?: boolean;
  hidden?: boolean;
  pinned?: boolean;
}

interface Message {
  id: number;
  text: string;
  out: boolean;
  time: string;
  read?: boolean;
}

interface Contact {
  id: number;
  name: string;
  avatar: string;
  phone: string;
  online?: boolean;
}

interface Status {
  id: number;
  name: string;
  avatar: string;
  viewed: boolean;
  time: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const CHATS: Chat[] = [
  { id: 1, name: "Анна Соколова", avatar: "АС", lastMsg: "Окей, увидимся вечером!", time: "14:32", unread: 2, online: true, encrypted: true },
  { id: 2, name: "Команда продукта", avatar: "КП", lastMsg: "Дизайн согласован ✓", time: "13:18", encrypted: true, pinned: true },
  { id: 3, name: "Михаил Орлов", avatar: "МО", lastMsg: "Файл отправлен", time: "11:05", online: false, encrypted: true },
  { id: 4, name: "Дарья Лис", avatar: "ДЛ", lastMsg: "Спасибо за помощь!", time: "Вчера", unread: 1, encrypted: true },
  { id: 5, name: "Иван Петров", avatar: "ИП", lastMsg: "Позвоню позже", time: "Вчера", encrypted: true },
  { id: 6, name: "Сервис доставки", avatar: "СД", lastMsg: "Ваш заказ готов", time: "Пн", encrypted: true },
];

const ARCHIVED: Chat[] = [
  { id: 10, name: "Старый проект", avatar: "СП", lastMsg: "Архивирован", time: "Мар", archived: true, encrypted: true },
  { id: 11, name: "Конференция 2024", avatar: "К4", lastMsg: "До встречи!", time: "Фев", archived: true, encrypted: true },
];

const HIDDEN: Chat[] = [
  { id: 20, name: "Личное", avatar: "🔒", lastMsg: "Скрытый чат", time: "12:00", hidden: true, encrypted: true },
];

const MESSAGES: Message[] = [
  { id: 1, text: "Привет! Как дела?", out: false, time: "14:20" },
  { id: 2, text: "Отлично, спасибо! Готовимся к встрече", out: true, time: "14:21", read: true },
  { id: 3, text: "Ты уже посмотрел новый дизайн?", out: false, time: "14:25" },
  { id: 4, text: "Да, очень понравился! Минимализм — это то, что нужно", out: true, time: "14:27", read: true },
  { id: 5, text: "Согласна. Кстати, презентация в 18:00, не забудь", out: false, time: "14:30" },
  { id: 6, text: "Окей, увидимся вечером!", out: false, time: "14:32" },
];

const CONTACTS: Contact[] = [
  { id: 1, name: "Анна Соколова", avatar: "АС", phone: "+7 999 123-45-67", online: true },
  { id: 2, name: "Дарья Лис", avatar: "ДЛ", phone: "+7 999 234-56-78" },
  { id: 3, name: "Иван Петров", avatar: "ИП", phone: "+7 999 345-67-89", online: true },
  { id: 4, name: "Михаил Орлов", avatar: "МО", phone: "+7 999 456-78-90" },
  { id: 5, name: "Сергей Власов", avatar: "СВ", phone: "+7 999 567-89-01" },
];

const STATUSES: Status[] = [
  { id: 1, name: "Моё", avatar: "Я", viewed: false, time: "Сейчас" },
  { id: 2, name: "Анна Соколова", avatar: "АС", viewed: false, time: "5 мин назад" },
  { id: 3, name: "Иван Петров", avatar: "ИП", viewed: true, time: "1 час назад" },
  { id: 4, name: "Дарья Лис", avatar: "ДЛ", viewed: false, time: "2 часа назад" },
  { id: 5, name: "Михаил Орлов", avatar: "МО", viewed: true, time: "3 часа назад" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ initials, online, size = "md" }: { initials: string; online?: boolean; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-9 h-9 text-xs", md: "w-11 h-11 text-sm", lg: "w-16 h-16 text-xl" };
  return (
    <div className="relative flex-shrink-0">
      <div className={`${sizes[size]} rounded-full bg-gradient-to-br from-[hsl(158,40%,20%)] to-[hsl(158,30%,14%)] border border-[hsl(158,30%,22%)] flex items-center justify-center font-semibold text-[hsl(var(--primary))]`}>
        {initials}
      </div>
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

// ─── Views ────────────────────────────────────────────────────────────────────

function ChatList({ chats, onOpen, title }: { chats: Chat[]; onOpen: (c: Chat) => void; title?: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-2">
      {title && <div className="px-6 py-2 text-xs font-mono-cipher text-[hsl(var(--muted-foreground))] uppercase tracking-widest">{title}</div>}
      {chats.map((chat, i) => (
        <div
          key={chat.id}
          className="chat-item animate-fade-up"
          style={{ animationDelay: `${i * 40}ms`, opacity: 0, animationFillMode: "forwards" }}
          onClick={() => onOpen(chat)}
        >
          <Avatar initials={chat.avatar} online={chat.online} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex items-center gap-1.5">
                {chat.pinned && <Icon name="Pin" size={11} className="text-[hsl(var(--primary))] opacity-70" />}
                <span className="font-medium text-sm truncate text-[hsl(var(--foreground))]">{chat.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[hsl(var(--muted-foreground))] font-mono-cipher">{chat.time}</span>
                {chat.unread && (
                  <span className="w-4 h-4 rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-[9px] flex items-center justify-center font-bold">
                    {chat.unread}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[hsl(var(--muted-foreground))] truncate">{chat.lastMsg}</span>
              {chat.encrypted && <EncryptBadge />}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChatView({ chat, onBack }: { chat: Chat; onBack: () => void }) {
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Message[]>(MESSAGES);

  function send() {
    if (!input.trim()) return;
    setMsgs(prev => [...prev, { id: Date.now(), text: input.trim(), out: true, time: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }), read: false }]);
    setInput("");
  }

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border))] glass">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-[hsl(var(--accent))] transition-colors">
          <Icon name="ChevronLeft" size={20} className="text-[hsl(var(--primary))]" />
        </button>
        <Avatar initials={chat.avatar} online={chat.online} size="sm" />
        <div className="flex-1">
          <div className="font-semibold text-sm">{chat.name}</div>
          <div className="flex items-center gap-1">
            <EncryptBadge />
            {chat.online && <span className="text-[10px] text-[hsl(var(--primary))]">в сети</span>}
          </div>
        </div>
        <button className="p-1.5 rounded-lg hover:bg-[hsl(var(--accent))] transition-colors">
          <Icon name="Phone" size={18} className="text-[hsl(var(--muted-foreground))]" />
        </button>
        <button className="p-1.5 rounded-lg hover:bg-[hsl(var(--accent))] transition-colors">
          <Icon name="Video" size={18} className="text-[hsl(var(--muted-foreground))]" />
        </button>
      </div>

      <div className="flex items-center justify-center gap-1.5 py-2 text-[10px] text-[hsl(var(--muted-foreground))] font-mono-cipher">
        <Icon name="ShieldCheck" size={10} className="text-[hsl(var(--primary))]" />
        Сообщения зашифрованы end-to-end
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-2">
        {msgs.map((msg, i) => (
          <div key={msg.id} className={`flex ${msg.out ? "justify-end" : "justify-start"} animate-fade-up`} style={{ animationDelay: `${i * 30}ms`, opacity: 0, animationFillMode: "forwards" }}>
            <div className={`max-w-[72%] px-3.5 py-2.5 text-sm ${msg.out ? "message-bubble-out" : "message-bubble-in"}`}>
              <p className="leading-relaxed">{msg.text}</p>
              <div className={`flex items-center gap-1 mt-1 ${msg.out ? "justify-end" : "justify-start"}`}>
                <span className="text-[9px] opacity-60 font-mono-cipher">{msg.time}</span>
                {msg.out && <Icon name={msg.read ? "CheckCheck" : "Check"} size={10} className={msg.read ? "opacity-90" : "opacity-50"} />}
                <Icon name="Lock" size={8} className="opacity-40" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-[hsl(var(--border))] glass">
        <div className="flex items-center gap-2 bg-[hsl(var(--accent))] rounded-2xl px-4 py-2.5">
          <button className="p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
            <Icon name="Paperclip" size={18} />
          </button>
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]"
            placeholder="Сообщение..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
          />
          <button className="p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
            <Icon name="Smile" size={18} />
          </button>
          <button
            onClick={send}
            className="w-8 h-8 rounded-xl bg-[hsl(var(--primary))] flex items-center justify-center text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
          >
            <Icon name="Send" size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ContactsView() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4">
        <h2 className="text-xl font-bold">Контакты</h2>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{CONTACTS.length} контактов</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {CONTACTS.map((c, i) => (
          <div key={c.id} className="flex items-center gap-3 px-6 py-3 hover:bg-[hsl(var(--accent))] transition-colors cursor-pointer animate-fade-up" style={{ animationDelay: `${i * 50}ms`, opacity: 0, animationFillMode: "forwards" }}>
            <Avatar initials={c.avatar} online={c.online} />
            <div className="flex-1">
              <div className="font-medium text-sm">{c.name}</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))] font-mono-cipher">{c.phone}</div>
            </div>
            <div className="flex gap-1">
              <button className="p-2 rounded-lg hover:bg-[hsl(var(--surface-hover))] transition-colors">
                <Icon name="MessageCircle" size={16} className="text-[hsl(var(--primary))]" />
              </button>
              <button className="p-2 rounded-lg hover:bg-[hsl(var(--surface-hover))] transition-colors">
                <Icon name="Phone" size={16} className="text-[hsl(var(--muted-foreground))]" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusesView() {
  const [active, setActive] = useState<Status | null>(null);

  if (active) {
    return (
      <div className="flex flex-col h-full bg-black animate-fade-in relative">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-[hsl(var(--border))]">
          <div className="h-full bg-[hsl(var(--primary))] transition-all duration-300" style={{ width: "60%" }} />
        </div>
        <div className="flex items-center gap-3 px-4 pt-6 pb-4">
          <button onClick={() => setActive(null)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <Icon name="X" size={20} className="text-white" />
          </button>
          <Avatar initials={active.avatar} size="sm" />
          <div>
            <div className="font-medium text-sm text-white">{active.name}</div>
            <div className="text-[10px] text-white/50 font-mono-cipher">{active.time}</div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="text-center">
            <div className="text-6xl mb-4">🌿</div>
            <p className="text-white/80 text-lg font-medium">Статус активен</p>
            <p className="text-white/40 text-sm mt-1">Контент статуса здесь</p>
          </div>
        </div>
        <div className="px-4 py-6">
          <div className="flex items-center gap-2 bg-white/10 rounded-2xl px-4 py-2.5">
            <input className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/40 text-white" placeholder="Ответить..." />
            <Icon name="Send" size={16} className="text-white/60" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4">
        <h2 className="text-xl font-bold">Статусы</h2>
      </div>
      <div className="px-6 mb-6">
        <div className="flex gap-4 overflow-x-auto pb-2">
          {STATUSES.map((s, i) => (
            <button key={s.id} className="flex flex-col items-center gap-2 flex-shrink-0 animate-fade-up" style={{ animationDelay: `${i * 60}ms`, opacity: 0, animationFillMode: "forwards" }} onClick={() => setActive(s)}>
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-sm font-semibold relative ${!s.viewed ? "ring-2 ring-[hsl(var(--primary))] ring-offset-2 ring-offset-[hsl(var(--background))]" : "ring-2 ring-[hsl(var(--border))] ring-offset-2 ring-offset-[hsl(var(--background))]"} bg-gradient-to-br from-[hsl(158,40%,20%)] to-[hsl(158,30%,14%)] text-[hsl(var(--primary))]`}>
                {s.id === 1 ? "+" : s.avatar}
              </div>
              <span className="text-[10px] text-[hsl(var(--muted-foreground))] text-center max-w-[52px] truncate">{s.id === 1 ? "Мой статус" : s.name.split(" ")[0]}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="px-6">
        <div className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-widest font-mono-cipher mb-3">Недавние</div>
        {STATUSES.filter(s => s.id !== 1).map((s, i) => (
          <div key={s.id} className="flex items-center gap-3 py-3 border-b border-[hsl(var(--border))] cursor-pointer hover:opacity-80 transition-opacity animate-fade-up" style={{ animationDelay: `${i * 50}ms`, opacity: 0, animationFillMode: "forwards" }} onClick={() => setActive(s)}>
            <Avatar initials={s.avatar} size="sm" />
            <div>
              <div className="font-medium text-sm">{s.name}</div>
              <div className="text-[10px] text-[hsl(var(--muted-foreground))] font-mono-cipher">{s.time}</div>
            </div>
            {!s.viewed && <div className="ml-auto w-2 h-2 rounded-full bg-[hsl(var(--primary))]" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function SearchView() {
  const [query, setQuery] = useState("");
  const allItems = [...CHATS, ...CONTACTS.map(c => ({ ...c, lastMsg: c.phone, time: "", avatar: c.avatar, encrypted: false }))];
  const results = query ? allItems.filter(i => i.name.toLowerCase().includes(query.toLowerCase())) : [];

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-6 pb-4">
        <h2 className="text-xl font-bold mb-4">Поиск</h2>
        <div className="flex items-center gap-3 bg-[hsl(var(--accent))] rounded-2xl px-4 py-2.5">
          <Icon name="Search" size={16} className="text-[hsl(var(--muted-foreground))]" />
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]"
            placeholder="Поиск чатов, контактов..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button onClick={() => setQuery("")}>
              <Icon name="X" size={14} className="text-[hsl(var(--muted-foreground))]" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {!query && (
          <div className="px-6 pt-4">
            <div className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-widest font-mono-cipher mb-3">Недавние</div>
            {CHATS.slice(0, 3).map((c, i) => (
              <div key={c.id} className="flex items-center gap-3 py-2.5 cursor-pointer animate-fade-up" style={{ animationDelay: `${i * 50}ms`, opacity: 0, animationFillMode: "forwards" }}>
                <Avatar initials={c.avatar} online={c.online} size="sm" />
                <div>
                  <div className="font-medium text-sm">{c.name}</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">{c.lastMsg}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {query && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Icon name="SearchX" size={40} className="text-[hsl(var(--muted-foreground))] opacity-30" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Ничего не найдено</p>
          </div>
        )}
        {query && results.map((r, i) => (
          <div key={r.id} className="flex items-center gap-3 px-6 py-3 hover:bg-[hsl(var(--accent))] transition-colors cursor-pointer animate-fade-up" style={{ animationDelay: `${i * 40}ms`, opacity: 0, animationFillMode: "forwards" }}>
            <Avatar initials={r.avatar} size="sm" />
            <div>
              <div className="font-medium text-sm">{r.name}</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">{r.lastMsg}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileView() {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 pt-6 pb-8 flex flex-col items-center">
        <div className="relative mb-4">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[hsl(158,40%,20%)] to-[hsl(158,30%,14%)] border-2 border-[hsl(var(--primary))] flex items-center justify-center text-3xl font-bold text-[hsl(var(--primary))]">
            АИ
          </div>
          <button className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center">
            <Icon name="Camera" size={13} className="text-[hsl(var(--primary-foreground))]" />
          </button>
        </div>
        <h2 className="text-xl font-bold">Алексей Иванов</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5 font-mono-cipher">@alexivanov</p>
        <div className="flex items-center gap-1.5 mt-2">
          <Icon name="ShieldCheck" size={13} className="text-[hsl(var(--primary))]" />
          <span className="text-xs text-[hsl(var(--primary))]">Аккаунт защищён E2E</span>
        </div>
      </div>

      <div className="px-4 flex flex-col gap-2">
        {[
          { icon: "Phone", label: "Телефон", value: "+7 999 000-00-00" },
          { icon: "AtSign", label: "Юзернейм", value: "@alexivanov" },
          { icon: "Info", label: "О себе", value: "Ценю приватность 🔐" },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5 bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] animate-fade-up" style={{ animationDelay: `${i * 60}ms`, opacity: 0, animationFillMode: "forwards" }}>
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
    </div>
  );
}

interface SettingItem {
  icon: string;
  label: string;
  toggle: boolean;
  value?: boolean;
  set?: (v: boolean) => void;
  danger?: boolean;
}

function SettingsView() {
  const [notifications, setNotifications] = useState(true);
  const [biometric, setBiometric] = useState(true);
  const [hideOnline, setHideOnline] = useState(false);

  const sections: { title: string; items: SettingItem[] }[] = [
    {
      title: "Приватность",
      items: [
        { icon: "Bell", label: "Уведомления", toggle: true, value: notifications, set: setNotifications },
        { icon: "Fingerprint", label: "Биометрия", toggle: true, value: biometric, set: setBiometric },
        { icon: "EyeOff", label: "Скрыть статус «в сети»", toggle: true, value: hideOnline, set: setHideOnline },
      ],
    },
    {
      title: "Безопасность",
      items: [
        { icon: "Key", label: "Управление ключами E2E", toggle: false },
        { icon: "Lock", label: "Код-пароль", toggle: false },
        { icon: "Archive", label: "Архив чатов", toggle: false },
      ],
    },
    {
      title: "Аккаунт",
      items: [
        { icon: "UserCog", label: "Редактировать профиль", toggle: false },
        { icon: "HelpCircle", label: "Поддержка", toggle: false },
        { icon: "LogOut", label: "Выйти", toggle: false, danger: true },
      ],
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 pt-6 pb-4">
        <h2 className="text-xl font-bold">Настройки</h2>
      </div>
      <div className="px-4 flex flex-col gap-4 pb-6">
        {sections.map((section, si) => (
          <div key={si} className="animate-fade-up" style={{ animationDelay: `${si * 80}ms`, opacity: 0, animationFillMode: "forwards" }}>
            <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-widest font-mono-cipher mb-2 px-1">{section.title}</div>
            <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
              {section.items.map((item: SettingItem, ii) => (
                <div key={ii} className={`flex items-center gap-3 px-4 py-3.5 ${ii < section.items.length - 1 ? "border-b border-[hsl(var(--border))]" : ""} hover:bg-[hsl(var(--accent))] transition-colors cursor-pointer`}>
                  <div className="w-8 h-8 rounded-xl bg-[hsl(var(--accent))] flex items-center justify-center">
                    <Icon name={item.icon} size={15} className={item.danger ? "text-[hsl(var(--destructive))]" : "text-[hsl(var(--primary))]"} />
                  </div>
                  <span className={`flex-1 text-sm font-medium ${item.danger ? "text-[hsl(var(--destructive))]" : ""}`}>{item.label}</span>
                  {item.toggle ? (
                    <button
                      onClick={() => item.set(!item.value)}
                      className={`w-11 h-6 rounded-full transition-colors relative ${item.value ? "bg-[hsl(var(--primary))]" : "bg-[hsl(var(--border))]"}`}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${item.value ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                  ) : (
                    <Icon name="ChevronRight" size={16} className="text-[hsl(var(--muted-foreground))]" />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState<Tab>("chats");
  const [screen, setScreen] = useState<Screen>("list");
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [pinInput, setPinInput] = useState("");

  const navItems: { id: Tab; icon: string; label: string }[] = [
    { id: "chats", icon: "MessageCircle", label: "Чаты" },
    { id: "contacts", icon: "Users", label: "Контакты" },
    { id: "statuses", icon: "Circle", label: "Статусы" },
    { id: "search", icon: "Search", label: "Поиск" },
    { id: "settings", icon: "Settings", label: "Настройки" },
  ];

  function openChat(chat: Chat) {
    setActiveChat(chat);
    setScreen("chat");
  }

  function goBack() {
    setScreen("list");
    setActiveChat(null);
    setShowHidden(false);
  }

  const totalUnread = CHATS.reduce((acc, c) => acc + (c.unread || 0), 0);

  return (
    <div className="flex h-screen w-full bg-[hsl(var(--background))] overflow-hidden">
      <div className="flex flex-col w-full h-full max-w-md mx-auto relative">

        {screen === "list" && !activeChat && (
          <div className="flex items-center justify-between px-6 pt-5 pb-3 glass border-b border-[hsl(var(--border))] flex-shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight">Cipher</span>
                <span className="text-[9px] font-mono-cipher text-[hsl(var(--primary))] border border-[hsl(var(--primary))] rounded px-1 py-0.5 opacity-70">E2E</span>
              </div>
              <div className="text-[10px] text-[hsl(var(--muted-foreground))] font-mono-cipher">Защищённый мессенджер</div>
            </div>
            <button className="w-9 h-9 rounded-xl bg-[hsl(var(--accent))] flex items-center justify-center hover:bg-[hsl(var(--border))] transition-colors" onClick={() => setTab("profile")}>
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[hsl(158,40%,20%)] to-[hsl(158,30%,14%)] flex items-center justify-center text-[9px] font-bold text-[hsl(var(--primary))]">АИ</div>
            </button>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          {screen === "chat" && activeChat && (
            <ChatView chat={activeChat} onBack={goBack} />
          )}

          {screen === "hidden" && !showHidden && (
            <div className="flex flex-col items-center justify-center h-full gap-6 px-8 animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] flex items-center justify-center">
                <Icon name="Lock" size={28} className="text-[hsl(var(--primary))]" />
              </div>
              <div className="text-center">
                <h3 className="font-bold text-lg">Скрытые чаты</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Введите PIN для доступа</p>
              </div>
              <div className="flex gap-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className={`w-3 h-3 rounded-full transition-colors ${pinInput.length >= i ? "bg-[hsl(var(--primary))]" : "bg-[hsl(var(--border))]"}`} />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3 w-56">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((n, i) => (
                  <button
                    key={i}
                    className={`h-14 rounded-2xl text-lg font-medium transition-all ${n === "" ? "invisible" : "bg-[hsl(var(--card))] border border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))] active:scale-95"}`}
                    onClick={() => {
                      if (n === "⌫") setPinInput(p => p.slice(0, -1));
                      else if (n !== "" && pinInput.length < 4) {
                        const next = pinInput + n;
                        setPinInput(next);
                        if (next.length === 4) { setShowHidden(true); setPinInput(""); }
                      }
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button onClick={goBack} className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">Отмена</button>
            </div>
          )}

          {screen === "hidden" && showHidden && (
            <div className="flex flex-col h-full animate-fade-in">
              <div className="flex items-center gap-3 px-4 py-4 border-b border-[hsl(var(--border))]">
                <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-[hsl(var(--accent))] transition-colors">
                  <Icon name="ChevronLeft" size={20} className="text-[hsl(var(--primary))]" />
                </button>
                <Icon name="Lock" size={16} className="text-[hsl(var(--primary))]" />
                <h2 className="font-bold">Скрытые чаты</h2>
              </div>
              <div className="flex-1 overflow-y-auto">
                <ChatList chats={HIDDEN} onOpen={openChat} />
              </div>
            </div>
          )}

          {screen === "list" && (
            <div className="h-full overflow-y-auto">
              {tab === "chats" && (
                <div>
                  <ChatList chats={CHATS.filter(c => !c.archived)} onOpen={openChat} />
                  <div className="px-4 py-2 flex flex-col gap-2">
                    <button
                      onClick={() => setScreen("hidden")}
                      className="shine-line flex items-center gap-3 px-4 py-3 rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] transition-colors"
                    >
                      <div className="w-9 h-9 rounded-xl bg-[hsl(var(--accent))] flex items-center justify-center">
                        <Icon name="EyeOff" size={16} className="text-[hsl(var(--primary))]" />
                      </div>
                      <span className="text-sm font-medium">Скрытые чаты</span>
                      <Icon name="ChevronRight" size={14} className="ml-auto text-[hsl(var(--muted-foreground))]" />
                    </button>
                    <button
                      onClick={() => setScreen("archive")}
                      className="shine-line flex items-center gap-3 px-4 py-3 rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] transition-colors"
                    >
                      <div className="w-9 h-9 rounded-xl bg-[hsl(var(--accent))] flex items-center justify-center">
                        <Icon name="Archive" size={16} className="text-[hsl(var(--primary))]" />
                      </div>
                      <span className="text-sm font-medium">Архив</span>
                      <span className="ml-auto text-[10px] font-mono-cipher text-[hsl(var(--muted-foreground))]">{ARCHIVED.length}</span>
                      <Icon name="ChevronRight" size={14} className="text-[hsl(var(--muted-foreground))]" />
                    </button>
                  </div>
                </div>
              )}
              {tab === "contacts" && <ContactsView />}
              {tab === "statuses" && <StatusesView />}
              {tab === "search" && <SearchView />}
              {tab === "profile" && <ProfileView />}
              {tab === "settings" && <SettingsView />}
            </div>
          )}

          {screen === "archive" && (
            <div className="flex flex-col h-full animate-fade-in">
              <div className="flex items-center gap-3 px-4 py-4 border-b border-[hsl(var(--border))]">
                <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-[hsl(var(--accent))] transition-colors">
                  <Icon name="ChevronLeft" size={20} className="text-[hsl(var(--primary))]" />
                </button>
                <Icon name="Archive" size={16} className="text-[hsl(var(--primary))]" />
                <h2 className="font-bold">Архив</h2>
              </div>
              <div className="flex-1 overflow-y-auto">
                <ChatList chats={ARCHIVED} onOpen={openChat} />
              </div>
            </div>
          )}
        </div>

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