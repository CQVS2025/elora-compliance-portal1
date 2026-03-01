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
import ProductsManagement from './pages/admin/ProductsManagement';
import PartsCatalogManagement from './pages/admin/PartsCatalogManagement';
import OperationsLogCategoriesManagement from './pages/admin/OperationsLogCategoriesManagement';
import EloraAI from './pages/EloraAI';
import VehicleDetail from './pages/VehicleDetail';
import SMSAlerts from './pages/SMSAlerts';
import OperationsLog from './pages/OperationsLog';
import OperationsLogEntryPage from './pages/OperationsLogEntryPage';
import OperationsLogAttachmentPage from './pages/OperationsLogAttachmentPage';
import DeliveryCalendar from './pages/DeliveryCalendar';
import StockOrders from './pages/StockOrders';
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
    "admin/products": ProductsManagement,
    "admin/parts": PartsCatalogManagement,
    "admin/operations-log-categories": OperationsLogCategoriesManagement,
    "EloraAI": EloraAI,
    "VehicleDetail": VehicleDetail,
    "SMSAlerts": SMSAlerts,
    "OperationsLog": OperationsLog,
    "OperationsLogEntry": OperationsLogEntryPage,
    "OperationsLogAttachment": OperationsLogAttachmentPage,
    "DeliveryCalendar": DeliveryCalendar,
    "StockOrders": StockOrders,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};