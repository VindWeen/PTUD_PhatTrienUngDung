import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './hooks/useTheme';
import AppRoutes from './routes/AppRoutes';
import { AuthProvider } from './context/AuthContext';

export default function App() {
  return <BrowserRouter><ThemeProvider><AuthProvider><AppRoutes /></AuthProvider></ThemeProvider></BrowserRouter>;
}
