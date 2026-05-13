import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleForgotPassword = async (e) => {
    e.preventDefault();

    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/auth/forgot-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            frontendUrl: window.location.origin,
          }),
        }
      );

      const data = await res.json();

      if (data.success) {
        setMessage('If that email exists, a reset link has been sent.');
      } else {
        setError(data.message || 'Something went wrong');
      }
    } catch {
      setError('Server error. Please try again.');
    }

    setLoading(false);
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gray-900 px-6">
      <div className="w-full max-w-sm bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-wide">
            Forgot Password
          </h1>
          <p className="text-gray-400 text-sm mt-2 text-center">
            Enter your registered email to receive a password reset link.
          </p>
        </div>

        {message && (
          <div className="bg-green-500/10 text-green-400 p-3 rounded-lg text-sm text-center mb-4 border border-green-500/20">
            {message}
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 text-red-400 p-3 rounded-lg text-sm text-center mb-4 border border-red-500/20">
            {error}
          </div>
        )}

        <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Enter your registered email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-blue-600/30"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <p className="text-center mt-6 text-gray-400 text-sm">
          <Link
            to="/login"
            className="text-blue-400 hover:text-blue-300 font-medium"
          >
            Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
}