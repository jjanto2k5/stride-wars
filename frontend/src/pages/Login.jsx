import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { MapPin } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        login(data.user, data.token);
        navigate('/'); 
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('Server error. Is the backend running?');
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-900 px-6">
      <div className="w-full max-w-sm bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
        
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-500 p-3 rounded-full mb-3 shadow-lg shadow-blue-500/30">
            <MapPin size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-wide">Stride Wars</h1>
          <p className="text-gray-400 text-sm mt-1">Conquer your city.</p>
        </div>

        {error && <div className="bg-red-500/10 text-red-400 p-3 rounded-lg text-sm text-center mb-4 border border-red-500/20">{error}</div>}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email (e.g. player1@test.com)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            required
          />
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl mt-2 transition-colors shadow-lg shadow-blue-600/30"
          >
            Enter the Grid
          </button>
        </form>

        <p className="text-gray-400 text-sm text-center mt-6">
          New to the city? <Link to="/register" className="text-green-400 hover:text-green-300 font-bold">Enlist here</Link>
        </p>

      </div>
    </div>
  );
}