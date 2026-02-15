import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import Leaderboard from './pages/Leaderboard';
import MobileDashboard from './pages/MobileDashboard';
import NotificationSettings from './pages/NotificationSettings';
import SiteAnalytics from './pages/SiteAnalytics';
import EmailReportSettings from './pages/EmailReportSettings';
import LoginShadcn from './pages/LoginShadcn';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import TankLevels from './pages/TankLevels';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import CompanyManagement from './pages/admin/CompanyManagement';
import RoleManagementInfo from './pages/admin/RoleManagementInfo';
import RoleTabSettings from './pages/admin/RoleTabSettings';
import TankConfiguration from './pages/admin/TankConfiguration';
import EloraAI from './pages/EloraAI';
import VehicleDetail from './pages/VehicleDetail';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Home": Home,
    "Leaderboard": Leaderboard,
    "MobileDashboard": MobileDashboard,
    "NotificationSettings": NotificationSettings,
    "SiteAnalytics": SiteAnalytics,
    "EmailReportSettings": EmailReportSettings,
    "Login": LoginShadcn,
    "Profile": Profile,
    "Settings": Settings,
    "TankLevels": TankLevels,
    "admin": AdminDashboard,
    "admin/users": UserManagement,
    "admin/companies": CompanyManagement,
    "admin/role-management": RoleManagementInfo,
    "admin/tab-visibility": RoleTabSettings,
    "admin/tank-configuration": TankConfiguration,
    "EloraAI": EloraAI,
    "VehicleDetail": VehicleDetail,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};