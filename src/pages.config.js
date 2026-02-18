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
import SMSAlerts from './pages/SMSAlerts';
import WashoutDashboard from './pages/washout-compliance/WashoutDashboard';
import WESScoring from './pages/washout-compliance/WESScoring';
import DedaggingRisk from './pages/washout-compliance/DedaggingRisk';
import SensorData from './pages/washout-compliance/SensorData';
import Economics from './pages/washout-compliance/Economics';
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
    "SMSAlerts": SMSAlerts,
    "WashoutDashboard": WashoutDashboard,
    "WESScoring": WESScoring,
    "DedaggingRisk": DedaggingRisk,
    "SensorData": SensorData,
    "Economics": Economics,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};