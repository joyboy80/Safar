import {
  Activity,
  Bell,
  Bot,
  Bus,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  Gauge,
  LayoutDashboard,
  Map,
  MapPinned,
  QrCode,
  Settings,
  ShieldCheck,
  Ticket,
  User,
  Users,
  Zap,
} from "lucide-react";
import { ROLES } from "./roles";

const sharedCampusNav = [
  { label: "Dashboard", path: "dashboard", icon: LayoutDashboard },
  { label: "Available Buses", path: "available-buses", icon: Bus },
  { label: "Routes", path: "routes", icon: Map },
  { label: "My Tickets", path: "tickets", icon: Ticket },
  { label: "Live Tracking", path: "tracking", icon: MapPinned },
  { label: "Notifications", path: "notifications", icon: Bell },
  { label: "Safar AI", path: "ai", icon: Bot },
  { label: "Profile", path: "profile", icon: User },
  { label: "Settings", path: "settings", icon: Settings },
];

export const navigationByRole = {
  [ROLES.STUDENT]: sharedCampusNav,
  [ROLES.TEACHER]: sharedCampusNav,
  [ROLES.STAFF]: sharedCampusNav,
  [ROLES.DRIVER]: [
    { label: "Dashboard", path: "dashboard", icon: LayoutDashboard },
    { label: "Today's Trips", path: "trips", icon: CalendarDays },
    { label: "Passenger List", path: "passengers", icon: Users },
    { label: "QR Scanner", path: "scanner", icon: QrCode },
    { label: "Live Trip", path: "live-trip", icon: MapPinned },
    { label: "Bus Condition", path: "bus-condition", icon: Gauge },
    { label: "Emergency", path: "emergency", icon: Zap },
    { label: "Profile", path: "profile", icon: User },
  ],
  [ROLES.ADMIN]: [
    { label: "Dashboard", path: "dashboard", icon: LayoutDashboard },
    { label: "Live Fleet", path: "fleet", icon: Activity },
    { label: "Buses", path: "buses", icon: Bus },
    { label: "Schedules", path: "schedules", icon: CalendarDays },
    { label: "Reservations", path: "reservations", icon: ClipboardList },
    { label: "Users", path: "users", icon: Users },
    { label: "Drivers", path: "drivers", icon: ShieldCheck },
    { label: "Analytics", path: "analytics", icon: ChartNoAxesCombined },
    { label: "AI Insights", path: "ai-insights", icon: Bot },
    { label: "Notifications", path: "notifications", icon: Bell },
    { label: "Settings", path: "settings", icon: Settings },
  ],
};

export function getNavigationForRole(role) {
  return navigationByRole[role] || [];
}
