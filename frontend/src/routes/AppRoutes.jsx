import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from '../pages/AuthPage';
import { useDemoAuth } from '../hooks/useDemoAuth';
import MainLayout from '../layouts/MainLayout';
import Dashboard from '../pages/Dashboard';
import ProfilePortfolio from '../pages/ProfilePortfolio';
import AIForecast from '../pages/AIForecast';
import NotFound from '../pages/NotFound';

export default function AppRoutes() {
  const { signedIn } = useDemoAuth();
  return (
    <Routes>
      <Route path="/login" element={signedIn ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="/" element={signedIn ? <MainLayout /> : <Navigate to="/login" replace />}>
        <Route index element={<Dashboard />} />
        <Route path="profile" element={<ProfilePortfolio />} />
        <Route path="ai-forecast" element={<AIForecast />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
