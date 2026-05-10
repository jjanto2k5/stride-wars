import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    const toastId = toast.loading('Creating your commander profile...');
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast.success('Welcome to Stride Wars!', { id: toastId });
        login(data.user, data.token);
        navigate('/'); 
      } else {
        toast.error('Failed to create account', { id: toastId });
        setError(data.message || 'Registration failed');
      }
    } catch (err) {
      toast.error('Server error', { id: toastId });
      setError('Server error. Is the backend running?');
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-900 px-6">
      <div className="w-full max-w-sm bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
        
        <div className="flex flex-col items-center mb-8">
          <div className="bg-green-500 p-3 rounded-full mb-3 shadow-lg shadow-green-500/30">
            <MapPin size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-wide">Join the War</h1>
          <p className="text-gray-400 text-sm mt-1">Create your runner profile.</p>
        </div>

        {error && <div className="bg-red-500/10 text-red-400 p-3 rounded-lg text-sm text-center mb-4 border border-red-500/20">{error}</div>}

        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Runner Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
            required
          />
          <input
            type="password"
            placeholder="Password (min 6 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
            required
            minLength={6}
          />
          <button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl mt-2 transition-colors shadow-lg shadow-green-600/30"
          >
            Deploy
          </button>
        </form>

        <p className="text-gray-400 text-sm text-center mt-6">
          Already a commander? <Link to="/login" className="text-blue-400 hover:text-blue-300 font-bold">Log in here</Link>
        </p>

      </div>
    </div>
  );
}