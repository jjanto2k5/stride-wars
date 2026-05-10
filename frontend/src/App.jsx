import { Routes, Route, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from './context/AuthContext';
import { Toaster } from 'react-hot-toast'; 
import Login from './pages/Login';
import Register from './pages/Register'; 
import MapDashboard from './pages/MapDashboard';

export default function App() {
  const { token } = useContext(AuthContext);

  return (
    <>
      {/* Global Toast Container */}
      <Toaster position="top-center" reverseOrder={false} />
      
      <Routes>
        <Route path="/login" element={!token ? <Login /> : <Navigate to="/" />} />
        <Route path="/register" element={!token ? <Register /> : <Navigate to="/" />} />
        <Route path="/" element={token ? <MapDashboard /> : <Navigate to="/login" />} />
      </Routes>
    </>
  );
}