import { Navigate, Route, Routes } from "react-router-dom";
import LandingPage from "./pages/shared/LandingPage";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import VerifyOtpPage from "./pages/auth/VerifyOtpPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AnalyticsPage from "./pages/admin/AnalyticsPage";
import AIInsightsPage from "./pages/admin/AIInsightsPage";
import BusManagementPage from "./pages/admin/BusManagementPage";
import DriverManagementPage from "./pages/admin/DriverManagementPage";
import FleetMonitoringPage from "./pages/admin/FleetMonitoringPage";
import ReservationManagementPage from "./pages/admin/ReservationManagementPage";
import ScheduleManagementPage from "./pages/admin/ScheduleManagementPage";
import UserManagementPage from "./pages/admin/UserManagementPage";
import DriverDashboard from "./pages/driver/DriverDashboard";
import BusConditionPage from "./pages/driver/BusConditionPage";
import DelayReportPage from "./pages/driver/DelayReportPage";
import DriverTripsPage from "./pages/driver/DriverTripsPage";
import EmergencyPage from "./pages/driver/EmergencyPage";
import LiveTripPage from "./pages/driver/LiveTripPage";
import PassengerListPage from "./pages/driver/PassengerListPage";
import QRScannerPage from "./pages/driver/QRScannerPage";
import StaffDashboard from "./pages/staff/StaffDashboard";
import StudentDashboard from "./pages/student/StudentDashboard";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import BusDetailsPage from "./pages/shared/BusDetailsPage";
import NotificationsPage from "./pages/shared/NotificationsPage";
import LiveTrackingPage from "./pages/shared/LiveTrackingPage";
import SafarAIPage from "./pages/shared/SafarAIPage";
import PlaceholderPage from "./pages/shared/PlaceholderPage";
import ProfilePage from "./pages/shared/ProfilePage";
import ReservationFlowPage from "./pages/shared/ReservationFlowPage";
import ReservationsPage from "./pages/shared/ReservationsPage";
import RouteExplorerPage from "./pages/shared/RouteExplorerPage";
import TicketDetailsPage from "./pages/shared/TicketDetailsPage";
import TicketsPage from "./pages/shared/TicketsPage";
import TodayBusesPage from "./pages/shared/TodayBusesPage";
import SettingsPage from "./pages/shared/SettingsPage";
import ProtectedRoute from "./routes/ProtectedRoute";
import RoleBasedRoute from "./routes/RoleBasedRoute";
import { ROLES } from "./utils/roles";
import { DriverLiveTrackingLayout } from "./context/DriverLiveTrackingContext";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-otp" element={<VerifyOtpPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<RoleBasedRoute allowedRoles={[ROLES.STUDENT]} />}>
          <Route path="/student/dashboard" element={<StudentDashboard />} />
          <Route path="/student/available-buses" element={<TodayBusesPage role={ROLES.STUDENT} />} />
          <Route path="/student/today-buses" element={<Navigate to="/student/available-buses" replace />} />
          <Route path="/student/buses/:id" element={<BusDetailsPage role={ROLES.STUDENT} />} />
          <Route path="/student/routes" element={<RouteExplorerPage role={ROLES.STUDENT} />} />
          <Route path="/student/reservations" element={<Navigate to="/student/available-buses?tab=reservations" replace />} />
          <Route path="/student/reservations/new" element={<ReservationFlowPage role={ROLES.STUDENT} />} />
          <Route path="/student/tickets" element={<TicketsPage role={ROLES.STUDENT} />} />
          <Route path="/student/tickets/:ticketId" element={<TicketDetailsPage role={ROLES.STUDENT} />} />
          <Route path="/student/notifications" element={<NotificationsPage role={ROLES.STUDENT} />} />
          <Route path="/student/profile" element={<ProfilePage role={ROLES.STUDENT} />} />
          <Route path="/student/settings" element={<SettingsPage />} />
          <Route path="/student/tracking" element={<LiveTrackingPage role={ROLES.STUDENT} />} />
          <Route path="/student/ai" element={<SafarAIPage />} />
          <Route path="/student/:section" element={<PlaceholderPage />} />
        </Route>
        <Route element={<RoleBasedRoute allowedRoles={[ROLES.TEACHER]} />}>
          <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
          <Route path="/teacher/available-buses" element={<TodayBusesPage role={ROLES.TEACHER} />} />
          <Route path="/teacher/today-buses" element={<Navigate to="/teacher/available-buses" replace />} />
          <Route path="/teacher/buses/:id" element={<BusDetailsPage role={ROLES.TEACHER} />} />
          <Route path="/teacher/routes" element={<RouteExplorerPage role={ROLES.TEACHER} />} />
          <Route path="/teacher/reservations" element={<Navigate to="/teacher/available-buses?tab=reservations" replace />} />
          <Route path="/teacher/reservations/new" element={<ReservationFlowPage role={ROLES.TEACHER} />} />
          <Route path="/teacher/tickets" element={<TicketsPage role={ROLES.TEACHER} />} />
          <Route path="/teacher/tickets/:ticketId" element={<TicketDetailsPage role={ROLES.TEACHER} />} />
          <Route path="/teacher/notifications" element={<NotificationsPage role={ROLES.TEACHER} />} />
          <Route path="/teacher/profile" element={<ProfilePage role={ROLES.TEACHER} />} />
          <Route path="/teacher/settings" element={<SettingsPage />} />
          <Route path="/teacher/tracking" element={<LiveTrackingPage role={ROLES.TEACHER} />} />
          <Route path="/teacher/ai" element={<SafarAIPage />} />
          <Route path="/teacher/:section" element={<PlaceholderPage />} />
        </Route>
        <Route element={<RoleBasedRoute allowedRoles={[ROLES.STAFF]} />}>
          <Route path="/staff/dashboard" element={<StaffDashboard />} />
          <Route path="/staff/available-buses" element={<TodayBusesPage role={ROLES.STAFF} />} />
          <Route path="/staff/today-buses" element={<Navigate to="/staff/available-buses" replace />} />
          <Route path="/staff/buses/:id" element={<BusDetailsPage role={ROLES.STAFF} />} />
          <Route path="/staff/routes" element={<RouteExplorerPage role={ROLES.STAFF} />} />
          <Route path="/staff/reservations" element={<Navigate to="/staff/available-buses?tab=reservations" replace />} />
          <Route path="/staff/reservations/new" element={<ReservationFlowPage role={ROLES.STAFF} />} />
          <Route path="/staff/tickets" element={<TicketsPage role={ROLES.STAFF} />} />
          <Route path="/staff/tickets/:ticketId" element={<TicketDetailsPage role={ROLES.STAFF} />} />
          <Route path="/staff/notifications" element={<NotificationsPage role={ROLES.STAFF} />} />
          <Route path="/staff/profile" element={<ProfilePage role={ROLES.STAFF} />} />
          <Route path="/staff/settings" element={<SettingsPage />} />
          <Route path="/staff/tracking" element={<LiveTrackingPage role={ROLES.STAFF} />} />
          <Route path="/staff/ai" element={<SafarAIPage />} />
          <Route path="/staff/:section" element={<PlaceholderPage />} />
        </Route>
        <Route element={<RoleBasedRoute allowedRoles={[ROLES.DRIVER]} />}>
          <Route element={<DriverLiveTrackingLayout />}>
            <Route path="/driver/dashboard" element={<DriverDashboard />} />
            <Route path="/driver/trips" element={<DriverTripsPage />} />
            <Route path="/driver/passengers" element={<PassengerListPage />} />
            <Route path="/driver/scanner" element={<QRScannerPage />} />
            <Route path="/driver/bus-condition" element={<BusConditionPage />} />
            <Route path="/driver/delay" element={<DelayReportPage />} />
            <Route path="/driver/emergency" element={<EmergencyPage />} />
            <Route path="/driver/live-trip" element={<LiveTripPage />} />
            <Route path="/driver/profile" element={<ProfilePage role={ROLES.DRIVER} />} />
            <Route path="/driver/:section" element={<PlaceholderPage />} />
          </Route>
        </Route>
        <Route element={<RoleBasedRoute allowedRoles={[ROLES.ADMIN]} />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/buses" element={<BusManagementPage />} />
          <Route path="/admin/schedules" element={<ScheduleManagementPage />} />
          <Route path="/admin/reservations" element={<ReservationManagementPage />} />
          <Route path="/admin/users" element={<UserManagementPage />} />
          <Route path="/admin/drivers" element={<DriverManagementPage />} />
          <Route path="/admin/fleet" element={<FleetMonitoringPage />} />
          <Route path="/admin/analytics" element={<AnalyticsPage />} />
          <Route path="/admin/ai-insights" element={<AIInsightsPage />} />
          <Route path="/admin/notifications" element={<NotificationsPage role={ROLES.ADMIN} />} />
          <Route path="/admin/settings" element={<SettingsPage />} />
          <Route path="/admin/:section" element={<PlaceholderPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
