import { useContext, useEffect, useState } from 'react';

import { AuthContext } from '../context/AuthContext';

import {
  X,
  User,
  Settings,
  LogOut,
  Trash2,
  Mail,
  Map as MapIcon,
  Activity,
} from 'lucide-react';

function formatStat(value = 0) {
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export default function ProfilePanel({
  isOpen,
  onClose,
}) {
  const { user, logout } = useContext(AuthContext);

  const [isLoading, setIsLoading] =
    useState(true);

  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);

    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [isOpen, user]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener(
      'keydown',
      handleEscape
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleEscape
      );
    };
  }, [isOpen, onClose]);

  const handleLogout = () => {
    onClose();

    setTimeout(() => {
      logout();
    }, 150);
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0
                     bg-black/60 backdrop-blur-sm
                     z-[2000] transition-opacity"
          onClick={onClose}
        />
      )}

      <div
        onPointerDown={(e) =>
          e.stopPropagation()
        }
        className={`
          fixed top-0 left-0
          h-[100dvh] w-[85vw] max-w-sm

          bg-gray-900
          border-r border-gray-800

          z-[2001]

          shadow-2xl

          flex flex-col

          transform transition-transform
          duration-300 ease-in-out

          ${
            isOpen
              ? 'translate-x-0'
              : '-translate-x-full'
          }
        `}
      >
        <div
          className="flex items-center justify-between
                     p-6 border-b border-gray-800
                     bg-gray-900"
        >
          <div className="flex items-center gap-3">
            <User
              className="text-blue-400"
              size={24}
            />

            <h2
              className="text-xl font-bold
                         text-white tracking-wide"
            >
              Commander Profile
            </h2>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400
                       hover:text-white
                       p-2 transition-colors"
            aria-label="Close profile"
          >
            <X size={24} />
          </button>
        </div>

        <div
          className="
            flex-1 overflow-y-auto

            p-6 space-y-8

            pb-[max(env(safe-area-inset-bottom),2rem)]
          "
        >
          {isLoading ? (
            <div className="space-y-6 animate-pulse">
              <div
                className="flex flex-col items-center
                           justify-center
                           bg-gray-800/40
                           border border-gray-700/40
                           rounded-3xl p-6"
              >
                <div
                  className="w-20 h-20 rounded-full
                             bg-gray-700 mb-4"
                />

                <div
                  className="h-6 w-40
                             bg-gray-700 rounded mb-3"
                />

                <div
                  className="h-4 w-56
                             bg-gray-800 rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[...Array(2)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-gray-800/40
                               border border-gray-700/40
                               rounded-2xl p-4 h-28"
                  />
                ))}
              </div>

              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-gray-800/40
                               border border-gray-700/40
                               rounded-2xl h-16"
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              <div
                className="flex flex-col items-center
                           justify-center

                           bg-gray-800/50

                           border border-gray-700/50

                           rounded-3xl p-6

                           shadow-inner"
              >
                <div
                  className="
                    w-20 h-20 rounded-full
                    border-4

                    shadow-[0_0_15px_rgba(0,0,0,0.5)]

                    mb-4
                  "
                  style={{
                    borderColor:
                      user?.color || '#3b82f6',

                    backgroundColor: '#1f2937',
                  }}
                />

                <h3
                  className="text-2xl font-black
                             text-white text-center"
                >
                  {user?.name || 'Player'}
                </h3>

                <p
                  className="flex items-center gap-2
                             text-sm text-gray-400
                             mt-2 text-center"
                >
                  <Mail size={14} />

                  {user?.email || 'No email'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div
                  className="bg-gray-800/50
                             border border-gray-700/50
                             rounded-2xl p-4
                             text-center"
                >
                  <MapIcon
                    className="text-green-400
                               mx-auto mb-2"
                    size={24}
                  />

                  <p
                    className="text-2xl font-bold
                               text-white"
                  >
                    {formatStat(
                      user?.stats
                        ?.areaConquered || 0
                    )}
                  </p>

                  <p
                    className="
                      text-[10px]

                      text-gray-500

                      uppercase

                      font-bold

                      tracking-wider
                    "
                  >
                    Sq Meters
                  </p>
                </div>

                <div
                  className="bg-gray-800/50
                             border border-gray-700/50
                             rounded-2xl p-4
                             text-center"
                >
                  <Activity
                    className="text-cyan-400
                               mx-auto mb-2"
                    size={24}
                  />

                  <p
                    className="text-2xl font-bold
                               text-white"
                  >
                    {formatStat(
                      user?.stats
                        ?.totalDistance || 0
                    )}
                  </p>

                  <p
                    className="
                      text-[10px]

                      text-gray-500

                      uppercase

                      font-bold

                      tracking-wider
                    "
                  >
                    Meters Run
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p
                  className="
                    text-xs text-gray-500

                    uppercase tracking-widest

                    font-bold mb-2 pl-2
                  "
                >
                  Account Settings
                </p>

                <button
                  className="
                    w-full flex items-center gap-3

                    bg-gray-800/50 hover:bg-gray-700

                    border border-gray-700/50

                    p-4 rounded-2xl

                    text-white transition-all
                  "
                >
                  <Settings
                    size={20}
                    className="text-gray-400"
                  />

                  <span className="font-semibold">
                    Game Settings
                  </span>
                </button>

                <button
                  onClick={handleLogout}
                  className="
                    w-full flex items-center gap-3

                    bg-red-900/20
                    hover:bg-red-900/40

                    border border-red-900/50

                    p-4 rounded-2xl

                    text-red-400

                    transition-all
                  "
                >
                  <LogOut size={20} />

                  <span className="font-semibold">
                    Log Out
                  </span>
                </button>

                <button
                  disabled
                  className="
                    w-full flex items-center
                    gap-3 justify-center

                    bg-transparent

                    p-4

                    text-gray-600

                    cursor-not-allowed

                    mt-4
                  "
                >
                  <Trash2 size={16} />

                  <span className="text-sm font-semibold">
                    Delete Account
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}