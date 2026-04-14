import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from './components/PrivateRoute.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Content from './pages/Content.jsx';
import Schedule from './pages/Schedule.jsx';
import Bookings from './pages/Bookings.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/admin/login" element={<Login />} />

        {/* Protected */}
        <Route
          path="/admin"
          element={
            <PrivateRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/content"
          element={
            <PrivateRoute>
              <Layout>
                <Content />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/agenda"
          element={
            <PrivateRoute>
              <Layout>
                <Schedule />
              </Layout>
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/agendamentos"
          element={
            <PrivateRoute>
              <Layout>
                <Bookings />
              </Layout>
            </PrivateRoute>
          }
        />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
