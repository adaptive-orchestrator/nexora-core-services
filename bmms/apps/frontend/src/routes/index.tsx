import About from '@/pages/About';
import LandingPage from '@/pages/LandingPage';
import Login from '@/pages/Login';
import NotFound from '@/pages/NotFound';
import PasswordRecovery from '@/pages/PasswordRecovery';
import Profile from '@/pages/Profile';
import ResetPassword from '@/pages/ResetPassword';
import Settings from '@/pages/Settings';
import Signup from '@/pages/Signup';
import TaskDashboard from '@/pages/TaskDashboard';
import { Route, Routes } from 'react-router-dom';
// import { Navigate } from 'react-router-dom';

export default function AppRoutes() {
    const baseURL = import.meta.env.BASE_URL;

    return (
        <Routes>
            <Route path={`${baseURL}`} element={<LandingPage />} />
            <Route path={`${baseURL}login`} element={<Login />} />
            <Route path={`${baseURL}signup`} element={<Signup />} />
            <Route path={`${baseURL}password-recovery`} element={<PasswordRecovery />} />
            <Route path={`${baseURL}reset-password`} element={<ResetPassword />} />
            <Route path={`${baseURL}tasks`} element={<TaskDashboard />} />
            <Route path={`${baseURL}profile`} element={<Profile />} />
            <Route path={`${baseURL}settings`} element={<Settings />} />
            <Route path={`${baseURL}about`} element={<About />} />
            <Route path={`${baseURL}*`} element={<NotFound />} />
        </Routes>
    );
}
