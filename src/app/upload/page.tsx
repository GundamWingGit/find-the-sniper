'use client';

import { useState, ChangeEvent } from 'react';
import { supabase } from '@/lib/supabase';
import DashboardFab from '@/components/DashboardFab';

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

const shortId = (id: string) => id.length > 12 ? id.slice(0, 8) + '…' : id;

const inputClassName = "block w-full px-3 py-2 rounded-lg bg-white/5 text-white placeholder-white/50 border border-white/15 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30 disabled:opacity-50";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [state, setState] = useState<UploadState>('idle');
  const [error, setError] = useState<string>('');
  const [publicUrl, setPublicUrl] = useState<string>('');
  const [imageId, setImageId] = useState<number | null>(null);
  const [title, setTitle] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  const validateFile = (file: File): string | null => {
    if (!file.type.startsWith('image/')) {
      return 'Please select an image file';
    }
    if (file.size > 5 * 1024 * 1024) {
      return 'File size must be 5MB or less';
    }
    return null;
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      setState('error');
      return;
    }

    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
    setState('idle');
    setError('');
  };

  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load image'));
      };
      
      img.src = objectUrl;
    });
  };

  const handleUpload = async () => {
    if (!file) return;

    setState('uploading');
    setError('');

    try {
      const path = `uploads/${Date.now()}-${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(path);

      // Get image dimensions
      const { width, height } = await getImageDimensions(file);

      // Insert into database
      const { data: imageData, error: insertError } = await supabase
        .from('images')
        .insert({
          storage_path: path,
          public_url: publicUrl,
          width,
          height,
          title: title.trim() || null,
          location: location.trim() || null,
          description: description.trim() || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setPublicUrl(publicUrl);
      setImageId(imageData.id);
      setState('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setState('error');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(publicUrl);
  };

  const reset = () => {
    setFile(null);
    setPreview('');
    setState('idle');
    setError('');
    setPublicUrl('');
    setImageId(null);
    setTitle('');
    setLocation('');
    setDescription('');
  };

  return (
    <>
    <div className="relative min-h-[80vh] py-8">
      {/* gradient layer behind upload form */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="mx-auto h-[900px] w-[1200px] max-w-full blur-3xl opacity-70"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 30%, rgba(37,99,235,0.40), rgba(147,51,234,0.30), rgba(249,115,22,0.25) 80%)",
          }}
        />
      </div>

      <h1 className="text-3xl md:text-4xl font-semibold text-white text-center mb-6">
        Upload Image
      </h1>
      
      <div className="max-w-3xl mx-auto">
        <div className="rounded-2xl bg-black/70 border border-white/10 shadow-xl p-6 md:p-8">
          {state === 'success' ? (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-4xl mb-2">✅</div>
                <h2 className="text-xl font-semibold text-green-400 mb-4">
                  Upload Successful!
                </h2>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-white mb-1">
                    Public URL:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={publicUrl}
                      readOnly
                      className="flex-1 px-3 py-2 rounded-lg bg-white/5 text-white border border-white/15 text-sm"
                    />
                    <button
                      onClick={copyToClipboard}
                      className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold bg-white/10 text-white/90 hover:bg-white/20 hover:text-white transition shadow-sm hover:shadow backdrop-blur"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Uploaded Image:
                  </label>
                  <img
                    src={publicUrl}
                    alt="Uploaded image"
                    className="w-full h-auto rounded-lg border border-white/20"
                  />
                </div>

                {imageId && (
                  <div className="p-3 bg-green-500/20 border border-green-400/30 rounded-lg">
                    <div className="text-sm">
                      <span className="font-medium text-green-400">Saved to DB</span>
                      {title.trim() && (
                        <div className="text-green-300 mt-1 font-medium">{title.trim()}</div>
                      )}
                      {location.trim() && (
                        <div className="text-green-200 text-xs">{location.trim()}</div>
                      )}
                      {description.trim() && (
                        <div className="text-white/70 text-xs mt-1">Find: {description.trim()}</div>
                      )}
                      {!title.trim() && (
                        <span className="text-green-300 ml-2">Image ID: {shortId(String(imageId))}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-3">
                {imageId && (
                  <a
                    href={`/set-target/${imageId}`}
                    className="w-full inline-flex items-center justify-center rounded-full px-4 py-3 text-base font-semibold bg-white/10 text-white/90 hover:bg-white/20 hover:text-white transition shadow-sm hover:shadow backdrop-blur"
                  >
                    Set Target Now
                  </a>
                )}
                <button
                  onClick={reset}
                  className="w-full inline-flex items-center justify-center rounded-full px-4 py-2 text-base font-semibold bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition"
                >
                  Upload Another
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Title (optional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 80))}
                  placeholder="e.g., Maple Tree #3"
                  maxLength={80}
                  disabled={state === 'uploading'}
                  className={inputClassName}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Location (optional)
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value.slice(0, 120))}
                  placeholder="City, State"
                  maxLength={120}
                  disabled={state === 'uploading'}
                  className={inputClassName}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 280))}
                  placeholder="e.g., Find the hummingbird near the top-left canopy"
                  maxLength={280}
                  rows={3}
                  disabled={state === 'uploading'}
                  className={`${inputClassName} resize-vertical`}
                />
                <div className="text-white/60 text-xs mt-1">{description.length}/280</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Select Image (max 5MB)
                </label>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center rounded-full bg-white/10 px-3 py-2 text-sm text-white/90 hover:bg-white/20 cursor-pointer transition">
                    Choose File
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      disabled={state === 'uploading'}
                      className="hidden"
                    />
                  </label>
                  <span className="text-white/70 text-sm">{file ? file.name : 'No file selected'}</span>
                </div>
              </div>

              {preview && (
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Preview:
                  </label>
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full h-auto rounded-lg border border-white/20 max-h-64 object-contain"
                  />
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-500/20 border border-red-400/30 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={!file || state === 'uploading'}
                className="w-full inline-flex items-center justify-center rounded-full px-4 py-3 text-base font-semibold bg-white/10 text-white/90 hover:bg-white/20 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm hover:shadow backdrop-blur"
              >
                {state === 'uploading' ? 'Uploading...' : 'Upload Image'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    <DashboardFab href="/dashboard" label="Dashboard" />
    </>
  );
}
