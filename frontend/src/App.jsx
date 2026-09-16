import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './hooks/useTheme';
import AppRoutes from './routes/AppRoutes';
import { DemoAuthProvider } from './hooks/useDemoAuth';

export default function App() {
  return <BrowserRouter><ThemeProvider><DemoAuthProvider><AppRoutes /></DemoAuthProvider></ThemeProvider></BrowserRouter>;
}
