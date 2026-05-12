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
import ReportSchedules from './pages/ReportSchedules';
import StockOrders from './pages/StockOrders';
import VehicleImageLog from './pages/VehicleImageLog';
import VehicleImageLogVehiclePage from './pages/VehicleImageLogVehiclePage';
import Alerts from './pages/Alerts';
// Marketplace (M1)
import MarketplaceCatalog from './pages/marketplace/MarketplaceCatalog';
import MarketplaceProductDetail from './pages/marketplace/MarketplaceProductDetail';
import MarketplaceCart from './pages/marketplace/MarketplaceCart';
import MarketplaceAdminDashboard from './pages/admin/marketplace/MarketplaceAdminDashboard';
import MarketplaceCompanies from './pages/admin/marketplace/MarketplaceCompanies';
import MarketplaceWarehouses from './pages/admin/marketplace/MarketplaceWarehouses';
import MarketplaceProducts from './pages/admin/marketplace/MarketplaceProducts';
import MarketplaceProductEditor from './pages/admin/marketplace/MarketplaceProductEditor';
import MarketplaceCompanyPricing from './pages/admin/marketplace/MarketplaceCompanyPricing';
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
    "ReportSchedules": ReportSchedules,
    "StockOrders": StockOrders,
    "VehicleImageLog": VehicleImageLog,
    "VehicleImageLogVehicle": VehicleImageLogVehiclePage,
    "Alerts": Alerts,
    // Marketplace (M1)
    "MarketplaceCatalog": MarketplaceCatalog,
    "MarketplaceProductDetail": MarketplaceProductDetail,
    "MarketplaceCart": MarketplaceCart,
    "admin/marketplace": MarketplaceAdminDashboard,
    "admin/marketplace/companies": MarketplaceCompanies,
    "admin/marketplace/warehouses": MarketplaceWarehouses,
    "admin/marketplace/products": MarketplaceProducts,
    "admin/marketplace/product-editor": MarketplaceProductEditor,
    "admin/marketplace/pricing": MarketplaceCompanyPricing,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};