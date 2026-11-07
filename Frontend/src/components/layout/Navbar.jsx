import { Bell, Menu, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Badge from "../common/Badge";
import ThemeToggle from "../common/ThemeToggle";
import { subscribeToNotifications } from "../../services/notificationService";

export default function Navbar({ user, onMenu }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const initials = user.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  useEffect(() => subscribeToNotifications(
    { userId: user.id, role: user.role },
    (items) => setUnreadCount(items.filter((item) => item.unread).length)
  ), [user.id, user.role]);

  return (
    <header className="sticky top-0 z-30 mb-6 bg-white/70 px-4 py-3 backdrop-blur-3xl border-b border-white/40 shadow-sm dark:bg-slate-900/70 dark:border-slate-800/50 lg:px-8 transition-colors duration-300">
      <div className="flex items-center gap-4">
        <button className="focus-ring icon-button rounded-full lg:hidden" onClick={onMenu} aria-label="Open navigation">
          <Menu className="h-5 w-5" />
        </button>
        <div className="relative hidden min-w-0 flex-1 sm:block max-w-md">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-safar-gray" />
          <input
            className="focus-ring h-11 w-full rounded-full border border-slate-200 bg-slate-50/50 pl-11 pr-4 text-sm text-safar-ink shadow-inner transition hover:border-safar-teal/40 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:focus:bg-slate-800 dark:hover:border-safar-teal/40"
            placeholder="Search buses, routes, tickets..."
          />
        </div>
        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          <div className="hidden sm:block">
            <Badge tone="info">{user.roleLabel}</Badge>
          </div>
          <ThemeToggle compact />
          <Link className="focus-ring icon-button rounded-full relative" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} to={`/${user.role}/notifications`}>
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand-crimson px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900 shadow-sm animate-pulse">{unreadCount > 9 ? "9+" : unreadCount}</span>}
          </Link>
          <Link to={`/${user.role}/profile`} title={`View Profile (${user.name})`}>
            {user.profileImage ? (
              <img
                src={user.profileImage}
                alt={user.name}
                className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-safar-teal/40 shadow-md cursor-pointer hover:shadow-glow transition duration-300 transform hover:scale-105"
              />
            ) : (
              <div
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-maroon via-brand-purple to-brand-cyan text-sm font-bold text-white shadow-md cursor-pointer hover:shadow-glow transition duration-300 transform hover:scale-105"
              >
                {initials || "JU"}
              </div>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
