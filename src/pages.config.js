import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import Leaderboard from './pages/Leaderboard';
import MobileDashboard from './pages/MobileDashboard';
import NotificationSettings from './pages/NotificationSettings';
import SiteAnalytics from './pages/SiteAnalytics';
import EmailReportSettings from './pages/EmailReportSettings';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import CompanyManagement from './pages/admin/CompanyManagement';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Home": Home,
    "Leaderboard": Leaderboard,
    "MobileDashboard": MobileDashboard,
    "NotificationSettings": NotificationSettings,
    "SiteAnalytics": SiteAnalytics,
    "EmailReportSettings": EmailReportSettings,
    "Login": Login,
    "Profile": Profile,
    "Settings": Settings,
    "admin": AdminDashboard,
    "admin/users": UserManagement,
    "admin/companies": CompanyManagement,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};