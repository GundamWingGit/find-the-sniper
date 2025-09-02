'use client';

import { useState, ChangeEvent } from 'react';
import { supabase } from '@/lib/supabase';

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

const shortId = (id: string) => id.length > 12 ? id.slice(0, 8) + '…' : id;

const inputClassName = "block w-full px-3 py-2 text-gray-900 placeholder:text-gray-500 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50";

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
    <div className="py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
        Upload Image
      </h1>
      
      <div className="max-w-2xl mx-auto">
        <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
          {state === 'success' ? (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-4xl mb-2">✅</div>
                <h2 className="text-xl font-semibold text-green-600 mb-4">
                  Upload Successful!
                </h2>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Public URL:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={publicUrl}
                      readOnly
                      className="flex-1 px-3 py-2 text-gray-900 bg-gray-50 border border-gray-300 rounded-md text-sm"
                    />
                    <button
                      onClick={copyToClipboard}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Uploaded Image:
                  </label>
                  <img
                    src={publicUrl}
                    alt="Uploaded image"
                    className="w-full h-auto rounded-lg border border-gray-200"
                  />
                </div>

                {imageId && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="text-sm">
                      <span className="font-medium text-green-700">Saved to DB</span>
                      {title.trim() && (
                        <div className="text-green-600 mt-1 font-medium">{title.trim()}</div>
                      )}
                      {location.trim() && (
                        <div className="text-green-500 text-xs">{location.trim()}</div>
                      )}
                      {description.trim() && (
                        <div className="text-gray-500 text-xs mt-1">Find: {description.trim()}</div>
                      )}
                      {!title.trim() && (
                        <span className="text-green-600 ml-2">Image ID: {shortId(String(imageId))}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-3">
                {imageId && (
                  <a
                    href={`/set-target/${imageId}`}
                    className="block w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-center font-medium"
                  >
                    Set Target Now
                  </a>
                )}
                <button
                  onClick={reset}
                  className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Upload Another
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                <div className="text-xs text-gray-500 mt-1">{description.length}/280</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Image (max 5MB)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  disabled={state === 'uploading'}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                />
              </div>

              {preview && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preview:
                  </label>
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full h-auto rounded-lg border border-gray-200 max-h-64 object-contain"
                  />
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={!file || state === 'uploading'}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {state === 'uploading' ? 'Uploading...' : 'Upload Image'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
