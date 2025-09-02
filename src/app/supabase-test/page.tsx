'use client';

import { useEffect, useState } from 'react';
import supabase from "@/lib/supabase";


export default function SupabaseTestPage() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const testConnection = async () => {
      try {
        await supabase.auth.getSession();
        setStatus('connected');
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    testConnection();
  }, []);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const urlSuffix = supabaseUrl.slice(-16);

  return (
    <div className="py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
        Supabase Connection Test
      </h1>

      <div className="max-w-md mx-auto">
        <div className={`p-6 rounded-lg border-2 ${
          status === 'connected' 
            ? 'bg-green-50 border-green-200' 
            : status === 'error'
            ? 'bg-red-50 border-red-200'
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="text-center">
            <div className="text-2xl mb-2">
              {status === 'connected' && '✅'}
              {status === 'error' && '❌'}
              {status === 'checking' && '⏳'}
            </div>
            
            <h2 className={`text-lg font-semibold mb-2 ${
              status === 'connected' 
                ? 'text-green-800' 
                : status === 'error'
                ? 'text-red-800'
                : 'text-gray-800'
            }`}>
              {status === 'connected' && 'Connected'}
              {status === 'error' && 'Error'}
              {status === 'checking' && 'Checking...'}
            </h2>

            {status === 'error' && error && (
              <p className="text-red-600 text-sm mb-4">
                {error}
              </p>
            )}

            <div className="text-sm text-gray-600">
              <p className="font-medium">Supabase URL (last 16 chars):</p>
              <p className="font-mono bg-gray-100 px-2 py-1 rounded mt-1">
                ...{urlSuffix}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
