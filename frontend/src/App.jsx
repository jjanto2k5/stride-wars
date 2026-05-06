import { Routes, Route, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from './context/AuthContext';
import Login from './pages/Login';
import MapDashboard from './pages/MapDashboard'; // Import the real one!

export default function App() {
  const { token } = useContext(AuthContext);

  return (
    <Routes>
      <Route path="/login" element={!token ? <Login /> : <Navigate to="/" />} />
      <Route path="/" element={token ? <MapDashboard /> : <Navigate to="/login" />} />
    </Routes>
  );
}