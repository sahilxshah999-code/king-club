import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Login } from './pages/Auth/Login';
import { Register } from './pages/Auth/Register';
import { ForgotPassword } from './pages/Auth/ForgotPassword';
import { Home } from './pages/Home';
import { Wallet } from './pages/Wallet';
import { Aviator } from './pages/Games/Aviator';
import { Wingo } from './pages/Games/Wingo';
import { Spin } from './pages/Games/Spin';
import { Roulette } from './pages/Games/Roulette';
import { DragonTiger } from './pages/Games/DragonTiger';
import { Mines } from './pages/Games/Mines';
import { ChickenRoad } from './pages/Games/ChickenRoad';
import { Plinko } from './pages/Games/Plinko';
import { DragonTower } from './pages/Games/DragonTower';
import { CoinFlip } from './pages/Games/CoinFlip';
import { Keno } from './pages/Games/Keno';
import { Dice } from './pages/Games/Dice';
import { Admin } from './pages/Admin';
import { Vip } from './pages/Vip';
import { Activity } from './pages/Activity';
import { Notifications } from './pages/Notifications';
import { Leaderboard } from './pages/Leaderboard';
import { Layout } from './components/Layout';
import { NotificationSystem } from './components/NotificationSystem';
import { Smartphone } from 'lucide-react';
import { initDemoData } from './services/userService';

const ProtectedRoute = ({ children }: { children?: React.ReactNode }) => {
    return <Layout>{children}</Layout>;
};

const GameLayout = ({ children }: { children?: React.ReactNode }) => {
    return <div className="w-full max-w-md mx-auto">{children}</div>;
};

// Component to conditionally enforce portrait mode
const OrientationGuard = () => {
    const location = useLocation();
    // Paths where landscape is allowed
    const allowedPaths = [
        '/', 
        '/login', 
        '/register', 
        '/forgot-password',
        '/game/aviator', 
        '/game/dragontiger',
        '/game/mines',
        '/game/chickenroad',
        '/game/plinko',
        '/game/dragontower',
        '/game/coinflip',
        '/game/keno',
        '/game/dice',
        '/wallet',
        '/profile',
        '/notifications',
        '/admin',
        '/leaderboard',
        '/activity'
    ];
    
    if (allowedPaths.includes(location.pathname)) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-black text-white hidden landscape:flex flex-col items-center justify-center text-center p-6">
            <Smartphone size={64} className="mb-4 animate-pulse text-[#d93025]" />
            <h2 className="text-2xl font-bold mb-2">Please Rotate Your Device</h2>
            <p className="text-gray-400">This game is designed for portrait mode only for the best experience.</p>
        </div>
    );
};

const App = () => {
  React.useEffect(() => {
      initDemoData();
  }, []);

  return (
    <HashRouter>
        <OrientationGuard />
        <NotificationSystem />
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            
            <Route path="/" element={
                <ProtectedRoute><Home /></ProtectedRoute>
            } />
            <Route path="/wallet" element={
                <ProtectedRoute><Wallet /></ProtectedRoute>
            } />
            <Route path="/profile" element={
                <ProtectedRoute><Vip /></ProtectedRoute>
            } />
            <Route path="/activity" element={
                <ProtectedRoute><Activity /></ProtectedRoute>
            } />
            <Route path="/notifications" element={
                <ProtectedRoute><Notifications /></ProtectedRoute>
            } />
            <Route path="/leaderboard" element={
                <ProtectedRoute><Leaderboard /></ProtectedRoute>
            } />
            
            <Route path="/game/aviator" element={
                <GameLayout><Aviator /></GameLayout>
            } />
            <Route path="/game/wingo" element={
                <ProtectedRoute><Wingo /></ProtectedRoute>
            } />
            <Route path="/game/roulette" element={
                <GameLayout><Roulette /></GameLayout>
            } />
            <Route path="/game/dragontiger" element={
                <GameLayout><DragonTiger /></GameLayout>
            } />
            <Route path="/game/mines" element={
                <GameLayout><Mines /></GameLayout>
            } />
            <Route path="/game/chickenroad" element={
                <ProtectedRoute><ChickenRoad /></ProtectedRoute>
            } />
            <Route path="/game/plinko" element={
                <GameLayout><Plinko /></GameLayout>
            } />
            <Route path="/game/dragontower" element={
                <GameLayout><DragonTower /></GameLayout>
            } />
            <Route path="/game/coinflip" element={
                <ProtectedRoute><CoinFlip /></ProtectedRoute>
            } />
            <Route path="/game/keno" element={
                <GameLayout><Keno /></GameLayout>
            } />
            <Route path="/game/dice" element={
                <GameLayout><Dice /></GameLayout>
            } />
            <Route path="/spin" element={
                <ProtectedRoute><Spin /></ProtectedRoute>
            } />
            
            <Route path="/admin" element={
                <ProtectedRoute><Admin /></ProtectedRoute>
            } />
            
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    </HashRouter>
  );
};

export default App;
